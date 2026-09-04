"use client";

import { useEffect } from "react";
import ProfilesTab from "./inspector/ProfilesTab";
import CriteriaTab from "./inspector/CriteriaTab";
import QARunsTab from "./inspector/QARunsTab";
import type { Journey, JourneyNode, LogLine, Profile, TestSuite, TestPlan, QARunResult, SimSummary } from "@/lib/types";

type Tab = "profiles" | "criteria" | "qa";

interface Props {
  journey: Journey;
  selectedNode: JourneyNode | null;
  profiles: Profile[];
  setProfiles: (p: Profile[]) => void;
  selectedProfileIds: Set<string>;
  setSelectedProfileIds: (s: Set<string>) => void;
  qaRuns: QARunResult[];
  activeRunId: string | null;
  onSelectRun: (id: string) => void;
  testPlans: TestPlan[];
  activePlanId: string | null;
  onSelectPlan: (id: string) => void;
  onSynthSuites: () => void;
  onExtendSuites: (instruction: string, count: number) => void;
  extendError: string | null;
  clearExtendError: () => void;
  synthRunning: boolean;
  onRunQA: () => void;
  qaRunning: boolean;
  qaProgress: number;
  qaLogs: LogLine[];
  canSynth: boolean;
  selectedWalkId: number | null;
  onSelectWalk: (idx: number | null) => void;
  onPathChange: (nodeIds: string[]) => void;
  onSimResult: (summary: SimSummary | null) => void;
  activeTab: "profiles" | "criteria" | "qa";
  onTabChange: (tab: "profiles" | "criteria" | "qa") => void;
}

export default function Inspector({
  journey,
  selectedNode: _selectedNode,
  profiles,
  setProfiles,
  selectedProfileIds,
  setSelectedProfileIds,
  qaRuns,
  activeRunId,
  onSelectRun,
  testPlans,
  activePlanId,
  onSelectPlan,
  onSynthSuites,
  onExtendSuites,
  extendError,
  clearExtendError,
  synthRunning,
  onRunQA,
  qaRunning,
  qaProgress,
  qaLogs,
  canSynth,
  selectedWalkId,
  onSelectWalk,
  onPathChange,
  onSimResult,
  activeTab: tab,
  onTabChange: setTab,
}: Props) {
  const activePlan = testPlans.find((p) => p.id === activePlanId) ?? testPlans[testPlans.length - 1];
  const activeRun = qaRuns.find((r) => r.id === activeRunId) ?? qaRuns[qaRuns.length - 1] ?? null;

  // Auto-generate suites when user opens QA Runs tab and none exist yet.
  useEffect(() => {
    if (tab === "qa" && testPlans.length === 0 && canSynth && !synthRunning && !qaRunning) {
      onSynthSuites();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <aside className="jo-inspector">
      <div className="jo-inspector__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={tab === "profiles" ? "is-on" : ""}
          onClick={() => setTab("profiles")}
        >
          Profiles <span className="jo-pill">{profiles.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          className={tab === "criteria" ? "is-on" : ""}
          onClick={() => setTab("criteria")}
        >
          Criteria
        </button>
        <button
          type="button"
          role="tab"
          className={tab === "qa" ? "is-on" : ""}
          onClick={() => setTab("qa")}
        >
          QA Runs
          {qaRuns.length > 0 && (
            <span className={`jo-pill jo-pill--${(activeRun?.report.verdict ?? "warn") === "pass" ? "ok" : "warn"}`}>
              {qaRuns.length}
            </span>
          )}
        </button>
      </div>

      <div className={`jo-inspector__body${tab === "qa" ? " jo-inspector__body--qa" : ""}`}>
        {tab === "profiles" && (
          <ProfilesTab
            profiles={profiles}
            setProfiles={setProfiles}
            selectedIds={selectedProfileIds}
            setSelectedIds={setSelectedProfileIds}
            testSuites={activePlan?.suites ?? []}
            onExtendSuites={onExtendSuites}
            extendError={extendError}
            clearExtendError={clearExtendError}
            synthRunning={synthRunning}
            canSynth={canSynth}
          />
        )}
        {tab === "criteria" && <CriteriaTab journey={journey} />}
        {tab === "qa" && (
          <QARunsTab
            testPlans={testPlans}
            activePlanId={activePlanId}
            onSelectPlan={onSelectPlan}
            synthRunning={synthRunning}
            onExtend={onExtendSuites}
            extendError={extendError}
            clearExtendError={clearExtendError}
            onPathChange={onPathChange}
            onSimResult={onSimResult}
          />
        )}
      </div>
    </aside>
  );
}
