import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  AddReportSelector,
  ContractStrip,
  Donut,
  EvidenceDrawer,
  KpiCard,
  KpiGrid,
  Panel,
  REPORT_COLORS,
  ReportHero,
  ReportState,
  formatCount,
  formatCurrency,
  formatPercent,
  safePercent,
  sourceLabel,
  useAbortableReport,
  useReportingSource,
} from "../reporting/ReportPrimitives";
import {
  fetchCustomerProfileActivityProfiles,
  fetchCustomerProfileReport,
} from "../reporting/profileCompatibility";
import "./CustomerProfileReporting.css";

const REPORT_SOURCES = new Set(["media", "sports", "automotive", "telecom"]);
const NOT_AVAILABLE = "\u2014";
const PROFILE_REPORT_NAMES = {
  hero: "Customer Profile Summary",
  activity: "Active and Inactive Customer Profiles",
  value: "Customer Lifetime Value Tiers",
  coverage: "Profiles by Source System",
  engagement: "Engagement Distribution",
  breadth: "Sources per Customer Profile",
  breadthSummary: "Profile Source Coverage Summary",
  depth: "Records per Customer Profile",
  household: "Household Composition",
};
const PRIMARY_PROFILE_REPORT_KEYS = [
  "value",
  "coverage",
  "engagement",
  "household",
];

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasMetric(value) {
  return (
    value !== null
    && value !== undefined
    && value !== ""
    && Number.isFinite(Number(value))
  );
}

function firstMetric(...values) {
  const value = values.find(hasMetric);
  return value === undefined ? null : Number(value);
}

function countOrUnavailable(value) {
  return hasMetric(value) ? formatCount(value) : NOT_AVAILABLE;
}

function percentOrUnavailable(value) {
  return hasMetric(value) ? formatPercent(value) : NOT_AVAILABLE;
}

function currencyOrUnavailable(value, compact = true) {
  return hasMetric(value) ? formatCurrency(value, compact) : NOT_AVAILABLE;
}

function valueIntervalLabel(row, fallback) {
  const lowerBound = firstMetric(row?.lower_bound);
  const upperBound = firstMetric(row?.upper_bound);
  if (lowerBound !== null && upperBound !== null) {
    if (lowerBound === upperBound) return formatCurrency(lowerBound, true);
    return `${formatCurrency(lowerBound, true)}\u2013${formatCurrency(upperBound, true)}`;
  }
  return labelOrFallback(row?.label, fallback);
}

function labelOrFallback(value, fallback) {
  const label = String(value || "").trim();
  return label || fallback;
}

function usableIdentityText(value) {
  const text = String(value ?? "").trim();
  return text && !["nan", "none", "null", "n/a", "na", "<na>"].includes(text.toLowerCase())
    ? text
    : "";
}

function proxySafeLabel(value) {
  const label = labelOrFallback(value, "Profile value");
  return /\bltv\b/i.test(label) ? "Profile value" : label;
}

function normalizeCountRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry, index) => {
      const row = isObject(entry) ? entry : { value: entry };
      const value = firstMetric(row.value, row.count, row.profiles, row.total);
      if (value === null) return null;

      return {
        ...row,
        label: labelOrFallback(
          row.label ?? row.name ?? row.band ?? row.tier,
          `Band ${index + 1}`,
        ),
        value: Math.max(0, value),
        sub: row.sub || row.detail || row.description || "",
      };
    })
    .filter(Boolean);
}

function normalizeCoverageRows(rows, totalProfiles) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry, index) => {
      const row = isObject(entry) ? entry : { value: entry };
      const count = firstMetric(row.count, row.profiles, row.coverage_count, row.value);
      const suppliedPct = firstMetric(
        row.pct,
        row.percentage,
        row.coverage_pct,
        row.rate,
      );
      const calculatedPct = count !== null && hasMetric(totalProfiles)
        ? safePercent(count, Number(totalProfiles))
        : null;
      const pct = calculatedPct ?? suppliedPct;

      if (count === null && pct === null) return null;

      return {
        ...row,
        label: labelOrFallback(row.label ?? row.name ?? row.attribute, `Attribute ${index + 1}`),
        count,
        value: pct ?? count,
        isPercent: pct !== null,
        sub: count !== null ? `${formatCount(count)} profiles` : "",
      };
    })
    .filter(Boolean);
}

function hasMeasuredRows(rows) {
  return rows.some(row => Number(row.value) > 0);
}

function sumRows(rows, selector = row => row.value) {
  return rows.reduce(
    (sum, row) => sum + Math.max(0, Number(selector(row)) || 0),
    0,
  );
}

function InlineUnavailable({ children }) {
  return <div className="rp-inline-empty">{children}</div>;
}

function NaturalReportColumns({ reports = [], className = "" }) {
  if (!reports.length) return null;

  const left = reports.filter((_, index) => index % 2 === 0);
  const right = reports.filter((_, index) => index % 2 === 1);
  const renderColumn = (items, side) => (
    <div className={`cp-report-column cp-report-column-${side}`}>
      {items.map(({ key, element, order }) => (
        <div
          key={key}
          className="cp-report-column-item"
          data-report-key={key}
          style={{ order }}
        >
          {element}
        </div>
      ))}
    </div>
  );

  return (
    <div className={`cp-natural-report-columns ${className}`.trim()}>
      {renderColumn(left, "left")}
      {renderColumn(right, "right")}
    </div>
  );
}

function PrimaryReportRows({ reports = [] }) {
  if (!reports.length) return null;

  return (
    <div className="cp-primary-report-grid">
      {reports.map(({ key, element }) => (
        <div
          key={key}
          className="cp-primary-report-item"
          data-report-key={key}
        >
          {element}
        </div>
      ))}
    </div>
  );
}

function ProfileReportLayout({
  children,
  primaryKeys = [],
  selectedKeys = [],
  selector = null,
}) {
  const reportsByKey = new Map(
    React.Children.toArray(children)
      .filter(Boolean)
      .map(element => [element.props?.["data-report-key"], element])
      .filter(([key]) => key),
  );
  const resolve = keys => keys
    .map((key, order) => ({
      key,
      order,
      element: reportsByKey.get(key),
    }))
    .filter(report => report.element);

  return (
    <>
      <PrimaryReportRows reports={resolve(primaryKeys)} />
      {selector && <div className="cp-report-selector-row">{selector}</div>}
      <NaturalReportColumns
        reports={resolve(selectedKeys)}
        className="cp-optional-report-columns"
      />
    </>
  );
}

function ProfilePanelAction({ label, onClick, badge }) {
  return (
    <div className="cp-panel-tools">
      {badge && <span className="rp-panel-badge">{badge}</span>}
      <button type="button" className="cp-panel-action" onClick={onClick}>
        {label} <span aria-hidden="true">↗</span>
      </button>
    </div>
  );
}

function artifactSnapshotName(value) {
  const fileName = String(value || "").split(/[\\/]/).pop() || "";
  const match = fileName.match(/^(.*?)(?:\.([^.]+))?$/);
  const stem = String(match?.[1] || fileName)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
  const extension = String(match?.[2] || "").toUpperCase();
  return [stem, extension ? `(${extension})` : ""].filter(Boolean).join(" ");
}

function profileProvenance(payload, label, scope, grain) {
  const sourceArtifacts = Array.isArray(payload?.explain_report?.sources)
    ? payload.explain_report.sources
      .filter(Boolean)
      .map(artifactSnapshotName)
      .filter(Boolean)
      .join(" · ")
    : "";
  const activityAsOf = payload?.summary?.activity_as_of;

  return [
    { label: "Selected source", value: label },
    { label: "Scope", value: scope },
    {
      label: "Report page",
      value: "Customer Profile → Reporting",
    },
    {
      label: "Artifact snapshots",
      value: sourceArtifacts || "Golden records · Golden-record summary · Household summary",
    },
    activityAsOf
      ? { label: "Activity evidence through", value: activityAsOf }
      : null,
    { label: "Evidence grain", value: grain },
    {
      label: "Snapshot status",
      value: "Current source-scoped resolved-profile universe; no file-level as-of timestamp is published",
    },
  ].filter(Boolean);
}

const PROFILE_CHART_COLORS = [
  REPORT_COLORS.blue,
  REPORT_COLORS.cyan,
  REPORT_COLORS.violet,
  REPORT_COLORS.green,
  REPORT_COLORS.amber,
];

function ActivityStatus({ rows, totalProfiles, statusRule, statusSources }) {
  const measuredTotal = sumRows(rows);
  if (!measuredTotal) {
    return <InlineUnavailable>No supported profile activity dates are available for this source.</InlineUnavailable>;
  }

  const active = rows.find(row => String(row.label).toLowerCase() === "active") || rows[0];
  const activePct = safePercent(active.value, measuredTotal) || 0;
  const reconciles = !hasMetric(totalProfiles) || Number(totalProfiles) === measuredTotal;

  return (
    <div className="cp-activity-wrap">
      <div className="cp-activity-layout">
        <div
          className="cp-activity-ring"
          style={{ "--cp-active": `${Math.max(0, Math.min(activePct, 100))}%` }}
          role="img"
          aria-label={`${formatPercent(activePct)} of profiles have an explicit Active source status`}
        >
          <div className="cp-activity-ring-core">
            <b>{formatPercent(activePct)}</b>
            <span>active</span>
          </div>
        </div>

        <div className="cp-activity-legend">
          {rows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className="cp-activity-row"
              style={{ "--cp-signal": row.color || PROFILE_CHART_COLORS[index] }}
            >
              <i />
              <div>
                <strong>{row.label}</strong>
                <span>{statusRule || "Explicit source status"}</span>
              </div>
              <b>
                {formatCount(row.value)}
                <small>{formatPercent(safePercent(row.value, measuredTotal))}</small>
              </b>
            </div>
          ))}
          <div className={`cp-reconcile-note ${reconciles ? "is-valid" : "is-partial"}`}>
            <strong>{reconciles ? "Reconciled" : "Partial classification"}</strong>
            <span>
              {formatCount(measuredTotal)} classified
              {hasMetric(totalProfiles) ? ` of ${formatCount(totalProfiles)} profiles` : ""}
              {statusSources ? ` · ${statusSources}` : ""}
            </span>
          </div>
        </div>
      </div>
      <div className="cp-chart-note">
        <strong>Status definition:</strong>{" "}
        {statusRule || "The source does not publish an approved profile-status definition."}
      </div>
    </div>
  );
}

function coverageColor(label, index) {
  const normalized = String(label || "").toLowerCase();
  if (normalized.includes("email")) return REPORT_COLORS.green;
  if (normalized.includes("phone")) return REPORT_COLORS.blue;
  if (normalized.includes("name")) return REPORT_COLORS.violet;
  if (normalized.includes("address")) return REPORT_COLORS.amber;
  if (normalized.includes("customer")) return REPORT_COLORS.cyan;
  return PROFILE_CHART_COLORS[index % PROFILE_CHART_COLORS.length];
}

