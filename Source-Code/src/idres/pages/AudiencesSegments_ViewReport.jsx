import React, { useEffect, useMemo, useState } from 'react'
import {
  AddReportSelector,
  ContractStrip,
  EvidenceDrawer,
  formatCompact,
  formatCount,
  formatCurrency,
  formatPercent,
  KpiCard,
  KpiGrid,
  Panel,
  REPORT_COLORS,
  ReportHero,
  ReportState,
  safePercent,
  sourceLabel,
  useReportingSource,
} from '../reporting/ReportPrimitives'
import { fetchCustomerProfileReport } from '../reporting/profileCompatibility'
import './AudienceReporting.css'

const SOURCE_INDUSTRY = {
  media: 'Media & OTT',
  sports: 'Sports',
  automotive: 'Automotive',
  telecom: 'Telecom',
}

const SIGNAL_COLORS = [
  REPORT_COLORS.blue,
  REPORT_COLORS.cyan,
  REPORT_COLORS.violet,
]

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeSource(value) {
  return String(value || '').trim().toLowerCase()
}

function segmentDefinitionKey(segment) {
  const segmentId = String(segment?.segment_id || segment?.id || '').trim()
  if (segmentId) return segmentId
  return `${normalizeSource(segment?.source_system) || 'all'}:${String(segment?.name || '').trim().toLowerCase()}`
}

function readBrowserCustomSegments() {
  try {
    const segments = JSON.parse(window.localStorage.getItem('cdp_custom_segments') || '[]')
    return Array.isArray(segments) ? segments : []
  } catch {
    return []
  }
}

