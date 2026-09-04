import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import QaAutomationApp from "../qaAutomation/components/App";
import qaAutomationStyles from "../qaAutomation/qaAutomation.css?raw";

/* ── Light-mode CSS variable overrides ──────────────────────────────────
   Appended as a second :host {} block so it wins over the dark defaults
   via cascade order (equal specificity, later declaration wins).
   ──────────────────────────────────────────────────────────────────────── */
const LIGHT_VARS = `
:host {
  --accent: #2c5cdf; --accent-ink: #1e3fa0; --accent-soft: #eef2fc;
  --bg: #f5f6f8; --bg-deep: #ecedf1; --bg-subtle: #fafbfc; --panel: #ffffff;
  --ink: #15171a; --ink-2: #46484e; --ink-3: #74767c; --ink-4: #9b9da4;
  --line: #e2e3e8; --line-2: #ebecf0; --line-3: #d5d7dd;
  --ok: #117a45; --ok-bg: #e3f4ea;
  --warn: #9b6a14; --warn-bg: #fbf1dc;
  --danger: #b3261e; --danger-bg: #fbe5e3;
  --info-bg: #e9eef9; --log-bg: #0f1115;
  --shadow-sm: 0 1px 2px rgba(20,22,26,0.04), 0 1px 1px rgba(20,22,26,0.03);
  --shadow-md: 0 4px 14px rgba(20,22,26,0.07), 0 1px 3px rgba(20,22,26,0.05);
  --shadow-lg: 0 18px 40px rgba(20,22,26,0.12), 0 6px 18px rgba(20,22,26,0.08);
}`;

/* ── Dark-mode semantic overrides ────────────────────────────────────────
   The base CSS was written light-first with many hardcoded hex colors.
   These plain class rules override those colors in dark mode.
   Appended AFTER the base CSS so they win via cascade order.
   ──────────────────────────────────────────────────────────────────────── */
