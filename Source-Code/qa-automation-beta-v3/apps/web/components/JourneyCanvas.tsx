"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NODE_KIND } from "@/lib/nodeKinds";
import type { Journey, JourneyNode, Preflight, RunState, NodeType } from "@/lib/types";

const NODE_W = 196;
const NODE_H = 80;

interface Props {
  journey: Journey;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  runState: RunState;
  preflight: Preflight;
}

interface NodeGlyphProps {
  kind: NodeType;
}

function NodeGlyph({ kind }: NodeGlyphProps) {
  const k = NODE_KIND[kind] ?? NODE_KIND.entry;
  return (
    <div className={`jo-node__glyph jo-node__glyph--${k.tone}`}>
      <span>{k.glyph}</span>
    </div>
  );
}

interface EdgeProps {
  from: JourneyNode;
  to: JourneyNode;
  label?: string;
  highlight: boolean;
}

function Edge({ from, to, label, highlight }: EdgeProps) {
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
          <text textAnchor="middle" y={3}>{label}</text>
        </g>
      ) : null}
    </g>
  );
}

interface DragState {
  sx: number;
  sy: number;
  px: number;
  py: number;
}

export default function JourneyCanvas({ journey, selectedId, onSelect, runState, preflight }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(0.6);
  const [pan, setPan] = useState({ x: 12, y: 10 });
  const [drag, setDrag] = useState<DragState | null>(null);

  // Auto-fit on mount.
  // Auto-fit whenever the journey changes — clamp between 0.7 and 0.9 so the
  // journey always starts at a readable 70-90% scale. If the content is wider
  // than the container the user can drag-pan to see the rest.
  useEffect(() => {
    if (!wrapRef.current || journey.nodes.length === 0) return;
    const cw = wrapRef.current.clientWidth;
    const ch = wrapRef.current.clientHeight;
    const maxX = Math.max(...journey.nodes.map((n) => n.x + NODE_W)) + 60;
    const maxY = Math.max(...journey.nodes.map((n) => n.y + NODE_H)) + 60;
    const zx = (cw - 32) / maxX;
    const zy = (ch - 32) / maxY;
    setZoom(Math.max(0.7, Math.min(0.9, Math.min(zx, zy))));
    setPan({ x: 16, y: 16 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.id]);

  const byId = useMemo(
    () => Object.fromEntries(journey.nodes.map((n) => [n.id, n])) as Record<string, JourneyNode>,
    [journey.nodes],
  );

  const visited = runState.visited;
  const active = runState.active;

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(1.4, Math.max(0.5, z - e.deltaY * 0.0015)));
  }
  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest(".jo-node")) return;
    setDrag({ sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y });
  }

  useEffect(() => {
    if (!drag) return;
    function onMove(e: MouseEvent) {
      setPan({ x: drag!.px + (e.clientX - drag!.sx), y: drag!.py + (e.clientY - drag!.sy) });
    }
    function onUp() {
      setDrag(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag]);

  const reach = preflight.nodeReach;

  const svgW = journey.nodes.length > 0
    ? Math.max(...journey.nodes.map((n) => n.x + NODE_W)) + 120
    : 1800;
  const svgH = journey.nodes.length > 0
    ? Math.max(...journey.nodes.map((n) => n.y + NODE_H)) + 120
    : 400;

  return (
    <div className="jo-canvas mode-test" ref={wrapRef} onWheel={onWheel} onMouseDown={onMouseDown}>
      <div className="jo-canvas__grid" />
      <div
        className="jo-canvas__inner"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <svg className="jo-canvas__edges" width={svgW} height={svgH}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" />
            </marker>
          </defs>
          {journey.edges.map((edge, i) => {
            const [a, b, lbl] = edge;
            const from = byId[a];
            const to = byId[b];
            if (!from || !to) return null;
            return (
              <Edge key={i} from={from} to={to} label={lbl} highlight={visited.has(a) && visited.has(b)} />
            );
          })}
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
                ` jo-node--${n.type}`
              }
              style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(n.id);
              }}
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
        <button type="button" onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))} title="Zoom in">+</button>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} title="Zoom out">−</button>
        <button
          type="button"
          onClick={() => {
            if (!wrapRef.current || journey.nodes.length === 0) return;
            const cw = wrapRef.current.clientWidth;
            const ch = wrapRef.current.clientHeight;
            const maxX = Math.max(...journey.nodes.map((n) => n.x + NODE_W)) + 60;
            const maxY = Math.max(...journey.nodes.map((n) => n.y + NODE_H)) + 60;
            setZoom(Math.max(0.7, Math.min(0.9, Math.min((cw - 32) / maxX, (ch - 32) / maxY))));
            setPan({ x: 16, y: 16 });
          }}
          title="Reset"
        >
          ⤺
        </button>
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
