import type { RunStats } from "../../lib/types";

interface Props {
  stats: RunStats;
}

export default function Metrics({ stats }: Props) {
  const channelMix = [
    { k: "Email — Offer A", v: 60, n: Math.round(stats.test * 0.6) },
    { k: "Push — Reminder", v: 40, n: Math.round(stats.test * 0.4) },
  ];
  const regions = [
    { k: "DE", v: 32 },
    { k: "FR", v: 24 },
    { k: "NL", v: 16 },
    { k: "ES", v: 18 },
    { k: "IT", v: 10 },
  ];
  return (
    <div className="jo-metrics">
      <div className="jo-metric-block">
        <h5>Channel allocation</h5>
        {channelMix.map((c) => (
          <div key={c.k} className="jo-bar">
            <span className="jo-bar__label">{c.k}</span>
            <span className="jo-bar__track"><i style={{ width: `${c.v}%` }} /></span>
            <span className="jo-bar__num">{c.n.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="jo-metric-block">
        <h5>Region distribution</h5>
        {regions.map((c) => (
          <div key={c.k} className="jo-bar">
            <span className="jo-bar__label">{c.k}</span>
            <span className="jo-bar__track"><i style={{ width: `${c.v}%` }} /></span>
            <span className="jo-bar__num">{c.v}%</span>
          </div>
        ))}
      </div>
      <div className="jo-metric-block">
        <h5>Holdout integrity</h5>
        <div className="jo-bigstat">
          <div><b>10.02%</b><span>actual control</span></div>
          <div><b>±0.21</b><span>std. dev (5 runs)</span></div>
          <div><b>0</b><span>profile leakage</span></div>
        </div>
      </div>
    </div>
  );
}
