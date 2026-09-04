import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import {
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
import './CleaningStandardizationReporting.css'

const RULE_COLORS = [
  REPORT_COLORS.blue,
  REPORT_COLORS.cyan,
  REPORT_COLORS.violet,
  REPORT_COLORS.magenta,
  REPORT_COLORS.green,
  REPORT_COLORS.amber,
]

const CLEANSING_GRAIN = {
  records_ingested: 'One physical row in the selected source’s preprocessed input; it is not a unique-customer count.',
  standardized: 'One distinct input record with a matching row in standardized output.',
  rejected: 'One distinct input record without a matching row in standardized output.',
  records_changed: 'One distinct record with at least one monitored, nonblank transformation.',
  duplicate_pairs_merged: 'One source-record-to-golden-profile lineage row; it is not a unique duplicate pair.',
  needs_review: 'One distinct input record with at least one current quality finding.',
  active_rules: 'One configured rule family applicable to at least one selected-source field.',
  processing_stages_available: 'One expected current-stage artifact, reconciled from the preprocessing and standardization outputs exposed by this source snapshot.',
}

const CLEANSING_CAVEAT = {
  records_ingested: 'Input records are physical rows, not unique customers or profiles.',
  standardized: 'Standardized output coverage does not by itself prove business accuracy.',
  rejected: 'Rejected is derived only from current source-scoped input and standardized evidence.',
  records_changed: 'A record is counted once even when several monitored fields changed.',
  duplicate_pairs_merged: 'This value is golden-profile lineage, so it must not be relabelled as unique duplicate pairs.',
  needs_review: 'One record may contribute multiple findings even though it is counted once here.',
  active_rules: 'Active means applicable in this source report, not a historical execution total.',
  processing_stages_available: 'This measures current artifact availability, not historical job executions or run reliability.',
}

const CLEANSING_MEANING = {
  records_ingested: 'The physical input population covered by this cleansing and standardization snapshot.',
  standardized: 'The number of input records successfully reconciled to a standardized output record.',
  rejected: 'The input records that have no corresponding standardized output.',
  records_changed: 'The records where at least one monitored nonblank value was transformed.',
  duplicate_pairs_merged: 'The source records linked to golden profiles in the lineage artifact.',
  needs_review: 'The distinct records requiring stewardship because at least one quality finding remains.',
  active_rules: 'The configured rule families that apply to fields in the selected source.',
  processing_stages_available: 'The share of expected preprocessing and standardization stage artifacts currently available for reporting.',
}

const CLEANSING_BUSINESS_INSIGHT = {
  records_ingested: 'Use this input population as the baseline for throughput, rejection, change, and review rates and to estimate reprocessing volume.',
  standardized: 'Use this to confirm pipeline coverage; investigate any gap before releasing records downstream.',
  rejected: 'Use this as the immediate exception queue because rejected records cannot participate in downstream identity or activation flows.',
  records_changed: 'Use this to quantify transformation impact and identify whether aggressive rules need review.',
  duplicate_pairs_merged: 'Use this to understand profile-lineage coverage, not duplicate-pair volume; inspect identity reporting for cluster-level decisions.',
  needs_review: 'Use this to size and prioritize the stewardship queue before downstream use.',
  active_rules: 'Use this to verify governance coverage; combine it with rule effectiveness before deciding whether the rule set is sufficient.',
  processing_stages_available: 'Use this to confirm that the current report has the expected stage evidence; use execution history, when available, for SLA decisions.',
}

function numericValue(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function count(value) {
  return formatCount(numericValue(value), 'N/A')
}

function percent(value) {
  return formatPercent(numericValue(value), 1, 'N/A')
}

function label(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
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

function cleansingArtifactFor(metricKey, definitionSource, context) {
  const definedArtifact = resolveArtifactName(definitionSource, context.sourceKey)
  if (definedArtifact) return definedArtifact

  const artifactByMetric = {
    standardized: context.standardizedArtifact,
    rejected: context.processingArtifacts,
    records_changed: context.processingArtifacts,
    needs_review: context.processingArtifacts,
    active_rules: context.ruleArtifact,
    processing_stages_available: context.processingArtifacts,
  }
  return artifactByMetric[metricKey] || context.reportArtifacts
}

function cleansingMetricEquation(metric, numerator, denominator, rawValue) {
  const currentRate = numerator !== null && denominator !== null
    ? safePercent(numerator, denominator)
    : null
  switch (metric.key) {
    case 'standardized':
      return `Standardized rate = ${count(numerator)} standardized records ÷ ${count(denominator)} input records = ${percent(currentRate)}; displayed count = ${metric.value}.`
    case 'rejected':
      return `Rejected rate = ${count(numerator)} rejected records ÷ ${count(denominator)} input records = ${percent(currentRate)}; displayed count = ${metric.value}.`
    case 'records_changed':
      return `Changed-record rate = ${count(numerator)} changed records ÷ ${count(denominator)} input records = ${percent(currentRate)}; displayed count = ${metric.value}.`
    case 'needs_review':
      return `Needs-review rate = ${count(numerator)} affected records ÷ ${count(denominator)} input records = ${percent(currentRate)}; displayed count = ${metric.value}.`
    case 'records_ingested':
      return `Records ingested = ${count(rawValue)} physical preprocessed input rows.`
    case 'duplicate_pairs_merged':
      return `Golden-linked records = ${count(rawValue)} source-record-to-profile lineage rows.`
    case 'active_rules':
      return `Active rules = ${count(rawValue)} configured rule families applicable to the selected source.`
    case 'processing_stages_available':
      return `Processing-stage availability = ${count(numerator)} available stage artifacts ÷ ${count(denominator)} expected stage artifacts = ${metric.value}.`
    default:
      return `Current API value = ${metric.value}.`
  }
}

function detailFor(data, metric, context) {
  const definition = data?.metric_definitions?.[metric.key] || {}
  const numerator = numericValue(definition.numerator ?? metric.numerator)
  const denominator = numericValue(definition.denominator ?? metric.denominator)
  const rawValue = numericValue(definition.value ?? metric.rawValue)
  const evidence = cleansingMetricEquation(
    metric,
    numerator,
    denominator,
    rawValue,
  )
  const artifact = cleansingArtifactFor(metric.key, definition.source, context)
  const grain = CLEANSING_GRAIN[metric.key]
  return {
    title: metric.label,
    summary: `${CLEANSING_MEANING[metric.key] || metric.detail} Current result: ${metric.value}.`,
    calculation: `${definition.calculation || metric.calculation || 'The selected-source reporting service returns this value directly.'} Current equation: ${evidence}`,
    businessInsight: CLEANSING_BUSINESS_INSIGHT[metric.key],
    provenance: [
      { label: 'Selected source', value: context.sourceName },
      { label: 'Reporting scope', value: context.scope },
      { label: 'Current API value(s)', value: evidence },
      { label: 'Evidence artifact(s)', value: artifact },
      { label: 'Source API', value: context.api },
      { label: 'Evidence grain', value: grain },
      { label: 'Snapshot generated', value: context.generatedAt },
    ],
    callout: CLEANSING_CAVEAT[metric.key] || context.caveat,
    source: context.sourceName,
    scope: context.scope,
    artifact,
    grain,
  }
}

function CleansingPanelAction({ label: actionLabel, badge, onClick, children }) {
  return (
    <div className="rp-cs-panel-tools">
      {badge && <span className="rp-panel-badge">{badge}</span>}
      {children}
      <button type="button" className="rp-cs-panel-action" onClick={onClick}>
        {actionLabel} <span aria-hidden="true">↗</span>
      </button>
    </div>
  )
}

function CleansingOutcomeChart({
  input,
  standardized,
  changed,
  review,
  rejected,
  linked,
}) {
  if (input === null || input <= 0) {
    return <div className="rp-inline-empty">No total input-record count is available for the transformation rates.</div>
  }

  const standardizedRate = safePercent(standardized, input)
  const changedRate = safePercent(changed, input)
  const reviewRate = safePercent(review, input)
  const rejectedRate = safePercent(rejected, input)
  const outcomes = [
    {
      label: 'Standardized',
      value: standardized,
      rate: standardizedRate,
      detail: 'Output reconciliation',
      color: REPORT_COLORS.green,
    },
    {
      label: 'Records changed',
      value: changed,
      rate: changedRate,
      detail: 'At least one monitored value changed',
      color: REPORT_COLORS.cyan,
    },
    {
      label: 'Needs review',
      value: review,
      rate: reviewRate,
      detail: 'Distinct affected records',
      color: REPORT_COLORS.amber,
    },
    {
      label: 'Rejected',
      value: rejected,
      rate: rejectedRate,
      detail: 'No standardized output',
      color: REPORT_COLORS.red,
    },
  ].filter(row => numericValue(row.value) !== null && row.rate !== null)

  return (
    <div className="rp-cs-outcome-chart">
      <div className="rp-cs-outcome-baseline">
        <div>
          <span>Input baseline</span>
          <strong>{count(input)} records</strong>
        </div>
        <small>Each outcome is measured independently against the same input population.</small>
      </div>

      <div className="rp-cs-outcome-axis" aria-hidden="true">
        <span>Outcome</span>
        <div><i>0%</i><i>25%</i><i>50%</i><i>75%</i><i>100%</i></div>
        <span>Result</span>
      </div>

      <div
        className="rp-cs-outcome-plot"
        role="img"
        aria-label={`Cleansing outcomes measured independently against ${count(input)} input records`}
      >
        {outcomes.map((row, index) => {
          const rate = Math.max(0, Math.min(row.rate, 100))
          return (
            <div
              key={row.label}
              className="rp-cs-outcome-row"
              style={{
                '--rp-signal': row.color,
                '--rp-value': `${rate}%`,
                '--rp-delay': `${index * 90}ms`,
              }}
              title={`${row.label}: ${percent(row.rate)} (${count(row.value)} records)`}
            >
              <div className="rp-cs-outcome-label">
                <i aria-hidden="true" />
                <span><strong>{row.label}</strong><small>{row.detail}</small></span>
              </div>
              <div className="rp-cs-outcome-lane">
                <span><i /><b aria-hidden="true" /></span>
              </div>
              <div className="rp-cs-outcome-value">
                <strong>{percent(row.rate)}</strong>
                <small>{count(row.value)} records</small>
              </div>
            </div>
          )
        })}
      </div>

      {numericValue(linked) !== null && (
        <div className="rp-cs-transform-lineage">
          <strong>{count(linked)} golden-linked records</strong>
          <span>Profile-lineage evidence is separate from the cleansing outcomes above.</span>
        </div>
      )}
    </div>
  )
}

function RuleEffectiveness({ rows, caveat }) {
  if (!rows.length) {
    return <div className="rp-inline-empty">No active rule effectiveness evidence is available.</div>
  }

  return (
    <div className="rp-cs-effectiveness">
      {rows.map((row, index) => {
        const width = row.value === null ? 0 : Math.max(0, Math.min(row.value, 100))
        return (
          <div
            key={`${row.label}-${index}`}
            className="rp-cs-effectiveness-row"
            style={{ '--rp-signal': row.color, '--rp-delay': `${index * 70}ms` }}
          >
            <div>
              <span>
                {row.label}
                <small>
                  {row.corrected > 0
                    ? `${count(row.corrected)} corrections`
                    : 'No corrections recorded'}
                </small>
              </span>
              <b>{percent(row.value)}</b>
            </div>
            <span className="rp-cs-effectiveness-track"><i style={{ '--rp-value': `${width}%` }} /></span>
          </div>
        )
      })}
      {caveat && <div className="rp-cs-caveat"><strong>Rule review:</strong> {caveat}</div>}
    </div>
  )
}

function CorrectionLollipop({ rows, totalChanges }) {
  if (!rows.length) {
    return <div className="rp-inline-empty">No rule correction evidence is available.</div>
  }
  const max = Math.max(...rows.map(row => Number(row.value) || 0), 1)
  const topTwo = rows.slice(0, 2).reduce((sum, row) => sum + (Number(row.value) || 0), 0)
  const classified = rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0)
  const denominator = numericValue(totalChanges) ?? classified

  return (
    <div className="rp-cs-lollipop-wrap">
      <div className="rp-cs-lollipop">
        {rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className="rp-cs-lollipop-row"
            style={{ '--rp-signal': row.color, '--rp-delay': `${index * 70}ms` }}
          >
            <span>{row.label}</span>
            <span className="rp-cs-lollipop-line">
              <i style={{ '--rp-value': `${safePercent(row.value, max) || 0}%` }} />
            </span>
            <b>{count(row.value)}</b>
          </div>
        ))}
      </div>
      <p className={`rp-cs-caption ${classified === denominator ? '' : 'is-warning'}`}>
        <strong>{classified === denominator ? 'Concentration:' : 'Partial rule evidence:'}</strong>{' '}
        the top two rule families produce {percent(safePercent(topTwo, denominator))} of {count(denominator)} recorded field changes.
      </p>
    </div>
  )
}

