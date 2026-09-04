import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import {
  AddReportSelector,
  ContractStrip,
  formatCount,
  formatPercent,
  KpiCard,
  KpiGrid,
  MetricDetail,
  Panel,
  REPORT_COLORS,
  ReportHero,
  ReportState,
  safePercent,
  sourceLabel,
  useAbortableReport,
  useReportingSource,
} from '../reporting/ReportPrimitives'
import './DataQualityReporting.css'

const DIMENSION_META = [
  { key: 'completeness', label: 'Completeness', color: REPORT_COLORS.blue },
  { key: 'validity', label: 'Validity', color: REPORT_COLORS.green },
  { key: 'consistency', label: 'Consistency', color: REPORT_COLORS.violet },
  { key: 'uniqueness', label: 'Uniqueness', color: REPORT_COLORS.cyan },
]

const ISSUE_COLORS = [
  REPORT_COLORS.amber,
  REPORT_COLORS.red,
  REPORT_COLORS.violet,
  REPORT_COLORS.magenta,
]

const QUALITY_GRAIN = {
  overall_data_quality_score: 'One percentage for the selected source snapshot; every available quality dimension receives equal weight.',
  records_ingested: 'One physical row in the selected source’s preprocessed input. Multiple rows can belong to the same customer.',
  fields_monitored: 'One distinct source field with at least one applicable quality or cleansing rule.',
  active_issues: 'One field-level finding. A single record can contribute several findings.',
  records_changed: 'One distinct input record changed by at least one monitored transformation.',
  healthy_records_pct: 'One distinct input record classified by whether it has zero current findings.',
  at_risk_records: 'One standardized record with at least one current field or exact-duplicate finding.',
  needs_review_records: 'One input record rejected because no corresponding standardized output exists.',
  active_rules: 'One configured rule family that applies to at least one field in the selected source.',
  processing_stages_available: 'One expected current-stage artifact, reconciled from the preprocessing and standardization outputs exposed by this source snapshot.',
}

const QUALITY_CAVEAT = {
  overall_data_quality_score: 'Accuracy is excluded until a trusted reference-truth dataset is connected.',
  records_ingested: 'This is the reporting input scope, not a count of unique customers.',
  fields_monitored: 'A field is counted only when the current payload exposes applicable quality evidence.',
  active_issues: 'Issue counts are findings, not deduplicated affected records.',
  records_changed: 'A changed record is counted once even when several fields were corrected.',
  healthy_records_pct: 'Healthy, at-risk, and needs-review are mutually exclusive record-grain populations; issue totals use field-finding grain.',
  at_risk_records: 'At-risk records exclude rejected records; each record is counted once even when several fields fail.',
  needs_review_records: 'Needs review is limited to rejected or blocked records; it does not duplicate the at-risk population.',
  active_rules: 'Active means applicable in the current source report, not a historical execution count.',
  processing_stages_available: 'This measures current artifact availability, not historical job executions or run reliability.',
}

const QUALITY_MEANING = {
  overall_data_quality_score: 'A single health score summarizing measured completeness, validity, consistency, and exact-row uniqueness for the selected source.',
  records_ingested: 'The physical input population covered by every count and percentage in this quality snapshot.',
  fields_monitored: 'The number of source fields that are actually evaluated by an applicable quality rule.',
  active_issues: 'The current remediation workload measured as missing, invalid, inconsistent, duplicate, or rejected findings.',
  records_changed: 'The share of input records whose monitored values were changed by cleansing.',
  healthy_records_pct: 'The share of input records with no current quality findings.',
  at_risk_records: 'The standardized record population with one or more current quality findings.',
  needs_review_records: 'The input records blocked from the standardized output and requiring investigation.',
  active_rules: 'The configured rule families currently applicable to the selected source schema.',
  processing_stages_available: 'The share of expected preprocessing and standardization stage artifacts currently available for reporting.',
}

const QUALITY_BUSINESS_INSIGHT = {
  overall_data_quality_score: 'Use this as a triage signal: inspect the dimension and field drill-downs before approving the source for activation. A high score is not proof of real-world accuracy.',
  records_ingested: 'Use this input population as the baseline for every issue rate and to estimate remediation or reprocessing volume.',
  fields_monitored: 'Use this to assess governance coverage. Fields outside this count are unmeasured and must not be assumed healthy.',
  active_issues: 'Use the Pareto and field drill-down to assign remediation effort to the issue types and fields creating the largest workload.',
  records_changed: 'Use this to understand how much the cleansing engine alters incoming data and where rule tuning or change review may be needed.',
  healthy_records_pct: 'Use this to size the clean population and remediation queue. It does not by itself prove that a governed identity-resolution gate passed.',
  at_risk_records: 'Use this list to prioritize records that remain usable but need field-level remediation.',
  needs_review_records: 'Use this list as the blocked-record queue; these records should be investigated before downstream use.',
  active_rules: 'Use this to confirm rule coverage for the source. It describes applicability, not whether the rules are effective.',
  processing_stages_available: 'Use this to confirm that the current report has the expected stage evidence; use execution history, when available, for SLA decisions.',
}

function numericValue(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function countValue(value) {
  const candidate = (
    value
    && typeof value === 'object'
    && !Array.isArray(value)
  )
    ? value.value
    : value
  if (candidate === null || candidate === undefined || candidate === '') return null
  const normalized = typeof candidate === 'string'
    ? candidate.trim().replace(/,/g, '')
    : candidate
  if (
    typeof normalized === 'string'
    && !/^-?\d+(?:\.0+)?$/.test(normalized)
  ) {
    return null
  }
  const number = Number(normalized)
  return Number.isFinite(number) && Number.isInteger(number) ? number : null
}

function firstNumber(...values) {
  for (const value of values) {
    const number = numericValue(value)
    if (number !== null) return number
  }
  return null
}

function validateQualityPayload(payload, expectedSource) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The data quality API returned an invalid payload.')
  }
  const sourceSystem = String(payload.source_system || '').trim().toLowerCase()
  if (sourceSystem !== expectedSource) {
    throw new Error(
      `Data quality reporting returned "${sourceSystem || 'an unidentified source'}" `
      + `instead of "${expectedSource}". Cross-source fallback is blocked.`
    )
  }
  const summary = payload.summary
  if (!summary || typeof summary !== 'object') {
    throw new Error('The data quality response is missing its summary contract.')
  }
  if (payload.data_available === false) {
    return payload
  }

  const total = countValue(summary.total_records)
    ?? countValue(summary.total_records_ingested)
  if (total === null || total <= 0) {
    throw new Error('The data quality response does not contain a valid record population.')
  }

  const requiredCounts = {
    records_cleansed: countValue(summary.records_cleansed),
    healthy_records: countValue(summary.healthy_records),
    needs_review_records: countValue(summary.needs_review_records),
    active_issues: countValue(summary.active_issues),
  }
  Object.entries(requiredCounts).forEach(([key, value]) => {
    if (value === null || value < 0) {
      throw new Error(`The data quality response has an invalid ${key.replace(/_/g, ' ')} count.`)
    }
  })
  if (requiredCounts.records_cleansed > total) {
    throw new Error('Records cleansed cannot exceed the total record population.')
  }

  const derivedAtRisk = (
    total
    - requiredCounts.healthy_records
    - requiredCounts.needs_review_records
  )
  if (derivedAtRisk < 0) {
    throw new Error('Healthy and needs-review records exceed the total record population.')
  }
  const atRiskValue = countValue(summary.at_risk_records)
  const hasExplicitAtRisk = (
    summary.at_risk_records !== null
    && summary.at_risk_records !== undefined
    && summary.at_risk_records !== ''
  )
  if (hasExplicitAtRisk && atRiskValue === null) {
    throw new Error('The data quality response has an invalid at risk records count.')
  }
  const atRiskRecords = atRiskValue ?? derivedAtRisk
  const classified = (
    requiredCounts.healthy_records
    + atRiskRecords
    + requiredCounts.needs_review_records
  )
  if (classified !== total || atRiskRecords !== derivedAtRisk) {
    throw new Error(
      `Record health does not reconcile: ${formatCount(classified)} classified records `
      + `do not equal ${formatCount(total)} total records.`
    )
  }
  const derivedAffected = atRiskRecords + requiredCounts.needs_review_records
  const affectedValue = countValue(summary.affected_records)
  const hasExplicitAffected = (
    summary.affected_records !== null
    && summary.affected_records !== undefined
    && summary.affected_records !== ''
  )
  if (hasExplicitAffected && affectedValue === null) {
    throw new Error('The data quality response has an invalid affected records count.')
  }
  if (affectedValue !== null && affectedValue !== derivedAffected) {
    throw new Error(
      `Records needing review do not reconcile: ${formatCount(affectedValue)} affected records `
      + `do not equal ${formatCount(derivedAffected)} non-healthy records.`
    )
  }

  const issues = Array.isArray(payload.issue_summary) ? payload.issue_summary : []
  if (!issues.length || issues.some(row => numericValue(row?.count) === null || numericValue(row?.count) < 0)) {
    throw new Error('The data quality response does not contain complete issue-category counts.')
  }
  const issueTotal = issues.reduce((sum, row) => sum + numericValue(row.count), 0)
  if (issueTotal !== requiredCounts.active_issues) {
    throw new Error(
      `Issue findings do not reconcile: ${formatCount(issueTotal)} categorized findings `
      + `do not equal ${formatCount(requiredCounts.active_issues)} active findings.`
    )
  }

  const dimensions = (Array.isArray(payload.quality_dimensions)
    ? payload.quality_dimensions
    : []
  ).filter(row => row?.available !== false)
  const dimensionScores = dimensions.map(row => numericValue(row?.score))
  if (
    dimensionScores.length !== DIMENSION_META.length
    || dimensionScores.some(score => score === null || score < 0 || score > 100)
  ) {
    throw new Error('Completeness, validity, consistency, and uniqueness must all have valid scores.')
  }
  const expectedOverall = dimensionScores.reduce((sum, score) => sum + score, 0) / dimensionScores.length
  const overall = numericValue(summary.overall_data_quality_score)
  if (overall === null || overall < 0 || overall > 100 || Math.abs(overall - expectedOverall) > 0.11) {
    throw new Error('The overall quality score does not reconcile with its measured dimensions.')
  }
  return {
    ...payload,
    summary: {
      ...summary,
      total_records: total,
      records_cleansed: requiredCounts.records_cleansed,
      healthy_records: requiredCounts.healthy_records,
      at_risk_records: atRiskRecords,
      needs_review_records: requiredCounts.needs_review_records,
      affected_records: affectedValue ?? derivedAffected,
      active_issues: requiredCounts.active_issues,
    },
  }
}

