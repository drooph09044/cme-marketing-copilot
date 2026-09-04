import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  readSelectedSourceSystem,
  SOURCE_SYSTEMS,
  SOURCE_SYSTEM_LABELS,
  writeSelectedSourceSystem,
} from '../sourceSystem'
import './reporting.css'

export const REPORT_COLORS = {
  blue: '#5b8fd9',
  cyan: '#39a7b5',
  green: '#37a07c',
  violet: '#8a78c7',
  magenta: '#8a78c7',
  amber: '#c38b3b',
  red: '#c15f69',
  slate: '#7d91a4',
}

// Keep automatic chart series to five clearly distinguishable business colors.
// Red and slate remain available for semantic alert and neutral states only.
export const REPORT_CHART_COLORS = [
  REPORT_COLORS.blue,
  REPORT_COLORS.cyan,
  REPORT_COLORS.green,
  REPORT_COLORS.violet,
  REPORT_COLORS.amber,
]

export function useReportingSource(fallback = 'media') {
  const [source, setSource] = useState(() => readSelectedSourceSystem(fallback))

  useEffect(() => {
    const sync = () => {
      const next = readSelectedSourceSystem(fallback)
      setSource(current => (current === next ? current : next))
    }
    window.addEventListener('focus', sync)
    window.addEventListener('storage', sync)
    window.addEventListener('cdp-source-system-change', sync)
    return () => {
      window.removeEventListener('focus', sync)
      window.removeEventListener('storage', sync)
      window.removeEventListener('cdp-source-system-change', sync)
    }
  }, [fallback])

  return source
}

export function sourceLabel(source) {
  return SOURCE_SYSTEM_LABELS[source] || String(source || '')
}

export function ReportSourceSelector({ source, label = 'Source system' }) {
  return (
    <div className="rp-source-selector" aria-label={`${label} selector`}>
      <span>{label}</span>
      <select
        value={source}
        onChange={event => writeSelectedSourceSystem(event.target.value)}
        aria-label={label}
      >
        {SOURCE_SYSTEMS.map(value => (
          <option key={value} value={value}>
            {SOURCE_SYSTEM_LABELS[value]}
          </option>
        ))}
      </select>
    </div>
  )
}

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function formatCount(value, fallback = '—') {
  const number = asFiniteNumber(value)
  return number === null ? fallback : number.toLocaleString('en-US')
}

