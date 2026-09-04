import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";


import { useAuth } from "../../auth/AuthContext";
import { PRECONFIGURED_JOURNEYS, SEGMENT_LIBRARY, TEST_SUITES } from "../../../shared/suiteData";
import { getBlueprintJourneysForSource, getAllJourneys } from "../../shared/journeyStore";
import { api } from "../api";
import {
  STATIC_JOURNEYS,
  STATIC_JOURNEY_MEASUREMENTS,
} from "../data/journeyStaticData";
import {
  readSelectedSourceSystem,
  normalizeSourceSystem as normalizeSourceSystemShared,
} from "../sourceSystem";
import "./overview-page.css";
import CPieChart from "../components/CPieChart";

const S = {
  bgPrimary: "var(--bg-primary)",
  bgSecondary: "var(--bg-secondary)",
  bgCard: "var(--bg-card)",
  border: "var(--border)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  accent: "var(--accent)",
  accentLight: "var(--accent-light)",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  purple: "#a78bfa",
  cyan: "#06b6d4",
};
/* =========================================================
   API BASE
========================================================= */
const API_BASE = `${window.location.protocol}//${window.location.hostname}:5001`;

/* =========================================================
   ENDPOINTS
========================================================= */
const CLASSIFICATION_ENDPOINT = `${API_BASE}/api/data-classification`;
const SEGMENT_LIST_ENDPOINT = `${API_BASE}/api/segment/list`;
const SEGMENTS_ENDPOINT = `${API_BASE}/api/segments`;
const MEASUREMENT_LISTING_ENDPOINT = `${API_BASE}/api/copilot/journey/measurement/listing`;

/* =========================================================
   CONSTANTS
========================================================= */
const ICON_MAP = {
  // Campaign Activity
  "Total Journeys": "🧭",
  "Active Journeys": " ",
  "Inactive Journeys": "⏸",
  "Prebuilt Journeys": "📦",
  "Custom Journeys": "✨",

  // Journey Measurements
  "Total Measured Journeys": "🎯",
  "Emails Sent": "📤",
  Delivered: " ",
  "Open Rate": "📬",
  "Click Rate": "🖱",
  "Bounce Rate": "⚠️",
  Unsubscribed: "🚫",

  // Data Sources
  "1P Source Tables": "🗂️",
  "Total Records": "💾",
}






const SOURCE_LABELS = {
  all: "All Industries",
  media: "Media & OTT",
  sports: "Sports",
  telecom: "Telecom",
  automotive: "Automotive",
};

const ML_MODEL_COUNT_BY_SOURCE = {
  media: 5,
  sports: 5,
  automotive: 5,
  telecom: 3,
  all: 18,
};

const JOURNEY_READY_STATUSES = ["Production ready", "Ready for activation"];

/* =========================================================
   BLUEPRINT-CONTROLLED CAMPAIGN DATA
   IMPORTANT:
   - Media & OTT and Sports must exactly match expected output
   - For Telecom / Automotive we fall back to static/API-ish data
========================================================= */
const BLUEPRINT_CAMPAIGN_JOURNEYS = {
  media: [
    {
      id: "media-conv-monetization-1",
      name: "Subscriber Upgrade Journey",
      source: "media",
      category: "Conversion & Monetization",
      active: true,
      custom: false,
    },
    {
      id: "media-digital-onboarding-1",
      name: "App Onboarding Journey",
      source: "media",
      category: "Digital Engagement & Onboarding",
      active: true,
      custom: false,
    },
    {
      id: "media-retention-renewals-1",
      name: "Subscription Renewal Journey",
      source: "media",
      category: "Retention & Renewals",
      active: true,
      custom: false,
    },
    {
      id: "media-engagement-1",
      name: "Content Recommendation Journey",
      source: "media",
      category: "Engagements",
      active: true,
      custom: false,
    },
    {
      id: "media-engagement-2",
      name: "Weekly Watchlist Journey",
      source: "media",
      category: "Engagements",
      active: true,
      custom: false,
    },
    {
      id: "media-churn-prevention-1",
      name: "Low Engagement Rescue",
      source: "media",
      category: "Retention & Churn Prevention",
      active: false,
      custom: false,
    },
    {
      id: "media-churn-prevention-2",
      name: "Lapsing Subscriber Winback",
      source: "media",
      category: "Retention & Churn Prevention",
      active: false,
      custom: false,
    },
  ],

  sports: [
    // Acquisition & Ticketing = 5
    { id: "sports-ticketing-1", name: "Season Ticket Acquisition", source: "sports", category: "Acquisition & Ticketing", active: true, custom: false },
    { id: "sports-ticketing-2", name: "Single Game Buyer Conversion", source: "sports", category: "Acquisition & Ticketing", active: true, custom: false },
    { id: "sports-ticketing-3", name: "Playoff Demand Journey", source: "sports", category: "Acquisition & Ticketing", active: true, custom: false },
    { id: "sports-ticketing-4", name: "Group Sales Journey", source: "sports", category: "Acquisition & Ticketing", active: true, custom: false },
    { id: "sports-ticketing-5", name: "Youth Package Journey", source: "sports", category: "Acquisition & Ticketing", active: true, custom: false },

    // Conversions = 4
    { id: "sports-conv-1", name: "Merch Checkout Journey", source: "sports", category: "Conversions", active: true, custom: false },
    { id: "sports-conv-2", name: "Premium Upgrade Journey", source: "sports", category: "Conversions", active: true, custom: false },
    { id: "sports-conv-3", name: "Group Offer Conversion", source: "sports", category: "Conversions", active: true, custom: false },
    { id: "sports-conv-4", name: "Hospitality Conversion", source: "sports", category: "Conversions", active: true, custom: false },

    // Engagements = 6 (5 active, 1 inactive to make total active = 21)
    { id: "sports-engage-1", name: "Fan Pulse Journey", source: "sports", category: "Engagements", active: true, custom: false },
    { id: "sports-engage-2", name: "Fantasy Engagement", source: "sports", category: "Engagements", active: true, custom: false },
    { id: "sports-engage-3", name: "Email Engagement Journey", source: "sports", category: "Engagements", active: true, custom: false },
    { id: "sports-engage-4", name: "App Engagement Journey", source: "sports", category: "Engagements", active: true, custom: false },
    { id: "sports-engage-5", name: "Content Fan Journey", source: "sports", category: "Engagements", active: true, custom: false },
    { id: "sports-engage-6", name: "Legacy Fan Reconnect", source: "sports", category: "Engagements", active: false, custom: false },

    // Loyalty & Commerce = 6 (one of them custom)
    { id: "sports-loyalty-1", name: "Loyalty Tier Upgrade", source: "sports", category: "Loyalty & Commerce", active: true, custom: false },
    { id: "sports-loyalty-2", name: "VIP Commerce Journey", source: "sports", category: "Loyalty & Commerce", active: true, custom: false },
    { id: "sports-loyalty-3", name: "Merch Loyalty Journey", source: "sports", category: "Loyalty & Commerce", active: true, custom: false },
    { id: "sports-loyalty-4", name: "Hospitality Loyalty Journey", source: "sports", category: "Loyalty & Commerce", active: true, custom: false },
    { id: "sports-loyalty-5", name: "Corporate Loyalty Journey", source: "sports", category: "Loyalty & Commerce", active: true, custom: false },
    { id: "sports-loyalty-6", name: "New Journey", source: "sports", category: "Loyalty & Commerce", active: true, custom: true },

    // Re-Engagement & Attendance Recovery = 2 inactive
    { id: "sports-recover-1", name: "Attendance Recovery Journey", source: "sports", category: "Re-Engagement & Attendance Recovery", active: false, custom: false },
    { id: "sports-recover-2", name: "Lapsed Buyer Recovery Journey", source: "sports", category: "Re-Engagement & Attendance Recovery", active: false, custom: false },

    // Real-Time Engagement = 1
    { id: "sports-realtime-1", name: "Real-Time Gameday Journey", source: "sports", category: "Real-Time Engagement", active: true, custom: false },

    // Retention & Renewals = 1 inactive
    { id: "sports-renewal-1", name: "Season Renewal Recovery", source: "sports", category: "Retention & Renewals", active: false, custom: false },
  ],


  telecom: [
    {
      id: "telecom-onboarding-1",
      name: "Customer Onboarding Journey",
      source: "telecom",
      category: "Customer Onboarding & Engagement",
      active: true,
      custom: false,
    },
    {
      id: "telecom-growth-1",
      name: "Growth Cross-Sell Journey",
      source: "telecom",
      category: "Growth & Cross-Sell",
      active: true,
      custom: false,
    },
    {
      id: "telecom-retention-1",
      name: "Service Recovery Journey",
      source: "telecom",
      category: "Retention & Service Recovery",
      active: false,
      custom: false,
    },
  ],


  automotive: [
    {
      id: "auto-battery-care-1",
      name: "Battery Care Journey",
      source: "automotive",
      category: "Battery Care",
      active: true,
      custom: false,
    },
    {
      id: "auto-maintenance-reminders-1",
      name: "Maintenance Reminder Journey",
      source: "automotive",
      category: "Maintenance Reminders",
      active: true,
      custom: false,
    },
    {
      id: "auto-maintenance-winback-1",
      name: "Maintenance Win-Back Journey",
      source: "automotive",
      category: "Maintenance Win-Back",
      active: true,
      custom: false,
    },
    {
      id: "auto-multivehicle-care-1",
      name: "Multi-Vehicle Care Journey",
      source: "automotive",
      category: "Multi-Vehicle Care",
      active: true,
      custom: false,
    },
    {
      id: "auto-premium-care-1",
      name: "Premium Care Journey",
      source: "automotive",
      category: "Premium Care",
      active: true,
      custom: false,
    },
    {
      id: "auto-tire-replacement-1",
      name: "Tire Replacement Journey",
      source: "automotive",
      category: "Tire Replacement",
      active: true,
      custom: false,
    },
  ],





};

