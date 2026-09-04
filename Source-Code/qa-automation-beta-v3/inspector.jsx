/* global React */
const { useState: useStateI, useMemo: useMemoI } = React;

// ---------- Right inspector ----------
// NOTE: "Test suites" tab removed along with Suite Run mode.
function Inspector({
  data, selectedNode, profiles, setProfiles,
  selectedProfileIds, setSelectedProfileIds
}) {
  const [tab, setTab] = useStateI("profiles");

  return (
    <aside className="jo-inspector">
      <div className="jo-inspector__tabs" role="tablist">
        <button role="tab" className={tab==="profiles"?"is-on":""} onClick={()=>setTab("profiles")}>
          Profiles <span className="jo-pill">{profiles.length}</span>
        </button>
        <button role="tab" className={tab==="criteria"?"is-on":""} onClick={()=>setTab("criteria")}>Criteria</button>
        <button role="tab" className={tab==="inspect"?"is-on":""} onClick={()=>setTab("inspect")}>Inspector</button>
      </div>

      <div className="jo-inspector__body">
        {tab === "profiles" && (
          <ProfilesTab
            profiles={profiles}
            setProfiles={setProfiles}
            selectedIds={selectedProfileIds}
            setSelectedIds={setSelectedProfileIds}
          />
        )}
        {tab === "criteria" && (
          <CriteriaTab journey={data.journey} />
        )}
        {tab === "inspect" && (
          <InspectTab node={selectedNode} />
        )}
      </div>
    </aside>
  );
}

// ---------- Profiles ----------
const REGIONS = ["DE", "FR", "NL", "ES", "IT"];
const FIRST = ["Lina","Marc","Sofia","Jens","Paula","Tomáš","Anouk","Pierre","Greta","Henrik","Mira","Bence","Aiko","Noor","Elif","Kai"];
const LAST  = ["Brandt","Dupont","Romano","Vermeer","Iglesias","Novák","De Vries","Müller","Costa","Lindgren","Petrova","Bauer"];

function makeProfile(i) {
  const n = `${FIRST[(Math.random()*FIRST.length)|0]} ${LAST[(Math.random()*LAST.length)|0]}`;
  const r = REGIONS[(Math.random()*REGIONS.length)|0];
  const id = "p_" + String(50000 + i + ((Math.random()*9000)|0)).slice(0, 5);
  const fcap = (Math.random() * 4) | 0;
  const consent = Math.random() > 0.12;
  const tag = !consent ? "suppressed" : fcap >= 3 ? "fcap-risk" : Math.random() < 0.1 ? "control" : "test";
  return {
    id, name: n, region: r, age: 18 + ((Math.random()*48)|0),
    consent, fcap, lastSend: ((Math.random()*40)|0)+"d", segment: "dormant_30d", tag
  };
}

function ProfilesTab({ profiles, setProfiles, selectedIds, setSelectedIds }) {
  const [genCount, setGenCount] = useStateI(50);
  const [bias, setBias] = useStateI("balanced");
  const [filter, setFilter] = useStateI("all");

  function generate() {
    const next = [];
    const seed = profiles.length;
    for (let i = 0; i < genCount; i++) {
      const p = makeProfile(seed + i);
      if (bias === "edge") {
        if (Math.random() < 0.4) p.fcap = 3;
        if (Math.random() < 0.2) p.consent = false;
      } else if (bias === "compliant") {
        p.consent = true; p.fcap = Math.min(p.fcap, 2);
      }
      next.push(p);
    }
    setProfiles([...profiles, ...next]);
  }

  function addManual() {
    setProfiles([...profiles, makeProfile(profiles.length)]);
  }

  function toggleSel(id) {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  }
  function toggleAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((p) => p.id)));
  }

  const filtered = useMemoI(() => {
    if (filter === "all") return profiles;
    return profiles.filter((p) => p.tag === filter);
  }, [profiles, filter]);

  const counts = useMemoI(() => {
    const c = { all: profiles.length, test: 0, control: 0, suppressed: 0, "fcap-risk": 0 };
    profiles.forEach((p) => { c[p.tag] = (c[p.tag] || 0) + 1; });
    return c;
  }, [profiles]);

  return (
    <div className="jo-pane">
      <div className="jo-pane__head">
        <div>
          <h3>Test profiles</h3>
          <p>Profiles fed into the journey for this run.</p>
        </div>
        <div className="jo-row">
          <button className="jo-btn jo-btn--ghost" onClick={addManual}>Add</button>
        </div>
      </div>

      <div className="jo-gen">
        <div className="jo-gen__row">
          <label>Generate</label>
          <input
            type="number" min="1" max="500" value={genCount}
            onChange={(e) => setGenCount(Math.max(1, Math.min(500, +e.target.value || 0)))}
          />
          <label>profiles biased</label>
          <select value={bias} onChange={(e) => setBias(e.target.value)}>
            <option value="balanced">balanced</option>
            <option value="edge">toward edge cases</option>
            <option value="compliant">strictly compliant</option>
          </select>
          <button className="jo-btn jo-btn--primary" onClick={generate}>Generate</button>
        </div>
        <div className="jo-gen__hint">
          Deterministic seeds — re-running produces the same allocation across holdouts.
        </div>
      </div>

      <div className="jo-chips">
        {[
          ["all","All",counts.all],
          ["test","Test",counts.test||0],
          ["control","Control",counts.control||0],
          ["fcap-risk","Cap risk",counts["fcap-risk"]||0],
          ["suppressed","Suppressed",counts.suppressed||0],
        ].map(([k, label, n]) => (
          <button key={k} className={"jo-chip" + (filter === k ? " is-on" : "")} onClick={() => setFilter(k)}>
            {label} <i>{n}</i>
          </button>
        ))}
      </div>

      <div className="jo-table-wrap">
        <table className="jo-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input type="checkbox"
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleAll}
                />
              </th>
              <th>Profile</th>
              <th>Region</th>
              <th>Age</th>
              <th>Consent</th>
              <th>F-cap</th>
              <th>Last send</th>
              <th>Tag</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={selectedIds.has(p.id) ? "is-sel" : ""}>
                <td><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSel(p.id)} /></td>
                <td>
                  <div className="jo-prof">
                    <div className="jo-prof__avatar">{p.name.split(" ").map(s=>s[0]).join("").slice(0,2)}</div>
                    <div>
                      <div className="jo-prof__name">{p.name}</div>
                      <div className="jo-prof__id">{p.id}</div>
                    </div>
                  </div>
                </td>
                <td>{p.region}</td>
                <td>{p.age}</td>
                <td>{p.consent ? <span className="jo-dot jo-dot--ok" /> : <span className="jo-dot jo-dot--bad" />}</td>
                <td>{p.fcap}</td>
                <td className="num">{p.lastSend}</td>
                <td><span className={"jo-tag jo-tag--" + p.tag}>{p.tag}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Criteria ----------