export function formatCompact(value, fallback = '—') {
  const number = asFiniteNumber(value)
  if (number === null) return fallback
  return new Intl.NumberFormat('en-US', {
    notation: Math.abs(number) >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(number)
}

export function formatPercent(value, digits = 1, fallback = '—') {
  const number = asFiniteNumber(value)
  return number === null ? fallback : `${number.toFixed(digits)}%`
}

export function formatCurrency(value, compact = false, fallback = '—') {
  const number = asFiniteNumber(value)
  if (number === null) return fallback
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(number)
}

export function safePercent(numerator, denominator) {
  const top = asFiniteNumber(numerator)
  const bottom = asFiniteNumber(denominator)
  return top !== null && bottom !== null && bottom > 0
    ? (top / bottom) * 100
    : null
}

export function ReportState({ type = 'loading', title, children, onRetry }) {
  return (
    <div className={`rp-state rp-state-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {type === 'loading' && <span className="rp-spinner" aria-hidden="true" />}
      <div>
        <strong>{title || (type === 'loading' ? 'Loading report' : 'Report unavailable')}</strong>
        {children && <p>{children}</p>}
        {onRetry && (
          <button type="button" className="rp-button rp-button-secondary" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

export function ReportHero({
  eyebrow,
  score,
  scoreLabel,
  color = REPORT_COLORS.green,
  title,
  summary,
  tags = [],
  explanation,
  evidence,
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <section className="rp-hero" style={{ '--rp-signal': color }}>
        <div className="rp-hero-score">
          <b>{score ?? '—'}</b>
          <span>{scoreLabel}</span>
        </div>
        <div className="rp-hero-copy">
          {eyebrow && <div className="rp-eyebrow">{eyebrow}</div>}
          <h3><i />{title}</h3>
          <p>{summary}</p>
          <div className="rp-tags">
            {tags.filter(Boolean).map((tag, index) => (
              <span key={`${tag}-${index}`} className={index === 0 ? 'is-primary' : ''}>{tag}</span>
            ))}
          </div>
        </div>
        {explanation && (
          <button type="button" className="rp-button rp-button-primary" onClick={() => setOpen(true)}>
            ✦ Explain this report
          </button>
        )}
      </section>
      <EvidenceDrawer
        detail={open ? {
          title,
          summary: explanation,
          ...evidence,
        } : null}
        onClose={() => setOpen(false)}
        kicker="Report explanation"
      />
    </>
  )
}

export function KpiGrid({ children, columns = 6 }) {
  return <section className="rp-kpi-grid" style={{ '--rp-kpi-columns': columns }}>{children}</section>
}

export function KpiCard({
  label,
  value,
  detail,
  color = REPORT_COLORS.blue,
  evidence,
  onClick,
}) {
  const Component = onClick ? 'button' : 'article'
  return (
    <Component
      type={onClick ? 'button' : undefined}
      className={`rp-kpi ${onClick ? 'is-clickable' : ''}`}
      style={{ '--rp-signal': color }}
      onClick={onClick}
    >
      <span className="rp-kpi-label">{label}</span>
      <b className="rp-kpi-value">{value ?? '—'}</b>
      <span className="rp-kpi-detail">{detail || '\u00a0'}</span>
      {evidence && (
        <span
          className="rp-kpi-evidence"
          title={evidence === 'Evidence' ? undefined : evidence}
        >
          ⓘ Evidence
        </span>
      )}
    </Component>
  )
}

export function Panel({
  title,
  subtitle,
  badge,
  action,
  className = '',
  children,
  bodyClassName = '',
}) {
  return (
    <section className={`rp-panel ${className}`}>
      <header className="rp-panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action || (badge && <span className="rp-panel-badge">{badge}</span>)}
      </header>
      <div className={`rp-panel-body ${bodyClassName}`}>{children}</div>
    </section>
  )
}

export function AddReportSelector({
  reports = [],
  selected = [],
  onAdd,
  onRemove,
  title = 'Add more reports',
  description = 'Choose an additional data-backed report to add below the main dashboard.',
}) {
  const normalizedReports = reports.filter(report => report?.key && report?.label)
  if (!normalizedReports.length) return null

  const selectedSet = new Set(selected)
  const addedReports = normalizedReports.filter(report => selectedSet.has(report.key))
  const availableReports = normalizedReports.filter(report => !selectedSet.has(report.key))

  return (
    <section className="rp-report-selector" aria-label={title}>
      <div className="rp-report-selector-copy">
        <span>Customize this view</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <label className="rp-report-selector-control">
        <span>Available reports</span>
        <select
          value=""
          disabled={!availableReports.length}
          onChange={event => {
            const key = event.target.value
            if (key) onAdd?.(key)
          }}
        >
          <option value="">
            {availableReports.length ? 'Select a report to add' : 'All available reports are added'}
          </option>
          {availableReports.map(report => (
            <option key={report.key} value={report.key}>{report.label}</option>
          ))}
        </select>
      </label>

      {addedReports.length > 0 && (
        <div className="rp-report-selector-added" aria-label="Added reports">
          {addedReports.map(report => (
            <button
              key={report.key}
              type="button"
              title={`Remove ${report.label}`}
              aria-label={`Remove ${report.label}`}
              onClick={() => onRemove?.(report.key)}
            >
              <span>{report.label}</span>
              <b aria-hidden="true">×</b>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function evidenceRows(detail) {
  const supplied = Array.isArray(detail?.provenance)
    ? detail.provenance
      .filter(row => row && (row.value !== null && row.value !== undefined && row.value !== ''))
      .map(row => ({
        label: row.label || row.name || 'Evidence',
        value: row.value,
      }))
    : []

  const normalizedLabels = supplied.map(row => String(row.label).trim().toLowerCase())
  const used = new Set()
  const takeSupplied = predicate => {
    const index = normalizedLabels.findIndex((label, rowIndex) => (
      !used.has(rowIndex) && predicate(label)
    ))
    if (index < 0) return null
    used.add(index)
    return supplied[index]
  }
  const canonical = [
    {
      label: 'Selected source',
      value: detail?.source,
      match: label => label === 'selected source',
    },
    {
      label: 'Scope',
      value: detail?.scope,
      match: label => label === 'scope' || label.endsWith(' scope'),
    },
    {
      label: 'Report page',
      value: detail?.reportPage,
      match: label => label.includes('report page'),
    },
  ]
    .map(field => {
      const existing = takeSupplied(field.match)
      const value = existing?.value ?? field.value
      return value === null || value === undefined || value === ''
        ? null
        : { label: field.label, value }
    })
    .filter(Boolean)

  const remaining = supplied.filter((row, index) => !used.has(index))
  const remainingLabels = remaining.map(row => String(row.label).trim().toLowerCase())
  const supplemental = [
    {
      label: 'Artifact / API',
      value: detail?.artifact,
      covered: remainingLabels.some(label => label.includes('artifact') || label.includes('api')),
    },
    {
      label: 'Evidence grain',
      value: detail?.grain,
      covered: remainingLabels.some(label => label.includes('grain')),
    },
  ]
    .filter(field => (
      !field.covered
      && field.value !== null
      && field.value !== undefined
      && field.value !== ''
    ))
    .map(({ label, value }) => ({ label, value }))

  return [...canonical, ...remaining, ...supplemental]
}

function evidenceContractGaps(detail) {
  const checks = [
    ['meaning', detail?.meaning ?? detail?.summary ?? detail?.description],
    ['calculation', detail?.formula ?? detail?.calculation],
    [
      'business insight',
      detail?.businessInsight
        ?? detail?.business_insight
        ?? detail?.insight
        ?? detail?.decisionUse,
    ],
    ['provenance', evidenceRows(detail).length > 0],
    ['limitation', detail?.callout ?? detail?.caveat],
  ]

  return checks
    .filter(([, value]) => !value)
    .map(([label]) => label)
}

export function EvidenceDrawer({ detail, onClose, kicker = 'Metric evidence' }) {
  const closeButtonRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!detail) return undefined

    if (import.meta.env?.DEV) {
      const gaps = evidenceContractGaps(detail)
      if (gaps.length) {
        console.warn(
          `[Reporting evidence contract] "${detail.title || 'Untitled metric'}" is missing: ${gaps.join(', ')}.`,
        )
      }
    }

    previousFocusRef.current = document.activeElement
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
        return
      }

      if (event.key !== 'Tab') return
      const dialog = closeButtonRef.current?.closest('.rp-drawer')
      const focusable = dialog
        ? Array.from(dialog.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ))
        : []
      if (!focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [detail, onClose])

  if (!detail) return null

  const meaning = detail.meaning ?? detail.summary ?? detail.description
  const formula = detail.formula ?? detail.calculation
  const businessInsight = (
    detail.businessInsight
    ?? detail.business_insight
    ?? detail.insight
    ?? detail.decisionUse
  )
  const provenance = evidenceRows(detail)
  const callout = detail.callout ?? detail.caveat

  return (
    <div
      className="rp-drawer-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <aside
        className="rp-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={detail.title || 'Metric evidence'}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="rp-drawer-head">
          <div>
            <span>{kicker}</span>
            <h3>{detail.title || 'Explain this report'}</h3>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close explanation"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="rp-drawer-body">
          {meaning && (
            <section className="rp-drawer-section">
              <h4>Business explanation</h4>
              <div className="rp-drawer-copy">
                {typeof meaning === 'string' ? <p>{meaning}</p> : meaning}
              </div>
            </section>
          )}

          {formula && (
            <section className="rp-drawer-section">
              <h4>How this is calculated</h4>
              <div className="rp-drawer-formula">
                {typeof formula === 'string' ? formula : formula}
              </div>
            </section>
          )}

          {businessInsight && (
            <section className="rp-drawer-section">
              <h4>Business insight and action</h4>
              <div className="rp-drawer-insight">
                {typeof businessInsight === 'string' ? <p>{businessInsight}</p> : businessInsight}
              </div>
            </section>
          )}

          {provenance.length > 0 && (
            <section className="rp-drawer-section">
              <h4>Technical evidence</h4>
              <div className="rp-drawer-provenance">
                {provenance.map((row, index) => (
                  <div key={`${row.label}-${index}`}>
                    <span>{row.label}</span>
                    <b>{row.value}</b>
                  </div>
                ))}
              </div>
            </section>
          )}

          {callout && (
            <section className="rp-drawer-section">
              <h4>Important limitation</h4>
              <div className="rp-drawer-callout">
                {typeof callout === 'string' ? callout : callout}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

export function MetricDetail({ detail, onClose }) {
  if (!detail) return null
  return <EvidenceDrawer detail={detail} onClose={onClose} />
}

export function BarList({
  rows = [],
  valueKey = 'value',
  labelKey = 'label',
  color = REPORT_COLORS.blue,
  valueFormatter = formatCount,
  percentOfTotal = false,
  max: providedMax,
  onSelect,
}) {
  const total = rows.reduce((sum, row) => sum + (Number(row[valueKey]) || 0), 0)
  const max = providedMax || Math.max(...rows.map(row => Number(row[valueKey]) || 0), 1)
  return (
    <div className="rp-bars">
      {rows.map((row, index) => {
        const value = Number(row[valueKey]) || 0
        const pct = percentOfTotal ? safePercent(value, total) : safePercent(value, max)
        const rowColor = row.color || color
        const Component = onSelect ? 'button' : 'div'
        return (
          <Component
            key={`${row[labelKey]}-${index}`}
            type={onSelect ? 'button' : undefined}
            className={`rp-bar-row ${onSelect ? 'is-clickable' : ''}`}
            style={{ '--rp-signal': rowColor, '--rp-delay': `${index * 70}ms` }}
            onClick={onSelect ? () => onSelect(row) : undefined}
          >
            <span className="rp-bar-label">
              <strong title={String(row[labelKey] || '')}>{row[labelKey]}</strong>
              {row.sub && <small>{row.sub}</small>}
            </span>
            <span className="rp-bar-track"><i style={{ '--rp-value': `${Math.max(0, Math.min(pct || 0, 100))}%` }} /></span>
            <span className="rp-bar-value">
              <b>{valueFormatter(value, row)}</b>
              {percentOfTotal && <small>{formatPercent(safePercent(value, total))}</small>}
            </span>
          </Component>
        )
      })}
      {!rows.length && <div className="rp-inline-empty">No measured rows are available.</div>}
    </div>
  )
}

export function Donut({
  rows = [],
  valueKey = 'value',
  labelKey = 'label',
  center,
  centerLabel,
  size = 172,
  stroke = 17,
  valueFormatter = formatCount,
  percentageFirst = false,
  legendUnit = '',
}) {
  const normalized = rows.map((row, index) => ({
    ...row,
    value: Math.max(0, Number(row[valueKey]) || 0),
    color: row.color || REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length],
  }))
  const total = normalized.reduce((sum, row) => sum + row.value, 0)
  const accessibleLabel = normalized.length
    ? `${centerLabel || 'Distribution'}: ${normalized.map(row => {
      const share = safePercent(row.value, total)
      return `${row[labelKey]}, ${valueFormatter(row.value, row)}, ${formatPercent(share)}`
    }).join('; ')}`
    : `${centerLabel || 'Distribution'}: no measured values`
  const radius = 42
  let offset = 25
  return (
    <div className="rp-donut-layout">
      <div className="rp-donut" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" role="img" aria-label={accessibleLabel}>
          <circle className="rp-donut-track" cx="50" cy="50" r={radius} pathLength="100" />
          {normalized.map((row, index) => {
            const share = total ? (row.value / total) * 100 : 0
            const currentOffset = offset
            offset -= share
            return (
              <circle
                key={`${row[labelKey]}-${index}`}
                className="rp-donut-segment"
                cx="50"
                cy="50"
                r={radius}
                pathLength="100"
                style={{
                  '--rp-signal': row.color,
                  '--rp-dash': `${Math.max(share - (normalized.length > 1 ? 0.7 : 0), 0)} 100`,
                  '--rp-offset': currentOffset,
                  '--rp-delay': `${index * 90}ms`,
                  strokeWidth: stroke / 2,
                }}
              >
                <title>{`${row[labelKey]}: ${valueFormatter(row.value, row)} (${formatPercent(share)})`}</title>
              </circle>
            )
          })}
        </svg>
        <div className="rp-donut-center">
          <b>{center ?? formatCount(total)}</b>
          <span>{centerLabel}</span>
        </div>
      </div>
      <div className="rp-legend">
        {normalized.map((row, index) => {
          const share = safePercent(row.value, total)
          return (
            <div key={`${row[labelKey]}-${index}`} className="rp-legend-row" style={{ '--rp-signal': row.color }}>
              <i />
              <span>
                <strong>{row[labelKey]}</strong>
                {row.sub && <small>{row.sub}</small>}
              </span>
              <b className={percentageFirst ? 'is-percentage-first' : undefined}>
                {percentageFirst ? formatPercent(share) : valueFormatter(row.value, row)}
                <small>
                  {percentageFirst
                    ? `${valueFormatter(row.value, row)}${legendUnit ? ` ${legendUnit}` : ''}`
                    : formatPercent(share)}
                </small>
              </b>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function StackedBar({ rows = [], valueKey = 'value', labelKey = 'label', valueFormatter = formatCount }) {
  const total = rows.reduce((sum, row) => sum + (Number(row[valueKey]) || 0), 0)
  return (
    <div className="rp-stacked-wrap">
      <div className="rp-stacked">
        {rows.map((row, index) => {
          const value = Number(row[valueKey]) || 0
          const share = safePercent(value, total) || 0
          return (
            <i
              key={`${row[labelKey]}-${index}`}
              style={{
                '--rp-signal': row.color || REPORT_COLORS.blue,
                '--rp-share': `${share}%`,
                '--rp-delay': `${index * 80}ms`,
              }}
              title={`${row[labelKey]}: ${valueFormatter(value, row)} (${formatPercent(share)})`}
            />
          )
        })}
      </div>
      <div className="rp-stacked-legend">
        {rows.map((row, index) => (
          <span key={`${row[labelKey]}-${index}`} style={{ '--rp-signal': row.color || REPORT_COLORS.blue }}>
            <i />{row[labelKey]} <b>{valueFormatter(row[valueKey], row)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

function linePoints(rows, key, width, height, padding, max) {
  if (!rows.length) return ''
  return rows.map((row, index) => {
    const x = padding + (rows.length === 1 ? 0 : (index / (rows.length - 1)) * (width - padding * 2))
    const value = Number(row[key]) || 0
    const y = height - padding - (value / max) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')
}

export function LineChart({
  rows = [],
  xKey = 'label',
  series = [],
  valueFormatter = formatCompact,
  height = 250,
}) {
  const width = 760
  const padding = 42
  const max = Math.max(...rows.flatMap(row => series.map(item => Number(row[item.key]) || 0)), 1)
  return (
    <div className="rp-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
        {[0, 1, 2, 3, 4].map(index => {
          const y = padding + (index / 4) * (height - padding * 2)
          return <line key={index} className="rp-grid-line" x1={padding} x2={width - padding} y1={y} y2={y} />
        })}
        {series.map((item, index) => (
          <g
            key={item.key}
            style={{
              '--rp-signal': item.color || REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length],
            }}
          >
            <polyline className="rp-line" points={linePoints(rows, item.key, width, height, padding, max)} />
            {rows.map((row, pointIndex) => {
              const x = padding + (rows.length === 1 ? 0 : (pointIndex / (rows.length - 1)) * (width - padding * 2))
              const y = height - padding - ((Number(row[item.key]) || 0) / max) * (height - padding * 2)
              return (
                <circle key={`${item.key}-${pointIndex}`} className="rp-line-point" cx={x} cy={y} r="4">
                  <title>{`${row[xKey]} · ${item.label}: ${valueFormatter(row[item.key], item)}`}</title>
                </circle>
              )
            })}
          </g>
        ))}
        {rows.map((row, index) => {
          const x = padding + (rows.length === 1 ? 0 : (index / (rows.length - 1)) * (width - padding * 2))
          return <text key={`${row[xKey]}-${index}`} className="rp-axis-label" x={x} y={height - 13} textAnchor="middle">{row[xKey]}</text>
        })}
      </svg>
      <div className="rp-series-legend">
        {series.map(item => <span key={item.key} style={{ '--rp-signal': item.color }}><i />{item.label}</span>)}
      </div>
    </div>
  )
}

export function Funnel({ rows = [], valueFormatter = formatCompact }) {
  const max = Math.max(...rows.map(row => Number(row.value) || 0), 1)
  return (
    <div className="rp-funnel">
      {rows.map((row, index) => {
        const value = Number(row.value) || 0
        const width = Math.max(34, (value / max) * 100)
        return (
          <div
            key={`${row.label}-${index}`}
            className="rp-funnel-step"
            style={{
              '--rp-width': `${width}%`,
              '--rp-signal': row.color || REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length],
              '--rp-delay': `${index * 90}ms`,
            }}
          >
            <span style={{ width: `${width}%` }}>
              <strong>{row.label}</strong>
              <b>{valueFormatter(value, row)}</b>
            </span>
            {index < rows.length - 1 && <small>{formatPercent(safePercent(rows[index + 1]?.value, value))} retained</small>}
          </div>
        )
      })}
    </div>
  )
}

export function DistributionColumns({ rows = [], valueFormatter = formatCount, color = REPORT_COLORS.cyan }) {
  const max = Math.max(...rows.map(row => Number(row.value) || 0), 1)
  return (
    <div className="rp-columns">
      {rows.map((row, index) => {
        const value = Number(row.value) || 0
        return (
          <div key={`${row.label}-${index}`} className="rp-column" style={{ '--rp-signal': row.color || color, '--rp-delay': `${index * 70}ms` }}>
            <b>{valueFormatter(value, row)}</b>
            <span className="rp-column-track"><i style={{ '--rp-height': `${Math.max(4, (value / max) * 100)}%` }} /></span>
            <small>{row.label}</small>
          </div>
        )
      })}
    </div>
  )
}

export function ContractStrip({ children, status = 'Artifact-backed' }) {
  return (
    <footer className="rp-contract">
      <span><strong>Reporting contract:</strong> {children}</span>
      <b>{status}</b>
    </footer>
  )
}

export function useAbortableReport(loader, dependencies = []) {
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const dependencyKey = useMemo(() => JSON.stringify(dependencies), dependencies)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState(current => ({ ...current, loading: true, error: '' }))
    Promise.resolve(loader(controller.signal))
      .then(data => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch(error => {
        if (!active || error?.name === 'AbortError') return
        setState({ loading: false, error: error?.message || 'Unable to load report.', data: null })
      })
    return () => {
      active = false
      controller.abort()
    }
  // loader is intentionally supplied by the caller for the current dependency set.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey])

  return state
}
