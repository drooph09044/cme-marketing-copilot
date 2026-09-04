import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
} from 'recharts'


/* =====================================================
   API ENDPOINTS (RELATIVE – handled by Vite proxy)
===================================================== */
// const ENDPOINTS = {
//   summary: '/api/copilot/journey/measurement/generalsummary',
//   campaigns: '/api/copilot/journey/measurement/generalcampaign',
//   trend: '/api/copilot/journey/measurement/generaltrend',
//   distribution: '/api/copilot/journey/measurement/generaldistribution',

//   channelmix: '/api/copilot/journey/measurement/channelmix',
//   deliverfunnel: '/api/copilot/journey/measurement/deliverfunnel',
//   submissionRate: "/api/submission_rate",

// }

const ENDPOINTS = {
  listing: '/api/copilot/journey/measurement/listing'
}

/* =====================================================
   CONSTANTS & UTILS
===================================================== */
const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444']

const fmtInt = (n) => new Intl.NumberFormat('en-IN').format(Number(n || 0))


const fmtCurrency = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0))

const toPctValue = (n) => {
  const value = Number(n)
  if (!Number.isFinite(value)) {
    return 0
  }
  return value <= 1 ? value * 100 : value
}

const fmtPct = (n, digits = 0) => `${toPctValue(n).toFixed(digits)}%`




const shortDate = (d) => {
  const dt = new Date(d)
  return isNaN(dt) ? '-' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function RateTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  const byKey = payload.reduce((acc, item) => {
    if (item?.dataKey) {
      acc[item.dataKey] = item
    }
    return acc
  }, {})

  const rows = [
    { key: 'Opened', label: 'Opened Rate %' },
    { key: 'Clicked', label: 'Clicked Rate %' },
    { key: 'Unsubscribed', label: 'Unsubscribed Rate %' },
  ]

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '10px 12px',
        minWidth: 170,
        color: '#000000',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#000000' }}>{label}</div>
      {rows.map((row) => {
        const item = byKey[row.key]
        const value = Number(item?.value || 0)
        return (
          <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
            <span style={{ color: item?.color || '#334155' }}>{row.label}</span>
            <span style={{ fontWeight: 700, color: '#000000' }}>{`${value.toFixed(1)}%`}</span>
          </div>
        )
      })}
    </div>
  )
}

/* =====================================================
   FETCH HELPER (GET ONLY)
===================================================== */
async function getJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}


//   Dummy data (kept in array)
const SEGMENT_HEATMAP_DATA = [
  { label: "VIP", rate: 11.2 },
  { label: "High Intent", rate: 8.7 },
  { label: "Cart Drop", rate: 6.4 },
  { label: "Browse Only", rate: 2.1 },
  { label: "New Users", rate: 3.8 },

  { label: "Re-engaged", rate: 7.1 },
  { label: "Dormant", rate: 0.4 },
  { label: "Loyalists", rate: 9.3 },
  { label: "At Risk", rate: 1.2 },
  { label: "Price Sensitive", rate: 4.6 },

  { label: "Mobile First", rate: 5.9 },
  { label: "Desktop", rate: 4.2 },
  { label: "WhatsApp Opt", rate: 7.8 },
  { label: "Email Only", rate: 3.2 },
  { label: "Multi-channel", rate: 10.4 },
]