function SourceContributionBars({ rows }) {
  const sourceRows = rows
    .filter(row => row.isPercent && hasMetric(row.value));
  if (!hasMeasuredRows(sourceRows)) {
    return <InlineUnavailable>No source-contribution artifact is available.</InlineUnavailable>;
  }

  return (
    <div className="cp-coverage-layout">
      <div className="cp-coverage-list">
        {sourceRows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className="cp-coverage-row"
            style={{
              "--cp-signal": coverageColor(row.label, index),
              "--cp-delay": `${index * 70}ms`,
            }}
          >
            <div>
              <strong>{row.label}</strong>
              <b>{formatPercent(row.value)}<small>{countOrUnavailable(row.count)} profiles</small></b>
            </div>
            <span><i style={{ "--cp-value": `${Math.max(0, Math.min(Number(row.value) || 0, 100))}%` }} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerValueDistribution({ distribution, summary, label, contract }) {
  const rows = distribution?.bands || [];
  const measuredProfiles = firstMetric(distribution?.profile_count, summary.value_coverage);
  const valueTotal = firstMetric(distribution?.total_value, summary.value_total, summary.total_ltv);
  const medianValue = firstMetric(distribution?.median_value, summary.median_ltv);
  const maximumProfiles = Math.max(...rows.map(row => Number(row.profile_count) || 0), 1);
  const left = 48;
  const right = 712;
  const top = 22;
  const bottom = 172;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const slotWidth = rows.length ? plotWidth / rows.length : plotWidth;
  const barGap = Math.min(8, slotWidth * 0.2);
  const barWidth = Math.max(slotWidth - barGap, 2);
  const profilePoints = rows.map((row, index) => ({
    x: left + slotWidth * (index + 0.5),
    y: bottom - ((Number(row.profile_count) || 0) / maximumProfiles) * plotHeight,
  }));
  const profileAreaPoints = [
    { x: left, y: bottom },
    ...profilePoints,
    { x: right, y: bottom },
  ];
  const profileAreaPath = profilePoints.length ? `${smoothPath(profileAreaPoints)} Z` : "";
  const cumulativeBandPoints = rows.map((row, index) => ({
    x: left + slotWidth * (index + 1),
    y: bottom - (Math.max(0, Math.min(Number(row.cumulative_value_percentage) || 0, 100)) / 100) * plotHeight,
  }));
  const cumulativePoints = [{ x: left, y: bottom }, ...cumulativeBandPoints];
  const cumulativePath = smoothPath(cumulativePoints);

  return (
    <div className="cp-value-distribution-wrap">
      <div className="cp-value-distribution-summary">
        <div><span>{label}</span><strong>{currencyOrUnavailable(valueTotal)}</strong></div>
        <div><span>Profiles measured</span><strong>{countOrUnavailable(measuredProfiles)}</strong></div>
        <div><span>Median profile value</span><strong>{currencyOrUnavailable(medianValue)}</strong></div>
      </div>

      <div className="cp-value-distribution-shell">
        <svg
          className="cp-value-distribution-chart"
          viewBox="0 0 760 226"
          role="img"
          aria-label={`${label} observed-value interval counts with a smooth profile area and cumulative share of represented customer value`}
        >
          <defs>
            <linearGradient id="cp-profile-value-area" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="var(--cp-blue)" stopOpacity=".08" />
              <stop offset="50%" stopColor="var(--cp-blue)" stopOpacity=".26" />
              <stop offset="100%" stopColor="var(--cp-cyan)" stopOpacity=".12" />
            </linearGradient>
          </defs>

          <text className="cp-value-distribution-axis-title" x={left} y="12">Profiles</text>
          <text className="cp-value-distribution-axis-title is-cumulative" x={right} y="12" textAnchor="end">
            Cumulative value
          </text>

          {[0, 0.5, 1].map(ratio => {
            const y = bottom - ratio * plotHeight;
            return (
              <g key={ratio}>
                <line className="cp-value-distribution-grid" x1={left} x2={right} y1={y} y2={y} />
                <text className="cp-value-distribution-axis" x={left - 8} y={y + 3} textAnchor="end">
                  {formatCount(maximumProfiles * ratio)}
                </text>
                <text className="cp-value-distribution-axis is-cumulative" x={right + 8} y={y + 3}>
                  {formatPercent(ratio * 100)}
                </text>
              </g>
            );
          })}

          <path className="cp-value-distribution-area" d={profileAreaPath} />

          {rows.map((row, index) => {
            const height = (Number(row.profile_count) || 0) / maximumProfiles * plotHeight;
            const x = left + slotWidth * index + barGap / 2;
            const y = bottom - height;
            const showLabel = rows.length <= 8 || index % 2 === 0 || index === rows.length - 1;
            const intervalLabel = valueIntervalLabel(row, `Interval ${index + 1}`);
            return (
              <g key={`${row.key || row.label}-${index}`}>
                <rect
                  className="cp-value-distribution-bar"
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(height, 1)}
                  rx="4"
                >
                  <title>{`${intervalLabel}: ${formatCount(row.profile_count)} profiles (${formatPercent(row.profile_percentage)})`}</title>
                </rect>
                {showLabel && (
                  <text
                    className="cp-value-distribution-label"
                    x={left + slotWidth * (index + 0.5)}
                    y={bottom + 18}
                    textAnchor="middle"
                  >
                    {intervalLabel}
                  </text>
                )}
              </g>
            );
          })}

          <path
            className="cp-value-distribution-profile-line"
            d={smoothPath(profileAreaPoints)}
            pathLength="1"
          />
          <path className="cp-value-distribution-curve" d={cumulativePath} pathLength="1" />
          {cumulativeBandPoints.map((point, index) => (
            <circle
              key={`cumulative-${rows[index]?.key || index}`}
              className="cp-value-distribution-point"
              cx={point.x}
              cy={point.y}
              r="3.5"
            >
              <title>{`${rows[index]?.label}: ${formatPercent(rows[index]?.cumulative_value_percentage)} of value represented cumulatively`}</title>
            </circle>
          ))}
          <text
            className="cp-value-distribution-progression"
            x={(left + right) / 2}
            y={bottom + 43}
            textAnchor="middle"
          >
            Observed profile value increases \u2192
          </text>
        </svg>

        <div className="cp-value-distribution-legend" aria-hidden="true">
          <span><i className="is-bar" />Profiles in observed interval</span>
          <span><i className="is-line" />Cumulative share of customer value</span>
        </div>
      </div>

      <div className="cp-chart-note">
        <strong>Distribution contract:</strong>{" "}
        Bars anchor the measured profile count in each observed-value interval; the smooth area only connects those counts for readability and is not an inferred density model. The cyan line shows how much of total customer value is represented cumulatively. These intervals describe the data distribution, not business-defined customer tiers.
        {contract?.coverageKnown && (
          <> Counts reconcile to {formatCount(contract.expectedProfiles)} valued profiles.</>
        )}
      </div>
    </div>
  );
}

function CustomerValueTierReport({ rows, summary, label, contract }) {
  const classifiedProfiles = sumRows(rows);
  const totalValue = firstMetric(summary.total_ltv, summary.value_total);
  const averageValue = firstMetric(summary.average_ltv);
  const colors = ["#4f86b6", "#4c93ad", "#48a0a4", "#43ad98"];

  return (
    <div className="cp-ltv-tier-wrap">
      <div className="cp-value-distribution-summary">
        <div><span>{label}</span><strong>{currencyOrUnavailable(totalValue)}</strong></div>
        <div><span>Profiles classified</span><strong>{formatCount(classifiedProfiles)}</strong></div>
        <div><span>Average profile LTV</span><strong>{currencyOrUnavailable(averageValue)}</strong></div>
      </div>

      <div
        className="cp-ltv-tier-bar"
        role="img"
        aria-label={`Customer lifetime value tiers across ${formatCount(classifiedProfiles)} measured profiles`}
      >
        {rows.map((row, index) => {
          const share = safePercent(row.value, classifiedProfiles) || 0;
          return (
            <div
              key={`${row.label}-${index}`}
              style={{
                "--cp-tier-color": colors[index % colors.length],
                "--cp-tier-share": Math.max(Number(row.value) || 0, 0.25),
              }}
              title={`${row.label}: ${formatCount(row.value)} profiles (${formatPercent(share)})`}
            >
              {share >= 8 && <strong>{formatPercent(share)}</strong>}
            </div>
          );
        })}
      </div>

      <div className="cp-ltv-tier-grid">
        {rows.map((row, index) => {
          const share = safePercent(row.value, classifiedProfiles) || 0;
          return (
            <div
              key={`tier-${row.label}-${index}`}
              style={{ "--cp-tier-color": colors[index % colors.length] }}
            >
              <i />
              <b>{formatCount(row.value)}</b>
              <span><strong>{row.label}</strong><small>{row.range}</small></span>
            </div>
          );
        })}
      </div>

      <div className="cp-chart-note">
        <strong>Tier thresholds:</strong> {summary.value_tier_method}
        {contract?.coverageKnown && (
          <> Counts reconcile to {formatCount(contract.expectedProfiles)} measured profiles.</>
        )}
      </div>
    </div>
  );
}

function smoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  points.slice(0, -1).forEach((current, index) => {
    const previous = points[index - 1] || current;
    const next = points[index + 1];
    const after = points[index + 2] || next;
    const cp1x = current.x + (next.x - previous.x) / 6;
    const cp1y = current.y + (next.y - previous.y) / 6;
    const cp2x = next.x - (after.x - current.x) / 6;
    const cp2y = next.y - (after.y - current.y) / 6;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${next.x} ${next.y}`;
  });
  return path;
}

function EngagementLineChart({ rows }) {
  const gradientId = React.useId().replace(/:/g, "");
  const orderedLabels = ["No response", "Opened only", "Clicked", "Converted"];
  const orderedRows = [...rows].sort((leftRow, rightRow) => {
    const leftIndex = orderedLabels.indexOf(leftRow.label);
    const rightIndex = orderedLabels.indexOf(rightRow.label);
    if (leftIndex < 0 && rightIndex < 0) return 0;
    if (leftIndex < 0) return 1;
    if (rightIndex < 0) return -1;
    return leftIndex - rightIndex;
  });
  const total = sumRows(orderedRows);
  const maximum = Math.max(...orderedRows.map(row => Number(row.value) || 0), 1);
  const left = 76;
  const right = 724;
  const top = 42;
  const bottom = 202;
  const width = right - left;
  const points = orderedRows.map((row, index) => ({
    ...row,
    x: orderedRows.length === 1
      ? (left + right) / 2
      : left + (width * index / (orderedRows.length - 1)),
    y: bottom - ((Number(row.value) || 0) / maximum) * (bottom - top),
    share: safePercent(row.value, total) || 0,
  }));
  const linePath = smoothPath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`
    : "";

  return (
    <div className="cp-engagement-line-wrap">
      <div className="cp-engagement-line-shell">
        <svg
          viewBox="0 0 800 260"
          role="img"
          aria-label={`Engagement distribution across ${formatCount(total)} measured profiles`}
        >
          <defs>
            <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={REPORT_COLORS.cyan} stopOpacity=".34" />
              <stop offset="100%" stopColor={REPORT_COLORS.violet} stopOpacity=".02" />
            </linearGradient>
            <linearGradient id={`${gradientId}-line`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={REPORT_COLORS.blue} />
              <stop offset="50%" stopColor={REPORT_COLORS.violet} />
              <stop offset="100%" stopColor={REPORT_COLORS.cyan} />
            </linearGradient>
          </defs>

          {[0, .25, .5, .75, 1].map((ratio) => {
            const y = bottom - ratio * (bottom - top);
            return (
              <g key={ratio}>
                <line className="cp-engagement-grid" x1={left} x2={right} y1={y} y2={y} />
                <text className="cp-engagement-axis" x={left - 10} y={y + 3} textAnchor="end">
                  {formatCount(maximum * ratio)}
                </text>
              </g>
            );
          })}

          <path className="cp-engagement-area" d={areaPath} fill={`url(#${gradientId}-area)`} />
          <path className="cp-engagement-line" d={linePath} stroke={`url(#${gradientId}-line)`} pathLength="1" />
          {points.map((point, index) => (
            <g
              key={`${point.label}-${index}`}
              className="cp-engagement-node"
              style={{
                "--cp-signal": point.color || PROFILE_CHART_COLORS[index % PROFILE_CHART_COLORS.length],
                "--cp-delay": `${index * 110}ms`,
              }}
            >
              <circle cx={point.x} cy={point.y} r="6">
                <title>{`${point.label}: ${formatCount(point.value)} profiles (${formatPercent(point.share)})`}</title>
              </circle>
              <text className="cp-engagement-value" x={point.x} y={point.y - 15} textAnchor="middle">
                {formatCount(point.value)}
              </text>
              <text className="cp-engagement-label" x={point.x} y={bottom + 28} textAnchor="middle">
                {point.label}
              </text>
              <text className="cp-engagement-share" x={point.x} y={bottom + 43} textAnchor="middle">
                {formatPercent(point.share)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="cp-chart-note">
        <strong>Reconciled distribution:</strong> {formatCount(total)} measured profiles. The connected line compares mutually exclusive response categories; it is not a time trend.
      </div>
    </div>
  );
}

function BreadthCurve({ rows, totalProfiles }) {
  const classifiedTotal = sumRows(rows);
  if (!classifiedTotal) return <InlineUnavailable>No source-breadth distribution is available.</InlineUnavailable>;

  const populationTotal = hasMetric(totalProfiles) && Number(totalProfiles) > 0
    ? Number(totalProfiles)
    : classifiedTotal;

  const left = 60;
  const right = 740;
  const top = 30;
  const bottom = 176;
  const points = rows.map((row, index) => {
    const share = safePercent(row.value, populationTotal) || 0;
    return {
      ...row,
      share,
      x: rows.length === 1 ? 400 : left + (index * (right - left)) / (rows.length - 1),
      y: bottom - (share / 100) * (bottom - top),
      color: row.color || PROFILE_CHART_COLORS[index % PROFILE_CHART_COLORS.length],
    };
  });
  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;
  const dominantIndex = points.reduce(
    (leader, row, index, collection) => (row.share > collection[leader].share ? index : leader),
    0,
  );
  const step = points.length > 1 ? (right - left) / (points.length - 1) : right - left;
  const bandX = Math.max(left, points[dominantIndex].x - step * 0.48);
  const bandRight = Math.min(right, points[dominantIndex].x + step * 0.48);
  const reconciles = classifiedTotal === populationTotal;

  return (
    <div className="cp-breadth-curve">
      <div className="cp-breadth-curve-shell">
        <svg viewBox="0 0 800 226" role="img" aria-label="Profile source breadth distribution">
          <defs>
            <linearGradient id="cpBreadthArea" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#35e4f6" stopOpacity=".45" />
              <stop offset="1" stopColor="#338fff" stopOpacity=".03" />
            </linearGradient>
          </defs>
          {[100, 75, 50, 25, 0].map(value => {
            const y = bottom - (value / 100) * (bottom - top);
            return (
              <g key={value}>
                <line className="cp-breadth-grid" x1={left} x2={right} y1={y} y2={y} />
                <text className="cp-breadth-axis" x={left - 12} y={y + 3} textAnchor="end">{value}%</text>
              </g>
            );
          })}
          <rect
            className="cp-breadth-dominant-band"
            x={bandX}
            y={top}
            width={Math.max(10, bandRight - bandX)}
            height={bottom - top}
            rx="8"
          />
          <path className="cp-breadth-area" d={areaPath} fill="url(#cpBreadthArea)" />
          <path className="cp-breadth-line" pathLength="1" d={linePath} />
          {points.map((row, index) => (
            <g
              key={`${row.label}-${index}`}
              className={`cp-breadth-node ${index === dominantIndex ? "is-dominant" : ""}`}
              style={{ "--cp-signal": row.color, "--cp-delay": `${300 + index * 110}ms` }}
            >
              <circle cx={row.x} cy={row.y} r={index === dominantIndex ? 6 : 5}>
                <title>{`${row.label}: ${formatCount(row.value)} profiles (${formatPercent(row.share)})`}</title>
              </circle>
              <text className="cp-breadth-value" x={row.x} y={Math.max(18, row.y - 12)} textAnchor="middle">
                {formatPercent(row.share)}
              </text>
              <text className="cp-breadth-label" x={row.x} y="205" textAnchor="middle">{row.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className={`cp-chart-note ${reconciles ? "" : "is-warning"}`}>
        <strong>{reconciles ? "Reconciled scale:" : "Partial classification:"}</strong>{" "}
        {formatCount(classifiedTotal)} of {formatCount(populationTotal)} profiles are classified on the same fixed 0–100% population axis.
      </div>
    </div>
  );
}

function BreadthMagnifier({ rows, totalProfiles }) {
  const classifiedTotal = sumRows(rows);
  if (!classifiedTotal) return <InlineUnavailable>No breadth-band evidence is available.</InlineUnavailable>;

  const populationTotal = hasMetric(totalProfiles) && Number(totalProfiles) > 0
    ? Number(totalProfiles)
    : classifiedTotal;

  const dominant = rows.reduce((leader, row) => (
    !leader || Number(row.value) > Number(leader.value) ? row : leader
  ), null);
  const dominantShare = safePercent(dominant.value, populationTotal) || 0;
  const tail = rows.filter(row => row !== dominant).map((row, index) => ({
    ...row,
    share: safePercent(row.value, populationTotal) || 0,
    color: row.color || PROFILE_CHART_COLORS[(index + 1) % PROFILE_CHART_COLORS.length],
  }));
  const unclassified = Math.max(populationTotal - classifiedTotal, 0);
  if (unclassified > 0) {
    tail.push({
      label: "Unclassified",
      value: unclassified,
      share: safePercent(unclassified, populationTotal) || 0,
      color: REPORT_COLORS.slate,
    });
  }
  const tailMax = Math.max(...tail.map(row => row.share), 0);
  const tailScale = tailMax <= 5
    ? Math.max(0.5, Math.ceil(tailMax * 2) / 2)
    : Math.ceil(tailMax / 5) * 5;

  return (
    <div className="cp-breadth-side">
      <div className="cp-dominant-card">
        <span>Dominant breadth band</span>
        <b>{dominant.label}</b>
        <strong>{formatPercent(dominantShare)} · {formatCount(dominant.value)} profiles</strong>
        <p>{formatCount(populationTotal - dominant.value)} profiles sit outside this band ({formatPercent(100 - dominantShare)}).</p>
      </div>
      <div className="cp-tail-panel">
        <div className="cp-tail-head">
          <span>Long-tail magnifier</span>
          <b>{tail.length ? `Independent 0–${formatPercent(tailScale)} scale` : "No secondary bands"}</b>
        </div>
        {tail.length ? tail.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className="cp-tail-row"
            style={{ "--cp-signal": row.color, "--cp-delay": `${index * 80}ms` }}
          >
            <span>{row.label}</span>
            <span className="cp-tail-track">
              <i style={{ "--cp-value": `${tailScale ? (row.share / tailScale) * 100 : 0}%` }} />
            </span>
            <b>{formatPercent(row.share)}<small>{formatCount(row.value)} profiles</small></b>
          </div>
        )) : <div className="rp-inline-empty">Every classified profile is in the dominant band.</div>}
      </div>
      <div className="cp-chart-note">
        <strong>Magnified scale:</strong> smaller bands use the labelled secondary axis so their distribution remains readable.
      </div>
    </div>
  );
}

function DepthHistogram({ rows, totalProfiles }) {
  const classifiedTotal = sumRows(rows);
  const populationTotal = hasMetric(totalProfiles) && Number(totalProfiles) > 0
    ? Number(totalProfiles)
    : classifiedTotal;
  const max = Math.max(...rows.map(row => Number(row.value) || 0), 1);
  if (!classifiedTotal) return <InlineUnavailable>No profile-depth distribution is available.</InlineUnavailable>;
  const reconciles = classifiedTotal === populationTotal;

  return (
    <div className="cp-depth-wrap">
      <div className="cp-depth-chart" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
        {rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className="cp-depth-column"
            style={{ "--cp-signal": row.color || PROFILE_CHART_COLORS[index % PROFILE_CHART_COLORS.length], "--cp-delay": `${index * 70}ms` }}
          >
            <b>{formatPercent(safePercent(row.value, populationTotal))}<small>{formatCount(row.value)}</small></b>
            <span><i style={{ "--cp-height": `${Math.max(4, (Number(row.value) / max) * 100)}%` }} /></span>
            <small>{row.label}</small>
          </div>
        ))}
      </div>
      <div className={`cp-chart-note ${reconciles ? "" : "is-warning"}`}>
        <strong>{reconciles ? "Reconciled distribution:" : "Partial depth evidence:"}</strong>{" "}
        {formatCount(classifiedTotal)} of {formatCount(populationTotal)} profiles are represented; percentages always use the full resolved-profile denominator.
      </div>
    </div>
  );
}

function validatePayload(payload, expectedSource) {
  if (!REPORT_SOURCES.has(expectedSource)) {
    throw new Error("The selected source system is not supported by this report.");
  }
  if (!isObject(payload)) {
    throw new Error("Customer profile reporting returned an invalid response.");
  }

  const returnedSource = String(payload.source_system || "").trim().toLowerCase();
  if (returnedSource !== expectedSource) {
    throw new Error("Customer profile reporting did not match the selected source.");
  }
  if (typeof payload.data_available !== "boolean") {
    if (isObject(payload.summary) && Object.keys(payload.summary).length === 0) {
      return { ...payload, data_available: false };
    }
    throw new Error("Customer profile reporting did not declare data availability.");
  }
  if (payload.data_available && !isObject(payload.summary)) {
    throw new Error("Customer profile reporting returned an invalid summary.");
  }
  if (payload.data_available) {
    const totalProfiles = firstMetric(payload.summary.total_profiles);
    const identityProfiles = firstMetric(payload.summary.identity_cluster_total);
    const multiProfiles = firstMetric(payload.summary.multi_profiles);
    const singleProfiles = firstMetric(payload.summary.singleton_profiles);
    const totalsReconcile = (
      totalProfiles !== null
      && identityProfiles !== null
      && multiProfiles !== null
      && singleProfiles !== null
      && totalProfiles === identityProfiles
      && totalProfiles === multiProfiles + singleProfiles
      && payload.summary.profile_universe_reconciles !== false
      && payload.summary.profile_composition_reconciles !== false
    );
    if (!totalsReconcile) {
      throw new Error(
        "Customer profile totals do not reconcile to the Identity Graph "
        + "profile universe and multi-record plus single-record composition.",
      );
    }
  }

  return payload;
}

function prepareReport(payload) {
  const summary = isObject(payload?.summary) ? payload.summary : {};
  const totalProfiles = firstMetric(summary.total_profiles);

  const coverage = normalizeCoverageRows(payload?.coverage, totalProfiles)
    .filter(row => Number(row.count) > 0 || Number(row.value) > 0)
    .slice(0, 4);
  const sourceContribution = normalizeCoverageRows(
    payload?.source_contribution,
    totalProfiles,
  )
    .filter(row => Number(row.count) > 0 || Number(row.value) > 0)
    .slice(0, 8);
  const depth = normalizeCountRows(payload?.depth).map(row => ({
    ...row,
    label: /\brecord/i.test(row.label)
      ? row.label
      : `${row.label} ${row.label === "1" ? "record" : "records"}`,
  }));
  const breadth = normalizeCountRows(payload?.breadth);
  const householdDistribution = normalizeCountRows(payload?.household_distribution).map(row => ({
    ...row,
    label: /\bmember/i.test(row.label)
      ? row.label
      : `${row.label} ${row.label === "1" ? "member" : "members"}`,
  }));
  const rawValueDistribution = isObject(payload?.customer_value_distribution)
    ? payload.customer_value_distribution
    : null;
  const rawValueDistributionBands = Array.isArray(rawValueDistribution?.bands)
    ? rawValueDistribution.bands.map((entry, index) => {
      const row = isObject(entry) ? entry : {};
      const profileCount = firstMetric(row.profile_count, row.count, row.value);
      const valueAmount = firstMetric(row.value_amount, row.amount);
      if (profileCount === null || valueAmount === null) return null;
      return {
        ...row,
        key: String(row.key || `interval-${index + 1}`),
        label: labelOrFallback(row.label, `Observed interval ${index + 1}`),
        value: Math.max(0, Number(profileCount)),
        profile_count: Math.max(0, Number(profileCount)),
        profile_percentage: Math.max(0, Number(firstMetric(row.profile_percentage) || 0)),
        value_amount: Math.max(0, Number(valueAmount)),
        value_percentage: Math.max(0, Number(firstMetric(row.value_percentage) || 0)),
        cumulative_profile_count: Math.max(0, Number(firstMetric(row.cumulative_profile_count) || 0)),
        cumulative_profile_percentage: Math.max(0, Number(firstMetric(row.cumulative_profile_percentage) || 0)),
        cumulative_value_amount: Math.max(0, Number(firstMetric(row.cumulative_value_amount) || 0)),
        cumulative_value_percentage: Math.max(0, Number(firstMetric(row.cumulative_value_percentage) || 0)),
      };
    }).filter(Boolean)
    : [];
  const valueTiers = normalizeCountRows(payload?.value_tiers).slice(0, 4);
  const engagementDistribution = normalizeCountRows(
    payload?.engagement_distribution,
  ).slice(0, 8).map((row, index) => ({
    ...row,
    color: row.color || PROFILE_CHART_COLORS[index % PROFILE_CHART_COLORS.length],
  }));
  const engagementClassified = sumRows(engagementDistribution);
  const engagementCoverage = firstMetric(
    summary.engagement_profile_count,
    summary.engagement_coverage,
  );
  const engagementContract = {
    classified: engagementClassified,
    expected: engagementCoverage,
    valid: (
      hasMetric(summary.average_engagement)
      && engagementCoverage !== null
      && String(summary.engagement_unit || "").trim().toLowerCase() === "percent"
      && Boolean(String(summary.engagement_formula || "").trim())
      && Boolean(String(summary.engagement_window || "").trim())
      && engagementDistribution.length > 0
      && engagementClassified > 0
      && engagementClassified === engagementCoverage
    ),
  };
  const eventsByType = normalizeCountRows(payload?.events_by_type).slice(0, 8).map(
    (row, index) => ({
      ...row,
      color: row.color || PROFILE_CHART_COLORS[index % PROFILE_CHART_COLORS.length],
    }),
  );
  const classifiedCustomerEvents = sumRows(eventsByType);
  const totalCustomerEvents = firstMetric(summary.total_customer_events);
  const customerEventContract = {
    classified: classifiedCustomerEvents,
    expected: totalCustomerEvents,
    valid: (
      totalCustomerEvents !== null
      && totalCustomerEvents > 0
      && eventsByType.length > 0
      && classifiedCustomerEvents === totalCustomerEvents
      && Array.isArray(summary.customer_event_fields)
      && summary.customer_event_fields.length > 0
      && Boolean(String(summary.customer_event_grain || "").trim())
    ),
  };

  const activityCountsReconcile = (
    hasMetric(summary.active_profiles)
    && hasMetric(summary.inactive_profiles)
    && (
      totalProfiles === null
      || Number(summary.active_profiles) + Number(summary.inactive_profiles) === totalProfiles
    )
  );
  const statusContract = Array.isArray(summary.status_contract)
    ? summary.status_contract.filter(isObject)
    : [];
  const activityStatusSources = [...new Set(statusContract.map(rule => (
    String(rule.source_label || rule.source_file || "").trim()
  )).filter(Boolean))].join(", ");
  const activityRule = statusContract.map(rule => {
    const sourceName = String(rule.source_label || rule.source_file || "Source").trim();
    const activeValues = Array.isArray(rule.active_values) ? rule.active_values.join(", ") : "";
    const inactiveValues = Array.isArray(rule.inactive_values) ? rule.inactive_values.join(", ") : "";
    return `${sourceName}: Active = ${activeValues}; Inactive = ${inactiveValues}`;
  }).join(" \u00b7 ");
  const statusCoveragePct = firstMetric(summary.status_coverage_pct);
  const activityStatusContractValid = (
    String(summary.status_classification_basis || "").trim().toLowerCase()
      === "explicit_source_lifecycle_status"
    && summary.status_classification_complete === true
    && Number(summary.unclassified_profiles) === 0
    && statusCoveragePct === 100
    && Boolean(activityRule)
    && Boolean(activityStatusSources)
    && activityCountsReconcile
  );
  const activity = (
    activityStatusContractValid
  )
    ? [
      {
        label: "Active",
        value: Math.max(0, Number(summary.active_profiles)),
        color: REPORT_COLORS.green,
        sub: activityRule,
      },
      {
        label: "Inactive",
        value: Math.max(0, Number(summary.inactive_profiles)),
        color: REPORT_COLORS.amber,
        sub: activityRule,
      },
    ]
    : [];
  const activityTotal = sumRows(activity);
  const activeProfileCount = activity.find(row => row.label === "Active")?.value;
  const inactiveProfileCount = activity.find(row => row.label === "Inactive")?.value;
  const activeProfilePct = activityTotal
    ? safePercent(activeProfileCount, activityTotal)
    : activityStatusContractValid
      ? firstMetric(summary.active_pct)
      : null;
  const inactiveProfilePct = activityTotal
    ? safePercent(inactiveProfileCount, activityTotal)
    : activityStatusContractValid
      ? firstMetric(summary.inactive_pct)
      : null;

  const unifiedComposition = hasMetric(summary.multi_profiles) && hasMetric(summary.singleton_profiles)
    ? [
      {
        label: "Multi-record profiles",
        value: Math.max(0, Number(summary.multi_profiles)),
        color: REPORT_COLORS.violet,
        sub: "Unified from more than one record",
      },
      {
        label: "Single-record profiles",
        value: Math.max(0, Number(summary.singleton_profiles)),
        color: REPORT_COLORS.cyan,
        sub: "Represented by one record",
      },
    ]
    : [];
  const unifiedClassified = sumRows(unifiedComposition);
  const unifiedContract = {
    valid: unifiedComposition.length === 0
      || totalProfiles === null
      || unifiedClassified === totalProfiles,
    classified: unifiedClassified,
    expected: totalProfiles,
  };
  const unifiedProfileRate = hasMetric(summary.multi_profiles) && hasMetric(totalProfiles)
    ? safePercent(summary.multi_profiles, totalProfiles)
    : firstMetric(summary.unified_profile_rate);

  const householdTotal = firstMetric(summary.households);
  const reportedMultiHouseholds = firstMetric(summary.multi_member_households);
  const householdClassified = sumRows(householdDistribution);
  const derivedMultiHouseholds = householdDistribution.reduce((sum, row) => {
    const match = String(row.label || "").match(/^\s*(\d+)/);
    const size = match ? Number(match[1]) : null;
    return size !== null && size >= 2 ? sum + Number(row.value || 0) : sum;
  }, 0);
  const distributionHouseholdsValid = householdDistribution.length === 0
    || householdTotal === null
    || householdClassified === householdTotal;
  const distributionMultiValid = householdDistribution.length === 0
    || reportedMultiHouseholds === null
    || derivedMultiHouseholds === reportedMultiHouseholds;
  const resolvedHouseholdTotal = householdTotal !== null
    ? householdTotal
    : householdClassified > 0
      ? householdClassified
      : null;
  const householdContract = {
    valid: distributionHouseholdsValid && distributionMultiValid,
    classified: householdClassified,
    expected: householdTotal,
    resolvedTotal: resolvedHouseholdTotal,
    derivedMulti: householdDistribution.length ? derivedMultiHouseholds : reportedMultiHouseholds,
  };
  const resolvedMultiHouseholds = householdDistribution.length
    ? derivedMultiHouseholds
    : reportedMultiHouseholds;
  const householdComposition = householdContract.valid
    && resolvedHouseholdTotal !== null
    && resolvedMultiHouseholds !== null
    ? [
      {
        label: "One-member households",
        value: Math.max(0, resolvedHouseholdTotal - resolvedMultiHouseholds),
        color: REPORT_COLORS.green,
        sub: "One retained profile in the household artifact",
      },
      {
        label: "Multi-member households",
        value: Math.max(0, resolvedMultiHouseholds),
        color: REPORT_COLORS.amber,
        sub: "Two or more retained profiles in the household artifact",
      },
    ]
    : [];

  const breadthTotal = sumRows(breadth);
  const dominantBreadth = breadth.reduce(
    (leader, row) => (!leader || row.value > leader.value ? row : leader),
    null,
  );
  const dominantBreadthShare = dominantBreadth
    ? safePercent(dominantBreadth.value, totalProfiles || breadthTotal)
    : null;

  const valueMetricType = String(summary.value_metric_type || "").trim().toLowerCase();
  const hasLtvEvidence = (
    valueMetricType === "ltv"
    && hasMetric(summary.total_ltv)
    && String(summary.ltv_currency || "").trim().toUpperCase() === "USD"
  );
  const isHistoricalRealizedLtv = (
    String(summary.ltv_basis || "").trim().toLowerCase() === "historical_realized"
  );
  const valueDistribution = hasLtvEvidence && rawValueDistribution?.data_available !== false
    ? {
      ...rawValueDistribution,
      bands: rawValueDistributionBands,
    }
    : null;
  const valueLabel = hasLtvEvidence
    ? labelOrFallback(summary.ltv_label, "Lifetime value")
    : proxySafeLabel(summary.value_label);
  const valuePanelTitle = PROFILE_REPORT_NAMES.value;
  const valueCoverageDetail = hasMetric(summary.value_coverage)
    ? `${formatCount(summary.value_coverage)} profiles (${percentOrUnavailable(
      safePercent(summary.value_coverage, totalProfiles),
    )} coverage)`
    : "";
  const valuePanelSubtitle = hasLtvEvidence
    ? [
      isHistoricalRealizedLtv
        ? "Cumulative realized value from qualifying linked transactions"
        : "Governed lifetime-value distribution",
      hasMetric(summary.average_ltv)
        ? `average ${formatCurrency(summary.average_ltv, true)}`
        : "",
      valueCoverageDetail,
    ].filter(Boolean).join(" \u00b7 ")
    : hasMetric(summary.value_total)
      ? [
        "Governed value proxy, not LTV",
        `${formatCurrency(summary.value_total, true)} total`,
        valueCoverageDetail,
      ].filter(Boolean).join(" \u00b7 ")
      : "No governed lifetime-value or value-proxy measure is available";

  const distributionProfileTotal = rawValueDistributionBands.reduce(
    (sum, row) => sum + Number(row.profile_count || 0),
    0,
  );
  const distributionValueTotal = rawValueDistributionBands.reduce(
    (sum, row) => sum + Number(row.value_amount || 0),
    0,
  );
  const expectedDistributionProfiles = firstMetric(
    valueDistribution?.profile_count,
    summary.value_coverage,
  );
  const expectedDistributionValue = firstMetric(
    valueDistribution?.total_value,
    summary.value_total,
    summary.total_ltv,
  );
  const distributionValueTolerance = expectedDistributionValue === null
    ? 0
    : Math.max(0.01, Math.abs(expectedDistributionValue) * 0.000001);
  const finalDistributionBand = rawValueDistributionBands.at(-1);
  const valueDistributionContract = {
    coverageKnown: expectedDistributionProfiles !== null,
    expectedProfiles: expectedDistributionProfiles,
    classifiedProfiles: distributionProfileTotal,
    expectedValue: expectedDistributionValue,
    classifiedValue: distributionValueTotal,
    valid: Boolean(valueDistribution)
      && rawValueDistributionBands.length > 0
      && expectedDistributionProfiles !== null
      && distributionProfileTotal === expectedDistributionProfiles
      && expectedDistributionValue !== null
      && expectedDistributionValue > 0
      && Math.abs(distributionValueTotal - expectedDistributionValue) <= distributionValueTolerance
      && Number(finalDistributionBand?.cumulative_profile_count) === expectedDistributionProfiles
      && Math.abs(Number(finalDistributionBand?.cumulative_profile_percentage) - 100) <= 0.2
      && Math.abs(Number(finalDistributionBand?.cumulative_value_amount) - expectedDistributionValue) <= distributionValueTolerance
      && Math.abs(Number(finalDistributionBand?.cumulative_value_percentage) - 100) <= 0.2,
  };
  const topCoverage = coverage.reduce(
    (leader, row) => (!leader || Number(row.value) > Number(leader.value) ? row : leader),
    null,
  );
  const topSourceContribution = sourceContribution.reduce(
    (leader, row) => (!leader || Number(row.value) > Number(leader.value) ? row : leader),
    null,
  );

  const heroSummary = [
    hasMetric(totalProfiles)
      ? `${formatCount(totalProfiles)} source-scoped customer profiles are represented across the resolved identity universe.`
      : "",
    activityStatusContractValid && hasMetric(activeProfilePct)
      ? `${formatPercent(activeProfilePct)} have an explicit Active status under the source-defined profile-status rule.`
      : "",
    hasLtvEvidence
      ? `${valueLabel} is governed at profile grain.`
      : "",
  ].filter(Boolean).join(" ");

  return {
    summary,
    totalProfiles,
    coverage,
    sourceContribution,
    depth,
    breadth,
    householdDistribution,
    valueDistribution,
    valueTiers,
    engagementDistribution,
    engagementContract,
    eventsByType,
    totalCustomerEvents,
    customerEventContract,
    activity,
    activityRule,
    activityStatusSources,
    activityStatusContractValid,
    statusCoveragePct,
    activeProfilePct,
    inactiveProfilePct,
    unifiedComposition,
    unifiedContract,
    unifiedProfileRate,
    householdComposition,
    householdContract,
    dominantBreadth,
    dominantBreadthShare,
    breadthTotal,
    valueDistributionContract,
    topCoverage,
    topSourceContribution,
    hasLtvEvidence,
    isHistoricalRealizedLtv,
    valueLabel,
    valuePanelTitle,
    valuePanelSubtitle,
    heroSummary: heroSummary || "Source-scoped customer profile artifacts are available for reporting.",
  };
}

function ActivityProfileDrilldown({ request, source, onClose }) {
  const pageSize = 25;
  const dialogRef = useRef(null);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState({
    loading: false,
    error: "",
    data: null,
  });

  useEffect(() => {
    setPage(1);
  }, [request?.status, source]);

  useEffect(() => {
    if (!request) return undefined;
    const controller = new AbortController();
    setState({ loading: true, error: "", data: null });
    fetchCustomerProfileActivityProfiles(
      source,
      request.status,
      page,
      pageSize,
      controller.signal,
    ).then(payload => {
      const returnedSource = String(payload?.source_system || "").trim().toLowerCase();
      const returnedStatus = String(payload?.status || "").trim().toLowerCase();
      const total = firstMetric(payload?.total);
      const rows = Array.isArray(payload?.rows) ? payload.rows : null;
      const rowsAreValid = rows?.every(row => (
        isObject(row)
        && Boolean(usableIdentityText(row.profile_id))
        && String(row.activity_status || "").trim().toLowerCase() === request.status
      ));
      if (
        payload?.data_available !== true
        || returnedSource !== source
        || returnedStatus !== request.status
        || total === null
        || total < 0
        || rows === null
        || !rowsAreValid
        || total !== Number(request.expectedTotal)
      ) {
        throw new Error("The customer list did not reconcile to the selected KPI.");
      }
      setState({ loading: false, error: "", data: payload });
    }).catch(error => {
      if (error?.name === "AbortError") return;
      setState({
        loading: false,
        error: error?.message || "Unable to load the customer list.",
        data: null,
      });
    });
    return () => controller.abort();
  }, [request, source, page, reloadToken]);

  useEffect(() => {
    if (!request) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    const handleKeyDown = event => {
      if (event.key === "Escape") onClose?.();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [request, onClose]);

  if (!request) return null;
  const data = state.data || {};
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const total = firstMetric(data.total) || Number(request.expectedTotal) || 0;
  const totalPages = Math.max(Number(data.total_pages) || Math.ceil(total / pageSize), 1);
  const statusLabel = request.status === "active" ? "Active" : "Inactive";

  return (
    <div
      className="cp-profile-list-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        className="cp-profile-list-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-profile-list-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header>
          <div>
            <span>{sourceLabel(source)} customer-profile evidence</span>
            <h3 id="cp-profile-list-title">{statusLabel} Profiles</h3>
            <p>Customers classified by the complete, explicit source-status contract.</p>
          </div>
          <button
            type="button"
            autoFocus
            aria-label="Close customer list"
            onClick={onClose}
          >
            {"\u00d7"}
          </button>
        </header>

        <div className="cp-profile-list-summary" aria-live="polite">
          <div>
            <strong>{state.loading ? "Loading\u2026" : `${formatCount(total)} profiles`}</strong>
            <span>
              {data.activity_rule || request.activityRule || "Explicit source profile status"}
            </span>
          </div>
          <b data-freshness="current">100% status coverage</b>
        </div>

        <div className="cp-profile-list-body">
          {state.loading && (
            <div className="cp-profile-list-empty" role="status">
              {"Loading the source-backed customer list\u2026"}
            </div>
          )}
          {state.error && (
            <div className="cp-profile-list-error" role="alert">
              <p>{state.error}</p>
              <button type="button" onClick={() => setReloadToken(value => value + 1)}>
                Try again
              </button>
            </div>
          )}
          {!state.loading && !state.error && rows.length === 0 && (
            <div className="cp-profile-list-empty">
              No profiles match this explicit source status.
            </div>
          )}
          {!state.loading && !state.error && rows.length > 0 && (
            <div className="cp-profile-list-table-wrap">
              <table className="cp-profile-list-table">
                <thead>
                  <tr>
                    <th>Customer Profile</th>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Member Records</th>
                    <th>Status Evidence</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const profileId = usableIdentityText(row.profile_id);
                    const email = usableIdentityText(row.email);
                    const phone = usableIdentityText(row.phone);
                    const customerName = (
                      usableIdentityText(row.customer_name)
                      || email
                      || phone
                      || profileId
                    );
                    const statusEvidence = Array.isArray(row.status_evidence)
                      ? row.status_evidence.map(evidence => {
                        const sourceName = usableIdentityText(
                          evidence?.source_label || evidence?.source_file,
                        );
                        const field = usableIdentityText(evidence?.status_field);
                        const value = usableIdentityText(evidence?.source_status);
                        return [sourceName, field && value ? `${field}: ${value}` : value]
                          .filter(Boolean)
                          .join(" · ");
                      }).filter(Boolean).join("; ")
                      : "";
                    return (
                      <tr key={profileId}>
                        <td><strong>{profileId || NOT_AVAILABLE}</strong></td>
                        <td>{customerName || NOT_AVAILABLE}</td>
                        <td>
                          <span>{email || NOT_AVAILABLE}</span>
                          <small>{phone || NOT_AVAILABLE}</small>
                        </td>
                        <td>{countOrUnavailable(row.member_record_count)}</td>
                        <td>
                          {statusEvidence
                            || usableIdentityText(row.status_source)
                            || usableIdentityText(row.source_status)
                            || request.statusSources
                            || "Explicit source status"}
                        </td>
                        <td>
                          <b className={`cp-activity-status cp-activity-status-${request.status}`}>
                            {statusLabel}
                          </b>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer>
          <div>
            <strong>{data.privacy_note || "Contact values are masked."}</strong>
            <span>{data.classification_note}</span>
          </div>
          <nav aria-label="Customer list pages">
            <button
              type="button"
              disabled={page <= 1 || state.loading}
              onClick={() => setPage(value => Math.max(value - 1, 1))}
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages || state.loading}
              onClick={() => setPage(value => value + 1)}
            >
              Next
            </button>
          </nav>
        </footer>
      </section>
    </div>
  );
}

export default function CustomerProfile_ReportView() {
  const sourceSystem = useReportingSource("media");
  const [retryToken, setRetryToken] = useState(0);
  const [panelExplanation, setPanelExplanation] = useState(null);
  const [activityDrilldown, setActivityDrilldown] = useState(null);
  const [selectedReports, setSelectedReports] = useState([]);

  useEffect(() => {
    setPanelExplanation(null);
    setActivityDrilldown(null);
    setSelectedReports([]);
  }, [sourceSystem]);

  const reportState = useAbortableReport(
    async signal => {
      if (!REPORT_SOURCES.has(sourceSystem)) {
        throw new Error("The selected source system is not supported by this report.");
      }

      return validatePayload(
        await fetchCustomerProfileReport(sourceSystem, signal),
        sourceSystem,
      );
    },
    [sourceSystem, retryToken],
  );

  const report = useMemo(() => prepareReport(reportState.data), [reportState.data]);
  const availableReportKeys = useMemo(() => {
    const activityTotal = sumRows(report.activity);
    return [
      activityTotal > 0
        && hasMeasuredRows(report.activity)
        && report.activityStatusContractValid
        ? "activity"
        : null,
      report.valueDistributionContract.valid
        && hasMeasuredRows(report.valueDistribution?.bands)
        ? "value"
        : null,
      hasMeasuredRows(report.sourceContribution) ? "coverage" : null,
      report.engagementContract.valid && hasMeasuredRows(report.engagementDistribution)
        ? "engagement"
        : null,
      report.breadthTotal > 0 && hasMeasuredRows(report.breadth) ? "breadth" : null,
      report.breadthTotal > 0 && hasMeasuredRows(report.breadth) ? "breadthSummary" : null,
      hasMeasuredRows(report.depth) ? "depth" : null,
      report.householdContract.valid && hasMeasuredRows(report.householdComposition)
        ? "household"
        : null,
    ].filter(Boolean);
  }, [report]);
  const availabilitySignature = availableReportKeys.join("|");
  const primaryReportKeys = useMemo(
    () => PRIMARY_PROFILE_REPORT_KEYS.filter(key => availableReportKeys.includes(key)),
    [availableReportKeys],
  );
  const optionalReportKeys = useMemo(
    () => availableReportKeys.filter(key => !PRIMARY_PROFILE_REPORT_KEYS.includes(key)),
    [availableReportKeys],
  );

  useEffect(() => {
    setSelectedReports(current => (
      current.filter(key => optionalReportKeys.includes(key))
    ));
  }, [sourceSystem, availabilitySignature, availableReportKeys, optionalReportKeys]);

  const selectedSourceLabel = sourceLabel(sourceSystem);
  const reportSource = String(reportState.data?.source_system || "").trim().toLowerCase();
  const hasStaleSourceData = Boolean(reportState.data) && reportSource !== sourceSystem;
  const retry = () => setRetryToken(value => value + 1);

  if (reportState.loading || hasStaleSourceData) {
    return (
      <div className="rp-report" data-page="profiles">
        <ReportState type="loading" title={`Loading ${selectedSourceLabel} customer profiles`}>
          Reading source-scoped golden-record, household, activity, and governed value artifacts.
        </ReportState>
      </div>
    );
  }

  if (reportState.error) {
    return (
      <div className="rp-report" data-page="profiles">
        <ReportState type="error" title="Unable to load customer profile reporting" onRetry={retry}>
          {reportState.error}
        </ReportState>
      </div>
    );
  }

  if (!reportState.data?.data_available) {
    return (
      <div className="rp-report" data-page="profiles">
        <ReportState type="empty" title="Customer profile reporting is unavailable" onRetry={retry}>
          No source-scoped golden-record reporting artifacts are available for {selectedSourceLabel}.
        </ReportState>
        <ContractStrip status="Unavailable">
          {reportState.data?.compatibility_mode
            ? "The existing summary did not provide a source-identified golden-profile artifact. Cross-source fallback is blocked, so profile measures remain unavailable."
            : "The reporting endpoint was source validated. Missing artifacts are shown as unavailable and are not replaced with enrichment or estimated profile metrics."}
        </ContractStrip>
      </div>
    );
  }

  const { summary } = report;
  const explainReport = isObject(reportState.data.explain_report)
    ? reportState.data.explain_report
    : {};
  const activityRule = report.activityRule;
  const profileMetricDetail = ({
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
    provenance: profileProvenance(
      reportState.data,
      selectedSourceLabel,
      scope,
      grain,
    ),
    businessInsight,
    callout,
  });
  const activityTotal = sumRows(report.activity);
  const governedValue = report.hasLtvEvidence
    ? firstMetric(summary.total_ltv)
    : null;
  const governedValueLabel = "Total Customer Lifetime Value";
  const hasActivityReport = (
    activityTotal > 0
    && hasMeasuredRows(report.activity)
    && report.activityStatusContractValid
  );
  const hasValueDistributionReport = (
    report.valueDistributionContract.valid
    && hasMeasuredRows(report.valueDistribution?.bands)
    && hasMeasuredRows(report.valueTiers)
  );
  const hasCoverageReport = hasMeasuredRows(report.sourceContribution);
  const hasEngagementReport = (
    report.engagementContract.valid
    && hasMeasuredRows(report.engagementDistribution)
  );
  const hasCustomerEventReport = (
    report.customerEventContract.valid
    && hasMeasuredRows(report.eventsByType)
  );
  const hasBreadthReport = report.breadthTotal > 0 && hasMeasuredRows(report.breadth);
  const hasDepthReport = hasMeasuredRows(report.depth);
  const hasHouseholdReport = (
    report.householdContract.valid
    && hasMeasuredRows(report.householdComposition)
  );
  const requiredReportingGaps = [
    !hasActivityReport
      ? (
        "Active Profiles and Inactive Profiles are omitted because the selected "
        + "source does not publish a complete, reconciling explicit profile-status contract."
      )
      : "",
    !(report.hasLtvEvidence && hasMetric(governedValue))
      ? "Total LTV is omitted because no governed profile-level lifetime-value measure is available."
      : "",
    !hasValueDistributionReport
      ? "Customer Lifetime Value Tiers is omitted because no governed, reconciling profile-value tier distribution is available."
      : "",
    !hasEngagementReport
      ? "Average Engagement Rate and Engagement Distribution are omitted because no governed profile-level engagement formula and reconciling distribution are available."
      : "",
    !hasCustomerEventReport
      ? "Total Customer Events is omitted because no reconciled, explicitly typed customer-event rows are available."
      : "",
  ].filter(Boolean);
  const profileReportCatalogue = [
    hasActivityReport
      ? {
        key: "activity",
        name: PROFILE_REPORT_NAMES.activity,
        description: (
          "Shows the share and count of customers explicitly classified Active or "
          + "Inactive by the source system's complete profile-status contract."
        ),
      }
      : null,
    hasValueDistributionReport
      ? {
        key: "value",
        name: report.valuePanelTitle,
        description: report.isHistoricalRealizedLtv
          ? (
            "Groups measured profiles into four clear, fixed reporting tiers using their actual realized lifetime value."
          )
          : report.hasLtvEvidence
          ? (
            "Groups measured profiles into Low, Medium, High and Very High / HNI reporting tiers."
          )
          : (
            `Shows the observed distribution of the governed ${report.valueLabel} measure `
            + "without assigning artificial customer tiers."
          ),
      }
      : null,
    hasCoverageReport
      ? {
        key: "coverage",
        name: PROFILE_REPORT_NAMES.coverage,
        description: (
          "Shows how many customer profiles receive governed records from each contributing "
          + "source system, revealing source dependence and opportunities to broaden customer context."
        ),
      }
      : null,
    hasEngagementReport
      ? {
        key: "engagement",
        name: PROFILE_REPORT_NAMES.engagement,
        description: (
          "Shows the source-governed profile engagement bands and the population "
          + "represented by each band."
        ),
      }
      : null,
    hasBreadthReport
      ? {
        key: "breadth",
        name: PROFILE_REPORT_NAMES.breadth,
        description: (
          "Shows how many governed data sources contribute to each customer profile, revealing "
          + "which profiles have broad context and which rely on a single source."
        ),
      }
      : null,
    hasBreadthReport
      ? {
        key: "breadthSummary",
        name: PROFILE_REPORT_NAMES.breadthSummary,
        description: (
          "Summarizes the most common source-count band and the smaller groups around it, helping "
          + "teams target profile-enrichment work without losing sight of the long tail."
        ),
      }
      : null,
    hasDepthReport
      ? {
        key: "depth",
        name: PROFILE_REPORT_NAMES.depth,
        description: (
          "Shows how many source records were combined into each customer profile, helping teams "
          + "spot fragmented profiles and unusually deep profiles that may need identity review."
        ),
      }
      : null,
    hasHouseholdReport
      ? {
        key: "household",
        name: PROFILE_REPORT_NAMES.household,
        description: (
          "Compares one-person and multi-person households in the retained household artifact "
          + "to support frequency planning while keeping individual consent decisions separate."
        ),
      }
      : null,
  ].filter(Boolean);
  const orderedVisibleReportKeys = [...primaryReportKeys, ...selectedReports];
  const visibleProfileReportCatalogue = orderedVisibleReportKeys
    .map(key => profileReportCatalogue.find(reportEntry => reportEntry.key === key))
    .filter(Boolean);
  const optionalReportCatalog = profileReportCatalogue
    .filter(reportEntry => optionalReportKeys.includes(reportEntry.key))
    .map(reportEntry => ({
      key: reportEntry.key,
      label: reportEntry.name,
    }));

  const kpis = [
    {
      label: "Total Customer Profiles",
      value: countOrUnavailable(summary.total_profiles),
      detail: (
        `${formatCount(summary.multi_profiles)} multi-record \u00b7 `
        + `${formatCount(summary.singleton_profiles)} single-record`
      ),
      color: REPORT_COLORS.cyan,
      evidence: "View calculation",
      onClick: () => setPanelExplanation(profileMetricDetail({
        title: "Total customer profiles",
        meaning: `${countOrUnavailable(summary.total_profiles)} source-scoped customer profiles are represented by the same resolved identity universe used by Identity Graph reporting.`,
        formula: (
          "Total customer profiles = Identity Graph unique customer profiles created "
          + "= multi-record profiles + single-record profiles\n"
          + `${formatCount(summary.identity_cluster_total)} = `
          + `${formatCount(summary.multi_profiles)} + ${formatCount(summary.singleton_profiles)} `
          + `= ${countOrUnavailable(summary.total_profiles)}`
        ),
        scope: `${countOrUnavailable(summary.total_profiles)} customer profiles`,
        grain: "One current resolved identity cluster represented as a customer profile",
        businessInsight: "Use total profiles as the addressable identity base for audience sizing, activation planning, and monitoring profile growth between comparable snapshots.",
        callout: "This KPI is displayed only after it reconciles to the Identity Graph total and to multi-record plus single-record profile composition.",
      })),
    },
    hasActivityReport && hasMetric(summary.active_profiles)
      ? {
      label: "Active Profiles",
      value: countOrUnavailable(summary.active_profiles),
      detail: "Explicit source status \u00b7 100% classified",
      color: REPORT_COLORS.green,
      evidence: "View profiles",
      onClick: () => setActivityDrilldown({
        status: "active",
        expectedTotal: Number(summary.active_profiles),
        activityRule,
        statusSources: report.activityStatusSources,
      }),
    }
      : null,
    hasActivityReport && hasMetric(summary.inactive_profiles)
      ? {
      label: "Inactive Profiles",
      value: countOrUnavailable(summary.inactive_profiles),
      detail: "Explicit source status \u00b7 100% classified",
      color: REPORT_COLORS.amber,
      evidence: "View profiles",
      onClick: () => setActivityDrilldown({
        status: "inactive",
        expectedTotal: Number(summary.inactive_profiles),
        activityRule,
        statusSources: report.activityStatusSources,
      }),
    }
      : null,
    report.hasLtvEvidence && hasMetric(governedValue)
      ? {
      label: governedValueLabel,
      value: currencyOrUnavailable(governedValue),
      detail: hasMetric(summary.average_ltv)
        ? `Average ${formatCurrency(summary.average_ltv, true)}`
        : hasMetric(summary.value_coverage)
          ? `${formatCount(summary.value_coverage)} profiles represented`
          : "Governed profile-level LTV",
      color: REPORT_COLORS.green,
      evidence: "View evidence",
      onClick: () => setPanelExplanation(profileMetricDetail({
        title: governedValueLabel,
        meaning: report.isHistoricalRealizedLtv
          ? `${currencyOrUnavailable(governedValue, false)} is the cumulative realized lifetime value from qualifying transactions linked to current customer profiles.`
          : `${currencyOrUnavailable(governedValue, false)} of governed customer lifetime value is represented by the current source-scoped profile artifact.`,
        formula: report.isHistoricalRealizedLtv
          ? `${summary.ltv_formula || "Historical realized LTV = sum of qualifying linked monetary transactions."}\nPortfolio total = sum of profile-level historical LTV = ${currencyOrUnavailable(governedValue, false)}${hasMetric(summary.average_ltv) ? `\nAverage among covered profiles = ${currencyOrUnavailable(summary.average_ltv, false)}` : ""}`
          : `Total LTV = sum of governed profile-level LTV\nReported total = ${currencyOrUnavailable(governedValue, false)}${hasMetric(summary.average_ltv) ? `\nAverage LTV = ${currencyOrUnavailable(summary.average_ltv, false)}` : ""}`,
        scope: hasMetric(summary.value_coverage)
          ? `${formatCount(summary.value_coverage)} profiles with governed value evidence`
          : `${countOrUnavailable(summary.total_profiles)} customer profiles`,
        grain: "One customer profile with a governed LTV measure",
        businessInsight: report.isHistoricalRealizedLtv
          ? "Use historical LTV to prioritize customers with demonstrated value and to compare realized value concentration; combine it with current engagement and consent before activation."
          : "Use governed LTV to prioritize retention, service, and acquisition investment across comparable profile populations.",
        callout: report.isHistoricalRealizedLtv
          ? "Historical LTV is realized past value, not predicted future value, margin, profitability, or a guarantee of future purchases."
          : (explainReport.ltv_note || "This KPI is shown only when the reporting contract supplies a governed profile-level LTV field."),
      })),
    }
      : null,
    report.hasLtvEvidence && hasMetric(summary.average_ltv)
      ? {
      label: "Average Customer Lifetime Value",
      value: currencyOrUnavailable(summary.average_ltv),
      detail: `Portfolio-wide avg · ${countOrUnavailable(summary.value_coverage)} with LTV`,
      color: REPORT_COLORS.blue,
      evidence: "View evidence",
      onClick: () => setPanelExplanation(profileMetricDetail({
        title: "Average Customer Lifetime Value",
        meaning: `${currencyOrUnavailable(summary.average_ltv, false)} is the portfolio-wide per-profile average: total governed LTV spread across all ${countOrUnavailable(summary.total_profiles)} customer profiles (including those with no billing history).`,
        formula: (
          `Average LTV = total governed LTV / total profiles\n`
          + `${currencyOrUnavailable(governedValue, false)} / ${countOrUnavailable(summary.total_profiles)} = ${currencyOrUnavailable(summary.average_ltv, false)}`
        ),
        scope: `All ${countOrUnavailable(summary.total_profiles)} customer profiles`,
        grain: "One customer profile (zero-LTV profiles included in denominator)",
        businessInsight: "Use the average to compare customer-value levels across equivalent source populations and reporting windows.",
        callout: `${countOrUnavailable(summary.value_coverage)} profiles have direct LTV evidence; the remainder contribute $0 to the total and pull this average below the per-subscriber average.`,
      })),
    }
      : null,
    hasEngagementReport && hasMetric(summary.average_engagement)
      ? {
      label: "Average Engagement Rate",
      value: percentOrUnavailable(summary.average_engagement),
      detail: hasMetric(report.engagementContract.expected)
        ? `Historical snapshot \u00b7 ${formatCount(report.engagementContract.expected)} measured`
        : "Governed profile-level engagement",
      color: REPORT_COLORS.violet,
      evidence: "View evidence",
      onClick: () => setPanelExplanation(profileMetricDetail({
        title: "Average engagement rate",
        meaning: `${percentOrUnavailable(summary.average_engagement)} of measured profiles produced at least one supported response in the labelled historical outreach window.`,
        formula: summary.engagement_formula,
        scope: hasMetric(report.engagementContract.expected)
          ? `${countOrUnavailable(report.engagementContract.expected)} profiles with governed engagement evidence`
          : `${countOrUnavailable(summary.total_profiles)} customer profiles`,
        grain: "One customer profile with a governed engagement rate",
        businessInsight: "Use the average as a directional portfolio indicator, then inspect the distribution before selecting engagement tactics.",
        callout: "This is a historical, source-scoped response rate. Profiles without qualifying outreach evidence are unmeasured rather than treated as disengaged.",
      })),
    }
      : null,
    hasCustomerEventReport
      ? {
      label: "Total Customer Events",
      value: countOrUnavailable(report.totalCustomerEvents),
      detail: summary.customer_event_scope
        || "Typed event rows linked to current profiles",
      color: REPORT_COLORS.blue,
      evidence: "View evidence",
      onClick: () => setPanelExplanation(profileMetricDetail({
        title: "Total customer events",
        meaning: `${countOrUnavailable(report.totalCustomerEvents)} resolved source rows contain a governed event type and link to a current customer profile.`,
        formula: (
          "Total customer events = sum of mutually exclusive, governed event rows\n"
          + report.eventsByType.map(row => (
            `${row.label}: ${countOrUnavailable(row.value)}`
          )).join("\n")
          + `\nTotal = ${countOrUnavailable(report.totalCustomerEvents)}`
        ),
        scope: `${countOrUnavailable(summary.total_profiles)} current customer profiles`,
        grain: summary.customer_event_grain
          || "One resolved source row with a nonblank governed event type",
        businessInsight: "Use event volume and mix to understand which typed behaviors are available for profile analysis and activation planning.",
        callout: explainReport.events || "This is typed source-row volume, not unique customers, sessions, or messages. Rows without an explicit event type are not counted.",
      })),
    }
      : null,
  ].filter(kpi => (
    kpi
    && kpi.value !== NOT_AVAILABLE
    && String(kpi.value || "").trim()
  ));
  const kpiColumnCount = Math.max(kpis.length, 1);
  const lowestSourceContribution = report.sourceContribution.reduce((lowest, row) => {
    if (!hasMetric(row.value)) return lowest;
    if (!lowest || Number(row.value) < Number(lowest.value)) return row;
    return lowest;
  }, null);
  const profileReportExplanation = [
    (
      `This report shows whether ${selectedSourceLabel}'s `
      + `${formatCount(summary.total_profiles)} source-scoped customer profiles are represented for `
      + `audience targeting, personalization, and customer service.`
    ),
    (
      report.unifiedContract.valid
      && hasMetric(summary.multi_profiles)
      && hasMetric(summary.singleton_profiles)
        ? (
          `${formatCount(summary.multi_profiles)} profiles combine more than one source record, `
          + `while ${formatCount(summary.singleton_profiles)} remain single-record profiles.`
        )
        : ""
    ),
    hasActivityReport
      ? (
        `${formatCount(summary.active_profiles)} of ${formatCount(activityTotal)} classified `
        + "profiles have an explicit Active status under the complete source-status contract."
      )
      : "",
    hasMetric(governedValue)
      ? (
        `${currencyOrUnavailable(governedValue, false)} of governed ${report.valueLabel} `
        + `is available for value-based analysis.`
      )
      : "",
  ].filter(Boolean).join(" ");
  const profileBusinessInsight = [
    (
      report.unifiedContract.valid
      && hasMetric(summary.singleton_profiles)
      && hasMetric(report.unifiedProfileRate)
        ? (
          `Identity action: ${formatPercent(report.unifiedProfileRate)} of profiles combine `
          + `multiple records. Prioritize identifier enrichment for `
          + `${formatCount(summary.singleton_profiles)} single-record profiles.`
        )
        : ""
    ),
    hasActivityReport
      ? (
        `Profile-status action: ${formatCount(summary.active_profiles)} profiles are `
        + "explicitly Active. Use the source-status definition when planning activation or re-engagement."
      )
      : "",
    lowestSourceContribution
      ? (
        `Source action: ${lowestSourceContribution.label} currently contributes to `
        + `${formatPercent(lowestSourceContribution.value)} of profiles. Confirm whether that `
        + "coverage matches the intended customer-data strategy before relying on the source."
      )
      : "",
  ].filter(Boolean).join(" ");
  const profileReportExplanationContent = (
    <>
      <p>{profileReportExplanation}</p>
      {visibleProfileReportCatalogue.length > 0 && (
        <>
          <h4>Reports in this view</h4>
          <ul>
            {visibleProfileReportCatalogue.map(catalogueReport => (
              <li key={catalogueReport.name}>
                <strong>{catalogueReport.name}:</strong> {catalogueReport.description}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
  return (
    <div className="rp-report" data-page="profiles">
      <ReportHero
        eyebrow={`${selectedSourceLabel} \u00b7 customer profile reporting`}
        score={countOrUnavailable(summary.total_profiles)}
        scoreLabel="Customer profiles"
        color={REPORT_COLORS.cyan}
        title={PROFILE_REPORT_NAMES.hero}
        summary={report.heroSummary}
        tags={[
          selectedSourceLabel,
          reportState.data?.compatibility_mode ? "Core API compatibility mode" : "",
          hasActivityReport ? "Explicit source status" : "",
          report.hasLtvEvidence
            ? labelOrFallback(summary.ltv_label, "Governed LTV")
            : "",
        ]}
        explanation={profileReportExplanationContent}
        evidence={{
          formula: [
            hasMetric(summary.multi_profiles) && hasMetric(summary.singleton_profiles)
              ? (
                `Total profiles = multi-record profiles + single-record profiles\n`
                + `${formatCount(summary.multi_profiles)} + ${formatCount(summary.singleton_profiles)} = ${formatCount(summary.total_profiles)}`
              )
              : `Total profiles = ${formatCount(summary.total_profiles)}`,
            report.unifiedContract.valid && hasMetric(report.unifiedProfileRate)
              ? (
                `Multi-record profile share = multi-record profiles / total profiles\n`
                + `${formatCount(summary.multi_profiles)} / ${formatCount(summary.total_profiles)} = ${formatPercent(report.unifiedProfileRate)}`
              )
              : "",
            hasActivityReport && activityTotal > 0 && hasMetric(report.activeProfilePct)
              ? (
                `Active rate = active profiles / classified profiles\n`
                + `${formatCount(summary.active_profiles)} / ${formatCount(activityTotal)} = ${formatPercent(report.activeProfilePct)}`
              )
              : "",
          ].filter(Boolean).join("\n\n"),
          provenance: profileProvenance(
            reportState.data,
            selectedSourceLabel,
            `${countOrUnavailable(summary.total_profiles)} source-scoped customer profiles`,
            "Golden-profile summary plus household, source contribution, breadth, depth, activity, and governed-LTV artifacts",
          ),
          businessInsight: profileBusinessInsight,
          callout: (
            explainReport.ltv_note
            || "Profile status is shown only from a complete explicit source-status contract. Only a governed lifetime-value field is labelled LTV."
          ),
        }}
      />

      <div className="cp-kpi-strip" aria-label="Customer profile key performance indicators">
        <KpiGrid columns={kpiColumnCount}>
          {kpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
        </KpiGrid>
      </div>

      <ProfileReportLayout
        primaryKeys={primaryReportKeys}
        selectedKeys={selectedReports}
        selector={optionalReportCatalog.length > 0 ? (
          <AddReportSelector
            reports={optionalReportCatalog}
            selected={selectedReports}
            onAdd={key => setSelectedReports(current => (
              current.includes(key) ? current : [...current, key]
            ))}
            onRemove={key => setSelectedReports(current => (
              current.filter(reportKey => reportKey !== key)
            ))}
            title="Add another customer profile report"
            description="The requested source-backed profile reports stay visible. Add another report when you need a deeper, data-backed view."
          />
        ) : null}
      >
        {hasActivityReport && (
        <Panel
          data-report-key="activity"
          title={PROFILE_REPORT_NAMES.activity}
          subtitle="Explicit Active and Inactive profile status supplied by the source system"
          action={(
            <ProfilePanelAction
              label="Explain status"
              badge="100% classified"
              onClick={() => setPanelExplanation({
                title: PROFILE_REPORT_NAMES.activity,
                meaning: "This visual separates profiles explicitly classified Active or Inactive by the source system. It does not infer status from recency or last engagement time.",
                formula: (
                  `${activityRule}\nActive rate = active profiles / (active profiles + inactive profiles)\n`
                  + `${countOrUnavailable(summary.active_profiles)} / (${countOrUnavailable(summary.active_profiles)} + ${countOrUnavailable(summary.inactive_profiles)}) = ${percentOrUnavailable(report.activeProfilePct)}`
                ),
                provenance: profileProvenance(
                  reportState.data,
                  selectedSourceLabel,
                  `${formatCount(activityTotal || report.totalProfiles)} profiles · ${report.activityStatusSources}`,
                  "One customer profile with one explicit source status",
                ),
                businessInsight: "Use the explicit status split to size active-customer programs and inactive-customer re-engagement opportunities.",
                callout: "The chart appears only when the source-status contract classifies 100% of the current customer-profile universe with no unclassified profiles.",
              })}
            />
          )}
        >
          <ActivityStatus
            rows={report.activity}
            totalProfiles={report.totalProfiles}
            statusRule={activityRule}
            statusSources={report.activityStatusSources}
          />
        </Panel>
        )}

        {hasValueDistributionReport && (
        <Panel
          data-report-key="value"
          title={report.valuePanelTitle}
          subtitle={report.valuePanelSubtitle}
          action={(
            <ProfilePanelAction
              label="Explain LTV tiers"
              badge={report.valueDistributionContract.valid && report.valueDistributionContract.coverageKnown
                ? `${formatPercent(safePercent(
                  report.valueDistributionContract.expectedProfiles,
                  report.totalProfiles,
                ))} measured coverage`
                : report.hasLtvEvidence
                  ? "Governed LTV"
                  : report.valueLabel}
              onClick={() => setPanelExplanation({
                title: report.valuePanelTitle,
                meaning: report.valueTiers?.length
                  ? "This visual groups every measured customer profile into one of four fixed lifetime-value tiers and shows the exact count and percentage in each tier."
                  : "No governed profile-value tier distribution is available for the selected source, so the chart remains unavailable.",
                formula: report.valueTiers?.length
                  ? [
                    report.isHistoricalRealizedLtv && summary.ltv_formula
                      ? summary.ltv_formula
                      : "",
                    summary.value_tier_method || "",
                    "Tier share = profiles in the tier / measured profiles.",
                    `Current reconciliation = ${countOrUnavailable(report.valueDistributionContract.expectedProfiles)} measured profiles and ${formatCurrency(report.valueDistributionContract.expectedValue, true)} represented value.`,
                  ].filter(Boolean).join("\n")
                  : "LTV tiers require a governed profile-level LTV measure and a documented source-specific threshold configuration.",
                provenance: profileProvenance(
                  reportState.data,
                  selectedSourceLabel,
                  report.valueDistributionContract.coverageKnown
                    ? `${countOrUnavailable(report.valueDistributionContract.expectedProfiles)} profiles with governed value`
                    : "Profile-level governed value coverage unavailable",
                  "One measured customer profile assigned to one mutually exclusive LTV tier",
                ),
                businessInsight: report.isHistoricalRealizedLtv
                  ? "Use the distribution to understand where demonstrated customer value is concentrated, while checking recent engagement and consent before activation."
                  : report.hasLtvEvidence
                    ? "Use the distribution to understand value concentration while validating eligibility and consent before activation."
                  : "Treat the missing value distribution as a data-contract gap before making value-based audience or service decisions.",
                callout: report.valueDistributionContract.valid
                  ? report.isHistoricalRealizedLtv
                    ? "Historical LTV is cumulative realized value. It does not predict future purchases, profitability, or incremental lift."
                    : "Tier membership describes the supplied LTV measure; it does not prove propensity, incremental lift, profitability, or future customer value."
                  : "The chart is withheld when tier counts or represented value do not reconcile.",
              })}
            />
          )}
        >
          <CustomerValueTierReport
            rows={report.valueTiers}
            summary={summary}
            label={report.valueLabel}
            contract={report.valueDistributionContract}
          />
        </Panel>
        )}
        {hasCoverageReport && (
        <Panel
          data-report-key="coverage"
          title={PROFILE_REPORT_NAMES.coverage}
          subtitle="Share of customer profiles whose lineage includes each governed source system"
          action={(
            <ProfilePanelAction
              label="View formula"
              badge={report.topSourceContribution?.label}
              onClick={() => setPanelExplanation({
                title: PROFILE_REPORT_NAMES.coverage,
                meaning: "This visual shows the number and share of customer profiles whose governed lineage contains each contributing source system.",
                formula: report.sourceContribution.length
                  ? report.sourceContribution.map(row => (
                    `${row.label} contribution = ${countOrUnavailable(row.count)} / ${countOrUnavailable(summary.total_profiles)} profiles = ${percentOrUnavailable(row.value)}`
                  )).join("\n")
                  : "Source contribution requires profile lineage and the source-scoped total-profile denominator.",
                provenance: profileProvenance(
                  reportState.data,
                  selectedSourceLabel,
                  `${countOrUnavailable(summary.total_profiles)} customer profiles`,
                  "One customer profile checked for each governed source represented in its lineage",
                ),
                businessInsight: "Use contribution patterns to identify source dependency, protect important pipelines, and decide where broader customer context is needed.",
                callout: "Source percentages can overlap because one customer profile can contain records from multiple systems. Contribution does not prove freshness, quality, consent, or accuracy.",
              })}
            />
          )}
        >
          <SourceContributionBars rows={report.sourceContribution} />
        </Panel>
        )}

        {hasEngagementReport && (
        <Panel
          data-report-key="engagement"
          title={PROFILE_REPORT_NAMES.engagement}
          subtitle={`Historical profile response distribution \u00b7 ${summary.engagement_window} \u00b7 ${percentOrUnavailable(summary.average_engagement)} engaged`}
          action={(
            <ProfilePanelAction
              label="View formula"
              badge={hasMetric(report.engagementContract.expected)
                ? `${formatCount(report.engagementContract.expected)} measured`
                : "Governed engagement"}
              onClick={() => setPanelExplanation({
                title: PROFILE_REPORT_NAMES.engagement,
                meaning: "This visual assigns each measured profile to its deepest supported outreach-response stage in the labelled historical evidence window.",
                formula: [
                  summary.engagement_formula,
                  ...report.engagementDistribution.map(row => (
                    `${row.label} = ${countOrUnavailable(row.value)} profiles`
                  )),
                  hasMetric(report.engagementContract.expected)
                    ? `Distribution reconciliation = ${countOrUnavailable(report.engagementContract.classified)} classified profiles = ${countOrUnavailable(report.engagementContract.expected)} declared coverage`
                    : "",
                ].filter(Boolean).join("\n"),
                provenance: profileProvenance(
                  reportState.data,
                  selectedSourceLabel,
                  hasMetric(report.engagementContract.expected)
                    ? `${countOrUnavailable(report.engagementContract.expected)} profiles with governed engagement evidence`
                    : "Governed engagement population",
                  "One customer profile assigned to one governed engagement band",
                ),
                businessInsight: "Use the distribution to see whether outreach is reaching beyond delivery into opens, clicks, or conversions, then compare only like-for-like source windows.",
                callout: "The chart is displayed only when the source-backed formula, measured population, and mutually exclusive response stages reconcile exactly.",
              })}
            />
          )}
        >
          <EngagementLineChart rows={report.engagementDistribution} />
        </Panel>
        )}

        {hasBreadthReport && (
        <div className="cp-report-slot" data-report-key="breadth">
        <Panel
          title={PROFILE_REPORT_NAMES.breadth}
          subtitle="An animated true-scale curve showing how many governed feeds contribute to each customer profile"
          action={(
            <ProfilePanelAction
              label="Explain breadth"
              badge={`${formatCount(report.breadthTotal)} classified`}
              onClick={() => setPanelExplanation({
                title: PROFILE_REPORT_NAMES.breadth,
                meaning: "Source breadth shows how many distinct governed feeds contribute evidence to each customer profile.",
                formula: report.breadth.length
                  ? report.breadth.map(row => (
                    `${row.label} share = ${countOrUnavailable(row.value)} / ${countOrUnavailable(report.breadthTotal)} classified profiles = ${percentOrUnavailable(safePercent(row.value, report.breadthTotal))}`
                  )).join("\n")
                  : "Breadth requires a distinct feed count for every classified customer profile.",
                provenance: profileProvenance(
                  reportState.data,
                  selectedSourceLabel,
                  `${countOrUnavailable(report.breadthTotal)} breadth-classified profiles`,
                  "One customer profile grouped by its count of distinct contributing governed feeds",
                ),
                businessInsight: "Use low-breadth bands to identify profiles that depend on one feed and may need enrichment before cross-channel personalization or activation.",
                callout: "More contributing feeds can increase context, but feed count alone does not establish freshness, quality, consent, or correctness.",
              })}
            />
          )}
        >
          <BreadthCurve rows={report.breadth} totalProfiles={report.totalProfiles} />
        </Panel>
        </div>
        )}

        {hasBreadthReport && (
        <div className="cp-report-slot" data-report-key="breadthSummary">
        <Panel
          title={PROFILE_REPORT_NAMES.breadthSummary}
          subtitle={report.dominantBreadth
            ? `${report.dominantBreadth.label} leads; the remaining bands are magnified as the long tail.`
            : "Dominant source breadth and long-tail composition"}
          action={(
            <ProfilePanelAction
              label="Explain long tail"
              badge={`${formatPercent(report.dominantBreadthShare)} dominant`}
              onClick={() => setPanelExplanation({
                title: PROFILE_REPORT_NAMES.breadthSummary,
                meaning: report.dominantBreadth
                  ? `${report.dominantBreadth.label} is the largest source-breadth population; the visual magnifies the smaller bands so their exact composition remains visible.`
                  : "No source-breadth distribution is available for the selected source.",
                formula: report.dominantBreadth
                  ? `Dominant share = largest breadth-band profile count / selected profile denominator\n${countOrUnavailable(report.dominantBreadth.value)} / ${countOrUnavailable(report.totalProfiles || report.breadthTotal)} = ${percentOrUnavailable(report.dominantBreadthShare)}\nLong-tail bands retain their exact counts and shares even though their visual scale is magnified.`
                  : "Dominant breadth requires at least one measured source-breadth band.",
                provenance: profileProvenance(
                  reportState.data,
                  selectedSourceLabel,
                  `${countOrUnavailable(report.breadthTotal)} breadth-classified profiles`,
                  "One breadth band aggregated from resolved-profile contributing-feed counts",
                ),
                businessInsight: "Use the dominant band to understand profile dependency and the long tail to target enrichment where smaller but strategically important populations lack source diversity.",
                callout: "The long-tail magnifier intentionally changes visual scale; use the printed counts and percentages for comparison.",
              })}
            />
          )}
        >
          <BreadthMagnifier rows={report.breadth} totalProfiles={report.totalProfiles} />
        </Panel>
        </div>
        )}

        {hasDepthReport && (
        <div className="cp-report-slot" data-report-key="depth">
        <Panel
          title={PROFILE_REPORT_NAMES.depth}
          subtitle="How many source records contribute to each customer profile"
          action={(
            <ProfilePanelAction
              label="Explain depth"
              badge={hasMetric(summary.largest_profile)
                ? `Largest profile · ${formatCount(summary.largest_profile)} records`
                : undefined}
              onClick={() => {
                const classifiedDepth = sumRows(report.depth);
                setPanelExplanation({
                  title: PROFILE_REPORT_NAMES.depth,
                  meaning: "Profile depth counts how many source records were consolidated into each customer profile and groups profiles into the displayed record-count bands.",
                  formula: report.depth.length
                    ? report.depth.map(row => (
                      `${row.label} share = ${countOrUnavailable(row.value)} / ${countOrUnavailable(classifiedDepth)} classified profiles = ${percentOrUnavailable(safePercent(row.value, classifiedDepth))}`
                    )).join("\n")
                    : "Depth requires a contributing source-record count for each customer profile.",
                  provenance: profileProvenance(
                    reportState.data,
                    selectedSourceLabel,
                    `${countOrUnavailable(classifiedDepth)} depth-classified profiles`,
                    "One customer profile grouped by its number of contributing source records",
                  ),
                  businessInsight: "Use deeper bands to inspect highly consolidated identities and shallow bands to identify fragmentation or enrichment opportunities before audience activation.",
                  callout: "High depth can reflect useful consolidation or an over-merge risk. Record count does not reveal source diversity, match confidence, or correctness by itself.",
                });
              }}
            />
          )}
        >
          <DepthHistogram rows={report.depth} totalProfiles={report.totalProfiles} />
        </Panel>
        </div>
        )}

        {hasHouseholdReport && (
        <div className="cp-report-slot" data-report-key="household">
        <Panel
          title={PROFILE_REPORT_NAMES.household}
          subtitle="Retained household artifact split by one-member versus multi-member composition"
          action={(
            <ProfilePanelAction
              label="Explain households"
              badge={hasMetric(summary.largest_household)
                ? `${formatCount(summary.largest_household)} largest`
                : undefined}
              onClick={() => setPanelExplanation({
                title: PROFILE_REPORT_NAMES.household,
                meaning: "Households are classified as one-member or multi-member only within the retained household artifact and only when its size distribution reconciles to its own summary.",
                formula: (
                  `Multi-member households = sum of household-size bands of two or more\n`
                  + `Reported multi-member households = ${countOrUnavailable(report.householdContract.derivedMulti)}\n\n`
                  + `One-member households = total households - multi-member households\n`
                  + `${countOrUnavailable(report.householdContract.resolvedTotal)} - ${countOrUnavailable(report.householdContract.derivedMulti)} = ${countOrUnavailable(report.householdComposition[0]?.value)}`
                ),
                provenance: profileProvenance(
                  reportState.data,
                  selectedSourceLabel,
                  `${countOrUnavailable(report.householdContract.resolvedTotal)} household entities`,
                  "One household-size band reconciled within the retained source-scoped household artifact",
                ),
                businessInsight: "Use household composition for household-level reach and frequency planning, while keeping profile-level consent and eligibility decisions separate.",
                callout: report.householdContract.valid
                  ? "Household coverage is limited to the retained household artifact and does not represent every profile in the resolved identity universe. Membership does not imply relationship type, confidence, consent sharing, or financial dependency."
                  : "The chart is withheld because the household-size distribution does not reconcile to the summary.",
              })}
            />
          )}
        >
          <Donut
            rows={report.householdComposition}
            center={formatCount(report.householdContract.resolvedTotal)}
            centerLabel="households"
            percentageFirst
            legendUnit="households"
          />
        </Panel>
        </div>
        )}
      </ProfileReportLayout>

      <ContractStrip status="Source validated">
        {(reportState.data?.compatibility_mode
          ? `Core profile and source-contribution facts come from the existing source-scoped summary API for ${selectedSourceLabel}.`
          : `Every visible metric comes from the source-scoped customer-profile reporting contract for ${selectedSourceLabel}; lifetime value is shown only when the API supplies a governed LTV measure.`)
          + (requiredReportingGaps.length ? ` ${requiredReportingGaps.join(" ")}` : "")}
      </ContractStrip>
      <ActivityProfileDrilldown
        request={activityDrilldown}
        source={sourceSystem}
        onClose={() => setActivityDrilldown(null)}
      />
      <EvidenceDrawer
        detail={panelExplanation}
        kicker={`${selectedSourceLabel} profile metric evidence`}
        onClose={() => setPanelExplanation(null)}
      />
    </div>
  );
}
