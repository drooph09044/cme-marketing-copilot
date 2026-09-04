/* global React, ReactDOM, JourneyCanvas, Inspector, RunPanel, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakToggle, TweakSlider */
const { useState, useEffect, useMemo } = React;

const DATA = window.__JOURNEY_DATA;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2c5cdf",
  "density": "comfortable",
  "dark": false,
  "showReach": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [profiles, setProfiles] = useState(DATA.profiles);
  const [selectedProfileIds, setSelectedProfileIds] = useState(new Set());
  const [activeJourneyId, setActiveJourneyId] = useState(DATA.journey.id);
  const [runState, setRunState] = useState({ status: "idle", visited: new Set(), active: null, logs: [], progress: 0 });
  const [runCollapsed, setRunCollapsed] = useState(false);

  // The journey graph is shared across all entries in the dropdown for this demo.
  // The dropdown swaps the displayed name + meta from `DATA.journeys`.
  const activeJourneyMeta = useMemo(
    () => DATA.journeys.find((j) => j.id === activeJourneyId) || DATA.journeys[0],
    [activeJourneyId]
  );
  const activeJourney = useMemo(
    () => ({ ...DATA.journey, ...activeJourneyMeta }),
    [activeJourneyMeta]
  );

  const selectedNode = useMemo(
    () => DATA.journey.nodes.find((n) => n.id === selectedNodeId) || null,
    [selectedNodeId]
  );

  // Pre-flight: static analysis of journey
  const preflight = useMemo(() => computePreflight(DATA.journey, profiles), [profiles]);

  return (
    <div
      className={"jo mode-test" + (t.density === "compact" ? " is-dense" : "") + (t.dark ? " is-dark" : "")}
      style={{ "--accent": t.accent }}
    >
      <SubHeader
        journey={activeJourney}
        journeys={DATA.journeys}
        onSelectJourney={setActiveJourneyId}
      />

      <div className="jo-workspace">
        <main className="jo-main">
          <CanvasToolbar preflight={preflight} runState={runState} />
          <JourneyCanvas
            journey={DATA.journey}
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
            runState={runState}
            mode="test"
            preflight={preflight}
          />
        </main>

        <Inspector
          data={DATA}
          selectedNode={selectedNode}
          profiles={profiles}
          setProfiles={setProfiles}
          selectedProfileIds={selectedProfileIds}
          setSelectedProfileIds={setSelectedProfileIds}
          preflight={preflight}
        />
      </div>

      <RunPanel
        journey={activeJourney}
        profiles={profiles}
        runState={runState}
        setRunState={setRunState}
        collapsed={runCollapsed}
        setCollapsed={setRunCollapsed}
      />

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakColor label="Accent" value={t.accent}
          options={["#2c5cdf", "#0f7f53", "#7a4ec4", "#c0461f"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakRadio label="Density" value={t.density}
          options={["compact", "comfortable"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Canvas" />
        <TweakToggle label="Show reach badges" value={t.showReach}
          onChange={(v) => setTweak("showReach", v)} />
      </TweaksPanel>
    </div>
  );
}

function computePreflight(journey, profiles) {
  return {
    holdouts: journey.holdouts,
    suppression: journey.suppression,
    criteria: journey.criteria,
    nodeReach: {
      n1: profiles.length,
      n2: profiles.length,
      n3: profiles.filter((p) => p.consent).length,
      n4: profiles.filter((p) => p.consent && p.fcap < 3).length,
      n5: Math.round(profiles.filter((p) => p.consent && p.fcap < 3).length * 0.9 * 0.6),
      n6: Math.round(profiles.filter((p) => p.consent && p.fcap < 3).length * 0.9),
      n7: Math.round(profiles.filter((p) => p.consent && p.fcap < 3).length * 0.9 * 0.4),
      n8: Math.round(profiles.filter((p) => p.consent && p.fcap < 3).length * 0.9),
      n9: Math.round(profiles.filter((p) => p.consent && p.fcap < 3).length * 0.9 * 0.27),
      n10: Math.round(profiles.filter((p) => p.consent && p.fcap < 3).length * 0.9 * 0.73),
    },
    warnings: [
      profiles.filter((p) => p.fcap >= 3).length > 0 && {
        id: "w1", level: "warn",
        msg: `${profiles.filter((p) => p.fcap >= 3).length} profiles near frequency cap will be filtered.`,
      },
      profiles.filter((p) => !p.consent).length > 0 && {
        id: "w2", level: "info",
        msg: `${profiles.filter((p) => !p.consent).length} profiles lack consent and will be suppressed at step S.`,
      },
      {
        id: "w3", level: "info",
        msg: "Identity namespace 'Email' detected on entry event.",
      },
    ].filter(Boolean),
  };
}

// ---------- Sub-header (journey dropdown + Save draft) ----------
// NOTE: The global top bar was removed entirely. Mode switcher, Validate, and Publish
// are also gone. A single dropdown lists all journeys and switches the active one.
function SubHeader({ journey, journeys, onSelectJourney }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (!e.target.closest(".jo-jpicker")) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="jo-subhead">
      <div className="jo-subhead__title">
        <div className="jo-jpicker">
          <button
            className={"jo-jpicker__btn" + (open ? " is-open" : "")}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="jo-jpicker__col">
              <span className="jo-eyebrow">Journey</span>
              <span className="jo-jpicker__name">{journey.name}</span>
            </span>
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className="jo-jpicker__chev">
              <path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>

          {open && (
            <div className="jo-jpicker__menu" role="listbox">
              <div className="jo-jpicker__search">
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M11 11 L15 15" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <input placeholder="Filter journeys…" autoFocus />
              </div>
              <ul>
                {journeys.map((j) => {
                  const isActive = j.id === journey.id;
                  return (
                    <li
                      key={j.id}
                      role="option"
                      aria-selected={isActive}
                      className={"jo-jpicker__item" + (isActive ? " is-active" : "")}
                      onClick={() => { onSelectJourney(j.id); setOpen(false); }}
                    >
                      <div className="jo-jpicker__item-main">
                        <div className="jo-jpicker__item-name">{j.name}</div>
                        <div className="jo-jpicker__item-meta">
                          <span>v{j.version}</span>
                          <span>·</span>
                          <span>{j.updated}</span>
                          <span>·</span>
                          <span>{j.owner}</span>
                        </div>
                      </div>
                      <span className={"jo-badge jo-badge--" + j.status.toLowerCase()}>{j.status}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="jo-subhead__meta">
          <span className={"jo-badge jo-badge--" + journey.status.toLowerCase()}>{journey.status}</span>
          <span>v{journey.version}</span>
          <span>·</span>
          <span>Updated {journey.updated}</span>
          <span>·</span>
          <span>{journey.owner}</span>
        </div>
      </div>

      <div className="jo-subhead__right">
        <div className="jo-subhead__actions">
          <button className="jo-btn jo-btn--ghost">Save draft</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Left rail ----------
function LeftRail({ preflight, mode }) {
  return (
    <aside className="jo-leftrail">
      <nav className="jo-leftnav">
        {[
          ["Properties","P"],
          ["Canvas","C"],
          ["Events","E"],
          ["Audiences","A"],
          ["Reports","R"],
          ["History","H"],
        ].map(([label, k]) => (
          <button key={label} className={"jo-leftnav__btn" + (label === "Canvas" ? " is-on" : "")} title={label}>
            <span className="jo-leftnav__glyph">{k}</span>
            <span className="jo-leftnav__label">{label}</span>
          </button>
        ))}
      </nav>

      <div className="jo-preflight">
        <header>
          <div className="jo-eyebrow">Pre-flight</div>
          <h4>Analytics detected</h4>
        </header>
        <ul className="jo-preflight__list">
          <li>
            <span className="jo-pf__count">{preflight.holdouts.length}</span>
            <div>
              <b>Holdouts</b>
              <p>{preflight.holdouts.map(h=>`${h.pct}%`).join(" · ")} of audience</p>
            </div>
          </li>
          <li>
            <span className="jo-pf__count">{preflight.suppression.length}</span>
            <div>
              <b>Suppression</b>
              <p>{preflight.suppression.reduce((a,b)=>a+b.count,0).toLocaleString()} suppressed</p>
            </div>
          </li>
          <li>
            <span className="jo-pf__count">{preflight.criteria.length}</span>
            <div>
              <b>Entry criteria</b>
              <p>{preflight.criteria.filter(c=>c.status==="warn").length} with warnings</p>
            </div>
          </li>
        </ul>

        <div className="jo-preflight__warnings">
          {preflight.warnings.map((w) => (
            <div key={w.id} className={"jo-warn jo-warn--" + w.level}>
              <span className="jo-warn__dot" />
              <span>{w.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ---------- Canvas toolbar (above canvas) ----------
function CanvasToolbar({ preflight, runState }) {
  return (
    <div className="jo-cvtools">
      <div className="jo-cvtools__hint">
        <span className="jo-mode-dot jo-mode-dot--test" />
        Test mode — Trigger an event to walk one profile through the journey.
      </div>
      <div className="jo-cvtools__right">
        <div className="jo-cvtools__stat">
          <span>Reachable</span>
          <b>{Object.values(preflight.nodeReach).reduce((a,b)=>Math.max(a,b),0).toLocaleString()}</b>
        </div>
        <div className="jo-cvtools__stat">
          <span>Nodes</span>
          <b>10</b>
        </div>
        <div className="jo-cvtools__stat">
          <span>Edges</span>
          <b>11</b>
        </div>
        <div className="jo-cvtools__stat">
          <span>Coverage</span>
          <b>{runState.visited.size}/10</b>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
