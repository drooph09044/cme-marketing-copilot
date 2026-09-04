import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import copilotStyles from "../styles.css?raw";
import qaAutomationStyles from "../qaAutomation/qaAutomation.css?raw";
import { EmbeddedActivationApp } from "../copilot/ActivationApp";
import CampaignManager from "../idres/pages/CampaignManager";

const SECTION_META = {
  bp: {
    title: "Campaigns & Journeys",
    description: "Browse journeys, open a campaign, and edit the orchestration blueprint.",
  },
  cfg: {
    title: "Journey Config",
    description: "Review audience setup, journey canvas, measurement, and export configuration.",
  },
  qa: {
    title: "QA & Automation",
    description: "Run journey validation suites, profile simulations, and automation checks.",
  },
};

/* Overrides that make the QA app fit inside the Journey Config tab panel. */
const EMBEDDED_QA_OVERRIDES = `
/* ── Layout: QA tab fills panel height ───────────────────────────────── */
.content-body--qa { padding: 0 !important; overflow: hidden !important; display: flex; flex-direction: column; }
.content-body--qa .jo-embedded { flex: 1; min-height: 0; }
.jo-embedded { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.jo-embedded .jo-subhead { flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 12px 16px; }
.jo-workspace--embedded { flex: 1; min-height: 0; display: flex; overflow: hidden; }
.jo-workspace--embedded .jo-inspector { flex: 1; min-width: 0; overflow-y: auto; border-left: none; }

/* ── Base font: bump everything to 14px for readability ─────────────── */
.jo-embedded, .jo-embedded * { font-size: 14px; }
.jo-embedded .jo-eyebrow { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.6; }
.jo-embedded .jo-jpicker__name { font-size: 14px; font-weight: 600; }
.jo-embedded .jo-spicker__name { font-size: 14px; font-weight: 500; }
.jo-embedded .jo-subhead__meta { font-size: 12px; opacity: 0.6; }
.jo-embedded .jo-btn { font-size: 13px; padding: 7px 16px; border-radius: 6px; font-weight: 600; }
.jo-embedded .jo-inspector__tabs button { font-size: 13px; font-weight: 600; padding: 10px 16px; }

/* ── Locked selectors: disabled appearance with a lock hint ─────────── */
.jo-embedded .jo-jpicker__btn:disabled,
.jo-embedded .jo-spicker__btn:disabled { opacity: 1; cursor: default; }
.jo-embedded .jo-jpicker__btn.is-locked,
.jo-embedded .jo-spicker__btn.is-locked { cursor: default; }
.jo-embedded .jo-jpicker__chev,
.jo-embedded .jo-spicker__btn.is-locked svg { display: none; }

/* ── Profile cards: visible border, padding, larger text ─────────────── */
.jo-embedded .qa-pcard {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 6px;
  background: rgba(255,255,255,0.03);
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.jo-embedded .qa-pcard:hover { border-color: rgba(74,126,255,0.4); background: rgba(74,126,255,0.06); }
.jo-embedded .qa-pcard.is-active { border-color: #4a7eff; background: rgba(74,126,255,0.12); }
.jo-embedded .qa-pcard__avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(74,126,255,0.2); color: #8ab4ff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
.jo-embedded .qa-pcard__name { font-size: 14px; font-weight: 600; color: #dde6f5; }
.jo-embedded .qa-pcard__sub { font-size: 12px; color: #576880; margin-top: 2px; }
.jo-embedded .qa-pgroup__head { font-size: 12px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; color: #576880; padding: 8px 0 4px; }

/* ── Verdict on profile card: bold green / red text ─────────────────── */
.jo-embedded .qa-pcard__verdict { font-size: 12px; font-weight: 700; border-radius: 4px; padding: 2px 7px; }

/* ── Suite cards: visible border, clear spacing ─────────────────────── */
.jo-embedded .qa-scard {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
  background: rgba(255,255,255,0.02);
}
.jo-embedded .qa-scard__head { padding: 12px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
.jo-embedded .qa-scard__head:hover { background: rgba(255,255,255,0.04); }
.jo-embedded .qa-scard.is-open .qa-scard__head { background: rgba(74,126,255,0.08); border-bottom: 1px solid rgba(255,255,255,0.08); }
.jo-embedded .qa-scard__name { font-size: 14px; font-weight: 600; color: #dde6f5; }
.jo-embedded .qa-scard__desc { font-size: 12px; color: #576880; margin-top: 3px; }
.jo-embedded .qa-scard__meta { font-size: 11px; color: #3a4e6a; margin-top: 3px; }

/* Suite status badge on the card header */
.jo-embedded .qa-scard__status {
  width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: #8a9bb5;
}

/* ── Test case list items: bordered rows, clear pass/fail ────────────── */
.jo-embedded .qa-tcase-list { list-style: none; margin: 0; padding: 0; }
.jo-embedded .qa-tcase {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.jo-embedded .qa-tcase:last-child { border-bottom: none; }
.jo-embedded .qa-tcase__title { font-size: 13px; font-weight: 500; color: #dde6f5; }
.jo-embedded .qa-tcase__desc { font-size: 12px; color: #576880; margin-top: 3px; }
.jo-embedded .qa-tcase__badge {
  flex-shrink: 0; padding: 3px 8px; border-radius: 4px;
  font-size: 11px; font-weight: 700; border: 1px solid transparent;
  white-space: nowrap; min-width: 52px; text-align: center;
  background: rgba(255,255,255,0.07); color: #8a9bb5;
}

/* ── PASS = solid green, FAIL = solid red (override CSS vars) ────────── */
.jo-embedded [style*="var(--ok)"],
.jo-embedded .qa-tcase--pass .qa-tcase__badge,
.jo-embedded .qa-scard__status[title="PASS"] { background: #16a34a !important; color: #fff !important; border-color: transparent !important; }

.jo-embedded [style*="var(--danger)"],
.jo-embedded .qa-tcase--fail .qa-tcase__badge,
.jo-embedded .qa-scard__status[title="FAIL"] { background: #dc2626 !important; color: #fff !important; border-color: transparent !important; }

/* QA check rows in simulation results */
.jo-embedded .qa-check {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.jo-embedded .qa-check:last-child { border-bottom: none; }
.jo-embedded .qa-check__title { font-size: 13px; font-weight: 500; color: #dde6f5; }
.jo-embedded .qa-check__desc { font-size: 12px; color: #576880; margin-top: 2px; }
.jo-embedded .qa-check__ok {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; color: #fff;
}
.jo-embedded .qa-check--pass .qa-check__ok { background: #16a34a !important; }
.jo-embedded .qa-check--fail .qa-check__ok { background: #dc2626 !important; }
.jo-embedded .qa-check--skipped .qa-check__ok { background: #6b7280 !important; }

.jo-embedded .qa-check__verdict { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
.jo-embedded .qa-check__verdict--pass { background: rgba(22,163,74,0.18); color: #4ade80 !important; }
.jo-embedded .qa-check__verdict--fail { background: rgba(220,38,38,0.18); color: #f87171 !important; }
.jo-embedded .qa-check__verdict--skipped { background: rgba(107,114,128,0.18); color: #9ca3af !important; }

/* Profile card verdict pill */
.jo-embedded .qa-pcard__verdict { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; }

/* ── Simulation results column ───────────────────────────────────────── */
.jo-embedded .qa-simgroup { margin-bottom: 16px; }
.jo-embedded .qa-simgroup__head { font-size: 13px; font-weight: 700; color: #8ab4ff; padding: 8px 14px; background: rgba(74,126,255,0.08); border-radius: 6px; margin-bottom: 4px; }
.jo-embedded .qa-meta-card { border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 12px; }
.jo-embedded .qa-meta-card__label { font-size: 11px; color: #576880; text-transform: uppercase; letter-spacing: 0.04em; }
.jo-embedded .qa-meta-card__value { font-size: 13px; font-weight: 500; color: #dde6f5; margin-top: 2px; }

/* ── Workbench columns ───────────────────────────────────────────────── */
.jo-embedded .qa-wb { display: flex; height: 100%; min-height: 0; }
.jo-embedded .qa-wb__col { flex: 1; min-width: 0; border-right: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; overflow: hidden; }
.jo-embedded .qa-wb__col:last-child { border-right: none; }
.jo-embedded .qa-wb__head { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.jo-embedded .qa-wb__head h3 { font-size: 14px; font-weight: 700; color: #dde6f5; margin: 0; }
.jo-embedded .qa-wb__count { font-size: 12px; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 10px; color: #8a9bb5; }
.jo-embedded .qa-wb__scroll { flex: 1; overflow-y: auto; padding: 10px 12px; }
.jo-embedded .qa-wb__filters { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0; }
/* Column-3 chip: clamp width so it never overflows the column header */
.jo-embedded .qa-wb__chip { font-size: 11px; padding: 2px 9px; border-radius: 9px; background: rgba(74,126,255,0.12); color: #8ab4ff; font-weight: 600; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 1; min-width: 0; }
.jo-embedded .qa-chip-btn { font-size: 12px; padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #8a9bb5; cursor: pointer; }
.jo-embedded .qa-chip-btn.is-on { background: rgba(74,126,255,0.2); border-color: #4a7eff; color: #8ab4ff; font-weight: 600; }

/* ── Table in ProfilesTab ────────────────────────────────────────────── */
.jo-embedded .jo-table { width: 100%; border-collapse: collapse; }
.jo-embedded .jo-table th { font-size: 12px; font-weight: 600; color: #576880; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left; }
.jo-embedded .jo-table td { font-size: 13px; padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #dde6f5; }
.jo-embedded .jo-table tr:last-child td { border-bottom: none; }
.jo-embedded .jo-tag { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
.jo-embedded .jo-tag--test { background: rgba(74,126,255,0.16); color: #8ab4ff; }
.jo-embedded .jo-tag--control { background: rgba(167,139,250,0.16); color: #c4b5fd; }
.jo-embedded .jo-tag--holdout { background: rgba(52,211,153,0.14); color: #34d399; }
.jo-embedded .jo-tag--suppressed { background: rgba(248,113,113,0.14); color: #f87171; }
.jo-embedded .jo-tag--fcap-risk { background: rgba(251,191,36,0.14); color: #fbbf24; }
.jo-embedded .jo-prof__name { font-size: 13px; font-weight: 600; }
.jo-embedded .jo-prof__id { font-size: 11px; color: #576880; }

/* ── Responsive: embedded QA ─────────────────────────────────────────── */
@media (max-width: 1200px) {
  .jo-embedded .jo-subhead { flex-wrap: wrap; height: auto; min-height: 56px; padding: 8px 16px; gap: 8px; }
  .jo-embedded .jo-subhead__title { flex-wrap: wrap; gap: 10px; }
  .jo-embedded .jo-jpicker { min-width: 180px; max-width: 260px; }
  .jo-embedded .jo-spicker { min-width: 140px; max-width: 200px; }
  .jo-embedded .jo-subhead__meta { display: none; }
}

@media (max-width: 900px) {
  .jo-embedded .jo-subhead { flex-direction: column; align-items: flex-start; padding: 10px 16px; gap: 10px; }
  .jo-embedded .jo-subhead__title { width: 100%; }
  .jo-embedded .jo-subhead__right { width: 100%; justify-content: flex-end; }
  .jo-embedded .jo-jpicker { min-width: 0; max-width: 100%; flex: 1 1 160px; }
  .jo-embedded .jo-spicker { min-width: 0; max-width: 100%; flex: 1 1 140px; }
  .jo-embedded .jo-jpicker__btn, .jo-embedded .jo-spicker__btn { width: 100%; }
  /* Workbench: scroll horizontally so columns don't crush below 900px */
  .jo-embedded .qa-wb { overflow-x: auto; }
  .jo-embedded .qa-wb__col { min-width: 220px; flex: 0 0 220px; }
}

@media (max-width: 640px) {
  /* Workbench: stack vertically */
  .jo-embedded .qa-wb { flex-direction: column; height: auto; overflow-x: hidden; overflow-y: auto; }
  .jo-embedded .qa-wb__col { min-width: 0; flex: none; height: 300px; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.07); }
  .jo-embedded .qa-wb__col:last-child { border-bottom: none; height: auto; min-height: 220px; }
  /* Inspector fills full width */
  .jo-embedded .jo-inspector { min-width: 0; width: 100%; }
}
`;