/* =====================================================
   MAIN COMPONENT
===================================================== */
export default function CampaignJourneyListing() {
  const navigate = useNavigate()
  const refreshRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({})
  const [campaigns, setCampaigns] = useState([])
  const [totalCampaigns, setTotalCampaigns] = useState(0)
  const [trend, setTrend] = useState([])
  const [distribution, setDistribution] = useState([])

  const [search, setSearch] = useState('')

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [channelMix, setChannelMix] = useState({})
  const [deliverFunnel, setDeliverFunnel] = useState(null)
  const [submissionRate, setSubmissionRate] = useState(null)


  /* ================= FETCH ALL ================= */
  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await getJSON(ENDPOINTS.listing)

      //   Map EXACT same way as old structure
      setSummary(res?.summary || {})

      setCampaigns(res?.campaigns?.data || [])
      setTotalCampaigns(
        Number(res?.campaigns?.total_campaigns) ||
        Number(res?.campaigns?.data?.length) ||
        0
      )

      setTrend(Array.isArray(res?.trend) ? res.trend : [])
      setDistribution(Array.isArray(res?.distribution) ? res.distribution : [])

      setChannelMix(res?.channel_mix || {})
      setDeliverFunnel(res?.funnel || null)

      setSubmissionRate(res?.submission || null)
    } catch (err) {
      console.error('CampaignJourneyListing fetch error:', err)
    }
    setLoading(false)
  }

  // const fetchAll = async () => {
  //   setLoading(true)
  //   try {

  //     const [s, c, t, d, mix, funnel, submission] = await Promise.all([
  //       getJSON(ENDPOINTS.summary),
  //       getJSON(ENDPOINTS.campaigns),
  //       getJSON(ENDPOINTS.trend),
  //       getJSON(ENDPOINTS.distribution),
  //       getJSON(ENDPOINTS.channelmix),
  //       getJSON(ENDPOINTS.deliverfunnel),
  //       getJSON(ENDPOINTS.submissionRate),
  //     ])


  //     setSummary(s || {})
  //     setCampaigns(c?.data || [])
  //     setTotalCampaigns(Number(c?.total_campaigns) || Number(c?.data?.length) || 0)
  //     setTrend(Array.isArray(t) ? t : [])
  //     setDistribution(Array.isArray(d) ? d : [])

  //     setChannelMix(mix || {})
  //     setDeliverFunnel(funnel || null)
  //     setSubmissionRate(submission || null)
  //   } catch (err) {
  //     console.error('CampaignJourneyListing fetch error:', err)
  //   }
  //   setLoading(false)
  // }

  useEffect(() => {
    fetchAll()
  }, [])





  /* ================= DERIVED ================= */
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) =>
      String(c['Campaign id'] || '').toLowerCase().includes(search.toLowerCase())
    )
  }, [campaigns, search])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  // Paginated campaigns (no change to filtering logic)
  const paginatedCampaigns = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredCampaigns.slice(start, start + pageSize)
  }, [filteredCampaigns, currentPage])

  const totalPages = Math.ceil(filteredCampaigns.length / pageSize)

  const lineData = useMemo(() => {
    return trend.map((t) => ({
      day: shortDate(t['Email sent date']),
      sent: t['Email sent'],
      delivered: t['Email delivered'],
      opened: t['Email opened'],
      clicked: t['Email clicked'],
    }))
  }, [trend])
  const rateData = useMemo(() => {
    return [...campaigns]
      .sort((left, right) => toPctValue(right['Email_open_rate']) - toPctValue(left['Email_open_rate']))
      .slice(0, 5)
      .map((item) => ({
        campaign: item['Campaign Name'] || item['Campaign id'],
        Opened: Number(toPctValue(item['Email_open_rate']).toFixed(1)),
        Clicked: Number(toPctValue(item['Email_click_rate']).toFixed(1)),
        Unsubscribed: Number(toPctValue(item['Email_unsubscribed_rate']).toFixed(1)),
      }))
  }, [campaigns])

  const channelPieData = useMemo(() => {
    if (!channelMix || typeof channelMix !== 'object') return []

    return Object.entries(channelMix).map(([name, percentStr]) => {
      // value needed for chart sizing only
      const numeric = parseFloat(String(percentStr).replace('%', ''))
      return {
        name,
        value: Number.isFinite(numeric) ? numeric : 0,
        display: String(percentStr), //   exact API display
      }
    })
  }, [channelMix])

  const funnelRows = useMemo(() => {
    if (!deliverFunnel) return []

    //   revenue removed
    const order = ["sent", "delivered", "opened", "clicked", "bounced"]
    const labels = {
      sent: "Sent",
      delivered: "Delivered",
      opened: "Opened",
      clicked: "Clicked",
      bounced: "Bounced",
    }

    return order.map((key) => {
      const item = deliverFunnel?.[key] || {}
      const pctStr = String(item.percentage ?? "")
      const pctValue = parseFloat(pctStr.replace("%", ""))

      return {
        key,
        label: labels[key],
        percentage: pctStr, //   exact API string
        pctValue: Number.isFinite(pctValue) ? pctValue : 0, // only for width
        count: item.count,
      }
    })
  }, [deliverFunnel])

  //   transform submission API into heatmap format
  const submissionHeatmaps = useMemo(() => {
    if (!submissionRate) return {}

    return {
      byChannel: (submissionRate.by_channel || []).map((item) => ({
        label: item.channel?.toUpperCase() || "-",
        rate: parseFloat(String(item.submission_rate).replace("%", "")),
      })),

      byCountry: (submissionRate.by_country || []).map((item) => ({
        label: item.country_code || "-",
        rate: parseFloat(String(item.submission_rate).replace("%", "")),
      })),

      byDevice: (submissionRate.by_device || []).map((item) => ({

        label:
          item.device_platform && !Number.isNaN(item.device_platform)
            ? String(item.device_platform).toUpperCase()
            : "UNKNOWN",

        rate: parseFloat(String(item.submission_rate).replace("%", "")),
      })),
    }
  }, [submissionRate])


  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" /> Loading campaigns...
      </div>
    )
  }


  async function getJSON(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }
  async function getJSON(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const text = await res.text()

    //   Fix invalid JSON "NaN" → null
    const safeText = text.replace(/\bNaN\b/g, "null")

    try {
      return JSON.parse(safeText)
    } catch (err) {
      console.error("JSON parse error (after cleanup):", err)
      return {}
    }
  }


  /* ================= UI ================= */
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Performance Hub</h1>
        <p className="page-description">
          Monitor campaign performance, engagement, and revenue
        </p>
      </div>

      <div className="page-body">
        {/* KPIs */}


        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 15,
          }}
        >
          <KpiCard
            label="Total Campaigns"
            value={fmtInt(totalCampaigns)}
            icon="🎯"
            color="#8b5cf6"
          />

          <KpiCard
            label="Emails Sent"
            value={fmtInt(summary.Email_sent)}
            icon="📤"
            color="#64748b"
          />

          <KpiCard
            label="Delivered"
            value={fmtInt(summary.Email_delivered)}
            icon=" "
            color="#22c55e"
            growth={summary.Email_delivery_growth_percent}
          />

          <KpiCard
            label="Open Rate"
            value={summary.Email_open_rate}
            icon="📬"
            color="#3b82f6"
            growth={summary.Email_open_growth_percent}
          />

          <KpiCard
            label="Click Rate"
            value={summary.Email_Click_percentage}
            icon="🖱"
            color="#f59e0b"
            growth={summary.Click_percentage_growth_percent}
          />

          <KpiCard
            label="Bounce Rate"
            value={summary.Email_Bounce_rate}
            icon="⚠️"
            color="#ef4444"
            growth={summary.Bounce_growth_percent}
          />

          <KpiCard
            label="Unsubscribed"
            value={summary.Emails_unsubscribed_rate}
            icon="🚫"
            color="#dc2626"
            growth={summary.Unsubscribed_growth_percent}
          />
        </div>


        {/* <div className="kpi-grid">
          <Kpi title="Total Active Campaigns" value={fmtInt(totalCampaigns)} accent="#8b5cf6" />

        
          <Kpi title="Emails Sent" value={fmtInt(summary.Email_sent)} />

          <Kpi
            title="Emails Delivered"
            value={fmtInt(summary.Email_delivered)}
            accent="#22c55e"
            growth={summary.Email_delivery_growth_percent}
          />

          <Kpi
            title="Emails Opened Rate"
            value={(summary.Email_open_rate)}
            accent="#3b82f6"
            growth={summary.Email_open_growth_percent}
          />

          <Kpi
            title="Emails Clicked Rate"
            value={(summary.Email_Click_percentage)}
            accent="#f59e0b"
            growth={summary.Click_percentage_growth_percent}
          />

          <Kpi
            title="Emails Bounce Rate"
            value={(summary.Email_Bounce_rate)}
            accent="#ef4444"
            growth={summary.Bounce_growth_percent}
          />

          <Kpi
            title="Emails Unsubscribed Rate"
            value={(summary.Emails_unsubscribed_rate)}
            accent="#dc2626"
            growth={summary.Unsubscribed_growth_percent}
          />
        </div> */}



        {/* TABLE */}
        <div className="card">
          {/* <div className="card-header">
            <span className="card-title">Campaigns ({filteredCampaigns.length})</span>
            <input
              className="input"
              placeholder="Search campaign..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div> */}

          <div className="data-table-wrapper">
            <h4 className="page-title" style={{ padding: "10px" }}>Campaign Journey Measurements</h4>
            <table className="data-table">
              <thead>
                <tr>

                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Clicked</th>
                  <th>Delivered</th>
                  <th>Unsubscribed</th>
                  <th>Bounced</th>
                  <th>Open Rate %</th>
                  <th>CTR %</th>
                  <th>Delivery Rate %</th>
                  <th>Unsubscribed Rate %</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>

              </thead>
              <tbody>
                {paginatedCampaigns.map((c) => (
                  <tr key={c["Campaign id"]}>


                    <td>
                      <strong>{c["Campaign Name"]}</strong>
                    </td>

                    <td>
                      <StatusPill status={c.status || c.Status || "Draft"} />
                    </td>
                    <td>{fmtInt(c["Email sent"])}</td>
                    <td>{fmtInt(c["Email opened"])}</td>
                    <td>{fmtInt(c["Email clicked"])}</td>
                    <td>{fmtInt(c["Email delivered"])}</td>
                    <td>{fmtInt(c["Email unsubscribed"])}</td>
                    <td>{fmtInt(c["Email bounced"])}</td>
                    <td>{(c["Email_open_rate"])} %</td>
                    <td>{(c["Email_click_rate"])} %</td>
                    <td>{(c["Email_delivery_rate"])} %</td>
                    <td>{(c["Email_unsubscribed_rate"])} %</td>
                    {/* <td>{fmtCurrency(c.revenue)}</td> */}

                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/campaign-journey-view/${c["Campaign id"]}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 12px",
              borderTop: "1px solid var(--border)",
              flexWrap: "wrap",
              gap: 10
            }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Page {currentPage} of {totalPages || 1}
              </span>

              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>

                {/* Prev */}
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  Prev
                </button>

                {/* Page Numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    className="btn btn-sm"
                    onClick={() => setCurrentPage(page)}
                    style={{
                      minWidth: 32,
                      padding: "4px 8px",
                      fontWeight: 700,
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: page === currentPage ? "#3b82f6" : "var(--bg-secondary)",
                      color: page === currentPage ? "#fff" : "var(--text-primary)",
                    }}
                  >
                    {page}
                  </button>
                ))}

                {/* Next */}
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* CHARTS */}
        <div className="grid-1" style={{ marginTop: "15px" }}>
          <ChartCard title="Daily Email Trend">
            <ResponsiveContainer>
              <LineChart data={lineData}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line dataKey="sent" stroke="#64748b" />
                <Line dataKey="opened" stroke="#3b82f6" />
                <Line dataKey="clicked" stroke="#f59e0b" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* <ChartCard title="Distribution">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={distribution}
                  dataKey="value"
                  nameKey="metric"
                  innerRadius={60}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {distribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard> */}
        </div>



        {/* RATE CHARTS */}
        <div className="grid-1" style={{ marginTop: '15px' }}>
          {/* <ChartCard title="Top Five Campaign Engagement Rates ">
            <ResponsiveContainer>
              <BarChart data={rateData} layout="vertical">
                <XAxis
                  type="number"
                  ticks={[0, 5, 10, 15, 20]}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis type="category" dataKey="campaign" />
                <Tooltip />
                <Legend />
                <Bar dataKey="Opened" name="Opened Rate %" fill="#3b82f6" />
                <Bar dataKey="Clicked" name="Clicked Rate %" fill="#22c55e" />
                <Bar dataKey="Unsubscribed" name="Unsubscribed Rate %" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard> */}

          <ChartCard title="Campaign Engagement Rates " height={360}>
            <ResponsiveContainer>
              <BarChart data={rateData} margin={{ top: 32, right: 16, left: 8, bottom: 8 }}>
                <XAxis dataKey="campaign" interval={0} tick={{ fontSize: 11 }} />
                <YAxis
                  type="number"
                  domain={[0, (dataMax) => {
                    const next = Math.ceil((Number(dataMax || 0) + 2) / 5) * 5
                    return Math.max(10, next)
                  }]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<RateTooltip />} />
                <Legend />
                <Bar dataKey="Opened" name="Opened Rate %" fill="#3b82f6">
                  <LabelList dataKey="Opened" position="top" offset={8} formatter={(value) => `${Number(value || 0).toFixed(1)}%`} />
                </Bar>
                <Bar dataKey="Clicked" name="Clicked Rate %" fill="#22c55e">
                  <LabelList dataKey="Clicked" position="top" offset={8} formatter={(value) => `${Number(value || 0).toFixed(1)}%`} />
                </Bar>
                <Bar dataKey="Unsubscribed" name="Unsubscribed Rate %" fill="#ef4444">
                  <LabelList dataKey="Unsubscribed" position="top" offset={8} formatter={(value) => `${Number(value || 0).toFixed(1)}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>


        {/* ========================= BOTTOM: Channel Mix + Funnel ======================== */}

        <div
          style={{
            marginTop: 15,
            display: "grid",
            gridTemplateColumns: "0.5fr 1fr",
            gap: 15,
            alignItems: "start",
          }}
        >

          <ChartCard title="Channel Mix" height={380}>
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {/* TOP: Pie */}
              <div style={{ flex: 1, minHeight: 210 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={channelPieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      labelLine={false}
                      label={false}
                    >
                      {channelPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>

                    {/* Tooltip shows EXACT API string */}
                    <Tooltip formatter={(v, n, props) => props?.payload?.display || String(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* BOTTOM: Labels list (vertical) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {channelPieData.map((item, i) => {
                  const color = PIE_COLORS[i % PIE_COLORS.length]
                  return (
                    <div
                      key={item.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "var(--bg-secondary)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        {/* bullet (matches pie slice color) */}
                        <span
                          aria-hidden="true"
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: color,
                            boxShadow: "0 0 0 3px rgba(255,255,255,0.04)",
                            flex: "0 0 auto",
                          }}
                        />
                        {/* label */}
                        <span
                          style={{
                            color: "var(--text-primary)",
                            fontWeight: 700,
                            fontSize: 13,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={item.name}
                        >
                          {item.name}
                        </span>
                      </div>

                      {/* percentage (EXACT API string) */}
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontWeight: 800,
                          fontSize: 13,
                          flex: "0 0 auto",
                        }}
                      >
                        {item.display}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </ChartCard>


          <div className="card" style={{ marginTop: 0, height: 458 }} >
            <div className="card-header" style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
              <span className="card-title">Deliverability Funnel</span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                From send to conversation - all channels
              </span>
            </div>

            <div style={{ padding: 16, marginTop: 35 }}>
              {/* 3-column layout */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "170px 1fr 140px",
                  gap: 12,
                  alignItems: "center",
                }}
              >

                {/* Data rows (Revenue removed) */}
                {funnelRows.map((row, idx) => {
                  const COLORS = ["#64748b", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444"]
                  const barColor = COLORS[idx % COLORS.length]

                  // Width only for bar fill (display stays EXACT string)
                  const widthPct = Math.max(0, Math.min(100, Number(row.pctValue || 0)))

                  return (
                    <div key={row.key} style={{ display: "contents" }}>
                      {/* Col 1 */}
                      <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{row.label}</div>

                      {/* Col 2: bar + percentage label on filled end */}
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            height: 44,
                            borderRadius: 9,
                            background: "var(--bg-secondary)",
                            border: "1px solid var(--border)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${widthPct}%`,
                              background: barColor,
                            }}
                          />

                          {/* Percentage label at end of filled portion */}
                          <div
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: `clamp(12px, ${widthPct}%, calc(100% - 12px))`,
                              transform: "translate(-100%, -50%)",
                              fontSize: 12,
                              fontWeight: 800,
                              color: "var(--text-primary)",
                              textShadow: "0 1px 0 rgba(0,0,0,0.25)",
                              pointerEvents: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.percentage}
                          </div>
                        </div>
                      </div>

                      {/* Col 3 */}
                      <div style={{ textAlign: "right", fontWeight: 800, color: "var(--text-primary)" }}>
                        {fmtInt(row.count)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {submissionRate && (
          <SegmentPerformanceHeatmapAPI dataMap={submissionHeatmaps} />
        )}

        <SegmentPerformanceHeatmap />


        {/* YESTERDAY VS TODAY */}
        {/* <div className="card" style={{ marginTop: '15px' }}>
          <div className="card-header">
            <span className="card-title">Yesterday vs Today</span>
          </div>

          <div style={{ height: 320, padding: 16 }}>
            <ResponsiveContainer>
              <BarChart
                data={yesterdayTodayArr}
                barGap={8}
                barCategoryGap={24}
              >
                <XAxis dataKey="name" />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(v) => `${v}%`}
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                  }}
                />
                <Legend iconType="circle" />

                <Bar
                  dataKey="Yesterday"
                  name="Yesterday %"
                  fill="#94a3b8"
                  barSize={28}
                  radius={[8, 8, 0, 0]}
                  activeBar={false}
                />

                <Bar
                  dataKey="Today"
                  name="Today %"
                  fill="#22c55e"
                  barSize={28}
                  radius={[8, 8, 0, 0]}
                  activeBar={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div> */}




      </div>
    </>
  )
}

