/* global React */
// Journey canvas — nodes + edges, pan/zoom, selection
const { useState, useRef, useEffect, useMemo } = React;

const NODE_W = 196;
const NODE_H = 80;

// All AJO node types organised by palette category.
// Tone drives the colored glyph badge; category groups them in the side palette.
const NODE_KIND = {
  // ── Sources / Events ─────────────────────────────────────────────
  entry:           { label: "Segment Qualification", glyph: "SQ", tone: "source",  category: "Sources" },
  read_audience:   { label: "Read Audience",         glyph: "RA", tone: "source",  category: "Sources" },
  unitary_event:   { label: "Unitary Event",         glyph: "UE", tone: "source",  category: "Sources" },
  business_event:  { label: "Business Event",        glyph: "BE", tone: "source",  category: "Sources" },
  reaction_event:  { label: "Reaction",              glyph: "RX", tone: "source",  category: "Sources" },

  // ── Orchestration ────────────────────────────────────────────────
  condition:       { label: "Condition",             glyph: "IF", tone: "logic",   category: "Orchestration" },
  wait:            { label: "Wait",                  glyph: "WT", tone: "logic",   category: "Orchestration" },
  wait_until:      { label: "Wait Until",            glyph: "WU", tone: "logic",   category: "Orchestration" },
  jump:            { label: "Jump",                  glyph: "JP", tone: "logic",   category: "Orchestration" },
  split:           { label: "Holdout / A-B Split",   glyph: "AB", tone: "accent",  category: "Orchestration" },
  increment:       { label: "Increment Metric",      glyph: "++", tone: "logic",   category: "Orchestration" },

  // ── Actions / Channels ───────────────────────────────────────────
  channel:         { label: "Email",                 glyph: "EM", tone: "action",  category: "Actions" },
  channel_email:   { label: "Email",                 glyph: "EM", tone: "action",  category: "Actions" },
  channel_push:    { label: "Push Notification",     glyph: "PN", tone: "action",  category: "Actions" },
  channel_sms:     { label: "SMS",                   glyph: "SM", tone: "action",  category: "Actions" },
  channel_inapp:   { label: "In-App Message",        glyph: "IA", tone: "action",  category: "Actions" },
  channel_web:     { label: "Web Personalization",   glyph: "WB", tone: "action",  category: "Actions" },
  channel_card:    { label: "Content Card",          glyph: "CC", tone: "action",  category: "Actions" },
  channel_dm:      { label: "Direct Mail",           glyph: "DM", tone: "action",  category: "Actions" },
  code:            { label: "Code",                  glyph: "{}", tone: "action",  category: "Actions" },
  custom_action:   { label: "Custom Action",         glyph: "CA", tone: "action",  category: "Actions" },
  ac_delivery:     { label: "Campaign Delivery",     glyph: "AC", tone: "action",  category: "Actions" },

  // ── Audience / Data ──────────────────────────────────────────────
  update_audience: { label: "Update Audience",       glyph: "UA", tone: "data",    category: "Audience" },
  update_profile:  { label: "Update Profile",        glyph: "UP", tone: "data",    category: "Audience" },
  data_source:     { label: "Data Source",           glyph: "DS", tone: "data",    category: "Data sources" },
  aep_query:       { label: "AEP Query",             glyph: "QY", tone: "data",    category: "Data sources" },
  external_ds:     { label: "External Source",       glyph: "EX", tone: "data",    category: "Data sources" },

  // ── Pre-flight / Analytics constructs ────────────────────────────
  suppression:     { label: "Global Suppression",    glyph: "SU", tone: "danger",  category: "Analytics" },
  criteria:        { label: "Frequency Cap",         glyph: "FC", tone: "warn",    category: "Analytics" },
  consent:         { label: "Consent Gate",          glyph: "CG", tone: "warn",    category: "Analytics" },
  quiet_hours:     { label: "Quiet Hours",           glyph: "QH", tone: "warn",    category: "Analytics" },

  // ── Exits ────────────────────────────────────────────────────────
  exit:            { label: "End",                   glyph: "ED", tone: "exit",    category: "Exits" },
  end_success:     { label: "End — Success",         glyph: "OK", tone: "exit",    category: "Exits" },
  end_error:       { label: "End — Error",           glyph: "ER", tone: "exit",    category: "Exits" },
  end_timeout:     { label: "End — Timeout",         glyph: "TO", tone: "exit",    category: "Exits" },
};

// Palette grouping (for the canvas tool-rail / node picker)
const NODE_CATEGORIES = ["Sources", "Orchestration", "Actions", "Audience", "Data sources", "Analytics", "Exits"];

function NodeGlyph({ kind }) {
  const k = NODE_KIND[kind] || NODE_KIND.entry;
  return (
    <div className={"jo-node__glyph jo-node__glyph--" + k.tone}>
      <span>{k.glyph}</span>
    </div>
  );
}

