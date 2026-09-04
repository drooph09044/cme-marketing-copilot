import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

import { useMemo } from "react";
import "./CPieChart.css";

const DEFAULT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

function formatNumber(val) {
  return Number(val || 0).toLocaleString("en-US");
}

function compactLabel(label, compact) {
  const text = String(label || "");
  if (!compact) return text;
  return text.length > 18 ? `${text.slice(0, 16)}…` : text;
}

function renderLegend(_props, rows, compact) {
  const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "8px",
        marginTop: "12px",
      }}
    >
      {rows.map((row) => {
        const pct = total ? ((row.value / total) * 100).toFixed(1) : 0;

        return (
          <div
            key={row.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              background: "var(--bg-secondary)",
              minWidth: compact ? "110px" : "140px",
            }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: row.fill,
                flexShrink: 0,
              }}
            />

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {compactLabel(row.name, compact)}
              </div>

              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                {formatNumber(row.value)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload || {};

  return (
    <div className="c-pie-tooltip">
      <strong>{row.name}</strong>
      <div>
        <span style={{ background: row.fill }} />
        {formatNumber(row.value)}
      </div>
    </div>
  );
}

/* ===============================
   MAIN COMPONENT
================================ */
export default function CPieChart({
  data = [],
  title,
  note,
  compact = false,
  height = 300,
  centerLabel = "Total",

  showLegend = true,
  showCenter = true,

}) {
  const processed = useMemo(() => {
    return (data || [])
      .map((d, i) => ({
        name: d.label ?? d.name,
        value: Math.max(0, Number(d.value || 0)),
        fill: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      }))
      .filter((d) => d.value > 0);
  }, [data]);

  const total = processed.reduce((a, b) => a + b.value, 0);

  if (total <= 0) {
    return (
      <div className="c-pie-card">
        {title && <div className="c-pie-title">{title}</div>}
        {note && <div className="c-pie-note">{note}</div>}
        <div className="c-pie-empty">No data available</div>
      </div>
    );
  }

  const chartHeight = compact ? 285 : height;
  const outerRadius = compact ? 62 : 82;
  const innerRadius = compact ? 34 : 50;

  return (
    <div className="c-pie-card">
      {(title || note) && (
        <div className="c-pie-head">
          {title && <div className="c-pie-title">{title}</div>}
          {/* {note && <div className="c-pie-note">{note}</div>} */}
        </div>
      )}

      <div className="c-pie-chart-area" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart
            margin={{
              top: 18,
              right: 40,
              bottom: showLegend ? 30 : 10,
              left: 40,
            }}
          >
            <Pie
              data={processed}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="48%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={processed.length > 1 ? 2 : 0}
              minAngle={3}
              isAnimationActive={false}
              labelLine={false}
              label={false}
            >
              {processed.map((entry, index) => (
                <Cell
                  key={`${entry.name}-${index}`}
                  fill={entry.fill}
                  stroke="var(--bg-card)"
                  strokeWidth={2}
                />
              ))}
            </Pie>

            <Tooltip content={renderTooltip} wrapperStyle={{ outline: "none" }} />

            {showLegend ? (
              <Legend
                verticalAlign="bottom"
                align="center"
                content={(props) => renderLegend(props, processed, compact)}
              />
            ) : null}

          </PieChart>
        </ResponsiveContainer>

        {showCenter ? (
          <div
            className="c-pie-center"
            style={{
              textAlign: "center",
            }}
          >
            <strong
              style={{
                fontSize: compact ? "18px" : "24px",
                fontWeight: 800,
                color: "var(--text-primary)",
              }}
            >
              {formatNumber(total)}
            </strong>

            {centerLabel && (
              <span
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginTop: "2px",
                }}
              >
                {centerLabel}
              </span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