/* =====================================================
   SMALL COMPONENTS
===================================================== */
function KpiCard({ label, value, color = "#2680eb", icon, growth }) {
  const hasGrowth = growth !== undefined && growth !== null && growth !== "";
  const val = Number(growth);
  const isUp = Number.isFinite(val) ? val >= 0 : true;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* gradient layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${color}1f, transparent 55%)`,
        }}
      />

      {/* icon */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${color}22`,
          color: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          zIndex: 1,
        }}
      >
        {icon}
      </div>

      {/* content */}
      <div style={{ display: "flex", flexDirection: "column", zIndex: 1 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
          }}
        >
          {label}
        </span>

        <div style={{ fontSize: 18, fontWeight: 800 }}>
          {value}
        </div>

        {hasGrowth && (
          <div style={{ fontSize: 11, marginTop: 4 }}>
            <span style={{ color: isUp ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
              {isUp ? "▲" : "▼"} {growth}%
            </span>
            <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
              vs last period
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, children, height = 320 }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
      </div>
      <div style={{ height, padding: 16 }}>{children}</div>
    </div>
  )
}
function heatmapTileBg(rate, min, max) {
  const r = Number(rate) || 0
  const t = max === min ? 1 : Math.max(0, Math.min(1, (r - min) / (max - min)))
  const pct = Math.round(12 + t * 58) // 12..70% blend of accent on top of card surface
  return `color-mix(in srgb, var(--bg-secondary) ${100 - pct}%, var(--accent) ${pct}%)`
}

function HeatmapTile({ label, rate, min, max }) {
  return (
    <div
      style={{
        borderRadius: 12,
        padding: "14px 16px",
        background: heatmapTileBg(rate, min, max),
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 10,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={label}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.1,
        }}
      >
        {Number(rate || 0)}%
      </div>

      <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
        Conv. Rate
      </div>
    </div>
  )
}

function HeatmapLegend() {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "var(--text-muted)",
          fontSize: 12,
          marginBottom: 8,
        }}
      >
        <span>Low</span>
        <span>High</span>
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          border: "1px solid var(--border)",
          background:
            "linear-gradient(90deg, var(--bg-secondary) 0%, var(--accent) 50%, var(--accent-light) 100%)",
        }}
      />
    </div>
  )
}