function displayCount(value) {
  const number = numericValue(value)
  return number === null ? 'N/A' : formatCount(number, 'N/A')
}

function displayPercent(value) {
  const number = numericValue(value)
  return number === null ? 'N/A' : formatPercent(number, 1, 'N/A')
}

function formatLabel(value) {
  return String(value || '')
    .replace(/\.(csv|json)$/i, '')
    .replace(/^(med|spt|tel|aut)_/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

function scoreColor(score) {
  const value = numericValue(score)
  if (value === null) return REPORT_COLORS.slate
  if (value >= 90) return REPORT_COLORS.green
  if (value >= 75) return REPORT_COLORS.amber
  return REPORT_COLORS.red
}

function resolveArtifactName(value, sourceKey) {
  const artifact = String(value || '')
    .trim()
    .replace(/<source>/gi, sourceKey)
  if (!artifact) return ''

  const selectedSource = sourceLabel(sourceKey)
  if (/preprocessed_data[\\/].*[\\/]all_preprocessed\.csv/i.test(artifact)) {
    return `Preprocessed input artifact (all_preprocessed.csv, ${selectedSource})`
  }
  if (/standardized_data[\\/].*[\\/]all_standardized\.csv/i.test(artifact)) {
    return `Standardized output artifact (all_standardized.csv, ${selectedSource})`
  }
  if (/preprocessed_data[\\/].*[\\/]preprocessed_\*\.csv/i.test(artifact)) {
    return `Preprocessed source-table artifacts (preprocessed_*.csv, ${selectedSource})`
  }
  if (/superseded_ids\.csv/i.test(artifact)) {
    return `Golden-profile lineage artifact (superseded_ids.csv, ${selectedSource})`
  }
  if (/candidate_pairs\.csv/i.test(artifact)) {
    return `Candidate-pair evidence artifact (candidate_pairs.csv, ${selectedSource})`
  }
  if (/configured standardization rule catalog/i.test(artifact)) {
    return 'Configured standardization rule catalog'
  }
  if (/[\\/]/.test(artifact)) {
    const fileName = artifact.split(/[\\/]/).pop()
    return `Reporting artifact (${fileName}, ${selectedSource})`
  }
  return artifact
}

function formatSnapshotTime(value) {
  if (!value) return ''
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime())
    ? String(value)
    : timestamp.toLocaleString()
}

function qualityArtifactFor(metricKey, definitionSource, context) {
  const definedArtifact = resolveArtifactName(definitionSource, context.sourceKey)
  if (definedArtifact) return definedArtifact

  const artifactByMetric = {
    overall_data_quality_score: context.qualityArtifacts,
    active_issues: context.qualityArtifacts,
    records_changed: context.qualityArtifacts,
    healthy_records_pct: context.qualityArtifacts,
    active_rules: context.ruleArtifact,
    processing_stages_available: context.qualityArtifacts,
  }
  return artifactByMetric[metricKey] || context.qualityArtifacts
}

function qualityMetricEquation(metric, numerator, denominator, rawValue) {
  switch (metric.key) {
    case 'records_changed':
      return `Records cleansed = ${displayCount(numerator)} distinct changed records; rate = ${displayCount(numerator)} ÷ ${displayCount(denominator)} = ${displayPercent(safePercent(numerator, denominator))}.`
    case 'healthy_records_pct':
      return `Healthy records = ${displayCount(numerator)} records with zero findings; rate = ${displayCount(numerator)} ÷ ${displayCount(denominator)} = ${displayPercent(safePercent(numerator, denominator))}.`
    case 'at_risk_records':
      return `At-risk rate = ${displayCount(numerator)} standardized records with findings ÷ ${displayCount(denominator)} input records = ${displayPercent(safePercent(numerator, denominator))}.`
    case 'needs_review_records':
      return `Needs-review rate = ${displayCount(numerator)} rejected records ÷ ${displayCount(denominator)} input records = ${displayPercent(safePercent(numerator, denominator))}.`
    case 'active_rules':
      return `${displayCount(numerator)} active applicable rules out of ${displayCount(denominator)} configured cleansing rules; displayed count = ${metric.value}.`
    case 'records_ingested':
      return `Total records = ${displayCount(rawValue)} physical preprocessed input rows.`
    case 'fields_monitored':
      return `Fields monitored = ${displayCount(rawValue)} distinct fields with an applicable rule.`
    case 'active_issues':
      return `Active issues = ${displayCount(rawValue)} missing, invalid, inconsistent, or rejected field findings.`
    case 'overall_data_quality_score':
      return `Overall quality score = ${metric.value} from the equal-weight mean of completeness, validity, consistency, and uniqueness.`
    case 'processing_stages_available':
      return `Processing-stage availability = ${displayCount(numerator)} available stage artifacts ÷ ${displayCount(denominator)} expected stage artifacts = ${metric.value}.`
    default:
      return `Current API value = ${metric.value}.`
  }
}

function buildMetricDetail(metric, definitions, context) {
  const definition = definitions?.[metric.definitionKey || metric.key] || {}
  const calculation = metric.key === 'records_changed'
    ? metric.calculation
    : definition.calculation || metric.calculation
  const numerator = firstNumber(definition.numerator, metric.numerator)
  const denominator = firstNumber(definition.denominator, metric.denominator)
  const rawValue = firstNumber(definition.value, metric.rawValue)
  const evidence = qualityMetricEquation(
    metric,
    numerator,
    denominator,
    rawValue,
  )
  const grain = metric.grain || QUALITY_GRAIN[metric.key]
  const artifact = qualityArtifactFor(metric.key, definition.source, context)

  return {
    title: metric.label,
    summary: `${QUALITY_MEANING[metric.key] || metric.detail} Current result: ${metric.value}.`,
    calculation: `${calculation || 'The selected-source reporting service returns this value directly.'} Current equation: ${evidence}`,
    businessInsight: QUALITY_BUSINESS_INSIGHT[metric.key],
    values: evidence,
    provenance: [
      { label: 'Selected source', value: context.sourceName },
      { label: 'Reporting scope', value: context.scope },
      { label: 'Current API value(s)', value: evidence },
      { label: 'Evidence artifact(s)', value: artifact },
      { label: 'Source API', value: context.api },
      { label: 'Evidence grain', value: grain },
      { label: 'Snapshot generated', value: context.generatedAt },
    ],
    callout: metric.caveat || QUALITY_CAVEAT[metric.key] || context.caveat,
    source: context.sourceName,
    scope: context.scope,
    artifact,
    grain,
  }
}

function QualityPanelAction({ label, badge, onClick, children }) {
  return (
    <div className="rp-dq-panel-tools">
      {badge && <span className="rp-panel-badge">{badge}</span>}
      {children}
      <button type="button" className="rp-dq-panel-action" onClick={onClick}>
        {label} <span aria-hidden="true">↗</span>
      </button>
    </div>
  )
}

function RecordHealthComposition({ total, healthy, atRisk, review, onSelect }) {
  if (
    total === null
    || total <= 0
    || healthy === null
    || atRisk === null
    || review === null
  ) {
    return <div className="rp-inline-empty">Record-level health composition is unavailable.</div>
  }

  const healthyRate = safePercent(healthy, total) || 0
  const atRiskRate = safePercent(atRisk, total) || 0
  const reviewRate = safePercent(review, total) || 0
  const classified = healthy + atRisk + review
  const atRiskEnd = Math.min(100, healthyRate + atRiskRate)
  const reviewEnd = Math.min(100, healthyRate + atRiskRate + reviewRate)
  const reconciles = classified === total
  const rows = [
    {
      key: 'healthy',
      label: 'Healthy records',
      value: healthy,
      rate: healthyRate,
      detail: 'No current findings',
      color: REPORT_COLORS.green,
    },
    {
      key: 'at_risk',
      label: 'At-risk records',
      value: atRisk,
      rate: atRiskRate,
      detail: 'Standardized with one or more findings',
      color: REPORT_COLORS.amber,
    },
    {
      key: 'needs_review',
      label: 'Needs review',
      value: review,
      rate: reviewRate,
      detail: 'Rejected or blocked from standardization',
      color: REPORT_COLORS.red,
    },
  ]
  const allRecordsRow = {
    key: 'all',
    label: 'All assessed records',
    value: total,
    rate: 100,
    detail: 'Every record included in the current quality snapshot.',
    color: REPORT_COLORS.blue,
  }

  return (
    <div className="rp-dq-health-layout">
      <button
        type="button"
        className="rp-dq-health-ring"
        style={{
          '--rp-healthy': `${Math.max(0, Math.min(healthyRate, 100))}%`,
          '--rp-at-risk-end': `${atRiskEnd}%`,
          '--rp-review-end': `${reviewEnd}%`,
        }}
        onClick={() => onSelect?.(allRecordsRow)}
        title="Open all assessed records"
        aria-label={`Open all ${displayCount(total)} assessed records. ${displayPercent(healthyRate)} healthy, ${displayPercent(atRiskRate)} at risk, and ${displayPercent(reviewRate)} requiring review`}
      >
        <div>
          <b>{displayCount(total)}</b>
          <span>records assessed</span>
        </div>
      </button>

      <div className="rp-dq-health-legend">
        {rows.map(row => (
          <button
            key={row.label}
            type="button"
            className="rp-dq-health-row"
            style={{ '--rp-signal': row.color }}
            onClick={() => onSelect?.(row)}
            aria-label={`Open ${row.label.toLowerCase()} record list`}
          >
            <i />
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail}</span>
            </div>
            <b>{displayPercent(row.rate)}<small>{displayCount(row.value)} records</small></b>
          </button>
        ))}
        <p className={`rp-dq-health-note ${reconciles ? '' : 'is-warning'}`}>
          <strong>{reconciles ? 'Grain:' : 'Partial classification:'}</strong>{' '}
          {reconciles
            ? 'record counts are deduplicated; the issue Pareto is field-finding grain.'
            : `${displayCount(classified)} of ${displayCount(total)} records have a health classification.`}
        </p>
      </div>
    </div>
  )
}