function cleanLabel(value) {
  return String(value || 'Unallocated')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

function segmentPipelineStatus(segment) {
  return String(
    segment?._pipelineStatus
      ?? segment?.pipeline_status
      ?? segment?.status
      ?? '',
  ).trim()
}

function segmentNameSummary(rows, limit = 3) {
  const visible = rows
    .slice(0, limit)
    .map(row => finiteNumber(row.count) === null
      ? row.name
      : `${row.name} (${formatCount(row.count)})`)
    .join(', ')
  const remaining = rows.length - Math.min(rows.length, limit)
  return `${visible}${remaining > 0 ? `, +${formatCount(remaining)} more` : ''}`
}

function formatArtifactPeriod(from, to, fallback) {
  if (!from || !to) return fallback || 'Current artifact window'
  const parse = value => {
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const start = parse(from)
  const end = parse(to)
  if (!start || !end) return `${from} to ${to}`

  const day = date => new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
  const month = date => new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(date)
  const year = date => new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)

  if (start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()) {
    return `${day(start)}–${day(end)} ${month(end)} ${year(end)}`
  }
  return `${day(start)} ${month(start)} ${year(start)} – ${day(end)} ${month(end)} ${year(end)}`
}

function PanelExplainAction({ label = 'Explain ↗', onClick }) {
  return (
    <button type="button" className="rp-aud-explain-action" onClick={onClick}>
      {label}
    </button>
  )
}

function AudienceReportColumns({
  orderedKeys = [],
  children,
}) {
  const reportsByKey = new Map(
    React.Children.toArray(children)
      .filter(child => React.isValidElement(child) && child.props.reportKey)
      .map(child => [child.props.reportKey, child]),
  )
  const visible = orderedKeys.filter(key => reportsByKey.has(key))

  return (
    <div className="rp-aud-natural-columns">
      {visible.map((key, index) => (
        <div
          className="rp-aud-report-slot"
          data-report-key={key}
          style={{ order: index }}
          key={key}
        >
          {reportsByKey.get(key)}
        </div>
      ))}
    </div>
  )
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${response.status})`)
  }
  return data
}

function PortfolioReachBoard({ rows, universe, largest, onExplain }) {
  const largestTies = rows.filter(row => row.count === largest?.count).length
  return (
    <>
      <div className="rp-aud-reach-board">
        {rows.map((row, index) => (
          <div className="rp-aud-reach-row" key={row.id || row.name}>
            <div className="rp-aud-reach-label">
              <strong title={row.name}>{row.name}</strong>
            </div>
            <div className="rp-aud-reach-track">
              <button
                type="button"
                className="rp-aud-reach-fill"
                style={{
                  '--rp-coverage': `${Math.min(row.coverage, 100)}%`,
                  '--rp-reach': SIGNAL_COLORS[index % SIGNAL_COLORS.length],
                  '--rp-delay': `${index * 80}ms`,
                }}
                title={`${row.name}: ${formatCount(row.count)} provisional members (${formatPercent(row.coverage)})`}
                aria-label={`Explain ${row.name}: ${formatCount(row.count)} provisional members, ${formatPercent(row.coverage)} of the segment-eligible profile universe`}
                onClick={() => onExplain?.(row)}
              />
            </div>
            <div className="rp-aud-reach-value">
              {formatCount(row.count)}
              <small>{formatPercent(row.coverage)} coverage</small>
            </div>
          </div>
        ))}
        <div className="rp-aud-reach-axis" aria-hidden="true">
          <span />
          <div><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
          <span />
        </div>
      </div>
      <p className="rp-aud-caption">
        <strong>{largestTies > 1 ? `${largestTies} segments tie for largest` : 'Largest segment'}:</strong>{' '}
        {`${formatCount(largest.count)} provisional members (${formatPercent(largest.coverage)})`}.
        Counts overlap and are not unique reach across the {formatCount(universe)} segment-eligible profiles.
      </p>
    </>
  )
}

function RevenueContribution({ rows, sourceRevenue, period, overallocated }) {
  const maximum = Math.max(...rows.map(row => row.revenue), 1)
  const denominator = sourceRevenue > 0 ? sourceRevenue : null

  return (
    <>
      <div className="rp-aud-outcome-hero" style={{ '--rp-hero': REPORT_COLORS.green }}>
        <div>
          <span>Attributed campaign revenue</span>
          <b>{formatCurrency(sourceRevenue)}</b>
        </div>
        <small><strong>{period || 'Current artifact window'}</strong><br />Campaign-grain configuration lineage</small>
      </div>
      {rows.length ? (
        <>
          <div className="rp-aud-value-spectrum" aria-label="Revenue contribution spectrum">
            {rows.map((row, index) => (
              <i
                key={`${row.audience}-${row.campaign}-${index}`}
                style={{
                  '--rp-share': `${safePercent(row.revenue, denominator) || 0}%`,
                  '--rp-value': row.color,
                  '--rp-delay': `${index * 80}ms`,
                }}
                title={`${row.audience}: ${formatCurrency(row.revenue)}`}
              />
            ))}
          </div>
          <div className="rp-aud-value-list">
            {rows.map((row, index) => (
              <div className="rp-aud-value-row" key={`${row.audience}-${row.campaign}-${index}`}>
                <div className="rp-aud-value-label">
                  <strong title={row.audience}>{row.audience}</strong>
                  <small title={row.campaign}>{row.campaign}</small>
                </div>
                <div className="rp-aud-value-track">
                  <i
                    className="rp-aud-value-fill"
                    style={{
                      '--rp-width': `${safePercent(row.revenue, maximum) || 0}%`,
                      '--rp-value': row.color,
                      '--rp-delay': `${index * 80}ms`,
                    }}
                  />
                </div>
                <div className="rp-aud-value-number" style={{ '--rp-value': row.color }}>
                  {formatCurrency(row.revenue)}
                  {denominator !== null && (
                    <small>{formatPercent(safePercent(row.revenue, denominator))}</small>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rp-inline-empty">No campaign revenue is available for this source window.</div>
      )}
      <p className={`rp-aud-caption ${overallocated ? 'is-warning' : ''}`}>
        <strong>{overallocated ? 'Reconciliation issue:' : 'Contribution:'}</strong>{' '}
        {overallocated
          ? 'Mapped campaign rows exceed the source revenue total; no ROI or allocation is asserted.'
          : 'Configured segments can overlap, but revenue is assigned once at campaign grain. The unallocated residual preserves the source total.'}
      </p>
    </>
  )
}

function RevenueEfficiency({ rows, sourceRevenue, sourceSends, onExplain }) {
  const sourceEfficiency = sourceRevenue !== null && sourceSends > 0
    ? sourceRevenue * 1000 / sourceSends
    : null
  const measuredRows = rows
    .filter(row => row.revenue !== null && row.sent > 0)
    .map(row => ({ ...row, efficiency: row.revenue * 1000 / row.sent }))
  if (sourceEfficiency === null || !measuredRows.length) return null

  const maximumEfficiency = Math.max(sourceEfficiency || 0, ...measuredRows.map(row => row.efficiency), 1) * 1.08
  const minimumSends = measuredRows.length ? Math.min(...measuredRows.map(row => row.sent)) : 0
  const maximumSends = measuredRows.length ? Math.max(...measuredRows.map(row => row.sent)) : 0
  const maximumRevenue = Math.max(...measuredRows.map(row => row.revenue), 1)
  const benchmark = sourceEfficiency === null ? null : safePercent(sourceEfficiency, maximumEfficiency)

  return (
    <>
      <div className="rp-aud-outcome-hero" style={{ '--rp-hero': REPORT_COLORS.cyan }}>
        <div>
          <span>Source revenue efficiency</span>
          <b>{formatCurrency(sourceEfficiency)}</b>
        </div>
        <small><strong>per 1,000 sends</strong><br />{formatCurrency(sourceRevenue)} ÷ {formatCount(sourceSends)}</small>
      </div>
      {measuredRows.length ? (
        <>
          <div className="rp-aud-efficiency-plot" aria-label="Campaign send volume and revenue efficiency">
            <div className="rp-aud-efficiency-y">
              <span>{formatCurrency(maximumEfficiency)}</span><strong>Revenue / 1K sends</strong><span>$0</span>
            </div>
            <div className="rp-aud-efficiency-stage">
              {benchmark !== null && <i className="rp-aud-efficiency-benchmark" style={{ '--rp-benchmark': `${benchmark}%` }} />}
              {measuredRows.map((row, index) => {
                const x = maximumSends === minimumSends
                  ? 50
                  : 10 + ((row.sent - minimumSends) / (maximumSends - minimumSends)) * 80
                const y = 10 + (row.efficiency / maximumEfficiency) * 76
                const size = 34 + Math.sqrt(row.revenue / maximumRevenue) * 24
                return (
                  <button
                    type="button"
                    className="rp-aud-efficiency-point"
                    key={`${row.campaign_id || row.campaign}-${index}`}
                    style={{
                      '--rp-x': `${x}%`,
                      '--rp-y': `${y}%`,
                      '--rp-size': `${size}px`,
                      '--rp-bubble': row.color,
                      '--rp-delay': `${index * 100}ms`,
                    }}
                    title={`${row.campaign}: ${formatCurrency(row.efficiency)} per 1,000 sends`}
                    aria-label={`Explain ${row.campaign} attributed revenue efficiency`}
                    onClick={() => onExplain?.(row)}
                  >
                    <i><b>{formatCurrency(row.efficiency, true)}</b><small>/ 1K</small></i>
                    <strong>{row.campaign}</strong>
                  </button>
                )
              })}
            </div>
            <div className="rp-aud-efficiency-x">
              <span>{formatCompact(minimumSends)}</span><strong>Campaign send volume</strong><span>{formatCompact(maximumSends)}</span>
            </div>
          </div>
          <div className="rp-aud-efficiency-key">
            <span><i />Bubble size = mapped campaign revenue</span>
            {sourceEfficiency !== null && <b>Dashed line = {formatCurrency(sourceEfficiency)} source benchmark</b>}
          </div>
        </>
      ) : (
        <div className="rp-inline-empty">
          No campaign row has both configured entry-segment lineage and measured sends/revenue.
        </div>
      )}
      <p className="rp-aud-caption">
        <strong>Formula:</strong> mapped campaign revenue ÷ campaign sends × 1,000.
        This is a volume-normalized revenue measure, not ROI.
      </p>
    </>
  )
}

function DuplicateRisk({ rows, totalProfiles }) {
  const normalizedRows = rows
    .map((row, index) => {
      const value = finiteNumber(row?.value)
      if (value === null || value < 0) return null
      return {
        ...row,
        value,
        color: row.color || SIGNAL_COLORS[index % SIGNAL_COLORS.length],
      }
    })
    .filter(Boolean)
  const hasIncompleteBands = normalizedRows.length !== rows.length
  const measuredTotal = normalizedRows.reduce((sum, row) => sum + row.value, 0)
  const expectedTotal = finiteNumber(totalProfiles)

  if (!rows.length) {
    return (
      <div className="rp-inline-empty">
        Duplicate-risk distribution requires the dedicated customer-profile reporting route.
        No risk bands are inferred from summary totals.
      </div>
    )
  }

  if (
    hasIncompleteBands
    || measuredTotal <= 0
    || (expectedTotal !== null && expectedTotal !== measuredTotal)
  ) {
    return (
      <div className="rp-inline-empty">
        Duplicate-risk distribution is unavailable because its measured bands do not form a complete,
        reconciled profile population. Missing band values are not displayed as zero.
      </div>
    )
  }

  let offset = 0
  const arcs = normalizedRows.map(row => {
    const share = safePercent(row.value, measuredTotal) || 0
    const arc = {
      ...row,
      share,
      offset,
    }
    offset += share
    return arc
  })
  const highRisk = arcs.find(row => String(row.label).toLowerCase() === 'high')

  return (
    <>
      <div className="rp-aud-risk-layout">
        <div className="rp-aud-risk-ring">
          <svg viewBox="0 0 174 174" role="img" aria-label="Duplicate profile risk distribution">
            <circle cx="87" cy="87" r="62" fill="none" stroke="#17263c" strokeWidth="16" />
            {arcs.map((row, index) => (
              <circle
                key={row.label}
                className="rp-aud-risk-arc"
                cx="87"
                cy="87"
                r="62"
                pathLength="100"
                style={{ '--rp-risk': row.color, '--rp-delay': `${index * 110}ms` }}
                strokeDasharray={`${row.share} ${Math.max(100 - row.share, 0)}`}
                strokeDashoffset={-row.offset}
              />
            ))}
          </svg>
          <div className="rp-aud-risk-center">
            <b>{formatCount(measuredTotal)}</b><span>golden profiles</span>
          </div>
        </div>
        <div className="rp-aud-risk-legend">
          {arcs.map(row => (
            <div className="rp-aud-risk-row" key={row.label} style={{ '--rp-risk': row.color }}>
              <i /><span>{row.label}</span>
              <b>{formatCount(row.value)}<small>{formatPercent(row.share)}</small></b>
            </div>
          ))}
        </div>
      </div>
      <div className="rp-aud-risk-spectrum">
        {arcs.map((row, index) => (
          <i
            key={row.label}
            style={{
              '--rp-share': `${row.share}%`,
              '--rp-risk': row.color,
              '--rp-delay': `${index * 100}ms`,
            }}
          />
        ))}
      </div>
      <p className="rp-aud-caption">
        <strong>High-risk proxy:</strong>{' '}
        {highRisk
          ? `${formatCount(highRisk.value)} profiles (${formatPercent(highRisk.share)}) have at least one weak incident match.`
          : 'No high-risk band was supplied.'}{' '}
        This is source-level match-confidence exposure, not confirmed segment-level duplicate incidence.
        {totalProfiles && totalProfiles !== measuredTotal ? ' The supplied risk bands do not reconcile to the profile total.' : ''}
      </p>
    </>
  )
}

function EngagementComparison({
  rows,
  sourceClickRate,
}) {
  const measuredRows = rows.filter(row => row.clickRate !== null)
  if (!measuredRows.length) return null

  const leader = measuredRows
    .slice()
    .sort((left, right) => right.clickRate - left.clickRate)[0]
  const maximum = Math.max(sourceClickRate || 0, ...measuredRows.map(row => row.clickRate), 1) * 1.08
  const benchmark = sourceClickRate === null ? null : safePercent(sourceClickRate, maximum)

  return (
    <>
      <div className="rp-aud-outcome-hero" style={{ '--rp-hero': REPORT_COLORS.magenta }}>
        <div>
          <span>Top segment engagement</span>
          <b>{formatPercent(leader.clickRate)}</b>
        </div>
        <small><strong>{leader.audience}</strong><br />{leader.campaign}</small>
      </div>
      <div className="rp-aud-engagement-chart">
        {measuredRows.map((row, index) => {
          const delta = sourceClickRate === null ? null : row.clickRate - sourceClickRate
          return (
            <div className="rp-aud-engagement-row" key={`${row.campaign_id || row.campaign}-${index}`}>
              <span title={`${row.audience} · ${row.campaign}`}>
                {row.audience}<small>{row.campaign}</small>
              </span>
              <div
                className="rp-aud-lollipop"
                style={{ '--rp-benchmark': benchmark === null ? '-100%' : `${benchmark}%` }}
              >
                <i
                  style={{
                    '--rp-position': `${safePercent(row.clickRate, maximum) || 0}%`,
                    '--rp-metric': row.color,
                    '--rp-delay': `${index * 90}ms`,
                  }}
                />
              </div>
              <b style={{ '--rp-metric': row.color }}>
                {formatPercent(row.clickRate)}
                <small>{delta === null ? 'Measured campaign click rate' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pp vs source`}</small>
              </b>
            </div>
          )
        })}
      </div>
      <div className="rp-aud-engagement-axis" aria-hidden="true">
        <span />
        <div>
          <span>0%</span>
          <strong>{sourceClickRate === null ? 'Campaign click-rate scale' : `Dashed = ${formatPercent(sourceClickRate)} source click rate`}</strong>
          <span>{formatPercent(maximum)}</span>
        </div>
        <span />
      </div>
      <p className="rp-aud-caption">
        <strong>Displayed measure:</strong> each mapped campaign&apos;s reported click rate, labelled with its configured
        entry segment. This is measured engagement, not person-level segment conversion.
      </p>
    </>
  )
}

