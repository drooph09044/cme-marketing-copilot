/* global React */
const { useState: useStateR, useEffect: useEffectR, useRef: useRefR } = React;

// Bottom run panel — Test mode only.
// NOTE: Dry Run and Suite Run modes were removed, along with the suite picker.
function RunPanel({ journey, profiles, runState, setRunState, collapsed, setCollapsed }) {
  const [tab, setTab] = useStateR("event");
  const logRef = useRefR(null);

  // Aggregate stats
  const stats = (() => {
    const total = profiles.length;
    const eligible = profiles.filter((p) => p.consent && p.fcap < 3).length;
    const suppressed = total - eligible;
    const holdout = Math.round(eligible * 0.10);
    const test = eligible - holdout;
    return { total, eligible, suppressed, holdout, test };
  })();

  // Simulate a run
  function start() {
    const path = ["n1","n2","n3","n4","n5","n6","n7","n8","n9","n10"];
    const logs = [];
    setRunState({ status: "running", visited: new Set(), active: null, logs: [], stats, progress: 0, started: Date.now() });

    let i = 0;
    const t0 = Date.now();
    const tick = () => {
      if (i >= path.length) {
        setRunState((s) => ({ ...s, status: "passed", active: null, progress: 100, ended: Date.now(), duration: Date.now() - t0 }));
        return;
      }
      const id = path[i];
      const node = journey.nodes.find((n) => n.id === id);
      const line = {
        ts: new Date().toLocaleTimeString(),
        level: id === "n2" ? "warn" : id === "n4" ? "info" : "info",
        node: node.id,
        label: node.title,
        msg: messageFor(node, stats),
      };
      logs.push(line);
      setRunState((s) => {
        const v = new Set(s.visited);
        v.add(id);
        return { ...s, active: id, visited: v, logs: [...logs], progress: Math.round(((i+1)/path.length)*100) };
      });
      i++;
      setTimeout(tick, 380);
    };
    setTimeout(tick, 180);
  }

  function messageFor(node, st) {
    switch (node.id) {
      case "n1": return `${st.total} profiles entered the journey.`;
      case "n2": return `Removed ${st.suppressed} profiles via suppression rules.`;
      case "n3": return `Frequency cap applied — 0 violations.`;
      case "n4": return `Holdout split — ${st.holdout} control / ${st.test} test (deterministic).`;
      case "n5": return `Email — Offer A queued for ${Math.round(st.test*0.6)} profiles.`;
      case "n6": return `Wait 48h scheduled.`;
      case "n7": return `Push — Reminder queued for ${Math.round(st.test*0.4)} profiles.`;
      case "n8": return `Condition evaluated — 71% positive.`;
      case "n9": return `Converted: ${Math.round(st.test*0.27)} profiles reached goal.`;
      case "n10": return `Exited without action: ${Math.round(st.test*0.73)} profiles.`;
      default: return "";
    }
  }

  function reset() {
    setRunState({ status: "idle", visited: new Set(), active: null, logs: [], stats, progress: 0 });
  }

  useEffectR(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [runState.logs]);

  const statusLabel = ({
    idle: "Idle", running: "Running…", passed: "Passed", failed: "Failed"
  })[runState.status] || "Idle";

  return (
    <section className={"jo-run" + (collapsed ? " is-collapsed" : "")}>
      <header className="jo-run__head">
        <div className="jo-run__title">
          <button className="jo-run__toggle" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle run panel">
            {collapsed ? "▲" : "▼"}
          </button>
          <span className="jo-eyebrow">Test run</span>
          <strong>{journey.name}</strong>
          <span className={"jo-status jo-status--" + runState.status}>
            <i /> {statusLabel}
          </span>
          {runState.status === "running" || runState.status === "passed" ? (
            <span className="jo-run__prog">
              <i style={{ width: runState.progress + "%" }} />
            </span>
          ) : null}
        </div>
        <div className="jo-run__actions">
          <button className="jo-btn jo-btn--ghost" onClick={reset} disabled={runState.status === "running"}>Reset</button>
        </div>
      </header>

      {!collapsed && (
        <>
          <div className="jo-run__tabs">
            <button className={tab==="event"?"is-on":""} onClick={()=>setTab("event")}>Trigger event</button>
            <button className={tab==="results"?"is-on":""} onClick={()=>setTab("results")}>Results</button>
            <button className={tab==="logs"?"is-on":""} onClick={()=>setTab("logs")}>Step log <span className="jo-pill">{runState.logs.length}</span></button>
            <button className={tab==="metrics"?"is-on":""} onClick={()=>setTab("metrics")}>Metrics</button>
            <button className={tab==="assertions"?"is-on":""} onClick={()=>setTab("assertions")}>Assertions</button>
          </div>

          <div className="jo-run__body">
            {tab === "event" && <EventComposer journey={journey} onTrigger={start} />}
            {tab === "results" && <Results stats={stats} runState={runState} />}
            {tab === "logs" && (
              <div className="jo-logs" ref={logRef}>
                {runState.logs.length === 0
                  ? <div className="jo-logs__empty">No events yet. Click <b>Run test</b> to start.</div>
                  : runState.logs.map((l, i) => (
                      <div key={i} className={"jo-logs__row jo-logs__row--" + l.level}>
                        <span className="jo-logs__ts">{l.ts}</span>
                        <span className="jo-logs__node">{l.node}</span>
                        <span className="jo-logs__label">{l.label}</span>
                        <span className="jo-logs__msg">{l.msg}</span>
                      </div>
                  ))}
              </div>
            )}
            {tab === "metrics" && <Metrics stats={stats} />}
            {tab === "assertions" && <Assertions runState={runState} stats={stats} />}
          </div>
        </>
      )}
    </section>
  );
}

