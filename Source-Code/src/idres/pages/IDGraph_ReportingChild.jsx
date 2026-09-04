import React, { useMemo } from 'react'

function fmt(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return v.toLocaleString()
}

function parseMatchedFields(raw) {
  const fieldSet = new Set()
  const s = String(raw || '')
  const parts = s.includes('|') ? s.split('|') : s.split('+')
  parts.filter(Boolean).forEach(p => {
    const m = p.trim().match(/^([^(]+)/)
    if (m) fieldSet.add(m[1].trim().toLowerCase())
  })
  return fieldSet
}

function KpiCard({ label, primary, secondary, color, icon }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "relative",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${color}1f, transparent 55%)`,
        }}
      />

      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${color}20`,
          color: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
          position: "relative",
          zIndex: 1,
        }}
      >
        {icon || "•"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
        <span
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>

        <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)", marginTop: 2 }}>
          {primary}
        </div>

        {secondary && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {secondary}
          </div>
        )}
      </div>
    </div>
  )
}

function ProgressBar({ value, max, color }) {
  const v = Math.max(0, Number(value) || 0)
  const m = Math.max(1, Number(max) || 1)
  const pct = Math.max(0, Math.min(100, (v / m) * 100))

  return (
    <div
      style={{
        height: 10,
        borderRadius: 9999,
        background: 'rgba(100,116,139,0.12)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
      title={`${v}`}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 9999,
          opacity: 0.92,
        }}
      />
    </div>
  )
}

