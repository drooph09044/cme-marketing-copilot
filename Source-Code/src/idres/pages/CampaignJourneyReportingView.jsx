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
import './CampaignJourneyReporting.css'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function formatRuntimeCount(value) {
  return formatCount(value, 'N/A')
}

function formatRuntimeCompact(value) {
  return formatCompact(value, 'N/A')
}

function formatRuntimePercent(value) {
  return formatPercent(value, 1, 'N/A')
}

function formatRuntimeCurrency(value, compact = false) {
  return formatCurrency(value, compact, 'N/A')
}

function plotPercent(value, total) {
  return safePercent(value, total) ?? 0
}

function hasOwn(record, key) {
  return Boolean(record) && Object.prototype.hasOwnProperty.call(record, key)
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || data?.message || `Request failed (${response.status})`)
  return data
}

function InlineEmpty({ children = 'No measured rows are available.' }) {
  return <div className="rp-inline-empty">{children}</div>
}

function EvidenceAction({ label = 'Explain ↗', onClick }) {
  return (
    <button type="button" className="rp-cj-explain-action" onClick={onClick}>
      {label}
    </button>
  )
}

function CampaignReportColumns({
  primaryKeys = [],
  optionalKeys = [],
  weights = {},
  selector = null,
  children,
}) {
  const reportsByKey = new Map(
    React.Children.toArray(children)
      .filter(child => React.isValidElement(child) && child.props.reportKey)
      .map(child => [child.props.reportKey, child]),
  )
  const renderColumns = (keys, group) => {
    const visible = keys.filter(key => reportsByKey.has(key))
    if (!visible.length) return null
    if (group === 'primary') {
      return (
        <div className="rp-cj-paired-grid" data-report-group="primary">
          {visible.map((key, index) => (
            <div
              className="rp-cj-report-slot"
              data-report-key={key}
              style={{ order: index }}
              key={`primary-${key}`}
            >
              {reportsByKey.get(key)}
            </div>
          ))}
        </div>
      )
    }
    const columns = [[], []]
    const totals = [0, 0]
    visible.forEach((key, index) => {
      const target = totals[0] <= totals[1] ? 0 : 1
      const weight = Number(weights[key]) || 1
      columns[target].push({ key, index })
      totals[target] += weight
    })
    const renderColumn = column => (
      <div className="rp-cj-report-column">
        {columns[column].map(item => (
            <div
              className="rp-cj-report-slot"
              data-report-key={item.key}
              style={{ order: item.index }}
              key={`${group}-${item.key}`}
            >
              {reportsByKey.get(item.key)}
            </div>
          ))}
      </div>
    )
    return (
      <div className="rp-cj-natural-columns" data-report-group={group}>
        {renderColumn(0)}
        {renderColumn(1)}
      </div>
    )
  }

  return (
    <>
      {renderColumns(primaryKeys, 'primary')}
      {selector}
      {renderColumns(optionalKeys, 'optional')}
    </>
  )
}

function AnalyticsStrip({ sent, summary, conversionRate, onExplain }) {
  const rows = [
    ['Target Population', sent, formatRuntimeCompact(sent), 'Reported sends · repeat recipients possible', REPORT_COLORS.blue, 'sends'],
    ['Open rate', summary.open_rate, formatRuntimePercent(summary.open_rate), 'Opened / delivered', REPORT_COLORS.cyan, 'open_rate'],
    ['Click rate', summary.click_rate, formatRuntimePercent(summary.click_rate), 'Clicked / delivered', REPORT_COLORS.violet, 'click_rate'],
    ['Conversion rate', conversionRate, formatRuntimePercent(conversionRate), 'Converted / sent', REPORT_COLORS.magenta, 'conversion_rate'],
  ].filter(([, rawValue]) => finite(rawValue) !== null)
  if (!rows.length) return null
  return (
    <section className="rp-cj-analytics" aria-label="Journey analytics headline measures">
      {rows.map(([label, , value, detail, color, key]) => (
        <article key={label} style={{ '--rp-signal': color }}>
          <span>{label}</span>
          <b>{value}</b>
          <small>{detail}</small>
          <button
            type="button"
            className="rp-cj-analytics-evidence"
            aria-label={`Explain ${label}`}
            onClick={() => onExplain?.(key)}
          >
            Evidence
          </button>
        </article>
      ))}
    </section>
  )
}