const CATEGORY_ORDER_BY_SOURCE = {
  media: [
    "Conversion & Monetization",
    "Digital Engagement & Onboarding",
    "Retention & Renewals",
    "Engagements",
    "Retention & Churn Prevention",
  ],
  sports: [
    "Acquisition & Ticketing",
    "Conversions",
    "Engagements",
    "Loyalty & Commerce",
    "Re-Engagement & Attendance Recovery",
    "Real-Time Engagement",
    "Retention & Renewals",
  ],

  telecom: [
    "Customer Onboarding & Engagement",
    "Growth & Cross-Sell",
    "Retention & Service Recovery",
  ],

  automotive: [
    "Battery Care",
    "Maintenance Reminders",
    "Maintenance Win-Back",
    "Multi-Vehicle Care",
    "Premium Care",
    "Tire Replacement",
  ],


};

/* =========================================================
   FORMATTERS
========================================================= */
function getIcon(label) {
  return ICON_MAP[label] || "📌";
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function toPctValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num <= 1 ? num * 100 : num;
}

function formatPct(value, digits = 0) {
  const str = String(value ?? "");
  if (str.includes("%")) return str;
  return `${toPctValue(value).toFixed(digits)}%`;
}

function userDisplayName(user) {
  const explicit = user?.name || user?.fullName || user?.displayName;
  if (explicit) return explicit;

  const email = user?.email || "";
  if (!email.includes("@")) return "User";

  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/* =========================================================
   GENERIC HELPERS
========================================================= */
function normalizeSourceSystem(value, fallback = "media") {
  try {
    return normalizeSourceSystemShared(value, fallback);
  } catch {
    const raw = String(value || "").trim().toLowerCase();
    return ["all", "media", "sports", "telecom", "automotive"].includes(raw)
      ? raw
      : fallback;
  }
}

function getSelectedSourceSystem() {
  return normalizeSourceSystem(readSelectedSourceSystem?.() || "media", "media");
}

function sourceBasename(name) {
  return String(name || "").split(/[\\/]/).pop();
}

function getSourceSystemFromName(sourceName) {
  const basename = sourceBasename(sourceName);
  if (basename.startsWith("med_")) return "media";
  if (basename.startsWith("spt_")) return "sports";
  if (basename.startsWith("tel_")) return "telecom";
  if (basename.startsWith("aut_")) return "automotive";
  return "unknown";
}

function cleanDisplayName(displayName) {
  if (!displayName) return displayName;
  return String(displayName).replace(/^(Med|Spt|Tel|Aut|Auto)\s+/i, "");
}

async function safeFetchJson(url, fallback = null) {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    const text = await res.text();
    const safeText = text.replace(/\bNaN\b/g, "null");
    return JSON.parse(safeText);
  } catch {
    return fallback;
  }
}

/* =========================================================
   SIMPLE CAMPAIGN FALLBACKS FOR TELECOM / AUTOMOTIVE
========================================================= */
function buildFallbackJourneysForSource(sourceSystem) {
  const merged = [...(STATIC_JOURNEYS || []), ...(PRECONFIGURED_JOURNEYS || [])];

  return merged
    .map((journey, index) => ({
      id: journey.id || journey.slug || `fallback-${index}`,
      name: journey.name || journey.title || `Journey ${index + 1}`,
      active:
        journey.active === true ||
        journey.isActive === true ||
        String(journey.status || journey.run_status || "").toLowerCase() === "active" ||
        String(journey.status || journey.run_status || "").toLowerCase() === "production ready",
      custom: String(journey.name || "").trim().toLowerCase() === "new journey",
      source:
        normalizeSourceSystem(
          journey.source_system ||
          journey.sourceSystem ||
          journey.categoryId ||
          journey.category_id ||
          sourceSystem,
          sourceSystem
        ),
      category:
        journey.subCategoryName ||
        journey.categoryName ||
        journey.sectionName ||
        "General",
    }))
    .filter((journey) => {
      if (sourceSystem === "all") return true;
      return journey.source === sourceSystem;
    });
}

/* =========================================================
   SEGMENT HELPERS
========================================================= */
function segmentSourceSystem(segment, fallbackSource) {
  return normalizeSourceSystem(
    segment?.source_system || segment?.sourceSystem || segment?.categoryId || fallbackSource,
    fallbackSource || "media"
  );
}

function resolveSegmentActivationStatus(segment) {
  const raw = segment?._pipelineStatus || segment?.status || segment?.pipeline_status;
  const status = normalizeStatus(raw);

  if (segment?._custom && segment?._status === "active" && !JOURNEY_READY_STATUSES.includes(status)) {
    return "Ready for activation";
  }

  if (status) return status;

  const coverage = Number(segment?.coverage_pct ?? segment?.coveragePct ?? segment?._coverage ?? 0);
  const count = Number(segment?.count ?? segment?._count ?? 0);

  if (count <= 0) return "Needs review";
  if (coverage >= 30) return "Production ready";
  return "Ready for activation";
}

function dedupeSegments(items) {
  const map = new Map();
  (items || []).forEach((segment) => {
    const key = segment?.segment_id || segment?.id || segment?.name;
    if (!key) return;
    if (!map.has(key)) map.set(key, segment);
  });
  return [...map.values()];
}

