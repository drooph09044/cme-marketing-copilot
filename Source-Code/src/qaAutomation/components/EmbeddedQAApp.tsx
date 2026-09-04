import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SubHeader from "./SubHeader";
import Inspector from "./Inspector";
import { api } from "../lib/api";
import { computePreflight } from "../lib/preflight";
import type {
  Journey, JourneySummary, Profile, ProfileTag, RunState, Segment,
  QAReport, TestSuite, TestPlan, QARunResult, SimSummary,
} from "../lib/types";

const INITIAL_RUN_STATE: RunState = {
  status: "idle",
  visited: new Set<string>(),
  active: null,
  logs: [],
  progress: 0,
};

interface Props {
  /** Pre-select this journey on mount instead of the first in the list. */
  initialJourneyId?: string | null;
  /** When true, automatically trigger profile+suite synthesis once the journey and segment are ready. */
  autoSynth?: boolean;
}

export default function EmbeddedQAApp({ initialJourneyId = null, autoSynth = false }: Props) {
  const [journeys, setJourneys] = useState<JourneySummary[]>([]);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(initialJourneyId);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedNodeId] = useState<string | null>(null);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [runState, setRunState] = useState<RunState>(INITIAL_RUN_STATE);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [qaRunning, setQaRunning] = useState(false);
  const [qaRuns, setQaRuns] = useState<QARunResult[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [synthRunning, setSynthRunning] = useState(false);
  const [selectedWalkId, setSelectedWalkId] = useState<number | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"profiles" | "criteria" | "qa">("profiles");
  const [extendError, setExtendError] = useState<string | null>(null);
  const [simVisited, setSimVisited] = useState<string[]>([]);
  const [simSummary, setSimSummary] = useState<SimSummary | null>(null);

  // Track whether auto-synth has already fired so it only runs once per mount.
  const autoSynthFiredRef = useRef(false);

  // Bootstrap: load journey list + the pre-selected (or first) journey + its segments.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const js = await api.listJourneys();
        if (cancelled) return;
        const targetId = initialJourneyId ?? js[0]?.id ?? "season-ticket-renewal-journey";
        const [j, segs] = await Promise.all([
          api.getJourney(targetId),
          api.listSegments(targetId),
        ]);
        if (cancelled) return;
        setJourneys(js);
        setJourney(j);
        setActiveJourneyId(j.id);
        setSegments(segs);
        // Pre-select the first segment so the user can generate immediately.
        setSelectedSegmentId(segs[0]?.id ?? null);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap journey when dropdown selection changes.
  useEffect(() => {
    if (!activeJourneyId || !journey) return;
    if (activeJourneyId === journey.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [j, relatedSegments] = await Promise.all([
          api.getJourney(activeJourneyId),
          api.listSegments(activeJourneyId),
        ]);
        if (cancelled) return;
        setJourney(j);
        setSegments(relatedSegments);
        setSelectedSegmentId((current) =>
          current && relatedSegments.some((s) => s.id === current) ? current : relatedSegments[0]?.id ?? null
        );
        setTestPlans([]);
        setActivePlanId(null);
        setQaRuns([]);
        setActiveRunId(null);
        setProfiles([]);
        setSelectedProfileIds(new Set());
        setRunState(INITIAL_RUN_STATE);
        setSimVisited([]);
        setSimSummary(null);
        autoSynthFiredRef.current = false;
      } catch {
        // keep previous journey on error
      }
    })();
    return () => { cancelled = true; };
  }, [activeJourneyId, journey]);

  const selectedNode = useMemo(
    () => (journey?.nodes ?? []).find((n) => n.id === selectedNodeId) ?? null,
    [journey, selectedNodeId],
  );

  const preflight = useMemo(
    () => (journey ? computePreflight(journey, profiles) : null),
    [journey, profiles],
  );

  const activeReport = useMemo(
    () => qaRuns.find((r) => r.id === activeRunId)?.report ?? qaRuns[qaRuns.length - 1]?.report ?? null,
    [qaRuns, activeRunId],
  );

  const canvasRunState = useMemo<RunState>(() => {
    if (simVisited.length === 0) return runState;
    return {
      status: "passed",
      visited: new Set(simVisited),
      active: simVisited[simVisited.length - 1] ?? null,
      progress: 100,
      logs: [],
    };
  }, [simVisited, runState]);

  const toProfile = useCallback((p: unknown, idx: number): Profile => {
    const raw = p as {
      id?: string; name?: string; scenario?: string; archetype?: string;
      region?: string; age?: number;
      consent?: unknown; globalConsent?: unknown; fcap?: unknown; lastSend?: string;
      category?: string; holdout?: boolean; suppressionReason?: string;
    };
    const gc = raw.globalConsent ?? raw.consent;
    const consent = typeof gc === "boolean" ? gc : gc == null ? true : Boolean(gc);
    const fcap = typeof raw.fcap === "number" ? raw.fcap : Number(raw.fcap) || 0;
    const archetype = (raw.archetype ?? "").toLowerCase();
    const reason = raw.suppressionReason;
    const tag: ProfileTag =
      reason === "holdout_segment" || raw.holdout === true || archetype === "holdout"
        ? "holdout"
        : reason === "no_consent" || reason === "experiment_holdback"
          || raw.category === "ineligible" || archetype === "ineligible"
          || archetype === "consent_suppressed" || archetype === "experiment_holdback"
          ? "suppressed"
          : fcap >= 3 || archetype === "fcap_capped"
            ? "fcap-risk"
            : archetype.startsWith("experiment_variant")
              ? "control"
              : "test";
    return {
      id: raw.id ?? `gen_${idx}`,
      name: typeof raw.name === "string" ? raw.name : "Generated",
      region: typeof raw.region === "string" ? raw.region : "—",
      age: typeof raw.age === "number" ? raw.age : 30,
      consent,
      fcap,
      lastSend: typeof raw.lastSend === "string" ? raw.lastSend : "0d",
      segment: raw.archetype ?? "",
      tag,
      scenario: raw.scenario,
      archetype: raw.archetype,
    };
  }, []);

  const handleSynthSuites = useCallback(async (): Promise<TestPlan | null> => {
    if (!activeJourneyId || !selectedSegmentId) return null;
    setSynthRunning(true);
    setProfiles([]);
    try {
      const { synthId } = await api.synthProfiles({ journeyId: activeJourneyId, segmentId: selectedSegmentId });
      const startedAt = Date.now();
      const TIMEOUT_MS = 5 * 60 * 1000;
      while (true) {
        await new Promise((r) => setTimeout(r, 2000));
        if (Date.now() - startedAt > TIMEOUT_MS) throw new Error("Synth job timed out after 5 minutes.");
        const status = await api.getSynthStatus(synthId);
        if (status.status === "done") {
          const suites = status.suites ?? [];
          const cohort = status.profiles ?? [];
          const newPlan: TestPlan = {
            id: `plan-${Date.now()}`,
            createdAt: new Date().toISOString(),
            journeyId: activeJourneyId,
            segmentId: selectedSegmentId,
            suites,
            profiles: cohort,
          };
          setTestPlans((prev) => [...prev, newPlan]);
          setActivePlanId(newPlan.id);
          setProfiles(cohort.map((p, i) => toProfile(p, i)));
          setSelectedProfileIds(new Set());
          return newPlan;
        }
        if (status.status === "failed") throw new Error(status.error || "Synth job failed");
      }
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setSynthRunning(false);
    }
  }, [activeJourneyId, selectedSegmentId, toProfile]);

  const handleExtendSuites = useCallback(async (instruction: string, count: number) => {
    if (!activeJourneyId || !selectedSegmentId) return;
    if (!instruction.trim()) return;
    const activePlan = testPlans.find((p) => p.id === activePlanId) ?? testPlans[testPlans.length - 1];
    if (!activePlan) return;
    setSynthRunning(true);
    setExtendError(null);
    try {
      const existing = activePlan.profiles.map((p) => ({ id: (p as { id?: string }).id ?? "", name: (p as { name?: string }).name ?? "" }));
      const { synthId } = await api.extendProfiles({ journeyId: activeJourneyId, segmentId: selectedSegmentId, instruction, existingProfiles: existing, count });
      const startedAt = Date.now();
      const TIMEOUT_MS = 5 * 60 * 1000;
      while (true) {
        await new Promise((r) => setTimeout(r, 2000));
        if (Date.now() - startedAt > TIMEOUT_MS) throw new Error("Extend job timed out after 5 minutes.");
        const status = await api.getSynthStatus(synthId);
        if (status.status === "done") {
          const added = status.profiles ?? [];
          const mergedCohort = [...activePlan.profiles, ...added];
          const newPlan: TestPlan = {
            id: `plan-${Date.now()}`,
            createdAt: new Date().toISOString(),
            journeyId: activePlan.journeyId,
            segmentId: activePlan.segmentId,
            suites: activePlan.suites,
            profiles: mergedCohort,
          };
          setTestPlans((prev) => [...prev, newPlan]);
          setActivePlanId(newPlan.id);
          setProfiles(mergedCohort.map((p, i) => toProfile(p, i)));
          break;
        }
        if (status.status === "failed") throw new Error(status.error || "Extend job failed");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Extend failed:", msg);
      setExtendError(msg);
    } finally {
      setSynthRunning(false);
    }
  }, [activeJourneyId, selectedSegmentId, testPlans, activePlanId, toProfile]);

  const startQARunWithSuites = useCallback(async (suitesToRun: TestSuite[], cohort: Record<string, unknown>[]) => {
    if (!activeJourneyId || !selectedSegmentId) return;
    const runJourneyId = activeJourneyId;
    const runSegmentId = selectedSegmentId;
    const runPlanId = activePlanId ?? testPlans[testPlans.length - 1]?.id ?? null;
    const runProfileCount = cohort.length;
    setQaRunning(true);
    setRunState({ status: "running", visited: new Set(), active: null, logs: [], progress: 0 });
    try {
      const { runId } = await api.startQARun({ journeyId: runJourneyId, segmentId: runSegmentId, suites: suitesToRun, baseProfiles: cohort });

      const recordRun = (report: QAReport) => {
        const result: QARunResult = { id: runId, createdAt: new Date().toISOString(), journeyId: runJourneyId, segmentId: runSegmentId, planId: runPlanId, profileCount: runProfileCount, report };
        setQaRuns((prev) => { const without = prev.filter((r) => r.id !== runId); return [...without, result]; });
        setActiveRunId(runId);
        setSelectedWalkId(null);
      };

      const finishRun = async (reportRunId: string, status: "passed" | "failed", duration: number) => {
        setQaRunning(false);
        setRunState((prev) => ({ ...prev, status, progress: 100, duration }));
        try { recordRun(await api.getReport(reportRunId)); } catch (e) { console.error(e); }
      };

      let pollCancel: (() => void) | null = null;
      api.subscribeRun(runId, {
        onStep: (line) => {
          setRunState((prev) => ({
            ...prev, status: "running", active: line.nodeId, progress: line.progress,
            logs: [...prev.logs, { ts: line.ts, level: line.level, node: line.node, label: line.label, msg: line.msg }],
          }));
        },
        onDone: async (payload) => { pollCancel?.(); await finishRun(runId, payload.status, payload.duration); },
        onError: () => {
          console.warn("SSE stream failed, switching to poll-based fallback for run", runId);
          setRunState((prev) => ({
            ...prev,
            logs: [...prev.logs, { ts: new Date().toLocaleTimeString("en", { hour12: false }), level: "warn" as const, node: "stream", label: "Connection", msg: "Live stream unavailable — polling for results…" }],
          }));
          pollCancel = api.pollReport(runId, (report) => { setQaRunning(false); setRunState((prev) => ({ ...prev, status: "passed", progress: 100 })); recordRun(report); }, () => { console.error("Poll gave up waiting for report", runId); setQaRunning(false); });
        },
      });
    } catch (e) {
      console.error(e);
      setQaRunning(false);
    }
  }, [activeJourneyId, selectedSegmentId, activePlanId, testPlans]);

  const scopeCohort = useCallback((cohort: Record<string, unknown>[]): Record<string, unknown>[] => {
    if (selectedProfileIds.size === 0) return cohort;
    const scoped = cohort.filter((p) => selectedProfileIds.has(String((p as { id?: unknown }).id)));
    return scoped.length > 0 ? scoped : cohort;
  }, [selectedProfileIds]);

  const handleRunQA = useCallback(async () => {
    const activePlan = testPlans.find((p) => p.id === activePlanId) ?? testPlans[testPlans.length - 1];
    const activeSuites = activePlan?.suites ?? [];
    if (activeSuites.length === 0 || !activePlan) return;
    await startQARunWithSuites(activeSuites, scopeCohort(activePlan.profiles));
  }, [testPlans, activePlanId, startQARunWithSuites, scopeCohort]);

  const handleGenerateAndRun = useCallback(async () => {
    if (!activeJourneyId || !selectedSegmentId) return;
    const activePlan = testPlans.find((p) => p.id === activePlanId) ?? testPlans[testPlans.length - 1];
    const existingSuites = activePlan?.suites ?? [];
    if (existingSuites.length === 0) {
      const newPlan = await handleSynthSuites();
      if (!newPlan || newPlan.suites.length === 0) return;
      await startQARunWithSuites(newPlan.suites, newPlan.profiles);
    } else if (activePlan) {
      await startQARunWithSuites(existingSuites, scopeCohort(activePlan.profiles));
    }
  }, [activeJourneyId, selectedSegmentId, testPlans, activePlanId, handleSynthSuites, startQARunWithSuites, scopeCohort]);

  // Auto-synth: fire once when journey + segment are both ready (and autoSynth is on).
  useEffect(() => {
    if (!autoSynth) return;
    if (!activeJourneyId || !selectedSegmentId) return;
    if (autoSynthFiredRef.current) return;
    autoSynthFiredRef.current = true;
    setInspectorTab("qa");
    handleSynthSuites();
  }, [autoSynth, activeJourneyId, selectedSegmentId, handleSynthSuites]);

  if (loadError) {
    return (
      <div className="jo jo-bootstrap-error" style={{ padding: "24px" }}>
        <h2 style={{ marginBottom: 8, fontSize: 15 }}>Could not reach the QA API</h2>
        <p style={{ fontSize: 13, opacity: 0.7 }}>{loadError}</p>
      </div>
    );
  }

  if (!journey || !preflight) {
    return (
      <div className="jo jo-bootstrap" style={{ padding: "24px", fontSize: 13, opacity: 0.6 }}>
        Loading journey…
      </div>
    );
  }

  return (
    <div className="jo mode-test jo-embedded">
      <SubHeader
        journey={journey}
        journeys={journeys}
        onSelectJourney={setActiveJourneyId}
        segments={segments}
        selectedSegmentId={selectedSegmentId}
        onSegmentChange={setSelectedSegmentId}
        qaRunning={qaRunning}
        synthRunning={synthRunning}
        onGenerateAndRun={async () => { setInspectorTab("qa"); await handleSynthSuites(); }}
        canSynth={!!activeJourneyId && !!selectedSegmentId}
        hasSuites={(testPlans.find((p) => p.id === activePlanId) ?? testPlans[testPlans.length - 1])?.suites?.length > 0}
        disableSelectors
      />

      <div className="jo-workspace jo-workspace--embedded">
        <Inspector
          journey={journey}
          selectedNode={selectedNode}
          profiles={profiles}
          setProfiles={setProfiles}
          selectedProfileIds={selectedProfileIds}
          setSelectedProfileIds={setSelectedProfileIds}
          qaRuns={qaRuns}
          activeRunId={activeRunId}
          onSelectRun={setActiveRunId}
          testPlans={testPlans}
          activePlanId={activePlanId}
          onSelectPlan={setActivePlanId}
          onSynthSuites={handleSynthSuites}
          onExtendSuites={handleExtendSuites}
          extendError={extendError}
          clearExtendError={() => setExtendError(null)}
          synthRunning={synthRunning}
          onRunQA={handleRunQA}
          qaRunning={qaRunning}
          qaProgress={runState.progress}
          qaLogs={runState.logs}
          canSynth={!!activeJourneyId && !!selectedSegmentId}
          selectedWalkId={selectedWalkId}
          onSelectWalk={setSelectedWalkId}
          onPathChange={setSimVisited}
          onSimResult={setSimSummary}
          activeTab={inspectorTab}
          onTabChange={setInspectorTab}
        />
      </div>
    </div>
  );
}
