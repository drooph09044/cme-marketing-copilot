import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { PRECONFIGURED_JOURNEYS } from "../../../shared/suiteData";
import { PRESET_JOURNEYS as RAW_JOURNEYS } from "../../../data/journeyLibrary";
import {
  SOURCE_SYSTEM_LABELS,
  SOURCE_SYSTEMS,
  readSelectedSourceSystem,
} from "../sourceSystem";
import CampaignJourneyReportingView from "./CampaignJourneyReportingView";
import "./CampaignManager.css";

// ─────────────────────────────────────────────────────────
// JOURNEY LOOKUP
// ─────────────────────────────────────────────────────────
const JOURNEY_MAP = Object.fromEntries(PRECONFIGURED_JOURNEYS.map((j) => [j.slug, j]));

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
function channelsFromJourneyForm(channels = {}) {
  const map = { email: "email", push: "push", sms: "sms", inApp: "inapp" };
  const result = Object.entries(channels)
    .filter(([, v]) => v)
    .map(([k]) => map[k] || k);
  return result.length ? result : ["email"];
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}
function fmtCurrency(n) {
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(0) + "K";
  return "$" + n;
}
function initials(name) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function publishedAudienceId(audience) {
  return String(audience?.segment_id ?? audience?.id ?? "").trim();
}

function mergePublishedAudiences(persisted, sameSession, sourceSystem, sessionSourceById) {
  const merged = new Map();
  const addAudience = (audience, sameSessionAudience = false) => {
    if (!audience || typeof audience !== "object") return;
    const id = publishedAudienceId(audience);
    if (!id) return;

    const explicitSource = String(audience.source_system ?? audience.sourceSystem ?? "")
      .trim()
      .toLowerCase();
    if (sameSessionAudience && !explicitSource && !sessionSourceById.has(id)) {
      sessionSourceById.set(id, sourceSystem);
    }
    const audienceSource = SOURCE_SYSTEMS.includes(explicitSource)
      ? explicitSource
      : explicitSource === "all"
        ? "all"
        : sessionSourceById.get(id) ?? "all";
    if (audienceSource !== "all" && audienceSource !== sourceSystem) return;

    const pipelineStatus =
      audience.pipeline_status ??
      audience._pipelineStatus ??
      audience.status ??
      "Ready for activation";
    const previous = merged.get(id);
    const published =
      audience.published_to_journey_builder === true ||
      String(audience.journey_builder_status ?? "").toLowerCase() === "published" ||
      previous?.published === true;
    merged.set(id, {
      ...previous,
      ...audience,
      id,
      segment_id: id,
      source_system: audienceSource,
      status: pipelineStatus,
      published,
    });
  };

  (persisted ?? []).forEach((audience) => addAudience(audience));
  (sameSession ?? []).forEach((audience) => addAudience(audience, true));
  return [...merged.values()];
}

// Deterministic pseudo-random from seed integer
function seededVal(seed, min, max) {
  const x = Math.sin(seed + 1) * 10000;
  const frac = x - Math.floor(x);
  return Math.floor(frac * (max - min + 1)) + min;
}
function seededFloat(seed, min, max) {
  const x = Math.sin(seed + 73) * 10000;
  const frac = x - Math.floor(x);
  return +(frac * (max - min) + min).toFixed(1);
}

// ─────────────────────────────────────────────────────────
// CAMPAIGN GENERATION FROM REAL JOURNEYS
// ─────────────────────────────────────────────────────────
const OWNERS = ["Priya Sharma", "Raj Menon", "Anita Desai", "Kiran Bose", "Sameer Patel"];
const REGIONS = ["National", "North", "South", "East", "West"];
const BUSINESS_UNITS = ["Fan Engagement", "Ticketing", "Commerce", "Digital", "Retention", "Growth", "Loyalty", "Events"];
const BRANDS = ["Core Brand", "Premium Brand", "Commerce Brand", "App Brand", "Events Brand"];
const CAMPAIGN_TYPES = ["Email", "Multi-channel", "SMS", "Push", "In-App"];

const STATUS_SEQUENCE = [
  "Active", "Active", "Draft", "Scheduled", "Active",
  "Completed", "Active", "Draft", "Failed", "Scheduled",
  "Active", "Paused", "Active", "Draft", "Scheduled",
  "Active", "Completed", "Active", "Draft", "Scheduled",
];

const PRIORITY_SEQ = ["High", "Medium", "Medium", "Low", "High"];

// Generate N campaigns per journey (total ≈ journeys.length × perJourney)
function generateCampaigns(journeys, perJourney = 4) {
  const campaigns = [];
  let globalIdx = 0;

  journeys.forEach((journey, ji) => {
    const jf = journey.journeyForm || {};
    const channels = channelsFromJourneyForm(jf.channels);
    const audience = jf.audience || "General Audience";
    const objective = jf.objective || journey.blueprintForm?.brief || "";
    const categoryName = journey.categoryName || "General";
    const subCategory = journey.subCategoryName || categoryName;

    for (let ci = 0; ci < perJourney; ci++) {
      const seed = ji * 37 + ci * 13 + 7;
      const status = STATUS_SEQUENCE[(ji * perJourney + ci) % STATUS_SEQUENCE.length];
      const isLive = status === "Active" || status === "Paused" || status === "Completed" || status === "Failed";
      const owner = OWNERS[seededVal(seed, 0, OWNERS.length - 1)];
      const region = REGIONS[seededVal(seed + 1, 0, REGIONS.length - 1)];
      const bu = BUSINESS_UNITS[seededVal(seed + 2, 0, BUSINESS_UNITS.length - 1)];
      const brand = BRANDS[seededVal(seed + 3, 0, BRANDS.length - 1)];
      const type = channels.length > 1 ? "Multi-channel" : CAMPAIGN_TYPES[seededVal(seed + 4, 0, 3)];
      const touchType = journey.blueprintForm?.orchestrationType === "single-touchpoint" ? "Single-touch" : "Multi-touch";
      const priority = PRIORITY_SEQ[seededVal(seed + 5, 0, PRIORITY_SEQ.length - 1)];

      // Dates (encoded as static strings — no Date() to keep stable)
      const now = new Date();
      const y = now.getFullYear();
      const py = y - 1;
      const createdMonths = [`${py}-10`, `${py}-11`, `${py}-12`, `${y}-01`, `${y}-02`];
      const createdDays = ["05", "12", "01", "18", "07"];
      const createdDate = createdMonths[seededVal(seed + 6, 0, 4)] + "-" + createdDays[seededVal(seed + 6, 0, 4)];
      const scheduledMonths = [`${y}-04`, `${y}-05`, `${y}-06`, `${y}-07`, `${y}-08`];
      const scheduledDate = scheduledMonths[seededVal(seed + 7, 0, 4)] + "-" + createdDays[seededVal(seed + 7, 0, 4)];

      // Metrics — only live campaigns have real metrics
      const openRate = isLive ? seededFloat(seed + 10, 18, 52) : 0;
      const ctr = isLive ? seededFloat(seed + 11, 2, 14) : 0;
      const convRate = isLive ? seededFloat(seed + 12, 1, 10) : 0;
      const audienceSize = seededVal(seed + 13, 5000, 180000);
      const revenue = isLive ? seededVal(seed + 14, 10000, 900000) : 0;
      const budget = seededVal(seed + 15, 5000, 60000);
      const budgetSpent = isLive ? Math.round(budget * seededFloat(seed + 16, 0.3, 0.95)) : 0;
      const score = isLive ? seededVal(seed + 17, 40, 98) : 0;

      // Variant label for campaign name
      const variantLabels = ["Wave 1", "Wave 2", "Sprint A", "Sprint B", "Phase 1", "Phase 2", "Drive", "Push"];
      const variantLabel = variantLabels[ci % variantLabels.length];
      const campaignName = ci === 0 ? journey.name : `${journey.name} — ${variantLabel}`;

      // Calendar events — relative to current date so the calendar stays populated
      const calEvents = [];
      if (status !== "Draft") {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const pm = String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, "0");
        const py = now.getMonth() === 0 ? y - 1 : y;
        const nm = String(now.getMonth() === 11 ? 1 : now.getMonth() + 2).padStart(2, "0");
        const ny = now.getMonth() === 11 ? y + 1 : y;
        const calDates = [
          `${y}-${m}-03`, `${y}-${m}-07`, `${y}-${m}-12`,
          `${y}-${m}-18`, `${y}-${m}-22`, `${y}-${m}-28`,
          `${py}-${pm}-20`, `${ny}-${nm}-05`, `${ny}-${nm}-14`,
        ];
        calEvents.push({ type: status === "Active" ? "Launch" : status, date: calDates[seededVal(seed + 18, 0, calDates.length - 1)], status });
        if (isLive && ci % 2 === 0) {
          calEvents.push({ type: "Mid-Check", date: calDates[seededVal(seed + 19, 0, calDates.length - 1)], status: "Scheduled" });
        }
      }

      // Timeline
      const timeline = [
        { event: "Campaign Created", date: createdDate + " 09:00", user: owner, type: "create", description: `Created ${campaignName}.` },
      ];
      if (status !== "Draft") {
        const approver = OWNERS[seededVal(seed + 20, 0, OWNERS.length - 1)];
        timeline.push({ event: "Audience Assigned", date: createdDate + " 14:30", user: owner, type: "audience", description: `Audience "${audience}" attached.` });
        timeline.push({ event: "Journey Mapped", date: scheduledDate + " 10:00", user: approver, type: "journey", description: `Journey "${journey.name}" configured.` });
        if (isLive) {
          timeline.push({ event: "Approved", date: scheduledDate + " 15:00", user: "Director CMO", type: "approval", description: "Campaign approved for activation." });
          timeline.push({ event: "Activated", date: scheduledDate + " 08:00", user: "System", type: "activate", description: "Campaign went live." });
        }
        if (status === "Completed") {
          timeline.push({ event: "Completed", date: scheduledDate + " 23:59", user: "System", type: "update", description: "Campaign concluded successfully." });
        }
        if (status === "Failed") {
          timeline.push({ event: "Failed", date: scheduledDate + " 11:30", user: "System", type: "update", description: "Campaign encountered an error during execution." });
        }
        if (status === "Paused") {
          timeline.push({ event: "Paused", date: scheduledDate + " 14:00", user: owner, type: "update", description: "Campaign paused pending review." });
        }
      }

      campaigns.push({
        id: `${journey.slug}-${ci}`,
        name: campaignName,
        type,
        status,
        journey: journey.name,
        journeySlug: journey.slug,
        segment: audience,
        audienceSize,
        owner,
        createdBy: owner,
        createdDate,
        scheduledDate,
        lastModified: scheduledDate,
        channels,
        budget,
        budgetSpent,
        brand,
        region,
        businessUnit: bu,
        tags: [journey.categoryId, journey.subCategoryId, status.toLowerCase()].filter(Boolean),
        priority,
        performanceScore: score,
        metrics: { openRate, ctr, conversionRate: convRate, revenue, reach: audienceSize },
        startDate: scheduledDate,
        endDate: scheduledDate,
        calendarEvents: calEvents,
        timeline,
        // Real journey reference
        touchType,
        journeyData: journey,
        journeyObjective: objective,
        journeyCategory: categoryName,
        journeySubCategory: subCategory,
        variantA: jf.variantA || "Standard cadence",
        variantB: jf.variantB || "Personalised variant",
        journeyDuration: jf.duration || "21 days",
      });

      globalIdx++;
    }
  });

  return campaigns;
}

