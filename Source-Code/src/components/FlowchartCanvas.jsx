import { useEffect, useMemo, useRef, useState } from "react";
import { EDGE_COLORS } from "../../shared/suiteData";

const COLUMN_WIDTH = 152;
const LANE_HEIGHT = 112;
const NODE_WIDTH = 128;
const NODE_HEIGHT = 68;
const PAD_X = 58;
const PAD_Y = 28;
const HEADER_HEIGHT = 34;
const BASE_SVG_HEIGHT = PAD_Y + HEADER_HEIGHT + 5 * LANE_HEIGHT + 70;
const DEFAULT_ZOOM = 3;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.2;
const ZOOM_STEP = 0.12;
const ZOOM_PRESETS = [
  { label: "75%", scale: 0.88 },
  { label: "100%", scale: 1.08 },
  { label: "125%", scale: 1.48 },
  { label: "150%", scale: DEFAULT_ZOOM },
  { label: "175%", scale: 2.08 },
  { label: "200%", scale: 2.5 },
  { label: "300%", scale: 3.5 },
];

function withAlpha(hex, alpha) {
  if (typeof hex !== "string") {
    return hex;
  }
  const value = hex.trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return `${value}${alpha}`;
  }
  return value;
}

function warmAccentStroke(accent) {
  if (accent === "#C89B3C") {
    return "#8A6200";
  }
  if (accent === "#F59E0B") {
    return "#A55300";
  }
  return accent;
}

function getLaneTop(lanes, laneId) {
  return PAD_Y + HEADER_HEIGHT + lanes.findIndex((lane) => lane.id === laneId) * LANE_HEIGHT;
}

function getDefaultNodePosition(node, lanes) {
  return {
    x: PAD_X + node.column * COLUMN_WIDTH,
    y: getLaneTop(lanes, node.lane) + (LANE_HEIGHT - NODE_HEIGHT) / 2 + (node.offsetY ?? 0),
  };
}

function getNodePosition(node, lanes) {
  const base = typeof node.x === "number" && typeof node.y === "number" ? { x: node.x, y: node.y } : getDefaultNodePosition(node, lanes);
  return {
    ...base,
    cx: base.x + NODE_WIDTH / 2,
    cy: base.y + NODE_HEIGHT / 2,
  };
}

function getEdgePath(edge, nodesById, lanes) {
  const from = nodesById[edge.from];
  const to = nodesById[edge.to];
  if (!from || !to) {
    return "";
  }

  const source = getNodePosition(from, lanes);
  const target = getNodePosition(to, lanes);
  const horizontal = Math.abs(target.cx - source.cx) >= Math.abs(target.cy - source.cy);

  if (horizontal) {
    const startX = target.cx >= source.cx ? source.x + NODE_WIDTH : source.x;
    const endX = target.cx >= source.cx ? target.x : target.x + NODE_WIDTH;
    const startY = source.cy;
    const endY = target.cy;
    const midX = (startX + endX) / 2;
    return `M ${startX} ${startY} C ${midX} ${startY} ${midX} ${endY} ${endX} ${endY}`;
  }

  const startX = source.cx;
  const endX = target.cx;
  const startY = target.cy >= source.cy ? source.y + NODE_HEIGHT : source.y;
  const endY = target.cy >= source.cy ? target.y : target.y + NODE_HEIGHT;
  const midY = (startY + endY) / 2;
  return `M ${startX} ${startY} C ${startX} ${midY} ${endX} ${midY} ${endX} ${endY}`;
}

function getEdgeFocusPoint(edge, nodesById, lanes) {
  const from = nodesById[edge.from];
  const to = nodesById[edge.to];
  if (!from || !to) {
    return null;
  }
  const source = getNodePosition(from, lanes);
  const target = getNodePosition(to, lanes);
  return {
    x: (source.cx + target.cx) / 2,
    y: (source.cy + target.cy) / 2,
  };
}

