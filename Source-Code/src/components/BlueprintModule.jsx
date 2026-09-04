import { useEffect, useMemo, useState } from "react";
import { FlowchartCanvas } from "./FlowchartCanvas";
import "./component.css"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
} from "recharts";
import CPieChart from "../idres/components/CPieChart";

const NODE_KIND_OPTIONS = [
  ["start", "Start pill"],
  ["action", "Action box"],
  ["decision", "Decision diamond"],
  ["wait", "Wait"],
  ["holdout", "Holdout"],
  ["split", "A/B split"],
  ["end", "Exit pill"],
  ["endDashed", "Exit dashed"],
];

const EDGE_TYPE_OPTIONS = [
  ["flow", "Flow"],
  ["yes", "Yes"],
  ["no", "No"],
  ["holdout", "Holdout"],
  ["varA", "Variant A"],
  ["varB", "Variant B"],
];

const SOURCE_SYSTEM_TO_JOURNEY_CATEGORY = {
  sports: "sports",
  media: "media",
  telecom: "telecom",
  automotive: "automotive",
};

function readIndustryJourneyCategory() {
  if (typeof window === "undefined") {
    return "all";
  }
  try {
    const sourceSystem = String(window.localStorage.getItem("cdp_source_system") ?? "")
      .trim()
      .toLowerCase();
    return SOURCE_SYSTEM_TO_JOURNEY_CATEGORY[sourceSystem] ?? "all";
  } catch {
    return "all";
  }
}

function formatReportNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatReportCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}



function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${color}1f, transparent 55%)`,
        }}
      />

      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${color}22`,
          color: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          zIndex: 1,
        }}
      >
        {icon}
      </div>

      <div style={{ display: "flex", flexDirection: "column", zIndex: 1 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>

        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
          {value}
        </div>

        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

function isCustomJourney(journey) {
  const name = String(journey?.name ?? "").trim().toLowerCase();
  return name === "new journey";
}

function resolveJourneyCardStatus(journey) {
  const status = String(journey?.status ?? journey?.runStatus ?? "").trim().toLowerCase();
  const explicitInactive = journey?.active === false || journey?.isActive === false;
  if (explicitInactive || status === "inactive" || status === "paused") {
    return "needs-review";
  }
  if (status === "in qa review" || status === "qa" || status.includes("qa")) {
    return "in-qa-review";
  }
  if (status === "ready for activation" || status === "ready") {
    return "ready-for-activation";
  }
  if (status === "production ready" || status === "active" || journey?.active === true || journey?.isActive === true) {
    return "production-ready";
  }
  if (status === "draft") {
    return "draft";
  }
  return "production-ready";
}

function EmptyInspector() {
  return (
    <div className="inspector-empty">
      <div className="inspector-empty-mark">EDIT</div>
      <p>Select a node or arrow to customize labels, shape, placement, routing, and config details.</p>
    </div>
  );
}

function NodeInspector({
  node,
  detail,
  lanes,
  onDeleteSelection,
  onNodeFieldChange,
  onNodeLineChange,
  onDetailChange,
  onDetailRowChange,
  onAddDetailRow,
  onRemoveDetailRow,
}) {
  if (!node || !detail) {
    return <EmptyInspector />;
  }

  const titleLines = [...(node.title ?? []), ""].slice(0, 2);
  const subtitleLines = [...(node.subtitle ?? []), ""].slice(0, 2);

  return (
    <div className="inspector-body">
      <div className="inspector-title" style={{ color: detail.accent }}>
        {detail.title || titleLines.join(" ") || node.id}
      </div>
      <div className="inspector-meta">
        {node.id} / {node.kind}
      </div>
      <div className="inspector-divider" style={{ background: detail.accent }} />

      <div className="inspector-actions">
        <button type="button" className="button secondary small" onClick={onDeleteSelection}>
          Remove Node
        </button>
      </div>

      <div className="section-label">Shape & placement</div>
      <div className="two-col">
        <label className="field compact">
          <span className="field-label small">Lane</span>
          <select
            className="field-input"
            value={node.lane}
            onChange={(event) => onNodeFieldChange("lane", event.target.value)}
          >
            {lanes.map((lane) => (
              <option key={lane.id} value={lane.id}>
                {lane.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field compact">
          <span className="field-label small">Shape</span>
          <select
            className="field-input"
            value={node.kind}
            onChange={(event) => onNodeFieldChange("kind", event.target.value)}
          >
            {NODE_KIND_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="three-col">
        <label className="field compact">
          <span className="field-label small">Column</span>
          <input
            className="field-input inspector-input"
            type="number"
            value={node.column}
            onChange={(event) => onNodeFieldChange("column", Number(event.target.value))}
          />
        </label>
        <label className="field compact">
          <span className="field-label small">Accent</span>
          <input
            className="field-input color-input"
            type="color"
            value={node.accent}
            onChange={(event) => onNodeFieldChange("accent", event.target.value)}
          />
        </label>
        <label className="field compact">
          <span className="field-label small">Variant badge</span>
          <input
            className="field-input inspector-input"
            value={node.variantBadge ?? ""}
            onChange={(event) => onNodeFieldChange("variantBadge", event.target.value || undefined)}
          />
        </label>
      </div>

      <div className="section-label">Canvas text</div>
      <label className="field compact">
        <span className="field-label small">Title line 1</span>
        <input
          className="field-input inspector-input"
          value={titleLines[0]}
          onChange={(event) => onNodeLineChange("title", 0, event.target.value)}
        />
      </label>
      <label className="field compact">
        <span className="field-label small">Title line 2</span>
        <input
          className="field-input inspector-input"
          value={titleLines[1]}
          onChange={(event) => onNodeLineChange("title", 1, event.target.value)}
        />
      </label>
      <label className="field compact">
        <span className="field-label small">Subtitle line 1</span>
        <input
          className="field-input inspector-input"
          value={subtitleLines[0]}
          onChange={(event) => onNodeLineChange("subtitle", 0, event.target.value)}
        />
      </label>
      <label className="field compact">
        <span className="field-label small">Subtitle line 2</span>
        <input
          className="field-input inspector-input"
          value={subtitleLines[1]}
          onChange={(event) => onNodeLineChange("subtitle", 1, event.target.value)}
        />
      </label>

      <div className="section-label">Inspector details</div>
      <label className="field compact">
        <span className="field-label small">Inspector title</span>
        <input
          className="field-input inspector-input"
          value={detail.title}
          onChange={(event) => onDetailChange("title", event.target.value)}
        />
      </label>
      <label className="field compact">
        <span className="field-label small">Context note</span>
        <textarea
          className="field-input inspector-textarea"
          value={detail.note}
          onChange={(event) => onDetailChange("note", event.target.value)}
        />
      </label>

      <div className="section-label">Property rows</div>
      <div className="inspector-actions">
        <button type="button" className="button secondary small" onClick={onAddDetailRow}>
          Add Property
        </button>
      </div>
      {detail.rows.map((row, index) => (
        <div className="inspector-editor-card" key={`${node.id}-row-${index}`}>
          <label className="field compact">
            <span className="field-label small">Key</span>
            <input
              className="field-input inspector-input"
              value={row.key}
              onChange={(event) => onDetailRowChange(index, "key", event.target.value)}
            />
          </label>
          <label className="field compact">
            <span className="field-label small">Value</span>
            <textarea
              className="field-input inspector-textarea short"
              value={row.value}
              onChange={(event) => onDetailRowChange(index, "value", event.target.value)}
            />
          </label>
          <button type="button" className="button secondary small" onClick={() => onRemoveDetailRow(index)}>
            Remove
          </button>
        </div>
      ))}

      <div className="section-label">Canvas coordinates</div>
      <div className="three-col">
        <label className="field compact">
          <span className="field-label small">X</span>
          <input
            className="field-input inspector-input"
            type="number"
            value={node.x ?? ""}
            onChange={(event) => onNodeFieldChange("x", event.target.value === "" ? undefined : Number(event.target.value))}
          />
        </label>
        <label className="field compact">
          <span className="field-label small">Y</span>
          <input
            className="field-input inspector-input"
            type="number"
            value={node.y ?? ""}
            onChange={(event) => onNodeFieldChange("y", event.target.value === "" ? undefined : Number(event.target.value))}
          />
        </label>
        <label className="field compact">
          <span className="field-label small">Offset Y</span>
          <input
            className="field-input inspector-input"
            type="number"
            value={node.offsetY ?? 0}
            onChange={(event) => onNodeFieldChange("offsetY", Number(event.target.value))}
          />
        </label>
      </div>

      <div className="info-box" style={{ borderColor: `${detail.accent}55`, color: detail.accent }}>
        Drag nodes directly on the canvas or fine-tune the coordinates here for exact placement.
      </div>
    </div>
  );
}

function EdgeInspector({ edge, nodes, onDeleteSelection, onEdgeFieldChange }) {
  if (!edge) {
    return <EmptyInspector />;
  }

  return (
    <div className="inspector-body">
      <div className="inspector-title" style={{ color: "#9AC9FF" }}>
        Arrow / connector
      </div>
      <div className="inspector-meta">
        {edge.id} / {edge.type}
      </div>
      <div className="inspector-divider" style={{ background: "#2680EB" }} />

      <div className="inspector-actions">
        <button type="button" className="button secondary small" onClick={onDeleteSelection}>
          Remove Arrow
        </button>
      </div>

      <div className="section-label">Routing</div>
      <label className="field compact">
        <span className="field-label small">From node</span>
        <select
          className="field-input"
          value={edge.from}
          onChange={(event) => onEdgeFieldChange("from", event.target.value)}
        >
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.id} - {(node.title ?? []).filter(Boolean).join(" ")}
            </option>
          ))}
        </select>
      </label>
      <label className="field compact">
        <span className="field-label small">To node</span>
        <select
          className="field-input"
          value={edge.to}
          onChange={(event) => onEdgeFieldChange("to", event.target.value)}
        >
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.id} - {(node.title ?? []).filter(Boolean).join(" ")}
            </option>
          ))}
        </select>
      </label>
      <label className="field compact">
        <span className="field-label small">Arrow type</span>
        <select
          className="field-input"
          value={edge.type}
          onChange={(event) => onEdgeFieldChange("type", event.target.value)}
        >
          {EDGE_TYPE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field compact">
        <span className="field-label small">Arrow label</span>
        <input
          className="field-input inspector-input"
          value={edge.label}
          onChange={(event) => onEdgeFieldChange("label", event.target.value)}
        />
      </label>

      <div className="info-box info-blue">
        Use this panel to reroute branches, update A/B connectors, or rename decision labels like Yes, No, or Holdout.
      </div>
    </div>
  );
}

