import { useState, useEffect, useCallback, useRef } from "react";
import "./CustomerProfileView.css";

/** Resolve API paths through the current app origin in development and Databricks Apps. */
function resolveApi(path) {
  return path.startsWith("/") ? path : `/${path}`;
}

const TIER_COLORS = {
  High:     { bg: "rgba(16,185,129,0.15)",  text: "#10b981" },
  Medium:   { bg: "rgba(245,158,11,0.15)",  text: "#f59e0b" },
  Low:      { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
  Active:   { bg: "rgba(16,185,129,0.15)",  text: "#10b981" },
  Lapsing:  { bg: "rgba(245,158,11,0.15)",  text: "#f59e0b" },
  Inactive: { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
};

const S = {
  bgPrimary:    "var(--bg-primary)",
  bgSecondary:  "var(--bg-secondary)",
  bgCard:       "var(--bg-card)",
  bgHover:      "var(--bg-card-hover)",
  border:       "var(--border)",
  borderLight:  "var(--border-light)",
  textPrimary:  "var(--text-primary)",
  textSecondary:"var(--text-secondary)",
  textMuted:    "var(--text-muted)",
  accent:       "var(--accent)",
  accentLight:  "var(--accent-light)",
  success:      "#10b981",
  warning:      "#f59e0b",
  error:        "#ef4444",
};

const timelineDetailButtonStyle = {
  flexShrink: 0,
  padding: 0,
  background: "none",
  border: "none",
  color: S.accentLight,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "underline",
  whiteSpace: "nowrap",
};

const SOURCE_SYSTEMS = ["media", "sports", "automotive", "telecom"];
const CUSTOMER_PROFILE_PAGE_SIZE = 50;
const SOURCE_SYSTEM_LABELS = {
  media: "Media & OTT",
  sports: "Sports",
  automotive: "Automotive",
  telecom: "Telecom",
};

const AFFINITY_LABELS = {
  media: "Content Affinity",
  sports: "Fan Affinity",
  automotive: "Vehicle Affinity",
  telecom: "Service Affinity",
};

function affinityLabelFor(sourceSystem, short = false) {
  const label = AFFINITY_LABELS[sourceSystem] || "Affinity";
  return short && sourceSystem === "media" ? "Affinity" : label;
}

function readSelectedSourceSystem() {
  try {
    const saved = window.localStorage.getItem("cdp_source_system");
    return SOURCE_SYSTEMS.includes(saved) ? saved : "media";
  } catch {
    return "media";
  }
}

function formatLtvDisplay(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const isLightMode = () =>
  typeof document !== "undefined" &&
  document.documentElement?.dataset?.theme === "light";

const INTERNAL_SOURCES = [
  { id: "billing",    label: "Subscription & Billing", icon: "💳", enriches: ["LTV Score", "Subscription Tier", "Plan Value"],                 method: "Direct ingestion",  status: "connected", completeness: 25 },
  { id: "streaming",  label: "Streaming Activity",     icon: "📺", enriches: ["Engagement Rate", "Recency", "Watch Hours", "Content Affinity"], method: "Event stream",      status: "connected", completeness: 25 },
  { id: "app_events", label: "App Events",             icon: "📱", enriches: ["Session Frequency", "Device ID", "Feature Usage"],              method: "SDK / Event stream",status: "connected", completeness: 20 },
  { id: "email",      label: "Email Engagement",       icon: "📧", enriches: ["Open Rate", "Click Rate", "Email Reachability"],                method: "ESP integration",   status: "connected", completeness: 15 },
];

const EXTERNAL_SOURCES = [
  { id: "thirdparty",   label: "Third-Party Data", icon: "🌐", enriches: ["Demographics", "Psychographics", "Household Income"], method: "Data marketplace", status: "available", completeness: 8 },
  { id: "crm",          label: "CRM / Sales Data", icon: "🏢", enriches: ["Account Value", "Lifetime Spend", "Renewal Date"],   method: "CRM connector",   status: "available", completeness: 5 },
  { id: "webanalytics", label: "Web Analytics",    icon: "🖥️", enriches: ["Page Views", "Browse Behaviour", "Cookie ID"],      method: "JS tag / CDP SDK",status: "available", completeness: 2 },
];

function eventStyle(eventType, sourceFile) {
  const t = (eventType  || "").toLowerCase();
  const s = (sourceFile || "").toLowerCase();
  if (t.includes("stream") || t.includes("watch") || t.includes("live"))   return { icon: "📺", color: "#f59e0b" };
  if (t.includes("login")  || t.includes("session") || t.includes("app"))  return { icon: "📱", color: "#8b5cf6" };
  if (t.includes("email")  || t.includes("open") || t.includes("click"))   return { icon: "📧", color: "#06b6d4" };
  if (t.includes("billing")|| t.includes("payment") || t.includes("renew"))return { icon: "💳", color: "#10b981" };
  if (t.includes("support")|| t.includes("ticket"))                         return { icon: "🎫", color: "#f97316" };
  if (s.includes("billing"))  return { icon: "💳", color: "#10b981" };
  if (s.includes("stream"))   return { icon: "📺", color: "#f59e0b" };
  if (s.includes("app"))      return { icon: "📱", color: "#8b5cf6" };
  if (s.includes("email"))    return { icon: "📧", color: "#06b6d4" };
  if (s.includes("support"))  return { icon: "🎫", color: "#f97316" };
  return { icon: "📌", color: "#64748b" };
}

const FRIENDLY_SOURCE_LABELS = {
  "spt_fan_account.csv": "Fan Accounts",
  "spt_fan_accounts.csv": "Fan Accounts",
  "spt_ticket_orders.csv": "Ticket Orders",
  "spt_commerce_orders.csv": "Commerce Orders",
  "spt_loyalty_members.csv": "Loyalty Members",
  "spt_app_events.csv": "App Events",
  "spt_ott_streaming_sessions.csv": "Streaming Sessions",
  "spt_fantasy_gaming_accounts.csv": "Fantasy Gaming",
  "spt_marketing_campaign_events.csv": "Marketing Campaign Events",
  "med_subscription_billing.csv": "Subscription Billing",
  "med_streaming_activity.csv": "Streaming Activity",
  "med_app_events.csv": "App Events",
  "med_email_engagement.csv": "Email Engagement",
  "med_customer_support.csv": "Customer Support",
  "aut_customer_consents.csv": "Customer Consents",
  "tel_consent_preferences.csv": "Consent Preferences",
  "2p_fan_scores.csv": "Fan Scores",
  "2p_location_data.csv": "Location Signals",
  "3p_demographics.csv": "Demographics",
  "3p_ltv_propensity.csv": "Value and Propensity Signals",
};

function titleSourceWords(value) {
  return String(value || "")
    .replace(/\bOtt\b/g, "OTT")
    .replace(/\bLtv\b/g, "LTV")
    .replace(/\bCrm\b/g, "CRM")
    .replace(/\bNps\b/g, "NPS")
    .replace(/\bDtc\b/g, "DTC")
    .replace(/\bSms\b/g, "SMS");
}

function sourceLabel(sourceFile) {
  if (!sourceFile) return "";
  const filename = String(sourceFile).trim().split(/[\\/]/).pop().toLowerCase();
  if (FRIENDLY_SOURCE_LABELS[filename]) return FRIENDLY_SOURCE_LABELS[filename];
  return titleSourceWords(
    filename
      .replace(/\.csv$/i, "")
      .replace(/^(1p|2p|3p|ml|aut|auto|med|spt|tel)[_\s-]+/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase())
  );
}

function friendlySourceList(value) {
  const labels = String(value || "")
    .split(/[,|;]+/)
    .map(item => sourceLabel(item))
    .filter(Boolean);
  return [...new Set(labels)].join(", ");
}

function friendlyFieldLabel(value) {
  return titleSourceWords(
    String(value || "")
      .replace(/\.csv$/i, "")
      .replace(/^(1p|2p|3p|ml|aut|auto|med|spt|tel)[_\s-]+/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, character => character.toUpperCase())
  );
}

function friendlyConsentSource(value) {
  const labels = {
    billing: "Subscription Billing",
    email_engagement: "Email Engagement",
    call_center: "Customer Support",
    website_banner: "Website Consent Banner",
    mobile_app: "Mobile App",
  };
  const readable = String(value || "")
    .split(/[,|;]+/)
    .map(item => {
      const normalized = item.trim().toLowerCase();
      return labels[normalized] || sourceLabel(normalized);
    })
    .filter(Boolean);
  return [...new Set(readable)].join(", ") || "Governed Consent Source";
}

function activityLabel(value) {
  if (!value) return "";
  return String(value)
    .replace(/^(aut|auto|med|spt|tel)[_\s-]+/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatTime(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (isNaN(d)) return ts;
    const diff = Math.floor((new Date() - d) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 14)  return `${diff}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ts; }
}

function latestTimestamp(...values) {
  const timestamps = values
    .map(value => ({ value, parsed: Date.parse(value) }))
    .filter(item => item.value && Number.isFinite(item.parsed));
  if (!timestamps.length) return values.find(Boolean) || "";
  return timestamps.reduce(
    (latest, item) => item.parsed > latest.parsed ? item : latest
  ).value;
}

const TIMELINE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseTimelineTimestampParts(ts) {
  const raw = String(ts || "").trim();
  if (!raw) return { dateLabel: "", timeLabel: "" };

  let dateLabel = "";
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    const month = TIMELINE_MONTHS[parseInt(isoDate[2], 10) - 1] || isoDate[2];
    dateLabel = `${month} ${parseInt(isoDate[3], 10)}, ${isoDate[1]}`;
  }

  let timeLabel = "";
  const timeMatch = raw.match(/(?:T|\s|^)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$)/);
  if (timeMatch) {
    timeLabel = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
  }

  return { dateLabel: dateLabel || raw, timeLabel };
}

function formatTimelineTimestamp(ts) {
  const { dateLabel, timeLabel } = parseTimelineTimestampParts(ts);
  if (!dateLabel) return "";
  return timeLabel ? `${dateLabel}, ${timeLabel}` : dateLabel;
}

function formatSubscriptionShortDate(ts) {
  const { dateLabel } = parseTimelineTimestampParts(ts);
  return dateLabel || String(ts || "").trim();
}

function subscriptionStatusStyle(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") {
    return { bg: "rgba(16,185,129,0.15)", text: S.success, label: "Active" };
  }
  if (normalized === "cancelled" || normalized === "canceled") {
    return { bg: "rgba(239,68,68,0.12)", text: S.error, label: "Cancelled" };
  }
  if (normalized === "suspended" || normalized === "inactive") {
    return { bg: "rgba(245,158,11,0.15)", text: S.warning, label: status || "Inactive" };
  }
  return { bg: "rgba(100,116,139,0.15)", text: S.textMuted, label: status || "Unknown" };
}

function formatSubscriptionRange(subscription) {
  const start = formatSubscriptionShortDate(subscription?.start_date || subscription?.window_start);
  if (!start) return "";
  const status = String(subscription?.status || "").toLowerCase();
  const explicitEnd = subscription?.end_date || subscription?.window_end;
  if (status === "active" && !explicitEnd) return `${start} → now`;
  const end = formatSubscriptionShortDate(explicitEnd);
  return end ? `${start} → ${end}` : start;
}

function parseSubscriptionStartMs(subscription) {
  const raw = subscription?.start_date || subscription?.window_start || "";
  const parsed = Date.parse(String(raw).replace(/(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortSubscriptionsForDisplay(subscriptions) {
  return [...(subscriptions || [])].sort((a, b) => {
    const aActive = String(a.status || "").toLowerCase() === "active" ? 0 : 1;
    const bActive = String(b.status || "").toLowerCase() === "active" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    const dateDiff = parseSubscriptionStartMs(b) - parseSubscriptionStartMs(a);
    if (dateDiff !== 0) return dateDiff;
    return String(a.subscription_id || "").localeCompare(String(b.subscription_id || ""));
  });
}

function pickDefaultSubscriptionFilter(subscriptions) {
  const ordered = sortSubscriptionsForDisplay(subscriptions);
  if (!ordered.length) return "all";
  return ordered[0]?.subscription_id || "all";
}

function filterEventsBySubscription(events, selectedSubscriptionId) {
  if (!selectedSubscriptionId || selectedSubscriptionId === "all") return events;
  const target = String(selectedSubscriptionId).toUpperCase();
  return events.filter(
    ev => String(ev.subscription_id || "").toUpperCase() === target
  );
}

function SubscriptionFilterTabs({ subscriptions, events, selectedId, onSelect }) {
  const orderedSubscriptions = sortSubscriptionsForDisplay(subscriptions);
  if (!orderedSubscriptions.length) return null;

  const totalCount = events.length;
  const tabStyle = (active) => ({
    flexShrink: 0,
    minWidth: 148,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${active ? S.accent : S.border}`,
    background: active ? "rgba(0,102,204,0.08)" : S.bgSecondary,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  });

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {orderedSubscriptions.map(sub => {
          const subId = sub.subscription_id;
          const active = selectedId === subId;
          const statusStyle = subscriptionStatusStyle(sub.status);
          return (
            <button
              key={subId}
              type="button"
              onClick={() => onSelect(subId)}
              style={tabStyle(active)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: S.textPrimary, fontFamily: "monospace" }}>{subId}</span>
                <span style={{ background: statusStyle.bg, color: statusStyle.text, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 9999 }}>
                  {statusStyle.label}
                </span>
              </div>
              <div style={{ fontSize: 10, color: S.textMuted, marginTop: 4 }}>
                ({sub.event_count ?? 0}) · {formatSubscriptionRange(sub)}
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onSelect("all")}
          style={tabStyle(selectedId === "all")}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: S.textPrimary }}>All</div>
          <div style={{ fontSize: 10, color: S.textMuted, marginTop: 4 }}>({totalCount})</div>
        </button>
      </div>
    </div>
  );
}

function displayNameFor(record, fallback = "—") {
  const explicitName = [record?.full_name, record?.name, record?.profile_name]
    .map(value => String(value || "").trim())
    .find(Boolean);
  if (explicitName) return explicitName;
  const combinedName = [record?.first_name, record?.last_name]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  return combinedName || fallback;
}

function isLimitedProfile(record) {
  const value = record?.limited_attributes;
  return value === true || ["1", "true", "yes", "y"].includes(String(value || "").trim().toLowerCase());
}

function initialsFor(record) {
  const displayName = displayNameFor(record, "");
  return (displayName || "??").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function Badge({ label, colors }) {
  const c = colors || { bg: "rgba(100,116,139,0.15)", text: "#94a3b8" };
  return <span style={{ background: c.bg, color: c.text, padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>;
}

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: 40, color: S.textMuted }}>
      <div style={{ width: 24, height: 24, border: `3px solid ${S.border}`, borderTop: `3px solid ${S.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
      Loading...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Btn({ onClick, children, secondary, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "8px 16px", background: disabled ? S.bgCard : secondary ? S.bgCard : S.accent, color: disabled ? S.textMuted : secondary ? "S.textSecondary" : "#fff", border: secondary ? `1px solid ${S.border}` : "none", borderRadius: 4, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, fontFamily: "inherit", opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  );
}

function Input({ value, onChange, onKeyDown, placeholder, style }) {
  const light = isLightMode();
  return (
    <input value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder}
      style={{
        padding: "8px 12px",
        borderRadius: 4,
        border: `1px solid ${light ? "#cbd5e1" : S.border}`,
        background: light ? "#ffffff" : S.bgSecondary,
        color: light ? "#000000" : S.textPrimary,
        fontSize: 13,
        outline: "none",
        fontFamily: "inherit",
        ...style
      }} />
  );
}

function Table({ headers, rows, renderRow }) {
  const light = isLightMode();
  const headerBg = light ? "#eef3fa" : S.bgSecondary;
  const headerText = light ? "#000000" : S.textMuted;
  const border = light ? "#d7e1ef" : S.border;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${border}`, borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: headerBg }}>
            {headers.map(h => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: headerText, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${border}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map((r, i) => renderRow(r, i))}</tbody>
      </table>
    </div>
  );
}

function hasEnrichmentData(enrichmentData, profileMetrics = {}) {
  const governedLtv = Number(profileMetrics?.ltv);
  if (Number.isFinite(governedLtv) && governedLtv >= 0) return true;
  if (!enrichmentData) return false;
  if ((enrichmentData.sources_matched || []).length > 0) return true;
  const enrichment = enrichmentData.enrichment || {};
  return Object.values(enrichment).some(block => block && typeof block === "object");
}

function hasConsentData(consentData) {
  return consentData?.found === true;
}

function AttributesSection({ profile, attrs, showDivider = true }) {
  const demo = {};
  if (profile.subscription_tier) demo.plan_tier = profile.subscription_tier;
  if (profile.city || profile.state) demo.location = [profile.city, profile.state].filter(Boolean).join(", ");
  if (profile.zip) demo.zip = profile.zip;

  return (
    <div style={showDivider ? { borderTop: `1px solid ${S.border}`, paddingTop: 16 } : undefined}>
      <div style={{ fontSize: 13, fontWeight: 700, color: S.textPrimary, marginBottom: 12 }}>Attributes</div>
      {Object.keys(demo).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: S.textMuted, marginBottom: 6 }}>Demographic</div>
          {Object.entries(demo).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(59,130,246,0.12)", color: S.accentLight, fontWeight: 600 }}>{friendlyFieldLabel(k)}</span>
              <span style={{ fontSize: 12, color: S.textPrimary, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      {Object.keys(attrs.computed || {}).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: S.textMuted, marginBottom: 6 }}>Computed</div>
          {Object.entries(attrs.computed).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(245,158,11,0.12)", color: S.warning, fontWeight: 600 }}>{friendlyFieldLabel(k)}</span>
              <span style={{ fontSize: 12, color: S.textPrimary, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      {Object.keys(attrs.behavioral || {}).length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: S.textMuted, marginBottom: 6 }}>Behavioral</div>
          {Object.entries(attrs.behavioral).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(16,185,129,0.10)", color: S.success, fontWeight: 600 }}>{friendlyFieldLabel(k)}</span>
              <span style={{ fontSize: 12, color: S.textPrimary, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      {Object.keys(attrs.computed || {}).length === 0 && Object.keys(attrs.behavioral || {}).length === 0 && Object.keys(demo).length === 0 && (
        <div style={{ fontSize: 12, color: S.textMuted }}>No attributes found</div>
      )}
    </div>
  );
}

function HouseholdSection({ householdMembers }) {
  return (
    <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span>🏠</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: S.textPrimary }}>Household Members</span>
        {householdMembers.length > 0 && <span style={{ fontSize: 11, color: S.textMuted }}>({householdMembers.length})</span>}
      </div>
      {householdMembers.length === 0
        ? <div style={{ fontSize: 12, color: S.textMuted }}>No household members linked</div>
        : householdMembers.map((hm, i) => {
          const resolvedName = displayNameFor(hm, "");
          const hmDisplayName = resolvedName || (hm.golden_id ? `Profile ${hm.golden_id}` : "—");
          const ini = resolvedName ? initialsFor(hm) : "ID";
          return (
            <div key={i} style={{ background: S.bgSecondary, border: `1px solid ${S.borderLight}`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(168,85,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#a855f7", flexShrink: 0 }}>{ini}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: S.textPrimary }}>{hmDisplayName}</div>
                  {(hm.relationship || hm.email) && (
                    <div style={{ fontSize: 10, color: S.textMuted }}>
                      {hm.relationship || hm.email}
                    </div>
                  )}
                </div>
              </div>
              <span style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 9999 }}>Household</span>
            </div>
          );
        })}
    </div>
  );
}

function ActivityDetailPanel({ detail, loading, onClose }) {
  const sourceStyle = detail?.source_file ? eventStyle("", detail.source_file) : { icon: "📌", color: "#64748b" };
  const activityType = sourceLabel(detail?.source_file || detail?.source_label);

  return (
    <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span>📋</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: S.textPrimary }}>Activity Details</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: S.textMuted,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            flexShrink: 0,
            padding: "2px 0",
          }}
        >
          Close
        </button>
      </div>
      {activityType && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: S.textMuted, marginBottom: 6 }}>
          <span>{sourceStyle.icon}</span>
          <span>
            Activity Type:{" "}
            <span style={{ fontWeight: 600, color: S.textPrimary }}>{activityType}</span>
          </span>
        </div>
      )}
      {loading ? (
        <Spinner />
      ) : detail?.error ? (
        <div style={{ fontSize: 12, color: S.error, lineHeight: 1.5 }}>
          Unable to load activity details.
          {detail?.message && (
            <div style={{ marginTop: 6, color: S.textMuted, fontSize: 11 }}>{detail.message}</div>
          )}
        </div>
      ) : (detail?.fields || []).length === 0 ? (
        <div style={{ fontSize: 12, color: S.textMuted }}>No detail fields available for this activity.</div>
      ) : (
        detail.fields.map(field => (
          <div
            key={field.key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "6px 0",
              borderBottom: `1px solid ${S.border}`,
            }}
          >
            <span style={{ fontSize: 11, color: S.textMuted, flexShrink: 0 }}>{field.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: S.textPrimary, textAlign: "right", wordBreak: "break-word" }}>
              {field.value}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function ConnectSourceModal({ externalSources, onConnect, onClose }) {
  const available = externalSources.filter(s => s.status === "available");
  const [connecting, setConnecting] = useState(null);
  const [connected,  setConnected]  = useState([]);
  const handleConnect = (id) => {
    setConnecting(id);
    setTimeout(() => { setConnecting(null); setConnected(p => [...p, id]); onConnect(id); }, 1200);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: S.bgCard, border: `1px solid ${S.borderLight}`, borderRadius: 12, width: 580, maxHeight: "80vh", overflow: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: S.textPrimary }}>Connect External Source</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: S.textMuted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {available.map(src => {
          const isDone = connected.includes(src.id);
          const isBusy = connecting === src.id;
          return (
            <div key={src.id} style={{ background: S.bgSecondary, border: `1px solid ${isDone ? S.success : S.border}`, borderRadius: 8, padding: "14px 16px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{src.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: S.textPrimary }}>{src.label}</div>
                    <div style={{ fontSize: 11, color: S.textMuted, marginTop: 2 }}>Method: {src.method} · Adds +{src.completeness}%</div>
                  </div>
                </div>
                <div>
                  {isDone ? <span style={{ fontSize: 12, color: S.success, fontWeight: 600 }}>✓ Connected</span>
                           : <Btn onClick={() => handleConnect(src.id)} disabled={isBusy}>{isBusy ? "Connecting..." : "Connect"}</Btn>}
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 16, textAlign: "right" }}><Btn secondary onClick={onClose}>Close</Btn></div>
      </div>
    </div>
  );
}

// ── Consent helpers ────────────────────────────────────────────────────────────
function consentColor(value) {
  if (!value || value === "null") return { bg: "rgba(100,116,139,0.12)", text: "#64748b", label: "Not Captured" };
  const v = String(value).toLowerCase();
  if (v === "opt_in")    return { bg: "rgba(16,185,129,0.12)",  text: "#10b981", label: "Opted In"  };
  if (v === "opt_out")   return { bg: "rgba(239,68,68,0.12)",   text: "#ef4444", label: "Opted Out" };
  if (v === "withdrawn") return { bg: "rgba(239,68,68,0.18)",   text: "#ef4444", label: "Withdrawn" };
  return { bg: "rgba(100,116,139,0.12)", text: "#64748b", label: value };
}

function ConsentPill({ value }) {
  const c = consentColor(value);
  return <span style={{ background: c.bg, color: c.text, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, whiteSpace: "nowrap" }}>{c.label}</span>;
}

// ── Consent Section ────────────────────────────────────────────────────────────
function ConsentSection({ consentData }) {
  const [showAudit, setShowAudit] = useState(false);
  const [auditData, setAuditData] = useState(null);

  if (!consentData) return (
    <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span>🔒</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: S.textPrimary }}>Consent & Privacy</span>
      </div>
      <div style={{ fontSize: 12, color: S.textMuted }}>Loading consent data...</div>
    </div>
  );

  const c = consentData.consent || {};
  const suppressed = c.marketing_suppressed;
  const fields = [
    { label: "Data Processing",  key: "data_processing_consent",  icon: "📋" },
    { label: "Global Consent",   key: "global_consent",           icon: "🌐" },
    { label: "Email Marketing",  key: "marketing_email_consent",  icon: "📧" },
    { label: "Cookie / Tracking",key: "tracking_cookie_consent",  icon: "🍪" },
    { label: "Comms Opt-Out",    key: "marketing_comms_optout",   icon: "🚫" },
  ];
  const sources = c.sources_seen ? c.sources_seen.split(",").map(s => s.trim()).filter(Boolean) : [];
  const sourceIcons = { billing: "💳", email_engagement: "📧", call_center: "📞", website_banner: "🌐", mobile_app: "📱" };

  const fetchAudit = (moscid) => {
    if (auditData) { setShowAudit(p => !p); return; }
    fetch(resolveApi(`/api/consent/audit/${moscid}`))
      .then(r => r.json()).then(d => { setAuditData(d); setShowAudit(true); })
      .catch(() => setAuditData({ events: [] }));
  };

  return (
    <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span>🔒</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: S.textPrimary }}>Consent & Privacy</span>
        </div>
        {suppressed
          ? <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 9999, border: "1px solid rgba(239,68,68,0.3)" }}>⛔ Marketing Suppressed</span>
          : <span style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 9999, border: "1px solid rgba(16,185,129,0.25)" }}>✓ Marketable</span>
        }
      </div>
      {suppressed && c.suppression_reason && (
        <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "7px 10px", marginBottom: 10, fontSize: 11, color: "#ef4444" }}>
          Suppressed via <strong>{friendlyFieldLabel(c.suppression_reason)}</strong>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
        {fields.map(f => (
          <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", background: S.bgSecondary, border: `1px solid ${S.border}`, borderRadius: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>{f.icon}</span>
              <span style={{ fontSize: 11, color: S.textMuted }}>{f.label}</span>
            </div>
            <ConsentPill value={c[f.key]} />
          </div>
        ))}
      </div>
      {sources.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: S.textMuted, marginBottom: 6 }}>Captured From</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {sources.map(src => (
              <span key={src} style={{ background: "rgba(0,102,204,0.10)", color: S.accentLight, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 9999 }}>
                {sourceIcons[src] || "📌"} {friendlyConsentSource(src)}
              </span>
            ))}
          </div>
        </div>
      )}
      {consentData.found && (
        <button onClick={() => fetchAudit(consentData.moscid)}
          style={{ background: "none", border: `1px solid ${S.borderLight}`, borderRadius: 4, color: S.textMuted, fontSize: 11, cursor: "pointer", padding: "4px 10px", width: "100%", textAlign: "left", fontFamily: "inherit" }}>
          {showAudit ? "▲ Hide" : "▼ Show"} consent audit trail
        </button>
      )}
      {showAudit && auditData && (
        <div style={{ marginTop: 8, background: S.bgSecondary, border: `1px solid ${S.border}`, borderRadius: 6, overflow: "hidden" }}>
          {auditData.events?.length === 0
            ? <div style={{ padding: "10px 12px", fontSize: 11, color: S.textMuted }}>No consent events found</div>
            : auditData.events?.slice(0, 8).map((ev, i) => (
              <div key={i} style={{ padding: "7px 12px", borderBottom: i < auditData.events.length - 1 ? `1px solid ${S.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: S.textPrimary, fontWeight: 500 }}>
                    {friendlyFieldLabel(ev.consent_field)}
                    <span style={{ marginLeft: 6 }}><ConsentPill value={ev.consent_value} /></span>
                  </div>
                  <div style={{ fontSize: 10, color: S.textMuted, marginTop: 2 }}>
                    {sourceIcons[ev.consent_source] || "📌"} {friendlyConsentSource(ev.consent_source)}
                    {ev.agent_id && <span> · {ev.agent_id}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: S.textMuted, whiteSpace: "nowrap" }}>{formatTime(ev.consent_timestamp)}</div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ── Enrichment Panel ──────────────────────────────────────────────────────────
function EnrichmentPanel({ enrichmentData, profileMetrics = {} }) {
  const governedLtv = formatLtvDisplay(profileMetrics?.ltv);
  if (!enrichmentData && !governedLtv) return (
    <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span>📊</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: S.textPrimary }}>Enrichment Data</span>
      </div>
      <div style={{ fontSize: 12, color: S.textMuted }}>Loading enrichment data...</div>
    </div>
  );

  const {
    enrichment = {},
    sources_matched = [],
    sources_available = [],
  } = enrichmentData || {};
  const PARTY_COLORS = {
    '1P': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    '2P': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    '3P': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'ML': { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
  };

  const defaultSections = [
    {
      key: 'fan_scores', label: '⭐ Fan Scores',
      fields: [
        { k: 'fan_score', l: 'Fan Score' }, { k: 'preferred_team', l: 'Preferred Team' },
        { k: 'content_affinity', l: 'Content Affinity' }, { k: 'venue_visits_12m', l: 'Venue Visits (12m)' },
        { k: 'merchandise_spend_band', l: 'Merch Spend' }, { k: 'fantasy_participation', l: 'Fantasy Player' },
      ],
    },
    {
      key: 'location', label: '📍 Location Signals',
      fields: [
        { k: 'home_dma', l: 'Home DMA' }, { k: 'stadium_visits_12m', l: 'Stadium Visits' },
        { k: 'travel_radius_miles', l: 'Travel Radius (mi)' }, { k: 'frequent_venue_type', l: 'Frequent Venue' },
        { k: 'weekend_sports_visitor', l: 'Weekend Sports Fan' },
      ],
    },
    {
      key: 'demographics', label: '👤 Demographics',
      fields: [
        { k: 'estimated_age_range', l: 'Age Range' }, { k: 'estimated_income_band', l: 'Income Band' },
        { k: 'household_size', l: 'Household Size' }, { k: 'education_level', l: 'Education' },
        { k: 'homeowner_flag', l: 'Homeowner' }, { k: 'presence_of_children', l: 'Has Children' },
      ],
    },
    {
      key: 'ltv_propensity', label: 'Value & Propensity Signals',
      fields: [
        { k: 'ltv_score', l: 'Lifetime Value Propensity Score' },
        { k: 'ltv_band', l: 'Value Propensity Band' },
        { k: 'churn_propensity_score', l: 'Churn Propensity' },
        { k: 'upsell_propensity_score', l: 'Upsell Propensity' },
        { k: 'predicted_annual_value', l: 'Predicted Annual Value' },
        { k: 'segment_code', l: 'Propensity Segment' },
      ],
    },
  ];
  const sections = Array.isArray(enrichmentData?.sections) && enrichmentData.sections.length
    ? enrichmentData.sections
    : defaultSections;
  const visibleSections = sections.filter(section => enrichment[section.key]);

  return (
    <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span>📊</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: S.textPrimary }}>Enrichment Data</span>
        </div>
        {sources_available.length > 0 && (
          <span style={{ fontSize: 10, color: S.textMuted }}>
            {sources_matched.length}/{sources_available.length} sources matched
          </span>
        )}
      </div>
      {governedLtv && (
        <div className="cp-profile-value-evidence">
          <div className="cp-profile-value-evidence__header">
            <div>
              <div className="cp-profile-value-evidence__eyebrow">Governed customer value</div>
              <div className="cp-profile-value-evidence__label">
                {profileMetrics.ltv_label || "Customer Lifetime Value"}
              </div>
            </div>
            <div className="cp-profile-value-evidence__amount">{governedLtv}</div>
          </div>
          <div className="cp-profile-value-evidence__meta">
            This is the same governed profile-level value shown in the Customer Lifetime Value KPI card.
            {profileMetrics.ltv_source ? ` Source: ${profileMetrics.ltv_source}.` : ""}
          </div>
          {profileMetrics.ltv_source_totals && (
            <div className="cp-profile-value-evidence__sources">
              {Object.entries(profileMetrics.ltv_source_totals).map(([label, amount]) => (
                <span key={label}>
                  {label}: <strong>{formatLtvDisplay(amount)}</strong>
                </span>
              ))}
            </div>
          )}
          {profileMetrics.ltv_formula && (
            <details className="cp-profile-value-evidence__details">
              <summary>How this value is calculated</summary>
              <div>{profileMetrics.ltv_formula}</div>
            </details>
          )}
        </div>
      )}
      {visibleSections.map(section => {
        const data = enrichment[section.key];
        const matched = !!data;
        const pc = PARTY_COLORS[data?.party] || PARTY_COLORS['3P'];
        return (
          <div key={section.key} style={{ marginBottom: 8, background: S.bgSecondary, border: `1px solid ${matched ? S.borderLight : S.border}`, borderRadius: 7, overflow: "hidden", opacity: matched ? 1 : 0.4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderBottom: matched ? `1px solid ${S.border}` : "none" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: matched ? S.textPrimary : S.textMuted }}>{section.label}</span>
              {matched
                ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ background: pc.bg, color: pc.color, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 9999 }}>{data.party}</span>
                    <span style={{ fontSize: 9, color: S.textMuted }}>
                      {friendlySourceList(data.source) || "Governed enrichment"}
                    </span>
                  </div>
                : <span style={{ fontSize: 9, color: S.textMuted }}>No match</span>
              }
            </div>
            {matched && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                {section.fields.map((f, i) => {
                  const val = data[f.k];
                  if (!val) return null;
                  return (
                    <div key={f.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 10px", borderBottom: `1px solid ${S.border}`, borderRight: i % 2 === 0 ? `1px solid ${S.border}` : "none" }}>
                      <span style={{ fontSize: 10, color: S.textMuted }}>{f.l}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: S.textPrimary }}>{val}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Customer 360 Profile Modal ────────────────────────────────────────────────
function ProfileModal({ profile, completeness, clusterData, consentData, enrichmentData, sourceSystem, onClose }) {
  const [activityDetail, setActivityDetail] = useState(null);
  const [activityDetailLoading, setActivityDetailLoading] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState("all");
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const activityDetailRef = useRef(null);
  const activeRecordRef = useRef(null);
  const profileTitleId = `customer-profile-title-${String(profile?.golden_id || "profile").replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), details > summary'
        )
      ).filter(element => element.getClientRects().length > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, []);

  const closeActivityDetail = useCallback(() => {
    activeRecordRef.current = null;
    setSelectedRecordId(null);
    setActivityDetail(null);
    setActivityDetailLoading(false);
  }, []);

  const openActivityDetail = useCallback((recordId) => {
    if (!recordId || !profile?.golden_id) return;
    const normalized = String(recordId).toUpperCase();

    if (activeRecordRef.current === normalized) {
      closeActivityDetail();
      return;
    }

    activeRecordRef.current = normalized;
    setSelectedRecordId(normalized);
    setActivityDetail(null);
    setActivityDetailLoading(true);

    fetch(
      resolveApi(`/api/golden-records/${encodeURIComponent(profile.golden_id)}/activity/${encodeURIComponent(recordId)}?source=${encodeURIComponent(sourceSystem || "media")}`)
    )
      .then(r => {
        if (!r.ok) throw new Error(`Activity detail failed: ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (activeRecordRef.current !== normalized) return;
        setActivityDetail(data);
      })
      .catch((err) => {
        if (activeRecordRef.current !== normalized) return;
        setActivityDetail({
          error: true,
          record_id: normalized,
          message: err?.message || "Request failed",
        });
      })
      .finally(() => {
        if (activeRecordRef.current === normalized) {
          setActivityDetailLoading(false);
        }
      });
  }, [profile?.golden_id, sourceSystem, closeActivityDetail]);

  useEffect(() => {
    if (selectedRecordId && activityDetailRef.current) {
      activityDetailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedRecordId, activityDetailLoading]);

  useEffect(() => {
    const subs = clusterData?.subscriptions;
    if (!subs?.length) {
      setSelectedSubscriptionId("all");
      return;
    }
    setSelectedSubscriptionId(pickDefaultSubscriptionFilter(subs));
  }, [profile?.golden_id, clusterData]);

  const subscriptions = sortSubscriptionsForDisplay(clusterData?.subscriptions || []);
  const showSubscriptionHistory = (
    ["media", "automotive", "telecom"].includes(sourceSystem)
    && subscriptions.length > 0
  );

  const handleSubscriptionSelect = useCallback((subscriptionId) => {
    setSelectedSubscriptionId(subscriptionId);
    closeActivityDetail();
  }, [closeActivityDetail]);

  if (!profile) return null;

  const isLoading        = clusterData === null || consentData === null || enrichmentData === null;
  const events           = clusterData?.events            || [];
  const filteredEvents   = showSubscriptionHistory
    ? filterEventsBySubscription(events, selectedSubscriptionId)
    : events;
  const attrs            = clusterData?.attributes        || { computed: {}, behavioral: {} };
  const householdMembers = [];
  const seenHouseholdMemberIds = new Set();
  const seenHouseholdPeople = new Set();
  for (const member of clusterData?.household_members || []) {
    const goldenId = String(member.golden_id || "").trim();
    if (goldenId && goldenId.toUpperCase() === String(profile.golden_id || "").toUpperCase()) continue;
    const idKey = goldenId.toUpperCase();
    const nameKey = displayNameFor(member, "").toUpperCase();
    const personKey = nameKey || [
      member.email,
      member.address,
      member.zip,
    ].map(value => String(value || "").trim().toUpperCase()).filter(Boolean).join("|");
    if (idKey && seenHouseholdMemberIds.has(idKey)) continue;
    if (personKey && seenHouseholdPeople.has(personKey)) continue;
    if (idKey) seenHouseholdMemberIds.add(idKey);
    if (personKey) seenHouseholdPeople.add(personKey);
    householdMembers.push(member);
  }
  const totalRecords = Number.isFinite(Number(clusterData?.total_records))
    ? Number(clusterData.total_records)
    : Number.isFinite(Number(profile.record_count))
      ? Number(profile.record_count)
      : 0;
  const totalEventCount = Number.isFinite(Number(clusterData?.total_event_count))
    ? Number(clusterData.total_event_count)
    : events.length;
  const totalIdentityCount = Number.isFinite(Number(clusterData?.total_identity_count))
    ? Number(clusterData.total_identity_count)
    : (clusterData?.linked_identities || []).length;
  const hasAttributes = Boolean(
    profile.subscription_tier
    || profile.city
    || profile.state
    || profile.zip
    || Object.keys(attrs.computed || {}).length
    || Object.keys(attrs.behavioral || {}).length
  );

  const profileDisplayName = displayNameFor(profile);
  const initials = initialsFor(profile);
  const isSuppressed = consentData?.consent?.marketing_suppressed;
  const profileMetrics = clusterData?.profile_metrics || {};
  const governedLtv = formatLtvDisplay(profileMetrics.ltv);
  const lastUpdated = latestTimestamp(
    clusterData?.last_updated,
    consentData?.consent?.consent_last_updated
  );
  const ltvPropensityScore = enrichmentData?.enrichment?.ltv_propensity?.ltv_score;
  const hasLtvPropensity = ltvPropensityScore !== null
    && ltvPropensityScore !== undefined
    && String(ltvPropensityScore).trim() !== "";
  const governedEngagement = Number(profileMetrics.engagement_rate);
  const hasGovernedEngagement = Number.isFinite(governedEngagement)
    && governedEngagement >= 0
    && governedEngagement <= 100;
  const knownIdentifierCount = new Set([
    profile.golden_id,
    profile.customer_id,
    profile.account_id,
    profile.loyalty_id,
    profile.household_id,
    profile.email,
    profile.phone,
  ].map(value => String(value || "").trim()).filter(Boolean)).size;
  const contributingSourceCount = Number.isFinite(Number(clusterData?.contributing_source_count))
    ? Number(clusterData.contributing_source_count)
    : Number(profile.source_count);

  const stats = [
    governedLtv
      ? {
        label: "Customer Lifetime Value",
        value: governedLtv,
        color: S.success,
        prominent: true,
        context: profileMetrics.ltv_label || "Governed customer value",
      }
      : hasLtvPropensity
        ? {
          label: "LTV Propensity Score",
          value: String(ltvPropensityScore),
          color: S.accentLight,
          context: "A non-monetary propensity score from the matched enrichment source.",
        }
        : null,
    hasGovernedEngagement
      ? { label: "Engagement", value: `${governedEngagement.toFixed(1)}%`, color: S.accentLight }
      : null,
    { label: "Total Events", value: totalEventCount.toLocaleString(), color: S.accentLight },
    totalIdentityCount > 0
      ? {
        label: "Identities",
        value: totalIdentityCount.toLocaleString(),
        color: S.warning,
        context: (clusterData?.identity_types || []).join(", "),
      }
      : null,
    { label: "Linked Records", value: Number(totalRecords).toLocaleString(), color: S.textSecondary },
    Number.isFinite(contributingSourceCount) && contributingSourceCount > 0
      ? {
        label: "Contributing Sources",
        value: contributingSourceCount.toLocaleString(),
        color: S.accentLight,
        context: (clusterData?.contributing_sources || []).map(sourceLabel).join(", "),
      }
      : null,
    knownIdentifierCount > 0
      ? { label: "Known Identifiers", value: knownIdentifierCount.toLocaleString(), color: S.warning }
      : null,
    householdMembers.length > 0
      ? { label: "Household Members", value: householdMembers.length, color: S.warning }
      : null,
    subscriptions.length > 0
      ? { label: "Subscriptions", value: subscriptions.length.toLocaleString(), color: S.success }
      : null,
  ].filter(Boolean).slice(0, 4);

  const tags = [profile.membership_tier, profile.subscription_tier].filter(Boolean);

  const secondaryWidgets = [
    { id: "household", hasData: householdMembers.length > 0, node: <HouseholdSection householdMembers={householdMembers} /> },
    { id: "consent", hasData: hasConsentData(consentData), node: <ConsentSection consentData={consentData} /> },
    {
      id: "enrichment",
      hasData: hasEnrichmentData(enrichmentData, profileMetrics),
      node: <EnrichmentPanel enrichmentData={enrichmentData} profileMetrics={profileMetrics} />,
    },
  ];
  const orderedSecondaryWidgets = secondaryWidgets.filter(widget => widget.hasData);

  return (
    <div
      className="cp-profile-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={profileTitleId}
        tabIndex={-1}
        className="cp-profile-modal-shell"
        style={{ background: S.bgCard, border: `1px solid ${S.borderLight}` }}
      >
        <div
          className="cp-profile-modal-header"
          style={{ borderBottom: `1px solid ${S.border}`, background: S.bgSecondary }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: S.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span id={profileTitleId} style={{ fontSize: 18, fontWeight: 700, color: S.textPrimary }}>{profileDisplayName}</span>
                  {isSuppressed
                    ? <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 9999, border: "1px solid rgba(239,68,68,0.3)" }}>⛔ Marketing Suppressed</span>
                    : consentData?.found
                      ? <span style={{ background: "rgba(16,185,129,0.10)", color: S.success, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 9999, border: "1px solid rgba(16,185,129,0.2)" }}>🔒 Consented</span>
                      : null
                  }
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
                  {profile.email && <span style={{ fontSize: 12, color: S.textMuted }}>✉ {profile.email}</span>}
                  {profile.phone && <span style={{ fontSize: 12, color: S.textMuted }}>📞 {profile.phone}</span>}
                </div>
                {lastUpdated && (
                  <div className="cp-profile-header-updated">
                    <span className="cp-profile-header-updated__label">Last Updated</span>
                    <time dateTime={lastUpdated}>{formatTime(lastUpdated)}</time>
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {tags.map(t => <span key={t} style={{ background: "rgba(0,102,204,0.12)", color: S.accentLight, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 9999 }}>{t}</span>)}
                </div>
                <div className="cp-profile-modal-id">{profile.golden_id}</div>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close customer profile"
              onClick={() => onCloseRef.current?.()}
              style={{ background: "none", border: "none", color: S.textMuted, fontSize: 22, cursor: "pointer", marginLeft: 16, flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
          {!isLoading && enrichmentData !== null && !clusterData?.error && (
            <div className="cp-profile-kpi-grid">
              {stats.map(s => (
                <div
                  key={s.label}
                  className={`cp-profile-kpi-card${s.prominent ? " is-prominent" : ""}`}
                  title={s.context || undefined}
                  style={{
                    background: s.prominent ? "rgba(16,185,129,0.08)" : S.bgCard,
                    border: `1px solid ${s.prominent ? "rgba(16,185,129,0.45)" : S.border}`,
                  }}
                >
                  <div className="cp-profile-kpi-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="cp-profile-kpi-label" style={{ color: S.textMuted }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {clusterData?.error && (
          <div
            role="alert"
            style={{
              margin: "16px 20px 0",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.08)",
              color: S.error,
              fontSize: 12,
            }}
          >
            {clusterData.error}
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: S.textMuted }}>
            <div style={{ width: 20, height: 20, border: `3px solid ${S.border}`, borderTop: `3px solid ${S.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
            Loading profile data...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : clusterData?.error ? null : (
          <div className="cp-profile-modal-body">
            <div
              className="cp-profile-activity-column"
              style={{ borderRight: `1px solid ${S.border}` }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.textPrimary }}>Activity Timeline</div>
                <div style={{ fontSize: 10, color: S.textMuted, whiteSpace: "nowrap" }}>
                  {filteredEvents.length.toLocaleString()} shown · {totalEventCount.toLocaleString()} total
                </div>
              </div>
              {showSubscriptionHistory && (
                <SubscriptionFilterTabs
                  subscriptions={subscriptions}
                  events={events}
                  selectedId={selectedSubscriptionId}
                  onSelect={handleSubscriptionSelect}
                />
              )}
              {filteredEvents.length === 0
                ? <div style={{ fontSize: 12, color: S.textMuted, textAlign: "center", padding: "24px 0" }}>
                    {events.length === 0 ? "No events found" : "No activities for this subscription"}
                  </div>
                : filteredEvents.map((ev, i) => {
                  const style = eventStyle(ev.event_type, ev.source_file);
                  const label = ev.event_type ? activityLabel(ev.event_type) : sourceLabel(ev.source_file) || "Event";
                  const isSelected = selectedRecordId && ev.record_id
                    && String(ev.record_id).toUpperCase() === selectedRecordId;
                  return (
                    <div
                      key={ev.record_id || `${ev.source_file}-${ev.event_timestamp}-${i}`}
                      style={{
                        display: "flex",
                        gap: 10,
                        paddingBottom: 14,
                        position: "relative",
                        marginLeft: isSelected ? -8 : 0,
                        marginRight: isSelected ? -8 : 0,
                        paddingLeft: isSelected ? 8 : 0,
                        paddingRight: isSelected ? 8 : 0,
                        paddingTop: isSelected ? 8 : 0,
                        borderRadius: isSelected ? 8 : 0,
                        background: isSelected ? "rgba(0,102,204,0.08)" : "transparent",
                        border: isSelected ? `1px solid rgba(0,102,204,0.25)` : "1px solid transparent",
                      }}
                    >
                      {i < filteredEvents.length - 1 && <div style={{ position: "absolute", left: 11, top: 22, width: 2, height: "calc(100% - 8px)", background: S.border }} />}
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${style.color}20`, border: `2px solid ${style.color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, zIndex: 1 }}>{style.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600, color: S.textPrimary, flex: 1, minWidth: 0 }}>
                            {label}
                          </div>
                          {ev.record_id && !ev.summary && (
                            <button
                              type="button"
                              onClick={() => openActivityDetail(ev.record_id)}
                              style={{
                                ...timelineDetailButtonStyle,
                                color: isSelected ? S.accent : S.accentLight,
                                fontWeight: isSelected ? 700 : 600,
                              }}
                            >
                              {isSelected ? "Hide Details" : "View Details"}
                            </button>
                          )}
                        </div>
                        {ev.summary && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 12,
                              marginTop: 3,
                            }}
                          >
                            <div style={{ fontSize: 11, color: S.textSecondary, lineHeight: 1.4, flex: 1, minWidth: 0 }}>
                              {ev.summary}
                            </div>
                            {ev.record_id && (
                              <button
                                type="button"
                                onClick={() => openActivityDetail(ev.record_id)}
                                style={{
                                  ...timelineDetailButtonStyle,
                                  color: isSelected ? S.accent : S.accentLight,
                                  fontWeight: isSelected ? 700 : 600,
                                }}
                              >
                                {isSelected ? "Hide Details" : "View Details"}
                              </button>
                            )}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: S.textMuted, marginTop: 3 }}>
                          {formatTimelineTimestamp(ev.event_timestamp)}
                          {ev.source_file && <span> · <span style={{ color: style.color }}>{sourceLabel(ev.source_file)}</span></span>}
                          {ev.campaign_name && <span> · {ev.campaign_name}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              }
            </div>

            <div className="cp-profile-detail-column">
              {selectedRecordId ? (
                <div ref={activityDetailRef}>
                  <ActivityDetailPanel
                    detail={activityDetail}
                    loading={activityDetailLoading}
                    onClose={closeActivityDetail}
                  />
                </div>
              ) : null}
              {hasAttributes && (
                <AttributesSection
                  profile={profile}
                  attrs={attrs}
                  showDivider={!!selectedRecordId}
                />
              )}
              {orderedSecondaryWidgets.map(w => (
                <div key={w.id}>{w.node}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerProfile() {
  const [data,            setData]            = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [page,            setPage]            = useState(1);
  const [search,          setSearch]          = useState("");
  const [searchInput,     setSearchInput]     = useState("");
  const [internalSources, setInternalSources] = useState(INTERNAL_SOURCES);
  const [externalSources, setExternalSources] = useState(EXTERNAL_SOURCES);
  const [showModal,       setShowModal]       = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [clusterData,     setClusterData]     = useState(null);
  const [consentData,     setConsentData]     = useState(null);
  const [enrichmentData,  setEnrichmentData]  = useState(null);
  const [sample,          setSample]          = useState(null);
  const [showSample,      setShowSample]      = useState(false);
  const [profileMode,     setProfileMode]     = useState(false);
  const [profileModeInfo, setProfileModeInfo] = useState(null);
  const [sourceSystem,    setSourceSystem]    = useState(readSelectedSourceSystem);
  const [loadError,       setLoadError]       = useState("");

  useEffect(() => {
    fetch(resolveApi("/api/profile-mode"))
      .then(r => r.json())
      .then(d => { setProfileMode(d.profile_mode); setProfileModeInfo(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const syncSourceSystem = () => {
      const nextSource = readSelectedSourceSystem();
      setSourceSystem(current => (current === nextSource ? current : nextSource));
    };
    window.addEventListener("focus", syncSourceSystem);
    window.addEventListener("storage", syncSourceSystem);
    window.addEventListener("cdp-source-system-change", syncSourceSystem);
    return () => {
      window.removeEventListener("focus", syncSourceSystem);
      window.removeEventListener("storage", syncSourceSystem);
      window.removeEventListener("cdp-source-system-change", syncSourceSystem);
    };
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedProfile(null);
    setClusterData(null);
    setConsentData(null);
    setEnrichmentData(null);
    setSample(null);
  }, [sourceSystem]);

  const load = useCallback((p, s, src = sourceSystem) => {
    setLoading(true);
    setLoadError("");
    fetch(resolveApi(`/api/enrichment?page=${p}&limit=${CUSTOMER_PROFILE_PAGE_SIZE}&search=${encodeURIComponent(s)}&source=${encodeURIComponent(src)}`))
      .then(r => {
        if (!r.ok) throw new Error(`Customer profile list request failed (${r.status}).`);
        return r.json();
      })
      .then(d => {
        const rows = Array.isArray(d?.rows)
          ? d.rows.map(row => ({
            ...row,
            source_count: Number.isFinite(Number(row.source_count))
              ? Number(row.source_count)
              : new Set(
                String(row.source_files || "")
                  .split("|")
                  .map(value => value.trim())
                  .filter(Boolean),
              ).size,
          }))
          : [];
        const requestedPage = Math.max(1, Number(p) || 1);
        const reportedTotal = Number(d?.total);
        const visibleTotalFloor = rows.length > 0
          ? ((requestedPage - 1) * CUSTOMER_PROFILE_PAGE_SIZE) + rows.length
          : 0;
        const total = Math.max(
          Number.isFinite(reportedTotal) ? Math.max(0, Math.trunc(reportedTotal)) : 0,
          visibleTotalFloor,
        );
        const reportedPages = Number(d?.pages);
        const pages = Math.max(
          Number.isFinite(reportedPages) ? Math.max(0, Math.trunc(reportedPages)) : 0,
          total > 0 ? Math.ceil(total / CUSTOMER_PROFILE_PAGE_SIZE) : 0,
          rows.length > 0 ? requestedPage : 0,
        );
        setData({ ...d, rows, total, page: requestedPage, pages });
        if (p === 1) setSample(rows[0] || null);
      })
      .catch(error => {
        setData({ rows: [], total: 0, page: p, pages: 0 });
        setSample(null);
        setLoadError(error?.message || "Unable to load customer profiles.");
      })
      .finally(() => setLoading(false));
  }, [sourceSystem]);

  useEffect(() => { load(page, search, sourceSystem); }, [page, search, sourceSystem, load]);

  useEffect(() => {
    if (!selectedProfile) { setClusterData(null); return; }
    setClusterData(null);
    fetch(resolveApi(`/api/profile/${selectedProfile.golden_id}/cluster-data?source=${encodeURIComponent(sourceSystem)}`))
      .then(r => {
        if (!r.ok) throw new Error(`Customer profile request failed (${r.status}).`);
        return r.json();
      })
      .then(d => setClusterData(d))
      .catch(error => setClusterData({
        error: error?.message || "Unable to load customer profile details.",
        events: [],
        subscriptions: [],
        attributes: { computed: {}, behavioral: {} },
        household_members: [],
        total_records: 0,
        total_event_count: 0,
        total_identity_count: 0,
        last_updated: null,
        profile_metrics: {},
      }));
  }, [selectedProfile, sourceSystem]);

  useEffect(() => {
    if (!selectedProfile) { setConsentData(null); return; }
    setConsentData(null);
    fetch(resolveApi(`/api/consent/${selectedProfile.golden_id}?source=${encodeURIComponent(sourceSystem)}`))
      .then(r => r.json()).then(d => setConsentData(d))
      .catch(() => setConsentData({ found: false, consent: null }));
  }, [selectedProfile, sourceSystem]);

  useEffect(() => {
    if (!selectedProfile) { setEnrichmentData(null); return; }
    setEnrichmentData(null);
    fetch(resolveApi(`/api/enrichment/profile/${selectedProfile.golden_id}?source=${encodeURIComponent(sourceSystem)}`))
      .then(r => r.json()).then(d => setEnrichmentData(d))
      .catch(() => setEnrichmentData({ enrichment: {}, sources_matched: [], sources_available: [] }));
  }, [selectedProfile, sourceSystem]);

  const handleConnect = (id) => setExternalSources(prev => prev.map(s => s.id === id ? { ...s, status: "connected" } : s));
  const connectedInternal = internalSources.filter(s => s.status === "connected");
  const connectedExternal = externalSources.filter(s => s.status === "connected");
  const completeness = Math.min([...connectedInternal, ...connectedExternal].reduce((a, s) => a + s.completeness, 0), 100);

  return (
    <div style={{  fontFamily: "var(--font)", background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)" }}>
      {/* <div className="page-header" style={{ padding: 0, marginBottom: 20 }}>
        <div className="page-title">Customer Profile</div>
        <div className="page-description">Golden Records enriched with internal and external data sources</div>
      </div> */}

      {sample && (
        <div style={{ background: S.bgCard, border: `1px solid ${S.border}`, borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer", borderBottom: showSample ? `1px solid ${S.border}` : "none" }}
            onClick={() => setShowSample(p => !p)}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 13, color: S.textPrimary }}>Sample Record — Before & After Enrichment</span>
              <span style={{ fontSize: 11, color: S.textMuted, marginLeft: 10 }}>One current governed customer record</span>
            </div>
            <span style={{ color: S.textMuted, fontSize: 12 }}>{showSample ? "▲" : "▼"}</span>
          </div>
          {showSample && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 1fr", alignItems: "start", padding: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: S.textMuted, marginBottom: 10 }}>🪪 Resolved Identity Record</div>
                {[
                  { label: "Golden ID", value: sample.golden_id, mono: true },
                  { label: "Full Name", value: displayNameFor(sample) },
                  { label: "Email",     value: sample.email || "—" },
                  { label: "Phone",     value: sample.phone || "—" },
                  { label: "Address",   value: sample.address || "—" },
                ].map(f => (
                  <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: S.bgSecondary, border: `1px solid ${S.border}`, borderRadius: 5, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: S.textMuted }}>{f.label}</span>
                    <span style={{ fontSize: f.mono ? 10 : 12, fontFamily: f.mono ? "monospace" : "inherit", color: S.textPrimary, fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 70, color: S.accentLight, fontSize: 20 }}>→</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: S.success, marginBottom: 10 }}>👤 After — Customer Profile (Enriched)</div>
                {[
                  { label: "Golden ID",       value: sample.golden_id, mono: true },
                  { label: "Full Name",        value: displayNameFor(sample) },
                  { label: "Email",            value: sample.email || "—" },
                  { label: "Phone",            value: sample.phone || "—" },
                  { label: "Address",          value: sample.address || "—" },
                  { label: "Linked Records", value: sample.record_count, enriched: true, source: "Identity Resolution", sourceType: "internal", icon: "🔗" },
                  { label: "Contributing Sources", value: sample.source_count, enriched: true, source: "Profile Lineage", sourceType: "internal", icon: "🔗" },
                  { label: "Household ID", value: sample.household_id, enriched: Boolean(sample.household_id), source: "Household Resolution", sourceType: "internal", icon: "🏠" },
                  { label: "Membership Tier", value: sample.membership_tier, enriched: Boolean(sample.membership_tier), source: "Loyalty Membership", sourceType: "internal", icon: "🎟" },

                ].filter(f => f.value !== null && f.value !== undefined && f.value !== "").map(f => (
                  <div key={f.label} style={{ padding: "6px 10px", background: f.enriched ? "rgba(59,130,246,0.12)" : S.bgSecondary, border: `1px solid ${f.enriched ? "rgba(59,130,246,0.4)" : S.border}`, borderRadius: 5, marginBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: S.textPrimary, fontWeight: f.enriched ? 700 : 500 }}>{f.label}</span>
                      <span style={{ fontSize: f.mono ? 10 : 12, fontFamily: f.mono ? "monospace" : "inherit", color: S.textPrimary, fontWeight: f.enriched ? 700 : 500 }}>{f.value}</span>
                    </div>
                    {f.source && (
                      <div style={{ fontSize: 10, marginTop: 1, textAlign: "right", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                        <span style={{ color: f.sourceType === "ml" ? "#a78bfa" : f.sourceType === "internal" ? "#10b981" : "#60a5fa" }}>{f.icon || "📌"}</span>
                        <span style={{ color: f.sourceType === "ml" ? "#a78bfa" : f.sourceType === "internal" ? "#10b981" : "#60a5fa" }}>via {f.source}</span>
                        {f.sourceType === "ml" && <span style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 9999 }}>ML</span>}
                        {f.sourceType === "internal" && <span style={{ background: "rgba(16,185,129,0.10)", color: "#10b981", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 9999 }}>1P</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {profileMode && (
        <div style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 3 }}>Profile Mode Active</div>
            <div style={{ fontSize: 12, color: S.textMuted, lineHeight: 1.5 }}>
              A complete customer profile has been ingested from <strong style={{ color: S.textSecondary }}>{profileModeInfo?.source || "uploaded file"}</strong>.
              Identity graph creation is disabled — segmentation is available directly from this profile data.
            </div>
          </div>
          <button onClick={() => fetch(resolveApi("/api/profile-mode"), { method: "DELETE" }).then(() => { setProfileMode(false); setProfileModeInfo(null); })}
            style={{ background: "none", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 5, color: "#a78bfa", fontSize: 11, cursor: "pointer", padding: "4px 10px", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            Clear & Re-enable ID Graph
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Input value={searchInput} onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (setPage(1), setSearch(searchInput))}
          placeholder="Search by name, email, golden ID..." style={{ flex: 1 }} />
        <Btn onClick={() => { setPage(1); setSearch(searchInput); }}>Search</Btn>
      </div>
      <div style={{ fontSize: 11, color: S.textMuted, marginBottom: 8 }}>
        {data?.total?.toLocaleString() || 0} customer profiles · Click any row to view customer details
      </div>

      {loadError ? (
        <div
          role="alert"
          style={{
            padding: "18px",
            border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: 8,
            background: "rgba(239,68,68,0.08)",
            color: S.textPrimary,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Customer profiles are temporarily unavailable</div>
            <div style={{ color: S.textMuted, fontSize: 12 }}>{loadError}</div>
          </div>
          <Btn secondary onClick={() => load(page, search, sourceSystem)}>Retry</Btn>
        </div>
      ) : loading ? <Spinner /> : (
        <>
          {(data?.rows || []).length > 0 ? (
            <>
              <Table
                headers={["Customer Profile ID", "Name", "Email", "Phone", "Membership Tier", "Linked Records", "Sources"]}
                rows={data?.rows || []}
                renderRow={(r, i) => {
                  const profileName = displayNameFor(r, "");
                  const limitedProfile = isLimitedProfile(r) || (!profileName && !r.email && !r.phone);
                  return (
                  <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, cursor: "pointer" }}
                    onClick={() => setSelectedProfile(r)}
                    onMouseEnter={e => e.currentTarget.style.background = S.bgHover}
                    onMouseLeave={e => e.currentTarget.style.background = ""}>
                    <td style={{ padding: "7px 14px", fontFamily: "monospace", color: S.textMuted, fontSize: 11 }}>{r.golden_id}</td>
                    <td style={{ padding: "7px 14px", color: S.textPrimary, whiteSpace: "nowrap" }}>
                      <div>{profileName || "—"}</div>
                      {limitedProfile && (
                        <div style={{ color: S.textMuted, fontSize: 10, marginTop: 2 }}>Limited source attributes</div>
                      )}
                    </td>
                    <td style={{ padding: "7px 14px", color: S.textSecondary }}>{r.email || "—"}</td>
                    <td style={{ padding: "7px 14px", color: S.textSecondary }}>{r.phone || "—"}</td>
                    <td style={{ padding: "7px 14px" }}>
                      {r.membership_tier
                        ? <Badge label={r.membership_tier} colors={TIER_COLORS[r.membership_tier]} />
                        : <span style={{ color: S.textMuted }}>—</span>}
                    </td>
                    <td style={{ padding: "7px 14px", fontWeight: 600, color: S.textPrimary }}>
                      {Number.isFinite(Number(r.record_count)) ? Number(r.record_count).toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: "7px 14px" }}>
                      {Number.isFinite(Number(r.source_count)) ? Number(r.source_count).toLocaleString() : "—"}
                    </td>
                  </tr>
                  );
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center" }}>
                <Btn secondary onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Prev</Btn>
                <span style={{ padding: "8px 14px", fontSize: 12, color: S.textMuted }}>Page {page} of {data?.pages || 1}</span>
                <Btn secondary onClick={() => setPage(p => p + 1)} disabled={page >= (data?.pages || 1)}>Next →</Btn>
              </div>
            </>
          ) : (
            <div style={{ padding: 36, textAlign: "center", color: S.textMuted, border: `1px solid ${S.border}`, borderRadius: 8 }}>
              No customer profiles match the current source and search.
            </div>
          )}
        </>
      )}

      {showModal && <ConnectSourceModal externalSources={externalSources} onConnect={handleConnect} onClose={() => setShowModal(false)} />}
      {selectedProfile && (
        <ProfileModal
          key={selectedProfile.golden_id}
          profile={selectedProfile}
          completeness={completeness}
          clusterData={clusterData}
          consentData={consentData}
          enrichmentData={enrichmentData}
          sourceSystem={sourceSystem}
          onClose={() => { setSelectedProfile(null); setClusterData(null); setConsentData(null); setEnrichmentData(null); }}
        />
      )}
    </div>
  );
}