function Edge({ edge, nodesById, lanes, selected, onSelectEdge }) {
  const path = getEdgePath(edge, nodesById, lanes);
  const color = EDGE_COLORS[edge.type] ?? EDGE_COLORS.flow;
  const dashed = edge.type === "holdout" || edge.type === "varB";
  const from = nodesById[edge.from];
  const to = nodesById[edge.to];
  if (!path || !from || !to) {
    return null;
  }

  const source = getNodePosition(from, lanes);
  const target = getNodePosition(to, lanes);
  const labelX = (source.cx + target.cx) / 2 + 4;
  const labelY = (source.cy + target.cy) / 2 - 6;

  return (
    <g className={`flow-edge ${selected ? "is-selected" : ""}`}>
      {selected ? (
        <path
          d={path}
          fill="none"
          stroke={typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "rgba(15,23,42,0.18)" : "rgba(255,255,255,0.16)"}
          strokeWidth="5"
          strokeLinecap="round"
        />
      ) : null}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeDasharray={dashed ? "6 4" : undefined}
        markerEnd={`url(#arrow-${edge.type})`}
        opacity="0.92"
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="12"
        className="flow-edge-hit"
        onMouseDown={(event) => {
          event.stopPropagation();
          onSelectEdge(edge.id);
        }}
      />
      {edge.label ? (
        <text x={labelX} y={labelY} textAnchor="middle" className="flow-edge-label" fill={color}>
          {edge.label}
        </text>
      ) : null}
    </g>
  );
}

