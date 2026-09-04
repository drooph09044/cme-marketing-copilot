import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
} from 'recharts'
const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444']

/* ======================================================
   Utils
====================================================== */
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
    return isNaN(dt)
        ? '-'
        : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

async function getJSON(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
}


const API = {
    detail: (id) => `/api/copilot/journey/measurement/detail/${id}`
}


// const API = {
//     summary: (id) =>
//         `/api/copilot/journey/measurement/generalcampaign/${id}`,
//     trend: (id) =>
//         `/api/copilot/journey/measurement/generaltrend/${id}`,
//     distribution: (id) =>
//         `/api/copilot/journey/measurement/generaldistribution/${id}`,
// }
/* ======================================================
   MAIN COMPONENT
====================================================== */
export default function CampaignJourneyView() {
    const { campaignId } = useParams()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(true)
    const [summary, setSummary] = useState(null)
    const [trend, setTrend] = useState([])
    const [distribution, setDistribution] = useState([])

    // const generalcampaignArr = {
    //     "Campaign name": "free_trial_april_offer",
    //     "Campaign_id": "cmp_002",
    //     "Email bounced": 40,
    //     "Email clicked": 132,
    //     "Email delivered": 764,
    //     "Email hard bounce": 20,
    //     "Email opened": 221,
    //     "Email sent": 805,
    //     "Email soft bounce": 20,
    //     "Email unsubscribed": 2,
    //     "Email_click_rate": 0.17,
    //     "Email_delivery_rate": 0.95,
    //     "Email_open_rate": 0.29,
    //     "Email_unsubscribed_rate": 0.0,
    //     "revenue": 169.92
    // }

    // const trendArr = [
    //     {
    //         "Email clicked": 3,
    //         "Email delivered": 36,
    //         "Email opened": 11,
    //         "Email sent": 36,
    //         "Email sent date": "Wed, 01 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 9,
    //         "Email delivered": 59,
    //         "Email opened": 22,
    //         "Email sent": 61,
    //         "Email sent date": "Thu, 02 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 8,
    //         "Email delivered": 65,
    //         "Email opened": 22,
    //         "Email sent": 66,
    //         "Email sent date": "Fri, 03 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 11,
    //         "Email delivered": 56,
    //         "Email opened": 21,
    //         "Email sent": 59,
    //         "Email sent date": "Sat, 04 Apr 2026 00:00:00 GMT",
    //         "revenue": 39.98
    //     },
    //     {
    //         "Email clicked": 5,
    //         "Email delivered": 46,
    //         "Email opened": 15,
    //         "Email sent": 47,
    //         "Email sent date": "Sun, 05 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 10,
    //         "Email delivered": 52,
    //         "Email opened": 22,
    //         "Email sent": 53,
    //         "Email sent date": "Mon, 06 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 9,
    //         "Email delivered": 54,
    //         "Email opened": 25,
    //         "Email sent": 56,
    //         "Email sent date": "Tue, 07 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 8,
    //         "Email delivered": 53,
    //         "Email opened": 26,
    //         "Email sent": 54,
    //         "Email sent date": "Wed, 08 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 10,
    //         "Email delivered": 69,
    //         "Email opened": 25,
    //         "Email sent": 71,
    //         "Email sent date": "Thu, 09 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 6,
    //         "Email delivered": 55,
    //         "Email opened": 20,
    //         "Email sent": 55,
    //         "Email sent date": "Fri, 10 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 12,
    //         "Email delivered": 56,
    //         "Email opened": 31,
    //         "Email sent": 60,
    //         "Email sent date": "Sat, 11 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 13,
    //         "Email delivered": 38,
    //         "Email opened": 16,
    //         "Email sent": 41,
    //         "Email sent date": "Sun, 12 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 4,
    //         "Email delivered": 58,
    //         "Email opened": 19,
    //         "Email sent": 61,
    //         "Email sent date": "Mon, 13 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 11,
    //         "Email delivered": 56,
    //         "Email opened": 27,
    //         "Email sent": 56,
    //         "Email sent date": "Tue, 14 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     },
    //     {
    //         "Email clicked": 3,
    //         "Email delivered": 0,
    //         "Email opened": 5,
    //         "Email sent": 0,
    //         "Email sent date": "Wed, 15 Apr 2026 00:00:00 GMT",
    //         "revenue": 0.0
    //     }
    // ]

    // const distributionArr = [
    //     {
    //         "Bounced": 23,
    //         "CTR": "16.20%",
    //         "Campaign ID": "cmp_001",
    //         "Campaign Name": "finale_watch_push",
    //         "Emails Clicked": 122,
    //         "Emails Delivered": 753,
    //         "Emails Opened": 307,
    //         "Emails Sent": 776,
    //         "Open Rate": "40.77%",
    //         "Revenue": 39.98,
    //         "Unsubscribe Rate": "0.40%",
    //         "Unsubscribed": 3
    //     }
    // ]


    const distributionPieData = distribution && distribution.length
        ? [
            {
                metric: 'Opened Rate',
                value: Number(String(distribution[0]['Open Rate']).replace('%', '')),
            },
            {
                metric: 'Clicked Rate',
                value: Number(String(distribution[0]['CTR']).replace('%', '')),
            },
            {
                metric: 'Unsubscribed Rate',
                value: Number(
                    String(distribution[0]['Unsubscribe Rate']).replace('%', '')
                ),
            },
        ]
        : []
    /* ================= Fetch data ================= */
    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true)
            try {
                const res = await getJSON(API.detail(campaignId))

                //   Map EXACTLY as before
                setSummary(res?.campaign || {})
                setTrend(Array.isArray(res?.trend) ? res.trend : [])
                setDistribution(Array.isArray(res?.distribution) ? res.distribution : [])

            } catch (err) {
                console.error('Campaign view fetch error:', err)

                // fallback (no change)
                setSummary({})
                setTrend([])
                setDistribution([])
            }
            setLoading(false)
        }

        fetchAll()
    }, [campaignId])

    /* ================= Chart data ================= */
    const lineData = useMemo(
        () =>
            trend.map((x) => ({
                day: shortDate(x['Email sent date']),
                sent: x['Email sent'],
                delivered: x['Email delivered'],
                opened: x['Email opened'],
                clicked: x['Email clicked'],
            })),
        [trend]
    )

    /* ================= States ================= */
    if (loading) {
        return (
            <div className="page-body">
                <div className="loading">
                    <div className="spinner" /> Loading campaign...
                </div>
            </div>
        )
    }




    /* ================= UI ================= */
    return (
        <>
            {/* Header */}
            <div className="page-header">
                <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => navigate(-1)}
                    style={{ marginBottom: 10, marginTop: 10 }}
                >
                    ← Back
                </button>
                <h4 className="page-title"> Journey Measurements View </h4>

                <h1 className="page-title">
                    {(summary.Campaign_name ||
                        summary['Campaign name'] ||
                        summary.campaign_name ||
                        'Campaign')}
                    {/* <span className="muted-text"> ({summary.Campaign_id})</span> */}
                </h1>

                <p className="page-description">
                    Detailed performance and engagement metrics for this campaign
                </p>
            </div>

            <div className="page-body">
                {/* KPIs */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 12,
                    }}
                >
                    <KpiCard
                        label="Emails Sent"
                        value={fmtInt(summary?.['Email sent'])}
                        color="#64748b"
                        icon="📤"
                    />

                    <KpiCard
                        label="Delivered"
                        value={fmtInt(summary?.['Email delivered'])}
                        color="#22c55e"
                        icon=" "
                    />

                    <KpiCard
                        label="Open Rate"
                        value={summary?.Email_open_rate}
                        color="#3b82f6"
                        icon="📬"
                    />

                    <KpiCard
                        label="Click Rate"
                        value={summary?.['Email_click_rate']}
                        color="#f59e0b"
                        icon="🖱"
                    />

                    <KpiCard
                        label="Bounce Rate"
                        value={summary?.['Email_bounce_rate']}
                        color="#ef4444"
                        icon="⚠️"
                    />

                    <KpiCard
                        label="Unsubscribed"
                        value={summary?.['Email_unsubscribed_rate']}
                        color="#dc2626"
                        icon="🚫"
                    />
                </div>

                {/* <div className="kpi-grid">

                    <Kpi
                        title="Emails Sent"
                        value={fmtInt(summary?.['Email sent'])}
                    />
                    <Kpi
                        title="Emails Delivered"
                        value={fmtInt(summary?.['Email delivered'])}

                        accent="#22c55e"
                    />
                    <Kpi
                        title="Emails Opened Rate"
                        value={(summary?.Email_open_rate)}
                        accent="#3b82f6"
                    />
                    <Kpi
                        title="Emails Clicked Rate"
                        value={(summary?.['Email_click_rate'])}

                        accent="#f59e0b"
                    />
                    <Kpi
                        title="Emails Bounce Rate"

                        value={(summary?.['Email_bounce_rate'])}
                        accent="#ef4444"
                    />
                    <Kpi
                        title="Emails Unsubscribed Rate"
                        value={(summary?.['Email_unsubscribed_rate'])}

                        accent="#dc2626"
                    />

                </div> */}

                {/* Details */}
                <div className="card" style={{ marginTop: 15, marginBottom: 15 }}>
                    <div className="card-header">
                        <span className="card-title">Campaign Details</span>
                    </div>

                    <div className="data-table-wrapper">
                        <table className="data-table data-table--kv">
                            <tbody>
                                <tr>
                                    <th>Status</th>
                                    <StatusPill status={summary['status'] || summary['Status'] || "Draft"} />
                                </tr>
                                <tr>
                                    <th>Email Sent</th>
                                    <td>{fmtInt(summary['Email sent'])}</td>
                                </tr>
                                <tr>
                                    <th>Email Opened</th>
                                    <td>{fmtInt(summary['Email opened'])}</td>
                                </tr>
                                <tr>
                                    <th>Email Clicked</th>
                                    <td>{fmtInt(summary['Email clicked'])}</td>
                                </tr>
                                <tr>
                                    <th>Email Delivered</th>
                                    <td>{fmtInt(summary['Email delivered'])}</td>
                                </tr>
                                <tr>
                                    <th>Email Unsubscribed</th>
                                    <td>{fmtInt(summary['Email unsubscribed'])}</td>
                                </tr>
                                <tr>
                                    <th>Email Bounced</th>
                                    <td>{fmtInt(summary['Email bounced'])}</td>
                                </tr>
                                <tr>
                                    <th>Hard Bounce</th>
                                    <td>{fmtInt(summary['Email hard bounce'])}</td>
                                </tr>
                                <tr>
                                    <th>Soft Bounce</th>
                                    <td>{fmtInt(summary['Email soft bounce'])}</td>
                                </tr>
                                <tr>
                                    <th>Email Open Rate</th>
                                    <td>{fmtPct(summary['Email_open_rate'])}</td>
                                </tr>
                                <tr>
                                    <th>Email Click Rate</th>
                                    <td>{fmtPct(summary['Email_click_rate'])}</td>
                                </tr>
                                <tr>
                                    <th>Email Delivery Rate</th>
                                    <td>{fmtPct(summary['Email_delivery_rate'])}</td>
                                </tr>
                                <tr>
                                    <th>Email Unsubscribed Rate</th>
                                    <td>{fmtPct(summary['Email_unsubscribed_rate'])}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Charts */}
                <div className="grid-2">
                    <ChartCard title="Daily Campaign Trend">
                        <ResponsiveContainer>
                            <LineChart data={lineData}>
                                <XAxis dataKey="day" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line dataKey="sent" stroke="#64748b" strokeWidth={2} />
                                <Line dataKey="opened" stroke="#3b82f6" strokeWidth={2} />
                                <Line dataKey="clicked" stroke="#f59e0b" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard title="Campaign Engagement Rates">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={distributionPieData}
                                    dataKey="value"
                                    nameKey="metric"
                                    innerRadius={55}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    label={({ name, value }) => `${name} ${value}%`}
                                >
                                    {distributionPieData.map((_, i) => (
                                        <Cell
                                            key={i}
                                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                                        />
                                    ))}
                                </Pie>

                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 8,
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>
            </div>
        </>
    )
}

/* ======================================================
   Small UI components
====================================================== */
function KpiCard({ label, value, color = "#2680eb", icon }) {
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
            {/* gradient */}
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
            </div>
        </div>
    );
}

function ChartCard({ title, children }) {
    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">{title}</span>
            </div>
            <div style={{ height: 320, padding: 16 }}>{children}</div>
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
        <td>
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
        </td>
    )
}