function Edge({ from, to, label, highlight }) {
  // smooth horizontal bezier between right-edge of `from` and left-edge of `to`
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const dx = Math.max(40, (x2 - x1) * 0.45);
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - 6;
  return (
    <g className={"jo-edge" + (highlight ? " is-on" : "")}>
      <path d={d} fill="none" />
      {label ? (
        <g transform={`translate(${midX}, ${midY})`}>
          <rect x="-22" y="-10" width="44" height="18" rx="9" />
          <text textAnchor="middle" y="3">{label}</text>
        </g>
      ) : null}
    </g>
  );
}

function JourneyCanvas({ journey, selectedId, onSelect, runState, mode, preflight }) {
  const wrapRef = useRef(null);
  const [zoom, setZoom] = useState(0.6);
  const [pan, setPan] = useState({ x: 12, y: 10 });
  const [drag, setDrag] = useState(null);

  // Auto-fit on mount: pick a zoom that lets the whole journey fit horizontally
  useEffect(() => {
    if (!wrapRef.current) return;
    const w = wrapRef.current.clientWidth;
    const contentW = 1750;
    const z = Math.max(0.45, Math.min(0.95, (w - 32) / contentW));
    setZoom(z);
  }, []);

  const byId = useMemo(() => Object.fromEntries(journey.nodes.map((n) => [n.id, n])), [journey.nodes]);

  // Run-state highlight: which nodes have been "visited"
  const visited = runState?.visited || new Set();
  const active = runState?.active;

  function onWheel(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(1.4, Math.max(0.5, z - e.deltaY * 0.0015)));
  }
  function onMouseDown(e) {
    if (e.target.closest(".jo-node")) return;
    setDrag({ sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y });
  }
  function onMouseMove(e) {
    if (!drag) return;
    setPan({ x: drag.px + (e.clientX - drag.sx), y: drag.py + (e.clientY - drag.sy) });
  }
  function onMouseUp() { setDrag(null); }

  useEffect(() => {
    if (!drag) return;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  });

  const reach = preflight?.nodeReach || {};

  return (
    <div className={"jo-canvas mode-" + (mode || "test")} ref={wrapRef} onWheel={onWheel} onMouseDown={onMouseDown}>
      <div className="jo-canvas__grid" />
      <div className="jo-canvas__inner" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <svg className="jo-canvas__edges" width="1700" height="520">
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" />
            </marker>
          </defs>
          {journey.edges.map(([a, b, lbl], i) => (
            <Edge
              key={i}
              from={byId[a]}
              to={byId[b]}
              label={lbl}
              highlight={visited.has(a) && visited.has(b)}
            />
          ))}
        </svg>
        {journey.nodes.map((n) => {
          const k = NODE_KIND[n.type];
          const isSel = n.id === selectedId;
          const isActive = n.id === active;
          const isVisited = visited.has(n.id);
          return (
            <div
              key={n.id}
              className={
                "jo-node" +
                (isSel ? " is-selected" : "") +
                (isActive ? " is-active" : "") +
                (isVisited ? " is-visited" : "") +
                " jo-node--" + n.type
              }
              style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
              onClick={(e) => { e.stopPropagation(); onSelect(n.id); }}
            >
              <NodeGlyph kind={n.type} />
              <div className="jo-node__body">
                <div className="jo-node__kind">{k.label}</div>
                <div className="jo-node__title">{n.title}</div>
                <div className="jo-node__sub">{n.sub}</div>
              </div>
              {reach[n.id] != null ? (
                <div className="jo-node__reach">{reach[n.id].toLocaleString()}</div>
              ) : null}
              {n.meta ? <div className="jo-node__meta">{n.meta}</div> : null}
            </div>
          );
        })}
      </div>

      <div className="jo-canvas__controls">
        <button onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))} title="Zoom in">+</button>
        <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} title="Zoom out">−</button>
        <button onClick={() => {
          if (!wrapRef.current) return;
          const w = wrapRef.current.clientWidth;
          const z = Math.max(0.45, Math.min(0.95, (w - 32) / 1750));
          setZoom(z); setPan({ x: 12, y: 10 });
        }} title="Reset">⤺</button>
        <div className="jo-canvas__zoom">{Math.round(zoom * 100)}%</div>
      </div>

      <div className="jo-canvas__legend">
        <span><i className="lg lg--danger" /> Suppression</span>
        <span><i className="lg lg--warn" /> Criteria</span>
        <span><i className="lg lg--accent" /> Holdout split</span>
        <span><i className="lg lg--neutral" /> Step</span>
      </div>
    </div>
  );
}

window.JourneyCanvas = JourneyCanvas;
window.NODE_KIND = NODE_KIND;
window.NODE_CATEGORIES = NODE_CATEGORIES;