function ActivationShadowHost({ activatedSegments, section, onRouteRequest, themeMode, initialJourneySlug = null }) {
  const hostRef = useRef(null);
  const [shadowRoot, setShadowRoot] = useState(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }
    setShadowRoot((current) => current ?? hostRef.current.shadowRoot ?? hostRef.current.attachShadow({ mode: "open" }));
  }, []);

  return (
    <div ref={hostRef} style={{ flex: 1, minHeight: 0, display: "block" }}>
      {shadowRoot
        ? createPortal(
            <>
              <style>{`:host{display:block;height:100%;}${copilotStyles}${qaAutomationStyles.replace(":root {", ":host {").replace("body {", ".jo {")}${EMBEDDED_QA_OVERRIDES}`}</style>
              <div data-theme={themeMode} style={{ height: "100%" }}>
                <EmbeddedActivationApp
                  activatedSegments={activatedSegments}
                  forcedRoute={section}
                  showSidebar={false}
                  onRouteRequest={onRouteRequest}
                  initialJourneySlug={initialJourneySlug}
                />
              </div>
            </>,
            shadowRoot,
          )
        : null}
    </div>
  );
}

export default function ActivationRoute({ activatedSegments, section = "bp", themeMode = "dark" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const journeySlug = searchParams.get("journey");
  const meta = SECTION_META[section] ?? SECTION_META.bp;

  function handleRouteRequest(nextRoute) {
    if (nextRoute === "cfg") {
      navigate("/journey-config");
      return;
    }
    if (nextRoute === "qa") {
      navigate("/qa-automation");
      return;
    }
    navigate("/campaigns-and-journeys");
  }

  function handleBackToCampaignManager() {
    navigate("/campaigns-and-journeys");
  }

  // Show Campaign Manager by default; switch to journey builder when ?journey= is present
  if (section === "bp" && !journeySlug) {
    return <CampaignManager activatedSegments={activatedSegments} />;
  }

  if (section === "bp" && journeySlug) {
    return (
      <section style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
        <div className="page-header" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/campaigns-and-journeys")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "none", border: "1px solid var(--border)",
              color: "var(--text-secondary)", borderRadius: 8,
              padding: "5px 12px", fontSize: 12, fontWeight: 600,
              cursor: "pointer", flexShrink: 0,
            }}
          >
            ← Campaign Manager
          </button>
          <div>
            <div className="page-title">Journey Builder</div>
            <div className="page-description">Editing: {journeySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</div>
          </div>
        </div>
        <div className="page-body" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 760, display: "flex", overflow: "hidden", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-primary)", boxShadow: "var(--shadow-lg)" }}>
            <ActivationShadowHost
              activatedSegments={activatedSegments}
              section="bp"
              onRouteRequest={handleRouteRequest}
              themeMode={themeMode}
              initialJourneySlug={journeySlug}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div className="page-header">
        <div className="page-title">{meta.title}</div>
        <div className="page-description">{meta.description}</div>
      </div>

      <div className="page-body" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            flex: 1,
            minHeight: 760,
            display: "flex",
            overflow: "hidden",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--bg-primary)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <ActivationShadowHost activatedSegments={activatedSegments} section={section} onRouteRequest={handleRouteRequest} themeMode={themeMode} />
        </div>
      </div>
    </section>
  );
}
