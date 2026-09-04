import { useMemo } from "react";
import type { Journey, Preflight, QAReport, RunState } from "../lib/types";

interface Props {
  journey: Journey;
  preflight: Preflight;
  runState: RunState;
  qaReport: QAReport | null;
}

export default function CanvasToolbar({ journey, preflight, runState, qaReport }: Props) {
  const reachable = Object.values(preflight.nodeReach).reduce((a, b) => Math.max(a, b), 0);
  const nodeIds = useMemo(() => new Set(journey.nodes.map((n) => n.id)), [journey]);
  const totalNodes = journey.nodes.length;
  const totalEdges = journey.edges.length;

  // Coverage = unique journey-graph nodes visited across QA walks (or the
  // currently-selected walk replay if runState carries journey node ids).
  const coverage = useMemo(() => {
    const visited = new Set<string>();
    // Live or replayed runState.visited entries that match real journey node ids.
    for (const id of runState.visited) {
      if (nodeIds.has(id)) visited.add(id);
    }
    // Union of all walks' step nodes from the QA report.
    if (qaReport) {
      for (const w of qaReport.walks) {
        for (const s of w.steps) {
          if (nodeIds.has(s.nodeId)) visited.add(s.nodeId);
        }
      }
    }
    return visited.size;
  }, [runState.visited, qaReport, nodeIds]);

  return (
    <div className="jo-cvtools">
      <div className="jo-cvtools__hint">
        <span className="jo-mode-dot jo-mode-dot--test" />
        Test mode — Generate test suites and start a run from the QA Runs tab.
      </div>
      <div className="jo-cvtools__right">
        <div className="jo-cvtools__stat">
          <span>Reachable</span>
          <b>{reachable.toLocaleString()}</b>
        </div>
        <div className="jo-cvtools__stat">
          <span>Nodes</span>
          <b>{totalNodes}</b>
        </div>
        <div className="jo-cvtools__stat">
          <span>Edges</span>
          <b>{totalEdges}</b>
        </div>
        <div className="jo-cvtools__stat">
          <span>Coverage</span>
          <b>
            {coverage}/{totalNodes}
            {totalNodes > 0 && (
              <span style={{ color: "var(--ink-3)", fontWeight: 400, marginLeft: 4, fontSize: 11 }}>
                ({Math.round((coverage / totalNodes) * 100)}%)
              </span>
            )}
          </b>
        </div>
      </div>
    </div>
  );
}
