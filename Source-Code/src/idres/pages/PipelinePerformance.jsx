import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import { api } from '../api'

const COLORS = { exact: '#10b981', strong: '#3b82f6', weak: '#f59e0b' }

const RADIAN = Math.PI / 180
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, value, percent }) => {
  const radius = outerRadius + 30
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="var(--text-secondary)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {`${name}: ${value.toLocaleString()}`}
    </text>
  )
}

export default function PipelinePerformance() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const isLight = typeof document !== 'undefined' && document.documentElement?.dataset?.theme === 'light'
  const tickColor = isLight ? '#000000' : '#94a3b8'
  const tooltipPrimary = isLight ? '#000000' : '#f1f5f9'
  const tooltipSecondary = isLight ? '#000000' : '#e2e8f0'
  const tooltipBg1 = isLight ? '#ffffff' : '#0f172a'
  const tooltipBorder1 = isLight ? '#cbd5e1' : '#334155'
  const tooltipBg2 = isLight ? '#ffffff' : '#1a1f2e'
  const tooltipBorder2 = isLight ? '#cbd5e1' : '#475569'

  useEffect(() => {
    api.getSummary().then(d => { setSummary(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading"><div className="spinner" /> Loading performance data...</div>
  if (!summary || !summary.evaluation.pairwise) return (
    <div className="empty-state"><div className="empty-state-title">No evaluation data</div><p>Run the full pipeline first.</p></div>
  )

  const { evaluation: ev, cluster: cl, golden: gl } = summary
  const pw = ev.pairwise

  const sizeData = Object.entries(ev.purity_by_size || {}).map(([k, v]) => ({
    name: k, total: v.total, pure: v.pure, purity: v.purity
  })).filter(d => d.total > 0)

  const tierData = Object.entries(ev.edge_tier_precision || {}).map(([k, v]) => ({
    name: k, pairs: v.total_pairs, tp: v.true_positives, precision: v.precision
  }))

  const totalEdges = tierData.reduce((s, d) => s + d.pairs, 0)

  const clusterPie = [
    { name: 'Multi-record', value: cl.multi_record_clusters || 0 },
    { name: 'Singletons', value: cl.singletons || 0 },
  ]

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Pipeline Performance</h1>
        <p className="page-description">Evaluation metrics, precision, recall, and cluster analysis</p>
      </div>
      <div className="page-body">
        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Total Clusters</div>
            <div className="kpi-value accent">{(cl.total_clusters || 0).toLocaleString()}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Golden Records</div>
            <div className="kpi-value accent">{(gl.total_golden_records || 0).toLocaleString()}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Total Records Processed</div>
            <div className="kpi-value accent">{(cl.total_records || 0).toLocaleString()}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Multi-record Clusters</div>
            <div className="kpi-value success">{(cl.multi_record_clusters || 0).toLocaleString()}</div>
            <div className="kpi-detail">{cl.singletons || 0} singletons</div>
          </div>
        </div>

        {/* Edge Tier Breakdown + Edge Distribution table side by side */}
        <div className="grid-2 mb-24">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Edge Tier Breakdown</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tierData}>
                <XAxis dataKey="name" tick={{ fill: tickColor, fontSize: 11 }} />
                <YAxis tick={{ fill: tickColor, fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: tooltipBg1, border: `1px solid ${tooltipBorder1}`, borderRadius: 6, fontSize: 12, color: tooltipPrimary }}
                  labelStyle={{ color: tooltipSecondary, fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: tooltipPrimary }}
                  cursor={{ fill: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }}
                  formatter={(v, name) => [v.toLocaleString(), 'Pairs']}
                />
                <Bar dataKey="pairs" radius={[4, 4, 0, 0]}>
                  {tierData.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[entry.name] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Edge Distribution</span>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Match Category</th>
                    <th>No. of Matches</th>
                    <th>No. of Pairs</th>
                  </tr>
                </thead>
                <tbody>
                  {tierData.map(d => (
                    <tr key={d.name}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, textTransform: 'capitalize' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[d.name] || '#64748b', display: 'inline-block', flexShrink: 0 }} />
                          {d.name}
                        </span>
                      </td>
                      <td>{d.pairs.toLocaleString()}</td>
                      <td>{d.tp.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                    <td>Total</td>
                    <td>{totalEdges.toLocaleString()}</td>
                    <td>{tierData.reduce((s, d) => s + d.tp, 0).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid-2">
          {/* Cluster Composition Pie */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Cluster Composition</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart margin={{ top: 10, right: 60, bottom: 10, left: 60 }}>
                <Pie
                  data={clusterPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  labelLine={true}
                  label={renderCustomLabel}
                >
                  <Cell fill="#3b82f6" />
                  <Cell fill="#64748b" />
                </Pie>
                <Tooltip
                  contentStyle={{ background: tooltipBg2, border: `1px solid ${tooltipBorder2}`, borderRadius: 6, fontSize: 12, color: tooltipPrimary }}
                  labelStyle={{ color: tickColor, fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: tooltipPrimary }}
                  formatter={(v) => v.toLocaleString()}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Cluster Distribution by Size table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Cluster Distribution by Size</span>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead><tr><th>Size Bucket</th><th>Clusters</th><th>Pure</th><th>Purity</th></tr></thead>
                <tbody>
                  {sizeData.map(d => (
                    <tr key={d.name}>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td>{d.total.toLocaleString()}</td>
                      <td>{d.pure.toLocaleString()}</td>
                      <td>
                        <span className={`badge ${d.purity === 1 ? 'badge-exact' : 'badge-weak'}`}>
                          {(d.purity * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
