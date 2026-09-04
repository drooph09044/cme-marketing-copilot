// Thin fetch client for the FastAPI backend.
// All requests are proxied through Next.js' rewrites — see next.config.mjs.

import type {
  Journey, JourneySummary, Profile, TestEvent, LogLine, RunStats,
  Segment, QAReport, QARunRequest, QARunResponse,
  ProfileSynthRequest, ProfileSynthExtendRequest,
  ProfileSynthJobResponse, ProfileSynthStatusResponse,
  CohortProfile, TestSuite, SimulationResult, SimulateStatusResponse,
} from "./types";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async listJourneys(): Promise<JourneySummary[]> {
    return http<JourneySummary[]>("/journeys");
  },
  async getJourney(id?: string): Promise<Journey> {
    return http<Journey>(id ? `/journey?id=${encodeURIComponent(id)}` : "/journey");
  },
  async getProfiles(): Promise<Profile[]> {
    return http<Profile[]>("/profiles");
  },
  async generateProfiles(opts: { count: number; bias: "balanced" | "edge" | "compliant" }): Promise<Profile[]> {
    return http<Profile[]>("/profiles/generate", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  },
  /**
   * Trigger a test run. Returns the run id, then streams step events over SSE.
   * Consumers should call `subscribeRun(runId, onStep)` to receive the log lines.
   */
  async startRun(event: TestEvent): Promise<{ runId: string; stats: RunStats }> {
    return http<{ runId: string; stats: RunStats }>("/runs", {
      method: "POST",
      body: JSON.stringify(event),
    });
  },
  subscribeRun(
    runId: string,
    handlers: {
      onStep?: (line: LogLine & { nodeId: string; progress: number }) => void;
      onDone?: (payload: { status: "passed" | "failed"; duration: number }) => void;
      onError?: () => void;
    },
  ): () => void {
    const es = new EventSource(`/api/runs/${runId}/stream`);
    es.addEventListener("step", (e) => {
      try {
        handlers.onStep?.(JSON.parse((e as MessageEvent).data));
      } catch (err) {
        console.error("Failed to parse step event", err);
      }
    });
    let doneReceived = false;

    es.addEventListener("done", (e) => {
      doneReceived = true;
      es.close();
      try {
        handlers.onDone?.(JSON.parse((e as MessageEvent).data));
      } catch (err) {
        console.error("Failed to parse done event", err);
      }
    });

    // EventSource fires onerror both on real errors AND on normal server-initiated
    // close (after the "done" event). Only treat it as a failure if "done" was
    // never received — otherwise it's just the natural end-of-stream close.
    es.onerror = () => {
      if (!doneReceived) {
        es.close();
        handlers.onError?.();
      }
    };
    return () => es.close();
  },
  async listSegments(): Promise<Segment[]> {
    return http<Segment[]>("/segments");
  },
  async getSegment(id: string): Promise<Segment> {
    return http<Segment>(`/segments/${encodeURIComponent(id)}`);
  },
  async synthProfiles(req: ProfileSynthRequest): Promise<ProfileSynthJobResponse> {
    return http<ProfileSynthJobResponse>("/profiles/synth", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
  async extendProfiles(req: ProfileSynthExtendRequest): Promise<ProfileSynthJobResponse> {
    return http<ProfileSynthJobResponse>("/profiles/synth/extend", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
  async getSynthStatus(synthId: string): Promise<ProfileSynthStatusResponse> {
    return http<ProfileSynthStatusResponse>(`/profiles/synth/${encodeURIComponent(synthId)}`);
  },

  /** Simulate one profile through the journey. Schedules + polls until done. */
  async simulateProfile(
    req: { journeyId: string; segmentId: string; profile: CohortProfile; suites: TestSuite[] },
    { intervalMs = 2000, maxAttempts = 90 } = {},
  ): Promise<SimulationResult> {
    const { simId } = await http<{ simId: string; status: string }>("/simulate", {
      method: "POST",
      body: JSON.stringify(req),
    });
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, intervalMs));
      const st = await http<SimulateStatusResponse>(`/simulate/${encodeURIComponent(simId)}`);
      if (st.status === "done" && st.result) return st.result;
      if (st.status === "failed") throw new Error(st.error || "Simulation failed");
    }
    throw new Error("Simulation timed out");
  },
  async startQARun(req: QARunRequest): Promise<QARunResponse> {
    return http<QARunResponse>("/runs/qa", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
  async getReport(runId: string): Promise<QAReport> {
    return http<QAReport>(`/runs/${encodeURIComponent(runId)}/report`);
  },

  /** Poll for a QA report every `intervalMs` until the endpoint returns 200.
   *  Used as a fallback when the SSE stream fails or the connection is dropped.
   *  Returns a cancel function. */
  pollReport(
    runId: string,
    onReport: (report: QAReport) => void,
    onGiveUp: () => void,
    { intervalMs = 4000, maxAttempts = 75 } = {},
  ): () => void {
    let attempts = 0;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const report = await api.getReport(runId);
        if (!cancelled) onReport(report);
        return;
      } catch {
        // 404 = not ready yet; anything else = still wait
      }
      if (attempts >= maxAttempts) {
        if (!cancelled) onGiveUp();
        return;
      }
      setTimeout(tick, intervalMs);
    };
    setTimeout(tick, intervalMs);
    return () => { cancelled = true; };
  },
};