/* =========================================================
   MEASUREMENT HELPERS
========================================================= */
function extractMeasurementListing(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      summary: {},
      campaigns: [],
      trend: [],
      distribution: [],
      channel_mix: {},
      funnel: null,
      submission: null,
    };
  }

  return {
    summary: raw.summary || {},
    campaigns: Array.isArray(raw?.campaigns?.data) ? raw.campaigns.data : [],
    trend: Array.isArray(raw?.trend) ? raw.trend : [],
    distribution: Array.isArray(raw?.distribution) ? raw.distribution : [],
    channel_mix: raw?.channel_mix || {},
    funnel: raw?.funnel || null,
    submission: raw?.submission || null,
  };
}

function campaignMatchesSource(campaign, sourceSystem) {
  if (sourceSystem === "all") return true;

  const values = [
    campaign?.source_system,
    campaign?.sourceSystem,
    campaign?.categoryId,
    campaign?.category_id,
    campaign?.vertical,
    campaign?.industry,
    campaign?.clientTag,
  ]
    .filter(Boolean)
    .map((item) => String(item).trim().toLowerCase());

  if (values.includes(sourceSystem)) return true;

  if (sourceSystem === "media" && values.some((v) => v.includes("media") || v.includes("ott"))) return true;
  if (sourceSystem === "sports" && values.some((v) => v.includes("sports") || v.includes("nfl"))) return true;
  if (sourceSystem === "telecom" && values.some((v) => v.includes("telecom") || v.startsWith("tel_"))) return true;
  if (sourceSystem === "automotive" && values.some((v) => v.includes("automotive") || v.startsWith("aut_"))) return true;

  return values.length === 0;
}

/* =========================================================
   UI COMPONENTS
========================================================= */

function MuiIcon({ d, size = 18, style: extraStyle = {} }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: size, height: size, flexShrink: 0, display: "block", ...extraStyle }}
    >
      <path d={d} />
    </svg>
  );
}

const MUI_ICONS = {
  campaigns:  "M4 6h6v4H4V6zm10 0h6v4h-6V6zM4 14h6v4H4v-4zm10 0h6v4h-6v-4z",
  journeys:   "M13 10V3L4 14h7v7l9-11h-7z",
  segments:   "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  ready:      "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  sources:    "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  records:    "M4 16.5l8 4.5 8-4.5M4 12l8 4.5L20 12M4 7.5L12 12 20 7.5 12 3 4 7.5z",
  email:      "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  open:       "M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5",
  click:      "M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5",
  bounce:     "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  measurement:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
};

const CATEGORY_COLORS = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#06b6d4","#ef4444","#14b8a6","#f97316"];

const STATUS_CONFIG = {
  "Production ready":     { color: "#10b981", bg: "rgba(16,185,129,0.12)",  label: "Production Ready"     },
  "Ready for activation": { color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  label: "Ready for Activation" },
  "In QA review":         { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "In QA"                },
  "Needs review":         { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Needs Review"         },
  Draft:                  { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)",  label: "Draft"                },
};

// Normalise raw API status strings to STATUS_CONFIG keys
function normalizeStatus(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "ready" || s === "ready for activation" || s === "activation_ready") return "Ready for activation";
  if (s === "production ready" || s === "production_ready" || s === "active" || s === "live") return "Production ready";
  if (s === "in qa review" || s === "in_qa" || s === "qa_review" || s === "in qa") return "In QA review";
  if (s === "needs review" || s === "needs_review" || s === "review") return "Needs review";
  if (s === "draft" || s === "inactive" || s === "pending") return "Draft";
  return raw; // pass through if already a known key or unknown value
}

function StatusChip({ status }) {
  const cfg = STATUS_CONFIG[normalizeStatus(status)] || { color: "var(--text-muted)", bg: "var(--bg-secondary)", label: status || "Unknown" };
  return (
    <span className="ov2-status-chip" style={{ "--sc": cfg.color, "--sc-bg": cfg.bg }}>
      {cfg.label}
    </span>
  );
}

function PanelHeader({ title, subtitle, to, linkLabel = "View all" }) {
  return (
    <div className="ov2-panel-head">
      <div>
        <h3 className="ov2-panel-title">{title}</h3>
        {subtitle && <p className="ov2-panel-sub">{subtitle}</p>}
      </div>
      <Link to={to} className="ov2-link-btn">{linkLabel} →</Link>
    </div>
  );
}

function KpiCard({ icon, label, value, color, to }) {
  return (
    <Link to={to} className={`ov2-kpi-card ov2-kpi-${color}`}>
      <div className="ov2-kpi-icon-wrap">
        <MuiIcon d={MUI_ICONS[icon]} size={20} />
      </div>
      <div className="ov2-kpi-body">
        <strong className="ov2-kpi-value">{value}</strong>
        <span className="ov2-kpi-label">{label}</span>
      </div>
    </Link>
  );
}

function Divider({ label }) {
  return <div className="ov2-divider-label">{label}</div>;
}

function EmptyState({ text }) {
  return <div className="ov2-empty">{text}</div>;
}

function Spinner() {
  return (
    <div className="ov2-spinner">
      <div className="ov2-spinner-ring" />
      <span>Loading…</span>
    </div>
  );
}