function Node({ node, lanes, selectedNodeId, onSelectNode, onDragStart }) {
  const isLightTheme = typeof document !== "undefined" && document.documentElement.dataset.theme === "light";
  const warmAccent = node.accent === "#C89B3C" || node.accent === "#F59E0B";
  const strokeColor = isLightTheme && warmAccent ? warmAccentStroke(node.accent) : node.accent;
  const defaultFillAlpha = isLightTheme ? (warmAccent ? "46" : "2F") : "1A";
  const endFillAlpha = isLightTheme ? (warmAccent ? "3F" : "25") : "16";
  const nodeFill = withAlpha(node.kind === "end" || node.kind === "endDashed" ? node.accent : node.accent, node.kind === "end" || node.kind === "endDashed" ? endFillAlpha : defaultFillAlpha);
  const titleFill = isLightTheme && warmAccent ? strokeColor : node.accent;
  const subtitleFill = isLightTheme && warmAccent ? "#4B2D00" : withAlpha(node.accent, "AA");
  const position = getNodePosition(node, lanes);
  const selected = node.id === selectedNodeId;
  const titleLines = (node.title ?? []).filter(Boolean).slice(0, 2);
  const subtitleLines = (node.subtitle ?? []).filter(Boolean).slice(0, 2);
  const textY = position.cy - (titleLines.length > 1 ? 10 : 4) - (subtitleLines.length ? 6 : 0);

  return (
    <g
      data-node={node.id}
      className={`flow-node ${selected ? "is-selected" : ""}`}
      onMouseDown={(event) => onDragStart(event, node)}
      onClick={(event) => {
        event.stopPropagation();
        onSelectNode(node.id);
      }}
    >
      {node.kind === "decision" ? (
        <polygon
          points={`${position.cx},${position.y} ${position.x + NODE_WIDTH},${position.cy} ${position.cx},${position.y + NODE_HEIGHT} ${position.x},${position.cy}`}
          fill={nodeFill}
          stroke={strokeColor}
          strokeWidth="1.5"
        />
      ) : (
        <rect
          x={position.x}
          y={position.y}
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          rx={node.kind === "start" || node.kind.startsWith("end") ? NODE_HEIGHT / 2 : 8}
          fill={nodeFill}
          stroke={strokeColor}
          strokeWidth={node.kind === "split" ? 2.2 : 1.6}
          strokeDasharray={node.kind === "holdout" || node.kind === "wait" || node.kind === "endDashed" ? "6 4" : undefined}
        />
      )}

      {node.variantBadge ? (
        <>
          <rect
            x={position.x + NODE_WIDTH - 27}
            y={position.y - 2}
            width={27}
            height={12}
            rx={5}
            fill="rgba(139,92,246,0.3)"
            stroke="rgba(196,181,253,0.75)"
            strokeWidth="0.8"
          />
          <text x={position.x + NODE_WIDTH - 13.5} y={position.y + 6.8} textAnchor="middle" className="flow-badge">
            {node.variantBadge}
          </text>
        </>
      ) : null}

      {titleLines.map((line, index) => (
        <text
          key={`${node.id}-title-${index}`}
          x={position.cx}
          y={textY + index * 13}
          textAnchor="middle"
          className={`flow-node-title ${node.kind === "decision" ? "decision" : ""}`}
          fill={titleFill}
        >
          {line}
        </text>
      ))}

      {subtitleLines.map((line, index) => (
        <text
          key={`${node.id}-subtitle-${index}`}
          x={position.cx}
          y={position.cy + (titleLines.length > 1 ? 13 : 9) + index * 10}
          textAnchor="middle"
          className="flow-node-subtitle"
          fill={subtitleFill}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

export function FlowchartCanvas({
  generated,
  busy,
  progress,
  nodes,
  edges,
  lanes,
  phaseHeaders,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
  onNodeMove,
}) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const interactionRef = useRef(null);
  const viewportRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const nodesById = useMemo(
    () =>
      nodes.reduce((acc, node) => {
        acc[node.id] = node;
        return acc;
      }, {}),
    [nodes],
  );

  const { SVG_WIDTH, SVG_HEIGHT, columnCount } = useMemo(() => {
    const maxCol = nodes.reduce((m, n) => Math.max(m, n.column ?? 0), 12);
    const cols = Math.max(maxCol + 1, 13);
    return {
      SVG_WIDTH: PAD_X * 2 + cols * COLUMN_WIDTH + NODE_WIDTH,
      SVG_HEIGHT: BASE_SVG_HEIGHT,
      columnCount: cols,
    };
  }, [nodes]);

  const contentWidth = Math.max(SVG_WIDTH * zoom, viewportWidth);
  const zoomPercent = Math.round((zoom / 1.08) * 100);
  const hasSelection = Boolean(selectedNodeId || selectedEdgeId);
  const isLightTheme = typeof document !== "undefined" && document.documentElement.dataset.theme === "light";
  const canvasFill = isLightTheme ? "#f7fbff" : "#080B10";
  const laneStripeA = isLightTheme ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.015)";
  const laneStripeB = isLightTheme ? "rgba(15,23,42,0.015)" : "rgba(255,255,255,0.008)";
  const laneDivider = isLightTheme ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.05)";
  const headerFill = isLightTheme ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.025)";
  const gridStroke = isLightTheme ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.025)";
  const legendLabelFill = isLightTheme ? "#101828" : "#8ea2bf";

  function getHorizontalRange(nextZoom = zoom, nextViewportWidth = viewportWidth) {
    return Math.max(0, SVG_WIDTH * nextZoom - nextViewportWidth);
  }

  function clampPanX(value, nextZoom = zoom, nextViewportWidth = viewportWidth) {
    const horizontalRange = getHorizontalRange(nextZoom, nextViewportWidth);
    return Math.min(0, Math.max(-horizontalRange, value));
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return undefined;
    }

    const updateViewportWidth = () => {
      setViewportWidth(viewport.clientWidth);
    };

    updateViewportWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        updateViewportWidth();
      });
      observer.observe(viewport);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateViewportWidth);
    return () => window.removeEventListener("resize", updateViewportWidth);
  }, []);

  useEffect(() => {
    setPan((currentPan) => {
      const nextX = clampPanX(currentPan.x);
      return nextX === currentPan.x ? currentPan : { ...currentPan, x: nextX };
    });
  }, [viewportWidth, zoom]);

  useEffect(() => {
    function handleMove(event) {
      const interaction = interactionRef.current;
      if (!interaction) {
        return;
      }

      if (interaction.mode === "pan") {
        const deltaX = event.clientX - interaction.startClientX;
        const deltaY = event.clientY - interaction.startClientY;
        setPan({
          x: clampPanX(interaction.originPan.x + deltaX),
          y: interaction.originPan.y + deltaY,
        });
        return;
      }

      if (interaction.mode === "node") {
        const nextX = interaction.originNode.x + (event.clientX - interaction.startClientX) / zoom;
        const nextY = interaction.originNode.y + (event.clientY - interaction.startClientY) / zoom;
        onNodeMove(interaction.nodeId, {
          x: Math.max(44, nextX),
          y: Math.max(PAD_Y + HEADER_HEIGHT + 8, nextY),
        });
      }
    }

    function handleUp() {
      interactionRef.current = null;
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [onNodeMove, zoom]);

  function focusPoint(point, nextZoom = 1.1) {
    const viewport = viewportRef.current;
    if (!viewport || !point) {
      return;
    }
    const focusX = point.cx ?? point.x;
    const focusY = point.cy ?? point.y;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    setZoom(nextZoom);
    setPan({
      x: clampPanX(width / 2 - focusX * nextZoom, nextZoom, width),
      y: height / 2 - focusY * nextZoom,
    });
  }

  function handleBackgroundMouseDown(event) {
    if (event.button !== 0) {
      return;
    }
    onClearSelection();
    interactionRef.current = {
      mode: "pan",
      startClientX: event.clientX,
      startClientY: event.clientY,
      originPan: pan,
    };
  }

  function handleNodeDragStart(event, node) {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    const position = getNodePosition(node, lanes);
    onSelectNode(node.id);
    interactionRef.current = {
      mode: "node",
      nodeId: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originNode: { x: position.x, y: position.y },
    };
  }

  function resetView() {
    setPan({ x: 0, y: 0 });
    setZoom(DEFAULT_ZOOM);
  }

  function changeZoom(delta) {
    const viewport = viewportRef.current;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((zoom + delta).toFixed(2))));
    if (!viewport || nextZoom === zoom) {
      return;
    }
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    setZoom(nextZoom);
    setPan({
      x: clampPanX(width / 2 - ((width / 2 - pan.x) / zoom) * nextZoom, nextZoom, width),
      y: height / 2 - ((height / 2 - pan.y) / zoom) * nextZoom,
    });
  }

  function handleWheel(event) {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const worldX = (pointerX - pan.x) / zoom;
    const worldY = (pointerY - pan.y) / zoom;
    const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((zoom + delta).toFixed(2))));
    setZoom(nextZoom);
    setPan({
      x: clampPanX(pointerX - worldX * nextZoom, nextZoom, viewport.clientWidth),
      y: pointerY - worldY * nextZoom,
    });
  }

  function handleFocusSelection() {
    if (selectedNodeId && nodesById[selectedNodeId]) {
      focusPoint(getNodePosition(nodesById[selectedNodeId], lanes), 1.35);
      return;
    }
    if (selectedEdgeId) {
      const edge = edges.find((entry) => entry.id === selectedEdgeId);
      if (edge) {
        focusPoint(getEdgeFocusPoint(edge, nodesById, lanes), 1.18);
      }
    }
  }

  return (
    <div className="flow-shell">
      <div className="flow-toolbar">
        <div className="flow-toolbar-group">
          <span className="flow-toolbar-label">Zoom</span>
          <button type="button" className="zoom-button zoom-button-icon" onClick={() => changeZoom(-ZOOM_STEP)} aria-label="Zoom out">
            -
          </button>
          <div className="zoom-readout">{zoomPercent}%</div>
          <button type="button" className="zoom-button zoom-button-icon" onClick={() => changeZoom(ZOOM_STEP)} aria-label="Zoom in">
            +
          </button>
          {ZOOM_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`zoom-button ${zoom === preset.scale ? "is-active" : ""}`}
              onClick={() => setZoom(preset.scale)}
            >
              {preset.label}
            </button>
          ))}
          <button type="button" className="zoom-button" onClick={resetView}>
            Reset
          </button>
          <button type="button" className="zoom-button zoom-button-focus" onClick={handleFocusSelection} disabled={!hasSelection}>
            Focus Selection
          </button>
        </div>

        <div className="flow-toolbar-group flow-toolbar-help">
          <span className="flow-hint">Drag nodes to reposition. Click arrows to reroute in the inspector.</span>
          {generated ? (
            <div className="flow-tags">
              <span className="flow-tag">{nodes.length} nodes</span>
              <span className="flow-tag">{edges.length} arrows</span>
              <span className="flow-tag">A/B + holdout</span>
            </div>
          ) : null}
        </div>
      </div>

      <div ref={viewportRef} className="flow-viewport" onMouseDown={handleBackgroundMouseDown} onWheel={handleWheel}>
        {!generated && !busy ? (
          <div className="empty-state">
            <div className="empty-state-mark">FLOW</div>
            <p>Generate the blueprint to reveal the swimlane canvas, then drag nodes and edit arrows from the inspector.</p>
          </div>
        ) : null}

        {generated ? (
          <svg className="flow-svg" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} preserveAspectRatio="xMinYMin meet">
            <defs>
              {Object.entries(EDGE_COLORS).map(([type, color]) => (
                <marker key={type} id={`arrow-${type}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <polygon points="0,0 6,3 0,6" fill={color} />
                </marker>
              ))}
            </defs>

            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill={canvasFill} />

              {lanes.map((lane, laneIndex) => {
                const laneTop = PAD_Y + HEADER_HEIGHT + laneIndex * LANE_HEIGHT;
                return (
                  <g key={lane.id}>
                    <rect
                      x="0"
                      y={laneTop}
                      width={SVG_WIDTH}
                      height={LANE_HEIGHT}
                      fill={laneIndex % 2 === 0 ? laneStripeA : laneStripeB}
                    />
                    <rect x="0" y={laneTop} width="44" height={LANE_HEIGHT} fill={`${lane.color}16`} />
                    <text
                      transform={`rotate(-90 22 ${laneTop + LANE_HEIGHT / 2})`}
                      x="22"
                      y={laneTop + LANE_HEIGHT / 2}
                      textAnchor="middle"
                      className="flow-lane-label"
                      fill={`${lane.color}CC`}
                    >
                      {lane.label}
                    </text>
                    <line x1="0" y1={laneTop} x2={SVG_WIDTH} y2={laneTop} stroke={laneDivider} />
                  </g>
                );
              })}

              <rect x="0" y={PAD_Y} width={SVG_WIDTH} height={HEADER_HEIGHT} fill={headerFill} />
              {phaseHeaders.map((header, index) => (
                <text key={header} x={PAD_X + index * COLUMN_WIDTH + NODE_WIDTH / 2} y={PAD_Y + 21} textAnchor="middle" className="flow-phase-label">
                  {header}
                </text>
              ))}

              {Array.from({ length: columnCount + 1 }).map((_, index) => (
                <line
                  key={`grid-${index}`}
                  x1={PAD_X + index * COLUMN_WIDTH}
                  y1={PAD_Y}
                  x2={PAD_X + index * COLUMN_WIDTH}
                  y2={SVG_HEIGHT - 28}
                  stroke={gridStroke}
                />
              ))}

              {edges.map((edge) => (
                <Edge
                  key={edge.id ?? `${edge.from}-${edge.to}`}
                  edge={edge}
                  nodesById={nodesById}
                  lanes={lanes}
                  selected={edge.id === selectedEdgeId}
                  onSelectEdge={onSelectEdge}
                />
              ))}

              {nodes.map((node) => (
                <Node
                  key={node.id}
                  node={node}
                  lanes={lanes}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={onSelectNode}
                  onDragStart={handleNodeDragStart}
                />
              ))}

              <g transform={`translate(52 ${SVG_HEIGHT - 20})`}>
                {[
                  { label: "Yes / conversion", color: EDGE_COLORS.yes, dashed: false },
                  { label: "No / alternate", color: EDGE_COLORS.no, dashed: false },
                  { label: "Holdout exit", color: EDGE_COLORS.holdout, dashed: true },
                  { label: "Variant B", color: EDGE_COLORS.varB, dashed: true },
                  { label: "Variant A", color: EDGE_COLORS.varA, dashed: false },
                ].map((item, index) => (
                  <g key={item.label} transform={`translate(${index * 168} 0)`}>
                    <line
                      x1="0"
                      y1="0"
                      x2="18"
                      y2="0"
                      stroke={item.color}
                      strokeWidth="1.6"
                      strokeDasharray={item.dashed ? "6 4" : undefined}
                    />
                    <polygon points="14,-2.5 19,0 14,2.5" fill={item.color} />
                    <text x="24" y="4" className="flow-legend-label" fill={legendLabelFill}>
                      {item.label}
                    </text>
                  </g>
                ))}
              </g>
            </g>
          </svg>
        ) : null}

        {busy ? (
          <div className="flow-overlay">
            <div className="flow-overlay-mark">FLOW</div>
            <div className="flow-overlay-message">{progress.message}</div>
            <div className="progress-track wide">
              <span className="progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      
    </div>
  );
}