function BarCard({ title, rows, color }) {
  const max = rows.reduce((m, r) => Math.max(m, Number(r.value) || 0), 0) || 1

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span className="card-title">{title}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Items: <b style={{ color: 'var(--text-primary)' }}>{rows.length}</b>
        </span>
      </div>

      <div style={{ padding: 16, display: 'grid', gap: 10 }}>
        {rows.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No data</div>
        ) : (
          rows.map(r => (
            <div
              key={r.label}
              style={{
                display: 'grid',
                gridTemplateColumns: '170px 1fr 70px',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-primary)' }}>
                {String(r.label).length > 24 ? String(r.label).slice(0, 24) + '…' : r.label}
              </div>
              <ProgressBar value={r.value} max={max} color={color} />
              <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 900, color: 'var(--text-secondary)' }}>
                {fmt(r.value)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Donut({ title, items, colors }) {
  const total = items.reduce((s, it) => s + (Number(it.value) || 0), 0)
  const size = 220
  const r = 72
  const cx = size / 2
  const cy = size / 2
  const stroke = 18
  const circumference = 2 * Math.PI * r
  let acc = 0

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span className="card-title">{title}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Total: <b style={{ color: 'var(--text-primary)' }}>{fmt(total)}</b>
        </span>
      </div>

      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 260, height: 240, display: 'grid', placeItems: 'center' }}>
          <svg width={size} height={size} role="img" aria-label={title}>
            <circle cx={cx} cy={cy} r={r} stroke="rgba(100,116,139,0.12)" strokeWidth={stroke} fill="none" />
            {items.map((it, i) => {
              const v = Number(it.value) || 0
              const frac = total ? v / total : 0
              const dash = frac * circumference
              const gap = 2
              const dashAdj = Math.max(0, dash - gap)
              const dashArray = `${dashAdj} ${circumference - dashAdj}`
              const dashOffset = circumference * (1 - acc)
              acc += frac

              const color = colors[i % colors.length]
              return (
                <circle
                  key={it.label}
                  cx={cx}
                  cy={cy}
                  r={r}
                  stroke={color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                >
                  <title>{`${it.label}: ${fmt(v)} (${total ? Math.round(frac * 100) : 0}%)`}</title>
                </circle>
              )
            })}
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="950" fill="var(--text-primary)">
              {fmt(total)}
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text-muted)">
              edges
            </text>
          </svg>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((it, i) => {
            const v = Number(it.value) || 0
            const pct = total ? Math.round((v / total) * 100) : 0
            const color = colors[i % colors.length]
            return (
              <div
                key={it.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '18px 1fr auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'rgba(100,116,139,0.06)',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 9999, background: color }} />
                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-primary)' }}>
                  {String(it.label).toUpperCase()}
                </div>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-secondary)' }}>
                  {fmt(v)} <span style={{ color: 'var(--text-muted)', fontWeight: 800 }}>({pct}%)</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function IDGraph_ReportingChild({
  graphData,
  tierFilter = 'all',
  selectedClusterInfo = null,
  sourceLabelForNode,
  tierColors,
}) {
  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#a855f7']

  const computed = useMemo(() => {
    if (!graphData?.nodes?.length) {
      return {
        totalNodes: 0,
        totalEdges: 0,
        visibleNodes: 0,
        visibleEdges: 0,
        visibleSources: 0,
        avgScoreVisible: 0,
        edgesByTier: {},
        nodesBySource: {},
        matchedFields: {},
      }
    }

    const allEdges = Array.isArray(graphData.edges) ? graphData.edges : []
    const filteredEdges = tierFilter === 'all' ? allEdges : allEdges.filter(e => e.tier === tierFilter)

    const connectedIds = new Set()
    filteredEdges.forEach(e => {
      const s = typeof e.source === 'object' ? e.source.id : e.source
      const t = typeof e.target === 'object' ? e.target.id : e.target
      connectedIds.add(s)
      connectedIds.add(t)
    })

    const allNodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
    const visibleNodesList = tierFilter === 'all'
      ? allNodes
      : allNodes.filter(n => connectedIds.has(n.id))

    const edgesByTier = {}
    filteredEdges.forEach(e => {
      const k = e.tier || 'unknown'
      edgesByTier[k] = (edgesByTier[k] || 0) + 1
    })

    const nodesBySource = {}
    visibleNodesList.forEach(n => {
      const label =
        typeof sourceLabelForNode === 'function'
          ? sourceLabelForNode(n)
          : (n.source_label || n.source || 'Unknown')
      nodesBySource[label] = (nodesBySource[label] || 0) + 1
    })

    const matchedFields = {}
    filteredEdges.forEach(e => {
      const set = parseMatchedFields(e.matched_fields)
      set.forEach(f => {
        matchedFields[f] = (matchedFields[f] || 0) + 1
      })
    })

    const visibleEdges = filteredEdges.length
    const avgScoreVisible = visibleEdges
      ? Math.round(filteredEdges.reduce((s, e) => s + (Number(e.score) || 0), 0) / visibleEdges)
      : 0

    return {
      totalNodes: selectedClusterInfo?.size ?? allNodes.length,
      totalEdges: allEdges.length,
      visibleNodes: visibleNodesList.length,
      visibleEdges,
      visibleSources: Object.keys(nodesBySource).length,
      avgScoreVisible,
      edgesByTier,
      nodesBySource,
      matchedFields,
    }
  }, [graphData, tierFilter, selectedClusterInfo, sourceLabelForNode])

  const tierItems = useMemo(() => {
    const entries = Object.entries(computed.edgesByTier).sort((a, b) => b[1] - a[1])
    return entries.map(([label, value]) => ({ label, value }))
  }, [computed.edgesByTier])

  const sourceRows = useMemo(() => {
    return Object.entries(computed.nodesBySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }))
  }, [computed.nodesBySource])

  const fieldRows = useMemo(() => {
    return Object.entries(computed.matchedFields)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }))
  }, [computed.matchedFields])

  if (!graphData) {
    return (
      <div className="empty-state" style={{ padding: 60 }}>
        <div className="empty-state-title">Select a cluster</div>
        <p>Choose a cluster to view reporting insights.</p>
      </div>
    )
  }

  const tierPalette = tierColors
    ? Object.entries(tierColors).map(([t, c]) => ({ t, c }))
    : []

  const donutColors = tierItems.map((it, i) => {
    if (tierColors && tierColors[it.label]) return tierColors[it.label]
    const found = tierPalette.find(x => x.t === it.label)
    if (found) return found.c
    return colors[i % colors.length]
  })

  return (
    <div style={{ padding: 16 }}>
      <div
        className="card mb-24"
        style={{
          padding: 16,
          borderRadius: 16,
          background: 'linear-gradient(180deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))',
          border: '1px solid rgba(59,130,246,0.18)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 950, color: 'var(--text-primary)' }}>
              Cluster Report View
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              Metrics reflect the current filter. When tier filter is active, “Visible” counts are derived from edges and connected nodes.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                gap: 8,
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: 9999,
                border: '1px solid var(--border)',
                background: 'rgba(100,116,139,0.08)',
                fontSize: 11,
                fontWeight: 900,
                color: 'var(--text-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Tier filter: {String(tierFilter).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <KpiCard
          label="Records"
          primary={fmt(computed.visibleNodes)}
          secondary={`Total: ${fmt(computed.totalNodes)}`}
          color="var(--accent)"
          icon="🧩"
        />

        <KpiCard
          label="Edges"
          primary={fmt(computed.visibleEdges)}
          secondary={`Total: ${fmt(computed.totalEdges)}`}
          color="#10b981"
          icon="🔗"
        />

        <KpiCard
          label="Sources"
          primary={fmt(computed.visibleSources)}
          secondary="Visible nodes"
          color="#a78bfa"
          icon="📡"
        />

        {/* <KpiCard
          label="Avg Score"
          primary={fmt(computed.avgScoreVisible)}
          secondary="Visible edges"
          color="#f59e0b"
          icon="📈"
        /> */}
      </div>

      <div
        className="mb-24"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
          alignItems: 'stretch',
        }}
      >
        <Donut title="Edges by Tier (Visible)" items={tierItems} colors={donutColors} />
        <BarCard title="Nodes by Source (Visible)" rows={sourceRows} color="var(--accent)" />
      </div>

      <BarCard title="Matched Fields (Visible Edges)" rows={fieldRows} color="var(--accent-light)" />
    </div>
  )
}