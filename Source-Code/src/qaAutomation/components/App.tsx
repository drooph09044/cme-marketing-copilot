"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SubHeader from "./SubHeader";
import CanvasToolbar from "./CanvasToolbar";
import JourneyCanvas from "./JourneyCanvas";
import Inspector from "./Inspector";
import { api } from "../lib/api";
import { computePreflight } from "../lib/preflight";
import type { Journey, JourneySummary, Profile, ProfileTag, RunState, Segment, QAReport, TestSuite, TestPlan, QARunResult, SimSummary } from "../lib/types";

const INITIAL_RUN_STATE: RunState = {
  status: "idle",
  visited: new Set<string>(),
  active: null,
  logs: [],
  progress: 0,
};

export default function App() {
  const [journeys, setJourneys] = useState<JourneySummary[]>([]);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [runState, setRunState] = useState<RunState>(INITIAL_RUN_STATE);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [qaRunning, setQaRunning] = useState(false);
  // Versioned QA runs — each Run QA appends a new result; previous runs stay viewable.
  const [qaRuns, setQaRuns] = useState<QARunResult[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  // All generated test plans (newest last). Each plan is a versioned set of suites
  // for a specific journey+segment. Regenerate creates a new plan, not an overwrite.
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [synthRunning, setSynthRunning] = useState(false);
  // Index of the walk the user clicked in QA Runs — drives canvas highlight.
  const [selectedWalkId, setSelectedWalkId] = useState<number | null>(null);
  // Which inspector tab is active — used to expand the sidebar when QA Runs is open.
  const [inspectorTab, setInspectorTab] = useState<"profiles" | "criteria" | "qa">("profiles");
  // Inline error surface for the Profiles "Add more profiles" flow.
  const [extendError, setExtendError] = useState<string | null>(null);

  // Bootstrap journey list, active journey, and profiles from the FastAPI backend.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load journey list first so we can pass the first id to getJourney()
        // (Task 16 made the id param required on /journey).
        const js = await api.listJourneys();
        if (cancelled) return;
        const firstId = js[0]?.id ?? "season-ticket-renewal-journey";
        const [j, segs] = await Promise.all([
          api.getJourney(firstId),
          api.listSegments(firstId),
        ]);
        if (cancelled) return;
        setJourneys(js);
        setJourney(j);
        setActiveJourneyId(j.id);
        // Profiles start empty — they populate when test suites are generated.
        setSegments(segs);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Swap the active journey when the dropdown selection changes.
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
          current && relatedSegments.some((segment) => segment.id === current) ? current : null
        );
        setTestPlans([]);
        setActivePlanId(null);
        setQaRuns([]);
        setActiveRunId(null);
        setProfiles([]);
        setSelectedProfileIds(new Set());
        setSelectedNodeId(null);
        setRunState(INITIAL_RUN_STATE);
        setSimVisited([]);
        setSimSummary(null);
      } catch {
        // ignore; UI keeps the previously-loaded journey
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeJourneyId, journey]);

  const selectedNode = useMemo(
    () => (journey?.nodes ?? []).find((n) => n.id === selectedNodeId) ?? null,
    [journey, selectedNodeId],
  );

  const preflight = useMemo(
    () => (journey ? computePreflight(journey, profiles) : null),
    [journey, profiles],
  );

  // The report of the currently-selected QA run version (or the latest).
  const activeReport = useMemo(
    () => qaRuns.find((r) => r.id === activeRunId)?.report ?? qaRuns[qaRuns.length - 1]?.report ?? null,
    [qaRuns, activeRunId],
  );

  // Nodes the currently-selected simulated profile visited — highlights the canvas.
  const [simVisited, setSimVisited] = useState<string[]>([]);
  // Compact result of the selected profile's simulation — shown in a canvas corner.
  const [simSummary, setSimSummary] = useState<SimSummary | null>(null);

  // When a profile's simulation is selected in QA Runs, light up the nodes it
  // visited on the journey canvas. Otherwise show the live runState.
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

  // Map a generated cohort profile (archetype shape) to the simpler Profile
  // shape the Profiles table renders. Used by both initial synth and extend.
  const toProfile = useCallback((p: unknown, idx: number): Profile => {
    const raw = p as {
      id?: string; name?: string; scenario?: string; archetype?: string;
      region?: string; age?: number;
      consent?: unknown; globalConsent?: unknown; fcap?: unknown; lastSend?: string;
      category?: string; holdout?: boolean; suppressionReason?: string;
    };
    // Coerce LLM-supplied fields to strict types — never trust the wire shape.
    // Global consent: prefer globalConsent, fall back to legacy `consent`.
    const gc = raw.globalConsent ?? raw.consent;
    const consent = typeof gc === "boolean" ? gc : gc == null ? true : Boolean(gc);
    const fcap = typeof raw.fcap === "number" ? raw.fcap : Number(raw.fcap) || 0;
    const archetype = (raw.archetype ?? "").toLowerCase();
    const reason = raw.suppressionReason;
    // Archetype / suppression reason → profile tag.
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

  // Returns the newly created plan so callers can chain a QA run immediately.
  const handleSynthSuites = useCallback(async (): Promise<TestPlan | null> => {
    if (!activeJourneyId || !selectedSegmentId) return null;
    setSynthRunning(true);
    setProfiles([]);
    // Past QA runs are kept (versioned) — regenerating profiles starts a new plan,
    // not a wipe. New runs against the new plan append as later versions.
    try {
      const { synthId } = await api.synthProfiles({
        journeyId: activeJourneyId,
        segmentId: selectedSegmentId,
      });
      const startedAt = Date.now();
      const TIMEOUT_MS = 5 * 60 * 1000;
      while (true) {
        await new Promise((r) => setTimeout(r, 2000));
        if (Date.now() - startedAt > TIMEOUT_MS) {
          throw new Error("Synth job timed out after 5 minutes.");
        }
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
          setSelectedProfileIds(new Set()); // fresh cohort → clear stale run scope
          return newPlan;
        }
        if (status.status === "failed") {
          throw new Error(status.error || "Synth job failed");
        }
      }
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setSynthRunning(false);
    }
  }, [activeJourneyId, selectedSegmentId, toProfile]);

  // Add profiles via prompt → creates a NEW test-plan VERSION (existing cohort +
  // the new profiles), keeping the same suites. Prior versions are preserved.
  const handleExtendSuites = useCallback(async (instruction: string, count: number) => {
    if (!activeJourneyId || !selectedSegmentId) return;
    if (!instruction.trim()) return;
    const activePlan = testPlans.find((p) => p.id === activePlanId) ?? testPlans[testPlans.length - 1];
    if (!activePlan) return;
    setSynthRunning(true);
    setExtendError(null);
    try {
      const existing = activePlan.profiles.map((p) => ({ id: p.id ?? "", name: p.name ?? "" }));
      const { synthId } = await api.extendProfiles({
        journeyId: activeJourneyId,
        segmentId: selectedSegmentId,
        instruction,
        existingProfiles: existing,
        count,
      });
      const startedAt = Date.now();
      const TIMEOUT_MS = 5 * 60 * 1000;
      while (true) {
        await new Promise((r) => setTimeout(r, 2000));
        if (Date.now() - startedAt > TIMEOUT_MS) {
          throw new Error("Extend job timed out after 5 minutes.");
        }
        const status = await api.getSynthStatus(synthId);
        if (status.status === "done") {
          const added = status.profiles ?? [];
          const mergedCohort = [...activePlan.profiles, ...added];
          // New VERSION (don't mutate the existing plan).
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
        if (status.status === "failed") {
          throw new Error(status.error || "Extend job failed");
        }
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
    // Capture run context now so it's stable even if selections change mid-run.
    const runJourneyId = activeJourneyId;
    const runSegmentId = selectedSegmentId;
    const runPlanId = activePlanId ?? testPlans[testPlans.length - 1]?.id ?? null;
    const runProfileCount = cohort.length;
    setQaRunning(true);
    setRunState({ status: "running", visited: new Set(), active: null, logs: [], progress: 0 });
    try {
      const { runId } = await api.startQARun({
        journeyId: runJourneyId,
        segmentId: runSegmentId,
        suites: suitesToRun,
        baseProfiles: cohort,
      });

      // Append this run as a new version and make it the active one.
      const recordRun = (report: QAReport) => {
        const result: QARunResult = {
          id: runId,
          createdAt: new Date().toISOString(),
          journeyId: runJourneyId,
          segmentId: runSegmentId,
          planId: runPlanId,
          profileCount: runProfileCount,
          report,
        };
        // Replace if a run with this id already exists (idempotent), else append.
        setQaRuns((prev) => {
          const without = prev.filter((r) => r.id !== runId);
          return [...without, result];
        });
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
            ...prev,
            status: "running",
            active: line.nodeId,
            progress: line.progress,
            logs: [
              ...prev.logs,
              { ts: line.ts, level: line.level, node: line.node, label: line.label, msg: line.msg },
            ],
          }));
        },
        onDone: async (payload) => {
          pollCancel?.();
          await finishRun(runId, payload.status, payload.duration);
        },
        onError: () => {
          // SSE dropped — fall back to polling for the report.
          console.warn("SSE stream failed, switching to poll-based fallback for run", runId);
          setRunState((prev) => ({
            ...prev,
            logs: [...prev.logs, {
              ts: new Date().toLocaleTimeString("en", { hour12: false }),
              level: "warn" as const,
              node: "stream",
              label: "Connection",
              msg: "Live stream unavailable — polling for results…",
            }],
          }));
          pollCancel = api.pollReport(
            runId,
            (report) => {
              setQaRunning(false);
              setRunState((prev) => ({ ...prev, status: "passed", progress: 100 }));
              recordRun(report);
            },
            () => {
              console.error("Poll gave up waiting for report", runId);
              setQaRunning(false);
            },
          );
        },
      });
    } catch (e) {
      console.error(e);
      setQaRunning(false);
    }
  }, [activeJourneyId, selectedSegmentId]);

  // Limit the cohort to the user's selected profiles, if any are selected.
  const scopeCohort = useCallback((cohort: Record<string, unknown>[]): Record<string, unknown>[] => {
    if (selectedProfileIds.size === 0) return cohort;
    const scoped = cohort.filter((p) => selectedProfileIds.has(String((p as { id?: unknown }).id)));
    return scoped.length > 0 ? scoped : cohort; // ignore a stale selection
  }, [selectedProfileIds]);

  const handleRunQA = useCallback(async () => {
    const activePlan = testPlans.find((p) => p.id === activePlanId) ?? testPlans[testPlans.length - 1];
    const activeSuites = activePlan?.suites ?? [];
    if (activeSuites.length === 0 || !activePlan) return;
    await startQARunWithSuites(activeSuites, scopeCohort(activePlan.profiles));
  }, [testPlans, activePlanId, startQARunWithSuites, scopeCohort]);

  // Single-click: generate suites (if needed) then immediately run QA.
  const handleGenerateAndRun = useCallback(async () => {
    if (!activeJourneyId || !selectedSegmentId) return;
    const activePlan = testPlans.find((p) => p.id === activePlanId) ?? testPlans[testPlans.length - 1];
    const existingSuites = activePlan?.suites ?? [];

    if (existingSuites.length === 0) {
      // No suites yet — generate first, then run the FULL fresh cohort.
      const newPlan = await handleSynthSuites();
      if (!newPlan || newPlan.suites.length === 0) return;
      await startQARunWithSuites(newPlan.suites, newPlan.profiles);
    } else if (activePlan) {
      // Suites already exist — run the (optionally selection-scoped) cohort.
      await startQARunWithSuites(existingSuites, scopeCohort(activePlan.profiles));
    }
  }, [activeJourneyId, selectedSegmentId, testPlans, activePlanId, handleSynthSuites, startQARunWithSuites, scopeCohort]);

  if (loadError) {
    return (
      <div className="jo jo-bootstrap-error">
        <div>
          <h2>Could not reach the API</h2>
          <p>{loadError}</p>
          <p className="hint">
            Make sure the FastAPI server is running on <code>localhost:8000</code> — see
            <code> README.md</code>.
          </p>
        </div>
      </div>
    );
  }

  if (!journey || !preflight) {
    return (
      <div className="jo jo-bootstrap">
        <div>Loading journey…</div>
      </div>
    );
  }

  return (
    <div className="jo mode-test">
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
      />

      <div className={`jo-workspace${inspectorTab === "qa" ? " jo-workspace--qa" : ""}`}>
        <main className="jo-main">
          <CanvasToolbar journey={journey} preflight={preflight} runState={canvasRunState} qaReport={activeReport} />
          <JourneyCanvas
            journey={journey}
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
            runState={canvasRunState}
            preflight={preflight}
          />
          {inspectorTab === "qa" && simSummary && (
            <div className={`qa-sim-overlay qa-sim-overlay--${simSummary.verdict}`}>
              <button type="button" className="qa-sim-overlay__close"
                onClick={() => { setSimSummary(null); setSimVisited([]); }} aria-label="Dismiss">×</button>
              <div className="qa-sim-overlay__head">
                <span className={`qa-sim-overlay__verdict qa-sim-overlay__verdict--${simSummary.verdict}`}>
                  {simSummary.verdict.toUpperCase()}
                </span>
                <span className="qa-sim-overlay__name">{simSummary.profileName}</span>
              </div>
              <div className="qa-sim-overlay__stats">
                <span className="qa-sim-overlay__stat qa-sim-overlay__stat--pass">{simSummary.pass} pass</span>
                <span className="qa-sim-overlay__stat qa-sim-overlay__stat--fail">{simSummary.fail} fail</span>
                <span className="qa-sim-overlay__stat qa-sim-overlay__stat--skipped">{simSummary.skipped} did not execute</span>
              </div>
              <div className="qa-sim-overlay__foot">
                {simSummary.steps} node{simSummary.steps === 1 ? "" : "s"} visited
                {simSummary.stopped && <span className="qa-sim-overlay__stopped">· stopped early</span>}
              </div>
            </div>
          )}
        </main>

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

      {/* RunPanel hidden — live run trace lives inside the QA Runs tab now. */}
    </div>
  );
}