function JourneyFlow({ rows, sent }) {
  if (!rows.length) return <InlineEmpty>No journey funnel outcome evidence is available for this source.</InlineEmpty>
  const entry = finite(sent) ?? rows[0].value
  const width = 998
  const nodeWidth = 142
  const left = 12
  const usable = width - (left * 2) - nodeWidth
  const nodeX = rows.map((_, index) => left + (rows.length === 1 ? 0 : (usable * index) / (rows.length - 1)))
  return (
    <div className="rp-cj-flow-wrap">
      <svg className="rp-cj-flow-svg" viewBox="0 0 998 285" role="img" aria-label="Customer Journey Funnel">
        <line className="rp-cj-flow-guide" x1="12" y1="263" x2="986" y2="263" />
        {rows.slice(1).map((row, index) => {
          const fromX = nodeX[index] + nodeWidth
          const toX = nodeX[index + 1]
          const overall = plotPercent(row.value, entry)
          return (
            <g key={`link-${row.label}`} style={{ '--rp-signal': row.color, '--rp-delay': `${index * 120}ms` }}>
              <path className="rp-cj-flow-link" d={`M${fromX},113 C${fromX + 25},113 ${toX - 25},113 ${toX},113`} style={{ '--rp-width': Math.min(30, 7 + overall * .22) }} />
              <path className="rp-cj-flow-core" d={`M${fromX},113 C${fromX + 25},113 ${toX - 25},113 ${toX},113`} />
            </g>
          )
        })}
        {rows.map((row, index) => {
          const previous = index ? rows[index - 1].value : entry
          const retained = index ? safePercent(row.value, previous) : 100
          return (
            <g key={row.label} className="rp-cj-flow-node" style={{ '--rp-signal': row.color, '--rp-delay': `${120 + index * 100}ms` }}>
              <rect x={nodeX[index]} y="72" width={nodeWidth} height="82" rx="13" />
              <text className="rp-cj-stage-name" x={nodeX[index] + 15} y="94">{row.label}</text>
              <text className="rp-cj-stage-count" x={nodeX[index] + 15} y="120">{formatCompact(row.value)}</text>
              <text className="rp-cj-stage-rate" x={nodeX[index] + 15} y="141">{index ? `${formatRuntimePercent(retained)} of prior stage` : 'Funnel entry'}</text>
            </g>
          )
        })}
        {rows.slice(1).map((row, index) => {
          const previous = rows[index]
          const lost = Math.max(previous.value - row.value, 0)
          const lossRate = safePercent(lost, previous.value)
          const center = (nodeX[index] + nodeWidth + nodeX[index + 1]) / 2
          const y = 194 + (index % 2) * 32
          return (
            <g key={`drop-${row.label}`} className="rp-cj-drop">
              <line x1={center} y1="155" x2={center} y2={y} />
              <rect x={center - 43} y={y} width="86" height="25" rx="7" />
              <text x={center} y={y + 16} textAnchor="middle">−{formatRuntimeCompact(lost)} · {formatRuntimePercent(lossRate)}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ChannelRing({ rows, sent }) {
  if (!rows.length) return <InlineEmpty>No channel distribution is available for this source.</InlineEmpty>
  const ranked = rows.slice().sort((a, b) => b.value - a.value)
  const total = ranked.reduce((sum, row) => sum + row.value, 0)
  if (total <= 0) return <InlineEmpty>Channel share is N/A because the supplied channel counts do not contain a positive represented total.</InlineEmpty>
  const headlineSent = finite(sent)
  let offset = 0
  return (
    <>
      <div className="rp-cj-channel-layout">
        <div className="rp-cj-channel-ring">
          <svg viewBox="0 0 176 176" aria-label="Channel mix">
            <circle cx="88" cy="88" r="62" pathLength="100" className="rp-cj-channel-track" />
            {ranked.map((row, index) => {
              const share = plotPercent(row.value, total)
              const currentOffset = offset
              offset -= share
              return (
                <circle
                  key={row.label}
                  cx="88"
                  cy="88"
                  r="62"
                  pathLength="100"
                  className="rp-cj-channel-arc"
                  style={{
                    '--rp-signal': row.color,
                    '--rp-dash': share,
                    '--rp-offset': currentOffset,
                    '--rp-delay': `${index * 110}ms`,
                  }}
                >
                  <title>{row.label}: {formatCount(row.value)} ({formatPercent(share)})</title>
                </circle>
              )
            })}
          </svg>
          <div>
            <b>{formatRuntimeCompact(headlineSent ?? total)}</b>
            <span>{headlineSent === null ? 'Represented sends' : 'Total sends'}</span>
          </div>
        </div>
        <div className="rp-cj-channel-rank">
          {ranked.map(row => (
            <div key={row.label} style={{ '--rp-signal': row.color }}>
              <i />
              <span><strong>{row.label}</strong><small>{formatCount(row.value)} sends</small></span>
              <b>{formatRuntimePercent(safePercent(row.value, total))}</b>
            </div>
          ))}
        </div>
      </div>
      <p className="rp-cj-caption"><strong>Largest channel:</strong> {ranked[0].label} at {formatRuntimePercent(safePercent(ranked[0].value, total))} ({formatRuntimeCount(ranked[0].value)} sends).</p>
    </>
  )
}

function ValueEfficiency({ campaigns, summary, coverage = {}, onExplain }) {
  const sourceRevenue = finite(summary.revenue)
  const sourceSends = finite(summary.total_sent)
  const sourceEfficiency = sourceRevenue !== null && sourceSends !== null && sourceSends > 0
    ? sourceRevenue / sourceSends * 1000
    : null
  const rows = campaigns
    .map((row, index) => {
      const revenue = finite(row.revenue)
      const sent = finite(row.sent)
      if (revenue === null || sent === null || sent <= 0) return null
      return { ...row, index, revenue, sent, efficiency: revenue / sent * 1000 }
    })
    .filter(Boolean)
    .sort((a, b) => b.efficiency - a.efficiency)
  if (!rows.length) {
    return <InlineEmpty>Revenue efficiency is unavailable because no supplied campaign outcome row contains both revenue and a positive send count.</InlineEmpty>
  }
  const max = Math.max(...(sourceEfficiency === null ? [] : [sourceEfficiency]), ...rows.map(row => row.efficiency), 1)
  const roundedMax = Math.ceil(max / 100) * 100
  const benchmark = sourceEfficiency === null ? null : safePercent(sourceEfficiency, roundedMax)
  const palette = {
    Email: REPORT_COLORS.blue,
    Push: REPORT_COLORS.cyan,
    'In-App': REPORT_COLORS.violet,
    SMS: REPORT_COLORS.green,
    WhatsApp: REPORT_COLORS.green,
    Call: REPORT_COLORS.amber,
  }
  return (
    <>
      <div className="rp-cj-value-board">
        <div className="rp-cj-value-axis">
          <span>Campaign outcome evidence for journey reporting</span>
          <div>
            {benchmark !== null && <i style={{ left: `${benchmark}%` }}>Benchmark {formatRuntimeCurrency(sourceEfficiency)}</i>}
            <b style={{ left: 0 }}>0</b>
            <b style={{ left: '100%' }}>{formatRuntimeCurrency(roundedMax)}</b>
          </div>
          <span>Attributed revenue / 1K sends</span>
        </div>
        {rows.map((row, index) => {
          const color = palette[row.channel] || Object.values(REPORT_COLORS)[index % Object.values(REPORT_COLORS).length]
          return (
            <article key={row.campaign_id || row.campaign} className={String(row.status).toLowerCase() === 'paused' ? 'is-paused' : ''} style={{ '--rp-signal': color, '--rp-delay': `${index * 90}ms` }}>
              <div className="rp-cj-value-label">
                <strong title={row.campaign}>{row.campaign}</strong>
                {(row.channel || row.status) && <span>{[row.channel, row.status].filter(Boolean).join(' · ')}</span>}
                {[row.open_rate, row.click_rate, row.bounce_rate].some(value => finite(value) !== null) && (
                  <div>
                    {finite(row.open_rate) !== null && <small>Open <b>{formatRuntimePercent(row.open_rate)}</b></small>}
                    {finite(row.click_rate) !== null && <small>Click <b>{formatRuntimePercent(row.click_rate)}</b></small>}
                    {finite(row.bounce_rate) !== null && <small>Bounce <b>{formatRuntimePercent(row.bounce_rate)}</b></small>}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`rp-cj-value-track${benchmark === null ? ' has-no-benchmark' : ''}`}
                style={benchmark === null ? undefined : { '--rp-benchmark': `${benchmark}%` }}
                title={`${row.campaign}: ${formatRuntimeCurrency(Math.round(row.efficiency))} attributed revenue per 1,000 sends`}
                aria-label={`Explain ${row.campaign} attributed revenue efficiency`}
                onClick={() => onExplain?.(row)}
              >
                <i style={{ '--rp-value': `${plotPercent(row.efficiency, roundedMax)}%` }} />
              </button>
              <div className="rp-cj-value-result">
                <b>{formatRuntimeCurrency(Math.round(row.efficiency))} / 1K</b>
                <small>{formatRuntimeCurrency(row.revenue, true)} attributed · {formatRuntimeCompact(row.sent)} sends</small>
              </div>
            </article>
          )
        })}
      </div>
      <p className="rp-cj-caption"><strong>Efficiency leader among the {rows.length} measurable campaign outcome rows:</strong> {rows[0].campaign} at {formatRuntimeCurrency(Math.round(rows[0].efficiency))} attributed revenue per 1,000 sends. These campaign-grain outcomes are supporting evidence for journey reporting; they cover {formatRuntimePercent(coverage.campaign_send_pct)} of sends and {formatRuntimePercent(coverage.campaign_revenue_pct)} of attributed revenue and are not journey-level ROI or causal lift.</p>
    </>
  )
}

function sparkPoints(observations, totalRows) {
  const values = observations.map(row => row.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  return observations.map(({ value, index }) => {
    const x = index * 360 / Math.max(totalRows - 1, 1)
    const y = 51 - (value - min) * 42 / Math.max(max - min, 1)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
}

function EngagementPulse({ rows, source }) {
  if (!rows.length) return <InlineEmpty>No sampled engagement observations are available.</InlineEmpty>
  const series = [
    ['Delivered', 'delivered', REPORT_COLORS.blue],
    ['Opened', 'opened', REPORT_COLORS.cyan],
    ['Clicked', 'clicked', REPORT_COLORS.magenta],
  ].map(([label, key, color]) => ({
    label,
    key,
    color,
    observations: rows
      .map((row, index) => ({ index, value: finite(row[key]) }))
      .filter(row => row.value !== null),
  })).filter(row => row.observations.length)
  if (!series.length) return <InlineEmpty>No measured delivered, opened, or clicked observations are available.</InlineEmpty>
  return (
    <>
      <div className="rp-cj-pulse-stack">
        {series.map(({ label, key, color, observations }, index) => {
          const values = observations.map(row => row.value)
          const points = sparkPoints(observations, rows.length)
          const id = `rp-cj-pulse-${source}-${key}`
          return (
            <div key={key} className="rp-cj-pulse-row" style={{ '--rp-signal': color, '--rp-delay': `${index * 120}ms` }}>
              <div><strong>{label}</strong><span>Independent scale</span></div>
              <svg viewBox="0 0 360 58" preserveAspectRatio="none" aria-label={`${label} sampled trend`}>
                <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".72" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
                <path className="rp-cj-pulse-area" d={`M0,58 L${points.join(' L')} L360,58 Z`} style={{ fill: `url(#${id})` }} />
                <polyline className="rp-cj-pulse-line" points={points.join(' ')} />
              </svg>
              <b>{formatRuntimeCompact(values.at(-1))}<small>{formatRuntimeCompact(Math.min(...values))}–{formatRuntimeCompact(Math.max(...values))}</small></b>
            </div>
          )
        })}
      </div>
      <div className="rp-cj-pulse-axis">{rows.map((row, index) => <span key={`${row.label}-${index}`}>{row.label}</span>)}</div>
      <p className="rp-cj-caption"><strong>Sampled observations:</strong> the points show direction and are not summed into headline totals.</p>
    </>
  )
}

function MetricHeatmap({ campaigns }) {
  if (!campaigns.length) return null
  const columns = [
    ['Delivery', row => finite(row.delivered_rate) ?? safePercent(row.delivered, row.sent), REPORT_COLORS.green, value => formatRuntimePercent(value)],
    ['Open', row => finite(row.open_rate), REPORT_COLORS.cyan, value => formatRuntimePercent(value)],
    ['Click', row => finite(row.click_rate), REPORT_COLORS.blue, value => formatRuntimePercent(value)],
    ['Bounce', row => finite(row.bounce_rate), REPORT_COLORS.amber, value => formatRuntimePercent(value)],
    ['Revenue', row => finite(row.revenue), REPORT_COLORS.violet, value => formatRuntimeCurrency(value, true)],
  ].filter(([, accessor]) => campaigns.every(row => accessor(row) !== null))
  if (!columns.length) return null
  const ranges = columns.map(([, accessor]) => {
    const values = campaigns.map(accessor).filter(value => value !== null)
    return values.length ? [Math.min(...values), Math.max(...values)] : [null, null]
  })
  return (
    <>
      <div className="rp-cj-heatmap-scroll">
        <div className="rp-cj-heatmap">
          <div className="rp-cj-heat-head">Campaign evidence</div>
          {columns.map(([label]) => <div key={label} className="rp-cj-heat-head">{label}</div>)}
          {campaigns.map((row, rowIndex) => (
            <React.Fragment key={row.campaign_id || row.campaign}>
              <div className="rp-cj-heat-label">
                <strong>{row.campaign}</strong>
                {(row.channel || row.status) && <small>{[row.channel, row.status].filter(Boolean).join(' · ')}</small>}
              </div>
              {columns.map(([label, accessor, color, formatter], columnIndex) => {
                const value = accessor(row)
                const [min, max] = ranges[columnIndex]
                const available = value !== null && min !== null && max !== null
                const normalized = available ? (value - min) / Math.max(max - min, 1) : null
                return (
                  <div
                    key={`${row.campaign}-${label}`}
                    className={`rp-cj-heat-cell${available ? '' : ' is-unavailable'}`}
                    style={available ? {
                      '--rp-signal': color,
                      '--rp-intensity': `${14 + normalized * 30}%`,
                      '--rp-delay': `${(rowIndex * columns.length + columnIndex) * 25}ms`,
                    } : { '--rp-delay': `${(rowIndex * columns.length + columnIndex) * 25}ms` }}
                  >
                    {formatter(value)}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <p className="rp-cj-caption"><strong>Color intensity is column-relative:</strong> compare supplied campaigns within a metric and use the printed value for exact interpretation.</p>
    </>
  )
}

function DefinitionLibrary({ catalog }) {
  const maxTouchpoints = Math.max(...catalog.touchpointDistribution.map(row => row.value), 1)
  const triggerTotal = catalog.triggerTypes.reduce((sum, row) => sum + row.value, 0)
  return (
    <>
      <div className="rp-cj-data-note rp-cj-provenance-note">
        <strong>Definition provenance:</strong> {catalog.provenance}.{' '}
        Only measured API catalog fields are displayed.
      </div>
      <div className="rp-cj-library">
        {catalog.triggerTypes.length > 0 && <div>
          <span className="rp-cj-library-subtitle">Definitions by trigger type</span>
          {catalog.triggerTypes.length ? (
            <>
              <div className="rp-cj-library-bar">
                {catalog.triggerTypes.map((row, index) => (
                  <i key={row.label} style={{ '--rp-share': `${plotPercent(row.value, triggerTotal)}%`, '--rp-signal': row.color, '--rp-delay': `${index * 100}ms` }} />
                ))}
              </div>
              <div className="rp-cj-library-legend">
                {catalog.triggerTypes.map(row => (
                  <div key={row.label} style={{ '--rp-signal': row.color }}><i /><span>{row.label}</span><b>{formatCount(row.value)} · {formatRuntimePercent(safePercent(row.value, triggerTotal))}</b></div>
                ))}
              </div>
            </>
          ) : <InlineEmpty>Trigger-type distribution is N/A in the selected definition catalog.</InlineEmpty>}
        </div>}
        {catalog.touchpointDistribution.length > 0 && <div>
          <span className="rp-cj-library-subtitle">Definitions by touchpoint count</span>
          {catalog.touchpointDistribution.length ? (
            <div className="rp-cj-touchpoints">
              {catalog.touchpointDistribution.map((row, index) => (
                <i key={row.label} style={{ '--rp-height': `${Math.max(4, plotPercent(row.value, maxTouchpoints))}%`, '--rp-delay': `${index * 80}ms` }}>
                  <b>{formatCount(row.value)}</b><span>{row.label}</span>
                </i>
              ))}
            </div>
          ) : <InlineEmpty>Touchpoint distribution is N/A in the selected definition catalog.</InlineEmpty>}
        </div>}
      </div>
      <div className="rp-cj-data-note">
        <strong>{formatRuntimeCount(catalog.presetDefinitions)} preset files + {formatRuntimeCount(catalog.customDefinitions)} saved custom journey.</strong>
        {' '}{formatRuntimeCount(catalog.readyDefinitions)} presets are READY; the active flag exists on {formatRuntimeCount(catalog.activeFlagCoverage)}/{formatRuntimeCount(catalog.presetDefinitions)}.
      </div>
    </>
  )
}

function ExperimentProof({ catalog, source }) {
  const experiment = catalog.experiment
  if (
    !experiment?.hasSplit
    || experiment.holdout === null
    || experiment.treatment === null
    || experiment.split === null
  ) return null
  const holdoutLabel = `${experiment.holdout}%`
  const treatmentLabel = `${experiment.treatment}%`
  const splitLabel = `${experiment.split}%`
  const complementLabel = `${100 - experiment.split}%`
  const origin = experiment.originCategory || 'Global catalog'
  const sourceMatchesOrigin = String(origin).trim().toLowerCase() === String(source).trim().toLowerCase()
  const evidenceScope = sourceMatchesOrigin
    ? `${origin} saved custom configuration`
    : `${origin} saved custom configuration in the global catalog`
  const declaredEventCount = experiment.declaredEvents.length
  const declaredEventLabel = declaredEventCount
    ? experiment.declaredEvents.join(', ')
    : 'configured outcome signals'
  return (
    <>
      <div className="rp-cj-experiment-wrap">
        <div className="rp-cj-experiment-scroll">
          <svg className="rp-cj-experiment" viewBox="0 0 760 270" role="img" aria-label="Configured experiment routing">
            <path className="rp-cj-exp-link" d="M155 132 C185 132 190 51 220 51" style={{ '--rp-signal': REPORT_COLORS.amber, '--rp-width': 8, '--rp-delay': '50ms' }} />
            <path className="rp-cj-exp-link-core" d="M155 132 C185 132 190 51 220 51" style={{ '--rp-signal': REPORT_COLORS.amber }} />
            <path className="rp-cj-exp-link" d="M155 132 C185 132 190 190 220 190" style={{ '--rp-signal': REPORT_COLORS.blue, '--rp-width': 21, '--rp-delay': '120ms' }} />
            <path className="rp-cj-exp-link-core" d="M155 132 C185 132 190 190 220 190" style={{ '--rp-signal': REPORT_COLORS.blue }} />
            <path className="rp-cj-exp-link" d="M355 190 C385 190 397 137 430 137" style={{ '--rp-signal': REPORT_COLORS.cyan, '--rp-width': 11, '--rp-delay': '200ms' }} />
            <path className="rp-cj-exp-link-core" d="M355 190 C385 190 397 137 430 137" style={{ '--rp-signal': REPORT_COLORS.cyan }} />
            <path className="rp-cj-exp-link" d="M355 190 C385 190 397 224 430 224" style={{ '--rp-signal': REPORT_COLORS.violet, '--rp-width': 11, '--rp-delay': '270ms' }} />
            <path className="rp-cj-exp-link-core" d="M355 190 C385 190 397 224 430 224" style={{ '--rp-signal': REPORT_COLORS.violet }} />
            <path className="rp-cj-exp-link" d="M565 137 C590 137 595 180 620 180" style={{ '--rp-signal': REPORT_COLORS.magenta, '--rp-width': 5, '--rp-delay': '340ms' }} />
            <path className="rp-cj-exp-link" d="M565 224 C590 224 595 180 620 180" style={{ '--rp-signal': REPORT_COLORS.magenta, '--rp-width': 5, '--rp-delay': '390ms' }} />
            {[
              [20, 99, 135, 66, 'ROUTED DESIGNS', formatRuntimeCount(catalog.variantDefinitions), 'variant-defined', REPORT_COLORS.green, true],
              [220, 20, 135, 62, 'CONTROL HOLDOUT', holdoutLabel, 'configured', REPORT_COLORS.amber, false],
              [220, 159, 135, 62, 'TREATMENT PATH', treatmentLabel, 'configured', REPORT_COLORS.blue, false],
              [430, 106, 135, 62, 'VARIANT A', splitLabel, 'of treatment', REPORT_COLORS.cyan, false],
              [430, 193, 135, 62, 'VARIANT B', complementLabel, 'of treatment', REPORT_COLORS.violet, false],
              [620, 144, 120, 72, 'DECLARED EVENTS', formatRuntimeCount(declaredEventCount), 'measurement plan', REPORT_COLORS.magenta, true],
            ].map(([x, y, width, height, kicker, value, detail, color, detailBelow], index) => (
              <g key={kicker} className="rp-cj-exp-node" style={{ '--rp-signal': color, '--rp-delay': `${50 + index * 70}ms` }}>
                <rect x={x} y={y} width={width} height={height} rx="13" />
                <text className="rp-cj-exp-kicker" x={x + 15} y={y + 21}>{kicker}</text>
                <text className="rp-cj-exp-value" x={x + 15} y={y + 44}>{value}</text>
                <text
                  className="rp-cj-exp-detail"
                  x={detailBelow ? x + 15 : x + 54}
                  y={detailBelow ? y + 59 : y + 44}
                >
                  {detail}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="rp-cj-proof-strip">
          {[
            [catalog.variantDefinitions, 'variant-defined journey definitions', REPORT_COLORS.green],
            ...(experiment.assignment
              ? [[1, `saved routed split with ${experiment.assignment}`, REPORT_COLORS.cyan]]
              : []),
            [declaredEventCount, `declared events: ${declaredEventLabel}`, REPORT_COLORS.violet],
          ].filter(([value]) => finite(value) !== null).map(([value, label, color]) => (
            <div key={label} style={{ '--rp-signal': color }}><b>{formatRuntimeCount(value)}</b><span>{label}</span></div>
          ))}
        </div>
        {experiment.toggleOn === false && (
          <div className="rp-cj-exp-conflict"><span><strong>Configuration conflict:</strong> a routed split exists while the saved journey’s A/B toggle is off.</span><b>A/B toggle off · split present</b></div>
        )}
      </div>
      <p className="rp-cj-caption">
        <strong>Configured design, not a live result:</strong> the {holdoutLabel}/{treatmentLabel} allocation,
        {' '}{splitLabel}/{complementLabel} treatment split
        {experiment.outcomeWindowHours !== null ? `, ${experiment.outcomeWindowHours}-hour outcome window` : ''},
        and declared events come from the {evidenceScope}. They are not {sourceLabel(source)} execution evidence.
        This design-readiness view makes no winner, lift, or significance claim.
      </p>
    </>
  )
}

function ActionQueue({ campaigns, funnel }) {
  const drops = funnel.slice(1).map((row, index) => {
    const previous = funnel[index]
    const lost = Math.max(previous.value - row.value, 0)
    return { from: previous.label, to: row.label, lost, rate: safePercent(lost, previous.value) }
  }).filter(row => row.rate !== null)
  const biggestDrop = drops.slice().sort((a, b) => b.rate - a.rate)[0]
  const bestClick = campaigns
    .filter(row => finite(row.click_rate) !== null)
    .sort((a, b) => finite(b.click_rate) - finite(a.click_rate))[0]
  const highBounce = campaigns
    .filter(row => finite(row.bounce_rate) !== null)
    .sort((a, b) => finite(b.bounce_rate) - finite(a.bounce_rate))[0]
  const rows = [
    biggestDrop && ['P1', 'Repair the largest funnel loss', `${biggestDrop.from} to ${biggestDrop.to} loses ${formatCompact(biggestDrop.lost)} events, ${formatPercent(biggestDrop.rate)} of its prior stage.`, `${formatPercent(biggestDrop.rate)} loss`, REPORT_COLORS.magenta],
    bestClick && ['P2', `Learn from ${bestClick.campaign}`, `It leads the ${campaigns.length} supplied campaign outcome rows at ${formatPercent(bestClick.click_rate)} click rate. Use it as a controlled-test pattern for journey optimization.`, `${formatPercent(bestClick.click_rate)} CTR`, REPORT_COLORS.green],
    highBounce && ['P3', Number(highBounce.bounce_rate) >= 4 ? `Review ${highBounce.campaign}` : 'Protect delivery health', `${highBounce.campaign} has the highest supplied-row bounce rate at ${formatPercent(highBounce.bounce_rate)}. Validate eligibility and suppression.`, `${formatPercent(highBounce.bounce_rate)} bounce`, REPORT_COLORS.amber],
  ].filter(Boolean)
  if (!rows.length) return <InlineEmpty>No observed funnel or supporting outcome evidence is available for journey recommendations.</InlineEmpty>
  return (
    <>
      <div className="rp-cj-actions">
        {rows.map(([priority, title, detail, evidence, color]) => (
          <article key={priority} style={{ '--rp-signal': color }}>
            <span>{priority}</span>
            <div><strong>{title}</strong><p>{detail}</p></div>
            <b>{evidence}<small>Current artifact</small></b>
          </article>
        ))}
      </div>
      <div className="rp-cj-data-note"><strong>Optimization guardrail:</strong> actions prioritize supplied measured evidence; they do not promise statistical or causal lift.</div>
    </>
  )
}

function CampaignEvidenceTable({ campaigns, totalCampaigns, coverage = {} }) {
  const measuredRows = campaigns.filter(row => row?.campaign)
  if (!measuredRows.length) return null
  const columns = [
    {
      key: 'channel',
      label: 'Channel',
      available: measuredRows.every(row => Boolean(row.channel)),
      render: row => row.channel,
    },
    {
      key: 'sent',
      label: 'Sends',
      available: measuredRows.every(row => finite(row.sent) !== null),
      render: row => formatRuntimeCount(row.sent),
    },
    {
      key: 'delivery',
      label: 'Delivery',
      available: measuredRows.every(row => (
        finite(row.delivered_rate) !== null
        || safePercent(row.delivered, row.sent) !== null
      )),
      render: row => formatRuntimePercent(
        finite(row.delivered_rate) ?? safePercent(row.delivered, row.sent),
      ),
    },
    {
      key: 'open',
      label: 'Open',
      available: measuredRows.every(row => finite(row.open_rate) !== null),
      render: row => formatRuntimePercent(row.open_rate),
    },
    {
      key: 'click',
      label: 'Click',
      available: measuredRows.every(row => finite(row.click_rate) !== null),
      render: row => formatRuntimePercent(row.click_rate),
    },
    {
      key: 'revenue',
      label: 'Revenue',
      available: measuredRows.every(row => finite(row.revenue) !== null),
      render: row => formatRuntimeCurrency(row.revenue),
    },
    {
      key: 'bounce',
      label: 'Bounce',
      available: measuredRows.every(row => finite(row.bounce_rate) !== null),
      render: row => formatRuntimePercent(row.bounce_rate),
    },
    {
      key: 'status',
      label: 'Status',
      available: measuredRows.every(row => Boolean(row.status)),
      render: row => {
        const statusColor = String(row.status).toLowerCase() === 'live'
          ? REPORT_COLORS.green
          : REPORT_COLORS.amber
        return <span className="rp-cj-status" style={{ '--rp-signal': statusColor }}>{row.status}</span>
      },
    },
  ].filter(column => column.available)
  return (
    <div className="rp-cj-table-wrap">
      <table className="rp-cj-table">
        <thead>
          <tr>
            <th>Campaign outcome / mapped journey</th>
            {columns.map(column => <th key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {measuredRows.map(row => (
            <tr key={row.campaign_id || row.campaign}>
              <td>
                <strong>{row.campaign}</strong>
                {row.journey && <small>{row.journey}</small>}
              </td>
              {columns.map(column => <td key={column.key}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {[
        totalCampaigns,
        coverage.campaign_row_pct,
        coverage.unallocated_sends,
        coverage.unallocated_revenue,
      ].every(value => finite(value) !== null) && (
        <p className="rp-cj-caption"><strong>Evidence coverage:</strong> {formatCount(measuredRows.length)} detailed rows are supplied for {formatRuntimeCount(totalCampaigns)} reported campaigns ({formatRuntimePercent(coverage.campaign_row_pct)}). The residual is {formatRuntimeCompact(coverage.unallocated_sends)} sends and {formatRuntimeCurrency(coverage.unallocated_revenue)} attributed revenue. This is a ranked subset, not the complete inventory.</p>
      )}
    </div>
  )
}

export default function CampaignJourneyReportingView() {
  const source = useReportingSource('media')
  const [state, setState] = useState({ loading: true, error: '', report: null })
  const [reloadKey, setReloadKey] = useState(0)
  const [evidenceDetail, setEvidenceDetail] = useState(null)
  const [selectedReports, setSelectedReports] = useState([])

  useEffect(() => {
    setEvidenceDetail(null)
    setSelectedReports([])
  }, [source])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState(current => ({ ...current, loading: true, error: '' }))
    fetchJson(`/api/copilot/campaigns-journeys/report?source_system=${encodeURIComponent(source)}`, controller.signal)
      .then(report => {
        if (!active) return
        if (report?.source_system !== source) throw new Error('The reporting API returned a different source system.')
        if (String(report?.status || '').toLowerCase() === 'error') throw new Error(report?.message || 'The journey reporting evidence could not be read.')
        if (report?.data_available === false) throw new Error(`No journey reporting evidence is available for ${sourceLabel(source)}.`)
        if (!report?.summary || !Object.keys(report.summary).length) throw new Error(`No journey reporting contract is available for ${sourceLabel(source)}.`)
        if (
          !report?.journey_catalog
          || typeof report.journey_catalog !== 'object'
          || !Object.keys(report.journey_catalog).length
        ) {
          throw new Error('The journey definition catalog is missing from the reporting API contract.')
        }
        setState({ loading: false, error: '', report })
      })
      .catch(error => {
        if (!active || error?.name === 'AbortError') return
        setState({ loading: false, error: error?.message || 'Unable to load journey reporting.', report: null })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [source, reloadKey])

  const catalog = useMemo(() => {
    const apiCatalog = state.report?.journey_catalog
    if (!apiCatalog || typeof apiCatalog !== 'object') return null
    const colors = [REPORT_COLORS.blue, REPORT_COLORS.cyan, REPORT_COLORS.violet, REPORT_COLORS.amber]
    const experiment = apiCatalog.custom_experiment
    const triggerRows = asArray(apiCatalog.trigger_type_distribution)
    const touchpointRows = asArray(apiCatalog.touchpoint_distribution)
    const triggerRowsComplete = triggerRows.length > 0
      && triggerRows.every(row => row?.label && finite(row.value) !== null)
    const touchpointRowsComplete = touchpointRows.length > 0
      && touchpointRows.every(row => row?.label !== undefined && finite(row.value) !== null)
    return {
      provenance: 'API journey catalog',
      presetDefinitions: finite(apiCatalog.preset_definitions),
      customDefinitions: finite(apiCatalog.custom_definitions),
      totalDefinitions: finite(apiCatalog.total_definitions),
      readyDefinitions: finite(apiCatalog.ready_definitions),
      activeFlagCoverage: finite(apiCatalog.active_flag_coverage),
      explicitlyActive: finite(apiCatalog.explicitly_active),
      variantPresetDefinitions: finite(apiCatalog.variant_preset_definitions),
      variantDefinitions: finite(apiCatalog.variant_definitions),
      triggerTypes: (triggerRowsComplete ? triggerRows : [])
        .map((row, index) => ({
          label: row.label,
          value: finite(row.value),
          color: colors[index % colors.length],
        }))
        .filter(row => row.label && row.value !== null),
      touchpointDistribution: (touchpointRowsComplete ? touchpointRows : [])
        .map(row => {
          const count = String(row.label)
          return {
          label: `${count} touchpoint${count === '1' ? '' : 's'}`,
          value: finite(row.value),
          }
        })
        .filter(row => row.value !== null),
      experiment: experiment ? {
        hasSplit: hasOwn(experiment, 'topology_present') ? Boolean(experiment.topology_present) : null,
        toggleOn: hasOwn(experiment, 'ab_toggle') ? Boolean(experiment.ab_toggle) : null,
        holdout: finite(experiment.holdout_pct),
        treatment: finite(experiment.treatment_pct),
        split: finite(experiment.variant_a_pct),
        assignment: experiment.assignment || null,
        declaredEvents: String(experiment.declared_events || '')
          .split(',')
          .map(value => value.trim())
          .filter(Boolean),
        originCategory: experiment.category || 'Global catalog',
        outcomeWindowHours: finite(experiment.outcome_window_hours),
        resultsAvailable: hasOwn(experiment, 'results_available')
          ? Boolean(experiment.results_available)
          : null,
      } : null,
    }
  }, [state.report])

  const model = useMemo(() => {
    const report = state.report || {}
    const summary = report.summary || {}
    const rawFunnel = asArray(report.delivery_funnel)
    const requiredFunnelStages = ['sent', 'delivered', 'opened', 'clicked', 'converted']
    const funnelComplete = rawFunnel.length === requiredFunnelStages.length
      && rawFunnel.every((row, index) => (
        String(row?.stage || '').trim().toLowerCase() === requiredFunnelStages[index]
        && finite(row.value) !== null
      ))
    const funnel = funnelComplete
      ? rawFunnel.map((row, index) => ({
        label: row.stage,
        value: finite(row.value),
        color: [REPORT_COLORS.blue, REPORT_COLORS.cyan, REPORT_COLORS.violet, REPORT_COLORS.magenta, REPORT_COLORS.green][index % 5],
      }))
      : []
    const funnelLookup = Object.fromEntries(funnel.map(row => [String(row.label).toLowerCase(), row.value]))
    const campaigns = asArray(report.campaign_performance)
    const totalSent = finite(summary.total_sent) ?? finite(funnelLookup.sent)
    const totalRevenue = finite(summary.revenue)
    const detailedSendValues = campaigns.map(row => finite(row.sent)).filter(value => value !== null)
    const detailedRevenueValues = campaigns.map(row => finite(row.revenue)).filter(value => value !== null)
    const detailedSends = campaigns.length > 0
      && detailedSendValues.length === campaigns.length
      ? detailedSendValues.reduce((sum, value) => sum + value, 0)
      : null
    const detailedRevenue = campaigns.length > 0
      && detailedRevenueValues.length === campaigns.length
      ? detailedRevenueValues.reduce((sum, value) => sum + value, 0)
      : null
    const totalCampaigns = finite(summary.total_campaigns)
    const fallbackCoverage = {
      campaign_rows: campaigns.length,
      total_campaigns: totalCampaigns,
      campaign_row_pct: safePercent(campaigns.length, totalCampaigns),
      campaign_send_pct: safePercent(detailedSends, totalSent),
      campaign_revenue_pct: safePercent(detailedRevenue, totalRevenue),
      unallocated_sends: totalSent === null || detailedSends === null
        ? null
        : totalSent >= detailedSends
          ? Math.round(totalSent - detailedSends)
          : null,
      unallocated_revenue: totalRevenue === null || detailedRevenue === null
        ? null
        : totalRevenue >= detailedRevenue
          ? totalRevenue - detailedRevenue
          : null,
      journey_rows: asArray(report.journey_performance).length,
      total_journeys: finite(summary.total_journeys),
      journey_row_pct: safePercent(asArray(report.journey_performance).length, finite(summary.total_journeys)),
    }
    return {
      summary,
      funnel,
      funnelLookup,
      trend: asArray(report.performance_trend)
        .map(row => ({
          label: row.date,
          delivered: finite(row.delivered),
          opened: finite(row.opened),
          clicked: finite(row.clicked),
        }))
        .filter(row => row.label && [row.delivered, row.opened, row.clicked].some(value => value !== null)),
      channels: asArray(report.channel_mix).every(row => row?.channel && finite(row.count) !== null)
        ? asArray(report.channel_mix).map((row, index) => ({
          label: row.channel,
          value: finite(row.count),
          color: row.color || [REPORT_COLORS.blue, REPORT_COLORS.green, REPORT_COLORS.violet, REPORT_COLORS.amber][index % 4],
        }))
        : [],
      campaigns,
      detailCoverage: report.detail_coverage && Object.keys(report.detail_coverage).length
        ? report.detail_coverage
        : fallbackCoverage,
      period: report.date_range?.from && report.date_range?.to
        ? `${report.date_range.from} to ${report.date_range.to}`
        : report.date_range?.label || 'Current artifact window',
    }
  }, [state.report])

  const campaignReportAvailability = useMemo(() => {
    const funnel = model.funnel.length > 1
    const representedChannelTotal = model.channels.reduce(
      (sum, row) => sum + (finite(row.value) ?? 0),
      0,
    )
    const campaignRows = model.campaigns.length > 0
    return {
      funnel,
      channels: model.channels.length > 0 && representedChannelTotal > 0,
      valueEfficiency: model.campaigns.some(row => (
        finite(row.sent) !== null
        && finite(row.sent) > 0
        && finite(row.revenue) !== null
      )),
      actions: funnel || model.campaigns.some(row => (
        finite(row.click_rate) !== null || finite(row.bounce_rate) !== null
      )),
      trend: model.trend.length > 0,
      comparison: campaignRows,
      templates: finite(catalog?.totalDefinitions) !== null
        && ((catalog?.triggerTypes?.length || 0) > 0 || (catalog?.touchpointDistribution?.length || 0) > 0),
      experiment: Boolean(
        catalog?.experiment?.hasSplit
        && finite(catalog?.experiment?.holdout) !== null
        && finite(catalog?.experiment?.treatment) !== null
        && finite(catalog?.experiment?.split) !== null
      ),
      details: campaignRows,
    }
  }, [model, catalog])

  const campaignAvailabilityKey = Object.entries(campaignReportAvailability)
    .filter(([, available]) => available)
    .map(([key]) => key)
    .join('|')

  useEffect(() => {
    const available = new Set(campaignAvailabilityKey.split('|').filter(Boolean))
    const optional = new Set(
      ['valueEfficiency', 'channels', 'funnel', 'actions', 'trend', 'comparison', 'templates', 'experiment', 'details']
        .filter(key => available.has(key))
        .slice(4),
    )
    setSelectedReports(current => current.filter(key => optional.has(key)))
  }, [campaignAvailabilityKey])

  if (state.loading) {
    return (
      <div className="rp-report" data-page="journeys">
        <ReportState title={`Loading ${sourceLabel(source)} journey reporting`}>Reading campaign outcome evidence and the journey definition catalog.</ReportState>
      </div>
    )
  }
  if (state.error) {
    return (
      <div className="rp-report" data-page="journeys">
        <ReportState type="error" title="Journey report unavailable" onRetry={() => setReloadKey(value => value + 1)}>{state.error}</ReportState>
      </div>
    )
  }

  const sent = finite(model.summary.total_sent) ?? finite(model.funnelLookup.sent)
  const converted = finite(model.funnelLookup.converted)
  const conversionRate = safePercent(converted, sent)
  const campaignEvidenceName = 'Campaign & Journey Reporting API'
  const journeyCatalogEvidenceName = 'Journey Definition Catalog'
  const campaignEvidence = detail => {
    const {
      evidenceStatus = 'Observed',
      artifact = campaignEvidenceName,
      grain = 'Source + reporting window',
      selectedSource = sourceLabel(source),
      scope = `${sourceLabel(source)} journey reporting from campaign outcome evidence`,
      window = model.period,
      freshness = 'Current artifact set · source as-of timestamp not published',
      provenance,
      ...content
    } = detail
    return {
      ...content,
      provenance: [
        { label: 'Evidence status', value: evidenceStatus },
        ...(Array.isArray(provenance) ? provenance : [
          ...(selectedSource ? [{ label: 'Selected source', value: selectedSource }] : []),
          { label: 'Scope', value: scope },
          { label: 'Reporting window', value: window },
          { label: 'Freshness / version', value: freshness },
          { label: 'API / artifact', value: artifact },
          { label: 'Evidence grain', value: grain },
        ]),
      ],
    }
  }
  const openCampaignEvidence = detail => setEvidenceDetail(campaignEvidence(detail))
  const openAnalyticsEvidence = metric => {
    const delivered = finite(model.funnelLookup.delivered)
    const opened = finite(model.funnelLookup.opened)
    const clicked = finite(model.funnelLookup.clicked)
    const details = {
      sends: {
        title: 'Target Population (message volume)',
        evidenceStatus: 'Observed · current campaign report',
        meaning: `${formatRuntimeCount(sent)} sends are reported for ${sourceLabel(source)} in ${model.period}. The KPI is labelled Target Population for business navigation, but the available source fact is message volume, not a count of unique people.`,
        calculation: `reported sends = source summary sends, reconciled to the funnel entry when available\ncurrent value = ${formatRuntimeCount(sent)}`,
        businessInsight: 'Use this as the addressable communication workload for the reporting window and as the denominator for send-based conversion and value-efficiency measures.',
        artifact: campaignEvidenceName,
        grain: 'Source + reporting window',
        caveat: 'One person can receive multiple sends. This value must not be presented as unique reach or people enrolled.',
      },
      open_rate: {
        title: 'Open rate',
        evidenceStatus: 'Derived from observed funnel counts',
        meaning: `${formatRuntimeCount(opened)} opens are reported from ${formatRuntimeCount(delivered)} delivered messages, producing the displayed ${formatRuntimePercent(model.summary.open_rate)} open rate.`,
        calculation: `open rate = opened / delivered × 100\n${formatRuntimeCount(opened)} / ${formatRuntimeCount(delivered)} × 100 = ${formatRuntimePercent(model.summary.open_rate)}`,
        businessInsight: 'Use open rate to investigate subject line, sender identity, timing, and channel-level attention before optimizing deeper funnel stages.',
        artifact: `${campaignEvidenceName} · delivery funnel`,
        grain: 'Source + reporting window + funnel stage',
        caveat: 'Open tracking can be affected by client privacy behavior and is an engagement signal, not conversion or incremental lift.',
      },
      click_rate: {
        title: 'Click rate',
        evidenceStatus: 'Derived from observed funnel counts',
        meaning: `${formatRuntimeCount(clicked)} clicks are reported from ${formatRuntimeCount(delivered)} delivered messages, producing the displayed ${formatRuntimePercent(model.summary.click_rate)} click rate.`,
        calculation: `click rate = clicked / delivered × 100\n${formatRuntimeCount(clicked)} / ${formatRuntimeCount(delivered)} × 100 = ${formatRuntimePercent(model.summary.click_rate)}`,
        businessInsight: 'Use click rate to assess call-to-action and content engagement, then compare the available campaign outcome evidence to identify where journey creative or targeting review is most valuable.',
        artifact: `${campaignEvidenceName} · delivery funnel`,
        grain: 'Source + reporting window + funnel stage',
        caveat: 'Clicks do not prove purchase, journey completion, or causal campaign impact.',
      },
      conversion_rate: {
        title: 'Send-to-conversion rate',
        evidenceStatus: 'Derived from observed funnel counts',
        meaning: `${formatRuntimeCount(converted)} reported conversions follow ${formatRuntimeCount(sent)} sends, producing the displayed ${formatRuntimePercent(conversionRate)} send-to-conversion rate.`,
        calculation: `send-to-conversion rate = converted / sent × 100\n${formatRuntimeCount(converted)} / ${formatRuntimeCount(sent)} × 100 = ${formatRuntimePercent(conversionRate)}`,
        businessInsight: 'Use this portfolio outcome rate to monitor lower-funnel health and locate whether improvement work belongs earlier in delivery/engagement or after the click.',
        artifact: `${campaignEvidenceName} · delivery funnel`,
        grain: 'Source + reporting window + funnel stage',
        caveat: 'A reported conversion is not relabelled as journey Completed and does not establish incremental lift without a comparison design.',
      },
    }
    if (details[metric]) openCampaignEvidence(details[metric])
  }
  const hasFunnel = campaignReportAvailability.funnel
  const representedChannelTotal = model.channels.reduce((sum, row) => sum + (finite(row.value) ?? 0), 0)
  const hasChannels = campaignReportAvailability.channels
  const hasCampaignRows = campaignReportAvailability.comparison
  const hasValueEfficiency = campaignReportAvailability.valueEfficiency
  const hasTrend = campaignReportAvailability.trend
  const hasDefinitionLibrary = campaignReportAvailability.templates
  const hasExperimentDesign = campaignReportAvailability.experiment
  const hasActionEvidence = campaignReportAvailability.actions
  const campaignReportCatalogue = [
    {
      key: 'valueEfficiency',
      label: 'Top Journeys by Revenue Efficiency',
      purpose: 'Uses available campaign outcome evidence to compare attributed revenue per 1,000 sends for journey optimization; it is not journey-level ROI.',
    },
    {
      key: 'channels',
      label: 'Channel Mix',
      purpose: 'Shows where reported message volume is concentrated; it does not claim which channel caused the result.',
    },
    {
      key: 'funnel',
      label: 'Customer Journey Funnel',
      purpose: 'Shows how sends move through delivery, opens, clicks, and reported conversions, including the loss at each step.',
    },
    {
      key: 'actions',
      label: 'Journey Actions',
      purpose: 'Prioritizes measured funnel signals and supporting campaign outcomes for journey optimization without inventing projected lift.',
    },
    {
      key: 'trend',
      label: 'Engagement Trend',
      purpose: 'Shows the direction of delivered, opened, and clicked observations so unusual movement can be investigated.',
    },
    {
      key: 'comparison',
      label: 'Campaign Outcome Comparison',
      purpose: 'Compares the campaign-grain delivery, engagement, bounce, and attributed-revenue evidence used to support journey reporting.',
    },
    {
      key: 'templates',
      label: 'Journey Templates & Readiness',
      purpose: 'Shows reusable journey templates, trigger mix, and touchpoint complexity for planning; it does not prove execution.',
    },
    {
      key: 'experiment',
      label: 'Experiment Design Readiness',
      purpose: 'Explains configured holdout, treatment split, variants, and measurement events; it does not claim a winner.',
    },
    {
      key: 'details',
      label: 'Campaign Outcome Evidence',
      purpose: 'Provides the campaign-grain evidence behind the journey reports and shows how much of the source outcome inventory the detailed rows cover.',
    },
  ].filter(report => campaignReportAvailability[report.key])
  const campaignPrimaryReports = campaignReportCatalogue.slice(0, 4)
  const campaignOptionalReports = campaignReportCatalogue.slice(4)
  const primaryReportKeys = campaignPrimaryReports.map(report => report.key)
  const optionalReportKeys = new Set(campaignOptionalReports.map(report => report.key))
  const visibleCampaignReports = campaignReportCatalogue.filter(report => (
    primaryReportKeys.includes(report.key)
    || (optionalReportKeys.has(report.key) && selectedReports.includes(report.key))
  ))
  const isReportVisible = key => (
    primaryReportKeys.includes(key)
    || (optionalReportKeys.has(key) && selectedReports.includes(key))
  )
  const reportSelector = campaignOptionalReports.length > 0 ? (
    <div style={{ marginTop: 14 }}>
      <AddReportSelector
        reports={campaignOptionalReports}
        selected={selectedReports}
        onAdd={key => setSelectedReports(current => (
          current.includes(key) ? current : [...current, key]
        ))}
        onRemove={key => setSelectedReports(current => current.filter(item => item !== key))}
        title="Add another journey report"
        description="Choose a populated supporting report. It will be added below the four priority reports."
      />
    </div>
  ) : null
  const explanation = (
    <>
      <p>
        This report helps a marketer understand journey communication scale, where customers drop out of the response funnel,
        which channels and outcome signals deserve attention, and whether reusable journey designs are ready for review.
        It shows only measures backed by the current {sourceLabel(source)} campaign outcome artifact or journey definition catalog.
      </p>
      <h4>What the visible reports mean</h4>
      <ul>
        {visibleCampaignReports.map(report => (
          <li key={report.key}><strong>{report.label}:</strong> {report.purpose}</li>
        ))}
      </ul>
    </>
  )

  return (
    <div className="rp-report" data-page="journeys">
      <ReportHero
        eyebrow={`Journey report · ${model.period}`}
        score={formatRuntimePercent(conversionRate)}
        scoreLabel="send-to-conversion"
        color={REPORT_COLORS.magenta}
        title="Journey reporting summary"
        summary={`${sourceLabel(source)} recorded ${formatRuntimeCompact(sent)} sends and ${formatRuntimeCompact(converted)} conversions in the available campaign outcome evidence. The ${catalog.provenance.toLowerCase()} contains ${formatRuntimeCount(catalog.totalDefinitions)} journeys: ${formatRuntimeCount(catalog.presetDefinitions)} reusable presets and ${formatRuntimeCount(catalog.customDefinitions)} saved custom journeys.`}
        tags={[model.period, catalog.provenance, `${formatRuntimeCount(catalog.readyDefinitions)} ready for activation`]}
        explanation={explanation}
        evidence={campaignEvidence({
          evidenceStatus: 'Mixed · observed outcomes + configured definitions',
          calculation: [
            hasFunnel ? `send-to-conversion rate = reported conversions / reported sends × 100\n${formatRuntimeCount(converted)} / ${formatRuntimeCount(sent)} × 100 = ${formatRuntimePercent(conversionRate)}` : null,
            finite(model.funnelLookup.delivered) !== null && sent > 0 ? `delivery rate = delivered / sent × 100\n${formatRuntimeCount(model.funnelLookup.delivered)} / ${formatRuntimeCount(sent)} × 100 = ${formatRuntimePercent(safePercent(model.funnelLookup.delivered, sent))}` : null,
            finite(model.funnelLookup.opened) !== null && finite(model.funnelLookup.delivered) > 0 ? `open rate = opened / delivered × 100\n${formatRuntimeCount(model.funnelLookup.opened)} / ${formatRuntimeCount(model.funnelLookup.delivered)} × 100 = ${formatRuntimePercent(safePercent(model.funnelLookup.opened, model.funnelLookup.delivered))}` : null,
            finite(model.funnelLookup.clicked) !== null && finite(model.funnelLookup.delivered) > 0 ? `click rate = clicked / delivered × 100\n${formatRuntimeCount(model.funnelLookup.clicked)} / ${formatRuntimeCount(model.funnelLookup.delivered)} × 100 = ${formatRuntimePercent(safePercent(model.funnelLookup.clicked, model.funnelLookup.delivered))}` : null,
            finite(model.summary.revenue) !== null && sent > 0 ? `campaign outcome value efficiency = attributed revenue / sends × 1,000\n${formatRuntimeCurrency(model.summary.revenue)} / ${formatRuntimeCount(sent)} × 1,000 = ${formatRuntimeCurrency(finite(model.summary.revenue) / sent * 1000)}` : null,
            finite(catalog.totalDefinitions) !== null ? `total journeys = preset journey definitions + saved custom journey definitions\n${formatRuntimeCount(catalog.presetDefinitions)} + ${formatRuntimeCount(catalog.customDefinitions)} = ${formatRuntimeCount(catalog.totalDefinitions)}` : null,
          ].filter(Boolean).join('\n\n'),
          businessInsight: `${sourceLabel(source)} produced ${formatRuntimeCount(converted)} reported conversions from ${formatRuntimeCount(sent)} sends, a ${formatRuntimePercent(conversionRate)} send-to-conversion rate. Review the largest visible funnel loss first, then use channel and campaign outcome evidence to decide whether the next journey test should address delivery, message relevance, call-to-action, or the post-click experience. ${formatRuntimeCount(catalog.readyDefinitions)} of ${formatRuntimeCount(catalog.presetDefinitions)} preset journeys are ready for activation review; this does not prove they are deployed or running.`,
          provenance: [
            { label: 'Selected source', value: sourceLabel(source) },
            { label: 'Scope', value: 'Source campaign outcomes + global journey definition catalog' },
            { label: 'Reporting window', value: model.period },
            { label: 'Freshness / version', value: 'Source as-of timestamp and catalog version not published' },
            { label: 'Campaign report API', value: campaignEvidenceName },
            { label: 'Runtime evidence', value: `Observed sends, conversions, channels, and attributed value for ${model.period}` },
            { label: 'Definition evidence', value: `${journeyCatalogEvidenceName} · ${formatRuntimeCount(catalog.totalDefinitions)} definitions` },
            { label: 'Evidence grain', value: 'Source window, campaign row, funnel stage, and global journey definition' },
          ],
          callout: 'Only source outcomes and configured definition measures backed by the current APIs are displayed.',
        })}
      />

      <KpiGrid columns={3}>
        {finite(catalog.totalDefinitions) !== null && (
        <KpiCard
          label="Total Journeys"
          value={formatRuntimeCount(catalog.totalDefinitions)}
          detail={`${formatRuntimeCount(catalog.presetDefinitions)} preset + ${formatRuntimeCount(catalog.customDefinitions)} saved custom`}
          color={REPORT_COLORS.violet}
          evidence="View evidence"
          onClick={() => openCampaignEvidence({
            title: 'Total Journeys',
            evidenceStatus: 'Configured · global journey library',
            meaning: `The journey library contains ${formatRuntimeCount(catalog.presetDefinitions)} reusable preset journeys and ${formatRuntimeCount(catalog.customDefinitions)} saved custom journeys.`,
            calculation: `total journeys = preset journey definitions + saved custom journey definitions\n${formatRuntimeCount(catalog.presetDefinitions)} + ${formatRuntimeCount(catalog.customDefinitions)} = ${formatRuntimeCount(catalog.totalDefinitions)}`,
            businessInsight: 'Use this inventory to plan template reuse and governance. It measures available configuration, not source-specific execution or customer enrollment.',
            selectedSource: null,
            scope: 'Global journey definition catalog',
            window: 'Not source-scoped',
            freshness: 'Catalog version / as-of timestamp not published',
            artifact: journeyCatalogEvidenceName,
            grain: 'Global journey definition',
            caveat: 'Definition inventory is global configuration metadata and is deliberately not presented as source-specific runtime execution.',
          })}
        />
        )}
        {finite(catalog.readyDefinitions) !== null && (
        <KpiCard
          label="Ready for Activation"
          value={formatRuntimeCount(catalog.readyDefinitions)}
          detail={`${formatRuntimePercent(safePercent(catalog.readyDefinitions, catalog.presetDefinitions))} of presets`}
          color={REPORT_COLORS.green}
          evidence="View evidence"
          onClick={() => openCampaignEvidence({
            title: 'Ready for Activation',
            evidenceStatus: 'Configured · definition readiness',
            meaning: `${formatRuntimeCount(catalog.readyDefinitions)} preset journeys are marked READY in the journey library, indicating that their configuration passed the library’s readiness state.`,
            calculation: `ready-for-activation share = READY preset journeys / preset journeys\n${formatRuntimeCount(catalog.readyDefinitions)} / ${formatRuntimeCount(catalog.presetDefinitions)} = ${formatRuntimePercent(safePercent(catalog.readyDefinitions, catalog.presetDefinitions))}`,
            businessInsight: 'Use this measure to identify templates ready for business review or customization. It does not prove a journey is deployed, running, or producing outcomes.',
            selectedSource: null,
            scope: 'Global journey definition catalog',
            window: 'Not source-scoped',
            freshness: 'Catalog version / as-of timestamp not published',
            artifact: journeyCatalogEvidenceName,
            grain: 'Global preset journey definition',
            caveat: 'READY describes configuration readiness. It is not the same as a journey that is deployed and running.',
          })}
        />
        )}
        {finite(catalog.explicitlyActive) !== null && finite(catalog.activeFlagCoverage) !== null && (
        <KpiCard
          label="Active Journeys"
          value={formatRuntimeCount(catalog.explicitlyActive)}
          detail={`Configured active · status coverage ${formatRuntimeCount(catalog.activeFlagCoverage)}/${formatRuntimeCount(catalog.presetDefinitions)}`}
          color={REPORT_COLORS.amber}
          evidence="View evidence"
          onClick={() => openCampaignEvidence({
            title: 'Active Journeys',
            evidenceStatus: 'Configured · incomplete active-flag coverage',
            meaning: `${formatRuntimeCount(catalog.explicitlyActive)} preset journeys explicitly mark their configuration active. The status flag is available on ${formatRuntimeCount(catalog.activeFlagCoverage)} of ${formatRuntimeCount(catalog.presetDefinitions)} presets, so the displayed count covers only journeys with explicit configuration evidence.`,
            calculation: `active journeys (configured) = count(preset journeys where active flag is present and true)\n= ${formatRuntimeCount(catalog.explicitlyActive)}\nstatus coverage = ${formatRuntimeCount(catalog.activeFlagCoverage)} / ${formatRuntimeCount(catalog.presetDefinitions)} = ${formatRuntimePercent(safePercent(catalog.activeFlagCoverage, catalog.presetDefinitions))}`,
            businessInsight: 'Use this as the configured-active inventory within the published status coverage, and complete missing status metadata before using it for portfolio decisions. Live execution requires a journey runtime ledger.',
            selectedSource: null,
            scope: 'Global journey definition catalog',
            window: 'Not source-scoped',
            freshness: 'Catalog version / as-of timestamp not published',
            artifact: journeyCatalogEvidenceName,
            grain: 'Global preset journey definition',
            caveat: 'This is configured active status, not proof that a journey is deployed or currently running. Incomplete status coverage can understate the true configured-active count.',
          })}
        />
        )}
      </KpiGrid>

      <AnalyticsStrip
        sent={sent}
        summary={model.summary}
        conversionRate={conversionRate}
        onExplain={openAnalyticsEvidence}
      />

      <CampaignReportColumns
        primaryKeys={campaignPrimaryReports.map(report => report.key)}
        optionalKeys={campaignOptionalReports
          .filter(report => selectedReports.includes(report.key))
          .map(report => report.key)}
        weights={{
          funnel: 5,
          channels: 3,
          valueEfficiency: 4,
          actions: 2,
          trend: 3,
          comparison: 4,
          templates: 3,
          experiment: 3,
          details: 4,
        }}
        selector={reportSelector}
      >
        {isReportVisible('funnel') && (
        <Panel
          reportKey="funnel"
          className="rp-cj-flow"
          title="Customer Journey Funnel"
          subtitle="Stage-to-stage retention and drop-off drawn from the source-specific campaign funnel."
          action={(
            <EvidenceAction
              label="Explain flow ↗"
              onClick={() => openCampaignEvidence({
                title: 'Customer Journey Funnel',
                evidenceStatus: 'Derived from observed campaign funnel counts',
                meaning: 'The flow shows how many campaign events remain at each reported stage. Connector thickness visualizes retention, and each callout shows the exact loss from the previous stage.',
                calculation: `reported stage values = ${model.funnel.map(row => `${row.label} ${formatRuntimeCount(row.value)}`).join(' → ')}\noverall conversion = Converted / Sent × 100\n${formatRuntimeCount(converted)} / ${formatRuntimeCount(sent)} × 100 = ${formatRuntimePercent(conversionRate)}\ncurrent stage losses = ${model.funnel.slice(1).map((row, index) => `${model.funnel[index].label}→${row.label}: ${formatRuntimeCount(Math.max(model.funnel[index].value - row.value, 0))}`).join(' · ')}`,
                businessInsight: 'Use the largest stage loss to choose the next optimization focus—for example deliverability, opens, clicks, or conversion. Converted is not the same as journey completion.',
                artifact: `${campaignEvidenceName} · campaign conversion funnel`,
                grain: 'Source + reporting window + funnel stage',
                caveat: 'Converted is a campaign outcome and is not relabelled as journey Completed. Enrollment and completion require journey execution records.',
              })}
            />
          )}
        >
          <JourneyFlow rows={model.funnel} sent={sent} />
          <p className="rp-cj-caption"><strong>Overall conversion:</strong> {formatRuntimeCount(converted)} converted, {formatRuntimePercent(conversionRate)} of sends. Converted is not relabelled as journey Completed.</p>
        </Panel>
        )}
        {isReportVisible('channels') && (
        <Panel
          reportKey="channels"
          className="rp-cj-channel"
          title="Channel Mix"
          subtitle="Exact share of reported sends by represented channel."
          action={(
            <EvidenceAction
              label={`${formatCount(model.channels.length)} channels · Explain ↗`}
              onClick={() => {
                const representedSends = model.channels.reduce((sum, row) => sum + row.value, 0)
                const leader = model.channels.slice().sort((left, right) => right.value - left.value)[0]
                openCampaignEvidence({
                  title: 'Channel Mix',
                  evidenceStatus: 'Observed · reported channel counts',
                  meaning: `The chart distributes ${formatRuntimeCount(representedSends)} represented sends across ${formatCount(model.channels.length)} channels for ${sourceLabel(source)} in ${model.period}.`,
                  calculation: `represented channel sends = sum(channel send counts) = ${formatRuntimeCount(representedSends)}${leader ? `\n${leader.label} share = ${formatRuntimeCount(leader.value)} / ${formatRuntimeCount(representedSends)} = ${formatRuntimePercent(safePercent(leader.value, representedSends))}` : '\nno positive channel counts are available'}\nreported source sends = ${formatRuntimeCount(sent)}`,
                  businessInsight: 'Use channel share to understand delivery concentration, capacity exposure, and where channel-specific performance or resilience analysis should start.',
                  artifact: `${campaignEvidenceName} · channel mix`,
                  grain: 'Source + reporting window + channel',
                  caveat: representedSends === sent
                    ? 'Channel counts reconcile to reported sends, but the chart measures send volume—not unique people, channel effectiveness, or causal value.'
                    : `Represented channel sends (${formatRuntimeCount(representedSends)}) do not reconcile to reported sends (${formatRuntimeCount(sent)}). Treat the distribution as partial until the source artifact is corrected.`,
                })
              }}
            />
          )}
        >
          <ChannelRing rows={model.channels} sent={sent} />
        </Panel>
        )}
        {isReportVisible('valueEfficiency') && (
        <Panel
          reportKey="valueEfficiency"
          className="rp-cj-value"
          title="Top Journeys by Revenue Efficiency"
          subtitle="Campaign outcome evidence used for journey reporting, normalized to attributed revenue per 1,000 sends."
          action={(
            <EvidenceAction
              label="Explain metric ↗"
              onClick={() => {
                const revenue = finite(model.summary.revenue)
                const sourceEfficiency = revenue !== null && sent !== null && sent > 0
                  ? revenue / sent * 1000
                  : null
                openCampaignEvidence({
                  title: 'Top Journeys by Revenue Efficiency',
                  evidenceStatus: 'Derived from observed campaign values',
                  meaning: 'The leaderboard uses campaign outcome evidence to normalize reported attributed revenue to 1,000 sends. It supports journey optimization, but source rows are not relabelled as journey-level outcomes when no journey mapping is supplied.',
                  calculation: `campaign value efficiency = attributed campaign revenue / campaign sends × 1,000\nsource benchmark = ${formatRuntimeCurrency(revenue)} / ${formatRuntimeCount(sent)} × 1,000 = ${formatRuntimeCurrency(sourceEfficiency)}`,
                  businessInsight: 'Use this comparison to identify journey creative, offer, or targeting patterns that deserve investigation. Do not treat it as journey-level ROI or incremental lift because the evidence remains campaign-grain and spend and causal evidence are unavailable.',
                  artifact: `${campaignEvidenceName} · detailed campaign rows`,
                  grain: 'Detailed campaign row',
                  caveat: `The ${formatCount(model.campaigns.length)} supplied rows cover ${formatRuntimePercent(model.detailCoverage.campaign_send_pct)} of sends and ${formatRuntimePercent(model.detailCoverage.campaign_revenue_pct)} of attributed revenue. Revenue is attributed, not proven incremental lift; this is not ROI.`,
                })
              }}
            />
          )}
        >
          <ValueEfficiency
            campaigns={model.campaigns}
            summary={model.summary}
            coverage={model.detailCoverage}
            onExplain={row => openCampaignEvidence({
              title: `${row.campaign} value efficiency`,
              evidenceStatus: 'Derived from observed campaign values',
              meaning: `${row.campaign} reports ${formatRuntimeCurrency(row.efficiency)} in attributed revenue per 1,000 sends, allowing direct comparison with campaigns of different size.`,
              calculation: `attributed revenue efficiency = campaign revenue / campaign sends × 1,000\n${formatRuntimeCurrency(row.revenue)} / ${formatRuntimeCount(row.sent)} × 1,000 = ${formatRuntimeCurrency(row.efficiency)}`,
              businessInsight: 'Use this value to decide whether the campaign deserves deeper analysis relative to peers and the source benchmark. Do not scale or stop it on this measure alone.',
              artifact: `${campaignEvidenceName} · detailed campaign rows`,
              grain: `Campaign ${row.campaign_id || row.campaign} · ${model.period}`,
              caveat: 'This is a volume-normalized attributed-revenue measure, not ROI, incremental lift, or causal performance.',
            })}
          />
        </Panel>
        )}
        {isReportVisible('actions') && (
        <Panel
          reportKey="actions"
          className="rp-cj-actions-panel"
          title="Journey Actions"
          subtitle="Recommended journey priorities generated from observed funnel and supporting campaign outcome evidence."
          action={(
            <EvidenceAction
              label="Explain priorities ↗"
              onClick={() => {
                const drops = model.funnel.slice(1).map((row, index) => {
                  const previous = model.funnel[index]
                  const lost = Math.max(previous.value - row.value, 0)
                  return { from: previous.label, to: row.label, lost, rate: safePercent(lost, previous.value) }
                }).filter(row => row.rate !== null)
                const biggestDrop = drops.slice().sort((left, right) => right.rate - left.rate)[0]
                const bestClick = model.campaigns
                  .filter(row => finite(row.click_rate) !== null)
                  .slice()
                  .sort((left, right) => finite(right.click_rate) - finite(left.click_rate))[0]
                const highBounce = model.campaigns
                  .filter(row => finite(row.bounce_rate) !== null)
                  .slice()
                  .sort((left, right) => finite(right.bounce_rate) - finite(left.bounce_rate))[0]
                const calculationLines = [
                  biggestDrop
                    ? `P1 = largest funnel loss = ${biggestDrop.from}→${biggestDrop.to}: ${formatRuntimeCount(biggestDrop.lost)} lost (${formatRuntimePercent(biggestDrop.rate)})`
                    : null,
                  bestClick
                    ? `P2 = highest supplied campaign click rate = ${bestClick.campaign}: ${formatRuntimePercent(bestClick.click_rate)}`
                    : null,
                  highBounce
                    ? `P3 = highest supplied campaign bounce rate = ${highBounce.campaign}: ${formatRuntimePercent(highBounce.bounce_rate)}`
                    : null,
                ].filter(Boolean)
                openCampaignEvidence({
                  title: 'Journey Actions',
                  evidenceStatus: 'Diagnostic · deterministic rules on observed evidence',
                  meaning: 'The queue ranks three journey-optimization signals from the current artifact: the largest funnel loss, the highest click rate among supplied campaign outcome rows, and the highest supplied bounce rate.',
                  calculation: calculationLines.join('\n'),
                  businessInsight: 'Use the queue to order investigation and controlled-test planning. It focuses attention on measurable friction and reusable patterns without inventing expected lift.',
                  artifact: `${campaignEvidenceName} · funnel and detailed campaign rows`,
                  grain: 'Source reporting window + funnel stage + detailed campaign row',
                  caveat: `The rules are diagnostic, not causal recommendations. The ${formatCount(model.campaigns.length)} detailed rows cover ${formatRuntimePercent(model.detailCoverage.campaign_row_pct)} of reported campaigns, and no projected impact or statistical confidence is asserted.`,
                })
              }}
            />
          )}
        >
          <ActionQueue campaigns={model.campaigns} funnel={model.funnel} />
        </Panel>
        )}
        {isReportVisible('trend') && (
        <Panel
          reportKey="trend"
          className="rp-cj-pulse"
          title="Engagement Trend"
          subtitle="Independent-scale small multiples preserve the shape of delivered, opened, and clicked samples."
          action={(
            <EvidenceAction
              label="Explain samples ↗"
              onClick={() => {
                const first = model.trend[0]
                const latest = model.trend.at(-1)
                openCampaignEvidence({
                  title: 'Engagement Trend',
                  evidenceStatus: 'Observed · sampled performance trend',
                  meaning: `The panel plots ${formatCount(model.trend.length)} supplied observations for delivered, opened, and clicked events from ${first.label} to ${latest.label}. Each series uses its own vertical scale so its direction remains visible.`,
                  calculation: `each point = reported metric value at the supplied observation label\nlatest delivered = ${formatRuntimeCount(latest?.delivered)}\nlatest opened = ${formatRuntimeCount(latest?.opened)}\nlatest clicked = ${formatRuntimeCount(latest?.clicked)}\nobservation count = ${formatCount(model.trend.length)}`,
                  businessInsight: 'Use the pulse to spot directional changes or unusual samples that deserve campaign, channel, or tracking investigation before reviewing aggregate rates.',
                  artifact: `${campaignEvidenceName} · performance trend`,
                  grain: 'Source + reporting window + supplied observation + engagement stage',
                  caveat: 'The three series use independent scales and supplied samples are not summed into headline totals. Visual slope must not be used to compare absolute magnitude across series or infer statistical trend.',
                })
              }}
            />
          )}
        >
          <EngagementPulse rows={model.trend} source={source} />
        </Panel>
        )}
        {isReportVisible('comparison') && (
        <Panel
          reportKey="comparison"
          className="rp-cj-heat"
          title="Campaign Outcome Comparison"
          subtitle="Campaign-grain outcome evidence used to support journey reporting and optimization."
          action={(
            <EvidenceAction
              label="Explain matrix ↗"
              onClick={() => openCampaignEvidence({
                title: 'Campaign Outcome Comparison',
                evidenceStatus: 'Observed and derived · detailed campaign subset',
                meaning: `The matrix compares ${formatCount(model.campaigns.length)} supplied campaign rows across delivery, open, click, bounce, and attributed-revenue measures. Exact values are printed in every available cell.`,
                calculation: `delivery rate = delivered / sent when a supplied delivery rate is absent\nopen, click, and bounce = supplied campaign rates\nrevenue = supplied attributed campaign revenue\ndetailed-row coverage = ${formatCount(model.campaigns.length)} / ${formatRuntimeCount(model.summary.total_campaigns)} = ${formatRuntimePercent(model.detailCoverage.campaign_row_pct)}`,
                businessInsight: 'Use the matrix to find campaign outcome rows with contrasting strengths or risks—for example strong engagement with high bounce pressure—and decide which journey patterns need deeper investigation.',
                artifact: `${campaignEvidenceName} · detailed campaign rows`,
                grain: 'Detailed campaign row + metric',
                caveat: 'Color intensity is relative within each column and the detailed rows are a ranked subset. Compare exact printed values and do not treat color intensity across different metrics as a common score.',
              })}
            />
          )}
        >
          <MetricHeatmap campaigns={model.campaigns} />
        </Panel>
        )}
        {isReportVisible('templates') && (
        <Panel
          reportKey="templates"
          className="rp-cj-library-panel"
          title="Journey Templates & Readiness"
          subtitle="Definition evidence, intentionally separated from source runtime metrics."
          action={(
            <EvidenceAction
              label="Explain library ↗"
              onClick={() => {
                const triggerTotal = catalog.triggerTypes.reduce((sum, row) => sum + row.value, 0)
                const touchpointTotal = catalog.touchpointDistribution.reduce((sum, row) => sum + row.value, 0)
                openCampaignEvidence({
                  title: 'Journey Templates & Readiness',
                  evidenceStatus: 'Configured · global journey definition catalog',
                  meaning: `The global catalog contains ${formatRuntimeCount(catalog.totalDefinitions)} journey definitions and groups them by trigger type and touchpoint count. These are reusable configuration assets, not ${sourceLabel(source)} execution records.`,
                  calculation: `total definitions = preset definitions + saved custom definitions\n${formatRuntimeCount(catalog.presetDefinitions)} + ${formatRuntimeCount(catalog.customDefinitions)} = ${formatRuntimeCount(catalog.totalDefinitions)}\ntrigger-distribution total = ${formatRuntimeCount(triggerTotal)} definitions\ntouchpoint-distribution total = ${formatRuntimeCount(touchpointTotal)} definitions`,
                  businessInsight: 'Use the library view to assess template coverage, trigger diversity, and journey complexity before creating or governing new journeys.',
                  selectedSource: null,
                  scope: 'Global journey definition catalog',
                  window: 'Not source-scoped',
                  freshness: 'Catalog version / as-of timestamp not published',
                  artifact: journeyCatalogEvidenceName,
                  grain: 'Global journey definition',
                  caveat: 'The catalog is global configuration metadata. READY, active flags, triggers, and touchpoints do not prove deployment, people enrolled, recent use, or outcomes for the selected source.',
                })
              }}
            />
          )}
        >
          <DefinitionLibrary catalog={catalog} />
        </Panel>
        )}
        {isReportVisible('experiment') && (
        <Panel
          reportKey="experiment"
          className="rp-cj-experiment-panel"
          title="Experiment Design Readiness"
          subtitle="Configured holdout, treatment, variant allocation, and declared measurement events."
          action={(
            <EvidenceAction
              label="Explain design ↗"
              onClick={() => {
                const experiment = catalog.experiment
                const holdout = finite(experiment?.holdout)
                const treatment = finite(experiment?.treatment)
                const split = finite(experiment?.split)
                openCampaignEvidence({
                  title: 'Experiment Design Readiness',
                  evidenceStatus: 'Configured design',
                  meaning: experiment?.hasSplit
                    ? `The global catalog contains a routed experiment design with ${formatRuntimePercent(holdout)} control holdout, ${formatRuntimePercent(treatment)} treatment allocation, and a ${formatRuntimePercent(split)}/${formatRuntimePercent(100 - split)} treatment split.`
                    : 'The journey catalog does not provide a complete routed experiment topology for this view.',
                  calculation: `configured audience allocation = holdout ${formatRuntimePercent(holdout)} + treatment ${formatRuntimePercent(treatment)} = ${formatRuntimePercent(holdout + treatment)}\nconfigured treatment allocation = variant A ${formatRuntimePercent(split)} + variant B ${formatRuntimePercent(100 - split)} = 100.0%\ndeclared measurement events = ${formatCount(experiment?.declaredEvents?.length || 0)}`,
                  businessInsight: 'Use this view to review experiment topology and instrumentation requirements before launch. Resolve any toggle/split conflict and connect assignment and outcome ledgers before making a winner decision.',
                  selectedSource: null,
                  scope: 'Global journey definition catalog',
                  window: 'Not source-scoped',
                  freshness: 'Catalog version / as-of timestamp not published',
                  artifact: `${journeyCatalogEvidenceName} · experiment configuration`,
                  grain: 'Global journey definition + configured experiment route',
                  caveat: 'This is configured design, not source-scoped execution evidence. Eligible population, assignment, exposure, outcomes, lift, confidence, and statistical significance remain unavailable.',
                })
              }}
            />
          )}
        >
          <ExperimentProof catalog={catalog} source={source} />
        </Panel>
        )}
        {false && (
        <Panel
          className="rp-cj-actions-panel"
          title="Journey Actions"
          subtitle="Recommended journey priorities generated from observed funnel and supporting campaign outcome evidence."
          action={(
            <EvidenceAction
              label="Explain priorities ↗"
              onClick={() => {
                const drops = model.funnel.slice(1).map((row, index) => {
                  const previous = model.funnel[index]
                  const lost = Math.max(previous.value - row.value, 0)
                  return { from: previous.label, to: row.label, lost, rate: safePercent(lost, previous.value) }
                }).filter(row => row.rate !== null)
                const biggestDrop = drops.slice().sort((left, right) => right.rate - left.rate)[0]
                const bestClick = model.campaigns
                  .filter(row => finite(row.click_rate) !== null)
                  .slice()
                  .sort((left, right) => finite(right.click_rate) - finite(left.click_rate))[0]
                const highBounce = model.campaigns
                  .filter(row => finite(row.bounce_rate) !== null)
                  .slice()
                  .sort((left, right) => finite(right.bounce_rate) - finite(left.bounce_rate))[0]
                const calculationLines = [
                  biggestDrop
                    ? `P1 = largest funnel loss = ${biggestDrop.from}→${biggestDrop.to}: ${formatRuntimeCount(biggestDrop.lost)} lost (${formatRuntimePercent(biggestDrop.rate)})`
                    : null,
                  bestClick
                    ? `P2 = highest supplied campaign click rate = ${bestClick.campaign}: ${formatRuntimePercent(bestClick.click_rate)}`
                    : null,
                  highBounce
                    ? `P3 = highest supplied campaign bounce rate = ${highBounce.campaign}: ${formatRuntimePercent(highBounce.bounce_rate)}`
                    : null,
                ].filter(Boolean)
                openCampaignEvidence({
                  title: 'Journey Actions',
                  evidenceStatus: 'Diagnostic · deterministic rules on observed evidence',
                  meaning: 'The queue ranks three journey-optimization signals from the current artifact: the largest funnel loss, the highest click rate among supplied campaign outcome rows, and the highest supplied bounce rate.',
                  calculation: calculationLines.join('\n'),
                  businessInsight: 'Use the queue to order investigation and controlled-test planning. It focuses attention on measurable friction and reusable patterns without inventing expected lift.',
                  artifact: `${campaignEvidenceName} · funnel and detailed campaign rows`,
                  grain: 'Source reporting window + funnel stage + detailed campaign row',
                  caveat: `The rules are diagnostic, not causal recommendations. The ${formatCount(model.campaigns.length)} detailed rows cover ${formatRuntimePercent(model.detailCoverage.campaign_row_pct)} of reported campaigns, and no projected impact or statistical confidence is asserted.`,
                })
              }}
            />
          )}
        >
          <ActionQueue campaigns={model.campaigns} funnel={model.funnel} />
        </Panel>
        )}

      {isReportVisible('details') && (
      <Panel
        reportKey="details"
        className="rp-cj-evidence-panel"
        title="Campaign Outcome Evidence"
        subtitle="Campaign-grain rows supporting the journey reports; this is a ranked subset, not the complete campaign inventory."
        action={(
          <EvidenceAction
            label="View lineage ↗"
            onClick={() => openCampaignEvidence({
              title: 'Campaign Outcome Evidence',
              evidenceStatus: 'Observed · supplied detailed campaign subset',
              meaning: `The evidence table exposes ${formatCount(model.campaigns.length)} detailed campaign rows from ${sourceLabel(source)} alongside the source summary total of ${formatRuntimeCount(model.summary.total_campaigns)} campaigns.`,
              calculation: `detailed row coverage = ${formatCount(model.campaigns.length)} / ${formatRuntimeCount(model.summary.total_campaigns)} = ${formatRuntimePercent(model.detailCoverage.campaign_row_pct)}\nunallocated sends = reported sends ${formatRuntimeCount(sent)} − detailed-row sends = ${formatRuntimeCount(model.detailCoverage.unallocated_sends)}\nunallocated attributed revenue = source revenue ${formatRuntimeCurrency(model.summary.revenue)} − detailed-row revenue = ${formatRuntimeCurrency(model.detailCoverage.unallocated_revenue)}`,
              businessInsight: 'Use this table as the row-level audit trail behind the comparative charts and to identify where summary totals are not represented by detailed campaign records.',
              artifact: `${campaignEvidenceName} · detailed campaign rows`,
              grain: 'Detailed campaign row',
              caveat: 'The table is a supplied ranked subset, not the complete campaign inventory. Residual sends and revenue remain explicitly unallocated rather than being guessed across displayed rows.',
            })}
          />
        )}
      >
        <CampaignEvidenceTable campaigns={model.campaigns} totalCampaigns={model.summary.total_campaigns} coverage={model.detailCoverage} />
      </Panel>
      )}
      </CampaignReportColumns>

      <ContractStrip status="Artifact + catalog">
        Source outcomes retain their reporting window. Definition inventory is global configuration metadata from the {catalog.provenance.toLowerCase()}; the page displays only measures backed by those current APIs.
      </ContractStrip>
      <EvidenceDrawer detail={evidenceDetail} onClose={() => setEvidenceDetail(null)} />
    </div>
  )
}
