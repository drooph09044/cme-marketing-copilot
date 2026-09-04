"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EventComposer from "./run/EventComposer";
import Results from "./run/Results";
import Metrics from "./run/Metrics";
import Assertions from "./run/Assertions";
import { api } from "@/lib/api";
import type { Journey, LogLine, Profile, RunState, RunStats, TestEvent } from "@/lib/types";

const QA_NODE_LABELS: Record<string, string> = {
  load_inputs: "Load inputs",
  fit_check: "Segment fit",
  structure_check: "Journey structure",
  profile_synth: "Synthesize profiles",
  walk_profile: "Profile walk",
  aggregate_walks: "Aggregate",
  verdict_summary: "Verdict",
};

type Tab = "event" | "results" | "logs" | "metrics" | "assertions";

interface Props {
  journey: Journey;
  profiles: Profile[];
  runState: RunState;
  setRunState: (updater: RunState | ((s: RunState) => RunState)) => void;
  collapsed: boolean;
  setCollapsed: (b: boolean) => void;
}

const DEFAULT_PAYLOAD = {
  eventType: "cart_abandoned",
  profile: {
    email: "lina.brandt@northwind.io",
    region: "DE",
    consent: { marketing_email: "granted" },
  },
  cart: {
    total: 89.4,
    currency: "EUR",
    items: [
      { sku: "NW-714", qty: 1, price: 49.9 },
      { sku: "NW-208", qty: 2, price: 19.75 },
    ],
  },
  timestamp: "2026-05-11T09:22:14Z",
};

