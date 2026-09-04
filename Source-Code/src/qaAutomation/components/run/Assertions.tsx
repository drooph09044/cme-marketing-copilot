import type { RunState } from "../../lib/types";

interface Props {
  runState: RunState;
}

export default function Assertions({ runState }: Props) {
  const rows = [
    { name: "All profiles enter via Segment Entry", passed: runState.visited.has("n1") },
    { name: "Suppression removes non-consenting profiles", passed: runState.visited.has("n2") },
    { name: "Frequency cap policy applied", passed: runState.visited.has("n3") },
    { name: "Holdout split = 10% ±0.4%", passed: runState.visited.has("n4") },
    { name: "Quiet hours respected (9–18 CET)", passed: runState.visited.has("n6") },
    { name: "Goal reached by ≥ 20% of test cohort", passed: runState.visited.has("n9") },
    { name: "No duplicate sends per profile", passed: runState.status === "passed" },
  ];
  return (
    <table className="jo-asserts">
      <thead>
        <tr>
          <th style={{ width: 28 }} aria-label="status" />
          <th>Assertion</th>
          <th style={{ width: 90 }}>Result</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td><i className={"jo-amark " + (r.passed ? "is-pass" : "is-pend")} /></td>
            <td>{r.name}</td>
            <td>
              <span className={"jo-tag jo-tag--" + (r.passed ? "test" : "control")}>
                {r.passed ? "passed" : "pending"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