function OverallQualityScore({
  overallScore,
  accuracyScore = null,
}) {
  const score = Math.round(
    Math.max(0, Math.min(numericValue(overallScore) || 0, 100)) * 10
  ) / 10
  const scoreGap = Math.round((100 - score) * 10) / 10
  const accuracy = numericValue(accuracyScore)

  return (
    <div
      className="rp-dq-score-summary rp-dq-score-summary-overall"
      style={{ '--rp-signal': scoreColor(score) }}
    >
      <div className="rp-dq-score-visual">
        <div
          className="rp-dq-score-ring"
          role="img"
          aria-label={`Overall Data Quality Score chart: ${displayPercent(score)} quality score and ${displayPercent(scoreGap)} remaining to 100.`}
          style={{ '--rp-score': `${score}%` }}
        >
          <div>
            <b>{displayPercent(score)}</b>
            <span>Overall score</span>
          </div>
        </div>
        <div className="rp-dq-score-key" aria-hidden="true">
          <span><i />Quality score</span>
          <span className="is-gap"><i />Gap {displayPercent(scoreGap)}</span>
        </div>
      </div>

      <div className="rp-dq-score-facts">
        <p className="rp-dq-score-formula">
          Overall = (Completeness + Validity + Consistency + Uniqueness) / 4.
        </p>
        <dl>
          <div
            className={`rp-dq-score-fact ${accuracy === null ? 'is-unmeasured' : ''}`}
            style={{ '--rp-fact-signal': REPORT_COLORS.amber }}
          >
            <dt>
              <span><i aria-hidden="true" />Accuracy</span>
              <strong>{accuracy === null ? 'N/A' : displayPercent(accuracy)}</strong>
            </dt>
            <dd>
              {accuracy === null
                ? 'Not measured: no trusted reference-truth dataset is connected.'
                : 'Measured against the connected trusted reference dataset.'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function QualityCompass({ dimensions }) {
  const measuredDimensions = ['completeness', 'validity', 'consistency', 'uniqueness'].map(key => (
    dimensions.find(row => row.key === key) || {
      key,
      label: formatLabel(key),
      value: null,
    }
  ))
  const sorted = [...measuredDimensions].sort((left, right) => (
    (numericValue(right.value) ?? -1) - (numericValue(left.value) ?? -1)
  ))
  const positioned = [sorted[0], sorted[1], sorted[2], sorted[3]]
  const center = { x: 140, y: 122 }
  const radius = 78
  const angles = [-90, 180, 0, 90]
  const point = (angle, distance) => {
    const radians = angle * Math.PI / 180
    return {
      x: center.x + Math.cos(radians) * distance,
      y: center.y + Math.sin(radians) * distance,
    }
  }
  const pointsFor = multiplier => angles
    .map(angle => {
      const coordinate = point(angle, radius * multiplier)
      return `${coordinate.x},${coordinate.y}`
    })
    .join(' ')
  const measuredPoints = positioned
    .map((row, index) => {
      const value = Math.max(0, Math.min(numericValue(row.value) || 0, 100))
      const coordinate = point(angles[index], radius * value / 100)
      return `${coordinate.x},${coordinate.y}`
    })
    .join(' ')
  const measuredCore = positioned.every(row => numericValue(row.value) !== null)

  return (
    <div className="rp-dq-compass">
      <div className="rp-dq-compass-radar">
        <svg
          className="rp-dq-radar"
          viewBox="0 0 280 244"
          role="img"
          aria-label={`Quality score breakdown: ${positioned.map(row => `${row.label} ${displayPercent(row.value)}`).join(', ')}`}
        >
          {[0.25, 0.5, 0.75, 1].map(level => (
            <polygon
              key={level}
              className="rp-dq-radar-grid"
              points={pointsFor(level)}
            />
          ))}
          {angles.map(angle => {
            const end = point(angle, radius)
            return (
              <line
                key={angle}
                className="rp-dq-radar-grid"
                x1={center.x}
                y1={center.y}
                x2={end.x}
                y2={end.y}
              />
            )
          })}
          {measuredCore && (
            <>
              <polygon className="rp-dq-radar-shape" points={measuredPoints} />
              {positioned.map((row, index) => {
                const value = Math.max(0, Math.min(numericValue(row.value) || 0, 100))
                const coordinate = point(angles[index], radius * value / 100)
                return (
                  <circle
                    key={row.key}
                    className="rp-dq-radar-point"
                    cx={coordinate.x}
                    cy={coordinate.y}
                    r="3.5"
                  />
                )
              })}
            </>
          )}
          {positioned.map((row, index) => {
            const coordinate = point(angles[index], radius + 17)
            const anchor = index === 1 ? 'end' : (index === 2 ? 'start' : 'middle')
            return (
              <text key={row.key} x={coordinate.x} y={coordinate.y} textAnchor={anchor}>
                <tspan x={coordinate.x} dy="0">{row.label}</tspan>
                <tspan
                  className="rp-dq-radar-value"
                  x={coordinate.x}
                  dy="13"
                >
                  {displayPercent(row.value)}
                </tspan>
              </text>
            )
          })}
        </svg>
      </div>
      <p className="rp-dq-compass-note">
        Highest score is shown at the top, the lowest at the bottom, and the two
        intermediate controls at left and right.
      </p>
    </div>
  )
}

function QualityHeatmap({ rows }) {
  const cellClass = value => {
    if (value === null) return 'is-na'
    if (value >= 90) return 'is-good'
    if (value >= 75) return 'is-watch'
    return 'is-risk'
  }

  return (
    <>
      <div className="rp-dq-heatmap-wrap">
        <div className="rp-dq-heatmap">
          <div />
          {['Overall', 'Completeness', 'Validity', 'Consistency', 'Uniqueness'].map(label => (
            <div key={label} className="rp-dq-heat-head">{label}</div>
          ))}
          {rows.map((row, index) => (
            <React.Fragment key={`${row.label}-${index}`}>
              <div className="rp-dq-heat-label">
                {row.label}
                <small>{row.sub}</small>
              </div>
              {['overall', 'completeness', 'validity', 'consistency', 'uniqueness'].map(key => (
                <div key={key} className={`rp-dq-heat-cell ${cellClass(row[key])}`}>
                  {displayPercent(row[key])}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="rp-dq-heat-legend">
        <span>Lower quality</span><i /><span>Higher quality</span>
      </div>
    </>
  )
}

function IssuePareto({ rows, total, incomplete = false, onSelect }) {
  const max = Math.max(...rows.map(row => Number(row.value) || 0), 1)
  return (
    <div className="rp-dq-pareto">
      {rows.map((row, index) => {
        const share = safePercent(row.value, total)
        const relativeWidth = safePercent(row.value, max) || 0
        return (
          <button
            key={`${row.label}-${index}`}
            type="button"
            className="rp-dq-pareto-row"
            style={{ '--rp-signal': row.color }}
            onClick={() => onSelect?.(row)}
            aria-label={`Open records for ${row.label}: ${displayCount(row.value)} findings`}
          >
            <strong>{row.label}</strong>
            <span className="rp-dq-pareto-track">
              <i style={{ '--rp-value': `${relativeWidth}%`, '--rp-delay': `${index * 75}ms` }}>
                {relativeWidth === 100 && row.value > 0 ? displayPercent(share) : ''}
              </i>
            </span>
            <b>{displayPercent(share)}<small>{displayCount(row.value)} findings</small></b>
          </button>
        )
      })}
      {!rows.length && (
        <div className="rp-inline-empty">
          {incomplete
            ? 'Issue findings are withheld because the source counts are incomplete.'
            : 'No issue findings are available.'}
        </div>
      )}
      <p className="rp-dq-caption">
        <strong>Important:</strong> these are findings, not deduplicated records; one record can contribute more than once.
      </p>
    </div>
  )
}

function FieldFindingsTable({ rows }) {
  return (
    <div className="rp-dq-table-wrap">
      <table className="rp-dq-table rp-dq-field-findings-table">
        <thead>
          <tr>
            <th>Table / field</th><th>Problem</th><th>Failed rule</th>
            <th>Affected</th><th>Severity</th><th>Example values</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.label}-${index}`}>
              <td><strong>{row.label}</strong><small>{row.tableName}</small></td>
              <td>{row.problem}</td>
              <td>{row.rule}</td>
              <td><strong>{displayCount(row.affected)}</strong><small>{displayPercent(row.affectedPercent)} of records</small></td>
              <td><span className={`rp-dq-severity is-${row.severity.toLowerCase()}`}>{row.severity}</span></td>
              <td>{row.examples.length ? row.examples.join(', ') : 'No issue example supplied'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="rp-inline-empty">No field findings are available.</div>}
    </div>
  )
}

function FieldQualityTable({ rows }) {
  return (
    <div className="rp-dq-table-wrap">
      <table className="rp-dq-table rp-dq-field-quality-table">
        <thead>
          <tr>
            <th>Table name</th><th>Field name</th><th>Issue count</th>
            <th>Impacted records</th><th>Data quality score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.tableName}-${row.fieldName}-${index}`}>
              <td>{row.tableName}</td>
              <td><strong>{row.fieldName}</strong></td>
              <td>{displayCount(row.issueCount)}</td>
              <td>{displayCount(row.impactedRecords)}</td>
              <td><strong>{displayPercent(row.qualityScore)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="rp-inline-empty">No field-level quality evidence is available.</div>}
    </div>
  )
}

function RuleResults({ rows }) {
  return (
    <div className="rp-dq-rule-results">
      <div className="rp-dq-table-wrap">
        <table className="rp-dq-table rp-dq-rule-table">
          <thead>
            <tr>
              <th>Rule name</th>
              <th>What it does</th>
              <th>Values evaluated</th>
              <th>Records corrected</th>
              <th>Active findings</th>
              <th>Quality score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label}>
                <td><strong>{row.label}</strong></td>
                <td>{row.description}</td>
                <td>{displayCount(row.processed)}</td>
                <td>{displayCount(row.correctedRecords)}</td>
                <td>{displayCount(row.issues)}</td>
                <td>{displayPercent(row.qualityScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="rp-inline-empty">
            No source-backed rule execution results are available.
          </div>
        )}
      </div>
    </div>
  )
}

function RecordDrilldown({ request, source, onClose }) {
  const pageSize = 10
  const allTablesKey = '__all_source_tables__'
  const dialogRef = useRef(null)
  const [selectedTable, setSelectedTable] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState({ loading: false, error: '', data: null })

  useEffect(() => {
    setSelectedTable('')
  }, [request?.category, request?.issueType])

  useEffect(() => {
    if (!request) return undefined
    let active = true
    const controller = new AbortController()
    setState({ loading: true, error: '', data: null })
    api.getDataQualityRecords(source, {
      category: request.category,
      issueType: request.issueType,
      sourceTable: selectedTable === allTablesKey ? '' : selectedTable,
      offset: 0,
      limit: pageSize,
      representative: Boolean(selectedTable && request.category === 'affected'),
    }, { signal: controller.signal }).then(payload => {
      if (!active) return
      const returnedSource = String(payload?.source_system || '').trim().toLowerCase()
      const records = Array.isArray(payload?.records) ? payload.records : null
      const total = countValue(payload?.total)
      const overallTotal = countValue(payload?.overall_total)
      const tableBreakdown = Array.isArray(payload?.table_breakdown)
        ? payload.table_breakdown
        : null
      const expectedTotal = countValue(request.expectedTotal)
      const rowsAreValid = records?.every(row => (
        row
        && typeof row === 'object'
        && String(row.record_id || '').trim()
        && String(row.source_table || '').trim()
        && String(row.status || '').trim()
      ))
      if (
        payload?.status !== 'success'
        || returnedSource !== source
        || records === null
        || tableBreakdown === null
        || total === null
        || overallTotal === null
        || total < 0
        || !rowsAreValid
        || (!selectedTable && expectedTotal !== null && overallTotal !== expectedTotal)
      ) {
        throw new Error('The record drill-down returned an invalid data contract.')
      }
      setState({ loading: false, error: '', data: payload })
    }).catch(error => {
      if (active && error?.name !== 'AbortError') {
        setState({
          loading: false,
          error: error?.message || 'Unable to load the record-level list.',
          data: null,
        })
      }
    })
    return () => {
      active = false
      controller.abort()
    }
  }, [request, source, selectedTable, reloadToken])

  useEffect(() => {
    if (!request) return undefined
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose?.()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )]
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
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [request, onClose])

  if (!request) return null
  const total = numericValue(state.data?.total) || 0
  const overallTotal = numericValue(state.data?.overall_total) || 0
  const records = Array.isArray(state.data?.records) ? state.data.records : []
  const tableBreakdown = Array.isArray(state.data?.table_breakdown)
    ? state.data.table_breakdown
    : []
  const selectedTableLabel = selectedTable === allTablesKey
    ? 'All source tables'
    : formatLabel(selectedTable)
  const totalIssueFindings = tableBreakdown.reduce(
    (sum, row) => sum + (numericValue(row?.issue_count) || 0),
    0,
  )
  const recordRows = records.slice(0, pageSize).map(record => {
    const findings = Array.isArray(record.findings) ? record.findings : []
    if (findings.length) {
      const finding = record.representative_finding && typeof record.representative_finding === 'object'
        ? record.representative_finding
        : findings[0]
      return {
        key: `${record.record_id}-${record.source_table}`,
        sourceTable: record.source_table,
        recordId: record.record_id,
        affectedField: formatLabel(finding.field || 'Record'),
        issueDescription: finding.reason || 'A configured data quality rule failed.',
        existingValue: finding.existing_value || '(blank)',
        expectedFormat: finding.expected_format || 'Configured valid format',
        failedRule: finding.failed_rule || 'Configured data quality rule',
      }
    }
    return {
      key: `${record.record_id}-${record.source_table}-healthy`,
      sourceTable: record.source_table,
      recordId: record.record_id,
      affectedField: 'None — healthy record',
      issueDescription: 'No missing, invalid, inconsistent, duplicate, or rejection finding.',
      existingValue: 'All monitored fields passed',
      expectedFormat: 'Configured quality rules satisfied',
      failedRule: 'No failed rule',
    }
  })

  return (
    <div
      className="rp-dq-record-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <section
        ref={dialogRef}
        className="rp-dq-record-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rp-dq-record-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Record-level quality evidence</span>
            <h3 id="rp-dq-record-title">{request.title}</h3>
            <p>{request.description}</p>
          </div>
          <button type="button" autoFocus aria-label="Close record list" onClick={onClose}>Close</button>
        </header>

        <div className="rp-dq-record-summary" aria-live="polite">
          <strong>{state.loading ? 'Loading...' : `${displayCount(selectedTable ? total : overallTotal)} records`}</strong>
          <span>
            {selectedTable
              ? request.category === 'affected'
                ? `${selectedTableLabel} · showing ${Math.min(total, pageSize)} real records selected across the available issue types and affected fields.`
                : `${selectedTableLabel} · showing only the top ${Math.min(total, pageSize)} source-backed records, with masked evidence values.`
              : 'Select a source table name to inspect only its top 10 source-backed records.'}
          </span>
        </div>

        <div className="rp-dq-record-body">
          {state.loading && (
            <div className="rp-inline-empty" role="status">Loading the source-backed record list...</div>
          )}
          {state.error && (
            <div className="rp-dq-record-error" role="alert">
              <p>{state.error}</p>
              <button type="button" onClick={() => setReloadToken(current => current + 1)}>
                Try again
              </button>
            </div>
          )}
          {!state.loading && !state.error && !selectedTable && tableBreakdown.length === 0 && (
            <div className="rp-inline-empty">
              No records match this current source-backed quality category.
            </div>
          )}
          {!state.loading && !state.error && !selectedTable && tableBreakdown.length > 0 && (
            <div className="rp-dq-table-wrap">
              <table className="rp-dq-table rp-dq-table-summary">
                <thead>
                  <tr>
                    <th>Source table</th>
                    <th>Records</th>
                    <th>Issue findings</th>
                  </tr>
                </thead>
                <tbody>
                  {request.category === 'affected' && (
                    <tr className="rp-dq-all-tables-row">
                      <td>
                        <button
                          type="button"
                          className="rp-dq-open-table"
                          onClick={() => setSelectedTable(allTablesKey)}
                        >
                          All source tables — varied issue mix
                        </button>
                      </td>
                      <td>{displayCount(overallTotal)}</td>
                      <td>{displayCount(totalIssueFindings)}</td>
                    </tr>
                  )}
                  {tableBreakdown.map(row => (
                    <tr key={row.source_table}>
                      <td>
                        <button
                          type="button"
                          className="rp-dq-open-table"
                          onClick={() => setSelectedTable(row.source_table)}
                          aria-label={`View top 10 records from ${formatLabel(row.source_table)}`}
                        >
                          {formatLabel(row.source_table)}
                        </button>
                      </td>
                      <td>{displayCount(row.record_count)}</td>
                      <td>{displayCount(row.issue_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!state.loading && !state.error && selectedTable && (
            <>
              <button
                type="button"
                className="rp-dq-back-to-tables"
                onClick={() => setSelectedTable('')}
              >
                ← Back to source tables
              </button>
              {records.length === 0 ? (
                <div className="rp-inline-empty">No records are available for this source table.</div>
              ) : (
                <div className="rp-dq-table-wrap">
                  <table className="rp-dq-table rp-dq-record-table">
                    <thead>
                      <tr>
                        <th>Source table</th><th>Record identifier</th><th>Affected field</th>
                        <th>Exact issue description</th><th>Existing value</th>
                        <th>Expected / valid format</th><th>Rule failed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recordRows.map(row => (
                        <tr key={row.key}>
                          <td>{row.sourceTable}</td>
                          <td><strong>{row.recordId}</strong></td>
                          <td>{row.affectedField}</td>
                          <td>{row.issueDescription}</td>
                          <td>{row.existingValue}</td>
                          <td>{row.expectedFormat}</td>
                          <td>{row.failedRule}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

      </section>
    </div>
  )
}

export default function DataQualityReportingView() {
  const source = useReportingSource()
  const [reloadToken, setReloadToken] = useState(0)
  const [selectedMetric, setSelectedMetric] = useState(null)
  const [qualityMode, setQualityMode] = useState('table')
  const [chartExplanation, setChartExplanation] = useState(null)
  const [recordDrilldown, setRecordDrilldown] = useState(null)
  const [selectedOptionalReports, setSelectedOptionalReports] = useState([])
  const { data, loading, error } = useAbortableReport(
    async signal => {
      const payload = await api.getDataQualityReport(source, { signal })
      return validateQualityPayload(payload, source)
    },
    [source, reloadToken],
  )

  useEffect(() => {
    setSelectedMetric(null)
    setQualityMode('table')
    setChartExplanation(null)
    setRecordDrilldown(null)
    setSelectedOptionalReports([])
  }, [source])

  const rawSummary = data?.summary || {}
  const fieldStandardization = Array.isArray(data?.field_standardization)
    ? data.field_standardization
    : []
  const standardizationRules = Array.isArray(data?.standardization_rules)
    ? data.standardization_rules
    : []
  const issueSummary = Array.isArray(data?.issue_summary) ? data.issue_summary : []
  const rawTableScores = Array.isArray(data?.score_by_table) ? data.score_by_table : []
  const rawFieldScores = Array.isArray(data?.score_by_field)
    ? data.score_by_field
    : fieldStandardization
  const rawDimensions = Array.isArray(data?.quality_dimensions) ? data.quality_dimensions : []
  const metricDefinitions = data?.metric_definitions || {}

  const totalRecords = firstNumber(
    rawSummary.total_records,
    rawSummary.total_records_ingested,
  )
  const recordsCleansed = firstNumber(
    rawSummary.records_cleansed,
    rawSummary.records_changed,
  )
  const recordsCleansedPercent = firstNumber(
    rawSummary.records_changed_rate,
    safePercent(recordsCleansed, totalRecords),
  )
  const healthyRecords = firstNumber(rawSummary.healthy_records)
  const atRiskRecords = firstNumber(rawSummary.at_risk_records)
  const needsReviewRecords = firstNumber(rawSummary.needs_review_records)
  const healthyRecordsPercent = firstNumber(
    rawSummary.healthy_records_pct,
    safePercent(healthyRecords, totalRecords),
  )
  const atRiskRecordsPercent = firstNumber(
    rawSummary.at_risk_records_pct,
    safePercent(atRiskRecords, totalRecords),
  )
  const needsReviewRecordsPercent = firstNumber(
    rawSummary.needs_review_records_pct,
    safePercent(needsReviewRecords, totalRecords),
  )
  const fieldsMonitored = firstNumber(
    rawSummary.fields_monitored,
    Array.isArray(data?.field_standardization) ? fieldStandardization.length : null,
  )
  const issueCountsComplete = issueSummary.length > 0
    && issueSummary.every(issue => {
      const value = numericValue(issue?.count)
      return value !== null && value >= 0
    })
  const issueTotal = issueCountsComplete
    ? issueSummary.reduce((sum, issue) => sum + numericValue(issue?.count), 0)
    : null
  const activeIssues = firstNumber(rawSummary.active_issues, issueTotal)
  const overallScore = firstNumber(
    rawSummary.overall_data_quality_score,
    rawSummary.average_quality_score,
    data?.schema_version === 2 ? null : rawSummary.conformance_score,
  )
  const derivedRecordsNeedingReview = (
    atRiskRecords === null || needsReviewRecords === null
      ? null
      : atRiskRecords + needsReviewRecords
  )
  const recordsNeedingReview = firstNumber(
    rawSummary.affected_records,
    derivedRecordsNeedingReview,
  )
  const qualityCaveat = String(data?.quality_caveat || '').trim()
  const overallTone = qualityCaveat ? REPORT_COLORS.amber : scoreColor(overallScore)
  const kpis = [
    {
      key: 'records_ingested',
      label: 'Total Records',
      value: displayCount(totalRecords),
      rawValue: totalRecords,
      detail: 'Physical input rows assessed in this source snapshot',
      color: REPORT_COLORS.blue,
      numerator: totalRecords,
      calculation: 'Physical rows represented in the selected source system input artifact.',
      drilldown: {
        category: 'all',
        expectedTotal: totalRecords,
        title: 'All records in the quality snapshot',
        description: 'Every physical input record represented in this source-scoped quality report.',
      },
    },
    {
      key: 'overall_data_quality_score',
      label: 'Overall Data Quality Score',
      value: displayPercent(overallScore),
      rawValue: overallScore,
      detail: 'Equal-weight mean of the measured quality dimensions',
      color: scoreColor(overallScore),
      numerator: overallScore,
      calculation: 'Equal-weight mean of completeness, validity, consistency, and uniqueness.',
    },
    {
      key: 'healthy_records_pct',
      label: 'Healthy Records',
      value: displayCount(healthyRecords),
      rawValue: healthyRecords,
      detail: `${displayPercent(healthyRecordsPercent)} with zero current findings`,
      color: REPORT_COLORS.green,
      numerator: healthyRecords,
      denominator: totalRecords,
      calculation: 'Records with zero active issues divided by total input records.',
      drilldown: {
        category: 'healthy',
        expectedTotal: healthyRecords,
        title: 'Healthy records',
        description: 'Records with no missing, invalid, inconsistent, duplicate, or rejection finding.',
      },
    },
    {
      key: 'needs_review_records',
      label: 'Records Needing Review',
      value: displayCount(recordsNeedingReview),
      rawValue: recordsNeedingReview,
      detail: `${displayPercent(safePercent(recordsNeedingReview, totalRecords))} with findings or blocked`,
      color: REPORT_COLORS.amber,
      numerator: recordsNeedingReview,
      denominator: totalRecords,
      calculation: 'Distinct non-healthy records: standardized records with findings plus rejected or blocked records.',
      drilldown: {
        category: 'affected',
        expectedTotal: recordsNeedingReview,
        title: 'Records needing review',
        description: 'The deduplicated union of standardized records with current findings and rejected or blocked records.',
      },
    },
  ].filter(metric => numericValue(metric.rawValue) !== null)

  const dimensionRows = DIMENSION_META.map(meta => {
    const dimension = rawDimensions.find(item => item?.key === meta.key)
    const score = numericValue(dimension?.score)
    const measured = score !== null && dimension?.available !== false
    const numerator = numericValue(dimension?.numerator)
    const denominator = numericValue(dimension?.denominator)
    const evidence = numerator !== null && denominator !== null
      ? `${displayCount(numerator)} of ${displayCount(denominator)} evaluated`
      : ''

    return {
      ...meta,
      label: dimension?.label || meta.label,
      value: measured ? score : 0,
      measured,
      calculation: dimension?.calculation,
      source: dimension?.source,
      sub: measured
        ? (evidence || 'Measured in the current source snapshot')
        : (dimension?.reason || 'Not available in the current source artifacts'),
    }
  }).filter(row => row.measured)
  const accuracyDimension = rawDimensions.find(row => row?.key === 'accuracy')
  const accuracyScore = accuracyDimension?.available === false
    ? null
    : numericValue(accuracyDimension?.score)

  const tableHeatmapRows = rawTableScores
    .slice(0, 8)
    .map(row => ({
      label: formatLabel(row?.table),
      sub: [
        numericValue(row?.records) === null ? '' : `${displayCount(row.records)} records`,
        numericValue(row?.active_issues) === null ? '' : `${displayCount(row.active_issues)} issues`,
      ].filter(Boolean).join(' | '),
      overall: firstNumber(row?.score, row?.quality_score, row?.conformance),
      completeness: firstNumber(row?.completeness),
      validity: firstNumber(row?.validity),
      consistency: firstNumber(row?.consistency),
      uniqueness: firstNumber(row?.uniqueness),
    }))
    .filter(row => (
      numericValue(row.overall) !== null
      && [row.completeness, row.validity, row.consistency, row.uniqueness]
        .some(value => numericValue(value) !== null)
    ))

  const fieldQualityRows = rawFieldScores
    .map(row => ({
      tableName: (row?.table_names || row?.tables || [])
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .join(', ') || 'Source table unavailable',
      fieldName: String(row?.attribute || row?.field || '').trim(),
      issueCount: firstNumber(row?.issue_count, row?.active_issues),
      impactedRecords: firstNumber(row?.impacted_records, row?.affected_records),
      qualityScore: firstNumber(row?.score, row?.quality_score, row?.conformance),
    }))
    .filter(row => (
      numericValue(row.issueCount) !== null
      && numericValue(row.impactedRecords) !== null
      && numericValue(row.qualityScore) !== null
    ))
    .sort((left, right) => right.issueCount - left.issueCount)

  const paretoTotal = issueTotal
  const paretoRows = (issueCountsComplete ? issueSummary : [])
    .map((issue, index) => {
      const count = numericValue(issue?.count)
      const share = safePercent(count, paretoTotal)
      return {
        label: issue?.type || 'Unclassified issue',
        value: count,
        color: ISSUE_COLORS[index % ISSUE_COLORS.length],
        sub: [
          share === null ? '' : `${displayPercent(share)} of findings`,
          issue?.description,
        ].filter(Boolean).join(' | '),
      }
    })
    .filter(row => row.value > 0)
    .sort((left, right) => right.value - left.value)

  const fieldFindingRows = rawFieldScores
    .map(row => {
      const affected = firstNumber(row?.impacted_records, row?.affected_records, row?.active_issues)
      return {
        label: formatLabel(row?.attribute || row?.field),
        tableName: (row?.table_names || row?.tables || []).map(formatLabel).join(', '),
        problem: row?.problem_description || 'A configured quality rule found values needing attention.',
        rule: row?.rule_name || row?.rule || 'Configured field validation',
        affected,
        affectedPercent: safePercent(affected, totalRecords),
        severity: row?.severity || 'Review',
        examples: Array.isArray(row?.example_values) ? row.example_values.slice(0, 5) : [],
      }
    })
    .filter(row => (
      numericValue(row.affected) !== null && row.affected > 0
    ))
    .sort((left, right) => (right.affected ?? -1) - (left.affected ?? -1))
    .slice(0, 8)

  const activeRuleRows = standardizationRules.filter(rule => (
    rule?.active === true
    && numericValue(rule?.processed) !== null
    && numericValue(rule?.processed) > 0
    && numericValue(rule?.issues) !== null
  ))
  const namedRuleRows = activeRuleRows
    .map(rule => ({
      label: rule?.name || formatLabel(rule?.rule),
      description: rule?.description || rule?.expected_format || 'Configured source-field validation.',
      processed: numericValue(rule?.processed) || 0,
      correctedRecords: numericValue(rule?.corrected_records) || 0,
      issues: numericValue(rule?.issues) || 0,
      qualityScore: firstNumber(rule?.quality_score, rule?.pass_rate),
    }))
    .sort((left, right) => right.issues - left.issues)
  const explainReport = data?.explain_report || {}
  const artifactSources = Array.isArray(explainReport.sources) ? explainReport.sources : []
  const resolvedArtifactSources = artifactSources
    .map(item => resolveArtifactName(item, source))
    .filter(Boolean)
  const qualityArtifactSources = resolvedArtifactSources
    .filter(item => /preprocessed|standardized/i.test(item))
  const artifactEvidence = qualityArtifactSources.length
    ? qualityArtifactSources.join(' · ')
    : 'Preprocessed input and standardized output referenced by the current report API.'
  const ruleArtifact = resolveArtifactName(metricDefinitions?.cleansing_rules?.source, source)
    || `Configured standardization rule catalog with field applicability from ${artifactEvidence}`
  const apiRequest = `Standardization report-metrics API for ${sourceLabel(source)}`
  const generatedAt = formatSnapshotTime(explainReport.generated_at)
    || 'Current artifact set; no as-of timestamp is published.'
  const evidenceContext = {
    sourceKey: source,
    sourceName: sourceLabel(source),
    scope: `Latest available ${sourceLabel(source)} preprocessing and standardization snapshot returned by this API${data?.schema_version ? ` (schema version ${data.schema_version})` : ''}.`,
    qualityArtifacts: artifactEvidence,
    ruleArtifact,
    api: apiRequest,
    generatedAt,
    caveat: qualityCaveat
      || explainReport.accuracy_note
      || 'Accuracy is excluded until trusted reference truth is connected.',
  }
  const measuredDimensionText = dimensionRows
    .filter(row => row.measured)
    .map(row => `${row.label} ${displayPercent(row.value)}`)
    .join(' + ')
  const measuredDimensions = dimensionRows.filter(row => row.measured)
  const compassEquation = measuredDimensions.length
    ? `Overall quality = (${measuredDimensions.map(row => displayPercent(row.value)).join(' + ')}) ÷ ${measuredDimensions.length} measured dimensions = ${displayPercent(overallScore)}.`
    : 'Overall quality equation is unavailable because no quality dimension has a current score.'
  const healthEquation = totalRecords !== null
    && totalRecords > 0
    && healthyRecords !== null
    && atRiskRecords !== null
    && needsReviewRecords !== null
    ? `Record reconciliation = ${displayCount(healthyRecords)} healthy + ${displayCount(atRiskRecords)} at risk + ${displayCount(needsReviewRecords)} needing review = ${displayCount(totalRecords)} input records.`
    : null
  const heatmapExample = tableHeatmapRows.find(row => row.overall !== null)
  const heatmapExampleScores = heatmapExample
    ? [
        heatmapExample.completeness,
        heatmapExample.validity,
        heatmapExample.consistency,
        heatmapExample.uniqueness,
      ]
      .filter(value => value !== null)
    : []
  const heatmapEquation = heatmapExample && heatmapExampleScores.length
    ? `${heatmapExample.label} overall quality = (${heatmapExampleScores.map(displayPercent).join(' + ')}) ÷ ${heatmapExampleScores.length} available dimensions = ${displayPercent(heatmapExample.overall)}.`
    : 'No displayed heatmap row has enough scored dimensions for a current numeric example.'
  const paretoExample = paretoRows[0]
  const paretoEquation = paretoExample && paretoTotal !== null
    ? `${paretoExample.label} share = ${displayCount(paretoExample.value)} findings ÷ ${displayCount(paretoTotal)} classified findings = ${displayPercent(safePercent(paretoExample.value, paretoTotal))}.`
    : 'No complete issue-category total is available for a current numeric share equation.'
  const fieldExample = fieldFindingRows[0]
  const fieldEquation = fieldExample
    ? `${fieldExample.label}: ${fieldExample.problem} ${displayCount(fieldExample.affected)} distinct records (${displayPercent(fieldExample.affectedPercent)}) are affected by ${fieldExample.rule}.`
    : 'No field-level quality example is available.'
  const weakestDimension = measuredDimensions.length
    ? measuredDimensions.reduce((weakest, current) => (
      current.value < weakest.value ? current : weakest
    ))
    : null
  const reportValues = [
    totalRecords === null ? null : `${displayCount(totalRecords)} records`,
    fieldsMonitored === null ? null : `${displayCount(fieldsMonitored)} monitored fields`,
    activeIssues === null ? null : `${displayCount(activeIssues)} active findings`,
    healthyRecords === null ? null : `${displayCount(healthyRecords)} healthy records`,
    atRiskRecords === null ? null : `${displayCount(atRiskRecords)} at-risk records`,
    needsReviewRecords === null ? null : `${displayCount(needsReviewRecords)} needing review`,
  ].filter(Boolean).join(' · ')
  const reportCalculation = [
    measuredDimensionText
      ? `Technical score method: ${compassEquation}`
      : null,
    healthEquation
      ? `Record-health method: ${healthEquation}`
      : null,
  ].filter(Boolean).join(' ')
  const qualityBusinessInsight = [
    healthyRecordsPercent === null || healthyRecords === null || totalRecords === null
      ? null
      : `${displayPercent(healthyRecordsPercent)} of records (${displayCount(healthyRecords)} of ${displayCount(totalRecords)}) currently have no quality finding.`,
    weakestDimension
      ? `The weakest measured quality area is ${weakestDimension.label} at ${displayPercent(weakestDimension.value)}.`
      : null,
    paretoExample && paretoTotal !== null
      ? `${paretoExample.label} is the largest classified issue group, with ${displayCount(paretoExample.value)} of ${displayCount(paretoTotal)} findings (${displayPercent(safePercent(paretoExample.value, paretoTotal))}).`
      : null,
    fieldExample
      ? `${fieldExample.label} is the highest-impact displayed field, affecting ${displayCount(fieldExample.affected)} records.`
      : null,
    'Business action: address the weakest measured area and the highest-volume finding first, then rerun the quality checks.',
    explainReport.identity_resolution_note
      || 'Identity-resolution readiness is not claimed because no governed pass/fail gate is present in the source artifacts.',
  ].filter(Boolean).join(' ')
  const reportDetail = {
    title: 'Data Quality summary',
    summary: `This is the readiness check for ${sourceLabel(source)} data before it is used for customer matching, audiences, personalization, or campaigns. It shows how much of the current data is usable and where missing, invalid, or inconsistent values could weaken customer experiences. The quality score includes only checks that have real evidence in this source snapshot.`,
    calculation: reportCalculation
      || 'The source-scoped reporting API calculates the score only from quality dimensions that have current measured evidence.',
    businessInsight: qualityBusinessInsight,
    values: reportValues,
    provenance: [
      { label: 'Selected source', value: evidenceContext.sourceName },
      { label: 'Reporting scope', value: evidenceContext.scope },
      { label: 'Current API value(s)', value: reportValues },
      { label: 'Evidence artifact(s)', value: artifactEvidence },
      { label: 'Source API', value: apiRequest },
      { label: 'Evidence grain', value: 'Quality score at source-snapshot grain; health at distinct-record grain; issues at field-finding grain.' },
      { label: 'Snapshot generated', value: generatedAt },
    ],
    callout: [
      evidenceContext.caveat,
      `Records Cleansed (${displayCount(recordsCleansed)}) counts records changed by a transformation; Healthy Records (${displayCount(healthyRecords)}) counts records with zero remaining findings. A cleansed record can still be at risk, so these measures are not opposites and do not need to match.`,
      explainReport.identity_resolution_note,
      explainReport.history_note || 'No historical trend is inferred from a single current artifact snapshot.',
    ].filter(Boolean).join(' '),
  }
  const withQualityEvidence = detail => ({
    ...detail,
    calculation: detail.calculation || detail.formula,
    businessInsight: detail.businessInsight || 'Use this evidence to identify whether the selected source requires remediation before downstream activation.',
    values: detail.values || detail.evidence,
    provenance: [
      { label: 'Selected source', value: evidenceContext.sourceName },
      { label: 'Reporting scope', value: evidenceContext.scope },
      { label: 'Current API value(s)', value: detail.values || detail.evidence },
      { label: 'Evidence artifact(s)', value: detail.artifact || artifactEvidence },
      { label: 'Source API', value: apiRequest },
      { label: 'Evidence grain', value: detail.grain },
      { label: 'Snapshot generated', value: generatedAt },
    ],
    callout: detail.callout || detail.caveat || evidenceContext.caveat,
    source: evidenceContext.sourceName,
    scope: evidenceContext.scope,
    artifact: detail.artifact || artifactEvidence,
  })
  const reportHasRows = totalRecords !== null && totalRecords > 0
  const hasOverallQualityScore = overallScore !== null
  const hasQualityDimensions = DIMENSION_META.every(meta => (
    dimensionRows.some(row => (
      row.key === meta.key && numericValue(row.value) !== null
    ))
  ))
  const hasRecordHealth = totalRecords !== null
    && totalRecords > 0
    && healthyRecords !== null
    && atRiskRecords !== null
    && needsReviewRecords !== null
  const hasHeatmap = tableHeatmapRows.length > 0 || fieldQualityRows.length > 0
  const hasPareto = paretoRows.length > 0 && paretoTotal !== null
  const hasRuleResults = namedRuleRows.length > 0
  const hasFieldFindings = fieldFindingRows.length > 0
  const primaryReports = [
    hasOverallQualityScore
      ? {
          key: 'overall-quality-score',
          name: 'Overall Data Quality Score',
          description: 'Shows the source-scoped equal-weight quality score as a simple score ring.',
        }
      : null,
    hasQualityDimensions
      ? {
          key: 'quality-dimensions',
          name: 'Completeness, Validity, Consistency and Uniqueness',
          description: 'Shows the four measured quality controls that contribute to the overall score.',
        }
      : null,
    hasPareto
      ? {
          key: 'top-quality-issues',
          name: 'Top Data Quality Issues',
          description: 'Ranks the available issue categories by finding volume so the largest remediation opportunities are visible first.',
        }
      : null,
    hasHeatmap
      ? {
          key: 'quality-by-table-field',
          name: 'Data Quality by Table and Field',
          description: 'Compares quality scores across available tables and monitored fields so business and data owners can see where quality is weakest.',
        }
      : null,
  ].filter(Boolean)
  const optionalReports = [
    hasRecordHealth
      ? {
          key: 'record-health',
          name: 'Record Health',
          description: 'Reconciles healthy, at-risk, and needs-review records and opens each source-backed record list.',
        }
      : null,
    hasFieldFindings
      ? {
          key: 'fields-needing-attention',
          name: 'Fields Needing Attention',
          description: 'Identifies the fields affecting the most records and shows the weakest measured quality area for each field.',
        }
      : null,
  ].filter(Boolean)
  const optionalReportOptions = optionalReports.map(report => ({
    key: report.key,
    label: report.name,
  }))
  const visibleOptionalReports = optionalReports.filter(report => (
    selectedOptionalReports.includes(report.key)
  ))
  const includedReports = [
    ...primaryReports,
    ...(hasRuleResults ? [{
      key: 'cleansing-rule-results',
      name: 'Cleansing Rule Results',
      description: 'Shows evaluated values, corrected records, remaining findings, and quality score for each actual configured rule.',
    }] : []),
    ...visibleOptionalReports,
  ]

  useEffect(() => {
    const availableKeys = new Set(optionalReports.map(report => report.key))
    setSelectedOptionalReports(current => {
      const next = current.filter(key => availableKeys.has(key))
      return next.length === current.length && next.every((key, index) => key === current[index])
        ? current
        : next
    })
  }, [hasRecordHealth, hasRuleResults, hasFieldFindings])
  const reportExplanation = (
    <>
      <p>{reportDetail.summary}</p>
      <div>
        <strong>Reports included</strong>
        <ul>
          {includedReports.map(report => (
            <li key={report.name}>
              <strong>{report.name}:</strong> {report.description}
            </li>
          ))}
        </ul>
      </div>
    </>
  )

  if (loading) {
    return (
      <div className="rp-report" data-page="quality">
        <ReportState type="loading" title="Loading data quality report">
          Fetching the current source-scoped quality snapshot for {sourceLabel(source)}.
        </ReportState>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rp-report" data-page="quality">
        <ReportState
          type="error"
          title="Data quality report unavailable"
          onRetry={() => setReloadToken(current => current + 1)}
        >
          {error}
        </ReportState>
      </div>
    )
  }

  if (!data?.summary || data?.data_available === false || !reportHasRows) {
    return (
      <div className="rp-report" data-page="quality">
        <ReportState
          type="empty"
          title={`No data quality artifacts for ${sourceLabel(source)}`}
          onRetry={() => setReloadToken(current => current + 1)}
        >
          Run preprocessing and standardization for this source system to calculate the report.
        </ReportState>
      </div>
    )
  }

  return (
    <div className="rp-report" data-page="quality">
      <ReportHero
        eyebrow={`${sourceLabel(source)} · current quality snapshot`}
        score="Current"
        scoreLabel="Quality snapshot"
        color={overallTone}
        title="Data Quality summary"
        summary={qualityCaveat || `${sourceLabel(source)} quality is calculated from completeness, validity, consistency, and exact-row uniqueness across ${displayCount(fieldsMonitored)} monitored fields. Accuracy remains unmeasured until a trusted reference dataset is connected.`}
        tags={[
          qualityCaveat ? 'Rule review required' : 'Verified current snapshot',
          'Explainable formula',
        ]}
        explanation={reportExplanation}
        evidence={{
          calculation: reportDetail.calculation,
          businessInsight: reportDetail.businessInsight,
          reportsIncluded: includedReports,
          provenance: reportDetail.provenance,
          callout: reportDetail.callout,
          source: evidenceContext.sourceName,
          scope: evidenceContext.scope,
          artifact: artifactEvidence,
          grain: 'Quality score at source-snapshot grain; health at distinct-record grain; issues at field-finding grain.',
        }}
      />

      <KpiGrid columns={4}>
        {kpis.map(metric => (
          <KpiCard
            key={metric.key}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            color={metric.color}
            evidence={metric.drilldown ? 'View records' : 'View calculation'}
            onClick={() => {
              if (metric.drilldown) {
                setRecordDrilldown(metric.drilldown)
                return
              }
              setSelectedMetric(buildMetricDetail(metric, metricDefinitions, evidenceContext))
            }}
          />
        ))}
      </KpiGrid>

      <MetricDetail detail={selectedMetric} onClose={() => setSelectedMetric(null)} />

      {(hasOverallQualityScore || hasQualityDimensions) && (
        <div className="rp-grid rp-grid-2 rp-dq-primary-row rp-dq-section-spaced">
          {hasOverallQualityScore && (
            <Panel
              title="Overall Data Quality Score"
              subtitle="The equal-weight quality result for the current source snapshot."
              action={(
                <QualityPanelAction
                  label="Explain score"
                  onClick={() => setChartExplanation(withQualityEvidence({
                    title: 'Overall Data Quality Score',
                    summary: 'The score ring shows the source-scoped equal-weight result returned by the current quality API.',
                    formula: `Completeness, validity, consistency, and uniqueness receive equal weight. Current equation: ${compassEquation}`,
                    evidence: `Overall quality is ${displayPercent(overallScore)} across the four required measured controls.`,
                    businessInsight: 'Use the overall score as a triage signal, then inspect the four measured dimensions and affected fields before activation.',
                    grain: 'One overall score for the latest selected-source quality snapshot.',
                    caveat: qualityCaveat || 'Accuracy is excluded because no trusted reference-truth dataset is connected.',
                  }))}
                />
              )}
            >
              <OverallQualityScore
                overallScore={overallScore}
                accuracyScore={accuracyScore}
              />
            </Panel>
          )}

          {hasQualityDimensions && (
            <Panel
              title="Completeness, Validity, Consistency and Uniqueness"
              subtitle="The four API-measured controls that determine the overall score."
              action={(
                <QualityPanelAction
                  label="Explain dimensions"
                  onClick={() => setChartExplanation(withQualityEvidence({
                    title: 'Completeness, Validity, Consistency and Uniqueness',
                    summary: 'The four-axis quality breakdown compares completeness, validity, consistency, and exact-row uniqueness in one source-backed visual.',
                    formula: `The four controls receive equal weight in the overall result. Current equation: ${compassEquation}`,
                    evidence: measuredDimensionText,
                    businessInsight: 'Use the weakest measured control to choose the first quality rule or field to investigate.',
                    grain: 'One score per measured quality dimension in the latest selected-source snapshot.',
                    caveat: qualityCaveat || 'Accuracy remains separate and unmeasured until trusted reference truth is connected.',
                  }))}
                />
              )}
            >
              <QualityCompass dimensions={dimensionRows} />
            </Panel>
          )}
        </div>
      )}

      {hasPareto && (
        <div className="rp-dq-wide-row rp-dq-section-spaced">
          <Panel
            title="Top Data Quality Issues"
            subtitle="Field-level findings creating the current quality workload."
            action={(
              <QualityPanelAction
                label="Explain issues"
                badge={`${displayCount(paretoTotal)} findings`}
                onClick={() => setChartExplanation(withQualityEvidence({
                  title: 'Top Data Quality Issues',
                  summary: `The chart contains ${paretoRows.length} current issue categories ranked by their number of field-level findings.`,
                  formula: `Categories are ranked by finding count. Current equation: ${paretoEquation}`,
                  values: `${displayCount(paretoTotal)} classified findings across ${paretoRows.length} issue categories in the current API response.`,
                  businessInsight: 'Use the largest categories as the first remediation workstreams; reducing the leading categories produces the greatest immediate workload reduction.',
                  grain: 'One missing, invalid, inconsistent, or rejected finding. A record can contribute more than one finding.',
                  caveat: issueCountsComplete
                    ? 'Finding totals are not distinct affected-record counts.'
                    : 'At least one issue category lacks a complete count, so shares and the total must not be treated as complete.',
                }))}
              />
            )}
          >
            <IssuePareto
              rows={paretoRows}
              total={paretoTotal}
              incomplete={issueSummary.length > 0 && !issueCountsComplete}
              onSelect={row => setRecordDrilldown({
                category: 'affected',
                issueType: row.label,
                title: `${row.label} records`,
                description: `${displayCount(row.value)} current findings; records are listed once even when several fields have this issue.`,
              })}
            />
          </Panel>
        </div>
      )}

      {hasHeatmap && (
        <div className="rp-dq-wide-row rp-dq-section-spaced">
          {hasHeatmap && <Panel
        className="rp-dq-heatmap-panel"
        title="Data Quality by Table and Field"
        subtitle="The fastest way to see where quality breaks across tables and monitored fields."
        action={(
          <QualityPanelAction
            label="Explain report"
            onClick={() => setChartExplanation(withQualityEvidence({
              title: 'Data Quality by Table and Field',
              summary: `The current view contains ${qualityMode === 'table' ? tableHeatmapRows.length : fieldQualityRows.length} ${qualityMode === 'table' ? 'table' : 'field'} rows returned for ${sourceLabel(source)}.`,
              formula: `Each cell displays the returned table or field score; overall quality is the equal-weight mean of its available dimensions. Current example: ${heatmapEquation}`,
              values: `${rawTableScores.length} table score rows and ${rawFieldScores.length} field score rows are available in the selected-source response.`,
              businessInsight: 'Use the lowest-scoring cells to locate the exact table or field creating quality risk, then route remediation to the responsible data owner.',
              grain: `One row per ${qualityMode === 'table' ? 'source table' : 'monitored source field'} in the latest selected-source snapshot.`,
              caveat: 'Accuracy is not displayed because no trusted reference-truth dataset is connected; an unavailable dimension is not treated as zero.',
            }))}
          >
            <div className="rp-dq-toggle" role="group" aria-label="Quality heatmap scope">
              <button
                type="button"
                className={qualityMode === 'table' ? 'is-active' : ''}
                aria-pressed={qualityMode === 'table'}
                onClick={() => setQualityMode('table')}
              >
                By table
              </button>
              <button
                type="button"
                className={qualityMode === 'field' ? 'is-active' : ''}
                aria-pressed={qualityMode === 'field'}
                onClick={() => setQualityMode('field')}
              >
                By field
              </button>
            </div>
          </QualityPanelAction>
        )}
        >
          {qualityMode === 'table'
            ? <QualityHeatmap rows={tableHeatmapRows} />
            : <FieldQualityTable rows={fieldQualityRows} />}
          {qualityCaveat && (
            <div className="rp-dq-caveat"><strong>Rule-review caveat:</strong> {qualityCaveat}</div>
          )}
          </Panel>}
        </div>
      )}

      {hasRuleResults && (
        <div className="rp-dq-wide-row rp-dq-section-spaced">
          <Panel
            title="Cleansing Rule Results"
            subtitle="Actual configured rules, evaluated values, corrected records, and remaining findings."
            action={<span className="rp-dq-rule-count">{displayCount(namedRuleRows.length)} rules</span>}
          >
            <RuleResults rows={namedRuleRows} />
          </Panel>
        </div>
      )}

      <AddReportSelector
        reports={optionalReportOptions}
        selected={selectedOptionalReports}
        onAdd={key => setSelectedOptionalReports(current => (
          current.includes(key) ? current : [...current, key]
        ))}
        onRemove={key => setSelectedOptionalReports(current => (
          current.filter(selectedKey => selectedKey !== key)
        ))}
        title="Add a detailed data quality report"
        description="The four required quality reports stay visible. Add a source-backed operational drill-down when you need more detail."
      />

      {selectedOptionalReports.includes('record-health') && hasRecordHealth && (
        <div className="rp-grid rp-grid-2 rp-dq-secondary-row rp-dq-optional-row">
          {selectedOptionalReports.includes('record-health') && hasRecordHealth && (
            <Panel
              title="Record Health"
              subtitle="Healthy, at-risk, and rejected records reconciled to the total input population."
              action={(
                <QualityPanelAction
                  label="View formula"
                  onClick={() => setChartExplanation(withQualityEvidence({
                    title: 'Record Health',
                    summary: `${displayCount(healthyRecords)} records are healthy, ${displayCount(atRiskRecords)} are standardized with findings, and ${displayCount(needsReviewRecords)} were rejected or blocked.`,
                    formula: healthEquation,
                    evidence: 'Each record belongs to exactly one health state. Top issue counts use field-finding grain and can be larger than the affected-record population.',
                    values: `${displayCount(healthyRecords)} healthy; ${displayCount(atRiskRecords)} at risk; ${displayCount(needsReviewRecords)} needing review; ${displayCount(totalRecords)} total.`,
                    businessInsight: 'Open an individual state to inspect the exact source-backed record list; prioritize rejected records first, then the at-risk population.',
                    grain: 'Distinct physical input records in three mutually exclusive states.',
                    caveat: 'A record can contribute several issue findings but is counted once in record health.',
                  }))}
                />
              )}
            >
              <RecordHealthComposition
                total={totalRecords}
                healthy={healthyRecords}
                atRisk={atRiskRecords}
                review={needsReviewRecords}
                onSelect={row => setRecordDrilldown({
                  category: row.key,
                  title: row.label,
                  description: row.detail,
                })}
              />
            </Panel>
          )}
        </div>
      )}

      {selectedOptionalReports.includes('fields-needing-attention') && hasFieldFindings && (
        <div className="rp-dq-wide-row">
          <Panel
          title="Fields Needing Attention"
          subtitle="Drill-down priorities for the selected source and rule scope."
          action={(
            <QualityPanelAction
              label="Explain fields"
              badge={`${fieldFindingRows.length} fields`}
              onClick={() => setChartExplanation(withQualityEvidence({
                title: 'Fields Needing Attention',
                summary: 'Each row ranks a monitored field by distinct affected records in the selected source snapshot.',
                formula: `Affected percentage = distinct records affected for the field ÷ total source records. Current example: ${fieldEquation}`,
                evidence: `${fieldFindingRows.length} highest-impact fields are shown from the current source-scoped quality payload.`,
                businessInsight: 'Use this ranking to assign field-level remediation in priority order, starting with high affected-record counts and the weakest reported dimension.',
                grain: 'One row per monitored field; affected counts are distinct records for that field.',
                caveat: 'The table is a ranked evidence surface, not a complete record-level remediation queue.',
              }))}
            />
          )}
          bodyClassName="rp-dq-table-body"
          >
            <FieldFindingsTable rows={fieldFindingRows} />
          </Panel>
        </div>
      )}

      <ContractStrip status={data?.schema_version ? `Schema v${data.schema_version}` : 'Artifact-backed'}>
        Calculated for {sourceLabel(source)} from {artifactEvidence}
      </ContractStrip>
      <MetricDetail
        detail={chartExplanation}
        onClose={() => setChartExplanation(null)}
      />
      <RecordDrilldown
        request={recordDrilldown}
        source={source}
        onClose={() => setRecordDrilldown(null)}
      />
    </div>
  )
}