function CriteriaTab({ journey }) {
  return (
    <div className="jo-pane">
      <div className="jo-pane__head">
        <div>
          <h3>Market analytics criteria</h3>
          <p>Discovered from this journey's configuration.</p>
        </div>
      </div>

      <section className="jo-section">
        <header><h4>Holdouts</h4><span>{journey.holdouts.length} active</span></header>
        {journey.holdouts.map((h) => (
          <div key={h.id} className="jo-card">
            <div className="jo-card__top">
              <div className="jo-card__title">{h.name}</div>
              <div className="jo-card__pct">{h.pct}%</div>
            </div>
            <div className="jo-card__row"><span>Basis</span><b>{h.basis}</b></div>
            <div className="jo-card__row"><span>Scope</span><b>{h.scope}</b></div>
          </div>
        ))}
      </section>

      <section className="jo-section">
        <header><h4>Suppression sources</h4><span>{journey.suppression.reduce((a,b)=>a+b.count,0).toLocaleString()} profiles</span></header>
        <ul className="jo-list">
          {journey.suppression.map((s) => (
            <li key={s.id}>
              <div>
                <div className="jo-list__label">{s.label}</div>
                <div className="jo-list__sub">{s.source}</div>
              </div>
              <div className="jo-list__num">{s.count.toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="jo-section">
        <header><h4>Entry criteria</h4><span>{journey.criteria.length} rules</span></header>
        <ul className="jo-rules">
          {journey.criteria.map((c) => (
            <li key={c.id} className={"jo-rule jo-rule--" + c.status}>
              <span className="jo-rule__mark" />
              <span className="jo-rule__label">{c.label}</span>
              {c.note ? <span className="jo-rule__note">{c.note}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------- Inspector (selected node) ----------
function InspectTab({ node }) {
  if (!node) {
    return (
      <div className="jo-pane jo-empty">
        <div className="jo-empty__inner">
          <div className="jo-empty__title">Nothing selected</div>
          <p>Click any step on the canvas to inspect its configuration.</p>
        </div>
      </div>
    );
  }
  const k = window.NODE_KIND[node.type];
  return (
    <div className="jo-pane">
      <div className="jo-pane__head">
        <div>
          <div className="jo-eyebrow">{k.label}</div>
          <h3 style={{ marginTop: 2 }}>{node.title}</h3>
          <p>{node.sub}</p>
        </div>
      </div>
      <dl className="jo-dl">
        <div><dt>Node ID</dt><dd className="mono">{node.id}</dd></div>
        <div><dt>Type</dt><dd>{node.type}</dd></div>
        <div><dt>Position</dt><dd className="mono">{node.x}, {node.y}</dd></div>
        {node.meta ? <div><dt>Detail</dt><dd>{node.meta}</dd></div> : null}
      </dl>
    </div>
  );
}

window.Inspector = Inspector;
