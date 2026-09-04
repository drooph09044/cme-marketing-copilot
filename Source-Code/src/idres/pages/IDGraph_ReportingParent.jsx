import React, { useEffect, useRef, useState } from 'react'
import {
  AddReportSelector,
  BarList,
  ContractStrip,
  Donut,
  EvidenceDrawer,
  formatCount,
  formatPercent,
  KpiCard,
  KpiGrid,
  Panel,
  REPORT_COLORS,
  ReportHero,
  ReportState,
  safePercent,
  sourceLabel,
  useAbortableReport,
  useReportingSource,
} from '../reporting/ReportPrimitives'
import './IdentityGraphReporting.css'

const REPORT_ENDPOINT = '/api/reporting/identity-graph'
const TIER_STYLES = {
  strong: {
    color: REPORT_COLORS.green,
    gradient: REPORT_COLORS.green,
  },
  medium: {
    color: REPORT_COLORS.violet,
    gradient: REPORT_COLORS.violet,
  },
  weak: {
    color: REPORT_COLORS.amber,
    gradient: REPORT_COLORS.amber,
  },
  rejected: {
    color: REPORT_COLORS.magenta,
    gradient: REPORT_COLORS.magenta,
  },
}
const DEPTH_COLORS = [
  REPORT_COLORS.blue,
  REPORT_COLORS.cyan,
  REPORT_COLORS.violet,
  REPORT_COLORS.amber,
  REPORT_COLORS.green,
]
const IDENTITY_REPORT_NAMES = {
  hero: 'Customer Identity Summary',
  flow: 'Customer Identity Resolution',
  confidence: 'Match Confidence Distribution',
  identifiers: 'Profiles by Match Identifier',
  composition: 'Single-record vs Multi-record Profiles',
  sources: 'Identity Records by Source',
  linkage: 'Matches Across Data Sources',
  review: 'Identity Match Review Signals',
}

function normalizeSource(value) {
  return String(value || '').trim().toLowerCase()
}

function unavailable(message) {
  const error = new Error(message)
  error.name = 'SourceUnavailableError'
  return error
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new Error(
      payload?.error
      || payload?.message
      || `Identity reporting request failed (${response.status}).`
    )
  }
  return payload
}

function requireMetric(container, key, label) {
  const raw = container?.[key]
  if (raw === null || raw === undefined || raw === '') {
    throw unavailable(`${label} is missing from the selected source snapshot.`)
  }
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw unavailable(`${label} is invalid in the selected source snapshot.`)
  }
  return value
}

function valuesReconcile(left, right, tolerance = 0.05) {
  return Math.abs(Number(left) - Number(right)) <= tolerance
}

function buildReportData(source, payload) {
  if (normalizeSource(payload?.source_system) !== source) {
    throw unavailable(
      `The identity report returned "${payload?.source_system || 'no source'}", not "${source}". `
      + 'Cross-source fallback data is blocked.'
    )
  }
  if (!payload?.data_available) {
    throw unavailable(
      payload?.error || `No source-scoped identity artifacts are available for "${source}".`
    )
  }

  const summary = payload.summary || {}
  const inputRecords = requireMetric(summary, 'input_records', 'Input records')
  const totalClusters = requireMetric(summary, 'total_clusters', 'Total clusters')
  const multiClusters = requireMetric(
    summary,
    'multi_record_clusters',
    'Multi-record clusters'
  )
  const singletons = requireMetric(
    summary,
    'singletons',
    'Single-record customer profiles'
  )
  const largestCluster = requireMetric(summary, 'largest_cluster', 'Largest cluster')
  const resolvedRecords = requireMetric(summary, 'resolved_records', 'Resolved records')
  const candidatePairs = requireMetric(summary, 'candidate_pairs', 'Candidate pairs')
  const sameSourcePairs = requireMetric(summary, 'same_source_pairs', 'Same-source pairs')
  const crossSourcePairs = requireMetric(summary, 'cross_source_pairs', 'Cross-source pairs')
  if (totalClusters !== multiClusters + singletons) {
    throw unavailable(
      'Total customer profiles do not reconcile to multi-record plus single-record profiles.'
    )
  }
  if (resolvedRecords !== inputRecords - singletons) {
    throw unavailable(
      'Connected identity records do not reconcile to identity records minus single-record profiles.'
    )
  }
  if (candidatePairs !== sameSourcePairs + crossSourcePairs) {
    throw unavailable(
      'Candidate-pair lineage does not reconcile to same-source plus cross-source pairs.'
    )
  }

  const coverage = safePercent(resolvedRecords, inputRecords)
  const multiClusterPct = safePercent(multiClusters, totalClusters)
  const reportedCoverage = requireMetric(
    summary,
    'identity_coverage_pct',
    'Connected-record rate'
  )
  const reportedMultiClusterPct = requireMetric(
    summary,
    'multi_record_cluster_pct',
    'Multi-record profile rate'
  )
  if (
    !valuesReconcile(coverage, reportedCoverage)
    || !valuesReconcile(multiClusterPct, reportedMultiClusterPct)
  ) {
    throw unavailable('Identity percentages do not reconcile to their source counts.')
  }

  if (!Array.isArray(payload.cluster_depth) || !payload.cluster_depth.length) {
    throw unavailable('Multi-record cluster depth is unavailable.')
  }
  const depthRows = payload.cluster_depth.map((row, index) => ({
    label: String(row?.label || `Band ${index + 1}`),
    value: requireMetric(row, 'value', `Cluster-depth band ${index + 1}`),
  }))
  if (depthRows.reduce((sum, row) => sum + row.value, 0) !== multiClusters) {
    throw unavailable(
      'Cluster-depth bands do not reconcile to the multi-record cluster count.'
    )
  }

  if (!Array.isArray(payload.confidence_tiers) || !payload.confidence_tiers.length) {
    throw unavailable('Candidate confidence tiers are unavailable.')
  }
  const confidenceRows = payload.confidence_tiers.map((row, index) => {
    const key = String(row?.key || row?.label || '').trim().toLowerCase()
    const label = String(row?.label || '').trim()
    if (!key || !label) {
      throw unavailable(`Candidate confidence tier ${index + 1} is incomplete.`)
    }
    const style = TIER_STYLES[key] || {
      color: REPORT_COLORS.magenta,
      gradient: 'linear-gradient(90deg,#d955c2,#ff8ae4)',
    }
    return {
      key,
      label,
      value: requireMetric(row, 'value', `${label} candidate pairs`),
      // Profile-grain counterpart: how many multi-record profiles rest on this
      // tier as their strongest evidence. Pair shares alone are misleading.
      profiles: requireMetric(row, 'profiles', `${label} profile count`),
      exampleCombination: String(row?.example_combination || 'No example available'),
      ...style,
    }
  })
  const requiredConfidenceKeys = ['strong', 'medium', 'weak', 'rejected']
  const confidenceKeys = confidenceRows.map(row => row.key)
  if (
    confidenceRows.length !== requiredConfidenceKeys.length
    || new Set(confidenceKeys).size !== requiredConfidenceKeys.length
    || requiredConfidenceKeys.some(key => !confidenceKeys.includes(key))
  ) {
    throw unavailable(
      'Candidate confidence evidence must contain Strong, Medium, Weak, and Rejected categories.'
    )
  }
  if (confidenceRows.reduce((sum, row) => sum + row.value, 0) !== candidatePairs) {
    throw unavailable(
      'Confidence tiers do not reconcile to the candidate-pair total.'
    )
  }

  if (
    !Array.isArray(payload.identity_records_by_source)
    || !payload.identity_records_by_source.length
  ) {
    throw unavailable('Identity-record source distribution is unavailable.')
  }
  const identitySourceRows = payload.identity_records_by_source.map((row, index) => ({
    key: String(row?.key || `source-${index + 1}`),
    label: String(row?.label || `Source ${index + 1}`),
    value: requireMetric(row, 'value', `Identity records for source ${index + 1}`),
    color: DEPTH_COLORS[index % DEPTH_COLORS.length],
  }))
  if (identitySourceRows.reduce((sum, row) => sum + row.value, 0) !== inputRecords) {
    throw unavailable(
      'Identity-record source counts do not reconcile to total identity records.'
    )
  }

  const linkage = payload.source_linkage || {}
  if (!Array.isArray(linkage.headers) || !linkage.headers.length) {
    throw unavailable('Source-to-source linkage headers are unavailable.')
  }
  const linkageHeaders = linkage.headers.map((header, index) => ({
    key: String(header?.key || `source-${index + 1}`),
    label: String(header?.label || `Source ${index + 1}`),
    participation: requireMetric(
      header,
      'participation',
      `Linkage participation for source ${index + 1}`
    ),
  }))
  if (
    !Array.isArray(linkage.matrix)
    || linkage.matrix.length !== linkageHeaders.length
    || linkage.matrix.some(row => !Array.isArray(row) || row.length !== linkageHeaders.length)
  ) {
    throw unavailable('Source-to-source linkage matrix is incomplete.')
  }

  const linkageMatrix = linkage.matrix.map((row, rowIndex) => (
    row.map((rawValue, columnIndex) => {
      if (columnIndex < rowIndex) return null
      const value = Number(rawValue)
      if (!Number.isFinite(value) || value < 0) {
        throw unavailable(
          `Source linkage cell ${rowIndex + 1}, ${columnIndex + 1} is invalid.`
        )
      }
      return value
    })
  ))
  const representedPairs = linkageMatrix.reduce(
    (total, row) => total + row.reduce(
      (rowTotal, value) => rowTotal + (value === null ? 0 : value),
      0
    ),
    0
  )
  const reportedRepresentedPairs = requireMetric(
    linkage,
    'represented_pairs',
    'Represented source-linkage pairs'
  )
  if (representedPairs !== reportedRepresentedPairs || representedPairs > candidatePairs) {
    throw unavailable(
      'Source-linkage matrix counts do not reconcile to the candidate-pair artifact.'
    )
  }
  const matrixCoverage = safePercent(representedPairs, candidatePairs)
  const reportedMatrixCoverage = requireMetric(
    linkage,
    'coverage_pct',
    'Source-linkage matrix coverage'
  )
  if (!valuesReconcile(matrixCoverage, reportedMatrixCoverage)) {
    throw unavailable('Source-linkage matrix coverage does not reconcile.')
  }

  const weakCandidates = confidenceRows.find(row => row.key === 'weak').value
  const reportedWeak = payload.review?.weak_candidates
  if (
    reportedWeak !== null
    && reportedWeak !== undefined
    && Number(reportedWeak) !== weakCandidates
  ) {
    throw unavailable('Weak-tier review evidence does not reconcile.')
  }

  const identifierPayload = payload.identifier_resolution || {}
  let identifierRows = []
  let identifierUnavailableReason = String(
    identifierPayload.reason || 'In-cluster identifier evidence is unavailable.'
  )
  if (identifierPayload.data_available) {
    if (!Array.isArray(identifierPayload.rows) || !identifierPayload.rows.length) {
      throw unavailable(
        'In-cluster identifier reporting is marked available but contains no evidence rows.'
      )
    }
    identifierRows = identifierPayload.rows.map((row, index) => ({
      key: String(row?.key || `identifier-${index + 1}`),
      label: String(row?.label || `Identifier ${index + 1}`),
      value: requireMetric(row, 'value', `Identifier-evidence row ${index + 1}`),
      percentage: requireMetric(row, 'percentage', `Identifier share ${index + 1}`),
      confidenceTier: String(row?.confidence_tier || 'Low'),
      color: [
        REPORT_COLORS.blue,
        REPORT_COLORS.cyan,
        REPORT_COLORS.violet,
        REPORT_COLORS.slate,
      ][index % 4],
    }))
    if (identifierRows.reduce((sum, row) => sum + row.value, 0) !== multiClusters) {
      throw unavailable(
        'In-cluster identifier-evidence counts do not reconcile to multi-record customer profiles.'
      )
    }
    identifierUnavailableReason = ''
  }

  return {
    inputRecords,
    totalClusters,
    multiClusters,
    singletons,
    largestCluster,
    resolvedRecords,
    coverage,
    multiClusterPct,
    candidatePairs,
    sameSourcePairs,
    crossSourcePairs,
    averageRecordsPerIdentity: multiClusters
      ? resolvedRecords / multiClusters
      : null,
    depthRows,
    confidenceRows,
    identitySourceRows,
    linkageHeaders,
    linkageMatrix,
    representedPairs,
    matrixCoverage,
    topRoute: linkage.top_route || null,
    weakCandidates,
    identifierRows,
    identifierUnavailableReason,
    review: payload.review || {},
    emailReconciliation: payload.email_reconciliation || {},
    weakMatchExplanation: String(payload.weak_match_explanation || ''),
    confidenceGrainNote: String(payload.confidence_grain_note || ''),
    explainReport: payload.explain_report || {},
  }
}