function FieldEvidenceTable({ rows }) {
  return (
    <div className="rp-cs-table-wrap">
      <table className="rp-cs-table">
        <thead>
          <tr><th>Field</th><th>Rule</th><th>Quality</th><th>Corrected</th><th>Findings</th></tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.label}-${index}`}>
              <td><strong>{row.label}</strong><small>{count(row.total)} applicable</small></td>
              <td>{row.rule}</td>
              <td>{percent(row.quality)}</td>
              <td>{count(row.corrected)}</td>
              <td>{count(row.findings)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="rp-inline-empty">No field-level standardization evidence is available.</div>}
    </div>
  )
}

export default function CleaningStandardization_ReportView() {
  const source = useReportingSource('media')
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedMetric, setSelectedMetric] = useState(null)
  const [chartExplanation, setChartExplanation] = useState(null)

  useEffect(() => {
    setSelectedMetric(null)
    setChartExplanation(null)
  }, [source])

  const reportState = useAbortableReport(
    async signal => {
      const payload = await api.getStandardizationReportMetrics(source, { signal })
      const returnedSource = String(payload?.source_system || '').trim().toLowerCase()
      if (returnedSource !== source) {
        throw new Error(
          `Cleansing reporting returned "${returnedSource || 'an unidentified source'}" `
          + `instead of "${source}". Cross-source fallback is blocked.`
        )
      }
      return payload
    },
    [source, refreshKey],
  )

  const model = useMemo(() => {
    const data = reportState.data || {}
    const summary = data.summary || {}
    const rules = Array.isArray(data.standardization_rules)
      ? data.standardization_rules
      : []
    const fields = Array.isArray(data.field_standardization)
      ? data.field_standardization
      : []

    const input = numericValue(summary.total_records_ingested)
    const standardized = numericValue(summary.total_standardized)
    const changed = numericValue(summary.records_changed)
    const rejected = numericValue(summary.total_rejected)
    const review = numericValue(summary.needs_steward_review)
    const processingRate = safePercent(standardized, input)
    const changedRate = safePercent(changed, input)
    const reviewRate = safePercent(review, input)

    const effectiveness = rules
      .filter(rule => (
        numericValue(rule?.processed) > 0
        && numericValue(rule?.pass_rate) !== null
        && numericValue(rule?.corrected) !== null
        && numericValue(rule?.issues) !== null
      ))
      .map((rule, index) => ({
        label: rule.rule || `Rule ${index + 1}`,
        value: numericValue(rule.pass_rate),
        corrected: numericValue(rule.corrected),
        processed: numericValue(rule.processed),
        issues: numericValue(rule.issues),
        color: RULE_COLORS[index % RULE_COLORS.length],
        sub: `${count(rule.processed)} applicable · ${count(rule.issues)} findings`,
      }))
      .sort((left, right) => (left.value ?? 101) - (right.value ?? 101))

    const correctionFootprint = rules
      .filter(rule => (
        numericValue(rule?.processed) > 0
        && numericValue(rule?.corrected) !== null
      ))
      .map((rule, index) => ({
        label: rule.rule || `Rule ${index + 1}`,
        value: numericValue(rule.corrected),
        color: RULE_COLORS[index % RULE_COLORS.length],
        sub: `${count(rule.processed)} applicable · ${count(rule.fields?.length)} fields`,
      }))
      .sort((left, right) => right.value - left.value)

    const fieldEvidence = fields
      .map((field, index) => ({
        label: label(field.attribute || field.field),
        rule: field.rule,
        quality: numericValue(field.quality_score ?? field.conformance),
        corrected: numericValue(field.corrected),
        findings: numericValue(field.active_issues),
        total: numericValue(field.total),
        color: RULE_COLORS[index % RULE_COLORS.length],
      }))
      .filter(field => (
        Boolean(field.label)
        && Boolean(field.rule)
        && field.quality !== null
        && field.corrected !== null
        && field.findings !== null
        && field.total !== null
      ))
      .sort((left, right) => (right.corrected || 0) - (left.corrected || 0))

    return {
      data,
      summary,
      input,
      standardized,
      changed,
      rejected,
      review,
      processingRate,
      changedRate,
      reviewRate,
      effectiveness,
      correctionFootprint,
      fieldEvidence,
      ruleTypes: Array.isArray(data.rule_types) ? data.rule_types : [],
    }
  }, [reportState.data])

  if (reportState.loading) {
    return (
      <div className="rp-report" data-page="cleansing">
        <ReportState title={`Loading ${sourceLabel(source)} cleansing evidence`}>
          Reconciling preprocessing, standardization, rule, and field-level artifacts.
        </ReportState>
      </div>
    )
  }

  if (reportState.error) {
    return (
      <div className="rp-report" data-page="cleansing">
        <ReportState
          type="error"
          title="Cleansing report unavailable"
          onRetry={() => setRefreshKey(value => value + 1)}
        >
          {reportState.error}
        </ReportState>
      </div>
    )
  }

  if (
    !model.data?.data_available
    || model.input === null
    || model.input <= 0
  ) {
    return (
      <div className="rp-report" data-page="cleansing">
        <ReportState
          type="empty"
          title={`No cleansing artifacts for ${sourceLabel(source)}`}
          onRetry={() => setRefreshKey(value => value + 1)}
        >
          Run preprocessing and standardization for this source system to calculate the report.
        </ReportState>
      </div>
    )
  }

  const summary = model.summary
  const overallScore = numericValue(summary.average_quality_score)
  const recordsChangedRate = model.changedRate
  const artifactStagesCompleted = numericValue(summary.artifact_stages_completed)
  const artifactStagesTotal = numericValue(summary.artifact_stages_total)
  const artifactStageRate = artifactStagesCompleted !== null
    && artifactStagesTotal !== null
    && artifactStagesTotal > 0
    ? safePercent(artifactStagesCompleted, artifactStagesTotal)
    : null
  const kpis = [
    {
      key: 'records_ingested',
      label: 'Records ingested',
      value: count(model.input),
      rawValue: model.input,
      detail: 'Preprocessed physical rows',
      color: REPORT_COLORS.blue,
      calculation: 'Physical rows in the selected source-scoped preprocessed union.',
    },
    {
      key: 'standardized',
      label: 'Standardized',
      value: count(model.standardized),
      rawValue: model.standardized,
      numerator: model.standardized,
      denominator: model.input,
      detail: `${percent(model.processingRate)} conformance`,
      color: REPORT_COLORS.green,
      calculation: 'Input rows with a matching standardized output.',
    },
    {
      key: 'rejected',
      label: 'Rejected',
      value: count(model.rejected),
      rawValue: model.rejected,
      numerator: model.rejected,
      denominator: model.input,
      detail: `${percent(safePercent(model.rejected, model.input))} of input`,
      color: REPORT_COLORS.red,
      calculation: 'Input rows without a matching standardized output.',
    },
    {
      key: 'records_changed',
      label: 'Records changed',
      value: count(model.changed),
      rawValue: model.changed,
      numerator: model.changed,
      denominator: model.input,
      detail: `${percent(recordsChangedRate)} of input`,
      color: REPORT_COLORS.cyan,
      calculation: 'Distinct records with at least one monitored nonblank value changed.',
    },
    {
      key: 'duplicate_pairs_merged',
      label: 'Golden-linked records',
      value: count(summary.duplicate_pair_merged),
      rawValue: summary.duplicate_pair_merged,
      detail: 'Source-to-profile lineage rows',
      color: REPORT_COLORS.violet,
      calculation: 'Rows linked to golden profiles, including singleton-profile records where present.',
    },
    {
      key: 'needs_review',
      label: 'Needs review',
      value: count(model.review),
      rawValue: model.review,
      numerator: model.review,
      denominator: model.input,
      detail: `${percent(model.reviewRate)} of input`,
      color: REPORT_COLORS.amber,
      calculation: 'Distinct records with at least one current quality finding.',
    },
    {
      key: 'active_rules',
      label: 'Active rules',
      value: count(summary.active_rules),
      rawValue: summary.active_rules,
      detail: numericValue(summary.rule_types) === null
        ? 'Applicable rules in the current source'
        : `${count(summary.rule_types)} rule types`,
      color: REPORT_COLORS.violet,
      calculation: 'Configured rules with at least one applicable field in this source.',
    },
    ...(artifactStageRate === null ? [] : [{
      key: 'processing_stages_available',
      label: 'Processing stages available',
      value: `${count(artifactStagesCompleted)} / ${count(artifactStagesTotal)}`,
      rawValue: artifactStagesCompleted,
      numerator: artifactStagesCompleted,
      denominator: artifactStagesTotal,
      detail: `${percent(artifactStageRate)} of expected current artifacts`,
      color: REPORT_COLORS.blue,
      calculation: 'Available preprocessing and standardization stage artifacts divided by the expected current-stage artifacts.',
    }]),
  ].filter(metric => numericValue(metric.rawValue) !== null)
  const explainReport = model.data?.explain_report || {}
  const artifactSources = Array.isArray(explainReport.sources) ? explainReport.sources : []
  const resolvedArtifactSources = artifactSources
    .map(item => resolveArtifactName(item, source))
    .filter(Boolean)
  const reportArtifactSources = resolvedArtifactSources
    .filter(item => /preprocessed|standardized|superseded/i.test(item))
  const inputArtifact = resolvedArtifactSources.find(item => /preprocessed/i.test(item))
    || `Preprocessed input artifact (all_preprocessed.csv, ${sourceLabel(source)})`
  const standardizedArtifact = resolvedArtifactSources.find(item => /standardized/i.test(item))
    || `Standardized output artifact (all_standardized.csv, ${sourceLabel(source)})`
  const processingArtifacts = `${inputArtifact} · ${standardizedArtifact}`
  const artifactEvidence = reportArtifactSources.length
    ? reportArtifactSources.join(' · ')
    : processingArtifacts
  const ruleArtifact = resolveArtifactName(
    model.data?.metric_definitions?.cleansing_rules?.source,
    source,
  ) || `Configured standardization rule catalog with field applicability from ${inputArtifact}`
  const apiRequest = `Standardization report-metrics API for ${sourceLabel(source)}`
  const generatedAt = formatSnapshotTime(explainReport.generated_at)
    || 'Current artifact set; no as-of timestamp is published.'
  const evidenceContext = {
    sourceKey: source,
    sourceName: sourceLabel(source),
    scope: `Latest available ${sourceLabel(source)} preprocessing and standardization snapshot returned by this API${model.data.schema_version ? ` (schema version ${model.data.schema_version})` : ''}.`,
    reportArtifacts: artifactEvidence,
    standardizedArtifact,
    processingArtifacts,
    ruleArtifact,
    api: apiRequest,
    generatedAt,
    caveat: model.data.quality_caveat
      || 'Changed records, field changes, findings, and golden-link rows use different grains and must not be added together.',
  }
  const transformationEquation = [
    model.input !== null && model.input > 0 && model.standardized !== null
      ? `Standardized rate = ${count(model.standardized)} standardized records ÷ ${count(model.input)} input records = ${percent(model.processingRate)}.`
      : null,
    model.input !== null && model.input > 0 && model.changed !== null
      ? `Changed-record rate = ${count(model.changed)} changed records ÷ ${count(model.input)} input records = ${percent(model.changedRate)}.`
      : null,
    model.input !== null && model.input > 0 && model.review !== null
      ? `Needs-review rate = ${count(model.review)} affected records ÷ ${count(model.input)} input records = ${percent(model.reviewRate)}.`
      : null,
    model.input !== null && model.input > 0 && model.rejected !== null
      ? `Rejected rate = ${count(model.rejected)} rejected records ÷ ${count(model.input)} input records = ${percent(safePercent(model.rejected, model.input))}.`
      : null,
  ].filter(Boolean).join(' ')
  const ruleExample = model.effectiveness[0]
  const ruleEquation = ruleExample && ruleExample.processed
    ? `${ruleExample.label}: pass rate = ${percent(ruleExample.value)}; correction share = ${count(ruleExample.corrected)} corrected cells ÷ ${count(ruleExample.processed)} applicable cells = ${percent(safePercent(ruleExample.corrected, ruleExample.processed))}.`
    : 'No active rule row has enough current values for a numeric effectiveness equation.'
  const correctionExample = model.correctionFootprint[0]
  const correctionMaximum = correctionExample?.value
  const correctionEquation = correctionExample && correctionMaximum !== null
    ? `${correctionExample.label}: lollipop length = ${count(correctionExample.value)} corrected cells ÷ ${count(correctionMaximum)} largest rule count = ${percent(safePercent(correctionExample.value, correctionMaximum))}; share of all field changes = ${count(correctionExample.value)} ÷ ${count(summary.total_field_changes)} = ${percent(safePercent(correctionExample.value, summary.total_field_changes))}.`
    : 'No rule correction row has enough current values for a numeric footprint equation.'
  const fieldExample = model.fieldEvidence[0]
  const fieldEquation = fieldExample && fieldExample.total
    ? `${fieldExample.label}: corrected share = ${count(fieldExample.corrected)} corrected cells ÷ ${count(fieldExample.total)} applicable cells = ${percent(safePercent(fieldExample.corrected, fieldExample.total))}; quality score = ${percent(fieldExample.quality)}; findings = ${count(fieldExample.findings)}.`
    : 'No field row has enough current values for a numeric standardization equation.'
  const reportValues = [
    model.input === null ? null : `${count(model.input)} input`,
    model.standardized === null ? null : `${count(model.standardized)} standardized`,
    model.rejected === null ? null : `${count(model.rejected)} rejected`,
    model.changed === null ? null : `${count(model.changed)} changed`,
    model.review === null ? null : `${count(model.review)} needing review`,
  ].filter(Boolean).join(' · ')
  const weakestRule = model.effectiveness[0]
  const largestCorrectionRule = model.correctionFootprint[0]
  const cleansingBusinessInsight = [
    model.processingRate === null || model.standardized === null || model.input === null
      ? null
      : `${percent(model.processingRate)} of input records (${count(model.standardized)} of ${count(model.input)}) produced standardized output.`,
    model.rejected === null
      ? null
      : `${count(model.rejected)} records were rejected and therefore are not represented in standardized output.`,
    model.reviewRate === null || model.review === null
      ? null
      : `${percent(model.reviewRate)} of input records (${count(model.review)}) still require review.`,
    weakestRule
      ? `${weakestRule.label} has the lowest displayed pass rate at ${percent(weakestRule.value)} and is the first rule family to inspect.`
      : null,
    largestCorrectionRule
      ? `${largestCorrectionRule.label} made the largest displayed correction footprint with ${count(largestCorrectionRule.value)} corrected cells.`
      : null,
    'Business action: keep rejected records out of downstream use, clear the review population, and test the weakest or highest-impact rules before releasing refreshed data to identity resolution, audiences, and campaigns.',
  ].filter(Boolean).join(' ')
  const reportDetail = {
    title: 'Cleansing & Standardization reporting',
    summary: `This report explains what happened to ${sourceLabel(source)} data before it is used for customer matching and marketing. It shows how many records successfully reached standardized output, how many values were corrected, what was rejected, and what still needs human review. A changed record is not automatically bad—it means at least one monitored value was normalized or corrected.`,
    calculation: transformationEquation
      ? `Technical method: the reporting API reconciles the current preprocessed input and standardized output at record grain, then compares each measured outcome with the same input population. ${transformationEquation}`
      : 'The source-scoped reporting API derives outcomes only from current preprocessing and standardization artifacts that expose measured record counts.',
    businessInsight: cleansingBusinessInsight,
    values: reportValues,
    provenance: [
      { label: 'Selected source', value: evidenceContext.sourceName },
      { label: 'Reporting scope', value: evidenceContext.scope },
      { label: 'Current API value(s)', value: reportValues },
      { label: 'Evidence artifact(s)', value: artifactEvidence },
      { label: 'Source API', value: apiRequest },
      { label: 'Evidence grain', value: 'Input and standardized outcomes at distinct-record grain; corrections at changed-cell grain; lineage at source-record grain.' },
      { label: 'Snapshot generated', value: generatedAt },
    ],
    callout: [
      evidenceContext.caveat,
      explainReport.accuracy_note || 'Average quality includes only measured dimensions; business accuracy is not inferred.',
      explainReport.history_note || 'No historical series is inferred from this current snapshot.',
    ].filter(Boolean).join(' '),
  }
  const withCleansingEvidence = detail => ({
    ...detail,
    calculation: detail.calculation || detail.formula,
    businessInsight: detail.businessInsight || 'Use this evidence to decide where cleansing rules or stewardship effort should be prioritized before downstream use.',
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
  const heroTags = [
    'Input reconciled',
    numericValue(summary.cleansing_rules) === null
      ? null
      : `${count(summary.cleansing_rules)} cleansing rules`,
    numericValue(summary.rule_types) === null
      ? null
      : `${count(summary.rule_types)} rule types`,
    numericValue(summary.rule_templates) === null
      ? null
      : `${count(summary.rule_templates)} rule templates`,
    overallScore === null ? null : `${percent(overallScore)} average quality`,
  ].filter(Boolean)
  const hasTransformation = model.input !== null
    && model.input > 0
    && [
      model.standardized,
      model.changed,
      model.review,
      model.rejected,
    ].some(value => numericValue(value) !== null)
  const hasRuleEffectiveness = model.effectiveness.length > 0
  const hasCorrectionFootprint = model.correctionFootprint.length > 0
  const hasFieldEvidence = model.fieldEvidence.length > 0
  const includedReports = [
    hasTransformation
      ? {
          name: 'Cleansing Outcomes',
          description: 'Shows how many input records were standardized, changed, rejected, or still need review without treating overlapping outcomes as separate populations.',
        }
      : null,
    hasRuleEffectiveness
      ? {
          name: 'Cleansing Rule Performance',
          description: 'Compares available rule pass rates and correction activity so weak or high-impact cleansing controls can be reviewed first.',
        }
      : null,
    hasCorrectionFootprint
      ? {
          name: 'Corrections by Rule',
          description: 'Ranks rule families by the number of corrected field values to show where the most transformation work occurred.',
        }
      : null,
    hasFieldEvidence
      ? {
          name: 'Field Standardization Results',
          description: 'Shows each available field’s quality score, correction volume, and finding count so remediation can be assigned to the right owner.',
        }
      : null,
  ].filter(Boolean)
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

  return (
    <div className="rp-report" data-page="cleansing">
      <ReportHero
        eyebrow={`${sourceLabel(source)} · current cleansing snapshot`}
        score={percent(model.processingRate)}
        scoreLabel="standardized"
        color={REPORT_COLORS.green}
        title="Cleansing & Standardization reporting"
        summary={`${count(model.standardized)} of ${count(model.input)} ${sourceLabel(source)} records produced standardized output; ${count(model.changed)} records contain a monitored transformation.`}
        tags={heroTags}
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
          grain: 'Input and standardized outcomes at distinct-record grain; corrections at changed-cell grain; lineage at source-record grain.',
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
            evidence="View calculation"
            onClick={() => setSelectedMetric(detailFor(model.data, metric, evidenceContext))}
          />
        ))}
      </KpiGrid>

      <MetricDetail detail={selectedMetric} onClose={() => setSelectedMetric(null)} />

      {(hasTransformation || hasRuleEffectiveness) && (
        <div className="rp-grid rp-grid-2 rp-cs-grid-row rp-cs-primary-row">
          {hasTransformation && <Panel
          title="Cleansing Outcomes"
          subtitle="Independent, overlapping outcomes shown at their correct record grain."
          action={(
            <CleansingPanelAction
              label="Explain outcomes"
              onClick={() => setChartExplanation(withCleansingEvidence({
                title: 'Cleansing Outcomes',
                summary: 'Standardized, changed, and review populations can overlap, so they must not be drawn as parts of one partition.',
                formula: `Each ring compares one outcome with the same total input-record count. Current equations: ${transformationEquation}`,
                evidence: `${count(model.input)} input · ${count(model.standardized)} standardized · ${count(model.changed)} changed · ${count(model.review)} requiring review.`,
                businessInsight: 'Use the rings to separate throughput risk from transformation volume and stewardship demand; a high standardized rate can still coexist with heavy changes or review workload.',
                grain: 'Each ring uses distinct input-record grain and the same total input-record count; golden-link evidence is source-record lineage.',
                caveat: 'The displayed outcomes overlap and therefore must not be summed to 100%.',
              }))}
            />
          )}
          >
            <CleansingOutcomeChart
              input={model.input}
              standardized={model.standardized}
              changed={model.changed}
              review={model.review}
              rejected={model.rejected}
              linked={summary.duplicate_pair_merged}
            />
          </Panel>}

          {hasRuleEffectiveness && <Panel
          title="Cleansing Rule Performance"
          subtitle="Pass score paired with the actual correction footprint of each active rule family."
          action={(
            <CleansingPanelAction
              label="Explain rule scores"
              badge={`${count(summary.active_rules)} active rules`}
              onClick={() => setChartExplanation(withCleansingEvidence({
                title: 'Cleansing Rule Performance',
                summary: `The chart contains ${model.effectiveness.length} active rule families with their measured pass rate, corrected-cell count, applicable-cell count, and field coverage.`,
                formula: `Rule pass rate is the returned quality score across applicable cells; correction share compares corrected cells with applicable cells. Current example: ${ruleEquation}`,
                values: `${model.effectiveness.length} rule-family rows are displayed from ${count(summary.active_rules)} active rules in the current API response.`,
                businessInsight: 'Use low pass rates to identify weak data controls and high correction shares to identify rules that materially alter incoming data; review rules that are weak on either signal.',
                grain: 'One active rule family aggregated across its applicable fields and cells in the selected source snapshot.',
                caveat: model.data.quality_caveat || 'A pass rate measures configured rule conformance and does not prove business accuracy.',
              }))}
            />
          )}
          >
            <RuleEffectiveness
              rows={model.effectiveness}
              caveat={model.data.quality_caveat}
            />
          </Panel>}
        </div>
      )}

      {(hasCorrectionFootprint || hasFieldEvidence) && (
        <div className="rp-grid rp-grid-2 rp-cs-grid-row rp-cs-evidence-row">
          {hasCorrectionFootprint && <Panel
          title="Corrections by Rule"
          subtitle={`A lollipop ranking of all ${count(summary.total_field_changes)} recorded field changes.`}
          action={(
            <CleansingPanelAction
              label="Explain corrections"
              badge={`${count(summary.total_field_changes)} corrections`}
              onClick={() => setChartExplanation(withCleansingEvidence({
                title: 'Corrections by Rule',
                summary: 'Correction counts are summed from field-level standardization evidence for the selected source.',
                formula: `Each lollipop compares a rule family’s corrected cells with the largest rule-family count, while contribution compares it with all field changes. Current example: ${correctionEquation}`,
                evidence: `${count(model.correctionFootprint.reduce((sum, row) => sum + row.value, 0))} rule-classified corrections of ${count(summary.total_field_changes)} total field changes.`,
                businessInsight: 'Use the largest correction footprints to prioritize rule review, regression testing, and upstream source fixes where they will reduce the most transformation work.',
                grain: 'Changed field cells grouped by rule family in the selected source snapshot.',
                caveat: 'Correction counts can exceed changed-record counts because one record can contain several corrected fields.',
              }))}
            />
          )}
          >
            <CorrectionLollipop
              rows={model.correctionFootprint}
              totalChanges={summary.total_field_changes}
            />
          </Panel>}

          {hasFieldEvidence && <Panel
          title="Field Standardization Results"
          subtitle="Correction volume, current quality, and issue load in one drill-down surface."
          bodyClassName="rp-cs-table-body"
          action={(
            <CleansingPanelAction
              label="Explain fields"
              badge={`${count(summary.fields_monitored)} monitored fields`}
              onClick={() => setChartExplanation(withCleansingEvidence({
                title: 'Field Standardization Results',
                summary: 'Every row comes from the selected source report and preserves field, rule, quality, correction, and finding grain.',
                formula: `Quality is the field’s returned measured score; correction share compares changed nonblank cells with applicable cells. Current example: ${fieldEquation}`,
                evidence: `${count(model.fieldEvidence.length)} field rows are available in the current reporting payload.`,
                businessInsight: 'Use the table to assign field owners and prioritize fields with low quality, high correction volume, or high finding counts before downstream release.',
                grain: 'One evidence row per monitored source field; corrections and findings are field-level counts.',
                caveat: 'This table does not imply unique affected-record totals and exposes no before/after values until a record-level evidence contract exists.',
              }))}
            />
          )}
          >
            <FieldEvidenceTable rows={model.fieldEvidence} />
          </Panel>}
        </div>
      )}

      <ContractStrip status={`Schema v${model.data.schema_version || 1}`}>
        Grain-safe naming: {count(summary.duplicate_pair_merged)} is shown as Golden-linked
        records. It counts source-record-to-profile lineage rows and is not a count of unique
        duplicate pairs. No historical trend or accuracy score is inferred.
      </ContractStrip>
      <MetricDetail
        detail={chartExplanation}
        onClose={() => setChartExplanation(null)}
      />
    </div>
  )
}