// Bottom run panel — Test mode only. Dry Run and Suite Run modes are removed.
export default function RunPanel({ journey, profiles, runState, setRunState, collapsed, setCollapsed }: Props) {
  const [tab, setTab] = useState<Tab>("event");
  const logRef = useRef<HTMLDivElement | null>(null);
  const closeStream = useRef<(() => void) | null>(null);

  const stats: RunStats = useMemo(() => {
    const total = profiles.length;
    const eligible = profiles.filter((p) => p.consent && p.fcap < 3).length;
    const suppressed = total - eligible;
    const holdout = Math.round(eligible * 0.1);
    const test = eligible - holdout;
    return { total, eligible, suppressed, holdout, test };
  }, [profiles]);

  // Tear down any open SSE stream on unmount.
  useEffect(() => () => closeStream.current?.(), []);

  // Auto-scroll the terminal log to the bottom on new lines.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [runState.logs]);

  async function start(event: TestEvent) {
    closeStream.current?.();
    const t0 = Date.now();
    setRunState({
      status: "running",
      visited: new Set<string>(),
      active: null,
      logs: [],
      progress: 0,
      stats,
      started: t0,
    });

    try {
      const { runId } = await api.startRun(event);
      closeStream.current = api.subscribeRun(runId, {
        onStep: (step) => {
          const line: LogLine = {
            ts: step.ts,
            level: step.level,
            node: step.node,
            label: step.label,
            msg: step.msg,
          };
          setRunState((s) => {
            const visited = new Set(s.visited);
            visited.add(step.nodeId);
            return {
              ...s,
              active: step.nodeId,
              visited,
              logs: [...s.logs, line],
              progress: step.progress,
            };
          });
        },
        onDone: ({ status, duration }) => {
          setRunState((s) => ({ ...s, status, active: null, progress: 100, ended: Date.now(), duration }));
        },
        onError: () => {
          setRunState((s) => ({ ...s, status: "failed", active: null }));
        },
      });
    } catch {
      // Offline fallback: simulate the run client-side using the journey fixture.
      simulateLocally(journey, t0);
    }
  }

  function simulateLocally(j: Journey, t0: number) {
    const path = ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8", "n9", "n10"];
    let i = 0;
    const tick = () => {
      if (i >= path.length) {
        setRunState((s) => ({
          ...s,
          status: "passed",
          active: null,
          progress: 100,
          ended: Date.now(),
          duration: Date.now() - t0,
        }));
        return;
      }
      const id = path[i];
      const node = j.nodes.find((n) => n.id === id);
      if (!node) {
        i++;
        return tick();
      }
      const line: LogLine = {
        ts: new Date().toLocaleTimeString(),
        level: id === "n2" ? "warn" : "info",
        node: node.id,
        label: node.title,
        msg: messageFor(id, stats),
      };
      setRunState((s) => {
        const visited = new Set(s.visited);
        visited.add(id);
        return {
          ...s,
          active: id,
          visited,
          logs: [...s.logs, line],
          progress: Math.round(((i + 1) / path.length) * 100),
        };
      });
      i++;
      setTimeout(tick, 380);
    };
    setTimeout(tick, 180);
  }

  function reset() {
    closeStream.current?.();
    setRunState({ status: "idle", visited: new Set<string>(), active: null, logs: [], progress: 0, stats });
  }

  const statusLabel = ({
    idle: "Idle",
    running: "Running…",
    passed: "Passed",
    failed: "Failed",
  })[runState.status];

  return (
    <section className={"jo-run" + (collapsed ? " is-collapsed" : "")}>
      <header className="jo-run__head">
        <div className="jo-run__title">
          <button
            type="button"
            className="jo-run__toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle run panel"
          >
            {collapsed ? "▲" : "▼"}
          </button>
          <span className="jo-eyebrow">Test run</span>
          <strong>{journey.name}</strong>
          <span className={`jo-status jo-status--${runState.status}`}>
            <i /> {statusLabel}
          </span>
          {runState.status === "running" || runState.status === "passed" ? (
            <span className="jo-run__prog">
              <i style={{ width: `${runState.progress}%` }} />
            </span>
          ) : null}
        </div>
        <div className="jo-run__actions">
          <button
            type="button"
            className="jo-btn jo-btn--ghost"
            onClick={reset}
            disabled={runState.status === "running"}
          >
            Reset
          </button>
        </div>
      </header>

      {!collapsed && (
        <>
          <div className="jo-run__tabs">
            <button type="button" className={tab === "event" ? "is-on" : ""} onClick={() => setTab("event")}>
              Trigger event
            </button>
            <button type="button" className={tab === "results" ? "is-on" : ""} onClick={() => setTab("results")}>
              Results
            </button>
            <button type="button" className={tab === "logs" ? "is-on" : ""} onClick={() => setTab("logs")}>
              Step log <span className="jo-pill">{runState.logs.length}</span>
            </button>
            <button type="button" className={tab === "metrics" ? "is-on" : ""} onClick={() => setTab("metrics")}>
              Metrics
            </button>
            <button type="button" className={tab === "assertions" ? "is-on" : ""} onClick={() => setTab("assertions")}>
              Assertions
            </button>
          </div>

          <div className="jo-run__body">
            {tab === "event" && (
              <EventComposer
                defaultPayload={DEFAULT_PAYLOAD}
                disabled={runState.status === "running"}
                onTrigger={start}
              />
            )}
            {tab === "results" && <Results stats={stats} runState={runState} />}
            {tab === "logs" && (
              <div className="jo-logs" ref={logRef}>
                {runState.logs.length === 0 ? (
                  <div className="jo-logs__empty">
                    No events yet. Configure and click <b>Trigger event</b> to start.
                  </div>
                ) : (
                  runState.logs.map((l, i) => (
                    <div key={i} className={`jo-logs__row jo-logs__row--${l.level}`}>
                      <span className="jo-logs__ts">{l.ts}</span>
                      <span className="jo-logs__node">{l.node}</span>
                      <span className="jo-logs__label">{QA_NODE_LABELS[l.node] ?? l.label}</span>
                      <span className="jo-logs__msg">{l.msg}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            {tab === "metrics" && <Metrics stats={stats} />}
            {tab === "assertions" && <Assertions runState={runState} />}
          </div>
        </>
      )}
    </section>
  );
}

function messageFor(id: string, st: RunStats): string {
  switch (id) {
    case "n1": return `${st.total} profiles entered the journey.`;
    case "n2": return `Removed ${st.suppressed} profiles via suppression rules.`;
    case "n3": return `Frequency cap applied — 0 violations.`;
    case "n4": return `Holdout split — ${st.holdout} control / ${st.test} test (deterministic).`;
    case "n5": return `Email — Offer A queued for ${Math.round(st.test * 0.6)} profiles.`;
    case "n6": return `Wait 48h scheduled.`;
    case "n7": return `Push — Reminder queued for ${Math.round(st.test * 0.4)} profiles.`;
    case "n8": return `Condition evaluated — 71% positive.`;
    case "n9": return `Converted: ${Math.round(st.test * 0.27)} profiles reached goal.`;
    case "n10": return `Exited without action: ${Math.round(st.test * 0.73)} profiles.`;
    default: return "";
  }
}