const DARK_OVERRIDES = `
/* Node glyphs */
.jo-node__glyph--source  { background: rgba(74,126,255,0.18); color: #8ab4ff; }
.jo-node__glyph--logic   { background: rgba(138,155,181,0.14); color: #8a9bb5; }
.jo-node__glyph--action  { background: rgba(52,211,153,0.14); color: #34d399; }
.jo-node__glyph--data    { background: rgba(167,139,250,0.16); color: #c4b5fd; }
.jo-node__glyph--accent  { background: rgba(74,126,255,0.16); color: #8ab4ff; }
.jo-node__glyph--danger  { background: rgba(248,113,113,0.14); color: #f87171; }
.jo-node__glyph--warn    { background: rgba(251,191,36,0.14); color: #fbbf24; }
.jo-node__glyph--exit    { background: rgba(90,104,128,0.2); color: #8a9bb5; }
.jo-node__glyph--neutral { background: rgba(90,104,128,0.14); color: #8a9bb5; }

/* Canvas */
.jo-canvas__grid { background-image: radial-gradient(circle, rgba(138,155,181,0.12) 1px, transparent 1px); }
.jo-edge path { stroke: rgba(90,104,128,0.5); }
.jo-edge rect { fill: var(--bg-subtle); stroke: var(--line-3); }
.jo-edge text { fill: var(--ink-3); }
.jo-node { background: var(--panel); border-color: var(--line-2); }
.jo-node__meta { background: var(--bg-subtle); border-top-color: var(--line-2); }
.jo-node__reach { background: var(--bg-subtle); border-color: var(--line-2); color: var(--ink-2); }

/* Panels */
.jo-globalhead, .jo-subhead, .jo-cvtools, .jo-leftrail, .jo-inspector, .jo-run { background: var(--panel); }
.jo-table th { background: var(--bg-subtle); }
.jo-table tr.is-sel { background: var(--accent-soft); }

/* Tags */
.jo-tag--test    { background: rgba(74,126,255,0.16); color: #8ab4ff; }
.jo-tag--control { background: rgba(167,139,250,0.16); color: #c4b5fd; }
.jo-tag--holdout { background: rgba(52,211,153,0.14); color: #34d399; }

/* Pills */
.jo-pill--ok   { background: rgba(52,211,153,0.14); color: #34d399; }
.jo-pill--warn { background: rgba(251,191,36,0.14); color: #fbbf24; }

/* Suite counts (jo- prefix) */
.jo-qa-suite__count--pass { background: rgba(52,211,153,0.14); color: #34d399; }
.jo-qa-suite__count--warn { background: rgba(251,191,36,0.14); color: #fbbf24; }
.jo-qa-suite__count--fail { background: rgba(248,113,113,0.14); color: #f87171; }

/* KPI ok */
.jo-kpi--ok { border-color: rgba(52,211,153,0.2); background: rgba(52,211,153,0.07); }
.jo-kpi--ok .jo-kpi__v { color: #34d399; }

/* Suites */
.jo-suite { background: var(--panel); }
.jo-suite:hover { background: var(--bg-subtle); border-color: var(--line-3); }
.jo-suite.is-selected { background: rgba(74,126,255,0.12); border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }

/* Cards */
.jo-card { background: var(--bg-subtle); }

/* Warn banners */
.jo-warn--warn { background: rgba(251,191,36,0.12); color: #fbbf24; border-left-color: #fbbf24; }
.jo-warn--info { background: rgba(74,126,255,0.12); color: #8ab4ff; border-left-color: var(--accent); }

/* Results */
.jo-results__summary { border-color: var(--line-2); background: var(--bg-subtle); }

/* Journey + Segment picker dropdowns — hardcoded for guaranteed visibility in dark mode */
.jo-jpicker__menu { background: #1a2540; border: 1px solid #2a3d60; box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.5); }
.jo-jpicker__search { background: #121c30; border-bottom-color: #2a3d60; }
.jo-jpicker__item:hover { background: #1f2f4a; }
.jo-jpicker__item.is-active { background: rgba(74,126,255,0.18); }
.jo-jpicker__item-name { color: #dde6f5; }
.jo-jpicker__item-meta { color: #576880; }
.jo-jpicker__search input { color: #dde6f5; }
.jo-spicker__menu { background: #1a2540; border: 1px solid #2a3d60; box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.5); }
.jo-spicker__item { color: #dde6f5; }
.jo-spicker__item:hover { background: #1f2f4a; }
.jo-spicker__item.is-active { background: rgba(74,126,255,0.18); }
.jo-spicker__item.is-active .jo-spicker__item-name { color: #8ab4ff; }
.jo-spicker__item-size { color: #576880; }
/* Journey picker button — visible dropdown affordance */
.jo-jpicker__btn { background: #0d1828; border-color: #2a3d60; }
.jo-jpicker__btn:hover { background: #131f35; border-color: #3a5080; }
.jo-jpicker__btn.is-open { background: #101e32; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(74,126,255,0.18); }
.jo-jpicker__name { color: #dde6f5; }
.jo-jpicker__chev { color: #576880; }

/* Segment picker button — visible dropdown affordance */
.jo-spicker__btn { background: #0d1828; border-color: #2a3d60; }
.jo-spicker__btn:hover { background: #131f35; border-color: #3a5080; }
.jo-spicker.is-open .jo-spicker__btn { background: #101e32; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(74,126,255,0.18); }
.jo-spicker__name { color: #dde6f5; }

/* Inputs default */
input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea { background: var(--bg-deep); color: var(--ink); }
input:not([type="checkbox"]):not([type="radio"]):focus, select:focus, textarea:focus { background: var(--panel); border-color: var(--accent); }

/* Walk verdicts */
.qa-walk__verdict--pass { background: rgba(52,211,153,0.14); color: #34d399; }
.qa-walk__verdict--warn { background: rgba(251,191,36,0.14); color: #fbbf24; }
.qa-walk__verdict--fail { background: rgba(248,113,113,0.14); color: #f87171; }

/* Walk row */
.qa-walk:hover { background: var(--bg-subtle); border-color: var(--line-3); }
.qa-walk-detail { background: var(--bg-deep); }
.qa-walk-detail--warn { border-color: var(--warn); }

/* Scenario / suite-preview head hover */
.qa-scenario__head:hover { background: var(--bg-subtle); }
.qa-suite-preview__head:hover { background: var(--bg-subtle); }

/* Tag chips */
.qa-tagchip--eligible { background: rgba(52,211,153,0.14); color: #34d399; }
.qa-tagchip--variant  { background: rgba(74,126,255,0.14); color: #8ab4ff; }

/* Category badges */
.qa-cat--eligible  { background: rgba(52,211,153,0.14); color: #34d399; }
.qa-cat--ineligible { background: rgba(248,113,113,0.14); color: #f87171; }

/* Suite counts (no prefix) */
.qa-suite__count--pass { background: rgba(52,211,153,0.14); color: #34d399; }
.qa-suite__count--warn { background: rgba(251,191,36,0.14); color: #fbbf24; }
.qa-suite__count--fail { background: rgba(248,113,113,0.14); color: #f87171; }

/* Run pill */
.qa-run-pill--warn .qa-run-pill__verdict { color: var(--warn); }

/* Extend example hover & error */
.jo-extend__example:hover { background: var(--bg-subtle); color: var(--ink); }
.jo-extend__error { background: rgba(248,113,113,0.12); color: #f87171; border-color: rgba(248,113,113,0.25); }
.jo-extend__error-close { color: #f87171; }

/* Profile group dot */
.qa-pgroup__dot--eligible { background: #34d399; }

/* Profile cards — visible border in dark mode */
.qa-pcard { border-color: #2a3d60; background: #0d1828; }
.qa-pcard:hover { background: #131f35; border-color: #3a5080; }
.qa-pcard.is-active { border-color: var(--accent); background: rgba(74,126,255,0.12); }
.qa-pgroup__head { color: #8aa3c0; }
.qa-pcard__name { color: #dde6f5; }
.qa-pcard__sub { color: #576880; }
.qa-pcard__avatar { background: rgba(74,126,255,0.2); color: #8ab4ff; }

/* QA suite cards — visible border in dark mode */
.qa-scard { border-color: #2a3d60; background: #0d1828; }
.qa-scard__head:hover { background: #131f35; }
.qa-scard__name { color: #dde6f5; }
.qa-scard__desc { color: #576880; }
.qa-scard.is-open .qa-scard__head { background: #101e32; }

/* Workbench columns */
.qa-wb__col { border-color: #2a3d60; background: var(--panel); }
`;