function Donut({ value, sublabel }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * circumference;

  return (
    <div className="ov2-donut-wrap">
      <div className="ov2-donut-ring-container">
        <svg viewBox="0 0 120 120" className="ov2-donut-svg">
          <circle cx="60" cy="60" r={radius} className="ov2-donut-track" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            className="ov2-donut-arc"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={circumference / 4}
          />
        </svg>
        <div className="ov2-donut-center">
          <strong>{pct}%</strong>
          <span>pass rate</span>
        </div>
      </div>
      <p className="ov2-donut-sub">{sublabel}</p>
      <div className="ov2-donut-legend">
        <span className="ov2-donut-leg ov2-donut-leg-pass"><i />{pct}% Passing</span>
        <span className="ov2-donut-leg ov2-donut-leg-rem"><i />{100 - pct}% Pending</span>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */
export default function Overview() {
  const { user } = useAuth();
  const userName = userDisplayName(user);

  const [sourceSystem, setSourceSystem] = useState(getSelectedSourceSystem());
  const [loading, setLoading] = useState(true);

  const [sources, setSources] = useState([]);
  const [classification, setClassification] = useState({});
  const [measurementListing, setMeasurementListing] = useState({
    summary: {},
    campaigns: [],
    trend: [],
    distribution: [],
    channel_mix: {},
    funnel: null,
    submission: null,
  });
  const [prebuiltSegments, setPrebuiltSegments] = useState([]);
  const [aiSegments, setAiSegments] = useState([]);
  const [customSegments, setCustomSegments] = useState([]);
  const [clusterTotal, setClusterTotal] = useState(0);
  const [measTimeline, setMeasTimeline] = useState("last_month");
  const [measChannel, setMeasChannel] = useState("emails_sent");

  /* =========================================================
     SOURCE SYSTEM SYNC
  ========================================================= */
  useEffect(() => {
    const syncSource = () => {
      setSourceSystem(getSelectedSourceSystem());
    };

    window.addEventListener("focus", syncSource);
    window.addEventListener("storage", syncSource);
    window.addEventListener("cdp-source-system-change", syncSource);

    return () => {
      window.removeEventListener("focus", syncSource);
      window.removeEventListener("storage", syncSource);
      window.removeEventListener("cdp-source-system-change", syncSource);
    };
  }, []);

  /* =========================================================
     LOCAL CUSTOM SEGMENTS
  ========================================================= */
  useEffect(() => {
    const readCustomSegments = () => {
      try {
        const raw = JSON.parse(localStorage.getItem("cdp_custom_segments") || "[]");
        setCustomSegments(Array.isArray(raw) ? raw : []);
      } catch {
        setCustomSegments([]);
      }
    };

    readCustomSegments();
    window.addEventListener("storage", readCustomSegments);
    window.addEventListener("focus", readCustomSegments);

    return () => {
      window.removeEventListener("storage", readCustomSegments);
      window.removeEventListener("focus", readCustomSegments);
    };
  }, []);

  /* =========================================================
     FETCH PAGE DATA
  ========================================================= */
  useEffect(() => {
    let active = true;

    async function loadAll() {
      setLoading(true);

      const clusterSource = sourceSystem === "all" ? "media" : sourceSystem;
      const [fetchedSources, cls, segmentResponse, aiSegmentResponse, measurementResponse, clusterResponse] =
        await Promise.all([
          api.getSources().catch(() => []),
          safeFetchJson(CLASSIFICATION_ENDPOINT, { classification: {} }),
          safeFetchJson(
            `${SEGMENTS_ENDPOINT}?source=${encodeURIComponent(sourceSystem)}`,
            { segments: [], total_records: 0 }
          ),
          safeFetchJson(SEGMENT_LIST_ENDPOINT, { segments: [] }),
          safeFetchJson(MEASUREMENT_LISTING_ENDPOINT, {
            summary: {},
            campaigns: { data: [] },
            trend: [],
            distribution: [],
            channel_mix: {},
            funnel: null,
            submission: null,
          }),
          safeFetchJson(`/api/clusters?search=&source=${encodeURIComponent(clusterSource)}&page=1&limit=1`, { total: 0 }),
        ]);

      if (!active) return;

      setSources(Array.isArray(fetchedSources) ? fetchedSources : []);
      setClassification(cls?.classification || {});
      setPrebuiltSegments(Array.isArray(segmentResponse?.segments) ? segmentResponse.segments : []);
      setAiSegments(Array.isArray(aiSegmentResponse?.segments) ? aiSegmentResponse.segments : []);
      setMeasurementListing(extractMeasurementListing(measurementResponse));
      setClusterTotal(Number(clusterResponse?.total) || 0);

      setLoading(false);
    }

    loadAll();

    return () => {
      active = false;
    };
  }, [sourceSystem]);

  /* =========================================================
     DATA SOURCES CALCULATIONS
  ========================================================= */
  const partyOf = (sourceName) => classification[sourceName]?.party || "1P";

  const filteredSources = useMemo(() => {
    return (sources || []).filter((src) => {
      if (sourceSystem === "all") return true;
      return getSourceSystemFromName(src?.name) === sourceSystem;
    });
  }, [sources, sourceSystem]);

  const firstPartySources = useMemo(() => {
    const firstParty = filteredSources.filter(
      (src) => !classification[src.name] || classification[src.name]?.party === "1P"
    );

    const map = new Map();
    firstParty.forEach((src) => {
      const key = sourceBasename(src.name);
      if (!map.has(key)) map.set(key, src);
    });

    return [...map.values()];
  }, [filteredSources, classification]);

  const secondPartyCount = useMemo(
    () => filteredSources.filter((src) => partyOf(src.name) === "2P").length,
    [filteredSources, classification]
  );

  const thirdPartyCount = useMemo(
    () => filteredSources.filter((src) => partyOf(src.name) === "3P").length,
    [filteredSources, classification]
  );

  const totalRecords = useMemo(
    () => firstPartySources.reduce((sum, src) => sum + Number(src.rows || 0), 0),
    [firstPartySources]
  );

  // Unique customers = ID graph cluster count (each cluster = one resolved identity)
  const uniqueCustomers = clusterTotal;

  const mlModelCount = ML_MODEL_COUNT_BY_SOURCE[sourceSystem] ?? ML_MODEL_COUNT_BY_SOURCE.media;

  const topSources = useMemo(() => {
    return [...firstPartySources]
      .sort((a, b) => Number(b.rows || 0) - Number(a.rows || 0))
      .slice(0, 4)
      .map((src) => ({
        name: cleanDisplayName(src.display_name || src.name),
        rows: Number(src.rows || 0),
        columns: Array.isArray(src.columns) ? src.columns.length : 0,
        party: classification[src.name]?.party || "1P",
      }));
  }, [firstPartySources, classification]);

  const maxSourceRows = topSources.reduce((max, src) => Math.max(max, src.rows), 0) || 1;

  const partyAccent = (party) =>
    party === "2P"
      ? "#3b82f6"
      : party === "3P"
        ? "#f59e0b"
        : party === "ML"
          ? "#a78bfa"
          : "#10b981";

  /* =========================================================
     CAMPAIGN ACTIVITY - FIXED / BLUEPRINT CONTROLLED
  ========================================================= */
  const useBlueprintCampaignData = sourceSystem === "media" || sourceSystem === "sports" || sourceSystem === "telecom" || sourceSystem === "automotive";

  const campaignJourneys = useMemo(() => {
    if (useBlueprintCampaignData) {
      return getBlueprintJourneysForSource(sourceSystem);
    }
    return buildFallbackJourneysForSource(sourceSystem);
  }, [sourceSystem, useBlueprintCampaignData]);

  const journeyOverviewStats = useMemo(() => {
    const total = campaignJourneys.length;
    const active = campaignJourneys.filter((j) => j.active).length;
    const inactive = total - active;
    const custom = campaignJourneys.filter((j) => j.custom).length;
    const preset = total - custom;
    const upcoming = campaignJourneys.filter((j) => j.scheduled || j.upcoming || j.status === "scheduled").length
      || Math.round(inactive * 0.3) || 0;

    return {
      total,
      active,
      inactive,
      preset,
      custom,
      upcoming,
    };
  }, [campaignJourneys]);

  // Real journey counts from the same source as CampaignManager
  const realJourneyStats = useMemo(() => {
    const all = getAllJourneys().filter(j => sourceSystem === "all" || j.source_system === sourceSystem);
    const total = all.length;
    const active = all.filter(j => j.status === "Active").length;
    const upcoming = all.filter(j => j.status === "Scheduled").length;
    return { total, active, upcoming };
  }, [sourceSystem]);

  const campaignMixRows = useMemo(
    () => [
      { label: "Active",    value: journeyOverviewStats.active,    color: "#22c55e" },
      { label: "Upcoming",  value: journeyOverviewStats.upcoming,  color: "#3b82f6" },
      { label: "Inactive",  value: journeyOverviewStats.inactive,  color: "#f59e0b" },
      { label: "Prebuilt",  value: journeyOverviewStats.preset,    color: "#14b8a6" },
      { label: "Custom",    value: journeyOverviewStats.custom,    color: "#8b5cf6" },
    ],
    [journeyOverviewStats]
  );

  const campaignSectionCards = useMemo(() => {
    const grouped = {};
    campaignJourneys.forEach((journey) => {
      if (!grouped[journey.category]) {
        grouped[journey.category] = { total: 0, active: 0 };
      }
      grouped[journey.category].total += 1;
      if (journey.active) grouped[journey.category].active += 1;
    });

    const preferredOrder =
      CATEGORY_ORDER_BY_SOURCE[sourceSystem] || Object.keys(grouped);

    const max = Math.max(
      ...Object.values(grouped).map((value) => value.total),
      1
    );

    return preferredOrder
      .filter((category) => grouped[category] && grouped[category].total > 0)
      .map((category) => {
        const item = grouped[category];
        return {
          key: category,
          label: category,
          total: item.total,
          active: item.active,
          activePct: item.total ? Math.round((item.active / item.total) * 100) : 0,
          sharePct: (item.total / max) * 100,
        };
      });
  }, [campaignJourneys, sourceSystem]);

  // Recent campaigns — last 5 added (by index, descending), any status
  const recentCampaigns = useMemo(() => {
    const list = campaignJourneys.length > 0 ? campaignJourneys : PRECONFIGURED_JOURNEYS.map((j, i) => ({
      id: j.slug || i,
      name: j.name,
      active: j.active !== false,
      category: j.subCategoryName || j.categoryName || "General",
      status: j.status || (j.active !== false ? "Active" : "Inactive"),
    }));
    return [...list].reverse().slice(0, 5);
  }, [campaignJourneys]);

  // Top journeys by open rate — sorted descending, top 5
  const highlyCampaigns = useMemo(() => {
    const all = getAllJourneys().filter(j => sourceSystem === "all" || j.source_system === sourceSystem);
    return [...all]
      .sort((a, b) => (b.analytics?.open_rate || 0) - (a.analytics?.open_rate || 0))
      .slice(0, 5)
      .map(j => ({ id: j.id, name: j.name, openRate: j.analytics?.open_rate || 0 }));
  }, [sourceSystem]);

  const maxHighlyCampaignIdx = highlyCampaigns.length;

  const selectedJourneys = campaignJourneys;
  const qaReady = campaignJourneys.length > 0 || !loading;

  /* =========================================================
     SEGMENTS CALCULATIONS
  ========================================================= */
  const selectedAiSegments = useMemo(() => {
    return (aiSegments || [])
      .map((seg) => ({
        ...seg,
        id: seg.id || seg.segment_id,
        _ai: true,
        _custom: true,
        _status: seg._status || "inactive",
        _count: seg.count || seg._count || 0,
        _coverage: seg.coverage_pct || seg._coverage || 0,
        _refresh: seg._refresh || "Daily",
        _pipelineStatus: seg._pipelineStatus || "Draft",
      }))
      .filter((seg) => {
        if (sourceSystem === "all") return true;
        return segmentSourceSystem(seg, sourceSystem) === sourceSystem;
      });
  }, [aiSegments, sourceSystem]);

  const selectedCustomSegments = useMemo(() => {
    return (customSegments || []).filter((seg) => {
      if (sourceSystem === "all") return true;
      return segmentSourceSystem(seg, sourceSystem) === sourceSystem;
    });
  }, [customSegments, sourceSystem]);

  const selectedPrebuiltSegments = useMemo(() => {
    return (prebuiltSegments || []).filter((seg) => {
      if (sourceSystem === "all") return true;
      return segmentSourceSystem(seg, sourceSystem) === sourceSystem;
    });
  }, [prebuiltSegments, sourceSystem]);

  const allSegments = useMemo(() => {
    const merged = dedupeSegments([
      ...selectedAiSegments,
      ...selectedCustomSegments,
      ...selectedPrebuiltSegments,
    ]);

    if (merged.length > 0) return merged;

    return (SEGMENT_LIBRARY || []).filter((seg) => {
      if (sourceSystem === "all") return true;
      const segSource = normalizeSourceSystem(
        seg?.source_system || seg?.categoryId || sourceSystem,
        sourceSystem
      );
      return segSource === sourceSystem;
    });
  }, [selectedAiSegments, selectedCustomSegments, selectedPrebuiltSegments, sourceSystem]);

  const segmentTotal = allSegments.length;

  const segmentStatusRows = useMemo(() => {
    const statusCounts = allSegments.reduce((acc, seg) => {
      const status = resolveSegmentActivationStatus(seg);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return [
      { label: "Production ready", value: statusCounts["Production ready"] || 0, color: "#10b981" },
      { label: "Ready for activation", value: statusCounts["Ready for activation"] || 0, color: "#3b82f6" },
      { label: "In QA review", value: statusCounts["In QA review"] || 0, color: "#f59e0b" },
      { label: "Needs review", value: statusCounts["Needs review"] || 0, color: "#ef4444" },
      { label: "Draft", value: statusCounts["Draft"] || 0, color: "#8b5cf6" },
    ];
  }, [allSegments]);

  const productionReadySegments =
    segmentStatusRows.find((row) => row.label === "Production ready")?.value || 0;

  const readyForActivation =
    segmentStatusRows.find((row) => row.label === "Ready for activation")?.value || 0;

  /* =========================================================
     QA HEALTH
  ========================================================= */
  const qaPassRate = useMemo(() => {
    if (!qaReady) return 0;
    return selectedJourneys.length
      ? Math.round((journeyOverviewStats.active / selectedJourneys.length) * 100)
      : 0;
  }, [qaReady, selectedJourneys, journeyOverviewStats]);

  const qaSuiteCount = TEST_SUITES.length;

  /* =========================================================
     JOURNEY MEASUREMENTS CALCULATIONS
  ========================================================= */
  const filteredMeasurementCampaigns = useMemo(() => {
    const campaigns = measurementListing?.campaigns || [];
    if (!campaigns.length) return [];
    return campaigns.filter((campaign) => campaignMatchesSource(campaign, sourceSystem));
  }, [measurementListing, sourceSystem]);

  const measurementSummary = useMemo(() => {
    const summary = measurementListing?.summary || {};

    return {
      totalCampaigns:
        Number(filteredMeasurementCampaigns.length) ||
        Number(summary?.total_campaigns) ||
        0,
      emailSent: Number(summary?.Email_sent || 0),
      emailDelivered: Number(summary?.Email_delivered || 0),
      openRate: summary?.Email_open_rate || "0%",
      clickRate: summary?.Email_Click_percentage || "0%",
      bounceRate: summary?.Email_Bounce_rate || "0%",
      unsubscribedRate: summary?.Emails_unsubscribed_rate || "0%",
    };
  }, [measurementListing, filteredMeasurementCampaigns]);

  const topMeasured = useMemo(() => {
    const campaigns = filteredMeasurementCampaigns || [];

    if (campaigns.length > 0) {
      return [...campaigns]
        .sort((left, right) => Number(right["Email sent"] || 0) - Number(left["Email sent"] || 0))
        .slice(0, 4)
        .map((campaign, index) => ({
          id: campaign["Campaign id"] || `campaign-${index}`,
          name: campaign["Campaign Name"] || campaign["Campaign id"] || `Campaign ${index + 1}`,
          status: campaign.status || campaign.Status || "Draft",
          sent: Number(campaign["Email sent"] || 0),
          delivered: Number(campaign["Email delivered"] || 0),
          openRate: campaign["Email_open_rate"] || "0",
          clickRate: campaign["Email_click_rate"] || "0",
          unsubscribedRate: campaign["Email_unsubscribed_rate"] || "0",
        }));
    }

    return STATIC_JOURNEY_MEASUREMENTS.map((measurement, index) => {
      const journey = STATIC_JOURNEYS.find((item) => item.id === measurement.journey_id);
      const entries = Number(measurement.entries || 0);
      const completions = Number(measurement.completions || 0);

      return {
        id: measurement.journey_id || `journey-${index}`,
        name: journey?.name || measurement.journey_id,
        status: "Live",
        sent: entries,
        delivered: entries,
        openRate: entries ? Math.round((completions / entries) * 100) : 0,
        clickRate: 0,
        unsubscribedRate: 0,
      };
    }).slice(0, 4);
  }, [filteredMeasurementCampaigns]);

  /* =========================================================
     MEASUREMENT — TIMELINE + CARD SELECTION
  ========================================================= */
  const MEAS_TIMELINE_OPTIONS = [
    { value: "last_week",    label: "Last Week"    },
    { value: "last_month",   label: "Last Month"   },
    { value: "last_3months", label: "Last 3 Months"},
    { value: "last_6months", label: "Last 6 Months"},
    { value: "last_year",    label: "Last Year"    },
  ];

  const TIMELINE_SCALE = {
    last_week: 0.25, last_month: 1, last_3months: 3, last_6months: 6, last_year: 12,
  };

  // Per-campaign base numbers (stable, small, realistic)
  // Each row: [emailSent, smsSent, pushSent, whatsappSent, openRate%, clickRate%, bounceRate%]
  const CAMP_DATA = [
    [4200, 1800, 2600, 1200, 31.2, 6.8, 1.4],
    [3800, 1600, 2200, 1000, 44.1, 9.8, 0.8],
    [3100, 1300, 1900,  820, 22.7, 4.5, 3.2],
    [2700, 1100, 1600,  720, 38.7, 8.3, 1.1],
    [2400,  980, 1400,  640, 26.3, 5.9, 2.4],
    [2100,  880, 1250,  560, 19.4, 3.7, 4.6],
    [1900,  790, 1100,  500, 33.1, 7.1, 1.8],
    [1700,  700,  980,  440, 28.9, 6.2, 2.1],
    [1500,  620,  860,  390, 42.8,12.4, 0.6],
    [1300,  540,  760,  340, 24.1, 5.2, 3.9],
  ];

  // Build pool: match campaign names from campaignJourneys to CAMP_DATA rows
  const campaignPool = useMemo(() => {
    const pool = campaignJourneys.length >= 8
      ? campaignJourneys
      : [...campaignJourneys, ...topMeasured.map(r => ({ id: r.id, name: r.name }))];
    return pool.slice(0, CAMP_DATA.length).map((j, i) => ({
      id: j.id || `c-${i}`,
      name: j.name,
      emailSent:    CAMP_DATA[i][0],
      smsSent:      CAMP_DATA[i][1],
      pushSent:     CAMP_DATA[i][2],
      whatsappSent: CAMP_DATA[i][3],
      openRate:     CAMP_DATA[i][4],
      clickRate:    CAMP_DATA[i][5],
      bounceRate:   CAMP_DATA[i][6],
    }));
  }, [campaignJourneys, topMeasured]);

  // Card totals = sum of all campaigns (so card number = sum of list rows)
  const measCards = useMemo(() => {
    const scale = TIMELINE_SCALE[measTimeline] ?? 1;
    const base = measurementSummary;
    const campEmailTotal = campaignPool.reduce((s, r) => s + r.emailSent, 0);
    const totalEmail    = Math.round((base.emailSent > 0 ? base.emailSent : campEmailTotal) * scale);
    const totalSms      = Math.round(campaignPool.reduce((s, r) => s + r.smsSent, 0)      * scale);
    const totalPush     = Math.round(campaignPool.reduce((s, r) => s + r.pushSent, 0)     * scale);
    const totalWhatsapp = Math.round(campaignPool.reduce((s, r) => s + r.whatsappSent, 0) * scale);
    const avgOpen   = base.openRate   ?? (campaignPool.reduce((s, r) => s + r.openRate,   0) / campaignPool.length).toFixed(1) + "%";
    const avgClick  = base.clickRate  ?? (campaignPool.reduce((s, r) => s + r.clickRate,  0) / campaignPool.length).toFixed(1) + "%";
    const avgBounce = base.bounceRate ?? (campaignPool.reduce((s, r) => s + r.bounceRate, 0) / campaignPool.length).toFixed(1) + "%";
    return [
      { id: "emails_sent", label: "Emails Sent",  value: formatNumber(totalEmail),    color: "#3b82f6", icon: MUI_ICONS.email    },
      { id: "open_rate",   label: "Open Rate",    value: avgOpen,                     color: "#06b6d4", icon: MUI_ICONS.open     },
      { id: "click_rate",  label: "Click Rate",   value: avgClick,                    color: "#f59e0b", icon: MUI_ICONS.click    },
      { id: "bounce_rate", label: "Bounce Rate",  value: avgBounce,                   color: "#ef4444", icon: MUI_ICONS.bounce   },
      { id: "email",       label: "Email",         value: formatNumber(totalEmail),    color: "#6366f1", icon: MUI_ICONS.email    },
      { id: "sms",         label: "SMS",           value: formatNumber(totalSms),      color: "#10b981", icon: MUI_ICONS.records  },
      { id: "push",        label: "Push",          value: formatNumber(totalPush),     color: "#f59e0b", icon: MUI_ICONS.journeys },
      { id: "whatsapp",    label: "WhatsApp",      value: formatNumber(totalWhatsapp), color: "#22c55e", icon: MUI_ICONS.segments },
    ];
  }, [measTimeline, measurementSummary, campaignPool]);

  const selectedMeasCard = measCards.find((c) => c.id === measChannel) ?? measCards[0];

  const channelTopJourneys = useMemo(() => {
    const scale = TIMELINE_SCALE[measTimeline] ?? 1;
    const sentKey = { email: "emailSent", emails_sent: "emailSent", sms: "smsSent", push: "pushSent", whatsapp: "whatsappSent" }[measChannel] ?? "emailSent";

    // Sort by the selected metric
    const sorted = [...campaignPool].sort((a, b) => {
      if (measChannel === "open_rate")   return b.openRate   - a.openRate;
      if (measChannel === "click_rate")  return b.clickRate  - a.clickRate;
      if (measChannel === "bounce_rate") return a.bounceRate - b.bounceRate;
      return b[sentKey] - a[sentKey];
    });

    return sorted.slice(0, 5).map((row) => ({
      id: row.id,
      name: row.name,
      sent:       Math.round(row[sentKey]         * scale),
      delivered:  Math.round(row[sentKey] * 0.97  * scale),
      openRate:   row.openRate,
      clickRate:  row.clickRate,
      bounceRate: row.bounceRate,
    }));
  }, [measTimeline, measChannel, campaignPool]);

  /* =========================================================
     DATA SOURCE KPI BLOCK
  ========================================================= */
  const dataSourceStats = useMemo(() => {
    return [
      { label: "1st Party Sources", value: firstPartySources.length, color: "#10b981" },
      { label: "Total Records",     value: totalRecords,             color: "#0fb8b8" },
      { label: "Unique Customers",  value: uniqueCustomers,          color: "#2680eb" },
      { label: "ML Models",         value: mlModelCount,             color: "#a78bfa" },
      { label: "2nd Party Sources", value: secondPartyCount,         color: "#3b82f6" },
      { label: "3rd Party Sources", value: thirdPartyCount,          color: "#f59e0b" },
    ];
  }, [firstPartySources.length, totalRecords, clusterTotal, mlModelCount, secondPartyCount, thirdPartyCount]);

  /* =========================================================
     AUDIENCE & SEGMENTS — RECENT + HIGHLY USED
  ========================================================= */
  function parseSize(sizeStr) {
    if (!sizeStr) return 0;
    const s = String(sizeStr).replace(/,/g, "").trim().toUpperCase();
    if (s.endsWith("K")) return parseFloat(s) * 1000;
    if (s.endsWith("M")) return parseFloat(s) * 1000000;
    return parseFloat(s) || 0;
  }

  const recentSegments = useMemo(
    () => [...allSegments].slice(-5).reverse(),
    [allSegments]
  );

  const highlyUsedSegments = useMemo(
    () =>
      [...allSegments]
        .sort((a, b) => {
          const aScore =
            parseSize(a.size) ||
            Number(a.coverage_pct || a._coverage || 0) * 10000 +
            Number(a.count || a._count || 0);
          const bScore =
            parseSize(b.size) ||
            Number(b.coverage_pct || b._coverage || 0) * 10000 +
            Number(b.count || b._count || 0);
          return bScore - aScore;
        })
        .slice(0, 5),
    [allSegments]
  );

  const maxSegSize = useMemo(
    () => Math.max(1, ...highlyUsedSegments.map((s) => parseSize(s.size) || 1)),
    [highlyUsedSegments]
  );

  return (
    <div className="ov2-page">
      {/* Hero */}
      <div className="ov2-hero">
        <h1 className="ov2-hero-h1">Welcome back, {userName}</h1>
      </div>

      {/* AI Banner */}
      <Link to="/autopilot" style={{ textDecoration: "none", display: "block", margin: "0 0 18px" }}>
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)",
          border: "1px solid #3730a3",
          borderRadius: 16,
          padding: "20px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -40, right: 120, width: 200, height: 200, borderRadius: "50%", background: "rgba(99,102,241,0.08)", pointerEvents: "none" }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ background: "rgba(99,102,241,0.15)", border: "1px solid #4f46e5", borderRadius: 999, padding: "2px 10px", fontSize: 10, fontWeight: 700, color: "#a5b4fc", letterSpacing: 0.5 }}>Agentic</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#e0e7ff", margin: 0 }}>Build a journey with AI</h2>
            </div>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 14px", lineHeight: 1.55 }}>
              Describe your campaign goal in one line. Autopilot designs the whole blueprint end to end — the target audience, the cross-channel journey flow and config, quality checks, measurement, and optimization recommendations. It asks a couple of quick questions if it needs them.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Audience", "Journey flow", "QA", "Measurement", "Optimization"].map((tag) => (
                <span key={tag} style={{ background: "rgba(30,27,75,0.8)", border: "1px solid #3730a3", borderRadius: 999, padding: "3px 12px", fontSize: 11, fontWeight: 700, color: "#a5b4fc" }}>{tag}</span>
              ))}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#4f46e5", color: "#fff", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              Launch Autopilot →
            </div>
          </div>
        </div>
      </Link>

      {/* KPI Strip + Body — all gated behind loader */}
      {loading ? <Spinner /> : <><div className="ov2-section-heading">Overview</div><div className="ov2-kpi-strip">
        {/* Journeys group */}
        <Link to="/campaigns-and-journeys" className="ov2-kpi-group">
          <span className="ov2-kpi-group__label">Journeys</span>
          <div className="ov2-kpi-group__strip">
            <div className="ov2-kpi-mini ov2-kpi-indigo">
              <strong className="ov2-kpi-value">{formatNumber(realJourneyStats.total)}</strong>
              <span className="ov2-kpi-label">Total Journeys</span>
            </div>
            <div className="ov2-kpi-mini ov2-kpi-blue">
              <strong className="ov2-kpi-value">{formatNumber(realJourneyStats.active)}</strong>
              <span className="ov2-kpi-label">Active Journeys</span>
            </div>
            <div className="ov2-kpi-mini ov2-kpi-green">
              <strong className="ov2-kpi-value">{formatNumber(realJourneyStats.upcoming)}</strong>
              <span className="ov2-kpi-label">Upcoming Journeys</span>
            </div>
          </div>
        </Link>

        {/* Segments group */}
        <Link to="/segmentation" className="ov2-kpi-group">
          <span className="ov2-kpi-group__label">Segments</span>
          <div className="ov2-kpi-group__strip">
            <div className="ov2-kpi-mini ov2-kpi-teal">
              <strong className="ov2-kpi-value">{formatNumber(segmentTotal)}</strong>
              <span className="ov2-kpi-label">Total Segments</span>
            </div>
            <div className="ov2-kpi-mini ov2-kpi-orange">
              <strong className="ov2-kpi-value">{formatNumber(
                allSegments.filter(s => (s.status || '').toLowerCase().includes('draft') || (s._pipelineStatus || '').toLowerCase().includes('draft')).length
              )}</strong>
              <span className="ov2-kpi-label">Draft Segments</span>
            </div>
          </div>
        </Link>

        {/* Data Sources group */}
        <Link to="/data-overview" className="ov2-kpi-group">
          <span className="ov2-kpi-group__label">Data Sources</span>
          <div className="ov2-kpi-group__strip">
            <div className="ov2-kpi-mini ov2-kpi-purple">
              <strong className="ov2-kpi-value">{formatNumber(firstPartySources.length)}</strong>
              <span className="ov2-kpi-label">Total Data Sources</span>
            </div>
            <div className="ov2-kpi-mini ov2-kpi-blue">
              <strong className="ov2-kpi-value">{formatNumber(totalRecords)}</strong>
              <span className="ov2-kpi-label">Total Records</span>
            </div>
            <div className="ov2-kpi-mini ov2-kpi-cyan">
              <strong className="ov2-kpi-value">{formatNumber(uniqueCustomers)}</strong>
              <span className="ov2-kpi-label">Unique Customers</span>
            </div>
          </div>
        </Link>
      </div>

      <div className="ov2-body">

          <div className="ov2-section-heading">Journey &amp; Audience</div>
          {/* ── Row 1: Campaign Activity | Audience & Segments ── */}
          <div className="ov2-row ov2-row-main">

            {/* Campaign Activity */}
            <div className="ov2-card">
              <PanelHeader title="Journey Activity" subtitle={`Journey catalogue · ${SOURCE_LABELS[sourceSystem]}`} to="/campaigns-and-journeys" />

              {/* Summary block — mirrors Audience & Segments */}
              <div className="ov2-seg-summary">
                <div className="ov2-seg-total-block">
                  <strong>{formatNumber(realJourneyStats.total)}</strong>
                  <span>Total Journeys</span>
                </div>
                <div className="ov2-seg-status-rows">
                  {campaignMixRows.map((row) => (
                    <div key={row.label} className="ov2-seg-status-item">
                      <span className="ov2-seg-dot" style={{ background: row.color }} />
                      <span className="ov2-seg-status-lbl">{row.label}</span>
                      <strong className="ov2-seg-status-val">{formatNumber(row.value)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Journeys */}
              <Divider label="Recent Journeys" />
              <div className="ov2-seg-list">
                {recentCampaigns.length > 0 ? (
                  recentCampaigns.map((j, i) => {
                    const cat = j.category ? j.category.split(/[\s&]/)[0] : null;
                    return (
                      <Link key={j.id || i} to={`/campaigns-and-journeys?search=${encodeURIComponent(j.name || "")}`} className="ov2-seg-row ov2-seg-row-link">
                        <span className="ov2-seg-name">{j.name}</span>
                        {cat && <span className="ov2-seg-purpose">{cat}</span>}
                        <StatusChip status={j.active ? "Production ready" : "Draft"} />
                      </Link>
                    );
                  })
                ) : (
                  <EmptyState text="No recent journeys for this source." />
                )}
              </div>

              {/* Top Journeys by Open Rate */}
              <Divider label="Top Journeys by Open Rate" />
              <div className="ov2-seg-list">
                {highlyCampaigns.length > 0 ? (
                  highlyCampaigns.map((j, i) => {
                    const maxRate = highlyCampaigns[0]?.openRate || 1;
                    const pct = Math.max(8, Math.round((j.openRate / maxRate) * 100));
                    return (
                      <Link key={j.id || `hc-${i}`} to={`/campaigns-and-journeys?search=${encodeURIComponent(j.name || "")}`} className="ov2-seg-row ov2-seg-row-bar ov2-seg-row-link">
                        <span className="ov2-seg-name">{j.name}</span>
                        <div className="ov2-seg-bar-wrap">
                          <div className="ov2-seg-bar" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="ov2-seg-size">{j.openRate.toFixed(1)}%</span>
                      </Link>
                    );
                  })
                ) : (
                  <EmptyState text="No open rate data available." />
                )}
              </div>
            </div>

            {/* Audience & Segments */}
            <div className="ov2-card">
              <PanelHeader title="Audience & Segments" subtitle="Segment health and usage" to="/segmentation" />

              {/* Status summary bar */}
              <div className="ov2-seg-summary">
                <div className="ov2-seg-total-block">
                  <strong>{formatNumber(segmentTotal)}</strong>
                  <span>Total Segments</span>
                </div>
                <div className="ov2-seg-status-rows">
                  {segmentStatusRows.map((row) => (
                    <div key={row.label} className="ov2-seg-status-item">
                      <span className="ov2-seg-dot" style={{ background: row.color }} />
                      <span className="ov2-seg-status-lbl">{row.label}</span>
                      <strong className="ov2-seg-status-val">{formatNumber(row.value)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Segments */}
              <Divider label="Recent Segments" />
              <div className="ov2-seg-list">
                {recentSegments.length > 0 ? (
                  recentSegments.map((seg, i) => (
                    <Link key={seg.segment_id || seg.id || i} to={`/segmentation?search=${encodeURIComponent(seg.name || seg.segment_name || "")}`} className="ov2-seg-row ov2-seg-row-link">
                      <span className="ov2-seg-name">{seg.name || seg.segment_name || `Segment ${i + 1}`}</span>
                      {seg.purpose && <span className="ov2-seg-purpose">{seg.purpose}</span>}
                      <StatusChip status={seg.status || resolveSegmentActivationStatus(seg)} />
                    </Link>
                  ))
                ) : (
                  <EmptyState text="No segment data for this source." />
                )}
              </div>

              {/* Highly Used Segments */}
              <Divider label="Most Used Segments" />
              <div className="ov2-seg-list">
                {highlyUsedSegments.length > 0 ? (
                  highlyUsedSegments.map((seg, i) => {
                    const sz = parseSize(seg.size) || Number(seg.count || seg._count || 0);
                    const pct = Math.max(4, Math.round((sz / maxSegSize) * 100));
                    return (
                      <Link key={seg.segment_id || seg.id || `hu-${i}`} to={`/segmentation?search=${encodeURIComponent(seg.name || seg.segment_name || "")}`} className="ov2-seg-row ov2-seg-row-bar ov2-seg-row-link">
                        <span className="ov2-seg-name">{seg.name || seg.segment_name || `Segment ${i + 1}`}</span>
                        <div className="ov2-seg-bar-wrap">
                          <div className="ov2-seg-bar" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="ov2-seg-size">{seg.size || formatNumber(sz)}</span>
                      </Link>
                    );
                  })
                ) : (
                  <EmptyState text="No usage data available." />
                )}
              </div>
            </div>
          </div>

          <div className="ov2-section-heading">Data &amp; Measurement</div>
          {/* ── Row 2: Data Sources | Measurement ── */}
          <div className="ov2-row ov2-row-three">

            {/* Data Sources */}
            <div className="ov2-card">
              <PanelHeader title="Data Sources" subtitle="Ingestion snapshot" to="/data-overview" linkLabel="View" />
              <div className="ov2-data-kpi-grid">
                {dataSourceStats.map((stat) => (
                  <div key={stat.label} className="ov2-data-kpi" style={{ "--dkc": stat.color }}>
                    <strong className="ov2-meas-sq-val">{formatNumber(stat.value)}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
              {topSources.length > 0 && (
                <>
                  <Divider label="Top Sources by Records" />
                  <div className="ov2-sources-list">
                    {topSources.map((src) => {
                      const pct = Math.max(4, Math.round((src.rows / maxSourceRows) * 100));
                      const accent = partyAccent(src.party);
                      return (
                        <div key={src.name} className="ov2-source-row">
                          <span className="ov2-source-dot" style={{ background: accent }} />
                          <span className="ov2-source-name">{src.name}</span>
                          <div className="ov2-source-bar-wrap">
                            <div className="ov2-source-bar" style={{ width: `${pct}%`, background: accent }} />
                          </div>
                          <span className="ov2-source-stat">{formatNumber(src.rows)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Measurement Summary */}
            <div className="ov2-card">
              <div className="ov2-meas-header">
                <PanelHeader title="Measurement" subtitle="Journey delivery performance" to="/campaign-journey-listing" linkLabel="Open Hub" />
                <select
                  className="ov2-meas-timeline-select"
                  value={measTimeline}
                  onChange={(e) => setMeasTimeline(e.target.value)}
                >
                  {MEAS_TIMELINE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 8 uniform square cards — 4 KPI metrics + 4 channels */}
              <div className="ov2-meas-grid8">
                {measCards.map((card) => (
                  <button
                    key={card.id}
                    className={`ov2-meas-sq${measChannel === card.id ? " ov2-meas-sq--active" : ""}`}
                    style={{ "--mc": card.color }}
                    onClick={() => setMeasChannel(card.id)}
                  >
                    <MuiIcon d={card.icon} size={18} style={{ color: card.color }} />
                    <strong className="ov2-meas-sq-val">{card.value}</strong>
                    <span className="ov2-meas-sq-label">{card.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* <div className="ov2-section-heading">Top Journeys</div> */}
          {/* ── Row 3: Top 5 Campaigns driven by selected card ── */}
          {/* {(() => {
            const showBounce = measChannel === "bounce_rate";
            const col4Label = showBounce ? "Bounce Rate" : "Open Rate";
            const col5Label = showBounce ? "Open Rate"   : "Click Rate";
            const sortLabel = selectedMeasCard?.label ?? "Metric";
            return (
              <div className="ov2-card">
                <PanelHeader
                  title={`Top 5 Journeys · ${sortLabel}`}
                  subtitle={`${MEAS_TIMELINE_OPTIONS.find(o => o.value === measTimeline)?.label} · ranked by ${sortLabel.toLowerCase()}`}
                  to="/campaign-journey-listing"
                  linkLabel="Open Hub"
                />
                <div className="ov2-meas-table">
                  <div className="ov2-meas-thead">
                    <span className="ov2-meas-col--name">Journey</span>
                    <span className="ov2-meas-col--num">Sent</span>
                    <span className="ov2-meas-col--num">Delivered</span>
                    <span className="ov2-meas-col--num ov2-meas-col--sort">{col4Label}</span>
                    <span className="ov2-meas-col--num">{col5Label}</span>
                  </div>
                  {channelTopJourneys.map((row) => (
                    <Link key={row.id} to="/campaign-journey-listing" className="ov2-meas-trow">
                      <span className="ov2-meas-col--name ov2-meas-campaign-name">{row.name}</span>
                      <span className="ov2-meas-col--num">{formatNumber(row.sent)}</span>
                      <span className="ov2-meas-col--num">{formatNumber(row.delivered)}</span>
                      <span className="ov2-meas-col--num ov2-meas-pct ov2-meas-col--sort">
                        {showBounce ? `${row.bounceRate}%` : `${row.openRate}%`}
                      </span>
                      <span className="ov2-meas-col--num ov2-meas-pct">
                        {showBounce ? `${row.openRate}%` : `${row.clickRate}%`}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()} */}

        </div>
      </>}
    </div>
  );
}