async function loadIdentityReport(source, signal) {
  if (!source) throw unavailable('No source system is selected.')
  const payload = await fetchJson(
    `${REPORT_ENDPOINT}?source=${encodeURIComponent(source)}`,
    signal
  )
  return buildReportData(source, payload)
}

function artifactSnapshotName(value) {
  const fileName = String(value || '').split(/[\\/]/).pop() || ''
  const match = fileName.match(/^(.*?)(?:\.([^.]+))?$/)
  const stem = String(match?.[1] || fileName)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
  const extension = String(match?.[2] || '').toUpperCase()
  return [stem, extension ? `(${extension})` : ''].filter(Boolean).join(' ')
}

function identityProvenance(data, label, scope, grain) {
  const sourceArtifacts = Array.isArray(data.explainReport?.sources)
    ? data.explainReport.sources
      .filter(Boolean)
      .map(artifactSnapshotName)
      .filter(Boolean)
      .join(' · ')
    : ''

  return [
    { label: 'Selected source', value: label },
    { label: 'Scope', value: scope },
    {
      label: 'Report page',
      value: 'ID Graph → ID Graph Reporting',
    },
    {
      label: 'Artifact snapshots',
      value: sourceArtifacts || 'Cluster summary · Clustered records · Candidate pairs',
    },
    {
      label: 'Snapshot status',
      value: 'Current artifact set for the selected source; no as-of timestamp is published',
    },
    { label: 'Evidence grain', value: grain },
  ]
}