export function QaAutomationShadowHost({
  themeMode = "dark",
  initialJourneyId = null,
  autoSynth = false,
}) {
  const hostRef = useRef(null);
  const [shadowRoot, setShadowRoot] = useState(null);

  useEffect(() => {
    if (!hostRef.current) return;
    setShadowRoot((current) => current ?? hostRef.current.shadowRoot ?? hostRef.current.attachShadow({ mode: "open" }));
  }, []);

  // Build the scoped CSS for this theme
  const scopedStyles = useMemo(() => {
    // Transform for shadow DOM: :root → :host, first body { → .jo {
    const base = qaAutomationStyles
      .replace(":root {", ":host {")
      .replace("body {", ".jo {");

    if (themeMode === "light") {
      // Append light var overrides — same specificity as :host {}, last wins
      return base + LIGHT_VARS;
    } else {
      // Append dark semantic overrides as plain class rules
      return base + DARK_OVERRIDES;
    }
  }, [themeMode]);

  return (
    <div ref={hostRef} style={{ flex: 1, minHeight: 0, display: "block" }}>
      {shadowRoot
        ? createPortal(
            <>
              <style>{`:host{display:block;height:100%;}${scopedStyles}`}</style>
              <QaAutomationApp initialJourneyId={initialJourneyId} autoSynth={autoSynth} />
            </>,
            shadowRoot,
          )
        : null}
    </div>
  );
}

export default function QaAutomationRoute({ themeMode = "dark" }) {
  return (
    <section style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div className="page-header">
        <div className="page-title">QA & Automation</div>
        <div className="page-description">Select a journey and segment, generate profiles and QA suites, then run validation end to end.</div>
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
          <QaAutomationShadowHost themeMode={themeMode} />
        </div>
      </div>
    </section>
  );
}
