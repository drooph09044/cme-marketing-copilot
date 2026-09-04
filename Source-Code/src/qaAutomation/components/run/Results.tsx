import type { RunState, RunStats } from "../../lib/types";

interface Props {
  stats: RunStats;
  runState: RunState;
}

interface CardSpec {
  k: string;
  v: number;
  sub: string;
  tone?: "ok" | "danger" | "accent";
}

export default function Results({ stats, runState }: Props) {
  const cards: CardSpec[] = [
    { k: "Entered", v: stats.total, sub: "profiles fed in" },
    { k: "Suppressed", v: stats.suppressed, sub: "consent · bounce · cap", tone: "danger" },
    { k: "Eligible", v: stats.eligible, sub: "reached split", tone: "ok" },
    { k: "Holdout (control)", v: stats.holdout, sub: "10% deterministic", tone: "accent" },
    { k: "Test cohort", v: stats.test, sub: "sent through channels" },
    { k: "Predicted convert", v: Math.round(stats.test * 0.27), sub: "27% goal rate", tone: "ok" },
  ];
  return (
    <div className="jo-results">
      <div className="jo-results__cards">
        {cards.map((c) => (
          <div key={c.k} className={"jo-kpi" + (c.tone ? ` jo-kpi--${c.tone}` : "")}>
            <div className="jo-kpi__k">{c.k}</div>
            <div className="jo-kpi__v">{c.v.toLocaleString()}</div>
            <div className="jo-kpi__sub">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="jo-results__summary">
        <div>
          <div className="jo-eyebrow">Status</div>
          <div className={`jo-results__summary-h jo-results__summary-h--${runState.status}`}>
            {runState.status === "passed"
              ? "All assertions passed"
              : runState.status === "running"
                ? "In progress"
                : runState.status === "failed"
                  ? "Assertions failed"
                  : "Not yet run"}
          </div>
          <div className="jo-results__summary-sub">
            {runState.duration ? `Finished in ${(runState.duration / 1000).toFixed(1)}s` : "—"}
          </div>
        </div>
        <div>
          <div className="jo-eyebrow">Coverage</div>
          <div className="jo-results__summary-h">{runState.visited.size}/10 nodes visited</div>
          <div className="jo-results__summary-sub">Test mode walks one profile end-to-end.</div>
        </div>
      </div>
    </div>
  );
}