function Results({ stats, runState }) {
  const cards = [
    { k: "Entered",          v: stats.total,      sub: "profiles fed in" },
    { k: "Suppressed",       v: stats.suppressed, sub: "consent · bounce · cap", tone: "danger" },
    { k: "Eligible",         v: stats.eligible,   sub: "reached split", tone: "ok" },
    { k: "Holdout (control)", v: stats.holdout,   sub: "10% deterministic", tone: "accent" },
    { k: "Test cohort",      v: stats.test,       sub: "sent through channels" },
    { k: "Predicted convert", v: Math.round(stats.test * 0.27), sub: "27% goal rate", tone: "ok" },
  ];
  return (
    <div className="jo-results">
      <div className="jo-results__cards">
        {cards.map((c) => (
          <div key={c.k} className={"jo-kpi" + (c.tone ? " jo-kpi--" + c.tone : "")}>
            <div className="jo-kpi__k">{c.k}</div>
            <div className="jo-kpi__v">{c.v.toLocaleString()}</div>
            <div className="jo-kpi__sub">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="jo-results__summary">
        <div>
          <div className="jo-eyebrow">Status</div>
          <div className={"jo-results__summary-h jo-results__summary-h--" + runState.status}>
            {runState.status === "passed" ? "All assertions passed" :
             runState.status === "running" ? "In progress" :
             runState.status === "failed" ? "Assertions failed" : "Not yet run"}
          </div>
          <div className="jo-results__summary-sub">
            {runState.duration ? `Finished in ${(runState.duration/1000).toFixed(1)}s` : "—"}
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

function Metrics({ stats }) {
  const channelMix = [
    { k: "Email — Offer A", v: 60, n: Math.round(stats.test * 0.6) },
    { k: "Push — Reminder", v: 40, n: Math.round(stats.test * 0.4) },
  ];
  const regions = [
    { k: "DE", v: 32 }, { k: "FR", v: 24 }, { k: "NL", v: 16 }, { k: "ES", v: 18 }, { k: "IT", v: 10 },
  ];
  return (
    <div className="jo-metrics">
      <div className="jo-metric-block">
        <h5>Channel allocation</h5>
        {channelMix.map((c) => (
          <div key={c.k} className="jo-bar">
            <span className="jo-bar__label">{c.k}</span>
            <span className="jo-bar__track"><i style={{ width: c.v + "%" }} /></span>
            <span className="jo-bar__num">{c.n.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="jo-metric-block">
        <h5>Region distribution</h5>
        {regions.map((c) => (
          <div key={c.k} className="jo-bar">
            <span className="jo-bar__label">{c.k}</span>
            <span className="jo-bar__track"><i style={{ width: c.v + "%" }} /></span>
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

function Assertions({ runState, stats }) {
  const rows = [
    { name: "All profiles enter via Segment Entry",        passed: runState.visited.has("n1") },
    { name: "Suppression removes non-consenting profiles", passed: runState.visited.has("n2") },
    { name: "Frequency cap policy applied",                passed: runState.visited.has("n3") },
    { name: "Holdout split = 10% ±0.4%",                   passed: runState.visited.has("n4") },
    { name: "Quiet hours respected (9–18 CET)",            passed: runState.visited.has("n6") },
    { name: "Goal reached by ≥ 20% of test cohort",        passed: runState.visited.has("n9") },
    { name: "No duplicate sends per profile",              passed: runState.status === "passed" },
  ];
  return (
    <table className="jo-asserts">
      <thead>
        <tr><th style={{ width: 28 }}></th><th>Assertion</th><th style={{ width: 90 }}>Result</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td><i className={"jo-amark " + (r.passed ? "is-pass" : "is-pend")} /></td>
            <td>{r.name}</td>
            <td><span className={"jo-tag jo-tag--" + (r.passed ? "test" : "control")}>{r.passed ? "passed" : "pending"}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventComposer({ journey, onTrigger }) {
  const [evt, setEvt] = useStateR("cart_abandoned");
  const [ns, setNs] = useStateR("Email");
  const [identifier, setIdentifier] = useStateR("lina.brandt@northwind.io");
  const [waitOverride, setWaitOverride] = useStateR(10);
  const [payload, setPayload] = useStateR(JSON.stringify({
    eventType: "cart_abandoned",
    profile: {
      email: "lina.brandt@northwind.io",
      region: "DE",
      consent: { marketing_email: "granted" }
    },
    cart: {
      total: 89.40,
      currency: "EUR",
      items: [
        { sku: "NW-714", qty: 1, price: 49.90 },
        { sku: "NW-208", qty: 2, price: 19.75 }
      ]
    },
    timestamp: "2026-05-11T09:22:14Z"
  }, null, 2));

  return (
    <div className="jo-event">
      <div className="jo-event__form">
        <h5>Event configuration</h5>
        <div className="jo-field">
          <label>Event</label>
          <select value={evt} onChange={(e) => setEvt(e.target.value)}>
            <option value="cart_abandoned">cart_abandoned</option>
            <option value="segment_qualified">segment_qualified</option>
            <option value="purchase_completed">purchase_completed</option>
            <option value="consent_revoked">consent_revoked</option>
          </select>
        </div>
        <div className="jo-field">
          <label>Identity namespace</label>
          <select value={ns} onChange={(e) => setNs(e.target.value)}>
            <option>Email</option>
            <option>Phone</option>
            <option>ECID</option>
            <option>CRMID</option>
            <option>AAID</option>
          </select>
        </div>
        <div className="jo-field">
          <label>Profile identifier</label>
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <div className="jo-field">
          <label>Wait override (s)</label>
          <input type="number" min="1" max="600" value={waitOverride} onChange={(e) => setWaitOverride(+e.target.value || 10)} />
        </div>
        <div className="jo-field">
          <label>&nbsp;</label>
          <div className="jo-row" style={{ gap: 8 }}>
            <button className="jo-btn jo-btn--primary" onClick={onTrigger}>Trigger event</button>
            <button className="jo-btn jo-btn--ghost">Save profile</button>
          </div>
        </div>
        <div className="jo-gen__hint" style={{ marginTop: 6 }}>
          Test mode bypasses Segment Qualification by injecting the event directly for this single profile.
          Channel actions are simulated; waits use the override above.
        </div>
      </div>
      <div className="jo-event__payload">
        <h5>Payload <span className="jo-pill" style={{ marginLeft: 6 }}>JSON</span></h5>
        <textarea
          className="jo-codeview" spellCheck="false"
          value={payload} onChange={(e) => setPayload(e.target.value)}
        />
      </div>
    </div>
  );
}

window.RunPanel = RunPanel;