const MOCK_CAMPAIGNS = generateCampaigns(PRECONFIGURED_JOURNEYS, 1);

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Active:    { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  Draft:     { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  Scheduled: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  Paused:    { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  Completed: { color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  Failed:    { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

const CHANNEL_CONFIG = {
  email:    { color: "#3b82f6", bg: "rgba(59,130,246,0.15)",  label: "Email" },
  sms:      { color: "#10b981", bg: "rgba(16,185,129,0.15)", label: "SMS" },
  push:     { color: "#8b5cf6", bg: "rgba(139,92,246,0.15)", label: "Push" },
  inapp:    { color: "#06b6d4", bg: "rgba(6,182,212,0.15)",  label: "In-App" },
  web:      { color: "#f97316", bg: "rgba(249,115,22,0.15)", label: "Web" },
  whatsapp: { color: "#25d366", bg: "rgba(37,211,102,0.15)", label: "WA" },
};

const TIMELINE_COLORS = {
  create:   { color: "#3b82f6", border: "#3b82f6" },
  audience: { color: "#10b981", border: "#10b981" },
  journey:  { color: "#8b5cf6", border: "#8b5cf6" },
  approval: { color: "#f59e0b", border: "#f59e0b" },
  publish:  { color: "#06b6d4", border: "#06b6d4" },
  activate: { color: "#10b981", border: "#10b981" },
  update:   { color: "#64748b", border: "#64748b" },
};

const ALL_OWNERS_LIST = [...new Set(MOCK_CAMPAIGNS.map((c) => c.owner))].sort();
const ALL_TYPES_LIST  = [...new Set(MOCK_CAMPAIGNS.map((c) => c.type))].sort();
const ALL_JOURNEYS_LIST = PRECONFIGURED_JOURNEYS.map((j) => ({ slug: j.slug, name: j.name, category: j.categoryName }));
const ALL_CATEGORIES_LIST = [...new Set(PRECONFIGURED_JOURNEYS.map((j) => j.categoryName).filter(Boolean))].sort();

// ─────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: "#64748b", bg: "rgba(100,116,139,0.12)" };
  return (
    <span className="cm-status-badge" style={{ color: cfg.color, background: cfg.bg }}>
      <span className="cm-status-dot" style={{ background: cfg.color }} />
      {status}
    </span>
  );
}

function ChannelBadge({ channel }) {
  const cfg = CHANNEL_CONFIG[channel] || { color: "#64748b", bg: "rgba(100,116,139,0.15)", label: channel };
  return (
    <span className="cm-channel-chip" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

function ScoreBar({ score }) {
  const color = score > 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="cm-score-wrap">
      <div className="cm-score-bar">
        <div className="cm-score-fill" style={{ width: score + "%", background: color }} />
      </div>
      <span className="cm-score-num" style={{ color }}>{score}</span>
    </div>
  );
}

function PriorityDot({ priority }) {
  const cls = { High: "cm-priority-high", Medium: "cm-priority-medium", Low: "cm-priority-low" }[priority] || "cm-priority-low";
  return <span className={cls}>● {priority}</span>;
}

// ─────────────────────────────────────────────────────────
// HEALTH CARDS
// ─────────────────────────────────────────────────────────
const HEALTH_META = [
  { key: "",          label: "Total",     color: "#3b8de6" },
  { key: "Active",    label: "Active",    color: "#10b981" },
  { key: "Draft",     label: "Draft",     color: "#8b5cf6" },
  { key: "Scheduled", label: "Upcoming",  color: "#3b82f6" },
  { key: "Completed", label: "Completed", color: "#64748b" },
  { key: "Failed",    label: "Failed",    color: "#ef4444" },
];

function HealthCard({ label, value, color, isActive, onClick }) {
  return (
    <div className={"cm-health-card" + (isActive ? " active" : "")} style={{ "--hc": color }} onClick={onClick}>
      <div className="cm-health-card-top">
        <div className="cm-health-card-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      <div className="cm-health-card-value">{value}</div>
      <div className="cm-health-card-label">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SEARCH BAR
// ─────────────────────────────────────────────────────────
function SearchBar({ value, onChange, campaigns, recentSearches, onRecentClick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const suggestions = useMemo(() => {
    if (!value || value.length < 2) return [];
    const lower = value.toLowerCase();
    return campaigns
      .filter((c) => c.name.toLowerCase().includes(lower) || c.journey.toLowerCase().includes(lower) || c.segment.toLowerCase().includes(lower))
      .slice(0, 7);
  }, [value, campaigns]);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const showDropdown = open && (suggestions.length > 0 || (recentSearches.length > 0 && !value));

  return (
    <div className="cm-search-wrap" ref={ref}>
      <svg className="cm-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
        <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <input
        className="cm-search-input"
        type="text"
        placeholder="Search campaigns, journeys, segments…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {showDropdown && (
        <div className="cm-search-dropdown">
          {!value && recentSearches.length > 0 && (
            <>
              <div className="cm-search-section-label">Recent Searches</div>
              {recentSearches.map((r) => (
                <div key={r} className="cm-search-item" onClick={() => { onChange(r); onRecentClick(r); setOpen(false); }}>
                  <svg className="cm-search-item-icon" width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  {r}
                </div>
              ))}
            </>
          )}
          {suggestions.length > 0 && (
            <>
              <div className="cm-search-section-label">Campaigns</div>
              {suggestions.map((c) => (
                <div key={c.id} className="cm-search-item" onClick={() => { onChange(c.name); setOpen(false); }}>
                  <StatusBadge status={c.status} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{c.journey}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// FILTER PANEL
// ─────────────────────────────────────────────────────────
function FilterPanel({ filters, onChange, onApply, onReset, onSave }) {
  const allStatuses = ["Active", "Draft", "Scheduled", "Paused", "Completed", "Failed"];
  const allChannels = ["email", "sms", "push", "inapp", "web", "whatsapp"];

  function togglePill(field, val) {
    const arr = filters[field] || [];
    onChange({ [field]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] });
  }

  return (
    <div className="cm-filter-panel">
      <div className="cm-filter-sections">
        <div>
          <div className="cm-filter-section-title">Status</div>
          <div className="cm-filter-pills">
            {allStatuses.map((s) => (
              <button key={s} className={"cm-filter-pill" + ((filters.statuses || []).includes(s) ? " active" : "")} onClick={() => togglePill("statuses", s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="cm-filter-section-title">Channel</div>
          <div className="cm-filter-pills">
            {allChannels.map((ch) => (
              <button key={ch} className={"cm-filter-pill" + ((filters.channels || []).includes(ch) ? " active" : "")} onClick={() => togglePill("channels", ch)}>
                {(CHANNEL_CONFIG[ch] || {}).label || ch}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="cm-filter-section-title">Journey</div>
          <select className="cm-filter-input" value={filters.journeySlug || ""} onChange={(e) => onChange({ journeySlug: e.target.value })}>
            <option value="">All Journeys</option>
            {ALL_JOURNEYS_LIST.map((j) => <option key={j.slug} value={j.slug}>{j.name}</option>)}
          </select>
        </div>
        <div>
          <div className="cm-filter-section-title">Vertical / Category</div>
          <div className="cm-filter-pills">
            {ALL_CATEGORIES_LIST.map((cat) => (
              <button key={cat} className={"cm-filter-pill" + ((filters.categories || []).includes(cat) ? " active" : "")} onClick={() => togglePill("categories", cat)}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="cm-filter-section-title">Created Date</div>
          <div className="cm-filter-row">
            <input type="date" className="cm-filter-input" value={filters.dateCreatedFrom || ""} onChange={(e) => onChange({ dateCreatedFrom: e.target.value })} />
            <span className="cm-filter-row-label">to</span>
            <input type="date" className="cm-filter-input" value={filters.dateCreatedTo || ""} onChange={(e) => onChange({ dateCreatedTo: e.target.value })} />
          </div>
        </div>
        <div>
          <div className="cm-filter-section-title">Scheduled Date</div>
          <div className="cm-filter-row">
            <input type="date" className="cm-filter-input" value={filters.scheduledFrom || ""} onChange={(e) => onChange({ scheduledFrom: e.target.value })} />
            <span className="cm-filter-row-label">to</span>
            <input type="date" className="cm-filter-input" value={filters.scheduledTo || ""} onChange={(e) => onChange({ scheduledTo: e.target.value })} />
          </div>
        </div>
        <div>
          <div className="cm-filter-section-title">Audience Size</div>
          <div className="cm-filter-row">
            <input type="number" className="cm-filter-input" placeholder="Min" value={filters.audienceSizeMin || ""} onChange={(e) => onChange({ audienceSizeMin: e.target.value })} />
            <span className="cm-filter-row-label">–</span>
            <input type="number" className="cm-filter-input" placeholder="Max" value={filters.audienceSizeMax || ""} onChange={(e) => onChange({ audienceSizeMax: e.target.value })} />
          </div>
        </div>
        <div>
          <div className="cm-filter-section-title">Performance</div>
          <div className="cm-filter-row">
            <span className="cm-filter-row-label">Open ≥</span>
            <input type="number" className="cm-filter-input" placeholder="%" value={filters.openRateMin || ""} onChange={(e) => onChange({ openRateMin: e.target.value })} />
            <span className="cm-filter-row-label">CTR ≥</span>
            <input type="number" className="cm-filter-input" placeholder="%" value={filters.ctrMin || ""} onChange={(e) => onChange({ ctrMin: e.target.value })} />
          </div>
        </div>
        <div>
          <div className="cm-filter-section-title">Owner</div>
          <select className="cm-filter-input" value={filters.owner || ""} onChange={(e) => onChange({ owner: e.target.value })}>
            <option value="">All Owners</option>
            {ALL_OWNERS_LIST.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <div className="cm-filter-section-title">Campaign Type</div>
          <select className="cm-filter-input" value={filters.type || ""} onChange={(e) => onChange({ type: e.target.value })}>
            <option value="">All Types</option>
            {ALL_TYPES_LIST.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <div className="cm-filter-section-title">Priority</div>
          <select className="cm-filter-input" value={filters.priority || ""} onChange={(e) => onChange({ priority: e.target.value })}>
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>
      <div className="cm-filter-actions">
        <button className="cm-btn cm-btn-ghost" onClick={onReset}>Reset</button>
        <button className="cm-btn cm-btn-ghost" onClick={onSave}>Save Filter</button>
        <button className="cm-btn cm-btn-primary" onClick={onApply}>Apply</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CAMPAIGN TABLE
// ─────────────────────────────────────────────────────────
function RowActionsMenu({ campaign, onView, onOpenBuilder }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    function h(e) {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function handleOpen(e) {
    e.stopPropagation();
    if (!open) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }

  return (
    <div className="cm-actions-cell">
      <button className="cm-actions-btn" ref={btnRef} onClick={handleOpen}>⋯</button>
      {open && (
        <div className="cm-actions-dropdown" ref={dropRef} style={{ top: pos.top, right: pos.right }}>
          <div className="cm-action-item" onClick={() => { onView(campaign); setOpen(false); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
            View Details
          </div>
          <div className="cm-action-item" style={{ color: "#3b8de6" }} onClick={() => { onOpenBuilder(campaign.journeySlug); setOpen(false); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Open in Builder
          </div>
          <div className="cm-action-item" onClick={() => setOpen(false)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Edit
          </div>
          <div className="cm-action-item" onClick={() => setOpen(false)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Duplicate
          </div>
          <div className="cm-action-item danger" onClick={() => setOpen(false)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Delete
          </div>
        </div>
      )}
    </div>
  );
}

function SortIcon({ field, sort }) {
  const active = sort.field === field;
  return (
    <svg className={"cm-sort-icon" + (active ? " cm-sort-active" : "")} width="10" height="10" viewBox="0 0 24 24" fill="none">
      {active && sort.direction === "asc"
        ? <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        : <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      }
    </svg>
  );
}

function CampaignTable({ campaigns, selected, onSelect, onSelectAll, onSort, sort, onRowClick, pageSize, onPageSizeChange, page, onPageChange, onView, onOpenBuilder }) {
  const totalPages = Math.max(1, Math.ceil(campaigns.length / pageSize));
  const start = (page - 1) * pageSize;
  const paged = campaigns.slice(start, start + pageSize);
  const allSelected = paged.length > 0 && paged.every((c) => selected.includes(c.id));

  function pageNums() {
    const pages = [];
    const delta = 1;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) pages.push(i);
      else if (pages[pages.length - 1] !== "…") pages.push("…");
    }
    return pages;
  }

  return (
    <div className="cm-table-wrap">
      <table className="cm-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" checked={allSelected} onChange={() => onSelectAll(paged)} style={{ cursor: "pointer" }} />
            </th>
            <th style={{ width: "20%" }} onClick={() => onSort("name")}><div className="cm-th-inner">Name <SortIcon field="name" sort={sort} /></div></th>
            <th style={{ width: 110 }} onClick={() => onSort("status")}><div className="cm-th-inner">Status <SortIcon field="status" sort={sort} /></div></th>
            <th style={{ width: 90 }} onClick={() => onSort("touchType")}><div className="cm-th-inner">Type <SortIcon field="touchType" sort={sort} /></div></th>
            <th style={{ width: "16%" }} onClick={() => onSort("journey")}><div className="cm-th-inner">Journey <SortIcon field="journey" sort={sort} /></div></th>
            <th style={{ width: "10%" }} onClick={() => onSort("journeyCategory")}><div className="cm-th-inner">Vertical <SortIcon field="journeyCategory" sort={sort} /></div></th>
            <th style={{ width: 105 }} onClick={() => onSort("owner")}><div className="cm-th-inner">Owner <SortIcon field="owner" sort={sort} /></div></th>
            <th style={{ width: 120 }}>Channels</th>
            <th style={{ width: 85 }} onClick={() => onSort("audienceSize")}><div className="cm-th-inner">Audience <SortIcon field="audienceSize" sort={sort} /></div></th>
            <th style={{ width: 80 }} onClick={() => onSort("performanceScore")}><div className="cm-th-inner">Score <SortIcon field="performanceScore" sort={sort} /></div></th>
            <th style={{ width: 85 }} onClick={() => onSort("priority")}><div className="cm-th-inner">Priority <SortIcon field="priority" sort={sort} /></div></th>
            <th style={{ width: 50 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paged.length === 0 && (
            <tr><td colSpan={12} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No campaigns match your filters.</td></tr>
          )}
          {paged.map((c) => (
            <tr key={c.id} className={selected.includes(c.id) ? "cm-row-selected" : ""} style={{ cursor: "pointer" }} onClick={() => onRowClick(c)}>
              <td onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => onSelect(c.id)} style={{ cursor: "pointer" }} />
              </td>
              <td>
                <div className="cm-name-cell">
                  <strong>{c.name}</strong>
                  <span className="cm-type-badge">{c.type}</span>
                </div>
              </td>
              <td><StatusBadge status={c.status} /></td>
              <td>
                <span style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "2px 8px", borderRadius: 20,
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                  background: c.touchType === "Single-touch" ? "rgba(100,180,255,0.1)" : "rgba(100,220,160,0.1)",
                  color: c.touchType === "Single-touch" ? "#64B4FF" : "#64DCA0",
                }}>
                  {c.touchType}
                </span>
              </td>
              <td style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 0 }} title={c.journey}>{c.journey}</td>
              <td style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 0 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.journeyCategory}</span>
              </td>
              <td style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 0 }} title={c.owner}>{c.owner}</td>
              <td>
                <div className="cm-channels">
                  {c.channels.slice(0, 3).map((ch) => <ChannelBadge key={ch} channel={ch} />)}
                  {c.channels.length > 3 && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>+{c.channels.length - 3}</span>}
                </div>
              </td>
              <td>{fmtNum(c.audienceSize)}</td>
              <td><ScoreBar score={c.performanceScore} /></td>
              <td><PriorityDot priority={c.priority} /></td>
              <td onClick={(e) => e.stopPropagation()}>
                <RowActionsMenu campaign={c} onView={onView} onOpenBuilder={onOpenBuilder} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cm-pagination">
        <div className="cm-pagination-info">
          Showing {campaigns.length === 0 ? 0 : start + 1}–{Math.min(start + pageSize, campaigns.length)} of {campaigns.length}
        </div>
        <div className="cm-page-btns">
          <button className="cm-page-btn" disabled={page === 1} onClick={() => onPageChange(page - 1)}>‹</button>
          {pageNums().map((p, i) =>
            p === "…"
              ? <span key={"e" + i} style={{ padding: "0 4px", color: "var(--text-muted)", fontSize: 13 }}>…</span>
              : <button key={p} className={"cm-page-btn" + (p === page ? " active" : "")} onClick={() => onPageChange(p)}>{p}</button>
          )}
          <button className="cm-page-btn" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>›</button>
        </div>
        <select className="cm-page-size-select" value={pageSize} onChange={(e) => { onPageSizeChange(Number(e.target.value)); }}>
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CALENDAR VIEW
// ─────────────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function CalendarView({ campaigns, calDate, onDateChange, selectedDay, onDayClick }) {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const todayRef = new Date();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, curMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, curMonth: true });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - firstDay + 1, curMonth: false });

  function eventsForDay(d, curMonth) {
    if (!curMonth) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const evs = [];
    campaigns.forEach((c) => {
      (c.calendarEvents || []).forEach((ev) => { if (ev.date === dateStr) evs.push({ ...ev, name: c.name }); });
    });
    return evs;
  }

  function isToday(d, curMonth) {
    return curMonth && d === todayRef.getDate() && month === todayRef.getMonth() && year === todayRef.getFullYear();
  }

  const statusColors = { Active: "#10b981", Scheduled: "#3b82f6", Draft: "#8b5cf6", Completed: "#64748b", Failed: "#ef4444", Paused: "#f59e0b" };

  return (
    <div className="cm-calendar">
      <div className="cm-cal-header">
        <div className="cm-cal-title">{MONTH_NAMES[month]} {year}</div>
        <div className="cm-cal-controls">
          <button className="cm-cal-nav-btn" onClick={() => onDateChange(new Date(year, month - 1, 1))}>‹</button>
          <button className="cm-cal-today-btn" onClick={() => { const n = new Date(); onDateChange(new Date(n.getFullYear(), n.getMonth(), 1)); }}>Today</button>
          <button className="cm-cal-nav-btn" onClick={() => onDateChange(new Date(year, month + 1, 1))}>›</button>
        </div>
      </div>
      <div className="cm-cal-grid">
        {DAY_NAMES.map((d) => <div key={d} className="cm-cal-day-header">{d}</div>)}
        {cells.map((cell, i) => {
          const evs = eventsForDay(cell.day, cell.curMonth);
          const dateStr = cell.curMonth ? `${year}-${String(month + 1).padStart(2,"0")}-${String(cell.day).padStart(2,"0")}` : null;
          const isSelected = dateStr && selectedDay === dateStr;
          return (
            <div
              key={i}
              className={"cm-cal-day" + (!cell.curMonth ? " other-month" : "") + (isToday(cell.day, cell.curMonth) ? " today" : "") + (isSelected ? " is-selected" : "")}
              onClick={() => cell.curMonth && onDayClick && onDayClick(dateStr, evs)}
              style={cell.curMonth ? { cursor: "pointer" } : undefined}
            >
              <div className="cm-cal-date">{cell.day}</div>
              {evs.slice(0, 2).map((ev, j) => (
                <div key={j} className="cm-cal-event" style={{ background: (statusColors[ev.status] || "#3b82f6") + "22", color: statusColors[ev.status] || "#3b82f6" }} title={ev.name}>
                  {ev.name.slice(0, 20)}
                </div>
              ))}
              {evs.length > 2 && <div className="cm-cal-more">+{evs.length - 2} more</div>}
            </div>
          );
        })}
      </div>
      <div className="cm-cal-legend">
        {Object.entries(statusColors).map(([s, c]) => (
          <div key={s} className="cm-cal-legend-item">
            <div className="cm-cal-legend-dot" style={{ background: c }} />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// JOURNEY PANEL — populated from real journey data
// ─────────────────────────────────────────────────────────
function JourneyPanel({ campaign, onClose }) {
  if (!campaign) return null;
  const journey = JOURNEY_MAP[campaign.journeySlug] || {};
  const jf = journey.journeyForm || {};

  const nodes = [
    {
      type: "Campaign",
      name: campaign.name,
      detail: `Type: ${campaign.type}\nStatus: ${campaign.status}`,
    },
    {
      type: "Journey",
      name: journey.name || campaign.journey,
      detail: `Vertical: ${journey.categoryName || campaign.journeyCategory}\nSub-category: ${journey.subCategoryName || campaign.journeySubCategory}`,
      extra: jf.objective || campaign.journeyObjective,
    },
    {
      type: "Segment / Audience",
      name: jf.audience || campaign.segment,
      detail: `Size: ${fmtNum(campaign.audienceSize)} members\nDuration: ${jf.duration || campaign.journeyDuration}`,
    },
    {
      type: "Channels",
      name: campaign.channels.map((ch) => (CHANNEL_CONFIG[ch] || {}).label || ch).join(", "),
      detail: `${campaign.channels.length} channel${campaign.channels.length !== 1 ? "s" : ""} configured`,
      chips: campaign.channels,
    },
  ];

  return (
    <div className="cm-journey-panel">
      <div className="cm-journey-panel-header">
        <h3 className="cm-journey-panel-title">Journey Association — {campaign.journey}</h3>
        <button className="cm-btn cm-btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 12 }} onClick={onClose}>Close</button>
      </div>
      {/* Variant strip */}
      {(campaign.variantA || campaign.variantB) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#e5c97a", marginBottom: 3 }}>Variant A</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{campaign.variantA}</div>
          </div>
          <div style={{ flex: 1, minWidth: 180, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#c4b5fd", marginBottom: 3 }}>Variant B</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{campaign.variantB}</div>
          </div>
        </div>
      )}
      <div className="cm-journey-chain">
        {nodes.map((node, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start" }}>
            {i > 0 && (
              <div className="cm-journey-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
            <div className="cm-journey-node">
              <div className="cm-journey-node-card">
                <div className="cm-journey-node-type">{node.type}</div>
                <div className="cm-journey-node-name">{node.name}</div>
                <div className="cm-journey-node-detail">{node.detail}</div>
                {node.extra && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, fontStyle: "italic" }}>{node.extra.slice(0, 80)}…</div>}
                {node.chips && (
                  <div className="cm-journey-node-chips">
                    {node.chips.map((ch) => <ChannelBadge key={ch} channel={ch} />)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ACTIVITY TIMELINE
// ─────────────────────────────────────────────────────────
function ActivityTimeline({ events }) {
  if (!events || events.length === 0) return <div style={{ color: "var(--text-muted)", fontSize: 13, padding: 20, textAlign: "center" }}>No timeline events.</div>;
  return (
    <div className="cm-timeline">
      {events.map((ev, i) => {
        const cfg = TIMELINE_COLORS[ev.type] || TIMELINE_COLORS.update;
        return (
          <div key={i} className="cm-timeline-item">
            <div className="cm-timeline-icon" style={{ borderColor: cfg.border, color: cfg.color }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                {ev.type === "create"   && <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>}
                {ev.type === "audience" && <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>}
                {ev.type === "journey"  && <path d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>}
                {ev.type === "approval" && <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
                {ev.type === "activate" && <polygon points="5,3 19,12 5,21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>}
                {(ev.type === "update" || ev.type === "publish") && <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>}
              </svg>
            </div>
            <div className="cm-timeline-body">
              <div className="cm-timeline-header">
                <span className="cm-timeline-event">{ev.event}</span>
                <span className="cm-timeline-time">{ev.date}</span>
              </div>
              <div className="cm-timeline-desc">{ev.description}</div>
              <div className="cm-timeline-user">
                <div className="cm-timeline-avatar">{initials(ev.user)}</div>
                {ev.user}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CAMPAIGN DRAWER
// ─────────────────────────────────────────────────────────
function CampaignDrawer({ campaign, open, onClose, onOpenBuilder }) {
  const [tab, setTab] = useState("overview");
  useEffect(() => { if (open) setTab("overview"); }, [open, campaign?.id]);

  const openTrendData = campaign ? [
    { d: "W1", v: +(campaign.metrics.openRate * 0.7).toFixed(1) },
    { d: "W2", v: +(campaign.metrics.openRate * 0.85).toFixed(1) },
    { d: "W3", v: +(campaign.metrics.openRate * 0.95).toFixed(1) },
    { d: "W4", v: campaign.metrics.openRate },
  ] : [];
  const ctrTrendData = campaign ? [
    { d: "W1", v: +(campaign.metrics.ctr * 0.6).toFixed(1) },
    { d: "W2", v: +(campaign.metrics.ctr * 0.8).toFixed(1) },
    { d: "W3", v: +(campaign.metrics.ctr * 0.9).toFixed(1) },
    { d: "W4", v: campaign.metrics.ctr },
  ] : [];
  const revenueData = campaign ? [
    { d: "Jan", v: Math.round(campaign.metrics.revenue * 0.2) },
    { d: "Feb", v: Math.round(campaign.metrics.revenue * 0.35) },
    { d: "Mar", v: Math.round(campaign.metrics.revenue * 0.6) },
    { d: "Apr", v: Math.round(campaign.metrics.revenue * 0.85) },
  ] : [];

  const budgetPct = campaign && campaign.budget > 0 ? Math.round((campaign.budgetSpent / campaign.budget) * 100) : 0;
  const journey = campaign ? (JOURNEY_MAP[campaign.journeySlug] || {}) : {};
  const jf = journey.journeyForm || {};

  return (
    <>
      {open && <div className="cm-drawer-overlay" onClick={onClose} />}
      <div className={"cm-drawer" + (open ? " open" : "")}>
        {campaign && (
          <>
            <div className="cm-drawer-header">
              <div className="cm-drawer-title-row">
                <div className="cm-drawer-title" style={{ flex: 1 }}>{campaign.name}</div>
                <StatusBadge status={campaign.status} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                {campaign.journeyCategory} · {campaign.journeySubCategory}
              </div>
              <div className="cm-drawer-quick-actions">
                <button
                  className="cm-btn cm-btn-primary"
                  style={{ height: 28, fontSize: 12, padding: "0 12px" }}
                  onClick={() => { onClose(); onOpenBuilder(campaign.journeySlug); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                    <path d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Open in Builder
                </button>
                <button className="cm-btn cm-btn-ghost" style={{ height: 28, fontSize: 12, padding: "0 10px" }}>Edit</button>
                <button className="cm-btn cm-btn-ghost" style={{ height: 28, fontSize: 12, padding: "0 10px" }}>Duplicate</button>
                {campaign.status === "Active"
                  ? <button className="cm-btn cm-btn-ghost" style={{ height: 28, fontSize: 12, padding: "0 10px", color: "#f59e0b", borderColor: "#f59e0b" }}>Pause</button>
                  : <button className="cm-btn cm-btn-ghost" style={{ height: 28, fontSize: 12, padding: "0 10px" }}>Activate</button>
                }
              </div>
              <button className="cm-drawer-close" onClick={onClose}>✕</button>
            </div>
            <div className="cm-drawer-tabs">
              {["overview","audience","journey","timeline","analytics"].map((t) => (
                <button key={t} className={"cm-drawer-tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="cm-drawer-body">
              {tab === "overview" && (
                <>
                  <div className="cm-drawer-meta-grid">
                    <div className="cm-drawer-meta-item"><label>Campaign Type</label><span>{campaign.type}</span></div>
                    <div className="cm-drawer-meta-item"><label>Priority</label><span><PriorityDot priority={campaign.priority} /></span></div>
                    <div className="cm-drawer-meta-item"><label>Owner</label><span>{campaign.owner}</span></div>
                    <div className="cm-drawer-meta-item"><label>Created Date</label><span>{campaign.createdDate}</span></div>
                    <div className="cm-drawer-meta-item"><label>Scheduled</label><span>{campaign.scheduledDate}</span></div>
                    <div className="cm-drawer-meta-item"><label>Brand</label><span>{campaign.brand}</span></div>
                    <div className="cm-drawer-meta-item"><label>Region</label><span>{campaign.region}</span></div>
                    <div className="cm-drawer-meta-item"><label>Business Unit</label><span>{campaign.businessUnit}</span></div>
                    <div className="cm-drawer-meta-item"><label>Vertical</label><span>{campaign.journeyCategory}</span></div>
                    <div className="cm-drawer-meta-item"><label>Performance Score</label><span><ScoreBar score={campaign.performanceScore} /></span></div>
                  </div>

                  {/* Journey objective */}
                  {campaign.journeyObjective && (
                    <>
                      <div className="cm-drawer-section-title">Journey Objective</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{campaign.journeyObjective}</div>
                    </>
                  )}

                  <div className="cm-drawer-section-title">Budget</div>
                  <div className="cm-drawer-meta-grid">
                    <div className="cm-drawer-meta-item"><label>Total Budget</label><span>{fmtCurrency(campaign.budget)}</span></div>
                    <div className="cm-drawer-meta-item"><label>Spent</label><span>{fmtCurrency(campaign.budgetSpent)}</span></div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, color: "var(--text-muted)" }}>
                      <span>Budget utilisation</span><span>{budgetPct}%</span>
                    </div>
                    <div className="cm-score-bar" style={{ width: "100%", height: 8 }}>
                      <div className="cm-score-fill" style={{ width: budgetPct + "%", background: budgetPct > 90 ? "#ef4444" : budgetPct > 70 ? "#f59e0b" : "#10b981" }} />
                    </div>
                  </div>

                  <div className="cm-drawer-section-title">Channels</div>
                  <div className="cm-channels">{campaign.channels.map((ch) => <ChannelBadge key={ch} channel={ch} />)}</div>

                  <div className="cm-drawer-section-title">Tags</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {campaign.tags.map((t) => (
                      <span key={t} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--border)", color: "var(--text-muted)", background: "var(--bg-secondary)" }}>{t}</span>
                    ))}
                  </div>
                </>
              )}

              {tab === "audience" && (
                <>
                  <div className="cm-aud-stat-strip">
                    <div className="cm-aud-stat"><div className="cm-aud-stat-val">{fmtNum(campaign.audienceSize)}</div><div className="cm-aud-stat-label">Reach</div></div>
                    <div className="cm-aud-stat"><div className="cm-aud-stat-val">{campaign.metrics.openRate > 0 ? fmtNum(Math.round(campaign.audienceSize * campaign.metrics.openRate / 100)) : "—"}</div><div className="cm-aud-stat-label">Opened</div></div>
                    <div className="cm-aud-stat"><div className="cm-aud-stat-val">{campaign.metrics.ctr > 0 ? fmtNum(Math.round(campaign.audienceSize * campaign.metrics.ctr / 100)) : "—"}</div><div className="cm-aud-stat-label">Clicked</div></div>
                    <div className="cm-aud-stat"><div className="cm-aud-stat-val">{campaign.metrics.conversionRate > 0 ? fmtNum(Math.round(campaign.audienceSize * campaign.metrics.conversionRate / 100)) : "—"}</div><div className="cm-aud-stat-label">Converted</div></div>
                  </div>
                  <div className="cm-drawer-section-title">Segment</div>
                  <div className="cm-drawer-meta-grid">
                    <div className="cm-drawer-meta-item"><label>Segment Name</label><span>{campaign.segment}</span></div>
                    <div className="cm-drawer-meta-item"><label>Duration</label><span>{campaign.journeyDuration}</span></div>
                  </div>
                  {campaign.variantA && (
                    <>
                      <div className="cm-drawer-section-title">A/B Variants</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 160, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#e5c97a", marginBottom: 4 }}>VARIANT A</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{campaign.variantA}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 160, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#c4b5fd", marginBottom: 4 }}>VARIANT B</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{campaign.variantB}</div>
                        </div>
                      </div>
                    </>
                  )}
                  {campaign.metrics.openRate > 0 && (
                    <>
                      <div className="cm-drawer-section-title">Engagement Funnel</div>
                      {[
                        { label: "Delivered", pct: 98, color: "#3b82f6" },
                        { label: "Opened", pct: campaign.metrics.openRate, color: "#10b981" },
                        { label: "Clicked", pct: campaign.metrics.ctr, color: "#8b5cf6" },
                        { label: "Converted", pct: campaign.metrics.conversionRate, color: "#f59e0b" },
                      ].map((row) => (
                        <div key={row.label} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 12 }}>
                            <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
                            <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{row.pct.toFixed(1)}%</span>
                          </div>
                          <div className="cm-score-bar" style={{ width: "100%", height: 6 }}>
                            <div className="cm-score-fill" style={{ width: row.pct + "%", background: row.color }} />
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

              {tab === "journey" && <JourneyPanel campaign={campaign} onClose={() => {}} />}
              {tab === "timeline" && <ActivityTimeline events={campaign.timeline} />}

              {tab === "analytics" && (
                <div className="cm-analytics-grid">
                  <div className="cm-analytics-chart-card">
                    <div className="cm-analytics-chart-title">Open Rate Trend</div>
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart data={openTrendData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                        <defs><linearGradient id="gradOR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                        <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#8fa3b8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#8fa3b8" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }} />
                        <Area type="monotone" dataKey="v" stroke="#10b981" fill="url(#gradOR)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="cm-analytics-chart-card">
                    <div className="cm-analytics-chart-title">CTR Trend</div>
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart data={ctrTrendData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                        <defs><linearGradient id="gradCTR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b8de6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b8de6" stopOpacity={0}/></linearGradient></defs>
                        <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#8fa3b8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#8fa3b8" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }} />
                        <Area type="monotone" dataKey="v" stroke="#3b8de6" fill="url(#gradCTR)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="cm-analytics-chart-card">
                    <div className="cm-analytics-chart-title">Revenue (Monthly)</div>
                    <ResponsiveContainer width="100%" height={100}>
                      <BarChart data={revenueData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                        <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#8fa3b8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#8fa3b8" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtCurrency(v)} />
                        <Bar dataKey="v" fill="#8b5cf6" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="cm-analytics-chart-card">
                    <div className="cm-analytics-chart-title">Key KPIs</div>
                    <div style={{ paddingTop: 4 }}>
                      <div className="cm-kpi-row"><span className="cm-kpi-row-label">Open Rate</span><span className="cm-kpi-row-value">{campaign.metrics.openRate.toFixed(1)}%</span></div>
                      <div className="cm-kpi-row"><span className="cm-kpi-row-label">CTR</span><span className="cm-kpi-row-value">{campaign.metrics.ctr.toFixed(1)}%</span></div>
                      <div className="cm-kpi-row"><span className="cm-kpi-row-label">Conv. Rate</span><span className="cm-kpi-row-value">{campaign.metrics.conversionRate.toFixed(1)}%</span></div>
                      <div className="cm-kpi-row"><span className="cm-kpi-row-label">Revenue</span><span className="cm-kpi-row-value">{fmtCurrency(campaign.metrics.revenue)}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────
const EMPTY_FILTERS = {
  statuses: [], channels: [], categories: [],
  journeySlug: "",
  dateCreatedFrom: "", dateCreatedTo: "",
  scheduledFrom: "", scheduledTo: "",
  owner: "", priority: "", type: "",
  audienceSizeMin: "", audienceSizeMax: "",
  openRateMin: "", ctrMin: "",
};

export default function CampaignManager({ activatedSegments = [] }) {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState("campaigns");
  const [sourceSystem, setSourceSystem] = useState(() => readSelectedSourceSystem("sports"));
  const [persistedPublishedAudiences, setPersistedPublishedAudiences] = useState([]);
  const [publishedAudiencesLoading, setPublishedAudiencesLoading] = useState(true);
  const [publishedAudiencesError, setPublishedAudiencesError] = useState("");
  const sessionSourceById = useRef(new Map());

  useEffect(() => {
    const syncSourceSystem = () => {
      setSourceSystem(readSelectedSourceSystem("sports"));
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
    const controller = new AbortController();
    setPublishedAudiencesLoading(true);
    setPublishedAudiencesError("");
    fetch(`/api/segments/published?source_system=${encodeURIComponent(sourceSystem)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || `Published audiences request failed (${response.status})`);
        }
        return payload;
      })
      .then((payload) => {
        setPersistedPublishedAudiences(Array.isArray(payload.segments) ? payload.segments : []);
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setPersistedPublishedAudiences([]);
          setPublishedAudiencesError("Published audiences are temporarily unavailable.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPublishedAudiencesLoading(false);
      });
    return () => controller.abort();
  }, [sourceSystem]);

  const publishedAudiences = useMemo(
    () =>
      mergePublishedAudiences(
        persistedPublishedAudiences,
        activatedSegments,
        sourceSystem,
        sessionSourceById.current,
      ),
    [persistedPublishedAudiences, activatedSegments, sourceSystem],
  );

  function openInBuilder(slug) {
    navigate(`/campaigns-and-journeys?journey=${encodeURIComponent(slug)}`);
  }

  const [view, setView] = useState("list");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [activeStatusFilter, setActiveStatusFilter] = useState("");
  const [sort, setSort] = useState({ field: "scheduledDate", direction: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showJourneyPanel, setShowJourneyPanel] = useState(false);
  const [calDate, setCalDate] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [calSelectedDay, setCalSelectedDay] = useState(null);
  const [recentSearches] = useState(["Playoff", "Season Ticket", "Winback"]);

  const healthStats = useMemo(() => {
    const counts = { Active: 0, Draft: 0, Scheduled: 0, Paused: 0, Completed: 0, Failed: 0 };
    MOCK_CAMPAIGNS.forEach((c) => { if (counts[c.status] !== undefined) counts[c.status]++; });
    return counts;
  }, []);

  const filteredCampaigns = useMemo(() => {
    let list = MOCK_CAMPAIGNS;
    if (activeStatusFilter) list = list.filter((c) => c.status === activeStatusFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(s) ||
        c.journey.toLowerCase().includes(s) ||
        c.segment.toLowerCase().includes(s) ||
        c.owner.toLowerCase().includes(s) ||
        (c.journeyCategory || "").toLowerCase().includes(s) ||
        c.tags.some((t) => t.toLowerCase().includes(s))
      );
    }
    const f = appliedFilters;
    if (f.statuses.length) list = list.filter((c) => f.statuses.includes(c.status));
    if (f.channels.length) list = list.filter((c) => c.channels.some((ch) => f.channels.includes(ch)));
    if (f.categories.length) list = list.filter((c) => f.categories.includes(c.journeyCategory));
    if (f.journeySlug) list = list.filter((c) => c.journeySlug === f.journeySlug);
    if (f.dateCreatedFrom) list = list.filter((c) => c.createdDate >= f.dateCreatedFrom);
    if (f.dateCreatedTo) list = list.filter((c) => c.createdDate <= f.dateCreatedTo);
    if (f.scheduledFrom) list = list.filter((c) => c.scheduledDate && c.scheduledDate >= f.scheduledFrom);
    if (f.scheduledTo) list = list.filter((c) => c.scheduledDate && c.scheduledDate <= f.scheduledTo);
    if (f.owner) list = list.filter((c) => c.owner === f.owner);
    if (f.priority) list = list.filter((c) => c.priority === f.priority);
    if (f.type) list = list.filter((c) => c.type === f.type);
    if (f.audienceSizeMin) list = list.filter((c) => c.audienceSize >= Number(f.audienceSizeMin));
    if (f.audienceSizeMax) list = list.filter((c) => c.audienceSize <= Number(f.audienceSizeMax));
    if (f.openRateMin) list = list.filter((c) => c.metrics.openRate >= Number(f.openRateMin));
    if (f.ctrMin) list = list.filter((c) => c.metrics.ctr >= Number(f.ctrMin));

    const dirMul = sort.direction === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      const av = a[sort.field], bv = b[sort.field];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number") return (av - bv) * dirMul;
      return String(av).localeCompare(String(bv)) * dirMul;
    });
    return list;
  }, [search, appliedFilters, activeStatusFilter, sort]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (appliedFilters.statuses.length) n++;
    if (appliedFilters.channels.length) n++;
    if (appliedFilters.categories.length) n++;
    if (appliedFilters.journeySlug) n++;
    if (appliedFilters.dateCreatedFrom || appliedFilters.dateCreatedTo) n++;
    if (appliedFilters.scheduledFrom || appliedFilters.scheduledTo) n++;
    if (appliedFilters.owner) n++;
    if (appliedFilters.priority) n++;
    if (appliedFilters.type) n++;
    if (appliedFilters.audienceSizeMin || appliedFilters.audienceSizeMax) n++;
    if (appliedFilters.openRateMin || appliedFilters.ctrMin) n++;
    return n;
  }, [appliedFilters]);

  function handleSort(field) {
    setSort((s) => ({ field, direction: s.field === field && s.direction === "asc" ? "desc" : "asc" }));
    setPage(1);
  }

  function handleSelect(id) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function handleSelectAll(paged) {
    const allSel = paged.every((c) => selected.includes(c.id));
    if (allSel) setSelected((prev) => prev.filter((id) => !paged.some((c) => c.id === id)));
    else setSelected((prev) => [...new Set([...prev, ...paged.map((c) => c.id)])]);
  }

  function handleRowClick(campaign) {
    setSelectedCampaign(campaign);
    setDrawerOpen(true);
  }

  function handleHealthCardClick(statusKey) {
    setActiveStatusFilter((prev) => prev === statusKey ? "" : statusKey);
    setPage(1);
  }

  const totalRevenue = useMemo(() => MOCK_CAMPAIGNS.reduce((s, c) => s + c.metrics.revenue, 0), []);
  const liveList = useMemo(() => MOCK_CAMPAIGNS.filter((c) => c.metrics.openRate > 0), []);
  const avgOpenRate = liveList.length ? (liveList.reduce((s, c) => s + c.metrics.openRate, 0) / liveList.length).toFixed(1) : "0";
  const avgCtr = liveList.length ? (liveList.reduce((s, c) => s + c.metrics.ctr, 0) / liveList.length).toFixed(1) : "0";
  const avgConv = liveList.length ? (liveList.reduce((s, c) => s + c.metrics.conversionRate, 0) / liveList.length).toFixed(1) : "0";

  return (
    <div className="cm-page">
      {/* Header */}
      <div className="cm-header">
        <div className="cm-header-left">
          <h1>{mainTab === "reporting" ? "Campaign & journey reporting" : "Campaign Manager"}</h1>
          <span className="cm-subtitle">
            {mainTab === "reporting"
              ? `${RAW_JOURNEYS.length} audited preset definitions · source outcomes and global catalog evidence are kept separate`
              : `${MOCK_CAMPAIGNS.length} campaigns across ${PRECONFIGURED_JOURNEYS.length} journeys · ${ALL_CATEGORIES_LIST.join(", ")}`}
          </span>
        </div>
        <div className="cm-header-actions">
          <button className="cm-btn cm-btn-ghost">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Refresh
          </button>
          <button className="cm-btn cm-btn-ghost">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Export
          </button>
          <button className="cm-btn cm-btn-ghost" disabled={selected.length === 0}>
            Duplicate {selected.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(0,102,204,0.2)", color: "#3b8de6", padding: "1px 5px", borderRadius: 4 }}>{selected.length}</span>}
          </button>
          <button className="cm-btn cm-btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Create Campaign
          </button>
        </div>
      </div>

      {/* Main Tab Bar */}
      <div className="cm-main-tabs">
        <button className={"cm-main-tab" + (mainTab === "campaigns" ? " active" : "")} onClick={() => setMainTab("campaigns")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Campaigns
        </button>
        <button className={"cm-main-tab" + (mainTab === "reporting" ? " active" : "")} onClick={() => setMainTab("reporting")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Reporting
        </button>
      </div>

      {/* Reporting Tab */}
      {mainTab === "reporting" && (
        <div className="cm-reporting-wrap">
          <CampaignJourneyReportingView />
        </div>
      )}

      {/* Campaigns Tab Content */}
      {mainTab === "campaigns" && <>

      {/* Health Strip */}
      <div className="cm-health-strip">
        {HEALTH_META.map(({ key, label, color }) => (
          <HealthCard
            key={key || "total"}
            label={label}
            value={key === "" ? MOCK_CAMPAIGNS.length : healthStats[key] || 0}
            color={color}
            isActive={activeStatusFilter === key}
            onClick={() => handleHealthCardClick(key)}
          />
        ))}
      </div>

      <section className="cm-published-audiences" aria-labelledby="cm-published-audiences-title">
        <div className="cm-published-audiences__header">
          <div>
            <h2 id="cm-published-audiences-title">Available Published Audiences</h2>
            <p>
              Source-scoped audiences ready for campaign and journey configuration in{" "}
              {SOURCE_SYSTEM_LABELS[sourceSystem] ?? sourceSystem}.
            </p>
          </div>
          <span className="cm-published-audiences__count">
            {publishedAudiencesLoading ? "Loading…" : `${publishedAudiences.length} available`}
          </span>
        </div>
        {publishedAudiencesError ? (
          <div className="cm-published-audiences__message" role="status">
            {publishedAudiencesError}
          </div>
        ) : publishedAudiencesLoading ? (
          <div className="cm-published-audiences__message" role="status">
            Loading published audiences…
          </div>
        ) : publishedAudiences.length ? (
          <div className="cm-published-audiences__list">
            {publishedAudiences.map((audience) => (
              <article className="cm-published-audience" key={audience.id}>
                <div className="cm-published-audience__name">{audience.name || audience.id}</div>
                <div className="cm-published-audience__meta">
                  <span>{Number(audience.count ?? audience.total ?? audience._count ?? 0).toLocaleString()} profiles</span>
                  <span>{audience.status}</span>
                  <span className={audience.published ? "is-published" : ""}>
                    {audience.published ? "Published" : "Available this session"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="cm-published-audiences__message">
            No audiences have been published for this source yet.
          </div>
        )}
      </section>

      {/* Toolbar */}
      <div className="cm-toolbar">
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          campaigns={MOCK_CAMPAIGNS}
          recentSearches={recentSearches}
          onRecentClick={() => {}}
        />
        <button className={"cm-filter-toggle-btn" + (filterOpen ? " active" : "")} onClick={() => setFilterOpen((v) => !v)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Filters
          {activeFilterCount > 0 && <span className="cm-filter-badge">{activeFilterCount}</span>}
        </button>
        <div className="cm-view-toggle">
          <button className={"cm-view-btn" + (view === "list" ? " active" : "")} onClick={() => setView("list")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            List
          </button>
          <button className={"cm-view-btn" + (view === "calendar" ? " active" : "")} onClick={() => setView("calendar")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Calendar
          </button>
        </div>
        {view === "list" && (
          <span className="cm-count-label">{filteredCampaigns.length} of {MOCK_CAMPAIGNS.length}</span>
        )}
      </div>

      {/* Filter Panel */}
      {filterOpen && (
        <FilterPanel
          filters={filters}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onApply={() => { setAppliedFilters(filters); setPage(1); setFilterOpen(false); }}
          onReset={() => { setFilters(EMPTY_FILTERS); setAppliedFilters(EMPTY_FILTERS); setPage(1); }}
          onSave={() => {}}
        />
      )}

      {/* Bulk Action Bar */}
      {selected.length > 0 && view === "list" && (
        <div className="cm-bulk-bar">
          <span className="cm-bulk-count">{selected.length} selected</span>
          <button className="cm-btn cm-btn-ghost" style={{ height: 30, fontSize: 12, padding: "0 10px" }} onClick={() => setSelected([])}>Clear</button>
          <button className="cm-btn cm-btn-ghost" style={{ height: 30, fontSize: 12, padding: "0 10px" }}>Pause All</button>
          <button className="cm-btn cm-btn-ghost" style={{ height: 30, fontSize: 12, padding: "0 10px" }}>Activate All</button>
          <button className="cm-btn cm-btn-ghost" style={{ height: 30, fontSize: 12, padding: "0 10px" }}>Export Selected</button>
          <button className="cm-btn cm-btn-danger" style={{ height: 30, fontSize: 12, padding: "0 10px" }}>Delete</button>
        </div>
      )}

      {/* Main Content */}
      {view === "list" ? (
        <CampaignTable
          campaigns={filteredCampaigns}
          selected={selected}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          onSort={handleSort}
          sort={sort}
          onRowClick={handleRowClick}
          pageSize={pageSize}
          onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
          page={page}
          onPageChange={setPage}
          onView={(c) => { setSelectedCampaign(c); setDrawerOpen(true); }}
          onOpenBuilder={openInBuilder}
        />
      ) : (
        <>
          <CalendarView
            campaigns={MOCK_CAMPAIGNS}
            calDate={calDate}
            onDateChange={setCalDate}
            selectedDay={calSelectedDay}
            onDayClick={(dateStr, evs) => setCalSelectedDay((prev) => prev === dateStr ? null : dateStr)}
          />
          {calSelectedDay && (() => {
            const evs = MOCK_CAMPAIGNS.flatMap((c) =>
              (c.calendarEvents || []).filter((ev) => ev.date === calSelectedDay).map((ev) => ({ ...ev, campaignName: c.name, campaign: c }))
            );
            return (
              <div className="cm-cal-daydetail">
                <div className="cm-cal-daydetail__head">
                  <span>{calSelectedDay}</span>
                  <button className="cm-cal-daydetail__close" onClick={() => setCalSelectedDay(null)}>✕</button>
                </div>
                {evs.length === 0 ? (
                  <div className="cm-cal-daydetail__empty">No events on this day.</div>
                ) : (
                  <ul className="cm-cal-daydetail__list">
                    {evs.map((ev, i) => (
                      <li key={i} className="cm-cal-daydetail__item" onClick={() => { setSelectedCampaign(ev.campaign); setDrawerOpen(true); setCalSelectedDay(null); }}>
                        <span className="cm-cal-daydetail__dot" style={{ background: { Active:"#10b981", Scheduled:"#3b82f6", Draft:"#8b5cf6", Completed:"#64748b", Failed:"#ef4444", Paused:"#f59e0b" }[ev.status] || "#3b82f6" }} />
                        <div>
                          <div className="cm-cal-daydetail__name">{ev.campaignName}</div>
                          <div className="cm-cal-daydetail__type">{ev.type} · {ev.status}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Journey Panel */}
      {view === "list" && selectedCampaign && showJourneyPanel && (
        <JourneyPanel campaign={selectedCampaign} onClose={() => setShowJourneyPanel(false)} />
      )}
      {view === "list" && selectedCampaign && !drawerOpen && (
        <div style={{ marginTop: 16 }}>
          <button className="cm-btn cm-btn-ghost" onClick={() => setShowJourneyPanel((v) => !v)}>
            {showJourneyPanel ? "Hide" : "Show"} Journey Association — {selectedCampaign.journey}
          </button>
        </div>
      )}

      {/* Analytics Strip */}
      {view === "list" && (
        <div className="cm-analytics-strip">
          <div className="cm-analytics-stat-card">
            <div className="cm-analytics-stat-label">Total Revenue</div>
            <div className="cm-analytics-stat-value">{fmtCurrency(totalRevenue)}</div>
            <div className="cm-analytics-stat-sub">across all live campaigns</div>
          </div>
          <div className="cm-analytics-stat-card">
            <div className="cm-analytics-stat-label">Avg Open Rate</div>
            <div className="cm-analytics-stat-value">{avgOpenRate}%</div>
            <div className="cm-analytics-stat-sub">{liveList.length} active campaigns</div>
          </div>
          <div className="cm-analytics-stat-card">
            <div className="cm-analytics-stat-label">Avg CTR</div>
            <div className="cm-analytics-stat-value">{avgCtr}%</div>
            <div className="cm-analytics-stat-sub">click-through rate</div>
          </div>
          <div className="cm-analytics-stat-card">
            <div className="cm-analytics-stat-label">Avg Conversion</div>
            <div className="cm-analytics-stat-value">{avgConv}%</div>
            <div className="cm-analytics-stat-sub">conversion rate</div>
          </div>
        </div>
      )}

      {/* Drawer */}
      <CampaignDrawer campaign={selectedCampaign} open={drawerOpen} onClose={() => setDrawerOpen(false)} onOpenBuilder={openInBuilder} />

      </>}
    </div>
  );
}