function SegmentPerformanceHeatmap({ data = SEGMENT_HEATMAP_DATA }) {
  const values = (data || []).map((d) => Number(d.rate) || 0)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 1

  return (
    <div
      className="card"
      style={{
        marginTop: 15,
        overflow: "hidden",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div
        className="card-header"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="card-title">Segment Performance Heatmap</span>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            Conversion Rate by audiance segment
          </span>
        </div>

        <button
          type="button"
          title="Open"
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-primary)",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ↗
        </button>
      </div>

      <div style={{ padding: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          {(data || []).map((item) => (
            <HeatmapTile
              key={item.label ?? item.name ?? "-"}
              label={item.label ?? item.name ?? "-"}
              rate={item.rate}
              min={min}
              max={max}
            />
          ))}
        </div>

        <HeatmapLegend />
      </div>
    </div>
  )
}
function SegmentPerformanceHeatmapAPI({ dataMap = {} }) {
  const [selected, setSelected] = useState("channel")

  const currentData = useMemo(() => {
    if (!dataMap) return []
    if (selected === "country") return dataMap.byCountry || []
    if (selected === "device") return dataMap.byDevice || []
    return dataMap.byChannel || []
  }, [selected, dataMap])

  const config = {
    channel: { title: "Submission Rate Heatmap", subtitle: "Conversion rate by channel" },
    country: { title: "Submission Rate Heatmap", subtitle: "Conversion rate by country" },
    device: { title: "Submission Rate Heatmap", subtitle: "Conversion rate by device" },
  }

  const { title, subtitle } = config[selected]

  const values = (currentData || []).map((d) => Number(d.rate) || 0)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 1

  return (
    <div
      className="card"
      style={{
        marginTop: 15,
        overflow: "hidden",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div
        className="card-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="card-title">{title}</span>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{subtitle}</span>
        </div>

        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <option value="channel">Channel</option>
          <option value="country">Country</option>
          <option value="device">Device</option>
        </select>
      </div>

      <div style={{ padding: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          {(currentData || []).map((item) => (
            <HeatmapTile
              key={item.label ?? item.name ?? "-"}
              label={item.label ?? item.name ?? "-"}
              rate={item.rate}
              min={min}
              max={max}
            />
          ))}
        </div>

        <HeatmapLegend />
      </div>
    </div>
  )
}
function StatusPill({ status }) {
  const value = String(status || "").trim()

  const meta = {
    Live: { bg: "rgba(34,197,94,0.14)", border: "rgba(34,197,94,0.35)", text: "#22c55e" },  // green
    Draft: { bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.35)", text: "#f59e0b" },  // amber
    Ended: { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.35)", text: "#ef4444" },  // red
  }[value] || { bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.25)", text: "var(--text-muted)" }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: meta.bg,
        color: meta.text,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.2,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}
      title={value || "Unknown"}
    >
      {value || "Unknown"}
    </span>
  )
}