function AudienceOpportunities({ rows }) {
  return (
    <div className="rp-aud-readiness-legend">
      {rows.map(row => (
        <div className="rp-aud-readiness-item" key={row.key} style={{ '--rp-item': row.color }}>
          <i />
          <span>{row.title}<small>{row.detail}</small></span>
          <b>{row.metric}<small>{row.action}</small></b>
        </div>
      ))}
    </div>
  )
}

function AudienceEvidenceTable({ rows }) {
  const hasWorkflowStatus = rows.some(row => row.pipelineStatus)
  return (
    <div className="rp-aud-table-scroll">
      <table className="rp-aud-table">
        <thead>
          <tr>
            <th>Segment</th>
            <th>Customers</th>
            <th>Universe coverage</th>
            {hasWorkflowStatus && <th>Workflow status</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id || row.name}>
              <td>
                <strong>{row.name}</strong>
                <small>
                  {row.definition_type === 'custom'
                    ? `${row.definition_origin || 'Custom segment'} · ${row.source_scope || 'Current reporting scope'}`
                    : 'Source-filtered prebuilt definition'}
                </small>
              </td>
              <td>{formatCount(row.count)}</td>
              <td>{formatPercent(row.coverage)}</td>
              {hasWorkflowStatus && <td>{row.pipelineStatus || 'Not published'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AudiencesSegments_ViewReport() {
  const source = useReportingSource('media')
  const [state, setState] = useState({
    loading: true,
    error: '',
    segments: null,
    journey: null,
    profiles: null,
    journeyError: '',
    profileError: '',
  })
  const [reloadKey, setReloadKey] = useState(0)
  const [evidenceDetail, setEvidenceDetail] = useState(null)
  const [selectedReports, setSelectedReports] = useState([])
  const [browserCustomSegments, setBrowserCustomSegments] = useState(readBrowserCustomSegments)

  useEffect(() => {
    setEvidenceDetail(null)
    setSelectedReports([])
  }, [source])

  useEffect(() => {
    const refreshBrowserCustomSegments = () => setBrowserCustomSegments(readBrowserCustomSegments())
    refreshBrowserCustomSegments()
    window.addEventListener('focus', refreshBrowserCustomSegments)
    window.addEventListener('storage', refreshBrowserCustomSegments)
    return () => {
      window.removeEventListener('focus', refreshBrowserCustomSegments)
      window.removeEventListener('storage', refreshBrowserCustomSegments)
    }
  }, [source])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState(current => ({ ...current, loading: true, error: '' }))
    const industry = SOURCE_INDUSTRY[source]

    Promise.allSettled([
      fetchJson(`/api/segments?source=${encodeURIComponent(source)}&industry=${encodeURIComponent(industry)}`, controller.signal),
      fetchJson(`/api/segment/list?source=${encodeURIComponent(source)}`, controller.signal),
      fetchJson(`/api/copilot/campaigns-journeys/report?source_system=${encodeURIComponent(source)}`, controller.signal),
      fetchCustomerProfileReport(source, controller.signal),
    ]).then(results => {
      if (!active) return
      const [segmentResult, customSegmentResult, journeyResult, profileResult] = results
      if (segmentResult.status === 'rejected') throw segmentResult.reason
      if (customSegmentResult.status === 'rejected') throw customSegmentResult.reason

      const segments = {
        ...segmentResult.value,
        custom_segments: asArray(customSegmentResult.value?.segments),
      }
      const journey = journeyResult.status === 'fulfilled' ? journeyResult.value : null
      const profiles = profileResult.status === 'fulfilled' ? profileResult.value : null
      const segmentRows = asArray(segments?.segments)
      const selectedSegmentRows = segmentRows.filter(
        segment => normalizeSource(segment?.source_system) === source,
      )
      if (segmentRows.length && !selectedSegmentRows.length) {
        throw new Error('The segment catalog contains no definitions for the selected source system.')
      }
      if (journey && normalizeSource(journey.source_system) !== source) {
        throw new Error('The campaign reporting API returned data for a different source system.')
      }
      if (profiles && normalizeSource(profiles.source_system) !== source) {
        throw new Error('The profile reporting API returned data for a different source system.')
      }
      const segmentUniverse = finiteNumber(segments?.total_records)
      const profileUniverse = finiteNumber(profiles?.summary?.total_profiles)
      const limitedAttributeProfiles = finiteNumber(profiles?.summary?.limited_attribute_profiles)
      const segmentEligibleProfileUniverse = (
        profileUniverse !== null
        && limitedAttributeProfiles !== null
        && limitedAttributeProfiles >= 0
        && limitedAttributeProfiles <= profileUniverse
      )
        ? profileUniverse - limitedAttributeProfiles
        : null
      if (selectedSegmentRows.length && (segmentUniverse === null || segmentUniverse <= 0)) {
        throw new Error('The segment membership API did not provide a valid source-universe denominator.')
      }
      if (
        profiles?.data_available !== false
        && segmentUniverse !== null
        && segmentEligibleProfileUniverse !== null
        && segmentUniverse !== segmentEligibleProfileUniverse
      ) {
        throw new Error('Segment membership does not reconcile with the segment-eligible customer-profile universe.')
      }

      setState({
        loading: false,
        error: '',
        segments,
        journey,
        profiles,
        journeyError: journeyResult.status === 'rejected'
          ? journeyResult.reason?.message || 'Campaign outcomes are unavailable.'
          : '',
        profileError: profileResult.status === 'rejected'
          ? profileResult.reason?.message || 'Profile risk evidence is unavailable.'
          : '',
      })
    }).catch(error => {
      if (!active || error?.name === 'AbortError') return
      setState({
        loading: false,
        error: error?.message || 'Unable to load segment reporting.',
        segments: null,
        journey: null,
        profiles: null,
        journeyError: '',
        profileError: '',
      })
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [source, reloadKey])

  const model = useMemo(() => {
    const profileAvailable = Boolean(state.profiles && state.profiles.data_available !== false)
    const prebuiltSegmentRows = asArray(state.segments?.segments)
      .filter(segment => normalizeSource(segment.source_system) === source)
      .map(segment => ({ ...segment, definition_type: 'prebuilt' }))
    const customSegmentRows = [
      ...asArray(state.segments?.custom_segments),
      ...browserCustomSegments.map(segment => ({
        ...segment,
        definition_origin: segment.definition_origin || 'Browser-saved custom segment',
        source_scope: segment.source_scope || (
          normalizeSource(segment.source_system)
            ? 'Source-scoped custom definition'
            : 'Global custom definition'
        ),
      })),
    ]
      .filter(segment => {
        const segmentSource = normalizeSource(segment.source_system)
        return segmentSource === source
      })
      .map(segment => ({
        ...segment,
        count: segment.count ?? segment._count ?? segment.total ?? segment._total,
        channel: segment.channel ?? segment.channels ?? [],
        definition_type: 'custom',
      }))
    const segmentRowMap = new Map()
    ;[...prebuiltSegmentRows, ...customSegmentRows].forEach(segment => {
      const key = segmentDefinitionKey(segment)
      if (key && !segmentRowMap.has(key)) segmentRowMap.set(key, segment)
    })
    const segmentRows = [...segmentRowMap.values()]
    const prebuiltSegmentCount = finiteNumber(state.segments?.prebuilt_segment_count)
      ?? prebuiltSegmentRows.length
    const prebuiltSegmentKeys = new Set(prebuiltSegmentRows.map(segmentDefinitionKey).filter(Boolean))
    const customSegmentKeys = new Set(
      customSegmentRows
        .map(segmentDefinitionKey)
        .filter(key => key && !prebuiltSegmentKeys.has(key)),
    )
    const customSegmentCount = customSegmentKeys.size
    const reportedSegmentTotal = prebuiltSegmentCount + customSegmentCount
    const segmentUniverse = finiteNumber(state.segments?.total_records)
    const profileUniverse = finiteNumber(state.profiles?.summary?.total_profiles)
    const universe = segmentUniverse ?? profileUniverse
    const browserStatusByKey = new Map(
      browserCustomSegments
        .filter(segment => normalizeSource(segment.source_system) === source)
        .map(segment => [segmentDefinitionKey(segment), segmentPipelineStatus(segment)])
        .filter(([key, status]) => key && status),
    )
    const segmentDefinitions = segmentRows.map(segment => {
      const pipelineStatus = segmentPipelineStatus(segment)
        || browserStatusByKey.get(segmentDefinitionKey(segment))
        || ''
      return {
        ...segment,
        pipelineStatus,
        isDraft: pipelineStatus.toLowerCase() === 'draft',
      }
    })
    const draftSegments = segmentDefinitions.filter(segment => segment.isDraft)
    const pipelineStatusCoverage = segmentDefinitions.filter(segment => segment.pipelineStatus).length
    const segments = segmentDefinitions
      .map(segment => {
        const count = finiteNumber(segment.count)
        if (count === null || count < 0) return null
        const coverage = safePercent(count, universe) || 0
        return {
          ...segment,
          count,
          coverage,
        }
      })
      .filter(Boolean)
      .sort((left, right) => right.count - left.count || String(left.name).localeCompare(String(right.name)))
    const invalidSegmentCount = segmentRows.length - segments.length
    const populated = segments.filter(segment => segment.count > 0)
    const portfolioRows = populated.slice(0, 5)
    const largest = populated[0] || null
    const lowCustomerSegments = universe > 0
      ? segments.filter(segment => segment.count > 0 && segment.coverage < 5)
      : []

    const summary = state.journey?.summary || {}
    const sourceRevenue = finiteNumber(summary.revenue)
    const sourceSends = finiteNumber(summary.total_sent)
    const sourceClickRate = finiteNumber(summary.click_rate)
    const sourceConversions = finiteNumber(summary.total_conversions)
    const sourceConversionRate = finiteNumber(summary.conversion_rate)
      ?? safePercent(sourceConversions, sourceSends)
    const campaigns = asArray(state.journey?.campaign_performance)
    const mappedOutcomes = campaigns
      .map(campaign => ({
        ...campaign,
        resolved_entry_audience: campaign.entry_audience,
      }))
      .filter(campaign => String(campaign.resolved_entry_audience || '').trim())
      .map((campaign, index) => ({
        ...campaign,
        audience: cleanLabel(campaign.resolved_entry_audience),
        campaign: campaign.campaign || campaign.journey || campaign.campaign_id || `Campaign ${index + 1}`,
        sent: finiteNumber(campaign.sent),
        revenue: finiteNumber(campaign.revenue),
        clickRate: finiteNumber(campaign.click_rate),
        color: SIGNAL_COLORS[index % SIGNAL_COLORS.length],
      }))
    const mappedRevenue = mappedOutcomes.reduce(
      (sum, row) => row.revenue === null ? sum : sum + row.revenue,
      0,
    )
    const hasMappedRevenue = mappedOutcomes.some(row => row.revenue !== null)
    const measuredEngagement = mappedOutcomes.filter(row => row.clickRate !== null)
    const belowBenchmark = sourceClickRate === null
      ? []
      : measuredEngagement.filter(row => row.clickRate < sourceClickRate)
    const engagementLeader = measuredEngagement
      .slice()
      .sort((left, right) => right.clickRate - left.clickRate)[0] || null
    const residual = sourceRevenue === null ? null : Math.max(sourceRevenue - mappedRevenue, 0)
    const overallocated = sourceRevenue !== null && mappedRevenue > sourceRevenue + 0.01
    const revenueRows = mappedOutcomes
      .filter(row => row.revenue !== null)
      .map(row => ({
        audience: row.audience,
        campaign: row.campaign,
        revenue: row.revenue,
        color: row.color,
      }))
    if (residual > 0) {
      revenueRows.push({
        audience: 'Unallocated campaign revenue',
        campaign: mappedOutcomes.length
          ? 'Source total not represented by mapped detailed campaign rows'
          : 'Campaign revenue not linked to a configured segment',
        revenue: residual,
        color: REPORT_COLORS.amber,
      })
    }

    const dateRange = state.journey?.date_range || {}
    const period = formatArtifactPeriod(dateRange.from, dateRange.to, dateRange.label)
    const opportunities = []
    if (draftSegments.length > 0) {
      opportunities.push({
        key: 'draft',
        title: 'Draft segments awaiting completion',
        detail: `${segmentNameSummary(draftSegments)}. These segments have an explicitly saved Draft status.`,
        metric: formatCount(draftSegments.length),
        action: 'Complete rules, review, and activation setup',
        color: REPORT_COLORS.violet,
      })
    }
    if (lowCustomerSegments.length > 0) {
      opportunities.push({
        key: 'low-customer-count',
        title: 'Segments with low customer counts',
        detail: `${segmentNameSummary(lowCustomerSegments)}. Each contains less than 5% of the segment-eligible profile universe.`,
        metric: formatCount(lowCustomerSegments.length),
        action: 'Review filters, source coverage, or consolidation',
        color: REPORT_COLORS.cyan,
      })
    }
    if (residual > 0 && sourceRevenue !== null) {
      opportunities.push({
        key: 'revenue-lineage',
        title: 'Revenue awaiting segment linkage',
        detail: 'Reported campaign revenue remains outside configured journey-entry segment mappings.',
        metric: formatCurrency(residual),
        action: 'Complete campaign-to-segment lineage',
        color: REPORT_COLORS.blue,
      })
    }
    if (opportunities.length < 3 && engagementLeader) {
      opportunities.push({
        key: 'leader',
        title: 'Top performing segment',
        detail: `${engagementLeader.audience} leads measured mapped campaigns by click rate.`,
        metric: formatPercent(engagementLeader.clickRate),
        action: 'Reuse the winning message pattern',
        color: REPORT_COLORS.cyan,
      })
    }
    if (opportunities.length < 3 && largest) {
      opportunities.push({
        key: 'scale',
        title: 'Largest addressable segment',
        detail: `${largest.name} is the largest current segment definition by reported members.`,
        metric: formatCount(largest.count),
        action: 'Prioritize activation capacity checks',
        color: REPORT_COLORS.cyan,
      })
    }

    return {
      profileAvailable,
      universe,
      profileUniverse,
      segmentDefinitionCount: reportedSegmentTotal,
      prebuiltSegmentCount,
      customSegmentCount,
      invalidSegmentCount,
      segments,
      populated,
      portfolioRows,
      largest,
      draftSegments,
      pipelineStatusCoverage,
      lowCustomerSegments,
      sourceRevenue,
      sourceSends,
      sourceClickRate,
      sourceConversions,
      sourceConversionRate,
      campaigns,
      mappedOutcomes,
      mappedRevenue,
      hasMappedRevenue,
      measuredEngagement,
      belowBenchmark,
      engagementLeader,
      residual,
      revenueRows,
      overallocated,
      period,
      opportunities,
      duplicateRisk: asArray(state.profiles?.duplicate_risk),
    }
  }, [state, source, browserCustomSegments])

  const audienceReportAvailability = useMemo(() => {
    const duplicateRiskTotal = model.duplicateRisk.reduce(
      (sum, row) => sum + (finiteNumber(row?.value) || 0),
      0,
    )
    return {
      size: model.segments.length > 0,
      performance: model.measuredEngagement.length > 0,
      revenue: model.sourceRevenue !== null && model.revenueRows.length > 0,
      opportunities: model.opportunities.length > 0,
      efficiency: model.sourceRevenue !== null
        && model.sourceSends > 0
        && model.mappedOutcomes.some(row => row.revenue !== null && row.sent > 0),
      identityRisk: model.duplicateRisk.length > 0
        && model.duplicateRisk.every(row => finiteNumber(row?.value) !== null)
        && duplicateRiskTotal > 0
        && (model.profileUniverse === null || duplicateRiskTotal === model.profileUniverse),
      portfolio: model.portfolioRows.length > 0,
    }
  }, [model])

  const audienceAvailabilityKey = Object.entries(audienceReportAvailability)
    .filter(([, available]) => available)
    .map(([key]) => key)
    .join('|')

  useEffect(() => {
    const available = new Set(audienceAvailabilityKey.split('|').filter(Boolean))
    setSelectedReports(current => current.filter(key => available.has(key)))
  }, [audienceAvailabilityKey])

  if (state.loading) {
    return (
      <div className="rp-report" data-page="audiences">
        <ReportState title={`Loading ${sourceLabel(source)} segment evidence`}>
          Reading source-scoped segment membership, campaign outcomes, and identity-risk artifacts.
        </ReportState>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="rp-report" data-page="audiences">
        <ReportState type="error" title="Segment report unavailable" onRetry={() => setReloadKey(value => value + 1)}>
          {state.error}
        </ReportState>
      </div>
    )
  }

  if (!model.segments.length && !model.campaigns.length) {
    return (
      <div className="rp-report" data-page="audiences">
        <ReportState type="empty" title={`No segment artifacts for ${sourceLabel(source)}`}>
          Create or load source-scoped segment definitions to populate this report.
        </ReportState>
      </div>
    )
  }

  const hasSegmentData = model.segments.length > 0
  const hasEngagement = model.measuredEngagement.length > 0
  const hasRevenue = model.sourceRevenue !== null && model.revenueRows.length > 0
  const kpiColumns = Math.min(
    3,
    1
      + (model.largest ? 1 : 0)
      + (model.hasMappedRevenue ? 1 : 0),
  )
  const hasDuplicateRisk = audienceReportAvailability.identityRisk
  const hasRevenueEfficiency = audienceReportAvailability.efficiency
  const audiencePrimaryReports = [
    {
      key: 'size',
      label: 'Top Segments',
      purpose: 'Ranks the largest current segments by customer count and shows their share of the segment-eligible profile universe.',
    },
    {
      key: 'performance',
      label: 'Top-Performing & Underperforming Segments',
      purpose: 'Compares measured click rates to identify the top-performing segments and the segments below the source benchmark.',
    },
    {
      key: 'revenue',
      label: 'Revenue by Segment',
      purpose: 'Connects reported campaign revenue to configured entry segments and keeps unlinked revenue visible.',
    },
    {
      key: 'opportunities',
      label: 'Segment Opportunities & Actions',
      purpose: 'Calls out saved Draft segments, segments with low customer counts, and other measured gaps that need action.',
    },
  ].filter(report => audienceReportAvailability[report.key])
  const audienceOptionalReports = [
    {
      key: 'efficiency',
      label: 'Revenue per 1,000 Messages',
      purpose: 'Normalizes segment-linked revenue by send volume for a fairer campaign comparison; it is not ROI.',
    },
    {
      key: 'identityRisk',
      label: 'Profile Identity Quality Warnings',
      purpose: 'Shows measured identity-confidence exposure that may affect activation quality.',
    },
    {
      key: 'portfolio',
      label: 'Segment Portfolio Details',
      purpose: 'Provides segment-level customer counts, source coverage, and saved workflow status when that status is available.',
    },
  ].filter(report => audienceReportAvailability[report.key])
  const visibleAudienceReports = [
    ...audiencePrimaryReports,
    ...audienceOptionalReports.filter(report => selectedReports.includes(report.key)),
  ]
  const segmentEvidenceName = 'Segments API + custom segment inventory'
  const journeyEvidenceName = 'Campaign & Journey Reporting API'
  const profileEvidenceName = 'Customer Profile Reporting API'
  const audienceEvidence = detail => {
    const {
      evidenceStatus = 'Observed',
      window = 'Current artifact set',
      artifact = segmentEvidenceName,
      grain = 'Segment definition',
      scope = `${sourceLabel(source)} source-scoped segment reporting`,
      freshness = 'Current artifact set · source as-of timestamp not published',
      provenance,
      ...content
    } = detail
    return {
      ...content,
      provenance: [
        { label: 'Evidence status', value: evidenceStatus },
        ...(Array.isArray(provenance) ? provenance : [
          { label: 'Selected source', value: sourceLabel(source) },
          { label: 'Scope', value: scope },
          { label: 'Reporting window', value: window },
          { label: 'Freshness', value: freshness },
          { label: 'API / artifact', value: artifact },
          { label: 'Evidence grain', value: grain },
        ]),
      ],
    }
  }
  const openAudienceEvidence = detail => setEvidenceDetail(audienceEvidence(detail))
  const explanation = (
    <>
      <p>
        This report helps a marketer decide which segments are ready to use, which are engaging customers, which are
        associated with reported revenue, and what should be reviewed next. It uses only the current measured data for
        {` ${sourceLabel(source)}`}; unsupported KPIs and empty charts are not shown.
      </p>
      <h4>What the visible reports mean</h4>
      <ul>
        {visibleAudienceReports.map(report => (
          <li key={report.key}><strong>{report.label}:</strong> {report.purpose}</li>
        ))}
      </ul>
    </>
  )

  return (
    <div className="rp-report" data-page="audiences">
      <ReportHero
        eyebrow="Segment portfolio · current source evidence"
        score="Live"
        scoreLabel="source snapshot"
        color={REPORT_COLORS.blue}
        title="Segment business summary"
        summary={`${sourceLabel(source)} has ${formatCount(model.segmentDefinitionCount)} segment definitions: ${formatCount(model.prebuiltSegmentCount)} prebuilt and ${formatCount(model.customSegmentCount)} custom.`}
        tags={['Current measured counts', 'Prebuilt + custom', 'Overlapping memberships']}
        explanation={explanation}
        evidence={audienceEvidence({
          evidenceStatus: 'Observed segment counts + derived coverage',
          calculation: [
            `total segments = prebuilt segments + custom segments\n${formatCount(model.prebuiltSegmentCount)} + ${formatCount(model.customSegmentCount)} = ${formatCount(model.segmentDefinitionCount)}`,
            model.largest && model.universe !== null ? `largest-segment coverage = ${formatCount(model.largest.count)} / ${formatCount(model.universe)} × 100\n= ${formatPercent(model.largest.coverage)}` : null,
            hasRevenue ? `segment-linked revenue = sum(reported campaign revenue where a journey-entry segment is configured)\n= ${formatCurrency(model.mappedRevenue)}\nunallocated revenue = ${formatCurrency(model.sourceRevenue)} − ${formatCurrency(model.mappedRevenue)}\n= ${formatCurrency(model.residual)}` : null,
          ].filter(Boolean).join('\n\n'),
          businessInsight: [
            model.largest ? `${model.largest.name} is the largest current segment with ${formatCount(model.largest.count)} customers.` : null,
            model.engagementLeader ? `${model.engagementLeader.audience} leads the measured segment-linked campaigns at ${formatPercent(model.engagementLeader.clickRate)} click rate.` : null,
            hasRevenue && model.residual > 0 ? `${formatCurrency(model.residual)} of reported campaign revenue still needs campaign-to-segment linkage.` : null,
            model.opportunities.length ? `Recommended next actions: ${model.opportunities.slice(0, 3).map(row => row.action).join('; ')}.` : null,
          ].filter(Boolean).join(' '),
          provenance: [
            { label: 'Selected source', value: sourceLabel(source) },
            { label: 'Scope', value: `${sourceLabel(source)} segment portfolio` },
            { label: 'Reporting window', value: 'Current artifact set' },
            { label: 'Freshness', value: 'Source as-of timestamp not published' },
            { label: 'Segment membership API', value: segmentEvidenceName },
            { label: 'Campaign outcome API', value: journeyEvidenceName },
            ...(model.profileAvailable
              ? [{ label: 'Profile-risk API', value: profileEvidenceName }]
              : []),
            { label: 'Evidence scope', value: model.universe !== null
              ? `${formatCount(model.segmentDefinitionCount)} definitions · ${formatCount(model.universe)} segment-eligible profiles`
              : `${formatCount(model.segmentDefinitionCount)} segment definitions` },
            { label: 'Evidence grain', value: model.profileAvailable
              ? 'Segment definition, campaign row, and golden profile'
              : 'Segment definition and campaign row' },
          ],
          callout: 'Memberships can overlap. Counts are reported per segment and are not added together as unique reach.',
        })}
      />

      <KpiGrid columns={kpiColumns}>
        <KpiCard
          label="Total Segments"
          value={formatCount(model.segmentDefinitionCount)}
          detail={`${formatCount(model.prebuiltSegmentCount)} prebuilt + ${formatCount(model.customSegmentCount)} custom`}
          color={REPORT_COLORS.cyan}
          evidence="View evidence"
          onClick={() => openAudienceEvidence({
            title: 'Total Segments',
            evidenceStatus: 'Observed · current segment inventory',
            meaning: `${formatCount(model.segmentDefinitionCount)} distinct segment definitions are reported for ${sourceLabel(source)}, combining the prebuilt library with persisted custom definitions.`,
            calculation: `total segments = prebuilt segments + custom segments\n${formatCount(model.prebuiltSegmentCount)} + ${formatCount(model.customSegmentCount)} = ${formatCount(model.segmentDefinitionCount)}`,
            businessInsight: 'Use this count to understand portfolio breadth and keep the segment catalog focused and manageable.',
            artifact: segmentEvidenceName,
            grain: 'Segment definition',
            caveat: 'This counts definitions, not unique customers. Custom definitions without a reliable source assignment are excluded from source-specific totals; segment memberships can overlap.',
          })}
        />
        {model.largest && (
          <KpiCard
            label="Largest Segment"
            value={formatCount(model.largest.count)}
            detail={model.largest.name}
            color={REPORT_COLORS.blue}
            evidence="View evidence"
            onClick={() => openAudienceEvidence({
              title: 'Largest Segment',
              evidenceStatus: 'Observed count · derived maximum',
              meaning: `${model.largest.name} has the largest reported member count for ${sourceLabel(source)}.`,
              calculation: `largest segment = max(valid source-scoped member count)\n= ${formatCount(model.largest.count)}`,
              businessInsight: 'Use this segment for scale planning and destination-capacity checks.',
              artifact: segmentEvidenceName,
              grain: 'Segment definition + current member count',
              caveat: 'Membership can overlap with other segments.',
            })}
          />
        )}
        {model.hasMappedRevenue && (
          <KpiCard
            label="Revenue linked to segments"
            value={formatCurrency(model.mappedRevenue)}
            detail={`${formatCount(model.revenueRows.filter(row => row.audience !== 'Unallocated campaign revenue').length)} mapped campaign rows`}
            color={REPORT_COLORS.violet}
            evidence="View evidence"
            onClick={() => openAudienceEvidence({
              title: 'Revenue linked to segments',
              evidenceStatus: 'Observed campaign revenue + configured segment lineage',
              window: model.period,
              meaning: `${formatCurrency(model.mappedRevenue)} in reported campaign revenue is linked to configured journey-entry segments.`,
              calculation: `linked revenue = sum(revenue for campaign rows with configured journey-entry segment)\n= ${formatCurrency(model.mappedRevenue)}`,
              businessInsight: 'Use this KPI to understand how much reported campaign value can currently be viewed by segment.',
              artifact: journeyEvidenceName,
              grain: 'Campaign row + configured journey-entry segment',
              caveat: 'This is reported attribution, not incremental lift or ROI.',
            })}
          />
        )}
      </KpiGrid>

      <AudienceReportColumns
        orderedKeys={audiencePrimaryReports.map(report => report.key)}
      >
        {hasSegmentData && (
          <Panel
            reportKey="size"
            className="rp-aud-revenue-panel rp-aud-size-panel"
            title="Top Segments"
            subtitle="Largest current segments ranked by customer count."
            action={(
              <PanelExplainAction
                label="Explain top segments ↗"
                onClick={() => openAudienceEvidence({
                  title: 'Top Segments',
                  evidenceStatus: 'Observed current member counts + derived coverage',
                  meaning: `The ${formatCount(model.portfolioRows.length)} largest measured ${sourceLabel(source)} segments are ranked by current customer count. Each segment is compared with the same ${formatCount(model.universe)} segment-eligible profiles.`,
                  calculation: `segment coverage = reported segment customers / segment-eligible profile universe × 100\nsegments displayed = ${formatCount(model.portfolioRows.length)} highest valid customer counts`,
                  businessInsight: 'Use this report to identify the segments with enough scale for activation planning and to compare their relative reach.',
                  artifact: segmentEvidenceName,
                  grain: 'Segment definition + current member count',
                  caveat: 'Segment memberships can overlap, so the displayed counts must not be added together as unique reach.',
                })}
              />
            )}
          >
            {model.portfolioRows.length > 0 && (
              <PortfolioReachBoard
                rows={model.portfolioRows}
                universe={model.universe}
                largest={model.largest}
                onExplain={row => openAudienceEvidence({
                  title: row.name,
                  evidenceStatus: 'Observed count · derived coverage',
                  meaning: `${row.name} contains ${formatCount(row.count)} reported customers, equal to ${formatPercent(row.coverage)} of the ${formatCount(model.universe)} segment-eligible profiles.`,
                  calculation: `coverage = reported segment members / segment-eligible profile universe\n${formatCount(row.count)} / ${formatCount(model.universe)} = ${formatPercent(row.coverage)}`,
                  businessInsight: 'Use this comparison to judge relative segment scale and prioritize activation planning.',
                  artifact: segmentEvidenceName,
                  grain: 'Segment definition + current member count',
                  caveat: 'Membership can overlap with other segments.',
                })}
              />
            )}
          </Panel>
        )}

        {hasRevenue && (
          <Panel
            reportKey="revenue"
            className="rp-aud-revenue-panel rp-aud-revenue-breakdown-panel"
            title="Revenue by Segment"
            subtitle="Reported campaign revenue connected to each configured journey-entry segment."
            action={(
              <PanelExplainAction
                label="Explain revenue ↗"
                onClick={() => openAudienceEvidence({
                  title: 'Revenue by segment',
                  evidenceStatus: 'Observed campaign revenue + configured segment lineage',
                  window: model.period,
                  meaning: 'This chart links each campaign’s reported revenue to the segment configured as the journey entry point. Any residual remains visible as unallocated campaign revenue.',
                  calculation: `linked segment revenue = ${formatCurrency(model.mappedRevenue)}\nreported source revenue = ${formatCurrency(model.sourceRevenue)}\nunallocated residual = ${formatCurrency(model.residual)}`,
                  businessInsight: 'Use this report to see which configured segments are associated with reported value and where campaign-to-segment attribution still needs completion.',
                  artifact: journeyEvidenceName,
                  grain: 'Campaign row + configured journey-entry segment',
                  caveat: 'This is reported attribution, not incremental segment lift, CLV, or ROI.',
                })}
              />
            )}
          >
            <RevenueContribution
              rows={model.revenueRows}
              sourceRevenue={model.sourceRevenue}
              period={model.period}
              overallocated={model.overallocated}
            />
          </Panel>
        )}

        {hasEngagement && (
          <Panel
            reportKey="performance"
            className="rp-aud-engagement-panel"
            title="Top-Performing & Underperforming Segments"
            subtitle="Measured campaign click rate by configured journey-entry segment."
            action={(
              <PanelExplainAction
                label="Explain performance ↗"
                onClick={() => openAudienceEvidence({
                  title: 'Top-Performing & Underperforming Segments',
                  evidenceStatus: 'Observed campaign click rates + configured segment lineage',
                  window: model.period,
                  meaning: `The chart compares ${formatCount(model.measuredEngagement.length)} measured campaign click rates after each campaign is labelled with its configured journey-entry segment.`,
                  calculation: `campaign click rate = clicked campaign events / delivered campaign events\nhighest measured rate = ${model.engagementLeader.audience} · ${model.engagementLeader.campaign} = ${formatPercent(model.engagementLeader.clickRate)}`,
                  businessInsight: 'Use this report to find the segments and campaign combinations that are engaging customers and those that need creative, offer, or timing changes.',
                  artifact: journeyEvidenceName,
                  grain: 'Campaign row + configured journey-entry segment',
                  caveat: 'This is measured campaign engagement, not causal segment lift or person-level conversion.',
                })}
              />
            )}
          >
            <EngagementComparison
              rows={model.mappedOutcomes}
              sourceClickRate={model.sourceClickRate}
            />
          </Panel>
        )}

        {false && (
          <Panel
            className="rp-aud-revenue-panel"
            title="Revenue by Segment"
            subtitle="Reported campaign revenue connected to each configured journey-entry segment."
            action={(
              <PanelExplainAction
                label="Explain revenue ↗"
                onClick={() => openAudienceEvidence({
                  title: 'Revenue by segment',
                  evidenceStatus: 'Observed campaign revenue + configured segment lineage',
                  window: model.period,
                  meaning: 'This chart links each campaign’s reported revenue to the segment configured as the journey entry point. Any residual remains visible as unallocated campaign revenue.',
                  calculation: `linked segment revenue = ${formatCurrency(model.mappedRevenue)}\nreported source revenue = ${formatCurrency(model.sourceRevenue)}\nunallocated residual = ${formatCurrency(model.residual)}`,
                  businessInsight: 'Use this report to see which configured segments are associated with reported value and where campaign-to-segment attribution still needs completion.',
                  artifact: journeyEvidenceName,
                  grain: 'Campaign row + configured journey-entry segment',
                  caveat: 'This is reported attribution, not incremental segment lift, CLV, or ROI.',
                })}
              />
            )}
          >
            <RevenueContribution
              rows={model.revenueRows}
              sourceRevenue={model.sourceRevenue}
              period={model.period}
              overallocated={model.overallocated}
            />
          </Panel>
        )}

        {model.opportunities.length > 0 && (
          <Panel
            reportKey="opportunities"
            className="rp-aud-readiness-panel"
            title="Segment Opportunities & Actions"
            subtitle="Data-backed actions for Draft segments, customer counts below 5% of the segment-eligible universe, and measured lineage gaps."
            action={(
              <PanelExplainAction
                label="Explain actions ↗"
                onClick={() => openAudienceEvidence({
                  title: 'Segment opportunities and actions',
                  evidenceStatus: 'Derived only from displayed measured signals',
                  window: model.period,
                  meaning: `The report turns ${formatCount(model.opportunities.length)} current segment-status, customer-count, or revenue-lineage signals into plain-language actions.`,
                  calculation: `${model.pipelineStatusCoverage > 0
                    ? `draft signal = count(definitions whose persisted pipeline status equals Draft) = ${formatCount(model.draftSegments.length)}\nstatus coverage = ${formatCount(model.pipelineStatusCoverage)} of ${formatCount(model.segmentDefinitionCount)} source-scoped definitions`
                    : 'draft signal is not displayed because the current API/browser evidence contains no persisted pipeline status'}\n\nlow-customer signal = count(positive segment memberships below 5% of the segment-eligible profile universe) = ${formatCount(model.lowCustomerSegments.length)}\nrevenue-lineage signal = reported source revenue minus mapped segment revenue`,
                  businessInsight: 'Finish explicitly Draft segments first, then review segments with small source-relative membership to decide whether filters, source coverage, or consolidation should change.',
                  artifact: `${segmentEvidenceName} + ${journeyEvidenceName}`,
                  grain: 'Segment definition and mapped campaign row',
                  caveat: 'Actions are diagnostic recommendations from current measured facts, not causal conclusions.',
                })}
              />
            )}
          >
            <AudienceOpportunities rows={model.opportunities} />
            {model.pipelineStatusCoverage < model.segmentDefinitionCount && (
              <p className="rp-aud-caption is-warning">
                <strong>Draft-status coverage:</strong>{' '}
                {model.pipelineStatusCoverage > 0
                  ? `${formatCount(model.pipelineStatusCoverage)} of ${formatCount(model.segmentDefinitionCount)} definitions publish a saved workflow status.`
                  : 'The current APIs do not publish a saved workflow status for these definitions.'}
                {' '}Definitions without that evidence are not assumed to be Active or Draft.
              </p>
            )}
          </Panel>
        )}
      </AudienceReportColumns>

      <AddReportSelector
        reports={audienceOptionalReports}
        selected={selectedReports}
        onAdd={key => setSelectedReports(current => (
          current.includes(key) ? current : [...current, key]
        ))}
        onRemove={key => setSelectedReports(current => current.filter(item => item !== key))}
        title="Add another segment report"
        description="Choose a populated supporting segment report. It will be added below the main business reports."
      />

      {selectedReports.length > 0 && (
        <div className="rp-aud-market-grid">
            {selectedReports.includes('efficiency') && hasRevenueEfficiency && (
              <Panel
                className="rp-aud-roi-panel"
                title="Revenue per 1,000 Messages"
                subtitle="Reported segment-linked campaign revenue normalized by send volume."
              >
                <RevenueEfficiency
                  rows={model.mappedOutcomes}
                  sourceRevenue={model.sourceRevenue}
                  sourceSends={model.sourceSends}
                  onExplain={row => openAudienceEvidence({
                    title: `${row.campaign} revenue per 1,000 messages`,
                    evidenceStatus: 'Derived from reported campaign revenue and sends',
                    window: model.period,
                    meaning: `${row.campaign} reports ${formatCurrency(row.efficiency)} in attributed revenue per 1,000 sends.`,
                    calculation: `${formatCurrency(row.revenue)} / ${formatCount(row.sent)} × 1,000 = ${formatCurrency(row.efficiency)}`,
                    businessInsight: 'Use this measure to compare segment-linked campaigns on the same message-volume basis.',
                    artifact: journeyEvidenceName,
                    grain: 'Campaign row + configured journey-entry segment',
                    caveat: 'This is not ROI because campaign spend is not part of the calculation.',
                  })}
                />
              </Panel>
            )}
            {selectedReports.includes('identityRisk') && hasDuplicateRisk && (
              <Panel
                className="rp-aud-risk-panel"
                title="Profile Identity Quality Warnings"
                subtitle="Measured source-level identity-confidence exposure before activation."
              >
                <DuplicateRisk rows={model.duplicateRisk} totalProfiles={model.profileUniverse} />
              </Panel>
            )}
            {selectedReports.includes('portfolio') && audienceReportAvailability.portfolio && (
              <Panel
                className="rp-aud-intent-panel"
                title="Segment Portfolio Details"
                subtitle="Current customers, source-universe coverage, and saved workflow status when available."
              >
                <AudienceEvidenceTable rows={model.portfolioRows} />
              </Panel>
            )}
        </div>
      )}


      <ContractStrip status="Data-backed reporting">
        Every visible KPI and report is supported by the selected source&apos;s current segment, campaign, or
        customer-profile artifact. Segment counts remain source-scoped and may overlap.
        {model.invalidSegmentCount > 0 && (
          <> {formatCount(model.invalidSegmentCount)} definitions without a measured member count are excluded from the visuals.</>
        )}
      </ContractStrip>
      <EvidenceDrawer detail={evidenceDetail} onClose={() => setEvidenceDetail(null)} />
    </div>
  )
}