function ExplainAction({
  label,
  detail,
  kicker = 'Identity metric evidence',
  className = 'ig-panel-action',
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <EvidenceDrawer
        detail={open ? detail : null}
        kicker={kicker}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

function IdentityPrimaryReportGrid({ children }) {
  // Business reading order: establish source volume first, then show the
  // resulting profile composition before explaining match strength and the
  // identifier combinations behind it.
  const orderedTitles = [
    IDENTITY_REPORT_NAMES.sources,
    IDENTITY_REPORT_NAMES.confidence,
    IDENTITY_REPORT_NAMES.composition,
    IDENTITY_REPORT_NAMES.identifiers,
  ]
  const reports = React.Children.toArray(children)
    .filter(Boolean)
    .sort((left, right) => (
      orderedTitles.indexOf(left?.props?.title) - orderedTitles.indexOf(right?.props?.title)
    ))
  const reportKeyByTitle = {
    [IDENTITY_REPORT_NAMES.identifiers]: 'identifiers',
    [IDENTITY_REPORT_NAMES.confidence]: 'confidence',
    [IDENTITY_REPORT_NAMES.composition]: 'composition',
    [IDENTITY_REPORT_NAMES.sources]: 'sources',
  }
  return (
    <div className="rp-grid rp-grid-2 ig-report-grid">
      {reports.map((element, index) => (
        <div
          key={`identity-primary-${index}`}
          className="ig-report-row-item"
          data-report-key={reportKeyByTitle[element?.props?.title] || `report-${index}`}
        >
          {element}
        </div>
      ))}
    </div>
  )
}

function FlowNode({ x, y, width, height, color, kicker, value, label }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="13"
        fill="var(--rp-bg-deep)"
        stroke={color}
        strokeOpacity=".72"
      />
      <text className="flow-kicker" x={x + 18} y={y + 24} fill={color}>
        {kicker.toUpperCase()}
      </text>
      <text className="flow-value" x={x + 18} y={y + 56} fill="var(--text-primary)">
        {value}
      </text>
      <text
        className="flow-label"
        x={x + 18}
        y={y + height - 15}
        fill="var(--text-muted)"
      >
        {label}
      </text>
    </g>
  )
}

function IdentityResolutionFlow({ data, onOpenSingleProfiles }) {
  const consolidatedShare = Math.max(0, Math.min(data.coverage || 0, 100))
  const standaloneShare = 100 - consolidatedShare
  const consolidatedStroke = Math.max(8, consolidatedShare * 0.82)
  const standaloneStroke = Math.max(8, standaloneShare * 0.82)

  return (
    <div>
      <div className="rp-identity-flow">
        <svg
          viewBox="0 0 1000 440"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Customer identity resolution from input records to multi-record and single-record customer profiles"
        >
          <defs>
            <linearGradient id="igResolvedFlow" x1="0" x2="1">
              <stop stopColor={REPORT_COLORS.blue} stopOpacity=".72" />
              <stop offset="1" stopColor={REPORT_COLORS.violet} stopOpacity=".9" />
            </linearGradient>
            <linearGradient id="igStandaloneFlow" x1="0" x2="1">
              <stop stopColor={REPORT_COLORS.blue} stopOpacity=".58" />
              <stop offset="1" stopColor={REPORT_COLORS.slate} stopOpacity=".62" />
            </linearGradient>
            <linearGradient id="igIdentityFlow" x1="0" x2="1">
              <stop stopColor={REPORT_COLORS.violet} stopOpacity=".92" />
              <stop offset="1" stopColor={REPORT_COLORS.cyan} stopOpacity=".84" />
            </linearGradient>
          </defs>

          <path
            d="M234 208 C305 208 333 110 405 110"
            className="rp-line ig-flow-path"
            style={{
              stroke: 'url(#igResolvedFlow)',
              strokeWidth: consolidatedStroke,
              '--ig-flow-delay': '0s',
            }}
          />
          <path
            d="M234 226 C306 226 335 326 405 326"
            className="rp-line ig-flow-path"
            style={{
              stroke: 'url(#igStandaloneFlow)',
              strokeWidth: standaloneStroke,
              '--ig-flow-delay': '.18s',
            }}
          />
          <path
            d="M624 110 C691 110 708 110 766 110"
            className="rp-line ig-flow-path"
            style={{
              stroke: 'url(#igIdentityFlow)',
              strokeWidth: 48,
              '--ig-flow-delay': '.32s',
            }}
          />

          <FlowNode
            x={34}
            y={158}
            width={200}
            height={120}
            color={REPORT_COLORS.blue}
            kicker="Identity records"
            value={formatCount(data.inputRecords)}
            label="records evaluated"
          />
          <FlowNode
            x={405}
            y={52}
            width={220}
            height={116}
            color={REPORT_COLORS.violet}
            kicker="Records successfully connected"
            value={formatCount(data.resolvedRecords)}
            label={`${formatPercent(data.coverage)} of identity records`}
          />
          <FlowNode
            x={405}
            y={274}
            width={220}
            height={106}
            color={REPORT_COLORS.slate}
            kicker="Single-record customer profiles"
            value={formatCount(data.singletons)}
            label={`${formatPercent(standaloneShare)} of identity records`}
          />
          <FlowNode
            x={766}
            y={52}
            width={202}
            height={116}
            color={REPORT_COLORS.cyan}
            kicker="Multi-record customer profiles"
            value={formatCount(data.multiClusters)}
            label="profiles created from 2+ records"
          />

          <text className="flow-rate" x="315" y="94" fill={REPORT_COLORS.violet}>
            {formatPercent(consolidatedShare)}
          </text>
          <text className="flow-rate" x="315" y="352" fill="var(--text-muted)">
            {formatPercent(standaloneShare)}
          </text>
          {Number.isFinite(data.averageRecordsPerIdentity) && (
            <text className="flow-detail" x="673" y="96" fill="var(--text-muted)">
              {data.averageRecordsPerIdentity.toFixed(1)} records / identity
            </text>
          )}
          <text className="flow-detail" x="36" y="417" fill="var(--text-muted)">
            Record grain · {formatCount(data.inputRecords)} of {formatCount(data.inputRecords)} clustered records reconciled
          </text>
          <text
            className="flow-detail"
            x="966"
            y="417"
            textAnchor="end"
            fill="var(--text-muted)"
          >
            Largest cluster · {formatCount(data.largestCluster)} records
          </text>
        </svg>
      </div>
      <div className="ig-chart-caption">
        <strong>Profile reconciliation:</strong>{' '}
        {formatCount(data.multiClusters)} multi-record profiles +{' '}
        <button
          type="button"
          className="ig-inline-drilldown"
          onClick={onOpenSingleProfiles}
        >
          {formatCount(data.singletons)} single-record profiles
        </button>
        {' '}= {formatCount(data.totalClusters)} total customer profiles.
      </div>
    </div>
  )
}

function ConfidenceSpectrum({ data, label }) {
  const [selectedTier, setSelectedTier] = useState(null)
  const confidenceRows = data.confidenceRows.map(row => ({
    ...row,
    share: safePercent(row.value, data.candidatePairs) || 0,
    profileShare: safePercent(row.profiles, data.multiClusters) || 0,
  }))
  const largestShare = Math.max(...confidenceRows.map(row => row.share), 0)
  const axisMaximum = Math.min(
    100,
    Math.max(20, Math.ceil(largestShare / 10) * 10),
  )
  const axisMidpoint = axisMaximum / 2

  return (
    <>
      <div className="ig-confidence-spectrum">
        <div className="ig-confidence-lollipop-axis" aria-hidden="true">
          <span>Confidence tier</span>
          <div>
            <small>0%</small>
            <small>{formatPercent(axisMidpoint)}</small>
            <small>{formatPercent(axisMaximum)}</small>
          </div>
          <span>Pair share</span>
          <span>Profile share</span>
        </div>
        <div className="ig-confidence-lollipop">
          {confidenceRows.map((row, index) => {
            const plotShare = axisMaximum > 0
              ? Math.min(100, row.share / axisMaximum * 100)
              : 0
            return (
              <button
                type="button"
                className={`ig-confidence-lollipop-row${row.value > 0 ? '' : ' is-zero'}`}
                key={row.key}
                style={{
                  '--ig-tier-color': row.color,
                  '--ig-tier-fill': `${plotShare}%`,
                  '--ig-tier-delay': `${index * 80}ms`,
                }}
                onClick={() => setSelectedTier(row)}
                aria-label={`${row.label} confidence: ${formatPercent(row.share)} of candidate pairs (${formatCount(row.value)} pairs), and ${formatPercent(row.profileShare)} of multi-record profiles (${formatCount(row.profiles)} profiles)`}
              >
                <span className="ig-confidence-lollipop-label">
                  <i aria-hidden="true" />
                  <strong>{row.label}</strong>
                </span>
                <span className="ig-confidence-lollipop-plot" aria-hidden="true">
                  <i>
                    <b />
                  </i>
                </span>
                <span className="ig-confidence-lollipop-value">
                  <b>{formatPercent(row.share)}</b>
                  <small>{formatCount(row.value)} pairs</small>
                </span>
                {/* The profile figure is the one that answers "how many customers
                    does this actually affect". Shown next to the pair share so the
                    pair percentage cannot be read as a profile rate. */}
                <span className="ig-confidence-lollipop-profiles">
                  <b>{formatPercent(row.profileShare)}</b>
                  <small>{formatCount(row.profiles)} profiles</small>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {data.weakMatchExplanation && (
        <div className="ig-confidence-explanation">
          <strong>Why weak matches are elevated:</strong> {data.weakMatchExplanation}
        </div>
      )}
      <EvidenceDrawer
        detail={selectedTier ? {
          title: `${selectedTier.label} confidence tier`,
          meaning: (
            `${formatCount(selectedTier.value)} candidate pairs are classified as `
            + `${selectedTier.label} confidence, and ${formatCount(selectedTier.profiles)} `
            + `multi-record customer profiles rest on ${selectedTier.label} evidence as `
            + 'their strongest link.'
          ),
          formula: (
            `Pair share = candidate pairs in tier / all candidate pairs\n`
            + `${formatCount(selectedTier.value)} / ${formatCount(data.candidatePairs)} `
            + `= ${formatPercent(selectedTier.share)}\n\n`
            + `Profile share = profiles whose strongest evidence is this tier / multi-record profiles\n`
            + `${formatCount(selectedTier.profiles)} / ${formatCount(data.multiClusters)} `
            + `= ${formatPercent(selectedTier.profileShare)}`
          ),
          provenance: identityProvenance(
            data,
            label,
            `${formatCount(data.candidatePairs)} candidate pairs and ${formatCount(data.multiClusters)} multi-record profiles`,
            'Pair share at candidate-pair grain; profile share at distinct-profile grain',
          ),
          businessInsight: (
            'Read the profile share to size customer impact and the pair share to tune '
            + 'match rules. They differ because candidate pairs are enumerated within '
            + 'profiles, so one large profile contributes many pairs to a single tier.'
          ),
          callout: (
            `Example identifier combination: ${selectedTier.exampleCombination}. `
            + 'Strong pairs have corroborated evidence; Medium and Weak pairs require review; '
            + 'Rejected pairs are not merge eligible. '
            + (data.confidenceGrainNote || '')
          ),
        } : null}
        kicker={`${label} candidate evidence`}
        onClose={() => setSelectedTier(null)}
      />
    </>
  )
}

function ProfileComposition({ data, onOpenProfiles }) {
  const rows = [
    {
      key: 'multi',
      label: 'Multi-record customer profiles',
      value: data.multiClusters,
      color: REPORT_COLORS.violet,
      sub: 'Created from two or more identity records',
    },
    {
      key: 'single',
      label: 'Single-record customer profiles',
      value: data.singletons,
      color: REPORT_COLORS.cyan,
      sub: 'Represented by exactly one identity record',
    },
  ]
  return (
    <div className="ig-profile-composition">
      <Donut
        rows={rows}
        center={formatCount(data.totalClusters)}
        centerLabel="total profiles"
        size={182}
        stroke={18}
        percentageFirst
      />
      <div className="ig-profile-list-actions">
        <button
          type="button"
          className="ig-profile-list-button"
          onClick={() => onOpenProfiles?.('multi')}
        >
          View {formatCount(data.multiClusters)} multi-record customer profiles
        </button>
        <button
          type="button"
          className="ig-profile-list-button"
          onClick={() => onOpenProfiles?.('single')}
        >
          View {formatCount(data.singletons)} single-record customer profiles
        </button>
      </div>
      <p>
        Select either profile type to inspect its reconciled customer-profile list.
        The current artifact does not publish a separate “orphan” status.
      </p>
    </div>
  )
}

function IdentifierMatchWaterfall({ data }) {
  return (
    <div className="ig-identifier-waterfall">
      {data.identifierRows.map((row, index) => {
        const share = row.percentage
        return (
          <div
            className="ig-identifier-step"
            key={row.key}
            style={{ '--ig-identifier-color': row.color }}
          >
            <span className="ig-identifier-order">{index + 1}</span>
            <span className="ig-identifier-label">
              <strong>{row.label}</strong>
              <small>
                {row.confidenceTier} confidence
              </small>
            </span>
            <span className="ig-identifier-track" aria-hidden="true">
              <i style={{ '--ig-identifier-share': `${share}%` }} />
            </span>
            <span className="ig-identifier-remaining">
              <b>{formatCount(row.value)}</b>
              <small>{formatPercent(share)} of profiles</small>
            </span>
          </div>
        )
      })}
      <div className="ig-chart-caption">
        <strong>Business definition:</strong> each multi-record customer profile is counted
        once under its strongest observed identifier combination. The rows total{' '}
        {formatCount(data.multiClusters)} profiles.
      </div>
    </div>
  )
}

function IdentityRecordsBySource({ data, label }) {
  const [selectedSource, setSelectedSource] = useState(null)

  return (
    <>
      <div className="ig-source-distribution">
        <BarList
          rows={data.identitySourceRows}
          percentOfTotal
          onSelect={row => setSelectedSource({
            ...row,
            share: safePercent(row.value, data.inputRecords),
          })}
        />
        <div className="ig-chart-caption">
          <strong>Input reconciliation:</strong>{' '}
          {formatCount(data.identitySourceRows.length)} source feeds account for all{' '}
          {formatCount(data.inputRecords)} physical identity records in the selected
          clustered snapshot.
        </div>
      </div>
      <EvidenceDrawer
        detail={selectedSource ? {
          title: `${selectedSource.label} identity records`,
          meaning: (
            `${formatCount(selectedSource.value)} physical identity records in the `
            + `selected ${label} snapshot came from ${selectedSource.label}.`
          ),
          formula: (
            `Source share = source identity records / total identity records\n`
            + `${formatCount(selectedSource.value)} / ${formatCount(data.inputRecords)} `
            + `= ${formatPercent(selectedSource.share)}`
          ),
          provenance: identityProvenance(
            data,
            label,
            `${formatCount(data.inputRecords)} clustered identity records`,
            'One clustered input record grouped by its governed source-file lineage',
          ),
          businessInsight: (
            'Use this distribution to understand which feeds contribute the physical '
            + 'identity workload and where changes in feed volume could affect matching.'
          ),
          callout: (
            'This is input-record volume by source. It is not candidate-pair '
            + 'participation, unique customer profiles, or source-to-source linkage.'
          ),
        } : null}
        kicker={`${label} source evidence`}
        onClose={() => setSelectedSource(null)}
      />
    </>
  )
}

// One drill-down surface serves every KPI card. Record-grain scopes list sampled
// records; profile-grain scopes list sampled profiles.
const DRAWER_SCOPES = {
  records: {
    grain: 'record',
    title: 'Total Identity Records',
    unit: 'identity records',
    description: 'physical identity records in the current clustered snapshot',
  },
  connected_records: {
    grain: 'record',
    title: 'Connected Identity Records',
    unit: 'connected records',
    description: 'identity records that joined a multi-record customer profile',
  },
  all: {
    grain: 'profile',
    title: 'Unique Customer Profiles',
    unit: 'customer profiles',
    description: 'customer profiles in the current snapshot, of any size',
  },
  multi: {
    grain: 'profile',
    title: 'Multi-record Customer Profiles',
    unit: 'customer profiles',
    description: 'customer profiles that contain two or more identity records',
  },
  single: {
    grain: 'profile',
    title: 'Single-record Customer Profiles',
    unit: 'customer profiles',
    description: 'customer profiles that contain exactly one identity record',
  },
}

function IdentityProfileDrawer({
  open,
  source,
  label,
  profileType,
  expectedTotal,
  onClose,
}) {
  const [selectedTable, setSelectedTable] = useState('')
  const [state, setState] = useState({
    loading: false,
    error: '',
    data: null,
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const closeButtonRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const controller = new AbortController()
    setState({ loading: true, error: '', data: null })
    const tableQuery = selectedTable
      ? `&source_table=${encodeURIComponent(selectedTable)}`
      : ''
    fetchJson(
      `${REPORT_ENDPOINT}/profiles?source=${encodeURIComponent(source)}&profile_type=${encodeURIComponent(profileType)}&page=1&page_size=10${tableQuery}`,
      controller.signal,
    )
      .then(payload => {
        const total = Number(payload?.total)
        const overallTotal = Number(payload?.overall_total)
        const payloadPage = Number(payload?.page)
        const totalPages = Number(payload?.total_pages)
        if (
          normalizeSource(payload?.source_system) !== source
          || payload?.profile_type !== profileType
          || !payload?.data_available
          || !Array.isArray(payload?.rows)
          || !Array.isArray(payload?.table_breakdown)
          || !Number.isFinite(total)
          || !Number.isFinite(overallTotal)
          || overallTotal !== expectedTotal
          || (selectedTable && payload?.source_table !== selectedTable)
          || !Number.isInteger(payloadPage)
          || !Number.isInteger(totalPages)
          || payloadPage < 1
          || totalPages < 1
        ) {
          throw unavailable(
            'The customer-profile drill-down did not reconcile to the selected identity snapshot.'
          )
        }
        setState({ loading: false, error: '', data: payload })
      })
      .catch(error => {
        if (error?.name === 'AbortError') return
        setState({
          loading: false,
          error: error?.message || 'Customer profiles could not be loaded.',
          data: null,
        })
      })
    return () => controller.abort()
  }, [expectedTotal, open, profileType, refreshKey, selectedTable, source])

  useEffect(() => {
    if (!open) return undefined
    setSelectedTable('')
    previousFocusRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = closeButtonRef.current?.closest('.ig-profile-drawer')
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
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [open, onClose, profileType, source])

  if (!open) return null
  const scope = DRAWER_SCOPES[profileType] || DRAWER_SCOPES.single
  const isMulti = profileType === 'multi'
  const isRecordGrain = scope.grain === 'record'
  const profileTypeLabel = scope.title
  const rows = state.data?.rows || []
  const tableBreakdown = state.data?.table_breakdown || []
  const selectedTableDetail = tableBreakdown.find(row => row.source_table === selectedTable)
  const countKey = isRecordGrain ? 'record_count' : 'profile_count'

  return (
    <div
      className="ig-profile-drawer-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <aside
        className="ig-profile-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ig-profile-list-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header>
          <div>
            <span>{label} identity drill-down</span>
            <h3 id="ig-profile-list-title">{profileTypeLabel}</h3>
            <p>
              {formatCount(expectedTotal)} {scope.description}. Select a source table
              to see up to 10 sample {isRecordGrain ? 'records' : 'profiles'}.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={`Close the ${profileTypeLabel.toLowerCase()} list`}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="ig-profile-drawer-body" aria-live="polite">
          {state.loading && (
            <div className="ig-profile-drawer-state">Loading customer profiles…</div>
          )}
          {state.error && (
            <div className="ig-profile-drawer-state is-error">
              <strong>Customer profile list unavailable</strong>
              <span>{state.error}</span>
              <button
                type="button"
                onClick={() => setRefreshKey(value => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {!state.loading && !state.error && state.data && (
            <>
              {!selectedTable ? (
                <div className="ig-profile-table-scroll">
                  <table className="ig-profile-table ig-profile-source-table">
                    <thead>
                      <tr>
                        <th>Source table</th>
                        <th>{isRecordGrain ? 'Identity records' : 'Customer profiles'}</th>
                        <th>Sample</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableBreakdown.map(row => (
                        <tr key={row.source_table}>
                          <td>
                            <button
                              type="button"
                              className="ig-profile-source-button"
                              onClick={() => setSelectedTable(row.source_table)}
                            >
                              {row.source_label}
                            </button>
                            <small>{row.source_table}</small>
                          </td>
                          <td>{formatCount(row[countKey])}</td>
                          <td>
                            View up to 10 {isRecordGrain ? 'records' : 'profiles'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="ig-profile-source-back"
                    onClick={() => setSelectedTable('')}
                  >
                    ← Back to source tables
                  </button>
                  <div className="ig-profile-sample-summary">
                    <strong>{selectedTableDetail?.source_label || selectedTable}</strong>
                    <span>
                      Showing {formatCount(rows.length)} sample{' '}
                      {isRecordGrain ? 'records' : 'profiles'} from{' '}
                      {formatCount(state.data.total)} matching{' '}
                      {isRecordGrain ? 'records' : 'profiles'}.
                    </span>
                  </div>
                  <div className="ig-profile-table-scroll">
                    <table className="ig-profile-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Profile ID</th>
                          <th>{isRecordGrain ? 'Record ID' : 'Identity Records'}</th>
                          <th>{isMulti ? 'Sources' : 'Source'}</th>
                          <th>Email</th>
                          <th>Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={`${row.profile_id}-${row.record_id}-${index}`}>
                            <td>{row.customer_name}</td>
                            <td>{row.profile_id}</td>
                            <td>
                              {isRecordGrain
                                ? (row.record_id || '—')
                                : formatCount(row.record_count)}
                            </td>
                            <td>{row.source}</td>
                            <td title={row.email ? undefined : 'Not published by the governed source record'}>
                              {row.email || '—'}
                            </td>
                            <td title={row.phone ? undefined : 'Not published by the governed source record'}>
                              {row.phone || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <footer>
                    <span>
                      Up to 10 source-backed samples · Email and phone are masked.
                    </span>
                  </footer>
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

function SourceLinkageHeatmap({ data, label }) {
  const [selectedRoute, setSelectedRoute] = useState(null)
  const matrixMaximum = Math.max(
    ...data.linkageMatrix.flat().filter(value => value !== null),
    1
  )

  return (
    <>
      <div className="ig-linkage-layout">
        <div className="ig-linkage-scroll">
          <div
            className="ig-linkage-matrix"
            style={{ '--ig-matrix-columns': data.linkageHeaders.length }}
          >
            <div aria-hidden="true" />
            {data.linkageHeaders.map(header => (
              <div className="ig-matrix-head" key={`head-${header.key}`}>
                {header.label}
              </div>
            ))}
            {data.linkageMatrix.map((row, rowIndex) => (
              <React.Fragment key={`matrix-row-${data.linkageHeaders[rowIndex].key}`}>
                <div className="ig-matrix-row">
                  {data.linkageHeaders[rowIndex].label}
                </div>
                {row.map((value, columnIndex) => {
                  const column = data.linkageHeaders[columnIndex]
                  const rowHeader = data.linkageHeaders[rowIndex]
                  if (value === null) {
                    return (
                      <div
                        className="ig-matrix-cell is-void"
                        key={`${rowHeader.key}-${column.key}`}
                        aria-hidden="true"
                      />
                    )
                  }
                  const intensity = Math.round(
                    20 + 50 * Math.sqrt(value / matrixMaximum)
                  )
                  const route = {
                    label: `${rowHeader.label} ↔ ${column.label}`,
                    value,
                    share: safePercent(value, data.candidatePairs),
                    rowParticipation: rowHeader.participation,
                    columnParticipation: column.participation,
                  }
                  return (
                    <button
                      type="button"
                      className={`ig-matrix-cell ${value === 0 ? 'is-zero' : ''}`}
                      key={`${rowHeader.key}-${column.key}`}
                      style={{
                        '--ig-heat-intensity': `${intensity}%`,
                        '--ig-cell-delay': `${(rowIndex + columnIndex) * 45}ms`,
                      }}
                      onClick={() => setSelectedRoute(route)}
                      aria-label={`${route.label}: ${formatCount(value)} candidate pairs`}
                    >
                      {formatCount(value)}
                    </button>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="ig-linkage-story">
          <div className="ig-linkage-stat">
            <b>{formatPercent(safePercent(data.sameSourcePairs, data.candidatePairs))}</b>
            <span>{formatCount(data.sameSourcePairs)} same-source candidate pairs.</span>
          </div>
          <div className="ig-linkage-stat">
            <b>{formatPercent(safePercent(data.crossSourcePairs, data.candidatePairs))}</b>
            <span>{formatCount(data.crossSourcePairs)} cross-source pairs connecting feeds.</span>
          </div>
          {data.topRoute && (
            <div className="ig-linkage-stat">
              <b>{formatCount(data.topRoute.value)}</b>
              <span>Largest displayed route: {data.topRoute.label}.</span>
            </div>
          )}
          <div className="ig-linkage-stat">
            <b>{formatPercent(data.matrixCoverage)}</b>
            <span>Candidate-pair volume represented by the top-five feed matrix.</span>
          </div>
          <div className="ig-linkage-key">
            <span>Lower</span><i /><span>Higher pair volume</span>
          </div>
        </div>
      </div>
      <div className="ig-chart-caption">
        <strong>Interaction:</strong> select a cell to inspect its candidate-pair count,
        share, and feed participation.
      </div>
      <EvidenceDrawer
        detail={selectedRoute ? {
          title: selectedRoute.label,
          meaning: (
            `This route contains ${formatCount(selectedRoute.value)} candidate pairs `
            + `between the selected feed endpoints.`
          ),
          formula: (
            `Route share = route candidate pairs / all candidate pairs\n`
            + `${formatCount(selectedRoute.value)} / ${formatCount(data.candidatePairs)} `
            + `= ${formatPercent(selectedRoute.share)}`
          ),
          provenance: [
            ...identityProvenance(
              data,
              label,
              `${formatCount(data.representedPairs)} represented of ${formatCount(data.candidatePairs)} candidate pairs`,
              'One source-to-source route aggregated from candidate-pair endpoints',
            ),
            {
              label: 'Endpoint participation',
              value: (
                `${formatCount(selectedRoute.rowParticipation)} row-feed endpoints · `
                + `${formatCount(selectedRoute.columnParticipation)} column-feed endpoints`
              ),
            },
          ],
          businessInsight: (
            'This route shows which feed combination contributes to customer unification. '
            + 'Low-volume or weak routes may need better identifier mapping; dominant routes '
            + 'deserve monitoring for dependency and over-linking risk.'
          ),
          callout: (
            `The heatmap is limited to the five feeds with the highest pair participation `
            + `and represents ${formatPercent(data.matrixCoverage)} of all candidate pairs.`
          ),
        } : null}
        kicker={`${label} linkage evidence`}
        onClose={() => setSelectedRoute(null)}
      />
    </>
  )
}

export default function IDGraph_ReportingParent({
  dataSource = 'media',
  selectedSourceLabel = '',
}) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [metricEvidence, setMetricEvidence] = useState(null)
  const [selectedReports, setSelectedReports] = useState([])
  const [profileDrawerType, setProfileDrawerType] = useState(null)
  const reportingSource = useReportingSource(dataSource)
  const requestedSource = normalizeSource(reportingSource || dataSource)
  const label = (
    normalizeSource(dataSource) === requestedSource && selectedSourceLabel
      ? selectedSourceLabel
      : sourceLabel(requestedSource)
  )

  const reportState = useAbortableReport(
    signal => loadIdentityReport(requestedSource, signal),
    [requestedSource, refreshKey]
  )

  useEffect(() => {
    setSelectedReports([])
    setMetricEvidence(null)
    setProfileDrawerType(null)
  }, [requestedSource])

  if (reportState.loading) {
    return (
      <div className="rp-report ig-report" data-page="identity">
        <ReportState type="loading" title={`Loading ${label} identity reporting`}>
          Validating cluster and candidate-pair artifacts for the selected source.
        </ReportState>
      </div>
    )
  }

  if (reportState.error || !reportState.data) {
    return (
      <div className="rp-report ig-report" data-page="identity">
        <ReportState
          type="empty"
          title={`${label} identity reporting unavailable`}
          onRetry={() => setRefreshKey(value => value + 1)}
        >
          {reportState.error || 'No complete source-scoped identity snapshot is available.'}
        </ReportState>
      </div>
    )
  }

  const data = reportState.data
  const weakShare = safePercent(data.weakCandidates, data.candidatePairs)
  const reportOverview = (
    `This report shows how well ${label} records are being connected into usable customer identities. `
    + `In the current snapshot, ${formatCount(data.resolvedRecords)} of `
    + `${formatCount(data.inputRecords)} records belong to `
    + `${formatCount(data.multiClusters)} customer profiles that contain more than one record, while `
    + `${formatCount(data.singletons)} customer profiles contain one record. It also shows the strength `
    + `of the match evidence behind those connections.`
  )
  const reportBusinessInsight = data.weakCandidates > 0
    ? (
      `Use the ${formatPercent(data.coverage)} connected-record rate to understand how much of the `
      + `customer estate can support a connected experience. Start the quality review with the `
      + `${formatCount(data.weakCandidates)} weak-confidence candidate pairs `
      + `(${formatPercent(weakShare)} of all candidate pairs), then inspect large clusters and `
      + `the dominant source-linkage routes before expanding automated matching.`
    )
    : (
      `The current candidate artifact contains no weak-confidence pairs. Preserve the governed `
      + `match settings, monitor the ${formatPercent(data.coverage)} connected-record rate over time, `
      + `and continue checking large clusters and dominant source-linkage routes for over-merging.`
    )
  const identityReportCatalogue = [
    {
      key: 'flow',
      name: IDENTITY_REPORT_NAMES.flow,
      optional: true,
      description: (
        'Shows how identity records divide between multi-record and single-record customer profiles, '
        + 'so marketers can see the usable connected-customer base and the remaining fragmentation.'
      ),
    },
    {
      key: 'confidence',
      name: IDENTITY_REPORT_NAMES.confidence,
      description: (
        'Shows Strong, Medium, Weak, and Rejected candidate pairs with the identifier '
        + 'combination that produced each classification.'
      ),
    },
    {
      key: 'composition',
      name: IDENTITY_REPORT_NAMES.composition,
      description: (
        'Shows the complete customer-profile population split between profiles created '
        + 'from multiple identity records and profiles represented by one record.'
      ),
    },
    {
      key: 'identifiers',
      name: IDENTITY_REPORT_NAMES.identifiers,
      description: (
        'Shows the actual email, phone, name, postal-code, and governed-ID combinations '
        + 'observed inside final multi-record customer profiles.'
      ),
    },
    {
      key: 'sources',
      name: IDENTITY_REPORT_NAMES.sources,
      description: (
        'Shows how every physical identity record in the selected clustered snapshot '
        + 'is distributed across its governed input source.'
      ),
    },
    {
      key: 'linkage',
      name: IDENTITY_REPORT_NAMES.linkage,
      optional: true,
      description: (
        'Shows which data-source combinations contribute the most potential matches, revealing '
        + 'which feeds drive customer unification and where source connections may be weak.'
      ),
    },
    {
      key: 'review',
      name: IDENTITY_REPORT_NAMES.review,
      optional: true,
      description: (
        'Highlights the measured weak-confidence matches and their share of all candidates, '
        + 'giving data stewards a focused review and rule-improvement queue.'
      ),
    },
  ].filter(report => report.available !== false)
  const optionalReportCatalog = identityReportCatalogue
    .filter(report => report.optional)
    .map(report => ({
    key: report.key,
    label: report.name,
    }))
  const optionalReportKeys = new Set(optionalReportCatalog.map(report => report.key))
  const activeSelectedReports = selectedReports.filter(key => optionalReportKeys.has(key))
  const visibleReportOrder = [
    'sources',
    'confidence',
    'composition',
    'identifiers',
    ...activeSelectedReports,
  ]
  const visibleIdentityReportCatalogue = visibleReportOrder
    .map(key => identityReportCatalogue.find(report => report.key === key))
    .filter(Boolean)
  const reportExplanation = (
    <>
      <p>{reportOverview}</p>
      <h4>Reports in this view</h4>
      <ul>
        {visibleIdentityReportCatalogue.map(report => (
          <li key={report.name}>
            <strong>{report.name}:</strong> {report.description}
          </li>
        ))}
      </ul>
    </>
  )
  const identityMetricDetail = ({
    title,
    meaning,
    formula,
    scope,
    grain,
    businessInsight,
    callout,
  }) => ({
    title,
    meaning,
    formula,
    provenance: identityProvenance(data, label, scope, grain),
    businessInsight,
    callout,
  })

  return (
    <div className="rp-report ig-report" data-page="identity">
      <ReportHero
        eyebrow={`${label} | current identity snapshot`}
        score={formatPercent(data.multiClusterPct)}
        scoreLabel="multi-record profiles"
        color={REPORT_COLORS.violet}
        title={IDENTITY_REPORT_NAMES.hero}
        summary={
          `${formatCount(data.totalClusters)} customer profiles reconcile to `
          + `${formatCount(data.multiClusters)} multi-record profiles and `
          + `${formatCount(data.singletons)} single-record profiles. `
          + `${formatCount(data.resolvedRecords)} of ${formatCount(data.inputRecords)} identity records `
          + `were successfully connected to another record.`
        }
        tags={[
          'Profile counts reconciled',
          'Single-record profiles retained',
          'Source-backed match evidence',
        ]}
        explanation={reportExplanation}
        evidence={{
          formula: (
            `Connected-record rate = records in multi-record profiles / identity records\n`
            + `${formatCount(data.resolvedRecords)} / ${formatCount(data.inputRecords)} = ${formatPercent(data.coverage)}\n\n`
            + `Multi-record profile rate = multi-record profiles / total customer profiles\n`
            + `${formatCount(data.multiClusters)} / ${formatCount(data.totalClusters)} = ${formatPercent(data.multiClusterPct)}\n\n`
            + `Candidate pairs = same-source pairs + cross-source pairs\n`
            + `${formatCount(data.sameSourcePairs)} + ${formatCount(data.crossSourcePairs)} = ${formatCount(data.candidatePairs)}\n\n`
            + `Weak-confidence share = weak-confidence pairs / candidate pairs\n`
            + `${formatCount(data.weakCandidates)} / ${formatCount(data.candidatePairs)} = ${formatPercent(weakShare)}`
          ),
          provenance: identityProvenance(
            data,
            label,
            `${formatCount(data.inputRecords)} identity records, ${formatCount(data.totalClusters)} customer profiles, and ${formatCount(data.candidatePairs)} candidate pairs`,
            'Source-scoped cluster summary plus one row per candidate pair',
          ),
          businessInsight: reportBusinessInsight,
          callout: (
            'The connected-record rate describes consolidation, not match correctness. '
            + 'Use the measured confidence tiers to understand match-evidence strength.'
          ),
        }}
      />

      {/* Four focused measures. Every card opens the contributing source tables,
          and each table opens up to ten sample records. */}
      <KpiGrid columns={4}>
        <KpiCard
          label="Total Identity Records"
          value={formatCount(data.inputRecords)}
          detail="Physical records in the clustered snapshot · select to view"
          color={REPORT_COLORS.blue}
          evidence="View contributing tables"
          onClick={() => setProfileDrawerType('records')}
        />
        <KpiCard
          label="Unique Customer Profiles"
          value={formatCount(data.totalClusters)}
          detail="Multi-record + single-record profiles · select to view"
          color={REPORT_COLORS.violet}
          evidence="View contributing tables"
          onClick={() => setProfileDrawerType('all')}
        />
        <KpiCard
          label="Multi-record Profiles"
          value={formatCount(data.multiClusters)}
          detail={`${formatPercent(data.multiClusterPct)} of profiles · select to view`}
          color={REPORT_COLORS.cyan}
          evidence="View contributing tables"
          onClick={() => setProfileDrawerType('multi')}
        />
        <KpiCard
          label="Single-record Profiles"
          value={formatCount(data.singletons)}
          detail={`${formatPercent(100 - data.multiClusterPct)} of profiles · select to view`}
          color={REPORT_COLORS.green}
          evidence="View contributing tables"
          onClick={() => setProfileDrawerType('single')}
        />
      </KpiGrid>

      <IdentityPrimaryReportGrid>
        <Panel
          title={IDENTITY_REPORT_NAMES.confidence}
          subtitle={`${formatCount(data.candidatePairs)} candidate pairs and the ${formatCount(data.multiClusters)} profiles they support, at both grains.`}
          action={(
            <ExplainAction
              label="View evidence ↗"
              detail={identityMetricDetail({
                title: IDENTITY_REPORT_NAMES.confidence,
                meaning: `Every one of the ${formatCount(data.candidatePairs)} candidate pairs is classified into exactly one confidence tier, and every one of the ${formatCount(data.multiClusters)} multi-record profiles is counted once under its strongest tier.`,
                formula: [
                  'Candidate pairs = Strong + Medium + Weak + Rejected',
                  ...data.confidenceRows.map(row => (
                    `${row.label}: ${formatCount(row.value)} pairs (${formatPercent(safePercent(row.value, data.candidatePairs))}) · ${formatCount(row.profiles)} profiles (${formatPercent(safePercent(row.profiles, data.multiClusters))})`
                  )),
                  `Pair reconciliation: ${data.confidenceRows.map(row => formatCount(row.value)).join(' + ')} = ${formatCount(data.candidatePairs)}`,
                  `Profile reconciliation: ${data.confidenceRows.map(row => formatCount(row.profiles)).join(' + ')} = ${formatCount(data.multiClusters)}`,
                ].join('\n'),
                scope: `${formatCount(data.candidatePairs)} candidate pairs and ${formatCount(data.multiClusters)} multi-record profiles`,
                grain: 'Pair share at candidate-pair grain; profile share at distinct-profile grain',
                businessInsight: 'Size customer impact from the profile share and tune match rules from the pair share. A large pair share with a small profile share means the tier is concentrated inside a few large profiles.',
                callout: `Confidence is match evidence, not a review outcome. The report does not infer auto-accept or manual-review boundaries without a governed threshold. ${data.confidenceGrainNote || ''}`,
              })}
            />
          )}
        >
          <ConfidenceSpectrum data={data} label={label} />
        </Panel>

      <Panel
        title={IDENTITY_REPORT_NAMES.composition}
        subtitle="Every customer profile classified by whether it contains one or multiple identity records."
        action={(
          <ExplainAction
            label="Explain profile types ↗"
            detail={identityMetricDetail({
              title: IDENTITY_REPORT_NAMES.composition,
              meaning: (
                `${formatCount(data.totalClusters)} customer profiles contain `
                + `${formatCount(data.multiClusters)} multi-record profiles and `
                + `${formatCount(data.singletons)} single-record profiles.`
              ),
              formula: (
                `Total customer profiles = multi-record profiles + single-record profiles\n`
                + `${formatCount(data.multiClusters)} + ${formatCount(data.singletons)} = ${formatCount(data.totalClusters)}`
              ),
              scope: `${formatCount(data.totalClusters)} customer profiles`,
              grain: 'One customer profile classified by number of member records',
              businessInsight: 'Use this composition to understand how much of the profile base benefits from record unification and how much remains represented by a single source record.',
              callout: 'The source artifact does not publish a separate orphan status. In this report, single-record means exactly one input record in the profile.',
            })}
          />
        )}
      >
        <ProfileComposition
          data={data}
          onOpenProfiles={setProfileDrawerType}
        />
      </Panel>

        <Panel
          title={IDENTITY_REPORT_NAMES.identifiers}
          subtitle={`All ${data.identifierRows.length} configured identifier combinations across ${formatCount(data.multiClusters)} multi-record profiles, including those with none observed.`}
          action={(
            <ExplainAction
              label="Explain evidence ↗"
              detail={identityMetricDetail({
                title: IDENTITY_REPORT_NAMES.identifiers,
                meaning: (
                  `All ${formatCount(data.multiClusters)} multi-record customer profiles are `
                  + 'classified once using the strongest governed identifier combination '
                  + 'observed among candidate pairs inside that final profile.'
                ),
                formula: [
                  'Profile share = profiles assigned to an identifier combination / all multi-record profiles',
                  ...data.identifierRows.map(row => (
                    `${row.label} (${row.confidenceTier}): ${formatCount(row.value)} / ${formatCount(data.multiClusters)} = ${formatPercent(row.percentage)}`
                  )),
                  `Reconciliation: ${data.identifierRows.map(row => formatCount(row.value)).join(' + ')} = ${formatCount(data.multiClusters)}`,
                ].join('\n'),
                scope: `${formatCount(data.multiClusters)} multi-record customer profiles`,
                grain: 'One multi-record profile assigned once by in-profile matched-field evidence',
                businessInsight: 'Use this mix to understand what actually connects customer records. Heavy reliance on one-field or low-confidence combinations signals where email, phone, name, or postal-code capture should improve.',
                callout: 'Each profile is counted once under its strongest observed in-profile combination; zero rows remain visible so the governed hierarchy is explicit.',
              })}
            />
          )}
        >
          <IdentifierMatchWaterfall data={data} />
        </Panel>

        <Panel
          title={IDENTITY_REPORT_NAMES.sources}
          subtitle={`Physical identity records across all ${formatCount(data.identitySourceRows.length)} governed source feeds in the selected snapshot.`}
          action={(
            <ExplainAction
              label="Explain sources ↗"
              detail={identityMetricDetail({
                title: IDENTITY_REPORT_NAMES.sources,
                meaning: (
                  `All ${formatCount(data.inputRecords)} physical identity records are `
                  + `grouped by their source-file lineage across ${formatCount(data.identitySourceRows.length)} feeds.`
                ),
                formula: [
                  'Total identity records = sum of identity records across source feeds',
                  `${data.identitySourceRows.map(row => formatCount(row.value)).join(' + ')} = ${formatCount(data.inputRecords)}`,
                ].join('\n'),
                scope: `${formatCount(data.inputRecords)} clustered identity records`,
                grain: 'One clustered input record grouped by governed source-file lineage',
                businessInsight: 'Use the source mix to understand which feeds drive identity-resolution workload and where feed-volume changes can affect matching coverage.',
                callout: 'These are physical input records by source, not candidate-pair endpoints or unique customer profiles.',
              })}
            />
          )}
        >
          <IdentityRecordsBySource data={data} label={label} />
        </Panel>
      </IdentityPrimaryReportGrid>

      <AddReportSelector
        reports={optionalReportCatalog}
        selected={activeSelectedReports}
        onAdd={key => setSelectedReports(current => (
          current.includes(key) ? current : [...current, key]
        ))}
        onRemove={key => setSelectedReports(current => (
          current.filter(reportKey => reportKey !== key)
        ))}
        title="Add another identity report"
        description="The five required identity reports stay visible in business-reading order. Add optional diagnostic reports only when deeper investigation is needed."
      />

      {(
        activeSelectedReports.includes('flow')
        || activeSelectedReports.includes('linkage')
      ) && (
        <div className="rp-grid rp-grid-2 ig-optional-report-grid">
          {activeSelectedReports.includes('flow') && (
            <Panel
              className="ig-flow-panel"
              title={IDENTITY_REPORT_NAMES.flow}
              subtitle="A count-proportional journey from identity records to multi-record and single-record customer profiles."
              action={(
                <ExplainAction
                  label="Explain lineage ↗"
                  detail={identityMetricDetail({
                    title: IDENTITY_REPORT_NAMES.flow,
                    meaning: (
                      `All ${formatCount(data.inputRecords)} input records are accounted for: `
                      + `${formatCount(data.resolvedRecords)} records belong to `
                      + `${formatCount(data.multiClusters)} multi-record customer profiles and `
                      + `${formatCount(data.singletons)} become single-record customer profiles.`
                    ),
                    formula: [
                      (
                        `Records in multi-record profiles = identity records - single-record profiles\n`
                        + `${formatCount(data.inputRecords)} - ${formatCount(data.singletons)} = ${formatCount(data.resolvedRecords)}`
                      ),
                      Number.isFinite(data.averageRecordsPerIdentity)
                        ? (
                          `Average records per multi-record identity = resolved records / multi-record clusters\n`
                          + `${formatCount(data.resolvedRecords)} / ${formatCount(data.multiClusters)} = ${data.averageRecordsPerIdentity.toFixed(1)}`
                        )
                        : '',
                    ].filter(Boolean).join('\n\n'),
                    scope: `${formatCount(data.inputRecords)} input records reconciled`,
                    grain: 'Record outcomes reconciled to identity-cluster outcomes',
                    businessInsight: 'Use the flow to see how many records contribute to connected customer profiles and where identifier enrichment could reduce the single-record profile population.',
                    callout: `The largest cluster contains ${formatCount(data.largestCluster)} records. Flow width represents record volume, not match-confidence strength.`,
                  })}
                />
              )}
            >
              <IdentityResolutionFlow
                data={data}
                onOpenSingleProfiles={() => setProfileDrawerType('single')}
              />
            </Panel>
          )}
          {activeSelectedReports.includes('linkage') && (
            <Panel
              title={IDENTITY_REPORT_NAMES.linkage}
              subtitle="Candidate-pair evidence across the five source feeds with the highest participation."
              badge={`${formatCount(data.candidatePairs)} evidence pairs`}
            >
              <SourceLinkageHeatmap data={data} label={label} />
            </Panel>
          )}
        </div>
      )}

      {activeSelectedReports.includes('review') && (
        <div className="rp-grid rp-grid-2 ig-optional-report-grid">
        <section className="ig-review-strip">
          <div className="ig-review-copy">
            <b>{IDENTITY_REPORT_NAMES.review}</b>
            <span>
              Use the measured weak tier to focus identifier enrichment and match-rule tuning.
            </span>
          </div>
          <div className="ig-review-stat">
            <b>{formatCount(data.weakCandidates)}</b>
            <span>weak-confidence matches</span>
          </div>
          <div className="ig-review-stat">
            <b>{formatPercent(weakShare)}</b>
            <span>of all candidate pairs</span>
          </div>
          <ExplainAction
            className="ig-review-action"
            label="Explain weak matches ↗"
            kicker="Identity confidence evidence"
            detail={identityMetricDetail({
              title: IDENTITY_REPORT_NAMES.review,
              meaning: (
                `${formatCount(data.weakCandidates)} of ${formatCount(data.candidatePairs)} `
                + `candidate pairs are classified in the weakest confidence tier.`
              ),
              formula: (
                `Weak-tier share = weak candidate pairs / all candidate pairs\n`
                + `${formatCount(data.weakCandidates)} / ${formatCount(data.candidatePairs)} = ${formatPercent(weakShare)}`
              ),
              scope: `${formatCount(data.candidatePairs)} candidate pairs`,
              grain: 'One candidate pair assigned to one mutually exclusive confidence tier',
              businessInsight: 'Use this watchlist to prioritize match-rule investigation where the evidence is least decisive and the risk of incorrect consolidation is greatest.',
              callout: 'Weak-tier membership is evidence for investigation; it is not itself an accepted, rejected, or erroneous match.',
            })}
          />
        </section>
        </div>
      )}

      <ContractStrip status="Source validated">
        {data.emailReconciliation?.note || (
          'Profile totals, source volumes, identifier combinations, and candidate-pair categories reconcile to the selected source snapshot.'
        )}
      </ContractStrip>
      <IdentityProfileDrawer
        open={Boolean(profileDrawerType)}
        source={requestedSource}
        label={label}
        profileType={profileDrawerType}
        expectedTotal={{
          records: data.inputRecords,
          connected_records: data.resolvedRecords,
          all: data.totalClusters,
          multi: data.multiClusters,
          single: data.singletons,
        }[profileDrawerType] ?? data.singletons}
        onClose={() => setProfileDrawerType(null)}
      />
      <EvidenceDrawer
        detail={metricEvidence}
        kicker={`${label} identity metric evidence`}
        onClose={() => setMetricEvidence(null)}
      />
    </div>
  )
}