function JourneyCatalogue({

  categories,
  subcategories,
  journeys,
  report,
  onSelectJourney,
  categoryFilter,
  subCategoryFilter,
  onCategoryChange,
  onSubCategoryChange,

}) {


  const [manualCategorySelection, setManualCategorySelection] = useState(false);

  useEffect(() => {
    onSubCategoryChange("all");
  }, [categoryFilter]);

  useEffect(() => {
    if (categoryFilter !== "all" && !categories.some((category) => category.id === categoryFilter)) {
      onCategoryChange("all");
    }
  }, [categories, categoryFilter, onCategoryChange]);

  useEffect(() => {
    if (manualCategorySelection) {
      return;
    }
    const contextualCategory = readIndustryJourneyCategory();
    if (
      contextualCategory !== "all" &&
      categories.some((category) => category.id === contextualCategory) &&
      contextualCategory !== categoryFilter
    ) {
      onCategoryChange(contextualCategory);
    }
  }, [categories, categoryFilter, manualCategorySelection]);

  const categoryMap = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc.set(category.id, category);
      return acc;
    }, new Map());
  }, [categories]);

  const categoryOptions = useMemo(() => {
    const preferred = ["sports", "media", "telecom", "automotive"];
    const known = preferred
      .map((id) => categories.find((category) => category.id === id))
      .filter(Boolean);
    const remaining = categories
      .filter((category) => !preferred.includes(category.id))
      .sort((left, right) => left.name.localeCompare(right.name));
    return [...known, ...remaining];
  }, [categories]);

  const subCategoryOptions = useMemo(() => {
    const scoped = categoryFilter === "all"
      ? subcategories
      : subcategories.filter((subCategory) => subCategory.categoryId === categoryFilter);
    return [...scoped].sort((left, right) => {
      const categoryDiff = left.categoryId.localeCompare(right.categoryId);
      if (categoryDiff !== 0) {
        return categoryDiff;
      }
      return left.name.localeCompare(right.name);
    });
  }, [categoryFilter, subcategories]);

  const filteredJourneys = useMemo(() => {
    const selectedByVertical =
      categoryFilter === "all" ? journeys : journeys.filter((journey) => journey.categoryId === categoryFilter);
    let selected = selectedByVertical;
    if (subCategoryFilter !== "all") {
      if (categoryFilter === "all") {
        selected = selectedByVertical.filter(
          (journey) => `${journey.categoryId}::${journey.subCategoryId ?? "general"}` === subCategoryFilter,
        );
      } else {
        selected = selectedByVertical.filter((journey) => journey.subCategoryId === subCategoryFilter);
      }
    }
    return [...selected].sort((left, right) => left.name.localeCompare(right.name));
  }, [journeys, categoryFilter, subCategoryFilter]);

  const groupedJourneys = useMemo(() => {
    const groups = new Map();
    filteredJourneys.forEach((journey) => {
      const subCategoryId = journey.subCategoryId ?? "general";
      const key = `${journey.categoryId}::${subCategoryId}`;
      const existing = groups.get(key);
      if (existing) {
        existing.journeys.push(journey);
        return;
      }
      groups.set(key, {
        key,
        categoryId: journey.categoryId,
        categoryName: categoryMap.get(journey.categoryId)?.name ?? journey.categoryName ?? "Journey",
        subCategoryId,
        subCategoryName: journey.subCategoryName ?? "General",
        journeys: [journey],
      });
    });

    const categoryOrder = new Map(categoryOptions.map((category, index) => [category.id, index]));
    return [...groups.values()].sort((left, right) => {
      const categoryDiff = (categoryOrder.get(left.categoryId) ?? 999) - (categoryOrder.get(right.categoryId) ?? 999);
      if (categoryDiff !== 0) {
        return categoryDiff;
      }
      return left.subCategoryName.localeCompare(right.subCategoryName);
    });
  }, [categoryMap, categoryOptions, filteredJourneys]);

  const verticalGroups = useMemo(() => {
    const map = new Map();
    groupedJourneys.forEach((group) => {
      const existing = map.get(group.categoryId);
      if (existing) {
        existing.sections.push(group);
        existing.totalJourneys += group.journeys.length;
        return;
      }
      map.set(group.categoryId, {
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        description: categoryMap.get(group.categoryId)?.description ?? "",
        sections: [group],
        totalJourneys: group.journeys.length,
      });
    });
    return [...map.values()];
  }, [categoryMap, groupedJourneys]);

  const overviewStats = useMemo(() => {
    const sectionMap = new Map();
    filteredJourneys.forEach((journey) => {
      const categoryName = categoryMap.get(journey.categoryId)?.name ?? journey.categoryName ?? "Journey";
      const subCategoryName = journey.subCategoryName ?? "General";
      const key = `${journey.categoryId}::${journey.subCategoryId ?? "general"}`;
      const existing = sectionMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        sectionMap.set(key, { key, categoryName, subCategoryName, count: 1 });
      }
    });

    const categoryRows = categoryOptions
      .map((category) => ({
        ...category,
        count: filteredJourneys.filter((journey) => journey.categoryId === category.id).length,
      }))
      .filter((category) => category.count > 0);

    const explicitActive = filteredJourneys.filter((journey) => {
      const status = String(journey.status ?? journey.runStatus ?? "").toLowerCase();
      return journey.active === true || journey.isActive === true || status === "active";
    }).length;
    const explicitInactive = filteredJourneys.filter((journey) => {
      const status = String(journey.status ?? journey.runStatus ?? "").toLowerCase();
      return journey.active === false || journey.isActive === false || status === "inactive";
    }).length;
    const active = explicitActive > 0 ? explicitActive : filteredJourneys.length - explicitInactive;
    const inactive = Math.max(0, filteredJourneys.length - active);
    const customCount = filteredJourneys.filter((journey) => isCustomJourney(journey)).length;
    const presetCount = Math.max(0, filteredJourneys.length - customCount);

    return {
      total: filteredJourneys.length,
      active,
      inactive,
      preset: presetCount,
      custom: customCount,
      sections: sectionMap.size,
      categoryRows,
      topSections: [...sectionMap.values()].sort((left, right) => right.count - left.count).slice(0, 5),
      recentJourneys: filteredJourneys.slice(0, 5),
    };
  }, [categoryMap, categoryOptions, filteredJourneys]);

  return (
    <section className="workspace-panel">
      <div className="workspace-head">
        <div>
          <div className="workspace-title">Campaigns & Journeys</div>
          <div className="workspace-copy">
            Start in the catalogue, pick any saved journey, and open it in the Journey Editor for updates, QA prep, and save-as flows.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label className="field compact" style={{ minWidth: 220 }}>
            <span className="field-label small">Filter by vertical</span>
            <select
              className="field-input"
              value={categoryFilter}
              onChange={(event) => {
                setManualCategorySelection(true);
                onCategoryChange(event.target.value);
              }}
            >
              <option value="all">All Journeys</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field compact" style={{ minWidth: 240 }}>
            <span className="field-label small">Filter by section</span>
            <select className="field-input" value={subCategoryFilter} onChange={(event) => onSubCategoryChange(event.target.value)}>
              <option value="all">{categoryFilter === "all" ? "All Sections" : "All Sections in Vertical"}</option>
              {subCategoryOptions.map((subCategory) => (
                <option
                  key={`${subCategory.categoryId}-${subCategory.id}`}
                  value={categoryFilter === "all" ? `${subCategory.categoryId}::${subCategory.id}` : subCategory.id}
                >
                  {categoryFilter === "all"
                    ? `${categoryMap.get(subCategory.categoryId)?.name ?? subCategory.categoryId} / ${subCategory.name}`
                    : subCategory.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>



      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginTop: 12,
          marginBottom: 16,
        }}
      >
        <KpiCard
          label="Total Journeys"
          value={overviewStats.total}
          sub="catalogue size"
          color="#E5C97A"
          icon="🧭"
        />

        <KpiCard
          label="Active Journeys"
          value={overviewStats.active}
          sub="currently running"
          color="#22c55e"
          icon=" "
        />

        <KpiCard
          label="Inactive Journeys"
          value={overviewStats.inactive}
          sub="paused / inactive"
          color="#f59e0b"
          icon="⏸"
        />

        <KpiCard
          label="Prebuilt Journeys"
          value={overviewStats.preset}
          sub="template journeys"
          color="#2680eb"
          icon="📦"
        />

        <KpiCard
          label="Custom Journeys"
          value={overviewStats.custom}
          sub="user created"
          color="#14b8a6"
          icon="✨"
        />
      </div>

      <div className="stack-panel">
        {verticalGroups.length ? (
          verticalGroups.map((vertical) => (
            <div className="content-card" key={vertical.categoryId}>

              <div className="content-card-head">
                <div>
                  <div className="content-card-title">{vertical.categoryName}</div>
                  <div className="helper-text no-top">
                    {vertical.description || "Journey catalogue"}
                  </div>
                </div>
                <span className="badge subtle">{vertical.totalJourneys} journeys</span>
              </div>
              <div className="content-card-body">
                <div className="section-card-grid">
                  {vertical.sections.map((section) => (
                    <div className="section-card" key={section.key}>
                      <div className="section-card-head">
                        <div className="section-card-title">{section.subCategoryName}</div>
                        <span className="badge subtle">{section.journeys.length}</span>
                      </div>
                      <div className="section-card-body">
                        {section.journeys.map((journey) => {
                          const isActive = journey.active !== false;
                          const isCustom = isCustomJourney(journey);
                          return (
                            <button
                              key={journey.slug}
                              type="button"
                              className={`journey-mini-card ${isActive ? "state-active" : "state-inactive"}`}
                              onClick={() => onSelectJourney(journey.slug)}
                            >
                              <div className="journey-mini-title">{journey.name}</div>
                              <span className={`journey-card-status-tag ${isActive ? "is-active" : "is-inactive"}`}>
                                {isActive ? "Active" : "Inactive"}
                              </span>
                              <span className={`journey-card-tag ${isCustom ? "tag-custom" : "tag-prebuilt"}`}>
                                {isCustom ? "Custom" : "Pre Built"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="content-card">
            <div className="content-card-body">
              <div className="helper-text">No journeys found for the selected filters.</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}



function ApiCampaignsJourneysPanel({ report, journeys = [] }) {
  const [selectedExtraChartId, setSelectedExtraChartId] = useState("");

  if (!report?.summary) {
    return null;
  }

  const summary = report.summary;
  const funnel = Array.isArray(report.delivery_funnel) ? report.delivery_funnel : [];
  const channels = Array.isArray(report.channel_mix) ? report.channel_mix : [];
  const campaigns = Array.isArray(report.campaign_performance) ? report.campaign_performance.slice(0, 5) : [];
  const maxFunnel = Math.max(...funnel.map((item) => Number(item.value || 0)), 1);

  const funnelChartData = funnel.map((item, index) => ({
    name: item.stage,
    value: Number(item.value || 0),
    color: ["#1f6fb8", "#3b8ddb", "#7fb6e9", "#b5d6f3", "#d8ebfa"][index % 5],
  }));

  const channelPieData = channels.map((item, index) => ({
    label: item.channel,
    name: item.channel,
    value: Number(item.value || 0),
    count: Number(item.count || 0),
    color: item.color || ["#3b8ddb", "#22a979", "#7c73dd", "#66a329", "#f59e0b"][index % 5],
  }));
  const performanceRateTrend = Array.isArray(report.performance_rate_trend) ? report.performance_rate_trend : [];
  const revenueTrend = Array.isArray(report.revenue_trend) ? report.revenue_trend : [];
  const channelEffectiveness = Array.isArray(report.channel_effectiveness) ? report.channel_effectiveness : [];
  const campaignComparison = Array.isArray(report.top_campaigns_comparison) ? report.top_campaigns_comparison : [];
  const journeyFunnel = Array.isArray(report.journey_completion_funnel) ? report.journey_completion_funnel : [];
  const maxJourneyFunnel = Math.max(...journeyFunnel.map((item) => Number(item.value || 0)), 1);
  const safeJourneys = Array.isArray(journeys) ? journeys : [];
  const totalJourneyCount = safeJourneys.length || Number(summary.total_journeys || summary.active_journeys || 0);
  const activeJourneyCount = safeJourneys.length
    ? safeJourneys.filter((journey) => journey.active !== false).length
    : Number(summary.active_journeys || 0);
  const inactiveJourneyCount = Math.max(0, totalJourneyCount - activeJourneyCount);
  const customJourneyCount = safeJourneys.filter((journey) => isCustomJourney(journey)).length;
  const prebuiltJourneyCount = Math.max(0, totalJourneyCount - customJourneyCount);
  const reportMetricCards = [
    { label: "Total Journeys", value: formatReportNumber(totalJourneyCount), sub: "catalogue size", color: "#E5C97A", icon: "J" },
    { label: "Active Journeys", value: formatReportNumber(activeJourneyCount), sub: "currently running", color: "#22c55e", icon: "A" },
    { label: "Inactive Journeys", value: formatReportNumber(inactiveJourneyCount), sub: "paused / inactive", color: "#f59e0b", icon: "I" },
    { label: "Prebuilt Journeys", value: formatReportNumber(prebuiltJourneyCount), sub: "template journeys", color: "#2680eb", icon: "P" },
    { label: "Custom Journeys", value: formatReportNumber(customJourneyCount), sub: "user created", color: "#14b8a6", icon: "C" },
  ];
  const reportChartOptions = [
    {
      id: "delivery-funnel",
      title: "Delivery Funnel",
      defaultVisible: true,
      render: () => (
        <div className="section-card">
          <div className="section-card-head"><div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "5px" }}>Delivery Funnel</div></div>
          <div className="section-card-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart layout="vertical" data={funnelChartData} margin={{ top: 12, right: 18, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" horizontal={false} />
                <XAxis type="number" domain={[0, maxFunnel]} tickFormatter={formatReportNumber} tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 12, fill: "var(--text-muted)", fontWeight: 800 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [formatReportNumber(value), "Count"]} cursor={{ fill: "rgba(59, 130, 246, 0.06)" }} />
                <Bar dataKey="value" radius={[5, 5, 5, 5]}>
                  {funnelChartData.map((entry) => <Cell key={`funnel-${entry.name}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ),
    },
    {
      id: "channel-mix",
      title: "Channel Mix",
      defaultVisible: true,
      render: () => (
        <div className="section-card">
          <div className="section-card-head">
            <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "5px" }}>
              Channel Mix
              </div>
            </div>
          <div className="section-card-body">
            <CPieChart compact 
            height={260} 
            title="" 
            note="" 
            centerLabel="" 
            data={channelPieData} 
            showLegend={true} 
            showCenter={false} />
          </div>
        </div>
      ),
    },
    {
      id: "performance-rate-trend",
      title: "Performance Rate Trend",
      defaultVisible: true,
      render: () => (
        <div className="section-card">
          <div className="section-card-head"><div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "5px" }}>Performance Rate Trend</div></div>
          <div className="section-card-body">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={performanceRateTrend} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(value) => [`${Number(value || 0).toFixed(1)}%`, ""]} />
                <Legend />
                <Line type="monotone" dataKey="delivery_rate" name="Delivery Rate %" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="open_rate" name="Open Rate %" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="click_rate" name="Click Rate %" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ),
    },
    {
      id: "revenue-trend",
      title: "Revenue Trend",
      defaultVisible: true,
      render: () => (
        <div className="section-card">
          <div className="section-card-head"><div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "5px" }}>Revenue Trend</div></div>
          <div className="section-card-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueTrend} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} tickFormatter={formatReportCurrency} />
                <Tooltip formatter={(value) => [formatReportCurrency(value), "Revenue"]} />
                <Bar dataKey="revenue" fill="#14b8a6" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ),
    },
    {
      id: "channel-effectiveness",
      title: "Channel Effectiveness",
      render: () => (
        <div className="section-card">
          <div className="section-card-head"><div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "5px" }}>Channel Effectiveness</div></div>
          <div className="section-card-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={channelEffectiveness} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" />
                <XAxis dataKey="channel" tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(value) => [`${Number(value || 0).toFixed(1)}%`, ""]} />
                <Legend />
                <Bar dataKey="open_rate" name="Open Rate %" fill="#3b82f6" radius={[5, 5, 0, 0]} />
                <Bar dataKey="click_rate" name="Click Rate %" fill="#f59e0b" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ),
    },
    {
      id: "top-campaigns-comparison",
      title: "Top Campaigns Comparison",
      render: () => (
        <div className="section-card">
          <div className="section-card-head"><div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "5px" }}>Top Campaigns Comparison</div></div>
          <div className="section-card-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart layout="vertical" data={campaignComparison} margin={{ top: 12, right: 18, bottom: 8, left: 132 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="campaign" tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} width={132} />
                <Tooltip formatter={(value) => [`${Number(value || 0).toFixed(1)}%`, ""]} />
                <Legend />
                <Bar dataKey="open_rate" name="Open Rate %" fill="#3b82f6" radius={[5, 5, 5, 5]} />
                <Bar dataKey="click_rate" name="Click Rate %" fill="#f59e0b" radius={[5, 5, 5, 5]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ),
    },
    {
      id: "journey-completion-funnel",
      title: "Journey Completion Funnel",
      render: () => (
        <div className="section-card">
          <div className="section-card-head"><div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "5px" }}>Journey Completion Funnel</div></div>
          <div className="section-card-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart layout="vertical" data={journeyFunnel} margin={{ top: 12, right: 24, bottom: 8, left: 18 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" horizontal={false} />
                <XAxis type="number" domain={[0, maxJourneyFunnel]} tickFormatter={formatReportNumber} tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} />
                <YAxis type="category" dataKey="stage" width={92} tick={{ fontSize: 12, fill: "var(--text-muted)", fontWeight: 800 }} />
                <Tooltip formatter={(value) => [formatReportNumber(value), "Profiles"]} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[5, 5, 5, 5]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ),
    },
  ];
  const visibleReportCharts = reportChartOptions.filter((chart) => chart.defaultVisible || chart.id === selectedExtraChartId);
  const extraReportCharts = reportChartOptions.filter((chart) => !chart.defaultVisible);
  const totalDeliveries = channels.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0
  );
  return (
    <div className="content-card" style={{ marginTop: 12, marginBottom: 16 }}>
      <div className="content-card-head">
        <div>
          <div style={{

            fontSize: "20px",
            fontWeight: "700",
            color: "var(--text-primary)",
            marginBottom: "5px",
          }}>Campaigns & Journeys Performance</div>
          <div className="helper-text no-top">
            {String(report.source_system ?? "source").toUpperCase()} / {report.date_range?.label ?? "Current window"}
          </div>
        </div>
        <span className="badge subtle">{summary.total_campaigns ?? campaigns.length} campaigns</span>
      </div>
      <div className="content-card-body">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginBottom: 14,
          }}
        >
          {reportMetricCards.map((card) => (
            <KpiCard
              key={card.label}
              label={card.label}
              value={card.value}
              sub={card.sub}
              color={card.color}
              icon={card.icon}
            />
          ))}
          {false && (
            <>
              <KpiCard
                label="Total Sent"
                value={formatReportNumber(summary.total_sent)}
                sub="all channels"
                color="#64748b"
                icon="📤"
              />
              <KpiCard
                label="Delivery Rate"
                value={`${summary.delivery_rate ?? 0}%`}
                sub="delivered"
                color="#22c55e"
                icon=" "
              />
              <KpiCard
                label="Open Rate"
                value={`${summary.open_rate ?? 0}%`}
                sub="engagement"
                color="#3b82f6"
                icon="👁️"
              />
              <KpiCard
                label="Click Rate"
                value={`${summary.click_rate ?? 0}%`}
                sub="traffic"
                color="#f59e0b"
                icon="🖱️"
              />
              <KpiCard
                label="Revenue"
                value={formatReportCurrency(summary.revenue)}
                sub="attributed"
                color="#14b8a6"
                icon="💰"
              />
              <KpiCard
                label="Conversion Rate"
                value={`${summary.conversion_rate ?? 0}%`}
                sub="converted / sent"
                color="#22c55e"
                icon="CV"
              />
              <KpiCard
                label="CTOR"
                value={`${summary.click_to_open_rate ?? 0}%`}
                sub="clicks / opens"
                color="#6366f1"
                icon="CT"
              />
              <KpiCard
                label="Opt-out Rate"
                value={`${summary.opt_out_rate ?? 0}%`}
                sub="opt-outs / delivered"
                color="#f97316"
                icon="OO"
              />
              <KpiCard
                label="Revenue / Conversion"
                value={formatReportCurrency(summary.revenue_per_conversion)}
                sub="revenue efficiency"
                color="#14b8a6"
                icon="RC"
              />
              <KpiCard
                label="Active Journeys"
                value={formatReportNumber(summary.active_journeys)}
                sub="multi-step journeys"
                color="#8b5cf6"
                icon="AJ"
              />
              <KpiCard
                label="Bounce Rate"
                value={`${summary.bounce_rate ?? 0}%`}
                sub="bounce"
                color="#ef4444"
                icon="↩️"
              />
            </>
          )}
        </div>

        <div className="report-chart-toolbar" style={{
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          padding: "12px 14px",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          background: "var(--bg-card)",
        }}>
          <div>
            <strong>Reporting Charts</strong><br></br>
            <span>Default view shows the primary 4 charts. Choose another chart to add below.</span>
          </div>
          <select
            value={selectedExtraChartId}
            onChange={(event) => setSelectedExtraChartId(event.target.value)}
            style={{
              minWidth: "230px",
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              font: "inherit",
              fontSize: "12px",
              fontWeight: "700",
            }}
          >
            <option value="">Select additional chart</option>
            {extraReportCharts.map((chart) => (
              <option key={chart.id} value={chart.id}>
                {chart.title}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 14,
            marginTop: 14,
          }}
        >
          {visibleReportCharts.map((chart) => (
            <div key={chart.id}>{chart.render()}</div>
          ))}
        </div>

        {false && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
                gap: 14,
                alignItems: "stretch",
              }}
            >
              {/*   Delivery Funnel - updated like shared image */}
              <div className="section-card">
                <div className="section-card-head">
                  <div style={{

                    fontSize: "20px",
                    fontWeight: "700",
                    color: "var(--text-primary)",
                    marginBottom: "5px",
                  }}>Delivery Funnel</div>
                </div>

                <div className="section-card-body">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      layout="vertical"
                      data={funnelChartData}
                      margin={{ top: 12, right: 26, bottom: 8, left: 18 }}
                      barCategoryGap={16}
                    >
                      <CartesianGrid
                        stroke="rgba(148, 163, 184, 0.18)"
                        horizontal={false}
                      />

                      <XAxis
                        type="number"
                        domain={[0, maxFunnel]}
                        tickFormatter={formatReportNumber}
                        tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />

                      <YAxis
                        type="category"
                        dataKey="name"
                        width={92}
                        tick={{ fontSize: 12, fill: "var(--text-muted)", fontWeight: 800 }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip
                        formatter={(value) => [formatReportNumber(value), "Count"]}
                        cursor={{ fill: "rgba(59, 130, 246, 0.06)" }}
                      />

                      <Bar dataKey="value" radius={[5, 5, 5, 5]}>
                        {funnelChartData.map((entry) => (
                          <Cell key={`funnel-${entry.name}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/*   Channel Mix - existing list kept + pie chart added */}
              <div className="section-card">
                <div className="section-card-head">
                  <div style={{

                    fontSize: "20px",
                    fontWeight: "700",
                    color: "var(--text-primary)",
                    marginBottom: "5px",
                  }}>Channel Mix</div>
                </div>

                <div className="section-card-body" style={{ gap: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px 14px",
                      marginBottom: 8,
                    }}
                  >
                    {channels.map((item) => (
                      <div
                        key={item.channel}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          fontWeight: 700,
                        }}
                      >
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 2,
                            background: item.color,
                            display: "inline-block",
                          }}
                        />
                        <span>
                          {item.channel} {item.value}%
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ minHeight: 230 }}>
                    <CPieChart
                      compact
                      height={230}
                      title=""

                      note=""

                      centerLabel=""
                      data={channelPieData}
                      showLegend={true}
                      showCenter={true}
                    />
                  </div>

                  {/* Existing channel values retained */}
                  <div style={{ display: "grid", gap: 8 }}>
                    {channels.map((item) => (
                      <div
                        key={`channel-row-${item.channel}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          fontSize: 12,
                          paddingTop: 6,
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        <span style={{ color: item.color, fontWeight: 800 }}>
                          {item.channel}
                        </span>
                        <span>
                          {item.value}% / {formatReportNumber(item.count)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 14,
                marginTop: 14,
              }}
            >
              <div className="section-card">
                <div className="section-card-head"><div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "5px" }}>Performance Trend</div></div>
                <div className="section-card-body">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={performanceRateTrend} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(value) => [`${Number(value || 0).toFixed(1)}%`, ""]} />
                      <Legend />
                      <Line type="monotone" dataKey="delivery_rate" name="Delivery Rate %" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="open_rate" name="Open Rate %" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="click_rate" name="Click Rate %" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="section-card">
                <div className="section-card-head"><div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "5px" }}>Revenue Trend</div></div>
                <div className="section-card-body">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={revenueTrend} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} tickFormatter={formatReportCurrency} />
                      <Tooltip formatter={(value) => [formatReportCurrency(value), "Revenue"]} />
                      <Bar dataKey="revenue" fill="#14b8a6" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="section-card">
                <div className="section-card-head"><div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "5px" }}>Channel Effectiveness</div></div>
                <div className="section-card-body">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={channelEffectiveness} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" />
                      <XAxis dataKey="channel" tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(value) => [`${Number(value || 0).toFixed(1)}%`, ""]} />
                      <Legend />
                      <Bar dataKey="open_rate" name="Open Rate %" fill="#3b82f6" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="click_rate" name="Click Rate %" fill="#f59e0b" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="section-card">
                <div className="section-card-head"><div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "5px" }}>Top Campaigns Comparison</div></div>
                <div className="section-card-body">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart layout="vertical" data={campaignComparison} margin={{ top: 12, right: 18, bottom: 8, left: 132 }}>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="campaign" tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} width={132} />
                      <Tooltip formatter={(value) => [`${Number(value || 0).toFixed(1)}%`, ""]} />
                      <Legend />
                      <Bar dataKey="open_rate" name="Open Rate %" fill="#3b82f6" radius={[5, 5, 5, 5]} />
                      <Bar dataKey="click_rate" name="Click Rate %" fill="#f59e0b" radius={[5, 5, 5, 5]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="section-card">
                <div className="section-card-head"><div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "5px" }}>Journey Completion Funnel</div></div>
                <div className="section-card-body">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart layout="vertical" data={journeyFunnel} margin={{ top: 12, right: 24, bottom: 8, left: 18 }}>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" horizontal={false} />
                      <XAxis type="number" domain={[0, maxJourneyFunnel]} tickFormatter={formatReportNumber} tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 700 }} />
                      <YAxis type="category" dataKey="stage" width={92} tick={{ fontSize: 12, fill: "var(--text-muted)", fontWeight: 800 }} />
                      <Tooltip formatter={(value) => [formatReportNumber(value), "Profiles"]} />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[5, 5, 5, 5]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </>
        )}

        <div className="section-card" style={{ marginTop: 14 }}>
          <div className="section-card-head">
            <div style={{

              fontSize: "20px",
              fontWeight: "700",
              color: "var(--text-primary)",
              marginBottom: "5px",
            }}>Top Campaigns</div>
          </div>
          <div className="section-card-body" style={{ gap: 8 }}>
            {campaigns.map((campaign) => (
              <div
                key={campaign.campaign_id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(160px, 1fr) 90px 90px 110px",
                  gap: 10,
                  alignItems: "center",
                  fontSize: 16,
                  fontWeight: "500",

                }}
              >
                <strong>{campaign.campaign}</strong>
                <span>{campaign.open_rate}% open</span>
                <span>{campaign.click_rate}% click</span>
                <span style={{ textAlign: "right" }}>{formatReportCurrency(campaign.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CampaignJourneyReport({ journeys = [], apiReport = null }) {
  const safeJourneys = Array.isArray(journeys) ? journeys : [];
  const [campaignPage, setCampaignPage] = useState(1);
  const CAMPAIGN_PAGE_SIZE = 5;

  if (apiReport?.summary) {
    return <ApiCampaignsJourneysPanel report={apiReport} journeys={safeJourneys} />;
  }

  const getJourneyName = (journey) =>
    journey?.name ||
    journey?.journeyTable?.journeyName ||
    journey?.journeyOverrides?.name ||
    "Untitled Journey";

  const getJourneyId = (journey, index) =>
    journey?.slug ||
    journey?.useCaseId ||
    journey?.id ||
    `journey-${index + 1}`;

  const getCategoryName = (journey) =>
    journey?.category?.categoryName ||
    journey?.categoryName ||
    journey?.journeyTable?.journeyCategory ||
    journey?.subCategoryName ||
    "Uncategorized";

  const getStatus = (journey) => {
    const status = String(journey?.status || journey?.runStatus || "").trim().toUpperCase();

    if (journey?.active === true || journey?.isActive === true) return "Active";
    if (journey?.active === false || journey?.isActive === false) return "Inactive";
    if (status === "READY") return "Ready";
    if (status === "ACTIVE") return "Active";
    if (status === "PAUSED" || status === "INACTIVE") return "Inactive";
    if (status === "DRAFT") return "Draft";

    return "Ready";
  };

  const getStatusTone = (status) => {
    const s = String(status || "").toLowerCase();

    if (s === "active" || s === "ready") return "pass";
    if (s === "inactive" || s === "paused") return "warn";
    if (s === "draft") return "neutral";

    return "pass";
  };

  const toArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const normalizeChannel = (channel) => {
    const c = String(channel || "Unknown").trim();

    if (!c) return "Unknown";

    const upper = c.toUpperCase();

    if (upper === "EMAIL") return "Email";
    if (upper === "SMS") return "SMS";
    if (upper === "PUSH") return "Push";
    if (upper === "IN_APP" || upper === "INAPP") return "In-App";
    if (upper === "CALL") return "Call";
    if (upper === "WHATSAPP") return "WhatsApp";

    return c;
  };

  const getTouchpoints = (journey) =>
    Array.isArray(journey?.touchpoints) ? journey.touchpoints : [];

  const getTrackingEventsCount = (touchpoint) =>
    Array.isArray(touchpoint?.tracking?.trackingEvents)
      ? touchpoint.tracking.trackingEvents.length
      : 0;

  const hasTracking = (journey) => {
    const tps = getTouchpoints(journey);

    return tps.some(
      (tp) =>
        tp?.tracking?.campaignId ||
        tp?.tracking?.deliveryId ||
        getTrackingEventsCount(tp) > 0
    );
  };

  const hasExit = (journey) =>
    Array.isArray(journey?.exitConditions) && journey.exitConditions.length > 0;

  const hasKpi = (journey) => Boolean(journey?.analytics?.primaryKPI);

  const hasAudience = (journey) => Boolean(journey?.entryCriteria?.audienceName);

  const hasAjoConfig = (journey) => Boolean(journey?.ajoConfig);

  const getCompletenessScore = (journey) => {
    const checks = [
      getTouchpoints(journey).length > 0,
      hasTracking(journey),
      hasExit(journey),
      hasKpi(journey),
      hasAudience(journey),
      hasAjoConfig(journey),
    ];

    const passed = checks.filter(Boolean).length;

    return Math.round((passed / checks.length) * 100);
  };

  const report = useMemo(() => {
    const totalJourneys = safeJourneys.length;

    const touchpoints = safeJourneys.flatMap((journey, journeyIndex) =>
      getTouchpoints(journey).map((tp) => ({
        journey,
        journeyIndex,
        tp,
      }))
    );

    const campaignMap = new Map();

    touchpoints.forEach(({ journey, journeyIndex, tp }) => {
      const campaignId =
        tp?.tracking?.campaignId ||
        tp?.tracking?.deliveryId ||
        null;

      if (!campaignId) return;

      const channels = toArray(tp.channel).map(normalizeChannel);

      if (!campaignMap.has(campaignId)) {
        campaignMap.set(campaignId, {
          campaignId,
          campaign: campaignId,
          journey: getJourneyName(journey),
          journeyId: getJourneyId(journey, journeyIndex),
          category: getCategoryName(journey),
          channels: new Set(),
          trackingEvents: new Set(),
          primaryKPI: journey?.analytics?.primaryKPI || "-",
          status: getStatus(journey),
        });
      }

      const row = campaignMap.get(campaignId);

      channels.forEach((channel) => row.channels.add(channel));

      (tp?.tracking?.trackingEvents || []).forEach((event) =>
        row.trackingEvents.add(event)
      );
    });

    const campaignRows = [...campaignMap.values()].map((row) => ({
      ...row,
      channelText: [...row.channels].join(", ") || "-",
      trackingEventCount: row.trackingEvents.size,
    }));

    const channelCounts = {};

    touchpoints.forEach(({ tp }) => {
      toArray(tp.channel).forEach((channel) => {
        const key = normalizeChannel(channel);
        channelCounts[key] = (channelCounts[key] || 0) + 1;
      });
    });

    const CHANNEL_COLORS = ["#2f84dc", "#22a979", "#7c73dd", "#66a329", "#f59e0b", "#14b8a6", "#ef4444"];
    const sortedChannels = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]);
    const TOP_N = 7;
    const topChannels = sortedChannels.slice(0, TOP_N).map(([label, value], index) => ({
      label, value, color: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
    }));
    const otherValue = sortedChannels.slice(TOP_N).reduce((s, [, v]) => s + v, 0);
    if (otherValue > 0) topChannels.push({ label: "Other", value: otherValue, color: "#94a3b8" });
    const channelMix = topChannels;

    const activeJourneys = safeJourneys.filter((journey) => {
      const status = getStatus(journey).toLowerCase();
      return status === "active" || status === "ready";
    }).length;

    const inactiveJourneys = Math.max(0, totalJourneys - activeJourneys);

    const suppressionRules = safeJourneys.flatMap((journey, index) =>
      (journey?.ajoConfig?.suppressionRules || []).map((rule) => ({
        journey: getJourneyName(journey),
        journeyId: getJourneyId(journey, index),
        ruleId: rule?.ruleId || "rule",
        condition: rule?.condition || "-",
      }))
    );

    const categoryCounts = {};

    safeJourneys.forEach((journey) => {
      const category = getCategoryName(journey);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    const categoryData = Object.entries(categoryCounts)
      .map(([name, value]) => ({
        name: name.length > 26 ? `${name.slice(0, 26)}...` : name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const funnelData = [
      {
        name: "Journeys",
        value: totalJourneys,
      },
      {
        name: "With touchpoints",
        value: safeJourneys.filter((j) => getTouchpoints(j).length > 0).length,
      },
      {
        name: "With tracking",
        value: safeJourneys.filter(hasTracking).length,
      },
      {
        name: "With exit rules",
        value: safeJourneys.filter(hasExit).length,
      },
      {
        name: "With KPI",
        value: safeJourneys.filter(hasKpi).length,
      },
    ];

    const journeyPerformance = safeJourneys
      .map((journey, index) => {
        const score = getCompletenessScore(journey);
        const tps = getTouchpoints(journey);
        const channels = [
          ...new Set(
            tps.flatMap((tp) => toArray(tp.channel).map(normalizeChannel))
          ),
        ];

        return {
          id: getJourneyId(journey, index),
          name: getJourneyName(journey),
          category: getCategoryName(journey),
          score,
          status: getStatus(journey),
          touchpoints: tps.length,
          channels: channels.join(", ") || "-",
          primaryKPI: journey?.analytics?.primaryKPI || "-",
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const journeyTypeMap = {};

    safeJourneys.forEach((journey) => {
      const type =
        journey?.journey?.type ||
        journey?.journeyTable?.journeyCategory ||
        "Blueprint";

      journeyTypeMap[type] = (journeyTypeMap[type] || 0) + 1;
    });

    const journeyTypeData = Object.entries(journeyTypeMap).map(([label, value], index) => ({
      label,
      value,
      color: ["#2f84dc", "#22a979", "#7c73dd", "#f59e0b"][index % 4],
    }));

    return {
      totalJourneys,
      totalCampaigns: campaignRows.length,
      totalTouchpoints: touchpoints.length,
      activeJourneys,
      inactiveJourneys,
      totalChannels: Object.keys(channelCounts).length,
      suppressionRules,
      campaignRows,
      channelMix,
      categoryData,
      funnelData,
      journeyPerformance,
      journeyTypeData,
    };
  }, [safeJourneys]);

  const activePct = report.totalJourneys ? Math.round((report.activeJourneys / report.totalJourneys) * 100) : 0;
  const avgTouchpoints = report.totalJourneys ? (report.totalTouchpoints / report.totalJourneys).toFixed(1) : 0;
  const metricCards = [
    {
      label: "Total Journeys",
      value: report.totalJourneys,
      sub: `${report.activeJourneys} active · ${report.inactiveJourneys} inactive`,
      color: "#2f84dc",
      icon: "🧭",
    },
    {
      label: "Touchpoints",
      value: report.totalTouchpoints,
      sub: `avg ${avgTouchpoints} per journey`,
      color: "#7c73dd",
      icon: "📨",
    },
    {
      label: "Ready / Active",
      value: report.activeJourneys,
      sub: `${activePct}% of all journeys`,
      color: "#10b981",
      icon: "✅",
    },
    {
      label: "Channels",
      value: report.totalChannels,
      sub: `across ${report.totalTouchpoints} touchpoints`,
      color: "#f59e0b",
      icon: "📡",
    },
    {
      label: "Suppression Rules",
      value: report.suppressionRules.length,
      sub: report.suppressionRules.length > 0 ? `in ${new Set(report.suppressionRules.map(r => r.journeyId)).size} journeys` : "no rules configured",
      color: "#ef4444",
      icon: "🚫",
    },
  ];

  return (
    <div className="cj-report-wrap">
      <style>{`
        .cj-report-wrap {
          display: grid;
          gap: 16px;
        }

        .cj-report-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .cj-report-title {
          font-size: 22px;
          font-weight: 850;
          color: var(--text-primary);
          margin: 0;
        }

        .cj-report-subtitle {
          margin-top: 4px;
          font-size: 13px;
          color: var(--text-muted);
        }

        .cj-report-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .cj-filter-pill {
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-secondary);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 600;
        }

        .cj-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 12px;
        }

        .cj-kpi-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          min-height: 104px;
          position: relative;
          overflow: hidden;
        }

        .cj-kpi-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, var(--kpi-color-soft), transparent 58%);
          pointer-events: none;
        }

        .cj-kpi-label {
          position: relative;
          z-index: 1;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }

        .cj-kpi-value {
          position: relative;
          z-index: 1;
          font-size: 28px;
          font-weight: 850;
          color: var(--text-primary);
          margin-top: 8px;
          line-height: 1;
        }

        .cj-kpi-sub {
          position: relative;
          z-index: 1;
          margin-top: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .cj-grid-2 {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(340px, 0.8fr);
          gap: 16px;
        }

        .cj-grid-equal {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 16px;
        }

        .cj-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
        }

        .cj-card-head {
          padding: 18px 22px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .cj-card-title {
          font-size: 16px;
          font-weight: 850;
          color: var(--text-primary);
        }

        .cj-card-note {
          margin-top: 4px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .cj-card-body {
          padding: 16px 22px 20px;
        }

        .cj-table-wrap {
          overflow-x: auto;
        }

        .cj-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          min-width: 860px;
        }

        .cj-table th {
          text-align: left;
          padding: 12px 10px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border);
        }

        .cj-table td {
          padding: 12px 10px;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
          vertical-align: middle;
        }

        .cj-table tr:last-child td {
          border-bottom: 0;
        }

        .cj-table strong {
          color: var(--text-primary);
        }

        .cj-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 9px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .cj-status-pass {
          color: #2f6e1f;
          background: #dff2d7;
        }

        .cj-status-warn {
          color: #7a560b;
          background: #f8edcf;
        }

        .cj-status-neutral {
          color: #4b5563;
          background: #e5e7eb;
        }

        .cj-journey-list {
          display: grid;
          gap: 16px;
        }

        .cj-journey-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
        }

        .cj-journey-title {
          font-size: 14px;
          font-weight: 750;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .cj-journey-meta {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .cj-progress-track {
          height: 6px;
          border-radius: 999px;
          background: var(--bg-secondary);
          overflow: hidden;
        }

        .cj-progress-fill {
          height: 100%;
          background: #2f84dc;
          border-radius: 999px;
        }

        .cj-score {
          text-align: right;
          font-size: 12px;
          color: var(--text-muted);
        }

        .cj-score strong {
          display: block;
          color: var(--text-primary);
          font-size: 13px;
        }

        .cj-suppression-list {
          display: grid;
          gap: 12px;
        }

        .cj-suppression-item {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 10px;
          align-items: start;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg-secondary);
        }

        .cj-rule-id {
          font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
          font-size: 11px;
          font-weight: 800;
          color: #2563eb;
          background: rgba(37, 99, 235, 0.12);
          padding: 4px 7px;
          border-radius: 7px;
        }

        .cj-empty {
          padding: 18px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
          border: 1px dashed var(--border);
          border-radius: 12px;
          background: var(--bg-secondary);
        }

        .content-pie-card {
          padding: 0;
          overflow: hidden;
        }

        .content-pie-card .c-pie-card {
          height: 100%;
          border: 0;
          border-radius: inherit;
          background: transparent;
          box-shadow: none;
        }

        .content-pie-card .c-pie-chart-area {
          min-height: 260px;
        }

        @media (max-width: 980px) {
          .cj-grid-2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* HEADER */}
      <div className="cj-report-header">
        <div>
          <h2 className="cj-report-title">Campaign & journey reporting</h2>
          <div className="cj-report-subtitle">
            Blueprint metadata · All channels · {report.totalJourneys} journeys ·{" "}
            {report.totalCampaigns} campaigns
          </div>
        </div>

        <div className="cj-report-actions">
          <div className="cj-filter-pill">Blueprint API data only</div>
          <div className="cj-filter-pill">No synthetic metrics</div>
        </div>
      </div>

      {/* KPI */}
      <div className="cj-kpi-grid">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="cj-kpi-card"
            style={{
              "--kpi-color-soft": `${card.color}18`,
            }}
          >
            <div className="cj-kpi-label">{card.label}</div>
            <div className="cj-kpi-value">{card.value}</div>
            <div className="cj-kpi-sub">
              {card.icon} {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* FUNNEL + CHANNEL MIX */}
      <div className="cj-grid-2">
        <div className="cj-card">
          <div className="cj-card-head">
            <div>
              <div className="cj-card-title">Journey setup funnel</div>
              <div className="cj-card-note">
                Derived from journey blueprint fields: touchpoints, tracking, exits, and KPI.
              </div>
            </div>
          </div>

          <div className="cj-card-body">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                layout="vertical"
                data={report.funnelData}
                margin={{ top: 12, right: 28, bottom: 8, left: 28 }}
              >
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
                />
                <Tooltip />
                <Bar dataKey="value" fill="#2f84dc" radius={[4, 4, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cj-card">
          <div className="cj-card-head">
            <div>
              <div className="cj-card-title">Channel mix</div>
              <div className="cj-card-note">Channel distribution across journey touchpoints.</div>
            </div>
          </div>
          <div className="cj-card-body" style={{ display: "flex", gap: 16, alignItems: "center", minHeight: 260 }}>
            <div style={{ flex: "0 0 180px" }}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={report.channelMix.map(d => ({ ...d, name: d.label }))}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={72}
                    paddingAngle={2}
                    isAnimationActive={false}
                    label={false}
                    labelLine={false}
                  >
                    {report.channelMix.map((entry, i) => (
                      <Cell key={entry.label} fill={entry.color} stroke="var(--bg-card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, overflowY: "auto", maxHeight: 260, display: "grid", gap: 6 }}>
              {report.channelMix.map((ch) => {
                const total = report.channelMix.reduce((s, c) => s + c.value, 0) || 1;
                const pct = Math.round((ch.value / total) * 100);
                return (
                  <div key={ch.label} style={{ display: "grid", gridTemplateColumns: "10px 1fr 36px 36px", gap: 8, alignItems: "center" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: ch.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.label}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>{ch.value}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* JOURNEY TYPE + CATEGORY */}
      <div className="cj-grid-equal">
        <div className="cj-card content-pie-card">
          <CPieChart
            compact={false}
            height={300}
            title="Journey type split"
            note="Journey type distribution based on blueprint metadata."
            centerLabel=""
            showCenter={false}
            data={report.journeyTypeData}
          />
        </div>

        <div className="cj-card">
          <div className="cj-card-head">
            <div>
              <div className="cj-card-title">Top journey categories</div>
              <div className="cj-card-note">Journey counts grouped by category.</div>
            </div>
          </div>

          <div className="cj-card-body">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={report.categoryData}
                margin={{ top: 16, right: 28, bottom: 8, left: 0 }}
                barCategoryGap={18}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar dataKey="value" fill="#22a979" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* CAMPAIGN TABLE */}
      <div className="cj-card">
        <div className="cj-card-head">
          <div>
            <div className="cj-card-title">Campaign metadata</div>
            <div className="cj-card-note">
              Campaign rows are derived from touchpoint tracking campaign IDs.
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>
            {report.campaignRows.length} total
          </div>
        </div>

        <div className="cj-table-wrap">
          <table className="cj-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Journey</th>
                <th>Channel</th>
                <th>Tracking events</th>
                <th>Primary KPI</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {report.campaignRows.length > 0 ? (
                report.campaignRows
                  .slice((campaignPage - 1) * CAMPAIGN_PAGE_SIZE, campaignPage * CAMPAIGN_PAGE_SIZE)
                  .map((row) => (
                    <tr key={row.campaignId}>
                      <td><strong>{row.campaign}</strong></td>
                      <td>{row.journey}</td>
                      <td>{row.channelText}</td>
                      <td>{row.trackingEventCount}</td>
                      <td>{row.primaryKPI}</td>
                      <td>
                        <span className={`cj-status cj-status-${getStatusTone(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="cj-empty">
                      No campaign IDs found in touchpoint tracking metadata.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {report.campaignRows.length > CAMPAIGN_PAGE_SIZE && (() => {
          const totalPages = Math.ceil(report.campaignRows.length / CAMPAIGN_PAGE_SIZE);
          return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", borderTop: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Page {campaignPage} of {totalPages} · {report.campaignRows.length} records
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setCampaignPage((p) => Math.max(1, p - 1))}
                  disabled={campaignPage === 1}
                  style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: campaignPage === 1 ? "default" : "pointer", opacity: campaignPage === 1 ? 0.4 : 1 }}
                >
                  ← Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pg = i + 1;
                  if (totalPages > 5 && campaignPage > 3) pg = campaignPage - 2 + i;
                  if (pg > totalPages) return null;
                  return (
                    <button
                      key={pg}
                      onClick={() => setCampaignPage(pg)}
                      style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: pg === campaignPage ? "var(--accent, #2563eb)" : "var(--bg-card)", color: pg === campaignPage ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer", minWidth: 32 }}
                    >
                      {pg}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCampaignPage((p) => Math.min(totalPages, p + 1))}
                  disabled={campaignPage === totalPages}
                  style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: campaignPage === totalPages ? "default" : "pointer", opacity: campaignPage === totalPages ? 0.4 : 1 }}
                >
                  Next →
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* JOURNEY PERFORMANCE + SUPPRESSIONS */}
      <div className="cj-grid-2">
        <div className="cj-card">
          <div className="cj-card-head">
            <div>
              <div className="cj-card-title">Journey configuration score</div>
              <div className="cj-card-note">
                Score is calculated from available blueprint metadata completeness.
              </div>
            </div>
          </div>

          <div className="cj-card-body">
            <div className="cj-journey-list">
              {report.journeyPerformance.map((journey) => (
                <div key={journey.id} className="cj-journey-item">
                  <div>
                    <div className="cj-journey-title">{journey.name}</div>
                    <div className="cj-journey-meta">
                      {journey.touchpoints} touchpoints · {journey.channels} · KPI:{" "}
                      {journey.primaryKPI}
                    </div>
                    <div className="cj-progress-track">
                      <div
                        className="cj-progress-fill"
                        style={{ width: `${journey.score}%` }}
                      />
                    </div>
                  </div>

                  <div className="cj-score">
                    <span className={`cj-status cj-status-${getStatusTone(journey.status)}`}>
                      {journey.status}
                    </span>
                    <strong>{journey.score}%</strong>
                  </div>
                </div>
              ))}

              {report.journeyPerformance.length === 0 ? (
                <div className="cj-empty">No journey metadata available.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="cj-card">
          <div className="cj-card-head">
            <div>
              <div className="cj-card-title">Suppression rules</div>
              <div className="cj-card-note">
                Rules derived from AJO configuration in the journey payload.
              </div>
            </div>
          </div>

          <div className="cj-card-body">
            <div className="cj-suppression-list">
              {report.suppressionRules.length > 0 ? (
                report.suppressionRules.slice(0, 6).map((rule, index) => (
                  <div
                    key={`${rule.journeyId}-${rule.ruleId}-${index}`}
                    className="cj-suppression-item"
                  >
                    <div className="cj-rule-id">{rule.ruleId}</div>

                    <div>
                      <div className="cj-journey-title">{rule.journey}</div>
                      <div className="cj-journey-meta">{rule.condition}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="cj-empty">
                  No suppression rules configured in selected journeys.
                </div>
              )}
              {report.suppressionRules.length > 6 && (
                <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", paddingTop: 4 }}>
                  Showing 6 of {report.suppressionRules.length} rules
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BlueprintModule({
  data,
  form,
  busy,
  progress,
  generateLabel = "Generate Flowchart",
  selectedNode,
  selectedEdge,
  selectedDetail,
  activatedSegments,
  filteredJourneyOptions,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
  onFormChange,
  onJourneyCategoryChange,
  onJourneyTypeChange,
  onGenerate,
  onSendConfig,
  onOpenQa,
  isDirty,
  saveName,
  saveBusy,
  onSaveNameChange,
  onSaveJourney,
  onAddNode,
  onAddEdge,
  onDeleteSelection,
  onNodeFieldChange,
  onNodeLineChange,
  onDetailChange,
  onDetailRowChange,
  onAddDetailRow,
  onRemoveDetailRow,
  onNodeMove,
  onEdgeFieldChange,
  onBackToCampaignManager = null,

}) {

  const [activeTab, setActiveTab] = useState("campaigns");


  /*   SHARED FILTER STATE */
  const [categoryFilter, setCategoryFilter] = useState(readIndustryJourneyCategory());
  const [subCategoryFilter, setSubCategoryFilter] = useState("all");

  const filteredJourneys = useMemo(() => {

    const journeys = data.availableJourneys || [];

    let selected =
      categoryFilter === "all"
        ? journeys
        : journeys.filter((j) => j.categoryId === categoryFilter);

    if (subCategoryFilter !== "all") {
      if (categoryFilter === "all") {
        selected = selected.filter(
          (j) =>
            `${j.categoryId}::${j.subCategoryId ?? "general"}` === subCategoryFilter
        );
      } else {
        selected = selected.filter(
          (j) => j.subCategoryId === subCategoryFilter
        );
      }
    }

    return selected;

  }, [data.availableJourneys, categoryFilter, subCategoryFilter]);

  if (!form.journeyType) {
    return (

      <div>
        {/* TAB HEADER */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 12,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("campaigns")}
            style={{
              color: activeTab === "campaigns" ? "#ffffff" : "var(--text-secondary)",
              WebkitTextFillColor:
                activeTab === "campaigns" ? "#ffffff" : "var(--text-secondary)",
              background:
                activeTab === "campaigns" ? "var(--accent-light)" : "var(--bg-card)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              border: activeTab === "campaigns" ? "none" : "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "var(--font)",
              boxShadow:
                activeTab === "campaigns"
                  ? "0 6px 16px rgba(37, 99, 235, 0.25)"
                  : "none",
            }}
          >
            Campaigns & Journeys
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("report")}
            style={{
              color: activeTab === "report" ? "#ffffff" : "var(--text-secondary)",
              WebkitTextFillColor:
                activeTab === "report" ? "#ffffff" : "var(--text-secondary)",
              background:
                activeTab === "report" ? "var(--accent-light)" : "var(--bg-card)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              border: activeTab === "report" ? "none" : "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "var(--font)",
              boxShadow:
                activeTab === "report"
                  ? "0 6px 16px rgba(37, 99, 235, 0.25)"
                  : "none",
            }}
          >
            Reporting
          </button>
        </div>

        <div className="workspace-panel">



          {/*   TAB CONTENT */}
          {activeTab === "campaigns" ? (
            <JourneyCatalogue
              categories={data.availableJourneyCategories}
              subcategories={data.availableJourneySubcategories ?? []}
              journeys={filteredJourneys}   //   IMPORTANT
              report={data.campaignsJourneysReport}
              categoryFilter={categoryFilter}
              subCategoryFilter={subCategoryFilter}
              onCategoryChange={setCategoryFilter}
              onSelectJourney={onJourneyTypeChange}
              onSubCategoryChange={setSubCategoryFilter}
            />
          ) : (
            <CampaignJourneyReport
              journeys={filteredJourneys}
              apiReport={data.campaignsJourneysReport}
            />
          )}
        </div>
      </div>
    );
  }


  return (
    <section className="module-layout blueprint-layout">
      <aside className="panel side-panel narrow editor-panel">
        <div className="panel-head">
          <div className="panel-title" style={{ color: "#E5C97A" }}>
            Journey Editor
          </div>
          <div className="panel-subtitle">
            Edit the selected journey, update its flowchart, and save a new version back into the journey catalogue.
          </div>
        </div>
        <div className="panel-body">
          <button type="button" className="button secondary full journey-back-button" onClick={() => onBackToCampaignManager ? onBackToCampaignManager() : onJourneyCategoryChange("")}>
            {onBackToCampaignManager ? "Back to Campaign Manager" : "Back to Campaigns & Journeys"}
          </button>

          <label className="field">
            <span className="field-label">Journey category</span>
            <select
              className="field-input"
              value={form.journeyCategory}
              disabled
              onChange={(event) => onJourneyCategoryChange(event.target.value)}
            >
              <option value="">Select journey category</option>
              {data.availableJourneyCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Journey type</span>
            <select
              className="field-input"
              value={form.journeyType}
              disabled
              onChange={(event) => onJourneyTypeChange(event.target.value)}
            >
              <option value="">Select journey type</option>
              {filteredJourneyOptions.map((journey) => (
                <option key={journey.slug} value={journey.slug}>
                  {journey.name}
                </option>
              ))}
            </select>
          </label>

          <div className="helper-text">
            Journey selection is locked in the editor. Use <strong>Back to Campaigns & Journeys</strong> to open a different journey.
          </div>

          <div className="group-box">
            <div className="field-label">Campaign flow</div>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 20, marginBottom: 8,
              fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
              background: form.orchestrationType === "single-touchpoint" ? "rgba(100,180,255,0.12)" : "rgba(100,220,160,0.12)",
              color: form.orchestrationType === "single-touchpoint" ? "#64B4FF" : "#64DCA0",
              border: `1px solid ${form.orchestrationType === "single-touchpoint" ? "rgba(100,180,255,0.3)" : "rgba(100,220,160,0.3)"}`,
            }}>
              {form.orchestrationType === "single-touchpoint" ? "Single touchpoint" : "Multi-touch journey"}
            </span>

            {form.orchestrationType === "single-touchpoint" ? (
              <>
                <div className="two-col">
                  <label className="field compact">
                    <span className="field-label small">Single channel</span>
                    <select
                      className="field-input"
                      value={form.singleChannel ?? "email"}
                      onChange={(event) => onFormChange("singleChannel", event.target.value)}
                    >
                      <option value="email">Email</option>
                      <option value="push">Push</option>
                      <option value="sms">SMS</option>
                      <option value="inApp">In-App</option>
                    </select>
                  </label>
                  <label className="field compact">
                    <span className="field-label small">Trigger type</span>
                    <select
                      className="field-input"
                      value={form.singleTriggerType ?? "event"}
                      onChange={(event) => onFormChange("singleTriggerType", event.target.value)}
                    >
                      <option value="event">Event trigger</option>
                      <option value="scheduled">Scheduled trigger</option>
                    </select>
                  </label>
                </div>

                <label className="field compact">
                  <span className="field-label small">
                    {form.singleTriggerType === "scheduled" ? "Schedule key" : "Trigger event"}
                  </span>
                  <input
                    className="field-input"
                    value={form.singleTriggerEvent ?? ""}
                    onChange={(event) => onFormChange("singleTriggerEvent", event.target.value)}
                  />
                </label>

                <div className="two-col">
                  <label className="field compact">
                    <span className="field-label small">Send offset (hours)</span>
                    <input
                      className="field-input"
                      type="number"
                      min={0}
                      max={168}
                      value={form.singleSendOffsetHours ?? 0}
                      onChange={(event) => onFormChange("singleSendOffsetHours", Number(event.target.value))}
                    />
                  </label>
                  <label className="field compact">
                    <span className="field-label small">Outcome window (hours)</span>
                    <input
                      className="field-input"
                      type="number"
                      min={1}
                      max={168}
                      value={form.singleOutcomeWindowHours ?? 24}
                      onChange={(event) => onFormChange("singleOutcomeWindowHours", Number(event.target.value))}
                    />
                  </label>
                </div>

                <div className="toggle-row no-gap-bottom">
                  <button
                    type="button"
                    className={`channel-chip ${form.singleUseHoldout ? "on" : "off"}`}
                    onClick={() => onFormChange("singleUseHoldout", !form.singleUseHoldout)}
                  >
                    Holdout {form.singleUseHoldout ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    className={`channel-chip ${form.singleUseAB ? "on" : "off"}`}
                    onClick={() => onFormChange("singleUseAB", !form.singleUseAB)}
                  >
                    A/B Split {form.singleUseAB ? "On" : "Off"}
                  </button>
                </div>
                <div className="helper-text no-top">
                  Regenerate flowchart after changing these controls to rebuild the campaign path.
                </div>
              </>
            ) : (
              <div className="helper-text no-top">
                Multi-touch mode keeps holdout, experiment, and wait nodes across a full journey path.
              </div>
            )}
          </div>

          <label className="field">
            <span className="field-label">Prompt</span>
            <textarea
              className="field-input multiline"
              value={form.brief}
              placeholder="Describe journey updates in plain language (for example: set wait period to 4 days, holdout to 15%, and split to 60/40)."
              onChange={(event) => onFormChange("brief", event.target.value)}
            />
          </label>

          <div className="two-col">
            <label className="field">
              <span className="field-label">Platform</span>
              <select
                className="field-input"
                value={form.platform}
                onChange={(event) => onFormChange("platform", event.target.value)}
              >
                <option>Adobe AJO</option>
                <option>Braze</option>
                <option>SFMC</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Target date</span>
              <input
                className="field-input"
                type="date"
                value={form.targetDate}
                onChange={(event) => onFormChange("targetDate", event.target.value)}
              />
            </label>
          </div>

          {activatedSegments?.length ? (
            <div className="info-box info-blue segment-selection-box">
              <div className="section-label">Selected Segments</div>
              <div className="segment-rule-list">
                {activatedSegments.map((segment) => (
                  <div className="segment-rule-chip" key={segment.id}>
                    {segment.name} / {segment.status}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="toolbar-stack">
            <button
              type="button"
              className="button gold full"
              onClick={onGenerate}
              disabled={busy || !form.journeyCategory || !form.journeyType}
            >
              {busy ? <span className="spinner" /> : null}
              {busy ? "Generating..." : generateLabel}
            </button>
            <div className="two-col">
              <button type="button" className="button secondary full" onClick={onAddNode}>
                Add Node
              </button>
              <button type="button" className="button secondary full" onClick={onAddEdge}>
                Add Arrow
              </button>
            </div>
            {(selectedNode || selectedEdge) ? (
              <button type="button" className="button secondary full" onClick={onDeleteSelection}>
                Remove Selected
              </button>
            ) : null}
          </div>

          {busy ? (
            <div className="progress-stack">
              <div className="progress-track">
                <span className="progress-fill gold" style={{ width: `${progress.percent}%` }} />
              </div>
              <div className="progress-label">{progress.message}</div>
            </div>
          ) : null}

          {isDirty ? (
            <div className="save-card">
              <div className="section-label">Unsaved journey changes</div>
              <div className="helper-text">
                Save this edited brief and flowchart as a new JSON-backed journey so it appears in the selector next time.
              </div>
              <label className="field compact">
                <span className="field-label small">New journey name</span>
                <input
                  className="field-input"
                  placeholder="Example: Priority Access Last-Chance Push"
                  value={saveName}
                  onChange={(event) => onSaveNameChange(event.target.value)}
                />
              </label>
              <button type="button" className="button primary full" onClick={onSaveJourney} disabled={saveBusy}>
                {saveBusy ? <span className="spinner" /> : null}
                {saveBusy ? "Saving..." : "Save as New Journey"}
              </button>
            </div>
          ) : null}

          {data.generated ? (
            <div className="stats-card">
              <div className="section-label">Generated elements</div>
              {data.stats.map((item) => (
                <div className="stat-row" key={item.label}>
                  <span>{item.label}</span>
                  <strong style={{ color: item.color }}>{item.value}</strong>
                </div>
              ))}
              <div className="stack-actions">
                <button type="button" className="button primary full" onClick={onSendConfig}>
                  Send to Journey Config
                </button>
                <button type="button" className="button teal full" onClick={onOpenQa}>
                  Open QA & Automation
                </button>
                <button type="button" className="button secondary full" onClick={onClearSelection}>
                  Clear Selection
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="panel canvas-panel">
        <FlowchartCanvas
          generated={data.generated}
          busy={busy}
          progress={progress}
          nodes={data.nodes}
          edges={data.edges}
          lanes={data.lanes}
          phaseHeaders={data.phaseHeaders}
          selectedNodeId={selectedNode?.id ?? null}
          selectedEdgeId={selectedEdge?.id ?? null}
          onSelectNode={onSelectNode}
          onSelectEdge={onSelectEdge}
          onClearSelection={onClearSelection}
          onNodeMove={onNodeMove}
        />
      </div>

      <aside className="panel side-panel narrow inspector-panel" style={{ "maxHeight": "100vh" }}>
        <div className="panel-head">
          <div className="panel-title">{selectedEdge ? "Arrow Inspector" : "Node Inspector"}</div>
          <div className="panel-subtitle">
            Edit labels, routing, shape, color, and layout for the selected canvas object.
          </div>
        </div>
        {selectedEdge ? (
          <EdgeInspector
            edge={selectedEdge}
            nodes={data.nodes}
            onDeleteSelection={onDeleteSelection}
            onEdgeFieldChange={onEdgeFieldChange}
          />
        ) : (
          <NodeInspector
            node={selectedNode}
            detail={selectedDetail}
            lanes={data.lanes}
            onDeleteSelection={onDeleteSelection}
            onNodeFieldChange={onNodeFieldChange}
            onNodeLineChange={onNodeLineChange}
            onDetailChange={onDetailChange}
            onDetailRowChange={onDetailRowChange}
            onAddDetailRow={onAddDetailRow}
            onRemoveDetailRow={onRemoveDetailRow}
          />
        )}
      </aside>
    </section>
  );
}
