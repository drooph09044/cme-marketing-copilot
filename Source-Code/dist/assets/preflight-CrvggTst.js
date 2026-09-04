import{r as b,j as r,c as ir}from"./index-CYfFzljI.js";const vr=`\uFEFF/* =========================================================\r
   Orchestrate â€” enterprise journey testing console\r
   Visual system: dense, neutral, work-tool first\r
   ========================================================= */\r
\r
:root {\r
  /* Dark defaults — app ships dark-first */\r
  --accent: #4a7eff;\r
  --accent-ink: #8ab4ff;\r
  --accent-soft: rgba(74,126,255,0.14);\r
  --bg: #070b11;\r
  --bg-deep: #0b1018;\r
  --bg-subtle: #0c1220;\r
  --panel: #0f1622;\r
  --ink: #dde6f5;\r
  --ink-2: #8a9bb5;\r
  --ink-3: #576880;\r
  --ink-4: #3a4e6a;\r
  --line: #142034;\r
  --line-2: #192d48;\r
  --line-3: #1f3560;\r
\r
  --ok: #34d399;\r
  --ok-bg: rgba(52,211,153,0.13);\r
  --warn: #fbbf24;\r
  --warn-bg: rgba(251,191,36,0.13);\r
  --danger: #f87171;\r
  --danger-bg: rgba(248,113,113,0.13);\r
  --info-bg: rgba(74,126,255,0.13);\r
  --log-bg: #060a0f;\r
\r
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3), 0 1px 1px rgba(0,0,0,0.2);\r
  --shadow-md: 0 4px 14px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3);\r
  --shadow-lg: 0 18px 40px rgba(0,0,0,0.5), 0 6px 18px rgba(0,0,0,0.35);\r
\r
  --r-sm: 4px;\r
  --r-md: 6px;\r
  --r-lg: 10px;\r
  --r-xl: 14px;\r
\r
  --h-header: 44px;\r
  --h-subhead: 68px;\r
  --h-cvtools: 36px;\r
  --w-leftrail: 224px;\r
  --w-inspector: min(460px, 40%);\r
  --h-run: 268px;\r
  --h-run-collapsed: 44px;\r
\r
  --row: 36px;\r
}\r
\r
:host([data-theme="light"]) {\r
  --accent: #2c5cdf;\r
  --accent-ink: #1e3fa0;\r
  --accent-soft: #eef2fc;\r
  --bg: #f5f6f8;\r
  --bg-deep: #ecedf1;\r
  --bg-subtle: #fafbfc;\r
  --panel: #ffffff;\r
  --ink: #15171a;\r
  --ink-2: #46484e;\r
  --ink-3: #74767c;\r
  --ink-4: #9b9da4;\r
  --line: #e2e3e8;\r
  --line-2: #ebecf0;\r
  --line-3: #d5d7dd;\r
  --ok: #117a45;\r
  --ok-bg: #e3f4ea;\r
  --warn: #9b6a14;\r
  --warn-bg: #fbf1dc;\r
  --danger: #b3261e;\r
  --danger-bg: #fbe5e3;\r
  --info-bg: #e9eef9;\r
  --log-bg: #0f1115;\r
  --shadow-sm: 0 1px 2px rgba(20,22,26,0.04), 0 1px 1px rgba(20,22,26,0.03);\r
  --shadow-md: 0 4px 14px rgba(20,22,26,0.07), 0 1px 3px rgba(20,22,26,0.05);\r
  --shadow-lg: 0 18px 40px rgba(20,22,26,0.12), 0 6px 18px rgba(20,22,26,0.08);\r
}\r
\r
* { box-sizing: border-box; }\r
html, body { margin: 0; padding: 0; }\r
body {\r
  font-family: "Geist", "SÃ¶hne", "Inter Tight", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\r
  font-size: 13px;\r
  line-height: 1.45;\r
  color: var(--ink);\r
  background: var(--bg);\r
  -webkit-font-smoothing: antialiased;\r
  -moz-osx-font-smoothing: grayscale;\r
  font-feature-settings: "ss01", "cv11";\r
}\r
button { font: inherit; color: inherit; }\r
a { color: inherit; text-decoration: none; cursor: pointer; }\r
input, select, textarea { font: inherit; color: inherit; }\r
.mono { font-family: "Geist Mono", "JetBrains Mono", "SF Mono", ui-monospace, monospace; font-size: 12px; }\r
\r
/* =========================================================\r
   App shell\r
   ========================================================= */\r
html, body { height: 100%; min-height: 100%; }\r
body { display: flex; flex-direction: column; min-height: 100vh; }\r
.jo {\r
  flex: 1;\r
  min-height: 0;\r
  height: 100vh;\r
  display: flex; flex-direction: column;\r
  background: var(--bg);\r
  overflow: visible; /* allow dropdown menus to overflow the subhead */\r
}\r
\r
/* Global header */\r
.jo-globalhead {\r
  height: var(--h-header);\r
  background: var(--panel);\r
  border-bottom: 1px solid var(--line);\r
  display: flex; align-items: center; justify-content: space-between;\r
  padding: 0 14px;\r
  position: relative; z-index: 30;\r
}\r
.jo-globalhead__left { display: flex; align-items: center; gap: 18px; }\r
.jo-logo {\r
  display: flex; align-items: center; gap: 8px;\r
  font-weight: 600; letter-spacing: -0.01em; font-size: 14px;\r
}\r
.jo-logo svg { fill: var(--ink); }\r
.jo-crumbs {\r
  display: flex; align-items: center; gap: 8px;\r
  font-size: 12.5px; color: var(--ink-2);\r
}\r
.jo-crumbs a { color: var(--ink-3); }\r
.jo-crumbs a:hover { color: var(--ink); }\r
.jo-crumbs i {\r
  font-style: normal; color: var(--ink-4);\r
}\r
.jo-crumbs span { color: var(--ink); font-weight: 500; }\r
\r
.jo-globalhead__right { display: flex; align-items: center; gap: 10px; }\r
.jo-search {\r
  display: flex; align-items: center; gap: 6px;\r
  width: 320px; height: 28px;\r
  border: 1px solid var(--line);\r
  border-radius: var(--r-md);\r
  padding: 0 8px 0 8px;\r
  background: var(--bg-subtle);\r
}\r
.jo-search:focus-within { border-color: var(--accent); background: var(--panel); box-shadow: 0 0 0 3px var(--accent-soft); }\r
.jo-search svg { fill: none; stroke: var(--ink-3); stroke-width: 1.5; flex-shrink: 0; }\r
.jo-search input {\r
  border: 0; outline: 0; background: transparent;\r
  flex: 1; font-size: 12.5px; min-width: 0;\r
}\r
.jo-search kbd {\r
  font: inherit; font-size: 10.5px; color: var(--ink-3);\r
  padding: 1px 5px; border: 1px solid var(--line-3); border-radius: 3px; background: var(--panel);\r
}\r
.jo-env {\r
  display: flex; align-items: center; gap: 6px;\r
  font-size: 12px; color: var(--ink-2);\r
  padding: 4px 8px; border-radius: var(--r-sm); background: var(--bg-deep);\r
}\r
.jo-env__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 2px #d8efdf; }\r
.jo-iconbtn {\r
  width: 28px; height: 28px; border: 0; border-radius: var(--r-md);\r
  background: transparent; cursor: pointer;\r
  display: inline-flex; align-items: center; justify-content: center;\r
}\r
.jo-iconbtn svg { fill: var(--ink-2); }\r
.jo-iconbtn:hover { background: var(--bg-deep); }\r
.jo-avatar {\r
  width: 28px; height: 28px; border-radius: 50%;\r
  background: linear-gradient(135deg, #4a5cb7, #2c5cdf);\r
  color: #fff; font-size: 11px; font-weight: 600;\r
  display: inline-flex; align-items: center; justify-content: center;\r
  letter-spacing: 0.02em;\r
}\r
\r
/* Sub-header */\r
.jo-subhead {\r
  height: var(--h-subhead);\r
  background: var(--panel);\r
  border-bottom: 1px solid var(--line);\r
  display: flex; align-items: center; justify-content: space-between;\r
  padding: 0 16px;\r
  position: relative; z-index: 100;\r
  overflow: visible;\r
}\r
.jo-subhead__title { display: flex; align-items: center; gap: 16px; overflow: visible; }\r
.jo-subhead__title h1 {\r
  margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.012em;\r
  color: var(--ink);\r
}\r
.jo-subhead__meta {\r
  display: flex; align-items: center; gap: 8px;\r
  font-size: 12px; color: var(--ink-3);\r
}\r
.jo-badge {\r
  display: inline-flex; align-items: center; height: 18px; padding: 0 6px;\r
  border-radius: 3px; font-size: 11px; font-weight: 500;\r
  letter-spacing: 0.02em; text-transform: uppercase;\r
}\r
.jo-badge--draft { background: var(--warn-bg); color: var(--warn); }\r
.jo-badge--live { background: var(--ok-bg); color: var(--ok); }\r
.jo-badge--scheduled { background: var(--accent-soft); color: var(--accent-ink); }\r
\r
/* Journey dropdown picker â€” replaces the removed global top bar */\r
.jo-jpicker { position: relative; min-width: 280px; max-width: 360px; }\r
.jo-jpicker__btn {\r
  display: inline-flex; align-items: center; gap: 10px;\r
  padding: 6px 10px 6px 12px; width: 100%;\r
  background: transparent; border: 1px solid transparent; border-radius: var(--r-md);\r
  cursor: pointer; text-align: left;\r
  transition: background 80ms ease, border-color 80ms ease;\r
}\r
.jo-jpicker__btn:hover { background: var(--bg-deep); }\r
.jo-jpicker__btn.is-open {\r
  background: var(--panel); border-color: var(--line-3);\r
  box-shadow: 0 0 0 3px var(--accent-soft);\r
}\r
.jo-jpicker__col { display: flex; flex-direction: column; min-width: 0; }\r
.jo-jpicker__name {\r
  font-size: 13px; font-weight: 600; letter-spacing: -0.01em;\r
  color: var(--ink); margin-top: 1px;\r
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\r
  max-width: 360px;\r
}\r
.jo-jpicker__chev {\r
  fill: none; color: var(--ink-3);\r
  transition: transform 120ms ease;\r
  flex-shrink: 0;\r
}\r
.jo-jpicker__btn.is-open .jo-jpicker__chev { transform: rotate(180deg); color: var(--ink); }\r
\r
/* Segment picker — custom dropdown (no native select) */\r
.jo-spicker {\r
  position: relative;\r
  display: inline-flex; align-items: center;\r
  min-width: 280px; max-width: 360px;\r
}\r
.jo-spicker__btn {\r
  display: inline-flex; align-items: center; gap: 10px;\r
  padding: 6px 10px 6px 12px;\r
  background: transparent;\r
  border: 1px solid var(--line-3);\r
  border-radius: var(--r-md);\r
  cursor: pointer; text-align: left; width: 100%;\r
  transition: background 80ms ease, border-color 80ms ease, box-shadow 80ms ease;\r
}\r
.jo-spicker__btn:hover { background: var(--bg-deep); }\r
.jo-spicker.is-open .jo-spicker__btn {\r
  background: var(--panel);\r
  border-color: var(--accent);\r
  box-shadow: 0 0 0 3px var(--accent-soft);\r
}\r
.jo-spicker .jo-eyebrow {\r
  font-size: 10px; color: var(--ink-3);\r
  text-transform: uppercase; letter-spacing: 0.05em;\r
  font-weight: 500; flex-shrink: 0;\r
}\r
.jo-spicker__name {\r
  font-size: 13px; font-weight: 600; color: var(--ink);\r
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\r
  flex: 1; min-width: 0;\r
}\r
.jo-spicker.is-empty .jo-spicker__name { color: var(--ink-3); font-weight: 400; }\r
\r
/* Custom segment dropdown menu */\r
.jo-spicker__menu {\r
  position: absolute; top: calc(100% + 6px); left: 0;\r
  min-width: 100%; max-height: 300px;\r
  background: var(--panel);\r
  border: 1px solid var(--line);\r
  border-radius: var(--r-lg);\r
  box-shadow: var(--shadow-lg);\r
  z-index: 9999;\r
  overflow-y: auto;\r
}\r
.jo-spicker__menu ul { list-style: none; margin: 0; padding: 4px; }\r
.jo-spicker__item {\r
  display: flex; align-items: center; justify-content: space-between; gap: 12px;\r
  padding: 9px 10px; border-radius: var(--r-sm); cursor: pointer;\r
  font-size: 13px; color: var(--ink);\r
}\r
.jo-spicker__item:hover { background: var(--bg-subtle); }\r
.jo-spicker__item.is-active { background: var(--accent-soft); }\r
.jo-spicker__item-name { font-weight: 500; }\r
.jo-spicker__item.is-active .jo-spicker__item-name { color: var(--accent-ink); }\r
.jo-spicker__item-size { font-size: 11px; color: var(--ink-3); flex-shrink: 0; }\r
\r
.jo-jpicker__menu {\r
  position: absolute; top: calc(100% + 6px); left: 0;\r
  width: 480px; max-height: 440px;\r
  background: var(--panel);\r
  border: 1px solid var(--line);\r
  border-radius: var(--r-lg);\r
  box-shadow: var(--shadow-lg);\r
  z-index: 9999;\r
  display: flex; flex-direction: column;\r
  overflow: hidden;\r
}\r
.jo-jpicker__search {\r
  display: flex; align-items: center; gap: 8px;\r
  padding: 10px 12px;\r
  border-bottom: 1px solid var(--line-2);\r
  color: var(--ink-3);\r
}\r
.jo-jpicker__search input {\r
  border: 0; outline: 0; background: transparent;\r
  flex: 1; font-size: 13px; color: var(--ink);\r
}\r
.jo-jpicker__menu ul {\r
  list-style: none; margin: 0; padding: 4px;\r
  overflow-y: auto;\r
  flex: 1;\r
}\r
.jo-jpicker__item {\r
  display: flex; align-items: center; justify-content: space-between; gap: 12px;\r
  padding: 10px 10px;\r
  border-radius: var(--r-sm);\r
  cursor: pointer;\r
}\r
.jo-jpicker__item:hover { background: var(--bg); }\r
.jo-jpicker__item.is-active {\r
  background: var(--accent-soft);\r
}\r
.jo-jpicker__item-main { min-width: 0; }\r
.jo-jpicker__item-name {\r
  font-size: 13px; font-weight: 600; color: var(--ink);\r
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\r
}\r
.jo-jpicker__item.is-active .jo-jpicker__item-name { color: var(--accent-ink); }\r
.jo-jpicker__item-meta {\r
  display: flex; gap: 6px; align-items: center;\r
  font-size: 11px; color: var(--ink-3);\r
  margin-top: 2px;\r
}\r
\r
.jo-eyebrow {\r
  font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase;\r
  color: var(--ink-3); font-weight: 500;\r
}\r
\r
.jo-subhead__right { display: flex; align-items: center; gap: 14px; }\r
.jo-modes {\r
  display: inline-flex; padding: 2px;\r
  background: var(--bg-deep); border-radius: var(--r-md);\r
}\r
.jo-modes__btn {\r
  border: 0; background: transparent; padding: 6px 14px;\r
  font-size: 12.5px; color: var(--ink-2); border-radius: 4px;\r
  cursor: pointer;\r
}\r
.jo-modes__btn:hover { color: var(--ink); }\r
.jo-modes__btn.is-on {\r
  background: var(--panel); color: var(--ink); font-weight: 500;\r
  box-shadow: var(--shadow-sm);\r
}\r
\r
.jo-subhead__actions { display: flex; align-items: center; gap: 8px; }\r
.jo-btn {\r
  height: 30px; padding: 0 14px;\r
  border: 1px solid var(--line-3); background: var(--panel);\r
  border-radius: var(--r-md);\r
  font-size: 12.5px; font-weight: 500;\r
  cursor: pointer; display: inline-flex; align-items: center; gap: 6px;\r
  transition: background 80ms ease, border-color 80ms ease;\r
}\r
.jo-btn:hover { background: var(--bg); }\r
.jo-btn--primary {\r
  background: var(--accent); border-color: var(--accent); color: #fff;\r
}\r
.jo-btn--primary:hover { background: var(--accent-ink); border-color: var(--accent-ink); }\r
.jo-btn--primary[disabled], .jo-btn[disabled] { opacity: 0.5; cursor: not-allowed; }\r
.jo-btn--ghost { border-color: transparent; background: transparent; }\r
.jo-btn--ghost:hover { background: var(--bg-deep); }\r
\r
/* =========================================================\r
   Workspace\r
   ========================================================= */\r
.jo-workspace {\r
  flex: 1;\r
  display: grid;\r
  grid-template-columns: var(--w-inspector) 1fr;\r
  min-height: 0;\r
  overflow: hidden;\r
  transition: grid-template-columns 200ms ease;\r
}\r
/* QA Runs tab: wide 3-column workbench on the left, journey graph kept on the right. */\r
.jo-workspace--qa {\r
  grid-template-columns: minmax(0, 1fr) clamp(280px, 24%, 380px);\r
}\r
.jo-main { overflow: hidden; min-height: 0; }\r
\r
/* Left rail */\r
.jo-leftrail {\r
  background: var(--panel);\r
  border-right: 1px solid var(--line);\r
  display: flex; flex-direction: column;\r
  min-width: 0;\r
}\r
.jo-leftnav {\r
  padding: 8px 8px;\r
  display: flex; flex-direction: column; gap: 2px;\r
  border-bottom: 1px solid var(--line-2);\r
}\r
.jo-leftnav__btn {\r
  display: flex; align-items: center; gap: 10px;\r
  height: 32px; padding: 0 8px;\r
  border: 0; background: transparent; cursor: pointer;\r
  border-radius: var(--r-sm);\r
  font-size: 12.5px; color: var(--ink-2); text-align: left;\r
}\r
.jo-leftnav__btn:hover { background: var(--bg); }\r
.jo-leftnav__btn.is-on { background: var(--accent-soft); color: var(--accent-ink); }\r
.jo-leftnav__glyph {\r
  width: 20px; height: 20px; border-radius: 4px;\r
  background: var(--bg-deep); color: var(--ink-2);\r
  display: inline-flex; align-items: center; justify-content: center;\r
  font-size: 11px; font-weight: 600;\r
}\r
.jo-leftnav__btn.is-on .jo-leftnav__glyph { background: var(--accent); color: #fff; }\r
\r
.jo-preflight { padding: 14px 12px; }\r
.jo-preflight header { margin-bottom: 10px; }\r
.jo-preflight header h4 { margin: 2px 0 0; font-size: 13px; font-weight: 600; }\r
.jo-preflight__list {\r
  list-style: none; margin: 0; padding: 0;\r
  display: flex; flex-direction: column; gap: 6px;\r
}\r
.jo-preflight__list li {\r
  display: flex; align-items: center; gap: 10px;\r
  padding: 8px 10px;\r
  border: 1px solid var(--line-2); border-radius: var(--r-md);\r
  background: var(--panel);\r
}\r
.jo-pf__count {\r
  min-width: 26px; height: 26px; border-radius: 6px;\r
  background: var(--accent-soft); color: var(--accent-ink);\r
  display: inline-flex; align-items: center; justify-content: center;\r
  font-size: 12px; font-weight: 600;\r
}\r
.jo-preflight__list b { font-size: 12.5px; font-weight: 600; display: block; }\r
.jo-preflight__list p { margin: 2px 0 0; font-size: 11.5px; color: var(--ink-3); }\r
\r
.jo-preflight__warnings {\r
  margin-top: 14px;\r
  display: flex; flex-direction: column; gap: 6px;\r
}\r
.jo-warn {\r
  display: flex; gap: 8px; align-items: flex-start;\r
  font-size: 11.5px; padding: 8px 10px;\r
  border-radius: var(--r-sm);\r
  border-left: 3px solid transparent;\r
}\r
.jo-warn--warn { background: var(--warn-bg); color: var(--warn); border-left-color: var(--warn); }\r
.jo-warn--info { background: var(--info-bg); color: var(--accent-ink); border-left-color: var(--accent); }\r
.jo-warn__dot {\r
  width: 6px; height: 6px; border-radius: 50%; background: currentColor;\r
  margin-top: 5px; flex-shrink: 0; opacity: 0.7;\r
}\r
\r
/* =========================================================\r
   Center (canvas)\r
   ========================================================= */\r
.jo-main {\r
  display: flex; flex-direction: column;\r
  min-width: 0; background: var(--bg);\r
  position: relative; /* anchors the simulation-results overlay */\r
}\r
\r
/* â”€â”€ Simulation-results overlay (floats in a corner of the canvas) â”€â”€â”€â”€â”€â”€â”€â”€â”€ */\r
.qa-sim-overlay {\r
  position: absolute; right: 16px; bottom: 16px; z-index: 40;\r
  width: 250px; padding: 12px 13px 11px;\r
  background: var(--panel); border: 1px solid var(--line);\r
  border-radius: 12px; box-shadow: 0 8px 26px rgba(16, 24, 40, 0.14);\r
  border-left: 3px solid var(--ink-4);\r
  animation: qa-sim-overlay-in 0.16s ease-out;\r
}\r
.qa-sim-overlay--pass { border-left-color: var(--ok); }\r
.qa-sim-overlay--fail { border-left-color: var(--danger); }\r
@keyframes qa-sim-overlay-in {\r
  from { opacity: 0; transform: translateY(6px); }\r
  to   { opacity: 1; transform: translateY(0); }\r
}\r
.qa-sim-overlay__close {\r
  position: absolute; top: 6px; right: 8px;\r
  border: none; background: none; cursor: pointer;\r
  font-size: 16px; line-height: 1; color: var(--ink-4);\r
}\r
.qa-sim-overlay__close:hover { color: var(--ink-2); }\r
.qa-sim-overlay__head {\r
  display: flex; align-items: center; gap: 8px; padding-right: 16px;\r
}\r
.qa-sim-overlay__verdict {\r
  font: 600 10.5px/1 var(--mono, monospace); letter-spacing: 0.04em;\r
  padding: 3px 6px; border-radius: 5px; color: #fff;\r
}\r
.qa-sim-overlay__verdict--pass { background: var(--ok); }\r
.qa-sim-overlay__verdict--fail { background: var(--danger); }\r
.qa-sim-overlay__name {\r
  font-size: 12.5px; font-weight: 600; color: var(--ink);\r
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\r
}\r
.qa-sim-overlay__stats {\r
  display: flex; flex-wrap: wrap; gap: 4px 6px; margin-top: 9px;\r
}\r
.qa-sim-overlay__stat {\r
  font-size: 10.5px; font-weight: 600; padding: 2px 7px;\r
  border-radius: 999px; background: var(--ink-7, #f1f2f4); color: var(--ink-2);\r
}\r
.qa-sim-overlay__stat--pass { background: var(--ok-bg); color: #117a45; }\r
.qa-sim-overlay__stat--fail { background: var(--warn-bg, #fdeeee); color: var(--danger); }\r
.qa-sim-overlay__stat--skipped { background: #eef0f3; color: var(--ink-3); }\r
.qa-sim-overlay__foot {\r
  margin-top: 9px; font-size: 10.5px; color: var(--ink-3);\r
}\r
.qa-sim-overlay__stopped { color: #b97a14; margin-left: 5px; }\r
.jo-cvtools {\r
  height: var(--h-cvtools);\r
  background: var(--panel); border-bottom: 1px solid var(--line);\r
  display: flex; align-items: center; justify-content: space-between;\r
  padding: 0 14px;\r
  flex-shrink: 0;\r
}\r
.jo-cvtools__hint {\r
  font-size: 12px; color: var(--ink-2);\r
  display: flex; align-items: center; gap: 8px;\r
}\r
.jo-mode-dot {\r
  width: 8px; height: 8px; border-radius: 50%; background: var(--ink-4);\r
  box-shadow: 0 0 0 2px rgba(0,0,0,0.04);\r
}\r
.jo-mode-dot--test   { background: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }\r
.jo-mode-dot--dryrun { background: #b97a14; box-shadow: 0 0 0 2px var(--warn-bg); }\r
.jo-mode-dot--suite  { background: #117a45; box-shadow: 0 0 0 2px var(--ok-bg); }\r
\r
.jo-cvtools__right { display: flex; align-items: center; gap: 18px; }\r
.jo-cvtools__stat {\r
  display: flex; align-items: baseline; gap: 6px;\r
  font-size: 11.5px; color: var(--ink-3);\r
}\r
.jo-cvtools__stat b { color: var(--ink); font-size: 12.5px; font-weight: 600; }\r
\r
/* Canvas */\r
.jo-canvas {\r
  position: relative; flex: 1;\r
  overflow: hidden;\r
  background: var(--bg);\r
  cursor: grab;\r
}\r
.jo-canvas:active { cursor: grabbing; }\r
.jo-canvas__grid {\r
  position: absolute; inset: 0;\r
  background-image:\r
    radial-gradient(circle, rgba(20,22,26,0.06) 1px, transparent 1px);\r
  background-size: 18px 18px;\r
  background-position: 0 0;\r
  pointer-events: none;\r
}\r
.jo-canvas__inner {\r
  position: absolute; left: 0; top: 0;\r
  width: 1700px; height: 600px;\r
  transform-origin: 0 0;\r
  will-change: transform;\r
}\r
.jo-canvas__edges {\r
  position: absolute; left: 0; top: 0;\r
  pointer-events: none;\r
  overflow: visible;\r
}\r
.jo-edge path {\r
  stroke: #b6b8bf; stroke-width: 1.4;\r
  fill: none;\r
}\r
.jo-edge.is-on path {\r
  stroke: var(--accent); stroke-width: 2;\r
  filter: drop-shadow(0 0 4px rgba(44, 92, 223, 0.35));\r
}\r
.jo-edge rect {\r
  fill: #fff; stroke: var(--line-3); stroke-width: 1;\r
}\r
.jo-edge text {\r
  font-size: 10px; fill: var(--ink-3);\r
  font-family: inherit;\r
}\r
\r
/* Node */\r
.jo-node {\r
  position: absolute;\r
  background: var(--panel);\r
  border: 1px solid var(--line-3);\r
  border-radius: var(--r-md);\r
  box-shadow: var(--shadow-sm);\r
  display: flex; flex-direction: column;\r
  cursor: pointer;\r
  transition: box-shadow 100ms, border-color 100ms, transform 80ms;\r
  overflow: hidden;\r
}\r
.jo-node:hover {\r
  box-shadow: var(--shadow-md);\r
  border-color: var(--ink-4);\r
}\r
.jo-node.is-selected {\r
  border-color: var(--accent);\r
  box-shadow: 0 0 0 3px var(--accent-soft), var(--shadow-md);\r
}\r
.jo-node.is-active {\r
  border-color: var(--accent);\r
  box-shadow: 0 0 0 3px var(--accent-soft), 0 8px 22px rgba(44, 92, 223, 0.25);\r
  transform: translateY(-1px);\r
}\r
.jo-node.is-visited {\r
  border-color: var(--ok);\r
}\r
.jo-node.is-visited::after {\r
  content: "";\r
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;\r
  background: var(--ok);\r
}\r
.jo-node__glyph {\r
  position: absolute; left: 8px; top: 8px;\r
  width: 24px; height: 24px; border-radius: 5px;\r
  display: inline-flex; align-items: center; justify-content: center;\r
  font-size: 10.5px; font-weight: 700; letter-spacing: -0.02em;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.jo-node__glyph--source  { background: #e9eef9; color: #2c5cdf; }\r
.jo-node__glyph--logic   { background: #ecedf1; color: #46484e; }\r
.jo-node__glyph--action  { background: #e6f4ea; color: #117a45; }\r
.jo-node__glyph--data    { background: #efeafa; color: #6a4ec4; }\r
.jo-node__glyph--accent  { background: #e3eaff; color: #1e3fa0; }\r
.jo-node__glyph--danger  { background: var(--danger-bg); color: var(--danger); }\r
.jo-node__glyph--warn    { background: var(--warn-bg); color: var(--warn); }\r
.jo-node__glyph--exit    { background: #efeff2; color: #46484e; }\r
.jo-node__glyph--neutral { background: var(--bg-deep); color: var(--ink-2); }\r
\r
.jo-node__body {\r
  padding: 8px 10px 6px 40px;\r
}\r
.jo-node__kind {\r
  font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;\r
  color: var(--ink-3); font-weight: 500;\r
}\r
.jo-node__title {\r
  font-size: 12.5px; font-weight: 600; color: var(--ink);\r
  margin-top: 1px;\r
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\r
}\r
.jo-node__sub {\r
  font-size: 11px; color: var(--ink-3); margin-top: 1px;\r
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\r
}\r
.jo-node__meta {\r
  padding: 4px 10px;\r
  background: var(--bg-subtle);\r
  border-top: 1px solid var(--line-2);\r
  font-size: 10.5px; color: var(--ink-3);\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\r
}\r
\r
/* Node reach badge */\r
.jo-node__reach {\r
  position: absolute; right: 8px; top: 8px;\r
  height: 18px; padding: 0 6px;\r
  background: var(--panel); border: 1px solid var(--line-3); border-radius: 9px;\r
  font-size: 10.5px; color: var(--ink-2); font-weight: 500;\r
  display: inline-flex; align-items: center;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.jo-node.is-visited .jo-node__reach { border-color: var(--ok); color: var(--ok); }\r
\r
/* When dry run mode: dim action nodes */\r
.jo.mode-dryrun .jo-node--channel_email,\r
.jo.mode-dryrun .jo-node--channel_push,\r
.jo.mode-dryrun .jo-node--channel_sms,\r
.jo.mode-dryrun .jo-node--channel_inapp,\r
.jo.mode-dryrun .jo-node--channel_web,\r
.jo.mode-dryrun .jo-node--channel_card,\r
.jo.mode-dryrun .jo-node--channel_dm,\r
.jo.mode-dryrun .jo-node--custom_action,\r
.jo.mode-dryrun .jo-node--ac_delivery,\r
.jo.mode-dryrun .jo-node--code {\r
  opacity: 0.55;\r
}\r
.jo.mode-dryrun .jo-node--channel_email::before,\r
.jo.mode-dryrun .jo-node--channel_push::before,\r
.jo.mode-dryrun .jo-node--channel_sms::before,\r
.jo.mode-dryrun .jo-node--custom_action::before {\r
  content: "SIMULATED";\r
  position: absolute; right: -1px; bottom: -1px;\r
  font-size: 9px; letter-spacing: 0.08em; font-weight: 600;\r
  padding: 2px 6px;\r
  background: var(--warn-bg); color: var(--warn);\r
  border-top-left-radius: var(--r-sm);\r
}\r
\r
/* Canvas controls */\r
.jo-canvas__controls {\r
  position: absolute; right: 14px; bottom: 14px;\r
  display: flex; align-items: center; gap: 2px;\r
  padding: 4px;\r
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-md);\r
  box-shadow: var(--shadow-sm);\r
  z-index: 5;\r
}\r
.jo-canvas__controls button {\r
  width: 26px; height: 26px; border: 0; background: transparent;\r
  border-radius: var(--r-sm); cursor: pointer; color: var(--ink-2);\r
  font-size: 14px;\r
}\r
.jo-canvas__controls button:hover { background: var(--bg-deep); }\r
.jo-canvas__zoom {\r
  font-size: 11px; color: var(--ink-3); padding: 0 8px;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
  border-left: 1px solid var(--line-2); height: 18px; line-height: 18px; margin-left: 2px;\r
}\r
.jo-canvas__legend {\r
  position: absolute; left: 14px; bottom: 14px;\r
  display: flex; align-items: center; gap: 14px;\r
  padding: 6px 10px;\r
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-md);\r
  box-shadow: var(--shadow-sm);\r
  font-size: 11px; color: var(--ink-2);\r
  z-index: 5;\r
}\r
.jo-canvas__legend .lg {\r
  display: inline-block; width: 9px; height: 9px; border-radius: 2px;\r
  margin-right: 5px; vertical-align: -1px;\r
}\r
.lg--danger { background: var(--danger); }\r
.lg--warn { background: var(--warn); }\r
.lg--accent { background: var(--accent); }\r
.lg--neutral { background: var(--ink-3); }\r
\r
/* =========================================================\r
   Inspector (left panel â€” 40% width)\r
   ========================================================= */\r
.jo-inspector {\r
  background: var(--panel);\r
  border-right: 1px solid var(--line);\r
  display: flex; flex-direction: column;\r
  min-width: 0; min-height: 0;\r
  order: -1;\r
}\r
.jo-inspector__tabs {\r
  display: flex; align-items: stretch;\r
  border-bottom: 1px solid var(--line);\r
  flex-shrink: 0;\r
  padding: 0 4px;\r
}\r
.jo-inspector__tabs button {\r
  flex: 1; height: 38px;\r
  border: 0; background: transparent;\r
  font-size: 12px; font-weight: 500; color: var(--ink-3);\r
  cursor: pointer; position: relative;\r
  display: inline-flex; align-items: center; justify-content: center;\r
  gap: 6px;\r
}\r
.jo-inspector__tabs button:hover { color: var(--ink); }\r
.jo-inspector__tabs button.is-on { color: var(--ink); }\r
.jo-inspector__tabs button.is-on::after {\r
  content: ""; position: absolute; left: 8px; right: 8px; bottom: -1px; height: 2px;\r
  background: var(--accent); border-radius: 2px 2px 0 0;\r
}\r
.jo-pill {\r
  display: inline-flex; align-items: center; justify-content: center;\r
  height: 16px; padding: 0 5px; border-radius: 8px;\r
  background: var(--bg-deep); color: var(--ink-2);\r
  font-size: 10.5px; font-weight: 600;\r
}\r
\r
.jo-inspector__body {\r
  flex: 1; min-height: 0;\r
  overflow-y: auto;\r
  overflow-x: hidden;\r
  /* Custom scrollbar â€” visible, slim, themed to match Geist UI. */\r
  scrollbar-width: thin;\r
  scrollbar-color: var(--ink-4) transparent;\r
}\r
/* QA workbench manages its own per-column scroll â€” the body must not scroll/pad. */\r
.jo-inspector__body--qa { overflow: hidden; }\r
.jo-inspector__body::-webkit-scrollbar { width: 8px; }\r
.jo-inspector__body::-webkit-scrollbar-track { background: transparent; }\r
.jo-inspector__body::-webkit-scrollbar-thumb {\r
  background: var(--ink-4); border-radius: 4px;\r
  border: 2px solid var(--panel);\r
}\r
.jo-inspector__body::-webkit-scrollbar-thumb:hover { background: var(--ink-3); }\r
.jo-pane { padding: 14px 14px 24px; }\r
.jo-pane__head {\r
  display: flex; align-items: flex-start; justify-content: space-between;\r
  gap: 10px; margin-bottom: 12px;\r
}\r
.jo-pane__head h3 {\r
  margin: 0; font-size: 13.5px; font-weight: 600;\r
}\r
.jo-pane__head p {\r
  margin: 2px 0 0; color: var(--ink-3); font-size: 11.5px;\r
}\r
.jo-row { display: flex; align-items: center; gap: 6px; }\r
\r
/* Suites list */\r
.jo-suites { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }\r
.jo-suite {\r
  display: grid; grid-template-columns: 18px 1fr auto;\r
  gap: 10px; padding: 12px;\r
  border: 1px solid var(--line-2); border-radius: var(--r-md);\r
  cursor: pointer; background: var(--panel);\r
  transition: border-color 80ms, background 80ms;\r
}\r
.jo-suite:hover { border-color: var(--line-3); background: var(--bg-subtle); }\r
.jo-suite.is-selected {\r
  border-color: var(--accent);\r
  background: var(--accent-soft);\r
  box-shadow: 0 0 0 1px var(--accent) inset;\r
}\r
.jo-suite__radio {\r
  width: 14px; height: 14px; border-radius: 50%;\r
  border: 1.5px solid var(--ink-4); margin-top: 2px;\r
  position: relative;\r
}\r
.jo-suite.is-selected .jo-suite__radio {\r
  border-color: var(--accent);\r
}\r
.jo-suite.is-selected .jo-suite__radio::after {\r
  content: "";\r
  position: absolute; inset: 2px; border-radius: 50%; background: var(--accent);\r
}\r
.jo-suite__name { font-size: 12.5px; font-weight: 600; }\r
.jo-suite__desc { font-size: 11.5px; color: var(--ink-2); margin-top: 2px; line-height: 1.4; }\r
.jo-suite__meta {\r
  display: flex; gap: 10px; font-size: 11px; color: var(--ink-3);\r
  margin-top: 6px;\r
}\r
.jo-suite__cov {\r
  text-align: right; min-width: 80px;\r
}\r
.jo-suite__covbar {\r
  width: 70px; height: 4px; background: var(--bg-deep);\r
  border-radius: 2px; overflow: hidden; margin-bottom: 4px; margin-left: auto;\r
}\r
.jo-suite__covbar i { display: block; height: 100%; background: var(--accent); border-radius: 2px; }\r
.jo-suite__covnum { font-size: 12px; font-weight: 600; }\r
.jo-suite__covlbl { font-size: 10px; color: var(--ink-3); }\r
\r
/* Generate form */\r
.jo-gen {\r
  background: var(--bg-subtle);\r
  border: 1px solid var(--line-2);\r
  border-radius: var(--r-md);\r
  padding: 10px 12px;\r
  margin-bottom: 12px;\r
}\r
.jo-gen__row {\r
  display: flex; align-items: center; gap: 8px;\r
  font-size: 12px; flex-wrap: wrap;\r
}\r
.jo-gen__row label { color: var(--ink-3); }\r
.jo-gen__row input, .jo-gen__row select {\r
  height: 26px; padding: 0 8px;\r
  border: 1px solid var(--line-3); border-radius: var(--r-sm);\r
  background: var(--panel);\r
  font-size: 12px;\r
}\r
.jo-gen__row input { width: 64px; }\r
.jo-gen__row input:focus, .jo-gen__row select:focus {\r
  outline: 0; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft);\r
}\r
.jo-gen__hint { font-size: 11px; color: var(--ink-3); margin-top: 8px; }\r
\r
/* Filter chips */\r
.jo-chips { display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap; }\r
.jo-chip {\r
  border: 1px solid var(--line-2); background: var(--panel);\r
  padding: 4px 10px; border-radius: 14px;\r
  font-size: 11.5px; color: var(--ink-2); cursor: pointer;\r
  display: inline-flex; align-items: center; gap: 6px;\r
}\r
.jo-chip:hover { background: var(--bg); }\r
.jo-chip.is-on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); font-weight: 500; }\r
.jo-chip i { font-style: normal; font-size: 10.5px; color: var(--ink-3); }\r
.jo-chip.is-on i { color: var(--accent-ink); }\r
\r
/* Table */\r
.jo-table-wrap {\r
  border: 1px solid var(--line-2);\r
  border-radius: var(--r-md);\r
  overflow: auto;\r
  max-height: 55vh;\r
  min-height: 180px;\r
}\r
.jo-table-wrap::-webkit-scrollbar { width: 6px; height: 6px; }\r
.jo-table-wrap::-webkit-scrollbar-track { background: transparent; }\r
.jo-table-wrap::-webkit-scrollbar-thumb { background: var(--line-3); border-radius: 3px; }\r
.jo-table-wrap::-webkit-scrollbar-thumb:hover { background: var(--ink-3); }\r
.jo-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }\r
.jo-table th {\r
  text-align: left; font-weight: 500;\r
  padding: 7px 8px; background: var(--bg-subtle);\r
  border-bottom: 1px solid var(--line-2);\r
  color: var(--ink-3); font-size: 10.5px;\r
  letter-spacing: 0.04em; text-transform: uppercase;\r
  white-space: nowrap;\r
}\r
.jo-table td {\r
  padding: 7px 8px; border-bottom: 1px solid var(--line-2);\r
  white-space: nowrap;\r
}\r
.jo-table tr:last-child td { border-bottom: 0; }\r
.jo-table tr.is-sel { background: var(--accent-soft); }\r
.jo-table .num { font-family: "Geist Mono", ui-monospace, monospace; color: var(--ink-2); }\r
\r
.jo-prof { display: flex; align-items: center; gap: 8px; }\r
.jo-prof__avatar {\r
  width: 24px; height: 24px; border-radius: 50%;\r
  background: linear-gradient(135deg, #cdd5e5, #a9b3c8);\r
  color: #fff; font-size: 10px; font-weight: 600;\r
  display: inline-flex; align-items: center; justify-content: center;\r
}\r
.jo-prof__name { font-weight: 500; font-size: 12px; }\r
.jo-prof__id { font-size: 10.5px; color: var(--ink-3); font-family: "Geist Mono", ui-monospace, monospace; }\r
.jo-prof__scenario {\r
  font-size: 10.5px; color: var(--accent-ink);\r
  font-style: italic;\r
  margin-top: 1px;\r
  max-width: 240px;\r
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\r
}\r
\r
.jo-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }\r
.jo-dot--ok { background: var(--ok); }\r
.jo-dot--bad { background: var(--danger); }\r
\r
.jo-tag {\r
  display: inline-flex; align-items: center; height: 18px; padding: 0 6px;\r
  border-radius: 3px; font-size: 10.5px; font-weight: 500;\r
}\r
.jo-tag--test { background: #e9eef9; color: var(--accent-ink); }\r
.jo-tag--control { background: #efeafa; color: #6a4ec4; }\r
.jo-tag--suppressed { background: var(--danger-bg); color: var(--danger); }\r
.jo-tag--fcap-risk { background: var(--warn-bg); color: var(--warn); }\r
.jo-tag--holdout { background: #e3f1ed; color: #0f6d54; }\r
\r
/* Criteria pane */\r
.jo-section { margin-bottom: 20px; }\r
.jo-section header {\r
  display: flex; justify-content: space-between; align-items: baseline;\r
  margin-bottom: 8px;\r
}\r
.jo-section header h4 { margin: 0; font-size: 12.5px; font-weight: 600; }\r
.jo-section header span { font-size: 11px; color: var(--ink-3); }\r
\r
.jo-card {\r
  border: 1px solid var(--line-2); border-radius: var(--r-md);\r
  padding: 10px 12px; margin-bottom: 6px; background: var(--panel);\r
}\r
.jo-card__top { display: flex; justify-content: space-between; align-items: center; }\r
.jo-card__title { font-size: 12.5px; font-weight: 600; }\r
.jo-card__pct {\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
  font-size: 13px; font-weight: 600; color: var(--accent);\r
}\r
.jo-card__row {\r
  display: flex; justify-content: space-between;\r
  margin-top: 4px; font-size: 11.5px;\r
}\r
.jo-card__row span { color: var(--ink-3); }\r
.jo-card__row b { font-weight: 500; color: var(--ink); }\r
\r
.jo-list { list-style: none; margin: 0; padding: 0; }\r
.jo-list li {\r
  display: flex; justify-content: space-between; align-items: center;\r
  padding: 8px 0; border-bottom: 1px solid var(--line-2);\r
}\r
.jo-list li:last-child { border-bottom: 0; }\r
.jo-list__label { font-size: 12.5px; font-weight: 500; }\r
.jo-list__sub { font-size: 11px; color: var(--ink-3); margin-top: 1px; }\r
.jo-list__num {\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
  font-size: 13px; font-weight: 600; color: var(--ink);\r
}\r
\r
.jo-rules { list-style: none; margin: 0; padding: 0; }\r
.jo-rule {\r
  display: flex; align-items: center; gap: 10px;\r
  padding: 8px 10px;\r
  border: 1px solid var(--line-2); border-radius: var(--r-sm);\r
  margin-bottom: 4px; font-size: 12px;\r
}\r
.jo-rule__mark {\r
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;\r
}\r
.jo-rule--ok .jo-rule__mark { background: var(--ok); }\r
.jo-rule--warn .jo-rule__mark { background: var(--warn); }\r
.jo-rule--err .jo-rule__mark { background: var(--danger); }\r
.jo-rule__label { flex: 1; }\r
.jo-rule__note {\r
  font-size: 11px; color: var(--warn);\r
  background: var(--warn-bg); padding: 2px 6px; border-radius: 3px;\r
}\r
\r
.jo-empty {\r
  display: flex; align-items: center; justify-content: center;\r
  min-height: 200px; text-align: center;\r
}\r
.jo-empty__title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }\r
.jo-empty p { color: var(--ink-3); font-size: 12px; max-width: 240px; }\r
\r
.jo-dl { margin: 0; }\r
.jo-dl > div {\r
  display: grid; grid-template-columns: 100px 1fr;\r
  padding: 7px 0; border-bottom: 1px solid var(--line-2);\r
  font-size: 12px;\r
}\r
.jo-dl dt { color: var(--ink-3); margin: 0; }\r
.jo-dl dd { margin: 0; color: var(--ink); }\r
\r
/* =========================================================\r
   Run panel (bottom)\r
   ========================================================= */\r
.jo-run {\r
  background: var(--panel);\r
  border-top: 1px solid var(--line);\r
  height: var(--h-run);\r
  display: flex; flex-direction: column;\r
  flex-shrink: 0;\r
  transition: height 200ms ease;\r
}\r
.jo-run.is-collapsed { height: var(--h-run-collapsed); }\r
.jo-run__head {\r
  height: 44px; flex-shrink: 0;\r
  display: flex; align-items: center; justify-content: space-between;\r
  padding: 0 14px;\r
  border-bottom: 1px solid var(--line-2);\r
}\r
.jo-run__title { display: flex; align-items: center; gap: 12px; min-width: 0; }\r
.jo-run__toggle {\r
  width: 22px; height: 22px; border: 0; background: transparent;\r
  border-radius: var(--r-sm); cursor: pointer; color: var(--ink-2);\r
  font-size: 10px;\r
}\r
.jo-run__toggle:hover { background: var(--bg-deep); }\r
.jo-run__title strong {\r
  font-size: 13px; font-weight: 600;\r
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\r
}\r
.jo-status {\r
  display: inline-flex; align-items: center; gap: 6px;\r
  padding: 2px 8px; border-radius: 10px;\r
  font-size: 11px; font-weight: 500;\r
  background: var(--bg-deep); color: var(--ink-2);\r
}\r
.jo-status i { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-4); }\r
.jo-status--running { background: var(--accent-soft); color: var(--accent-ink); }\r
.jo-status--running i { background: var(--accent); animation: pulse 1.1s ease-in-out infinite; }\r
.jo-status--passed { background: var(--ok-bg); color: var(--ok); }\r
.jo-status--passed i { background: var(--ok); }\r
.jo-status--failed { background: var(--danger-bg); color: var(--danger); }\r
.jo-status--failed i { background: var(--danger); }\r
\r
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }\r
\r
.jo-run__prog {\r
  display: inline-block; width: 120px; height: 4px;\r
  background: var(--bg-deep); border-radius: 2px; overflow: hidden;\r
}\r
.jo-run__prog i { display: block; height: 100%; background: var(--accent); transition: width 200ms; }\r
\r
.jo-run__actions { display: flex; align-items: center; gap: 8px; }\r
\r
.jo-run__tabs {\r
  display: flex; gap: 0; padding: 0 14px;\r
  border-bottom: 1px solid var(--line-2);\r
  height: 32px; flex-shrink: 0;\r
}\r
.jo-run__tabs button {\r
  height: 32px; border: 0; background: transparent;\r
  padding: 0 12px; font-size: 11.5px; color: var(--ink-3); cursor: pointer;\r
  display: inline-flex; align-items: center; gap: 6px;\r
  position: relative;\r
}\r
.jo-run__tabs button:hover { color: var(--ink); }\r
.jo-run__tabs button.is-on { color: var(--ink); font-weight: 500; }\r
.jo-run__tabs button.is-on::after {\r
  content: ""; position: absolute; left: 8px; right: 8px; bottom: -1px; height: 2px;\r
  background: var(--accent); border-radius: 2px 2px 0 0;\r
}\r
\r
.jo-run__body {\r
  flex: 1; min-height: 0;\r
  overflow: auto;\r
  padding: 14px;\r
}\r
\r
/* Results KPI grid */\r
.jo-results { display: grid; gap: 14px; }\r
.jo-results__cards {\r
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;\r
}\r
.jo-kpi {\r
  background: var(--bg-subtle); border: 1px solid var(--line-2);\r
  border-radius: var(--r-md);\r
  padding: 10px 12px;\r
}\r
.jo-kpi__k {\r
  font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase;\r
  color: var(--ink-3); font-weight: 500;\r
}\r
.jo-kpi__v {\r
  font-size: 22px; font-weight: 600; margin: 4px 0 2px;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
  letter-spacing: -0.02em;\r
}\r
.jo-kpi__sub { font-size: 11px; color: var(--ink-3); }\r
.jo-kpi--ok { border-color: rgba(17,122,69,0.25); background: #f3faf6; }\r
.jo-kpi--ok .jo-kpi__v { color: var(--ok); }\r
.jo-kpi--danger .jo-kpi__v { color: var(--danger); }\r
.jo-kpi--accent .jo-kpi__v { color: var(--accent); }\r
\r
.jo-results__summary {\r
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px;\r
  padding: 12px; border: 1px solid var(--line-2); border-radius: var(--r-md);\r
}\r
.jo-results__summary-h { font-size: 13px; font-weight: 600; margin-top: 2px; }\r
.jo-results__summary-h--passed { color: var(--ok); }\r
.jo-results__summary-h--running { color: var(--accent); }\r
.jo-results__summary-h--failed { color: var(--danger); }\r
.jo-results__summary-sub { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }\r
\r
/* Logs */\r
.jo-logs {\r
  background: var(--log-bg); color: #cfd2db; border-radius: var(--r-md);\r
  padding: 10px 12px; height: 100%; min-height: 140px;\r
  font-family: "Geist Mono", ui-monospace, monospace; font-size: 11.5px;\r
  overflow: auto;\r
}\r
.jo-logs__empty { color: #8a8e99; font-family: inherit; }\r
.jo-logs__empty b { color: #fff; }\r
.jo-logs__row {\r
  display: grid; grid-template-columns: 78px 38px 1fr 2fr; gap: 10px;\r
  padding: 3px 0;\r
}\r
.jo-logs__row--warn { color: #f6c277; }\r
.jo-logs__ts { color: #6a6e7a; }\r
.jo-logs__node { color: #7da9ff; }\r
.jo-logs__label { color: #fff; font-weight: 500; }\r
.jo-logs__msg { color: #cfd2db; }\r
\r
/* Metrics */\r
.jo-metrics {\r
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;\r
}\r
.jo-metric-block {\r
  border: 1px solid var(--line-2); border-radius: var(--r-md);\r
  padding: 12px;\r
}\r
.jo-metric-block h5 {\r
  margin: 0 0 10px; font-size: 12px; font-weight: 600;\r
}\r
.jo-bar {\r
  display: grid; grid-template-columns: 80px 1fr 60px;\r
  gap: 10px; align-items: center;\r
  font-size: 11.5px;\r
  margin-bottom: 6px;\r
}\r
.jo-bar__label { color: var(--ink-2); }\r
.jo-bar__track {\r
  height: 6px; background: var(--bg-deep); border-radius: 3px; overflow: hidden;\r
}\r
.jo-bar__track i { display: block; height: 100%; background: var(--accent); border-radius: 3px; }\r
.jo-bar__num {\r
  text-align: right; font-family: "Geist Mono", ui-monospace, monospace;\r
  color: var(--ink-2);\r
}\r
.jo-bigstat { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 6px; }\r
.jo-bigstat div { display: flex; flex-direction: column; gap: 2px; }\r
.jo-bigstat b { font-size: 18px; font-weight: 600; font-family: "Geist Mono", ui-monospace, monospace; }\r
.jo-bigstat span { font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.04em; text-transform: uppercase; }\r
\r
/* Assertions */\r
.jo-asserts { width: 100%; border-collapse: collapse; font-size: 12px; }\r
.jo-asserts th {\r
  text-align: left; font-weight: 500; padding: 6px 8px;\r
  background: var(--bg-subtle); border-bottom: 1px solid var(--line-2);\r
  color: var(--ink-3); font-size: 10.5px;\r
  letter-spacing: 0.04em; text-transform: uppercase;\r
}\r
.jo-asserts td { padding: 8px; border-bottom: 1px solid var(--line-2); }\r
.jo-asserts tr:last-child td { border-bottom: 0; }\r
.jo-amark {\r
  display: inline-block; width: 14px; height: 14px; border-radius: 50%;\r
  background: var(--bg-deep);\r
}\r
.jo-amark.is-pass { background: var(--ok); position: relative; }\r
.jo-amark.is-pass::after {\r
  content: ""; position: absolute; left: 4px; top: 3px;\r
  width: 4px; height: 7px;\r
  border-right: 1.5px solid #fff; border-bottom: 1.5px solid #fff;\r
  transform: rotate(45deg);\r
}\r
.jo-amark.is-pend {\r
  background: transparent; border: 1.5px dashed var(--line-3);\r
}\r
\r
/* =========================================================\r
   Test-mode event composer (within run panel)\r
   ========================================================= */\r
.jo-event {\r
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px;\r
}\r
.jo-event__form, .jo-event__payload {\r
  border: 1px solid var(--line-2); border-radius: var(--r-md);\r
  padding: 12px;\r
}\r
.jo-event__form h5, .jo-event__payload h5 {\r
  margin: 0 0 8px; font-size: 12px; font-weight: 600;\r
}\r
.jo-field {\r
  display: grid; grid-template-columns: 110px 1fr; gap: 10px;\r
  align-items: center; margin-bottom: 6px; font-size: 12px;\r
}\r
.jo-field label { color: var(--ink-3); }\r
.jo-field input, .jo-field select {\r
  height: 28px; padding: 0 8px;\r
  border: 1px solid var(--line-3); border-radius: var(--r-sm);\r
  background: var(--panel); font-size: 12px; width: 100%;\r
}\r
.jo-field input:focus, .jo-field select:focus {\r
  outline: 0; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft);\r
}\r
.jo-codeview {\r
  background: var(--log-bg); color: #cfd2db; border-radius: var(--r-sm);\r
  padding: 10px; font-family: "Geist Mono", ui-monospace, monospace;\r
  font-size: 11.5px; line-height: 1.55;\r
  min-height: 140px; width: 100%; border: 0; resize: vertical;\r
  outline: 0;\r
}\r
.jo-codeview:focus { box-shadow: 0 0 0 2px var(--accent); }\r
\r
/* Density tweak */\r
.jo.is-dense { font-size: 12px; }\r
.jo.is-dense .jo-pane { padding: 10px 12px 20px; }\r
.jo.is-dense .jo-table td, .jo.is-dense .jo-table th { padding: 5px 7px; }\r
\r
/* Scrollable table inside inspector */\r
.jo-table-wrap--scroll {\r
  max-height: 340px;\r
  overflow-y: auto;\r
}\r
\r
/* Profile edit row */\r
.jo-prof-edit-row td { padding: 0; background: var(--bg-deep); }\r
.jo-prof-edit {\r
  padding: 12px 14px;\r
  border-top: 1px solid var(--accent-soft);\r
}\r
.jo-prof-edit__grid {\r
  display: grid;\r
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));\r
  gap: 8px 12px;\r
  margin-bottom: 10px;\r
}\r
.jo-prof-edit__grid label {\r
  display: flex; flex-direction: column; gap: 3px;\r
  font-size: 11px; font-weight: 500; color: var(--ink-3);\r
}\r
.jo-prof-edit__grid input,\r
.jo-prof-edit__grid select {\r
  height: 26px; padding: 0 8px;\r
  border: 1px solid var(--line-3); border-radius: var(--r-sm);\r
  background: var(--panel); font-size: 12px; color: var(--ink);\r
}\r
.jo-prof-edit__grid input:focus,\r
.jo-prof-edit__grid select:focus {\r
  outline: 0; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft);\r
}\r
.jo-prof-edit__consent {\r
  flex-direction: row !important; align-items: center; gap: 6px !important;\r
  font-size: 12px !important; color: var(--ink) !important;\r
}\r
.jo-prof-edit__actions { display: flex; gap: 6px; }\r
.jo-table tr.is-editing { background: var(--accent-soft); }\r
.jo-btn-icon {\r
  width: 18px; height: 18px; padding: 0; border: 0; background: transparent;\r
  color: var(--ink-3); font-size: 14px; cursor: pointer; border-radius: 3px;\r
  display: inline-flex; align-items: center; justify-content: center;\r
}\r
.jo-btn-icon:hover { color: var(--danger); background: #fde8e8; }\r
\r
/* QA Runs tab pill variant */\r
.jo-pill--ok { background: #d8efdf; color: #1a7a3a; }\r
.jo-pill--warn { background: #fff0d4; color: #8a5a00; }\r
\r
/* QA Report */\r
.jo-qa-report {}\r
.jo-qa-verdict { display: flex; align-items: center; gap: 8px; margin-top: 4px; }\r
.jo-qa-verdict__dur { font-size: 11px; color: var(--ink-3); font-family: "Geist Mono", ui-monospace, monospace; }\r
.jo-qa-summary { font-size: 12.5px; color: var(--ink-2); margin: 0 0 16px; line-height: 1.5; }\r
.jo-qa-list { margin: 6px 0 0; padding-left: 18px; }\r
.jo-qa-list li { font-size: 12px; color: var(--ink-2); margin-bottom: 4px; }\r
.jo-qa-ok { font-size: 12px; color: var(--ok); margin: 6px 0 0; }\r
.jo-qa-finding { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; margin-bottom: 5px; list-style: none; }\r
.jo-qa-finding__icon { flex-shrink: 0; font-size: 11px; margin-top: 1px; }\r
.jo-qa-finding--info .jo-qa-finding__icon { color: var(--accent); }\r
.jo-qa-finding--warn .jo-qa-finding__icon { color: #d97700; }\r
.jo-qa-finding--err .jo-qa-finding__icon { color: var(--danger); }\r
.jo-qa-walks { padding-left: 0; margin: 6px 0 0; list-style: none; }\r
.jo-qa-walk { border: 1px solid var(--line-2); border-radius: var(--r-md); margin-bottom: 6px; overflow: hidden; }\r
.jo-qa-walk details > summary {\r
  display: flex; align-items: center; justify-content: space-between;\r
  padding: 7px 10px; cursor: pointer; font-size: 12px; font-weight: 500;\r
  list-style: none; user-select: none;\r
}\r
.jo-qa-walk details > summary::-webkit-details-marker { display: none; }\r
.jo-qa-walk details[open] > summary { border-bottom: 1px solid var(--line-2); }\r
.jo-qa-walk__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; }\r
.jo-qa-steps { margin: 0; padding: 8px 10px; list-style: none; display: flex; flex-direction: column; gap: 4px; }\r
.jo-qa-step { display: flex; gap: 8px; font-size: 11.5px; align-items: flex-start; }\r
.jo-qa-step code { flex-shrink: 0; font-size: 10.5px; background: var(--bg-deep); padding: 1px 5px; border-radius: 3px; }\r
.jo-qa-step--pass code { color: var(--ok); }\r
.jo-qa-step--warn code { color: #d97700; }\r
.jo-qa-step--fail code { color: var(--danger); }\r
\r
/* QA top-level totals strip */\r
.jo-qa-totals {\r
  display: grid;\r
  grid-template-columns: repeat(4, 1fr);\r
  gap: 6px;\r
  margin: 0 0 14px;\r
}\r
.jo-qa-totals__stat {\r
  display: flex; flex-direction: column; align-items: flex-start;\r
  padding: 8px 10px; border: 1px solid var(--line-2); border-radius: var(--r-md);\r
  background: var(--bg-subtle);\r
}\r
.jo-qa-totals__stat strong { font-size: 16px; font-weight: 600; color: var(--ink); font-family: "Geist Mono", ui-monospace, monospace; }\r
.jo-qa-totals__stat span { font-size: 10.5px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }\r
.jo-qa-totals__stat--pass strong { color: var(--ok); }\r
.jo-qa-totals__stat--warn strong { color: #d97700; }\r
.jo-qa-totals__stat--fail strong { color: var(--danger); }\r
\r
/* Test suite cards */\r
.jo-qa-suites { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 6px; }\r
.jo-qa-suite { border: 1px solid var(--line-2); border-radius: var(--r-md); background: var(--panel); overflow: hidden; }\r
.jo-qa-suite--pass { border-left: 3px solid var(--ok); }\r
.jo-qa-suite--warn { border-left: 3px solid #d97700; }\r
.jo-qa-suite--fail { border-left: 3px solid var(--danger); }\r
.jo-qa-suite > details > summary {\r
  display: grid;\r
  grid-template-columns: 18px 1fr auto;\r
  align-items: center;\r
  gap: 10px;\r
  padding: 10px 12px;\r
  cursor: pointer;\r
  list-style: none;\r
  user-select: none;\r
}\r
.jo-qa-suite > details > summary::-webkit-details-marker { display: none; }\r
.jo-qa-suite > details[open] > summary { border-bottom: 1px solid var(--line-2); }\r
.jo-qa-suite__icon { font-size: 14px; font-weight: 600; }\r
.jo-qa-suite--pass .jo-qa-suite__icon { color: var(--ok); }\r
.jo-qa-suite--warn .jo-qa-suite__icon { color: #d97700; }\r
.jo-qa-suite--fail .jo-qa-suite__icon { color: var(--danger); }\r
.jo-qa-suite__heading { display: flex; flex-direction: column; gap: 2px; min-width: 0; }\r
.jo-qa-suite__name { font-size: 12.5px; font-weight: 600; color: var(--ink); }\r
.jo-qa-suite__desc { font-size: 11px; color: var(--ink-3); line-height: 1.35; }\r
.jo-qa-suite__counts {\r
  display: inline-flex; align-items: center; gap: 4px;\r
  font-family: "Geist Mono", ui-monospace, monospace; font-size: 11.5px;\r
}\r
.jo-qa-suite__count {\r
  display: inline-flex; align-items: center; justify-content: center;\r
  min-width: 22px; height: 20px; padding: 0 6px; border-radius: 10px;\r
  font-weight: 600;\r
}\r
.jo-qa-suite__count--pass { background: #d8efdf; color: #1a7a3a; }\r
.jo-qa-suite__count--warn { background: #fff0d4; color: #8a5a00; }\r
.jo-qa-suite__count--fail { background: #fde8e8; color: #b51c1c; }\r
.jo-qa-suite__total { color: var(--ink-3); margin-left: 4px; font-weight: 500; }\r
.jo-qa-suite .jo-qa-walks {\r
  padding: 8px 12px 10px;\r
  margin: 0;\r
  list-style: none;\r
  display: flex; flex-direction: column; gap: 4px;\r
}\r
.jo-qa-walk__why {\r
  font-size: 11px; color: var(--ink-3);\r
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\r
  margin: 0 8px;\r
}\r
\r
/* =========================================================\r
   QA workbench â€” 3-column (Profiles | Suites | Simulation)\r
   ========================================================= */\r
.qa-wb-wrap { display: flex; flex-direction: column; height: 100%; min-height: 0; padding: 14px 16px; gap: 10px; }\r
.qa-wb {\r
  flex: 1; min-height: 0;\r
  display: grid;\r
  grid-template-columns: minmax(230px, 1fr) minmax(240px, 1fr) minmax(300px, 1.4fr);\r
  gap: 12px;\r
}\r
.qa-wb__col {\r
  display: flex; flex-direction: column; min-height: 0; min-width: 0;\r
  background: var(--panel); border: 1px solid var(--line-2); border-radius: 12px;\r
  box-shadow: var(--shadow-sm); overflow: hidden;\r
}\r
.qa-wb__head {\r
  display: flex; align-items: center; justify-content: space-between; gap: 8px;\r
  padding: 14px 16px 10px; border-bottom: 1px solid var(--line-2); flex-shrink: 0;\r
}\r
.qa-wb__head h3 { margin: 0; font-size: 14px; font-weight: 700; letter-spacing: -0.01em; }\r
.qa-wb__count {\r
  font-size: 11px; font-weight: 600; color: var(--ink-3);\r
  background: var(--bg-deep); border-radius: 9px; padding: 1px 8px;\r
}\r
.qa-wb__runall { height: 28px; padding: 0 14px; font-size: 12px; display: inline-flex; align-items: center; gap: 7px; }\r
.qa-wb__runall.is-loading { opacity: 0.85; cursor: wait; }\r
.qa-runall__spin {\r
  width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;\r
  border-radius: 50%; animation: qa-spin 0.65s linear infinite; flex-shrink: 0;\r
}\r
.qa-wb__chip {\r
  font-size: 11px; font-weight: 600; color: var(--accent-ink);\r
  background: var(--accent-soft); border-radius: 9px; padding: 2px 9px;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.qa-wb__subhead {\r
  padding: 7px 16px; font-size: 11.5px; color: var(--ink-3);\r
  border-bottom: 1px solid var(--line-2); flex-shrink: 0;\r
}\r
.qa-wb__subhead strong { color: var(--ink); }\r
\r
/* Profile groups */\r
.qa-pgroup { margin-bottom: 6px; }\r
.qa-pgroup__head {\r
  display: flex; align-items: center; gap: 7px;\r
  font-size: 10.5px; font-weight: 700; color: var(--ink-2);\r
  text-transform: uppercase; letter-spacing: 0.05em;\r
  padding: 8px 4px 6px;\r
}\r
.qa-pgroup__dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }\r
.qa-pgroup__dot--eligible { background: #0f6d54; }\r
.qa-pgroup__dot--variant { background: var(--accent); }\r
.qa-pgroup__dot--excluded { background: var(--warn); }\r
.qa-pgroup__count { color: var(--ink-4); font-weight: 600; margin-left: auto; }\r
.qa-pgroup .qa-pcard { margin-bottom: 6px; }\r
.qa-pcard__verdict { font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em; font-family: "Geist Mono", ui-monospace, monospace; }\r
.qa-wb__filters { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 14px; border-bottom: 1px solid var(--line-2); }\r
.qa-chip-btn {\r
  height: 24px; padding: 0 11px; border-radius: 12px;\r
  border: 1px solid var(--line-3); background: var(--panel); color: var(--ink-2);\r
  font-size: 11.5px; font-weight: 500; cursor: pointer;\r
  transition: all 80ms ease;\r
}\r
.qa-chip-btn:hover { background: var(--bg-deep); }\r
.qa-chip-btn.is-on { background: var(--accent); color: #fff; border-color: var(--accent); }\r
.qa-wb__scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 10px; display: flex; flex-direction: column; gap: 8px; }\r
/* Children must keep their natural height â€” the column scrolls, content never clips. */\r
.qa-wb__scroll > * { flex-shrink: 0; }\r
.qa-wb__scroll::-webkit-scrollbar { width: 8px; }\r
.qa-wb__scroll::-webkit-scrollbar-thumb { background: var(--line-3); border-radius: 4px; }\r
\r
/* Profile cards */\r
.qa-pcard {\r
  display: flex; gap: 11px; align-items: flex-start;\r
  padding: 11px 12px; border-radius: 10px;\r
  border: 1px solid var(--line-2); background: var(--panel); cursor: pointer; text-align: left;\r
  transition: border-color 80ms ease, background 80ms ease, box-shadow 80ms ease;\r
}\r
.qa-pcard:hover { background: var(--bg-subtle); border-color: var(--line-3); }\r
.qa-pcard.is-active { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); background: var(--accent-soft); }\r
.qa-pcard__avatar {\r
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;\r
  background: linear-gradient(135deg, #4a5cb7, #2c5cdf); color: #fff;\r
  display: inline-flex; align-items: center; justify-content: center;\r
  font-size: 11px; font-weight: 700; letter-spacing: 0.02em;\r
}\r
.qa-pcard__body { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }\r
.qa-pcard__top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }\r
.qa-pcard__name { font-size: 13px; font-weight: 600; color: var(--ink); overflow-wrap: anywhere; }\r
.qa-pcard__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }\r
.qa-pcard__spin {\r
  width: 11px; height: 11px; border: 2px solid var(--line-2); border-top-color: var(--accent);\r
  border-radius: 50%; animation: qa-spin 0.7s linear infinite;\r
}\r
.qa-pcard__sub { font-size: 11px; color: var(--ink-3); overflow-wrap: anywhere; line-height: 1.35; }\r
.qa-tagchip {\r
  display: inline-flex; align-items: flex-start; align-self: flex-start;\r
  padding: 2px 9px; border-radius: 11px; font-size: 10.5px; font-weight: 600;\r
  max-width: 100%; overflow-wrap: anywhere; line-height: 1.3;\r
}\r
.qa-tagchip--eligible { background: #e3f1ed; color: #0f6d54; }\r
.qa-tagchip--variant  { background: #e3f1ed; color: #0f6d54; }\r
.qa-tagchip--excluded { background: var(--warn-bg); color: var(--warn); }\r
\r
/* Add-profiles bar (prompt â†’ new plan version) */\r
.qa-addbar { border-top: 1px solid var(--line-2); padding: 10px; display: flex; flex-direction: column; gap: 7px; flex-shrink: 0; }\r
.qa-addbar__input {\r
  width: 100%; border: 1px solid var(--line-3); border-radius: var(--r-sm);\r
  padding: 7px 9px; font: inherit; font-size: 12px; color: var(--ink);\r
  background: var(--bg-deep); resize: vertical; min-height: 42px;\r
}\r
.qa-addbar__input:focus { outline: 0; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); background: var(--panel); }\r
.qa-addbar__input:disabled { opacity: 0.6; }\r
.qa-addbar__btn { height: 30px; font-size: 12px; }\r
.qa-addbar__err { font-size: 11px; color: var(--danger); }\r
\r
/* Suite cards (collapsible) */\r
.qa-scard {\r
  border-radius: 10px; border: 1px solid var(--line-2); background: var(--panel); overflow: hidden;\r
  flex-shrink: 0;   /* never compress â€” let the column scroll instead of clipping */\r
}\r
.qa-scard__head {\r
  display: flex; gap: 11px; align-items: flex-start; width: 100%;\r
  padding: 13px; background: transparent; border: 0; cursor: pointer; text-align: left;\r
  transition: background 80ms ease;\r
}\r
.qa-scard__head:hover { background: var(--bg-subtle); }\r
.qa-scard__status {\r
  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;\r
  border: 1px solid var(--line-3); background: var(--bg-deep); color: var(--ink-4);\r
  display: inline-flex; align-items: center; justify-content: center;\r
  font-size: 11px; font-weight: 700;\r
}\r
.qa-scard__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }\r
.qa-scard__name { font-size: 13px; font-weight: 600; color: var(--ink); overflow-wrap: anywhere; }\r
.qa-scard__desc { font-size: 11.5px; color: var(--ink-3); line-height: 1.4; overflow-wrap: anywhere; }\r
.qa-scard__meta {\r
  font-size: 11px; color: var(--ink-4); margin-top: 2px;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;\r
}\r
.qa-scard__chev { font-size: 10px; color: var(--ink-3); flex-shrink: 0; margin-top: 2px; }\r
.qa-scard.is-open .qa-scard__chev { color: var(--accent); }\r
.qa-tcase-empty {\r
  padding: 10px 14px; font-size: 11px; color: var(--ink-4); font-style: italic;\r
  border-top: 1px solid var(--line-2); background: var(--bg-subtle);\r
}\r
\r
/* Test case list (revealed on expand) */\r
.qa-tcase-list {\r
  list-style: none; margin: 0; padding: 4px 10px 10px 12px;\r
  border-top: 1px solid var(--line-2); background: var(--bg-subtle);\r
  display: flex; flex-direction: column; gap: 2px;\r
}\r
.qa-tcase { display: flex; gap: 9px; align-items: flex-start; padding: 7px 6px; border-radius: 6px; }\r
.qa-tcase:hover { background: var(--panel); }\r
/* DID NOT EXECUTE â€” dim the case row that never ran. */\r
.qa-tcase--skipped { opacity: 0.7; }\r
.qa-tcase--skipped .qa-tcase__badge { font-size: 8px; }\r
.qa-tcase__badge {\r
  flex-shrink: 0; min-width: 38px; height: 18px; padding: 0 7px; border-radius: 9px;\r
  border: 1px solid var(--line-3); background: var(--bg-deep); color: var(--ink-4);\r
  display: inline-flex; align-items: center; justify-content: center;\r
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.qa-tcase__body { flex: 1; min-width: 0; }\r
.qa-tcase__title { font-size: 12px; font-weight: 500; color: var(--ink); overflow-wrap: anywhere; }\r
.qa-tcase__desc { font-size: 11px; color: var(--ink-3); margin-top: 1px; line-height: 1.35; overflow-wrap: anywhere; }\r
\r
/* Journey path â€” ordered nodes the profile visited */\r
.qa-path { list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 4px; }\r
.qa-path__step {\r
  display: flex; align-items: center; gap: 9px;\r
  padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--panel);\r
}\r
.qa-path__step--fail { border-color: var(--danger-bg); background: #fdf6f6; }\r
.qa-path__step--skipped { border-style: dashed; opacity: 0.78; }\r
.qa-path__num {\r
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;\r
  background: var(--bg-deep); color: var(--ink-3);\r
  display: inline-flex; align-items: center; justify-content: center;\r
  font-size: 10px; font-weight: 700; font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.qa-path__dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }\r
.qa-path__body { flex: 1; min-width: 0; }\r
.qa-path__label { font-size: 12.5px; font-weight: 500; color: var(--ink); overflow-wrap: anywhere; }\r
.qa-path__action { font-size: 10.5px; color: var(--ink-3); text-transform: capitalize; }\r
.qa-path__node {\r
  font-size: 10px; color: var(--ink-4); flex-shrink: 0;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
  background: var(--bg-deep); padding: 1px 5px; border-radius: 3px;\r
}\r
\r
/* Simulation results grouped by suite */\r
.qa-simgroup { margin-bottom: 12px; }\r
.qa-simgroup__head {\r
  font-size: 11px; font-weight: 700; color: var(--ink-2);\r
  text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px;\r
}\r
\r
/* Simulation results â€” metadata grid */\r
.qa-meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }\r
.qa-meta-card { background: var(--bg-subtle); border: 1px solid var(--line-2); border-radius: 8px; padding: 9px 11px; }\r
.qa-meta-card__label { font-size: 9.5px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; font-family: "Geist Mono", ui-monospace, monospace; }\r
.qa-meta-card__value { font-size: 12.5px; font-weight: 600; color: var(--ink); margin-top: 3px; }\r
.qa-expected {\r
  font-size: 12px; color: var(--accent-ink); background: var(--accent-soft);\r
  border-radius: 8px; padding: 8px 11px; margin-bottom: 14px;\r
}\r
.qa-sim-head { font-size: 11px; font-weight: 700; color: var(--ink-2); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }\r
.qa-sim-loading { display: flex; align-items: center; gap: 10px; color: var(--ink-3); font-size: 12px; padding: 20px 0; }\r
\r
/* Simulation checks */\r
.qa-checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }\r
.qa-check {\r
  display: flex; align-items: center; gap: 11px;\r
  padding: 11px 12px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--panel);\r
}\r
.qa-check--fail { border-color: var(--danger-bg); background: #fdf6f6; }\r
/* DID NOT EXECUTE â€” the journey stopped before this case ran. */\r
.qa-check--skipped { background: var(--bg-subtle); border-style: dashed; opacity: 0.82; }\r
.qa-check__ok {\r
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; color: #fff;\r
  display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700;\r
}\r
.qa-check__body { flex: 1; min-width: 0; }\r
.qa-check__title { font-size: 13px; font-weight: 600; color: var(--ink); overflow-wrap: anywhere; }\r
.qa-check__desc { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; overflow-wrap: anywhere; }\r
.qa-check__verdict {\r
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; flex-shrink: 0;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.qa-check__verdict--pass { color: var(--ok); }\r
.qa-check__verdict--warn { color: var(--warn); }\r
.qa-check__verdict--fail { color: var(--danger); }\r
.qa-check__verdict--skipped { color: var(--ink-4); font-size: 9.5px; }\r
\r
/* =========================================================\r
   QA Runs tab â€” revamped\r
   ========================================================= */\r
\r
/* Control card */\r
.qa-controls {\r
  background: var(--panel);\r
  border: 1px solid var(--line-2);\r
  border-radius: 10px;\r
  padding: 14px;\r
  margin-bottom: 14px;\r
}\r
.qa-controls__head {\r
  display: flex; align-items: baseline; justify-content: space-between;\r
  margin-bottom: 12px;\r
  padding-bottom: 10px;\r
  border-bottom: 1px solid var(--line-2);\r
}\r
.qa-controls__head h4 { margin: 0; font-size: 13px; font-weight: 600; color: var(--ink); }\r
.qa-controls__caption { font-size: 11px; color: var(--ink-3); }\r
\r
/* Steps */\r
.qa-step {\r
  display: grid;\r
  grid-template-columns: 26px 1fr auto;\r
  align-items: center;\r
  gap: 12px;\r
  padding: 10px 0;\r
}\r
.qa-step + .qa-step { border-top: 1px solid var(--line-2); }\r
.qa-step__num {\r
  width: 26px; height: 26px;\r
  border-radius: 50%;\r
  background: var(--accent);\r
  color: #fff;\r
  display: inline-flex; align-items: center; justify-content: center;\r
  font-size: 12px; font-weight: 600;\r
}\r
.qa-step--done .qa-step__num { background: var(--ok); }\r
.qa-step__title { font-size: 13px; font-weight: 600; color: var(--ink); }\r
.qa-step__hint { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }\r
.qa-step .jo-btn { white-space: nowrap; }\r
\r
/* Suite chips â€” between step 1 and step 2 */\r
.qa-suite-chips {\r
  display: flex; flex-wrap: wrap; gap: 6px;\r
  padding: 8px 0 12px 38px;\r
}\r
.qa-suite-chip {\r
  display: inline-flex; align-items: center; gap: 6px;\r
  background: var(--bg-deep);\r
  border: 1px solid var(--line-2);\r
  border-radius: 14px;\r
  padding: 3px 10px 3px 8px;\r
  font-size: 11px;\r
}\r
.qa-suite-chip__name { color: var(--ink); font-weight: 500; }\r
.qa-suite-chip__count {\r
  background: var(--accent);\r
  color: #fff;\r
  padding: 1px 7px;\r
  border-radius: 9px;\r
  font-weight: 600;\r
  font-size: 10.5px;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
\r
/* Empty state */\r
.qa-empty {\r
  text-align: center;\r
  padding: 32px 16px;\r
  color: var(--ink-3);\r
}\r
.qa-empty__title { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }\r
.qa-empty p { margin: 0; font-size: 12px; }\r
.qa-empty-mini { font-size: 12px; color: var(--ink-3); padding: 8px 0; }\r
\r
/* Verdict hero */\r
.qa-hero {\r
  display: flex; align-items: center; justify-content: space-between;\r
  background: var(--panel);\r
  border: 1px solid var(--line-2);\r
  border-left: 4px solid var(--ink-3);\r
  border-radius: 10px;\r
  padding: 12px 14px;\r
  margin-bottom: 10px;\r
}\r
.qa-hero--pass { border-left-color: var(--ok); }\r
.qa-hero--warn { border-left-color: #d97700; }\r
.qa-hero--fail { border-left-color: var(--danger); }\r
.qa-hero__verdict { display: flex; align-items: center; gap: 12px; }\r
.qa-hero__icon {\r
  width: 36px; height: 36px; border-radius: 50%;\r
  display: inline-flex; align-items: center; justify-content: center;\r
  font-size: 16px; color: #fff; font-weight: 700;\r
  background: var(--ink-3);\r
}\r
.qa-hero--pass .qa-hero__icon { background: var(--ok); }\r
.qa-hero--warn .qa-hero__icon { background: #d97700; }\r
.qa-hero--fail .qa-hero__icon { background: var(--danger); }\r
.qa-hero__label { font-size: 10.5px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; }\r
.qa-hero__value { font-size: 15px; font-weight: 700; color: var(--ink); margin-top: 1px; }\r
.qa-hero__meta {\r
  display: flex; gap: 6px;\r
  font-size: 11px; color: var(--ink-3);\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
\r
.qa-summary {\r
  font-size: 12px; color: var(--ink-2); line-height: 1.5;\r
  margin: 0 0 14px;\r
}\r
\r
/* Totals strip */\r
.qa-totals {\r
  display: grid;\r
  grid-template-columns: repeat(4, 1fr);\r
  gap: 6px;\r
  margin-bottom: 14px;\r
}\r
.qa-totals__stat {\r
  background: var(--panel);\r
  border: 1px solid var(--line-2);\r
  border-radius: 8px;\r
  padding: 8px 10px;\r
}\r
.qa-totals__num {\r
  font-size: 18px; font-weight: 700; color: var(--ink);\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
  line-height: 1.1;\r
}\r
.qa-totals__label {\r
  font-size: 10px; color: var(--ink-3);\r
  text-transform: uppercase; letter-spacing: 0.05em;\r
  margin-top: 2px;\r
}\r
.qa-totals__stat--pass .qa-totals__num { color: var(--ok); }\r
.qa-totals__stat--warn .qa-totals__num { color: #d97700; }\r
.qa-totals__stat--fail .qa-totals__num { color: var(--danger); }\r
\r
/* Fit / Structure mini cards */\r
.qa-mini-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 14px; }\r
.qa-mini-card {\r
  background: var(--panel);\r
  border: 1px solid var(--line-2);\r
  border-radius: 8px;\r
  padding: 10px 12px;\r
}\r
.qa-mini-card__label { font-size: 10.5px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; }\r
.qa-mini-card__value { font-size: 14px; font-weight: 600; color: var(--ink); margin-top: 3px; }\r
.qa-mini-card__hint {\r
  font-size: 11px; color: var(--ink-3); margin-top: 4px;\r
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;\r
  overflow: hidden;\r
}\r
.qa-mini-card--pass { border-left: 3px solid var(--ok); }\r
.qa-mini-card--warn { border-left: 3px solid #d97700; }\r
.qa-mini-card--fail { border-left: 3px solid var(--danger); }\r
.qa-mini-card code { font-size: 10.5px; background: var(--bg-deep); padding: 1px 4px; border-radius: 3px; }\r
\r
/* Selected profile detail */\r
.qa-detail {\r
  background: var(--panel);\r
  border: 1px solid var(--accent);\r
  border-radius: 10px;\r
  padding: 14px;\r
  margin-bottom: 14px;\r
  box-shadow: 0 1px 4px rgba(44, 92, 223, 0.08);\r
}\r
.qa-detail--pass { border-color: var(--ok); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05); }\r
.qa-detail--warn { border-color: #d97700; box-shadow: 0 1px 4px rgba(217, 119, 0, 0.1); }\r
.qa-detail--fail { border-color: var(--danger); box-shadow: 0 1px 4px rgba(220, 38, 38, 0.1); }\r
.qa-detail__head {\r
  display: flex; align-items: flex-start; justify-content: space-between;\r
  gap: 10px; margin-bottom: 10px;\r
}\r
.qa-detail__title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--ink); }\r
.qa-detail__verdict {\r
  width: 22px; height: 22px; border-radius: 50%;\r
  color: #fff; font-size: 12px; font-weight: 700;\r
  display: inline-flex; align-items: center; justify-content: center;\r
}\r
.qa-detail__scenario {\r
  font-size: 12px; color: var(--accent-ink); margin-top: 3px;\r
  font-weight: 500;\r
  font-style: italic;\r
}\r
.qa-detail__sub {\r
  font-size: 11px; color: var(--ink-3); margin-top: 3px;\r
}\r
.qa-detail__sub code {\r
  background: var(--bg-deep); padding: 1px 5px; border-radius: 3px; color: var(--ink-2);\r
  margin-right: 4px;\r
}\r
.qa-detail__close {\r
  background: transparent; border: 0; cursor: pointer;\r
  font-size: 20px; line-height: 1; color: var(--ink-3); padding: 0 4px;\r
}\r
.qa-detail__close:hover { color: var(--ink); }\r
.qa-detail__meta {\r
  display: grid;\r
  grid-template-columns: repeat(auto-fill, minmax(95px, 1fr));\r
  gap: 6px 12px;\r
  font-size: 11px;\r
  background: var(--bg-deep);\r
  border-radius: 6px;\r
  padding: 10px 12px;\r
  margin-bottom: 10px;\r
}\r
.qa-detail__meta > div { display: flex; flex-direction: column; }\r
.qa-detail__meta span {\r
  color: var(--ink-3); font-size: 9.5px;\r
  text-transform: uppercase; letter-spacing: 0.04em;\r
}\r
.qa-detail__meta b { color: var(--ink); font-weight: 500; font-size: 12px; }\r
.qa-detail__why {\r
  font-size: 12px; color: var(--ink-2); line-height: 1.45;\r
  padding: 8px 10px;\r
  background: var(--accent-soft);\r
  border-radius: 6px;\r
  margin-bottom: 10px;\r
  font-style: italic;\r
}\r
.qa-detail__steps { list-style: none; margin: 0; padding: 0; }\r
.qa-detail__step {\r
  display: flex; align-items: center; gap: 8px;\r
  padding: 6px 0; font-size: 11.5px;\r
  border-bottom: 1px dashed var(--line-2);\r
}\r
.qa-detail__step:last-child { border-bottom: 0; }\r
.qa-detail__step-num {\r
  width: 18px; height: 18px; border-radius: 50%;\r
  background: var(--bg-deep); color: var(--ink-2);\r
  font-size: 10px; font-weight: 600;\r
  display: inline-flex; align-items: center; justify-content: center;\r
  flex-shrink: 0;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.qa-detail__step-node {\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
  font-size: 10.5px;\r
  background: var(--panel);\r
  border: 1px solid var(--line-2);\r
  padding: 1px 6px;\r
  border-radius: 3px;\r
  flex-shrink: 0;\r
}\r
.qa-detail__step--pass .qa-detail__step-node { border-color: var(--ok); color: var(--ok); }\r
.qa-detail__step--warn .qa-detail__step-node { border-color: #d97700; color: #d97700; }\r
.qa-detail__step--fail .qa-detail__step-node { border-color: var(--danger); color: var(--danger); }\r
.qa-detail__step-reason { color: var(--ink-2); flex: 1; }\r
\r
/* Section heading */\r
.qa-section { margin-bottom: 20px; }\r
.qa-section h4 { margin: 0; font-size: 13px; font-weight: 700; color: var(--ink); letter-spacing: -0.01em; }\r
.qa-section__head {\r
  display: flex; align-items: baseline; justify-content: space-between;\r
  margin-bottom: 12px;\r
  padding-bottom: 8px;\r
  border-bottom: 1px solid var(--line-2);\r
}\r
.qa-section__caption { font-size: 11px; color: var(--ink-3); }\r
\r
/* Finding list */\r
.qa-finding-list { list-style: none; padding: 0; margin: 0; }\r
.qa-finding {\r
  display: flex; align-items: flex-start; gap: 8px;\r
  padding: 6px 10px;\r
  background: var(--panel); border: 1px solid var(--line-2);\r
  border-radius: 6px;\r
  font-size: 11.5px;\r
  margin-bottom: 4px;\r
}\r
.qa-finding code { font-size: 10.5px; background: var(--bg-deep); padding: 1px 5px; border-radius: 3px; }\r
.qa-finding--info { border-left: 3px solid var(--accent); }\r
.qa-finding--warn { border-left: 3px solid #d97700; }\r
.qa-finding--err { border-left: 3px solid var(--danger); }\r
.qa-finding__icon { flex-shrink: 0; font-size: 11px; margin-top: 1px; }\r
.qa-finding--info .qa-finding__icon { color: var(--accent); }\r
.qa-finding--warn .qa-finding__icon { color: #d97700; }\r
.qa-finding--err .qa-finding__icon { color: var(--danger); }\r
\r
/* Suite cards */\r
/* â”€â”€ Suite cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */\r
.qa-suites { display: flex; flex-direction: column; gap: 12px; }\r
\r
.qa-suite {\r
  background: var(--panel);\r
  border: 1px solid var(--line-2);\r
  border-radius: 12px;\r
  overflow: hidden;\r
  box-shadow: var(--shadow-sm);\r
}\r
.qa-suite--pass { border-top: 3px solid var(--ok); }\r
.qa-suite--warn { border-top: 3px solid #d97700; }\r
.qa-suite--fail { border-top: 3px solid var(--danger); }\r
\r
/* Suite toggle button (header) */\r
.qa-suite__head--btn {\r
  display: flex; align-items: center; justify-content: space-between; gap: 12px;\r
  width: 100%; background: transparent; border: 0; cursor: pointer;\r
  text-align: left; padding: 14px 16px;\r
  transition: background 80ms ease;\r
}\r
.qa-suite__head--btn:hover { background: var(--bg-subtle); }\r
.qa-suite__title { display: flex; align-items: center; gap: 10px; min-width: 0; }\r
.qa-suite__chevron {\r
  font-size: 10px; color: var(--ink-4); flex-shrink: 0;\r
  transition: transform 150ms ease;\r
}\r
.qa-suite__pill {\r
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;\r
  color: #fff; font-size: 11px; font-weight: 700;\r
  display: inline-flex; align-items: center; justify-content: center;\r
}\r
.qa-suite__name {\r
  font-size: 13px; font-weight: 600; color: var(--ink);\r
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\r
}\r
.qa-suite__counts {\r
  display: inline-flex; align-items: center; gap: 5px;\r
  font-family: "Geist Mono", ui-monospace, monospace; font-size: 11px;\r
  flex-shrink: 0;\r
}\r
.qa-suite__count {\r
  display: inline-flex; align-items: center; justify-content: center;\r
  min-width: 24px; height: 20px; padding: 0 7px; border-radius: 10px;\r
  font-weight: 700; font-size: 11px;\r
}\r
.qa-suite__count--pass { background: #d8efdf; color: #1a7a3a; }\r
.qa-suite__count--warn { background: #fff0d4; color: #8a5a00; }\r
.qa-suite__count--fail { background: #fde8e8; color: #b51c1c; }\r
.qa-suite__total { color: var(--ink-4); font-weight: 500; }\r
\r
/* Suite body (shown when expanded) */\r
.qa-suite__body {\r
  padding: 0 16px 14px;\r
  border-top: 1px solid var(--line-2);\r
}\r
.qa-suite__desc {\r
  font-size: 11.5px; color: var(--ink-3); margin: 10px 0 12px; line-height: 1.5;\r
}\r
.qa-suite__outcome { font-size: 11px; color: var(--ink-3); margin: 0 0 12px; font-style: italic; }\r
\r
/* â”€â”€ Scenario rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */\r
.qa-scenario {\r
  border: 1px solid var(--line-2);\r
  border-radius: 8px;\r
  margin-bottom: 8px;\r
  overflow: hidden;\r
  background: var(--bg-subtle);\r
}\r
.qa-scenario:last-child { margin-bottom: 0; }\r
.qa-scenario--pass { border-left: 3px solid var(--ok); }\r
.qa-scenario--warn { border-left: 3px solid #d97700; }\r
.qa-scenario--fail { border-left: 3px solid var(--danger); }\r
\r
.qa-scenario__head {\r
  display: flex; align-items: center; gap: 8px;\r
  width: 100%; background: transparent; border: 0; cursor: pointer;\r
  padding: 9px 12px; text-align: left;\r
  transition: background 80ms ease;\r
}\r
.qa-scenario__head:hover { background: #f2f4f7; }\r
.qa-scenario__chevron { font-size: 9px; color: var(--ink-4); flex-shrink: 0; }\r
.qa-scenario__dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }\r
.qa-scenario__name {\r
  flex: 1; font-size: 12px; font-weight: 600; color: var(--ink);\r
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\r
}\r
.qa-scenario__counts {\r
  font-size: 11px; font-weight: 600;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
  display: flex; gap: 6px; flex-shrink: 0;\r
}\r
\r
/* â”€â”€ Walk rows (profile results within a scenario) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */\r
.qa-walks {\r
  list-style: none; margin: 0; padding: 6px 8px 8px;\r
  display: flex; flex-direction: column; gap: 4px;\r
}\r
.qa-walk {\r
  display: flex; align-items: center; gap: 8px;\r
  padding: 8px 10px;\r
  border-radius: 6px;\r
  background: var(--panel);\r
  border: 1px solid var(--line-2);\r
  cursor: pointer;\r
  transition: background-color 80ms ease, border-color 80ms ease, box-shadow 80ms ease;\r
  font-size: 11.5px;\r
}\r
.qa-walk:hover { background: #f5f7fb; border-color: var(--line-3); }\r
.qa-walk.is-selected { background: var(--accent-soft); border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }\r
.qa-walk__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }\r
.qa-walk__main {\r
  flex: 1; min-width: 0;\r
  display: flex; flex-direction: column; gap: 1px; overflow: hidden;\r
}\r
.qa-walk__name { font-weight: 500; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\r
.qa-walk__scenario { font-size: 10.5px; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r
.qa-walk__why { flex: 1; min-width: 0; font-size: 11px; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r
.qa-walk__right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }\r
.qa-walk__verdict {\r
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;\r
  padding: 2px 8px; border-radius: 10px;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.qa-walk__verdict--pass { background: #d8efdf; color: #1a7a3a; }\r
.qa-walk__verdict--warn { background: #fff0d4; color: #8a5a00; }\r
.qa-walk__verdict--fail { background: #fde8e8; color: #b51c1c; }\r
.qa-walk__chevron { font-size: 8px; color: var(--ink-4); flex-shrink: 0; }\r
\r
/* Walk item = clickable row + inline detail dropdown */\r
.qa-walk-item { list-style: none; }\r
.qa-walk-item.is-open .qa-walk { border-radius: 6px 6px 0 0; }\r
\r
/* Inline detail dropdown â€” rendered directly beneath the clicked row */\r
.qa-walk-detail {\r
  border: 1px solid var(--accent);\r
  border-top: 0;\r
  border-radius: 0 0 6px 6px;\r
  background: #fbfcfe;\r
  padding: 10px;\r
}\r
.qa-walk-detail--warn { border-color: #d97700; }\r
.qa-walk-detail--fail { border-color: var(--danger); }\r
.qa-walk-detail__meta {\r
  display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));\r
  gap: 6px 10px; font-size: 11px;\r
  background: var(--panel); border: 1px solid var(--line-2); border-radius: 6px;\r
  padding: 9px 10px; margin-bottom: 8px;\r
}\r
.qa-walk-detail__meta > div { display: flex; flex-direction: column; min-width: 0; }\r
.qa-walk-detail__meta span {\r
  color: var(--ink-3); font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;\r
}\r
.qa-walk-detail__meta b { color: var(--ink); font-weight: 500; font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; }\r
.qa-walk-detail__meta code { font-size: 10px; background: var(--bg-deep); padding: 0 4px; border-radius: 3px; }\r
.qa-walk-detail__why {\r
  font-size: 11px; color: var(--ink-2); line-height: 1.45; font-style: italic;\r
  background: var(--accent-soft); border-radius: 6px; padding: 7px 9px; margin-bottom: 8px;\r
}\r
.qa-walk-detail__steps { list-style: none; margin: 0; padding: 0; }\r
.qa-walk-detail__step {\r
  display: flex; align-items: center; gap: 8px;\r
  padding: 5px 0; font-size: 11px; border-bottom: 1px dashed var(--line-2);\r
}\r
.qa-walk-detail__step:last-child { border-bottom: 0; }\r
.qa-walk-detail__step-num {\r
  width: 17px; height: 17px; border-radius: 50%; flex-shrink: 0;\r
  background: var(--bg-deep); color: var(--ink-2);\r
  font-size: 9.5px; font-weight: 600;\r
  display: inline-flex; align-items: center; justify-content: center;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.qa-walk-detail__step-node {\r
  font-family: "Geist Mono", ui-monospace, monospace; font-size: 10px; flex-shrink: 0;\r
  background: var(--panel); border: 1px solid var(--line-2); padding: 1px 6px; border-radius: 3px;\r
}\r
.qa-walk-detail__step--pass .qa-walk-detail__step-node { border-color: var(--ok); color: var(--ok); }\r
.qa-walk-detail__step--warn .qa-walk-detail__step-node { border-color: #d97700; color: #d97700; }\r
.qa-walk-detail__step--fail .qa-walk-detail__step-node { border-color: var(--danger); color: var(--danger); }\r
.qa-walk-detail__step-reason { color: var(--ink-2); flex: 1; }\r
\r
/* Running / ready states */\r
.qa-running-state {\r
  text-align: center; padding: 48px 20px;\r
  display: flex; flex-direction: column; align-items: center; gap: 10px;\r
  color: var(--ink-3);\r
}\r
.qa-running-state__spinner {\r
  width: 28px; height: 28px;\r
  border: 3px solid var(--line-2);\r
  border-top-color: var(--accent);\r
  border-radius: 50%;\r
  animation: qa-spin 0.8s linear infinite;\r
}\r
@keyframes qa-spin { to { transform: rotate(360deg); } }\r
.qa-running-state__title { font-size: 14px; font-weight: 600; color: var(--ink); }\r
.qa-running-state p { font-size: 12px; margin: 0; }\r
\r
/* Progress bar */\r
.qa-progress-bar {\r
  width: 100%; height: 6px;\r
  background: var(--line-2); border-radius: 3px;\r
  overflow: hidden; margin-top: 14px;\r
}\r
.qa-progress-bar__fill {\r
  height: 100%; background: var(--accent);\r
  border-radius: 3px;\r
  transition: width 400ms ease;\r
}\r
.qa-progress-pct {\r
  font-size: 11px; color: var(--ink-3); margin-top: 4px;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.qa-progress-msg {\r
  margin-top: 10px; font-size: 12px;\r
  display: flex; flex-direction: column; gap: 2px;\r
  text-align: left; width: 100%;\r
}\r
.qa-progress-msg__label {\r
  font-weight: 600; color: var(--ink); font-size: 11px;\r
  text-transform: uppercase; letter-spacing: 0.04em;\r
}\r
.qa-progress-msg__text { color: var(--ink-2); }\r
\r
/* Log tail */\r
.qa-log-tail {\r
  list-style: none; margin: 10px 0 0; padding: 0;\r
  width: 100%; max-width: 360px;\r
  border: 1px solid var(--line-2); border-radius: var(--r-md);\r
  background: var(--bg-deep);\r
  overflow: hidden;\r
}\r
.qa-log-line {\r
  display: flex; align-items: baseline; gap: 8px;\r
  padding: 4px 8px; font-size: 11px;\r
  border-bottom: 1px solid var(--line-2);\r
  text-align: left;\r
}\r
.qa-log-line:last-child { border-bottom: 0; }\r
.qa-log-line__ts {\r
  color: var(--ink-4); font-size: 10px; flex-shrink: 0;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.qa-log-line__msg { color: var(--ink-2); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\r
.qa-log-line--warn .qa-log-line__msg { color: var(--warn); }\r
.qa-log-line--err  .qa-log-line__msg { color: var(--danger); }\r
\r
.qa-ready-state {\r
  padding: 12px 0 0;\r
  display: flex; flex-direction: column; gap: 6px;\r
}\r
.qa-ready-state__icon {\r
  width: 36px; height: 36px; border-radius: 50%;\r
  background: var(--accent); color: #fff; font-size: 14px;\r
  display: inline-flex; align-items: center; justify-content: center;\r
}\r
.qa-ready-state__title { font-size: 14px; font-weight: 600; color: var(--ink); }\r
.qa-ready-state p { font-size: 12px; color: var(--ink-2); margin: 0 0 10px; }\r
\r
/* Static suite preview head (no toggle) */\r
.qa-suite-preview__head--static {\r
  padding: 7px 8px;\r
  background: var(--bg-deep);\r
  border-radius: 6px;\r
  display: flex; align-items: center; gap: 8px;\r
  cursor: default;\r
}\r
\r
/* SubHeader actions gap */\r
.jo-subhead__actions { display: flex; align-items: center; gap: 8px; }\r
\r
/* Plan history pills */\r
.qa-plan-history {\r
  display: flex; align-items: center; gap: 6px;\r
  padding: 6px 0 10px;\r
  border-bottom: 1px solid var(--line-2);\r
  margin-bottom: 10px;\r
}\r
.qa-plan-history__label { font-size: 11px; color: var(--ink-3); }\r
.qa-plan-pill {\r
  height: 22px; padding: 0 10px; border-radius: 11px;\r
  border: 1px solid var(--line-3);\r
  background: var(--bg-deep); color: var(--ink-2);\r
  font-size: 11px; font-weight: 600; cursor: pointer;\r
  transition: background 80ms ease, border-color 80ms ease;\r
}\r
.qa-plan-pill:hover { background: var(--bg); border-color: var(--ink-3); }\r
.qa-plan-pill.is-active {\r
  background: var(--accent); color: #fff; border-color: var(--accent);\r
}\r
\r
/* QA run version history */\r
.qa-run-history {\r
  padding: 8px 0 12px;\r
  border-bottom: 1px solid var(--line-2);\r
  margin-bottom: 12px;\r
}\r
.qa-run-history__label {\r
  font-size: 11px; color: var(--ink-3); margin-bottom: 6px;\r
  text-transform: uppercase; letter-spacing: 0.04em; font-weight: 500;\r
}\r
.qa-run-history__list { display: flex; flex-wrap: wrap; gap: 6px; }\r
.qa-run-pill {\r
  display: inline-flex; align-items: center; gap: 6px;\r
  height: 26px; padding: 0 10px; border-radius: 13px;\r
  border: 1px solid var(--line-3); background: var(--panel); cursor: pointer;\r
  transition: background 80ms ease, border-color 80ms ease, box-shadow 80ms ease;\r
}\r
.qa-run-pill:hover { background: var(--bg-deep); }\r
.qa-run-pill.is-active { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }\r
.qa-run-pill__dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }\r
.qa-run-pill__label { font-size: 11.5px; font-weight: 600; color: var(--ink); }\r
.qa-run-pill__verdict {\r
  font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;\r
  color: var(--ink-3);\r
}\r
.qa-run-pill--pass .qa-run-pill__verdict { color: var(--ok); }\r
.qa-run-pill--warn .qa-run-pill__verdict { color: #8a5a00; }\r
.qa-run-pill--fail .qa-run-pill__verdict { color: var(--danger); }\r
\r
/* Suite preview (expandable test cases before run) */\r
.qa-suite-preview {\r
  display: flex; flex-direction: column; gap: 2px;\r
  padding: 8px 0 12px 0;\r
  border-bottom: 1px solid var(--line-2);\r
  margin-bottom: 2px;\r
}\r
.qa-suite-preview__suite { border-radius: 6px; overflow: hidden; }\r
.qa-suite-preview__head {\r
  display: flex; align-items: center; gap: 8px;\r
  width: 100%; padding: 7px 8px;\r
  border: 0; background: var(--bg-deep);\r
  cursor: pointer; text-align: left;\r
  border-radius: 6px;\r
  transition: background 80ms ease;\r
}\r
.qa-suite-preview__head:hover { background: #e8eaf0; }\r
.qa-suite-preview__chevron { font-size: 10px; color: var(--ink-3); flex-shrink: 0; }\r
.qa-suite-preview__name { flex: 1; font-size: 12px; font-weight: 600; color: var(--ink); }\r
.qa-suite-preview__count {\r
  height: 18px; padding: 0 7px; border-radius: 9px;\r
  background: var(--accent); color: #fff;\r
  font-size: 10.5px; font-weight: 600;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
  display: inline-flex; align-items: center;\r
}\r
.qa-suite-preview__body {\r
  padding: 4px 8px 6px;\r
  background: var(--bg-subtle);\r
  border: 1px solid var(--line-2); border-top: 0;\r
  border-radius: 0 0 6px 6px;\r
}\r
.qa-suite-preview__desc {\r
  font-size: 11px; color: var(--ink-3); margin: 4px 0 6px;\r
}\r
.qa-suite-preview__head--static .qa-suite-preview__desc { padding: 0 8px; }\r
\r
/* Cohort view â€” generated profiles grouped by archetype */\r
.qa-cohort-head {\r
  font-size: 11px; font-weight: 600; color: var(--ink-2);\r
  text-transform: uppercase; letter-spacing: 0.04em;\r
  margin: 14px 0 8px; text-align: left;\r
}\r
.qa-cohort { text-align: left; margin-top: 6px; }\r
.qa-cohort__bar {\r
  display: flex; align-items: baseline; justify-content: space-between;\r
  margin: 14px 0 2px; gap: 8px;\r
}\r
.qa-cohort-head--inline { margin: 0; }\r
.qa-cohort__scope { font-size: 11px; color: var(--ink-3); }\r
.qa-cohort__link {\r
  background: none; border: 0; padding: 0; cursor: pointer;\r
  color: var(--accent); font-size: 11px; font-weight: 500; text-decoration: underline;\r
}\r
.qa-cohort__link:hover { color: var(--accent-ink); }\r
.qa-cohort__hint { font-size: 10.5px; color: var(--ink-4); margin: 0 0 8px; }\r
.qa-cohort__check { margin: 0; cursor: pointer; flex-shrink: 0; }\r
.qa-cohort__profile { cursor: pointer; gap: 8px; }\r
.qa-cohort__profile.is-selected { background: var(--accent-soft); }\r
.qa-cohort__profile.is-selected .qa-cohort__name { color: var(--accent-ink); font-weight: 600; }\r
.qa-cohort__group {\r
  border: 1px solid var(--line-2); border-radius: 8px;\r
  margin-bottom: 6px; overflow: hidden; background: var(--panel);\r
}\r
.qa-cohort__archetype {\r
  display: flex; align-items: center; justify-content: space-between;\r
  padding: 7px 10px; background: var(--bg-deep);\r
  font-size: 11.5px; font-weight: 600; color: var(--ink);\r
  text-transform: capitalize;\r
}\r
.qa-cohort__count {\r
  background: var(--accent); color: #fff;\r
  border-radius: 9px; padding: 0 7px; font-size: 10.5px;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.qa-cohort__list { list-style: none; margin: 0; padding: 4px 6px; display: flex; flex-direction: column; gap: 2px; }\r
.qa-cohort__profile {\r
  display: flex; align-items: center; justify-content: space-between;\r
  padding: 4px 8px; font-size: 11.5px; border-radius: 4px;\r
}\r
.qa-cohort__profile:hover { background: var(--bg-deep); }\r
.qa-cohort__name { color: var(--ink); font-weight: 500; flex: 1; }\r
.qa-cohort__meta { color: var(--ink-3); font-size: 10.5px; font-family: "Geist Mono", ui-monospace, monospace; flex-shrink: 0; }\r
\r
/* Test case list inside suite preview */\r
.qa-tc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }\r
.qa-tc {\r
  display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;\r
  padding: 5px 8px;\r
  border-radius: 4px;\r
  background: var(--panel);\r
  border: 1px solid var(--line-2);\r
}\r
.qa-tc__main { flex: 1; min-width: 0; }\r
.qa-tc__name { font-size: 11.5px; font-weight: 500; color: var(--ink); }\r
.qa-tc__scenario { font-size: 10.5px; color: var(--ink-3); margin-top: 1px; }\r
.qa-tc__badges { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }\r
\r
/* Category badge */\r
.qa-cat {\r
  display: inline-flex; align-items: center; height: 16px; padding: 0 6px;\r
  border-radius: 8px; font-size: 9.5px; font-weight: 600; text-transform: uppercase;\r
  letter-spacing: 0.04em;\r
}\r
.qa-cat--eligible { background: #d8efdf; color: #1a7a3a; }\r
.qa-cat--ineligible { background: #fde8e8; color: #b51c1c; }\r
\r
/* Expected outcome badge */\r
.qa-outcome {\r
  display: inline-flex; align-items: center; height: 16px; padding: 0 6px;\r
  border-radius: 8px; font-size: 9.5px; font-weight: 500;\r
  white-space: nowrap;\r
}\r
.qa-outcome--complete { background: var(--ok-bg); color: var(--ok); }\r
.qa-outcome--filtered_at_entry { background: var(--danger-bg); color: var(--danger); }\r
.qa-outcome--filtered_at_channel { background: var(--warn-bg); color: var(--warn); }\r
\r
/* Profiles tab â€” describe-what-to-add extend panel */\r
.jo-extend {\r
  background: var(--panel);\r
  border: 1px solid var(--line-2);\r
  border-radius: 10px;\r
  padding: 12px 14px;\r
  margin-bottom: 12px;\r
}\r
.jo-extend__head {\r
  display: flex; align-items: baseline; justify-content: space-between;\r
  margin-bottom: 8px;\r
  gap: 10px;\r
}\r
.jo-extend__head h4 { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--ink); }\r
.jo-extend__head span { font-size: 11px; color: var(--ink-3); text-align: right; }\r
.jo-extend__input {\r
  width: 100%;\r
  border: 1px solid var(--line-3);\r
  border-radius: var(--r-sm);\r
  padding: 8px 10px;\r
  font-size: 12px; color: var(--ink);\r
  background: var(--bg-deep);\r
  font-family: inherit;\r
  resize: vertical;\r
  min-height: 50px;\r
}\r
.jo-extend__input:focus {\r
  outline: 0; border-color: var(--accent);\r
  box-shadow: 0 0 0 3px var(--accent-soft);\r
  background: var(--panel);\r
}\r
.jo-extend__input:disabled { opacity: 0.6; cursor: not-allowed; }\r
.jo-extend__row {\r
  display: flex; align-items: center; justify-content: space-between;\r
  gap: 10px; margin-top: 8px;\r
}\r
.jo-extend__row label {\r
  display: inline-flex; align-items: center; gap: 6px;\r
  font-size: 11px; color: var(--ink-3);\r
}\r
.jo-extend__row input[type="number"] {\r
  width: 56px; height: 26px; padding: 0 8px;\r
  border: 1px solid var(--line-3); border-radius: var(--r-sm);\r
  background: var(--panel); font-size: 12px; color: var(--ink);\r
}\r
.jo-extend__examples {\r
  display: flex; flex-wrap: wrap; gap: 4px;\r
  margin-top: 10px;\r
  padding-top: 10px;\r
  border-top: 1px dashed var(--line-2);\r
}\r
.jo-extend__example {\r
  font-size: 10.5px; color: var(--ink-3);\r
  background: var(--bg-deep);\r
  border: 1px solid var(--line-2);\r
  border-radius: 12px;\r
  padding: 3px 9px;\r
  cursor: pointer;\r
  font-family: inherit;\r
}\r
.jo-extend__example:hover { color: var(--ink); background: #f0f3f8; }\r
.jo-extend__example:disabled { opacity: 0.5; cursor: not-allowed; }\r
\r
.jo-extend__hint {\r
  margin-top: 8px;\r
  padding: 8px 10px;\r
  background: var(--bg-deep);\r
  border-radius: var(--r-sm);\r
  font-size: 11px; color: var(--ink-3);\r
}\r
\r
.jo-extend__error {\r
  position: relative;\r
  margin-top: 8px;\r
  padding: 8px 28px 8px 10px;\r
  background: #fde8e8;\r
  color: #b51c1c;\r
  border: 1px solid #f3b6b6;\r
  border-radius: var(--r-sm);\r
  font-size: 11.5px;\r
  line-height: 1.4;\r
}\r
.jo-extend__error strong { font-weight: 600; margin-right: 4px; }\r
.jo-extend__error-close {\r
  position: absolute; top: 4px; right: 6px;\r
  background: transparent; border: 0; cursor: pointer;\r
  color: #b51c1c; font-size: 14px; line-height: 1; padding: 0 4px;\r
}\r
.jo-extend__error-close:hover { color: #8a0f0f; }\r
\r
/* Legacy QA runs tab classes â€” control strip (Generate / Start) â€” kept temporarily */\r
.jo-qa-controls { margin-bottom: 4px; }\r
.jo-qa-step {\r
  border: 1px solid var(--line-2); border-radius: var(--r-md);\r
  padding: 12px 14px; margin-bottom: 8px; background: var(--bg-subtle);\r
}\r
.jo-qa-step__row {\r
  display: grid;\r
  grid-template-columns: 24px 1fr auto;\r
  align-items: center;\r
  gap: 12px;\r
}\r
.jo-qa-step__num {\r
  width: 24px; height: 24px;\r
  border-radius: 50%; background: var(--accent); color: #fff;\r
  display: inline-flex; align-items: center; justify-content: center;\r
  font-size: 12px; font-weight: 600;\r
  flex-shrink: 0;\r
}\r
.jo-qa-step__body { min-width: 0; }\r
.jo-qa-step__body strong {\r
  font-size: 13px; color: var(--ink); display: block;\r
  font-weight: 600; line-height: 1.3;\r
}\r
.jo-qa-step__body p {\r
  margin: 3px 0 0; font-size: 11.5px; color: var(--ink-3);\r
  line-height: 1.4;\r
}\r
.jo-qa-step .jo-btn { white-space: nowrap; }\r
\r
/* Suite preview pills sit on their own row beneath the step header. */\r
.jo-qa-suite-preview {\r
  list-style: none; padding: 10px 0 0; margin: 10px 0 0;\r
  border-top: 1px solid var(--line-2);\r
  display: flex; flex-wrap: wrap; gap: 6px;\r
}\r
.jo-qa-suite-preview li {\r
  display: inline-flex; align-items: center; gap: 6px;\r
  font-size: 11px;\r
  background: var(--panel);\r
  border: 1px solid var(--line-2);\r
  padding: 4px 8px;\r
  border-radius: 14px;\r
}\r
.jo-qa-suite-preview code {\r
  background: transparent; color: var(--ink); padding: 0;\r
  border-radius: 0; font-size: 11px;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.jo-qa-suite-preview__count {\r
  background: var(--accent-soft); color: var(--accent-ink);\r
  padding: 1px 6px; border-radius: 8px; font-weight: 600;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
  font-size: 10.5px;\r
}\r
\r
/* Selected profile detail panel â€” shown when a walk is clicked. */\r
.jo-qa-selected {\r
  border: 1px solid var(--accent);\r
  background: var(--accent-soft);\r
  border-radius: var(--r-md);\r
  padding: 12px 14px;\r
  margin: 0 0 12px;\r
}\r
.jo-qa-selected__head {\r
  display: flex; align-items: flex-start; justify-content: space-between;\r
  gap: 10px; margin-bottom: 10px;\r
}\r
.jo-qa-selected__title {\r
  font-size: 13px; font-weight: 600; color: var(--ink);\r
  display: flex; align-items: center; gap: 8px;\r
}\r
.jo-qa-selected__sub {\r
  font-size: 11px; color: var(--ink-2); margin-top: 2px;\r
  font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.jo-qa-selected__close {\r
  background: transparent; border: 0; cursor: pointer;\r
  font-size: 14px; color: var(--ink-3); padding: 0 4px;\r
}\r
.jo-qa-selected__close:hover { color: var(--ink); }\r
.jo-qa-selected__meta {\r
  display: grid;\r
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));\r
  gap: 4px 12px;\r
  font-size: 11px; color: var(--ink-2);\r
  margin-bottom: 10px;\r
}\r
.jo-qa-selected__meta strong {\r
  display: block; color: var(--ink-3); font-weight: 500;\r
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;\r
}\r
.jo-qa-selected__why {\r
  font-size: 11.5px; color: var(--ink); padding: 8px 10px;\r
  background: var(--panel); border-radius: var(--r-sm); margin-bottom: 10px;\r
  border-left: 2px solid var(--accent);\r
}\r
.jo-qa-selected__steps { margin: 0; padding: 0; list-style: none; }\r
.jo-qa-selected__steps li {\r
  display: flex; align-items: flex-start; gap: 10px;\r
  padding: 6px 0; border-bottom: 1px dashed var(--line-2);\r
  font-size: 11.5px;\r
}\r
.jo-qa-selected__steps li:last-child { border-bottom: 0; }\r
.jo-qa-selected__step-num {\r
  width: 18px; height: 18px; border-radius: 50%;\r
  background: var(--bg-deep); color: var(--ink-2);\r
  font-size: 10px; font-weight: 600;\r
  display: inline-flex; align-items: center; justify-content: center;\r
  flex-shrink: 0; font-family: "Geist Mono", ui-monospace, monospace;\r
}\r
.jo-qa-selected__step-body { flex: 1; min-width: 0; }\r
.jo-qa-selected__step-node {\r
  display: inline-block; font-family: "Geist Mono", ui-monospace, monospace;\r
  font-size: 10.5px; background: var(--panel); padding: 1px 6px; border-radius: 3px;\r
  border: 1px solid var(--line-2); color: var(--ink);\r
  margin-right: 8px;\r
}\r
.jo-qa-selected__step--pass .jo-qa-selected__step-node { border-color: var(--ok); color: var(--ok); }\r
.jo-qa-selected__step--warn .jo-qa-selected__step-node { border-color: #d97700; color: #d97700; }\r
.jo-qa-selected__step--fail .jo-qa-selected__step-node { border-color: var(--danger); color: var(--danger); }\r
.jo-qa-selected__step-reason { color: var(--ink-2); }\r
\r
/* Walk row in suite list */\r
.jo-qa-walk__row {\r
  display: flex; align-items: center; gap: 8px;\r
  padding: 7px 10px;\r
  border: 1px solid transparent;\r
  border-radius: var(--r-sm);\r
  transition: background-color 60ms ease, border-color 60ms ease;\r
}\r
.jo-qa-walk:hover .jo-qa-walk__row {\r
  background: var(--bg-deep);\r
}\r
.jo-qa-walk.is-selected .jo-qa-walk__row {\r
  background: var(--accent-soft);\r
  border-color: var(--accent);\r
}\r
.jo-qa-walk__name {\r
  font-size: 12px; font-weight: 500; color: var(--ink);\r
  flex-shrink: 0;\r
}\r
\r
/* Manual test suite generation panel (legacy class â€” kept for compatibility) */\r
.jo-synth { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }\r
.jo-synth__hint { font-size: 11px; color: var(--ink-3); }\r
.jo-synth__suites { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }\r
.jo-synth__suite {\r
  border: 1px solid var(--line-2); border-radius: var(--r-md);\r
  background: var(--panel); overflow: hidden;\r
}\r
.jo-synth__suite > details > summary {\r
  display: flex; align-items: center; justify-content: space-between;\r
  padding: 8px 10px; cursor: pointer; font-size: 12px; font-weight: 500;\r
  list-style: none; user-select: none;\r
}\r
.jo-synth__suite > details > summary::-webkit-details-marker { display: none; }\r
.jo-synth__suite-count {\r
  font-family: "Geist Mono", ui-monospace, monospace; font-size: 11px;\r
  background: var(--accent-soft); color: var(--accent-ink);\r
  padding: 2px 7px; border-radius: 10px; font-weight: 600;\r
}\r
.jo-synth__suite-desc { font-size: 11.5px; color: var(--ink-3); padding: 0 10px 4px; margin: 0; }\r
.jo-synth__suite-expected { font-size: 11px; color: var(--ink-2); padding: 0 10px 6px; margin: 0; }\r
.jo-synth__suite-expected strong { color: var(--ink-3); font-weight: 500; }\r
.jo-synth__profile-list { list-style: none; margin: 0; padding: 0 10px 10px; display: flex; flex-direction: column; gap: 4px; }\r
.jo-synth__profile-list li { font-size: 11.5px; color: var(--ink-2); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }\r
.jo-synth__profile-list code { font-size: 10.5px; background: var(--bg-deep); padding: 1px 5px; border-radius: 3px; }\r
.jo-synth__rationale { color: var(--ink-3); font-size: 11px; flex: 1; min-width: 0; }\r
\r
/* =============================================================\r
   Dark-mode overrides — semantic tint colours that can't be\r
   expressed as simple CSS variable references\r
   ============================================================= */\r
:host([data-theme="dark"]) .jo-globalhead,\r
:host([data-theme="dark"]) .jo-subhead,\r
:host([data-theme="dark"]) .jo-cvtools,\r
:host([data-theme="dark"]) .jo-leftrail,\r
:host([data-theme="dark"]) .jo-inspector,\r
:host([data-theme="dark"]) .jo-run {\r
  background: var(--panel);\r
}\r
\r
:host([data-theme="dark"]) .jo-node__glyph--source  { background: rgba(74,126,255,0.18); color: #8ab4ff; }\r
:host([data-theme="dark"]) .jo-node__glyph--logic   { background: rgba(138,155,181,0.14); color: #8a9bb5; }\r
:host([data-theme="dark"]) .jo-node__glyph--action  { background: rgba(52,211,153,0.14); color: #34d399; }\r
:host([data-theme="dark"]) .jo-node__glyph--data    { background: rgba(167,139,250,0.16); color: #c4b5fd; }\r
:host([data-theme="dark"]) .jo-node__glyph--accent  { background: rgba(74,126,255,0.16); color: #8ab4ff; }\r
:host([data-theme="dark"]) .jo-node__glyph--danger  { background: rgba(248,113,113,0.14); color: #f87171; }\r
:host([data-theme="dark"]) .jo-node__glyph--warn    { background: rgba(251,191,36,0.14); color: #fbbf24; }\r
:host([data-theme="dark"]) .jo-node__glyph--exit    { background: rgba(90,104,128,0.2); color: #8a9bb5; }\r
:host([data-theme="dark"]) .jo-node__glyph--neutral { background: rgba(90,104,128,0.14); color: #8a9bb5; }\r
\r
:host([data-theme="dark"]) .jo-tag--test    { background: rgba(74,126,255,0.16); color: #8ab4ff; }\r
:host([data-theme="dark"]) .jo-tag--control { background: rgba(167,139,250,0.16); color: #c4b5fd; }\r
:host([data-theme="dark"]) .jo-tag--suppressed { background: rgba(248,113,113,0.14); color: #f87171; }\r
:host([data-theme="dark"]) .jo-tag--fcap-risk  { background: rgba(251,191,36,0.14); color: #fbbf24; }\r
:host([data-theme="dark"]) .jo-tag--holdout    { background: rgba(52,211,153,0.14); color: #34d399; }\r
\r
:host([data-theme="dark"]) .jo-pill--ok   { background: rgba(52,211,153,0.14); color: #34d399; }\r
:host([data-theme="dark"]) .jo-pill--warn { background: rgba(251,191,36,0.14); color: #fbbf24; }\r
\r
:host([data-theme="dark"]) .jo-qa-suite__count--pass { background: rgba(52,211,153,0.14); color: #34d399; }\r
:host([data-theme="dark"]) .jo-qa-suite__count--warn { background: rgba(251,191,36,0.14); color: #fbbf24; }\r
:host([data-theme="dark"]) .jo-qa-suite__count--fail { background: rgba(248,113,113,0.14); color: #f87171; }\r
\r
:host([data-theme="dark"]) .jo-kpi--ok { border-color: rgba(52,211,153,0.2); background: rgba(52,211,153,0.07); }\r
:host([data-theme="dark"]) .jo-kpi--ok .jo-kpi__v { color: #34d399; }\r
\r
:host([data-theme="dark"]) .jo-suite.is-selected { background: rgba(74,126,255,0.12); border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }\r
:host([data-theme="dark"]) .jo-suite { background: var(--panel); }\r
:host([data-theme="dark"]) .jo-suite:hover { background: var(--bg-subtle); border-color: var(--line-3); }\r
\r
:host([data-theme="dark"]) .jo-card { background: var(--bg-subtle); }\r
\r
:host([data-theme="dark"]) .jo-warn--warn { background: rgba(251,191,36,0.12); color: #fbbf24; border-left-color: #fbbf24; }\r
:host([data-theme="dark"]) .jo-warn--info { background: rgba(74,126,255,0.12); color: #8ab4ff; border-left-color: var(--accent); }\r
\r
:host([data-theme="dark"]) .jo-canvas__grid {\r
  background-image: radial-gradient(circle, rgba(138,155,181,0.12) 1px, transparent 1px);\r
}\r
\r
:host([data-theme="dark"]) .jo-edge path { stroke: rgba(90,104,128,0.5); }\r
:host([data-theme="dark"]) .jo-edge rect { fill: var(--bg-subtle); stroke: var(--line-3); }\r
:host([data-theme="dark"]) .jo-edge text { fill: var(--ink-3); }\r
\r
:host([data-theme="dark"]) .jo-node { background: var(--panel); border-color: var(--line-2); }\r
:host([data-theme="dark"]) .jo-node__meta { background: var(--bg-subtle); border-top-color: var(--line-2); }\r
:host([data-theme="dark"]) .jo-node__reach { background: var(--bg-subtle); border-color: var(--line-2); color: var(--ink-2); }\r
\r
:host([data-theme="dark"]) .jo-table th { background: var(--bg-subtle); }\r
:host([data-theme="dark"]) .jo-table tr.is-sel { background: rgba(74,126,255,0.1); }\r
\r
:host([data-theme="dark"]) .jo-modes__btn.is-on { background: var(--bg-subtle); box-shadow: var(--shadow-sm); }\r
\r
:host([data-theme="dark"]) .jo-search { background: var(--bg-subtle); }\r
:host([data-theme="dark"]) .jo-search:focus-within { background: var(--panel); }\r
\r
:host([data-theme="dark"]) .jo-btn { background: var(--bg-subtle); border-color: var(--line-2); }\r
:host([data-theme="dark"]) .jo-btn:hover { background: var(--bg-deep); }\r
:host([data-theme="dark"]) .jo-btn--primary { background: var(--accent); border-color: var(--accent); color: #fff; }\r
\r
:host([data-theme="dark"]) .jo-field input,\r
:host([data-theme="dark"]) .jo-field select,\r
:host([data-theme="dark"]) .jo-gen__row input,\r
:host([data-theme="dark"]) .jo-gen__row select { background: var(--bg-subtle); border-color: var(--line-2); }\r
\r
:host([data-theme="dark"]) .jo-prof-edit__grid input,\r
:host([data-theme="dark"]) .jo-prof-edit__grid select { background: var(--bg-subtle); border-color: var(--line-2); }\r
\r
:host([data-theme="dark"]) .jo-prof__avatar { background: linear-gradient(135deg, #1e3560, #2a4e8a); }\r
\r
:host([data-theme="dark"]) .jo-canvas__controls,\r
:host([data-theme="dark"]) .jo-canvas__legend { background: var(--panel); border-color: var(--line); }\r
\r
:host([data-theme="dark"]) .qa-sim-overlay { background: var(--panel); border-color: var(--line-2); }\r
:host([data-theme="dark"]) .qa-sim-overlay__stat { background: var(--bg-subtle); }\r
\r
:host([data-theme="dark"]) .jo-jpicker__menu { background: var(--panel); border-color: var(--line); }\r
:host([data-theme="dark"]) .jo-jpicker__item:hover { background: var(--bg-subtle); }\r
:host([data-theme="dark"]) .jo-jpicker__item.is-active { background: rgba(74,126,255,0.12); }\r
:host([data-theme="dark"]) .jo-jpicker__item.is-active .jo-jpicker__item-name { color: var(--accent-ink); }\r
\r
:host([data-theme="dark"]) .jo-preflight__list li { background: var(--panel); border-color: var(--line-2); }\r
:host([data-theme="dark"]) .jo-pf__count { background: rgba(74,126,255,0.14); color: var(--accent-ink); }\r
\r
:host([data-theme="dark"]) .jo-qa-walk { border-color: var(--line-2); }\r
:host([data-theme="dark"]) .jo-qa-suite > details > summary:hover { background: var(--bg-subtle); }\r
\r
:host([data-theme="dark"]) .qa-wb__col { background: var(--panel); border-color: var(--line-2); }\r
\r
:host([data-theme="dark"]) .jo-badge--draft { background: rgba(251,191,36,0.14); color: #fbbf24; }\r
:host([data-theme="dark"]) .jo-badge--live  { background: rgba(52,211,153,0.14); color: #34d399; }\r
:host([data-theme="dark"]) .jo-badge--scheduled { background: rgba(74,126,255,0.14); color: #8ab4ff; }\r
\r
:host([data-theme="dark"]) .jo-results__summary { border-color: var(--line-2); background: var(--bg-subtle); }\r
:host([data-theme="dark"]) .jo-kpi { background: var(--bg-subtle); border-color: var(--line-2); }\r
\r
:host([data-theme="dark"]) .jo-asserts th { background: var(--bg-subtle); }\r
\r
/* =========================================================\r
   Dark-mode overrides — comprehensive pass\r
   Fixes all hardcoded light-mode colors not covered above.\r
   ========================================================= */\r
\r
/* Journey picker dropdown menu */\r
:host([data-theme="dark"]) .jo-jpicker__menu {\r
  background: var(--panel);\r
  border-color: var(--line-2);\r
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4);\r
}\r
:host([data-theme="dark"]) .jo-jpicker__search {\r
  background: var(--bg-subtle);\r
  border-bottom-color: var(--line-2);\r
}\r
:host([data-theme="dark"]) .jo-jpicker__item:hover { background: var(--bg-subtle); }\r
\r
/* Walk rows — verdict badges */\r
:host([data-theme="dark"]) .qa-walk__verdict--pass { background: rgba(52,211,153,0.14); color: #34d399; }\r
:host([data-theme="dark"]) .qa-walk__verdict--warn { background: rgba(251,191,36,0.14); color: #fbbf24; }\r
:host([data-theme="dark"]) .qa-walk__verdict--fail { background: rgba(248,113,113,0.14); color: #f87171; }\r
\r
/* Walk row hover */\r
:host([data-theme="dark"]) .qa-walk:hover { background: var(--bg-subtle); border-color: var(--line-3); }\r
\r
/* Walk detail expand panel */\r
:host([data-theme="dark"]) .qa-walk-detail { background: var(--bg-deep); border-color: var(--accent); }\r
:host([data-theme="dark"]) .qa-walk-detail--warn { border-color: var(--warn); }\r
:host([data-theme="dark"]) .qa-walk-detail--fail { border-color: var(--danger); }\r
\r
/* Scenario head hover */\r
:host([data-theme="dark"]) .qa-scenario__head:hover { background: var(--bg-subtle); }\r
\r
/* Suite preview head hover */\r
:host([data-theme="dark"]) .qa-suite-preview__head:hover { background: var(--bg-subtle); }\r
\r
/* Tag chips */\r
:host([data-theme="dark"]) .qa-tagchip--eligible { background: rgba(52,211,153,0.14); color: #34d399; }\r
:host([data-theme="dark"]) .qa-tagchip--variant  { background: rgba(74,126,255,0.14); color: #8ab4ff; }\r
\r
/* Category badges */\r
:host([data-theme="dark"]) .qa-cat--eligible   { background: rgba(52,211,153,0.14); color: #34d399; }\r
:host([data-theme="dark"]) .qa-cat--ineligible  { background: rgba(248,113,113,0.14); color: #f87171; }\r
\r
/* Suite count badges (non-jo- prefix) */\r
:host([data-theme="dark"]) .qa-suite__count--pass { background: rgba(52,211,153,0.14); color: #34d399; }\r
:host([data-theme="dark"]) .qa-suite__count--warn { background: rgba(251,191,36,0.14); color: #fbbf24; }\r
:host([data-theme="dark"]) .qa-suite__count--fail { background: rgba(248,113,113,0.14); color: #f87171; }\r
\r
/* Run pill text */\r
:host([data-theme="dark"]) .qa-run-pill--warn .qa-run-pill__verdict { color: var(--warn); }\r
\r
/* Extend example button hover */\r
:host([data-theme="dark"]) .jo-extend__example:hover { background: var(--bg-subtle); color: var(--ink); }\r
\r
/* Extend error block */\r
:host([data-theme="dark"]) .jo-extend__error {\r
  background: rgba(248,113,113,0.12);\r
  color: #f87171;\r
  border-color: rgba(248,113,113,0.25);\r
}\r
:host([data-theme="dark"]) .jo-extend__error-close { color: #f87171; }\r
:host([data-theme="dark"]) .jo-extend__error-close:hover { color: #fca5a5; }\r
\r
/* Profile group dot — eligible */\r
:host([data-theme="dark"]) .qa-pgroup__dot--eligible { background: #34d399; }\r
\r
/* Default input/select/textarea background in dark mode */\r
:host([data-theme="dark"]) input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),\r
:host([data-theme="dark"]) select,\r
:host([data-theme="dark"]) textarea {\r
  background: var(--bg-deep);\r
  color: var(--ink);\r
  border-color: var(--line-3);\r
}\r
:host([data-theme="dark"]) input:focus,\r
:host([data-theme="dark"]) select:focus,\r
:host([data-theme="dark"]) textarea:focus {\r
  background: var(--panel);\r
  border-color: var(--accent);\r
}\r
\r
/* Node glyphs (base has hardcoded light colors) */\r
:host([data-theme="dark"]) .jo-node__glyph--source  { background: rgba(74,126,255,0.18); color: #8ab4ff; }\r
:host([data-theme="dark"]) .jo-node__glyph--logic   { background: rgba(138,155,181,0.14); color: #8a9bb5; }\r
:host([data-theme="dark"]) .jo-node__glyph--action  { background: rgba(52,211,153,0.14); color: #34d399; }\r
:host([data-theme="dark"]) .jo-node__glyph--data    { background: rgba(167,139,250,0.16); color: #c4b5fd; }\r
:host([data-theme="dark"]) .jo-node__glyph--accent  { background: rgba(74,126,255,0.16); color: #8ab4ff; }\r
:host([data-theme="dark"]) .jo-node__glyph--exit    { background: rgba(90,104,128,0.18); color: #8a9bb5; }\r
\r
/* KPI ok (has hardcoded light background) */\r
:host([data-theme="dark"]) .jo-kpi--ok {\r
  background: rgba(52,211,153,0.07);\r
  border-color: rgba(52,211,153,0.2);\r
}\r
\r
/* Sim overlay stopped text */\r
:host([data-theme="dark"]) .qa-sim-overlay__stopped { color: var(--warn); }\r
\r
/* =========================================================\r
   Light-mode overrides — semantic tints use correct values\r
   These correct elements that reference dark-mode variables\r
   in their base styles when running in light mode.\r
   ========================================================= */\r
\r
/* Walk row hover */\r
:host([data-theme="light"]) .qa-walk:hover { background: #f5f7fb; }\r
\r
/* Walk verdicts already hardcoded light — match for correctness */\r
:host([data-theme="light"]) .qa-walk__verdict--pass { background: #d8efdf; color: #1a7a3a; }\r
:host([data-theme="light"]) .qa-walk__verdict--warn { background: #fff0d4; color: #8a5a00; }\r
:host([data-theme="light"]) .qa-walk__verdict--fail { background: #fde8e8; color: #b51c1c; }\r
\r
/* Walk detail expand panel */\r
:host([data-theme="light"]) .qa-walk-detail { background: #fbfcfe; }\r
\r
/* Category badges */\r
:host([data-theme="light"]) .qa-cat--eligible  { background: #d8efdf; color: #1a7a3a; }\r
:host([data-theme="light"]) .qa-cat--ineligible { background: #fde8e8; color: #b51c1c; }\r
\r
/* Suite count badges */\r
:host([data-theme="light"]) .qa-suite__count--pass { background: #d8efdf; color: #1a7a3a; }\r
:host([data-theme="light"]) .qa-suite__count--warn { background: #fff0d4; color: #8a5a00; }\r
:host([data-theme="light"]) .qa-suite__count--fail { background: #fde8e8; color: #b51c1c; }\r
\r
/* Tag chips */\r
:host([data-theme="light"]) .qa-tagchip--eligible { background: #e3f1ed; color: #0f6d54; }\r
:host([data-theme="light"]) .qa-tagchip--variant  { background: #e3f1ed; color: #0f6d54; }\r
\r
/* Pills */\r
:host([data-theme="light"]) .jo-pill--ok   { background: #d8efdf; color: #1a7a3a; }\r
:host([data-theme="light"]) .jo-pill--warn { background: #fff0d4; color: #8a5a00; }\r
\r
/* Extend error block */\r
:host([data-theme="light"]) .jo-extend__error {\r
  background: #fde8e8;\r
  color: #b51c1c;\r
  border-color: #f3b6b6;\r
}\r
:host([data-theme="light"]) .jo-extend__error-close { color: #b51c1c; }\r
\r
/* Scenario/suite head hover */\r
:host([data-theme="light"]) .qa-scenario__head:hover { background: #f2f4f7; }\r
:host([data-theme="light"]) .qa-suite-preview__head:hover { background: #e8eaf0; }\r
\r
/* KPI ok */\r
:host([data-theme="light"]) .jo-kpi--ok {\r
  background: #f3faf6;\r
  border-color: rgba(17,122,69,0.25);\r
}\r
\r
/* Node glyphs */\r
:host([data-theme="light"]) .jo-node__glyph--source  { background: #e9eef9; color: #2c5cdf; }\r
:host([data-theme="light"]) .jo-node__glyph--logic   { background: #ecedf1; color: #46484e; }\r
:host([data-theme="light"]) .jo-node__glyph--action  { background: #e6f4ea; color: #117a45; }\r
:host([data-theme="light"]) .jo-node__glyph--data    { background: #efeafa; color: #6a4ec4; }\r
:host([data-theme="light"]) .jo-node__glyph--accent  { background: #e3eaff; color: #1e3fa0; }\r
:host([data-theme="light"]) .jo-node__glyph--exit    { background: #efeff2; color: #46484e; }\r
\r
/* Tags */\r
:host([data-theme="light"]) .jo-tag--test    { background: #e9eef9; color: var(--accent-ink); }\r
:host([data-theme="light"]) .jo-tag--control { background: #efeafa; color: #6a4ec4; }\r
:host([data-theme="light"]) .jo-tag--holdout { background: #e3f1ed; color: #0f6d54; }\r
\r
/* Suite counts (jo- prefixed) */\r
:host([data-theme="light"]) .jo-qa-suite__count--pass { background: #d8efdf; color: #1a7a3a; }\r
:host([data-theme="light"]) .jo-qa-suite__count--warn { background: #fff0d4; color: #8a5a00; }\r
:host([data-theme="light"]) .jo-qa-suite__count--fail { background: #fde8e8; color: #b51c1c; }\r
\r
/* Run pill */\r
:host([data-theme="light"]) .qa-run-pill--warn .qa-run-pill__verdict { color: #8a5a00; }\r
\r
/* ── Responsive ──────────────────────────────────────────────────────────── */\r
\r
/* SubHeader wraps at 1200px: reduce picker min-width, hide verbose meta */\r
@media (max-width: 1200px) {\r
  .jo-subhead { flex-wrap: wrap; height: auto; min-height: var(--h-subhead); padding: 8px 16px; gap: 8px; }\r
  .jo-subhead__title { flex-wrap: wrap; gap: 10px; }\r
  .jo-jpicker { min-width: 200px; max-width: 280px; }\r
  .jo-spicker { min-width: 160px; max-width: 220px; }\r
  .jo-subhead__meta { display: none; }\r
}\r
\r
/* SubHeader stacks at 800px */\r
@media (max-width: 800px) {\r
  .jo-subhead { flex-direction: column; align-items: flex-start; padding: 10px 16px; gap: 10px; }\r
  .jo-subhead__title { width: 100%; }\r
  .jo-subhead__right { width: 100%; justify-content: flex-end; }\r
  .jo-jpicker { min-width: 0; max-width: 100%; flex: 1; }\r
  .jo-spicker { min-width: 0; max-width: 100%; flex: 1; }\r
  .jo-jpicker__btn, .jo-spicker__btn { width: 100%; }\r
}\r
\r
/* QA workbench: horizontal scroll at 960px so columns don't crush */\r
@media (max-width: 960px) {\r
  .qa-wb { overflow-x: auto; }\r
  .qa-wb__col { min-width: 240px; flex: 0 0 240px; }\r
}\r
\r
/* QA workbench: stack vertically at 580px */\r
@media (max-width: 580px) {\r
  .qa-wb { flex-direction: column; height: auto; overflow-x: hidden; overflow-y: auto; }\r
  .qa-wb__col { min-width: 0; flex: none; height: 320px; border-right: none; border-bottom: 1px solid var(--line-2); }\r
  .qa-wb__col:last-child { border-bottom: none; height: auto; min-height: 240px; }\r
}\r
\r
/* Inspector: shrink gracefully at 960px */\r
@media (max-width: 960px) {\r
  .jo-inspector { min-width: 320px; }\r
}\r
\r
/* Workspace stacks on small screens */\r
@media (max-width: 640px) {\r
  .jo-workspace { flex-direction: column; }\r
  .jo-canvas { min-height: 240px; }\r
  .jo-inspector { width: 100%; min-width: 0; border-left: none; border-top: 1px solid var(--line-2); max-height: 60vh; }\r
}\r
`;function kr({journey:e,journeys:i,onSelectJourney:t,segments:l,selectedSegmentId:g,onSegmentChange:x,qaRunning:c,synthRunning:_,onGenerateAndRun:T,canSynth:u,hasSuites:w,disableSelectors:G=!1}){const[z,S]=b.useState(!1),[h,y]=b.useState(!1),[q,R]=b.useState(""),E=b.useRef(null),F=b.useRef(null);b.useEffect(()=>{if(!z&&!h)return;function p(v){const j=typeof v.composedPath=="function"?v.composedPath():[],$=j.some(M=>M===E.current),O=j.some(M=>M===F.current);$||S(!1),O||y(!1)}return document.addEventListener("mousedown",p),()=>document.removeEventListener("mousedown",p)},[z,h]);const C=q.trim().toLowerCase(),I=C?i.filter(p=>p.name.toLowerCase().includes(C)||(p.owner||"").toLowerCase().includes(C)):i,Q=l.find(p=>p.id===g)??null;function J(p){return`jo-badge jo-badge--${p.toLowerCase()}`}const P=()=>r.jsx("svg",{viewBox:"0 0 12 12",width:12,height:12,"aria-hidden":"true",style:{fill:"none",flexShrink:0,transition:"transform 120ms ease",color:"var(--ink-3)"},children:r.jsx("path",{d:"M2 4 L6 8 L10 4",stroke:"currentColor",strokeWidth:1.5})});return r.jsxs("div",{className:"jo-subhead",children:[r.jsxs("div",{className:"jo-subhead__title",children:[r.jsxs("div",{className:"jo-jpicker",ref:E,children:[r.jsxs("button",{type:"button",className:"jo-jpicker__btn"+(z?" is-open":"")+(G?" is-locked":""),onClick:()=>{G||(S(p=>!p),y(!1))},"aria-haspopup":"listbox","aria-expanded":z,disabled:G,children:[r.jsxs("span",{className:"jo-jpicker__col",children:[r.jsx("span",{className:"jo-eyebrow",children:"Journey"}),r.jsx("span",{className:"jo-jpicker__name",children:e.name})]}),r.jsx("svg",{viewBox:"0 0 12 12",width:12,height:12,"aria-hidden":"true",className:"jo-jpicker__chev",children:r.jsx("path",{d:"M2 4 L6 8 L10 4",fill:"none",stroke:"currentColor",strokeWidth:1.5})})]}),z&&r.jsxs("div",{className:"jo-jpicker__menu",role:"listbox",children:[r.jsxs("div",{className:"jo-jpicker__search",children:[r.jsxs("svg",{viewBox:"0 0 16 16",width:12,height:12,"aria-hidden":"true",children:[r.jsx("circle",{cx:7,cy:7,r:5,fill:"none",stroke:"currentColor",strokeWidth:1.5}),r.jsx("path",{d:"M11 11 L15 15",stroke:"currentColor",strokeWidth:1.5})]}),r.jsx("input",{placeholder:"Filter journeys…",autoFocus:!0,value:q,onChange:p=>R(p.target.value)})]}),r.jsx("ul",{children:I.map(p=>{const v=p.id===e.id;return r.jsxs("li",{role:"option","aria-selected":v,className:"jo-jpicker__item"+(v?" is-active":""),onClick:()=>{t(p.id),S(!1),R("")},children:[r.jsxs("div",{className:"jo-jpicker__item-main",children:[r.jsx("div",{className:"jo-jpicker__item-name",children:p.name}),r.jsxs("div",{className:"jo-jpicker__item-meta",children:[r.jsxs("span",{children:["v",p.version]}),r.jsx("span",{children:"·"}),r.jsx("span",{children:p.updated}),r.jsx("span",{children:"·"}),r.jsx("span",{children:p.owner})]})]}),r.jsx("span",{className:J(p.status),children:p.status})]},p.id)})})]})]}),r.jsxs("div",{ref:F,className:"jo-spicker"+(g?"":" is-empty")+(h?" is-open":""),style:{position:"relative"},children:[r.jsxs("button",{type:"button",className:"jo-spicker__btn"+(G?" is-locked":""),onClick:()=>{G||(y(p=>!p),S(!1))},"aria-haspopup":"listbox","aria-expanded":h,disabled:G,children:[r.jsx("span",{className:"jo-eyebrow",children:"Segment"}),r.jsx("span",{className:"jo-spicker__name",children:Q?`${Q.name} · ${Q.size}`:"Select segment…"}),r.jsx(P,{})]}),h&&l.length>0&&r.jsx("div",{className:"jo-spicker__menu",role:"listbox",children:r.jsx("ul",{children:l.map(p=>{const v=p.id===g;return r.jsxs("li",{role:"option","aria-selected":v,className:"jo-spicker__item"+(v?" is-active":""),onClick:()=>{x(p.id),y(!1)},children:[r.jsx("span",{className:"jo-spicker__item-name",children:p.name}),r.jsx("span",{className:"jo-spicker__item-size",children:p.size})]},p.id)})})})]}),r.jsxs("div",{className:"jo-subhead__meta",children:[r.jsx("span",{className:J(e.status),children:e.status}),r.jsxs("span",{children:["v",e.version]}),r.jsx("span",{children:"·"}),r.jsxs("span",{children:["Updated ",e.updated]}),r.jsx("span",{children:"·"}),r.jsx("span",{children:e.owner})]})]}),r.jsx("div",{className:"jo-subhead__right",children:r.jsxs("div",{className:"jo-subhead__actions",children:[r.jsx("button",{type:"button",className:"jo-btn jo-btn--ghost",children:"Save draft"}),r.jsx("button",{type:"button",className:"jo-btn jo-btn--primary",disabled:!u||c||_,onClick:T,title:w?"Regenerate profiles & QA suites":"Generate profiles & QA suites for this journey + segment",children:_?"Generating…":w?"Regenerate":"Generate Profiles & Suites"})]})})]})}const Z=["Lina","Marc","Sofia","Jens","Paula","Tomáš","Anouk","Pierre","Greta","Henrik","Mira","Bence","Aiko","Noor","Elif","Kai"],rr=["Brandt","Dupont","Romano","Vermeer","Iglesias","Novák","De Vries","Müller","Costa","Lindgren","Petrova","Bauer"],V=["DE","FR","NL","ES","IT"];function sr(e){const i=`${Z[Math.random()*Z.length|0]} ${rr[Math.random()*rr.length|0]}`,t=V[Math.random()*V.length|0],l="p_"+String(5e4+e+(Math.random()*9e3|0)).slice(0,5),g=Math.random()*4|0,x=Math.random()>.12,c=x?g>=3?"fcap-risk":Math.random()<.1?"control":"test":"suppressed";return{id:l,name:i,region:t,age:18+(Math.random()*48|0),consent:x,fcap:g,lastSend:`${Math.random()*40|0}d`,segment:"dormant_30d",tag:c}}const dr=["Add 3 profiles with email opted-out but SMS+push enabled","More high-fcap profiles for the Frequency Cap suite","Add 2 ineligible profiles in DE region","Generate 4 Happy Path variations with Medium engagement"];function lr({profiles:e,setProfiles:i,selectedIds:t,setSelectedIds:l,testSuites:g,onExtendSuites:x,extendError:c,clearExtendError:_,synthRunning:T,canSynth:u}){const[w,G]=b.useState("all"),[z,S]=b.useState(null),[h,y]=b.useState(null),[q,R]=b.useState(""),[E,F]=b.useState(3),C=u?g.length===0?"Generate test suites in the QA Runs tab first.":q.trim()?T?"A synth job is already running.":null:"Describe what kind of profile to add.":"Select a journey + segment in the header first.",I=()=>{C||(_(),x(q.trim(),E),R(""))};function Q(){const a=sr(e.length);i([...e,a]),S(a.id),y({...a})}function J(a){S(a.id),y({...a})}function P(){h&&(i(e.map(a=>a.id===h.id?h:a)),S(null),y(null))}function p(){S(null),y(null)}function v(a){i(e.filter(H=>H.id!==a)),z===a&&(S(null),y(null));const s=new Set(t);s.delete(a),l(s)}function j(a,s){h&&y({...h,[a]:s})}function $(a){const s=new Set(t);s.has(a)?s.delete(a):s.add(a),l(s)}function O(){t.size===M.length?l(new Set):l(new Set(M.map(a=>a.id)))}const M=b.useMemo(()=>w==="all"?e:e.filter(a=>a.tag===w),[e,w]),k=b.useMemo(()=>{const a={all:e.length,test:0,control:0,suppressed:0,"fcap-risk":0,holdout:0};for(const s of e)a[s.tag]=(a[s.tag]??0)+1;return a},[e]),f=[["all","All"],["test","Test"],["control","Control"],["holdout","Holdout"],["fcap-risk","Cap risk"],["suppressed","Suppressed"]],W=["test","control","suppressed","fcap-risk","holdout"];return r.jsxs("div",{className:"jo-pane",children:[r.jsxs("div",{className:"jo-pane__head",children:[r.jsxs("div",{children:[r.jsx("h3",{children:"Test profiles"}),r.jsx("p",{children:"Manual profile management. Auto-generated test suites live in the QA Runs tab."})]}),r.jsx("div",{className:"jo-row",children:r.jsx("button",{className:"jo-btn jo-btn--ghost",type:"button",onClick:Q,children:"Add"})})]}),r.jsxs("div",{className:"jo-extend",children:[r.jsxs("div",{className:"jo-extend__head",children:[r.jsx("h4",{children:"Add more profiles"}),r.jsx("span",{children:g.length===0?"Generate test suites in the QA Runs tab first.":"Describe what kind of profile to add — it'll join the right suite."})]}),r.jsx("textarea",{className:"jo-extend__input",rows:2,value:q,placeholder:g.length===0?"Disabled — generate test suites first.":"e.g. Add 3 high-fcap profiles for the Frequency Cap suite",disabled:g.length===0||T,onChange:a=>{R(a.target.value),c&&_()},onKeyDown:a=>{a.key==="Enter"&&(a.metaKey||a.ctrlKey)&&I()}}),r.jsxs("div",{className:"jo-extend__row",children:[r.jsxs("label",{children:["Count",r.jsx("input",{type:"number",min:1,max:20,value:E,onChange:a=>F(Math.max(1,Math.min(20,Number(a.target.value)||1))),disabled:g.length===0||T})]}),r.jsx("button",{className:"jo-btn jo-btn--primary",type:"button",onClick:I,disabled:!!C,title:C??"Generate additional profiles based on your description",children:T?"Adding…":"Add profiles"})]}),c&&r.jsxs("div",{className:"jo-extend__error",role:"alert",children:[r.jsx("strong",{children:"Couldn't add profiles:"})," ",c,r.jsx("button",{type:"button",onClick:_,className:"jo-extend__error-close",children:"×"})]}),C&&!q&&!c&&r.jsx("div",{className:"jo-extend__hint",children:C}),g.length>0&&!q&&!c&&r.jsx("div",{className:"jo-extend__examples",children:dr.map(a=>r.jsx("button",{type:"button",className:"jo-extend__example",onClick:()=>R(a),disabled:T,children:a},a))})]}),r.jsx("div",{className:"jo-chips",children:f.map(([a,s])=>r.jsxs("button",{type:"button",className:"jo-chip"+(w===a?" is-on":""),onClick:()=>G(a),children:[s," ",r.jsx("i",{children:k[a]??0})]},a))}),r.jsx("div",{className:"jo-table-wrap jo-table-wrap--scroll",children:r.jsxs("table",{className:"jo-table",children:[r.jsx("thead",{children:r.jsxs("tr",{children:[r.jsx("th",{style:{width:28},children:r.jsx("input",{type:"checkbox",checked:M.length>0&&t.size===M.length,onChange:O})}),r.jsx("th",{children:"Profile"}),r.jsx("th",{children:"Region"}),r.jsx("th",{children:"Age"}),r.jsx("th",{children:"Consent"}),r.jsx("th",{children:"F-cap"}),r.jsx("th",{children:"Last send"}),r.jsx("th",{children:"Tag"}),r.jsx("th",{style:{width:24}})]})}),r.jsx("tbody",{children:M.map(a=>r.jsxs(ir.Fragment,{children:[r.jsxs("tr",{className:(t.has(a.id)?"is-sel":"")+(z===a.id?" is-editing":""),style:{cursor:"pointer"},onClick:s=>{s.target.tagName!=="INPUT"&&(z===a.id?p():J(a))},children:[r.jsx("td",{onClick:s=>s.stopPropagation(),children:r.jsx("input",{type:"checkbox",checked:t.has(a.id),onChange:()=>$(a.id)})}),r.jsx("td",{children:r.jsxs("div",{className:"jo-prof",children:[r.jsx("div",{className:"jo-prof__avatar",children:a.name.split(" ").map(s=>s[0]).join("").slice(0,2)}),r.jsxs("div",{children:[r.jsx("div",{className:"jo-prof__name",children:a.name}),r.jsx("div",{className:"jo-prof__id",children:a.id}),a.scenario&&r.jsx("div",{className:"jo-prof__scenario",children:a.scenario})]})]})}),r.jsx("td",{children:a.region}),r.jsx("td",{children:a.age}),r.jsx("td",{children:a.consent?r.jsx("span",{className:"jo-dot jo-dot--ok"}):r.jsx("span",{className:"jo-dot jo-dot--bad"})}),r.jsx("td",{children:a.fcap}),r.jsx("td",{className:"num",children:a.lastSend}),r.jsx("td",{children:r.jsx("span",{className:`jo-tag jo-tag--${a.tag}`,children:a.tag})}),r.jsx("td",{onClick:s=>s.stopPropagation(),children:r.jsx("button",{className:"jo-btn-icon",type:"button",title:"Delete",onClick:()=>v(a.id),children:"×"})})]}),z===a.id&&h&&r.jsx("tr",{className:"jo-prof-edit-row",children:r.jsx("td",{colSpan:9,children:r.jsxs("div",{className:"jo-prof-edit",children:[r.jsxs("div",{className:"jo-prof-edit__grid",children:[r.jsxs("label",{children:["Name",r.jsx("input",{type:"text",value:h.name,onChange:s=>j("name",s.target.value)})]}),r.jsxs("label",{children:["Region",r.jsx("select",{value:h.region,onChange:s=>j("region",s.target.value),children:V.map(s=>r.jsx("option",{value:s,children:s},s))})]}),r.jsxs("label",{children:["Age",r.jsx("input",{type:"number",min:18,max:99,value:h.age,onChange:s=>j("age",Number(s.target.value))})]}),r.jsxs("label",{children:["F-cap",r.jsx("input",{type:"number",min:0,max:10,value:h.fcap,onChange:s=>j("fcap",Number(s.target.value))})]}),r.jsxs("label",{children:["Last send",r.jsx("input",{type:"text",value:h.lastSend,onChange:s=>j("lastSend",s.target.value)})]}),r.jsxs("label",{children:["Segment",r.jsx("input",{type:"text",value:h.segment,onChange:s=>j("segment",s.target.value)})]}),r.jsxs("label",{children:["Tag",r.jsx("select",{value:h.tag,onChange:s=>j("tag",s.target.value),children:W.map(s=>r.jsx("option",{value:s,children:s},s))})]}),r.jsxs("label",{className:"jo-prof-edit__consent",children:[r.jsx("input",{type:"checkbox",checked:h.consent,onChange:s=>j("consent",s.target.checked)}),"Consent"]})]}),r.jsxs("div",{className:"jo-prof-edit__actions",children:[r.jsx("button",{className:"jo-btn jo-btn--primary",type:"button",onClick:P,children:"Save"}),r.jsx("button",{className:"jo-btn jo-btn--ghost",type:"button",onClick:p,children:"Cancel"})]})]})})})]},a.id))})]})})]})}function pr({journey:e}){const i=e.suppression.reduce((t,l)=>t+l.count,0);return r.jsxs("div",{className:"jo-pane",children:[r.jsx("div",{className:"jo-pane__head",children:r.jsxs("div",{children:[r.jsx("h3",{children:"Journey criteria"}),r.jsx("p",{children:"Entry conditions, holdouts and suppression sources configured on this journey."})]})}),r.jsxs("section",{className:"jo-section",children:[r.jsxs("header",{children:[r.jsx("h4",{children:"Entry criteria"}),r.jsxs("span",{children:[e.criteria.length," rule",e.criteria.length!==1?"s":""]})]}),e.criteria.length===0?r.jsx("p",{className:"jo-qa-ok",children:"No entry criteria configured."}):r.jsx("ul",{className:"jo-rules",children:e.criteria.map(t=>r.jsxs("li",{className:`jo-rule jo-rule--${t.status}`,children:[r.jsx("span",{className:"jo-rule__mark"}),r.jsx("span",{className:"jo-rule__label",children:t.label}),t.note?r.jsx("span",{className:"jo-rule__note",children:t.note}):null]},t.id))})]}),r.jsxs("section",{className:"jo-section",children:[r.jsxs("header",{children:[r.jsx("h4",{children:"Holdouts"}),r.jsxs("span",{children:[e.holdouts.length," active"]})]}),e.holdouts.length===0?r.jsx("p",{className:"jo-qa-ok",children:"No holdouts configured on this journey."}):e.holdouts.map(t=>r.jsxs("div",{className:"jo-card",children:[r.jsxs("div",{className:"jo-card__top",children:[r.jsx("div",{className:"jo-card__title",children:t.name}),r.jsxs("div",{className:"jo-card__pct",children:[t.pct,"%"]})]}),r.jsxs("div",{className:"jo-card__row",children:[r.jsx("span",{children:"Basis"}),r.jsx("b",{children:t.basis})]}),r.jsxs("div",{className:"jo-card__row",children:[r.jsx("span",{children:"Scope"}),r.jsx("b",{children:t.scope})]})]},t.id))]}),r.jsxs("section",{className:"jo-section",children:[r.jsxs("header",{children:[r.jsx("h4",{children:"Suppression sources"}),r.jsx("span",{children:i>0?`${i.toLocaleString()} profiles`:"—"})]}),e.suppression.length===0?r.jsx("p",{className:"jo-qa-ok",children:"No suppression sources configured on this journey."}):r.jsx("ul",{className:"jo-list",children:e.suppression.map(t=>r.jsxs("li",{children:[r.jsxs("div",{children:[r.jsx("div",{className:"jo-list__label",children:t.label}),r.jsx("div",{className:"jo-list__sub",children:t.source})]}),r.jsx("div",{className:"jo-list__num",children:t.count.toLocaleString()})]},t.id))})]})]})}const er="/api/qa-automation";async function A(e,i){const t=await fetch(`${er}${e}`,{headers:{"Content-Type":"application/json",...(i==null?void 0:i.headers)??{}},cache:"no-store",...i});if(!t.ok){const l=await t.text().catch(()=>"");throw new Error(`HTTP ${t.status} ${t.statusText} — ${l}`)}return t.json()}const ar={async listJourneys(){return A("/journeys")},async getJourney(e){return A(e?`/journey?id=${encodeURIComponent(e)}`:"/journey")},async getProfiles(){return A("/profiles")},async generateProfiles(e){return A("/profiles/generate",{method:"POST",body:JSON.stringify(e)})},async startRun(e){return A("/runs",{method:"POST",body:JSON.stringify(e)})},subscribeRun(e,i){const t=new EventSource(`${er}/runs/${e}/stream`);t.addEventListener("step",g=>{var x;try{(x=i.onStep)==null||x.call(i,JSON.parse(g.data))}catch(c){console.error("Failed to parse step event",c)}});let l=!1;return t.addEventListener("done",g=>{var x;l=!0,t.close();try{(x=i.onDone)==null||x.call(i,JSON.parse(g.data))}catch(c){console.error("Failed to parse done event",c)}}),t.onerror=()=>{var g;l||(t.close(),(g=i.onError)==null||g.call(i))},()=>t.close()},async listSegments(e){return A(`/segments${e?`?journeyId=${encodeURIComponent(e)}`:""}`)},async getSegment(e){return A(`/segments/${encodeURIComponent(e)}`)},async synthProfiles(e){return A("/profiles/synth",{method:"POST",body:JSON.stringify(e)})},async extendProfiles(e){return A("/profiles/synth/extend",{method:"POST",body:JSON.stringify(e)})},async getSynthStatus(e){return A(`/profiles/synth/${encodeURIComponent(e)}`)},async simulateProfile(e,{intervalMs:i=2e3,maxAttempts:t=90}={}){const{simId:l}=await A("/simulate",{method:"POST",body:JSON.stringify(e)});for(let g=0;g<t;g++){await new Promise(c=>setTimeout(c,i));const x=await A(`/simulate/${encodeURIComponent(l)}`);if(x.status==="done"&&x.result)return x.result;if(x.status==="failed")throw new Error(x.error||"Simulation failed")}throw new Error("Simulation timed out")},async startQARun(e){return A("/runs/qa",{method:"POST",body:JSON.stringify(e)})},async getReport(e){return A(`/runs/${encodeURIComponent(e)}/report`)},pollReport(e,i,t,{intervalMs:l=4e3,maxAttempts:g=75}={}){let x=0,c=!1;const _=async()=>{if(!c){x++;try{const T=await ar.getReport(e);c||i(T);return}catch{}if(x>=g){c||t();return}setTimeout(_,l)}};return setTimeout(_,l),()=>{c=!0}}},cr={pass:"var(--ok)",fail:"var(--danger)"},gr={pass:"PASS",fail:"FAIL"},B={pass:"var(--ok)",fail:"var(--danger)",skipped:"var(--muted, #8a8f98)"},K={pass:"PASS",fail:"FAIL",skipped:"DID NOT EXECUTE"},xr={pass:"P",fail:"F",skipped:"—"},hr={pass:"OK",fail:"✕",skipped:"—"};function fr(e){const i=(e.archetype??"").toLowerCase(),t=e.suppressionReason;return t==="holdout_segment"||e.holdout||i==="holdout"?"Holdout":t==="no_consent"||i==="consent_suppressed"?"No consent":t==="experiment_holdback"||i==="experiment_holdback"?"Experiment holdback":i==="ineligible"||e.category==="ineligible"?"Ineligible":i.startsWith("experiment_variant")||e.scenarioTone==="variant"?"Experiment":"Eligible"}const nr=["Eligible","Experiment","Holdout","No consent","Experiment holdback","Ineligible"],br={Eligible:"eligible",Experiment:"variant",Holdout:"excluded","No consent":"excluded","Experiment holdback":"excluded",Ineligible:"excluded"};function ur(e){if(e.consentScope==="global"||e.globalConsent)return"Global consent";if(e.consentScope==="none")return"No consent";const i=e.channelConsent??{},t=["email","sms","push","call"].filter(l=>i[l]);return t.length>0?`Consent: ${t.join(", ")}`:e.consent===!1?"No consent":"Consent: global"}function mr({testPlans:e,activePlanId:i,onSelectPlan:t,synthRunning:l,onExtend:g,extendError:x,clearExtendError:c,onPathChange:_,onSimResult:T}){const u=b.useMemo(()=>e.find(n=>n.id===i)??e[e.length-1]??null,[e,i]),w=(u==null?void 0:u.profiles)??[],G=(u==null?void 0:u.suites)??[],[z,S]=b.useState("all"),[h,y]=b.useState(null),[q,R]=b.useState({}),[E,F]=b.useState(new Set),[C,I]=b.useState(!1),[Q,J]=b.useState(new Set),[P,p]=b.useState(""),v=n=>J(d=>{const o=new Set(d);return o.has(n)?o.delete(n):o.add(n),o}),j=()=>{const n=P.trim();!n||l||(c(),g(n,0),p(""))},$=b.useMemo(()=>{const n=new Map;for(const o of w){const m=fr(o);n.has(m)||n.set(m,[]),n.get(m).push(o)}return[...nr.filter(o=>n.has(o)),...[...n.keys()].filter(o=>!nr.includes(o))].map(o=>[o,n.get(o)])},[w]),O=b.useMemo(()=>[["all","All"],...$.map(([n,d])=>[n,`${n} (${d.length})`])],[$]),M=z==="all"?$:$.filter(([n])=>n===z),k=w.find(n=>n.id===h)??null,f=h?q[h]:void 0;b.useEffect(()=>{if(_(((f==null?void 0:f.path)??[]).map(N=>N.nodeId)),!k||!f){T(null);return}const n=f.checks??[],d=N=>n.filter(D=>D.status===N).length,o=f.path??[],m=o.some(N=>N.action==="suppressed"||N.action==="converted")||d("skipped")>0;T({profileId:k.id,profileName:k.name??k.id,verdict:f.verdict,pass:d("pass"),fail:d("fail"),skipped:d("skipped"),total:n.length,steps:o.length,stopped:m})},[f,h]);const W=n=>n.trim().toLowerCase().replace(/\s+/g," "),a=b.useMemo(()=>{const n=new Map;for(const d of(f==null?void 0:f.checks)??[]){const o=W(d.suite??"");n.has(o)||n.set(o,[]),n.get(o).push(d)}return n},[f]);function s(n,d,o){var U;const m=a.get(W(n))??[];if(m.length===0)return;const N=m.find(L=>L.title===d);if(N)return N.status;const D=m.find(L=>W(L.title)===W(d));return D?D.status:(U=m[o])==null?void 0:U.status}function H(n){const d=a.get(W(n.name))??[];return d.length===0?null:d.some(o=>o.status==="fail")?"fail":d.some(o=>o.status==="pass")?"pass":"skipped"}async function X(n){if(!(!u||E.has(n.id))){F(d=>new Set(d).add(n.id));try{const d=await ar.simulateProfile({journeyId:u.journeyId,segmentId:u.segmentId,profile:n,suites:G});R(o=>({...o,[n.id]:d}))}catch(d){console.error("Simulation failed",d)}finally{F(d=>{const o=new Set(d);return o.delete(n.id),o})}}}function or(n){y(n.id),!q[n.id]&&!E.has(n.id)&&X(n)}async function tr(){if(!C){I(!0);try{for(const n of w)!q[n.id]&&!E.has(n.id)&&await X(n)}finally{I(!1)}}}const Y=e.length>1&&r.jsxs("div",{className:"qa-plan-history",children:[r.jsx("span",{className:"qa-plan-history__label",children:"Versions:"}),e.map((n,d)=>r.jsxs("button",{type:"button",className:`qa-plan-pill ${n.id===(u==null?void 0:u.id)?"is-active":""}`,onClick:()=>{t(n.id),y(null)},title:`${n.segmentId} · ${n.profiles.length} profiles · ${n.createdAt}`,children:["v",d+1]},n.id))]});return l?r.jsx("div",{className:"jo-pane qa-wb-wrap",children:r.jsxs("div",{className:"qa-running-state",children:[r.jsx("div",{className:"qa-running-state__spinner"}),r.jsx("div",{className:"qa-running-state__title",children:"Generating profiles & QA suites…"}),r.jsx("p",{children:"Synthesising a realistic audience and the journey-level QA suites."})]})}):!u||w.length===0?r.jsxs("div",{className:"jo-pane qa-wb-wrap",children:[Y,r.jsxs("div",{className:"qa-empty",children:[r.jsx("div",{className:"qa-empty__title",children:"No profiles yet"}),r.jsxs("p",{children:["Select a journey + segment, then click ",r.jsx("strong",{children:"Generate Profiles & Suites"}),"."]})]})]}):r.jsxs("div",{className:"qa-wb-wrap",children:[Y,r.jsxs("div",{className:"qa-wb",children:[r.jsxs("section",{className:"qa-wb__col",children:[r.jsxs("div",{className:"qa-wb__head",children:[r.jsx("h3",{children:"Profiles"}),r.jsx("span",{className:"qa-wb__count",children:w.length})]}),r.jsx("div",{className:"qa-wb__filters",children:O.map(([n,d])=>r.jsx("button",{type:"button",className:`qa-chip-btn${z===n?" is-on":""}`,onClick:()=>S(n),children:d},n))}),r.jsx("div",{className:"qa-wb__scroll",children:M.map(([n,d])=>r.jsxs("div",{className:"qa-pgroup",children:[r.jsxs("div",{className:"qa-pgroup__head",children:[r.jsx("span",{className:`qa-pgroup__dot qa-pgroup__dot--${br[n]??"eligible"}`}),n," ",r.jsx("span",{className:"qa-pgroup__count",children:d.length})]}),d.map(o=>{const m=q[o.id],N=E.has(o.id);return r.jsxs("button",{type:"button",className:`qa-pcard${h===o.id?" is-active":""}`,onClick:()=>or(o),children:[r.jsx("span",{className:"qa-pcard__avatar",children:o.initials??(o.name??"?").slice(0,2).toUpperCase()}),r.jsxs("span",{className:"qa-pcard__body",children:[r.jsxs("span",{className:"qa-pcard__top",children:[r.jsx("span",{className:"qa-pcard__name",children:o.name??o.id}),N?r.jsx("span",{className:"qa-pcard__spin"}):m?r.jsx("span",{className:"qa-pcard__verdict",style:{color:cr[m.verdict]},children:gr[m.verdict]}):null]}),r.jsxs("span",{className:"qa-pcard__sub",children:[o.summary??o.archetype," · ",o.id]}),o.scenarioTag&&r.jsx("span",{className:`qa-tagchip qa-tagchip--${o.scenarioTone??"eligible"}`,children:o.scenarioTag})]})]},o.id)})]},n))}),r.jsxs("div",{className:"qa-addbar",children:[r.jsx("textarea",{className:"qa-addbar__input",rows:2,placeholder:"Add profiles… e.g. '3 high-mileage owners with an open service case'",value:P,disabled:l,onChange:n=>{p(n.target.value),x&&c()},onKeyDown:n=>{n.key==="Enter"&&(n.metaKey||n.ctrlKey)&&j()}}),x&&r.jsx("div",{className:"qa-addbar__err",children:x}),r.jsx("button",{type:"button",className:"jo-btn jo-btn--ghost qa-addbar__btn",disabled:!P.trim()||l,onClick:j,children:l?"Adding…":"Add profiles (new version)"})]})]}),r.jsxs("section",{className:"qa-wb__col",children:[r.jsxs("div",{className:"qa-wb__head",children:[r.jsx("h3",{children:"QA Suites"}),r.jsx("button",{type:"button",className:`jo-btn jo-btn--primary qa-wb__runall${C?" is-loading":""}`,onClick:tr,disabled:C,children:C?r.jsxs(r.Fragment,{children:[r.jsx("span",{className:"qa-runall__spin"}),"Running…"]}):"Run All"})]}),k&&r.jsxs("div",{className:"qa-wb__subhead",children:["Results for ",r.jsx("strong",{children:k.name})]}),r.jsx("div",{className:"qa-wb__scroll",children:G.map(n=>{const d=n.testCases??[],o=d.length||(n.testCount??0),m=H(n),N=Q.has(n.name);return r.jsxs("div",{className:`qa-scard${N?" is-open":""}`,children:[r.jsxs("button",{type:"button",className:"qa-scard__head",onClick:()=>v(n.name),"aria-expanded":N,children:[r.jsx("span",{className:"qa-scard__status",title:m?K[m]:void 0,style:m?{background:B[m],color:"#fff",borderColor:"transparent"}:void 0,children:m?xr[m]:"--"}),r.jsxs("div",{className:"qa-scard__body",children:[r.jsx("div",{className:"qa-scard__name",children:n.name}),r.jsx("div",{className:"qa-scard__desc",children:n.description}),r.jsxs("div",{className:"qa-scard__meta",children:[o," test",o===1?"":"s"]})]}),r.jsx("span",{className:"qa-scard__chev",children:N?"▾":"▸"})]}),N&&(d.length>0?r.jsx("ul",{className:"qa-tcase-list",children:d.map((D,U)=>{const L=s(n.name,D.title,U);return r.jsxs("li",{className:`qa-tcase${L?` qa-tcase--${L}`:""}`,children:[r.jsx("span",{className:"qa-tcase__badge",style:L?{background:B[L],color:"#fff",borderColor:"transparent"}:void 0,children:L?K[L]:"—"}),r.jsxs("div",{className:"qa-tcase__body",children:[r.jsx("div",{className:"qa-tcase__title",children:D.title}),D.description&&r.jsx("div",{className:"qa-tcase__desc",children:D.description})]})]},U)})}):r.jsx("div",{className:"qa-tcase-empty",children:"No individual test cases — regenerate the plan to populate them."}))]},n.name)})})]}),r.jsxs("section",{className:"qa-wb__col qa-wb__col--results",children:[r.jsxs("div",{className:"qa-wb__head",children:[r.jsx("h3",{children:"Simulation Results"}),k&&r.jsxs("span",{className:"qa-wb__chip",children:[k.name," / ",k.id]})]}),r.jsx("div",{className:"qa-wb__scroll",children:k?r.jsxs(r.Fragment,{children:[r.jsxs("div",{className:"qa-meta-grid",children:[(k.metadata??[]).map(n=>r.jsxs("div",{className:"qa-meta-card",children:[r.jsx("div",{className:"qa-meta-card__label",children:n.label}),r.jsx("div",{className:"qa-meta-card__value",children:n.value})]},n.label)),r.jsxs("div",{className:"qa-meta-card",children:[r.jsx("div",{className:"qa-meta-card__label",children:"Consent"}),r.jsx("div",{className:"qa-meta-card__value",children:ur(k)})]}),k.suppressionReason&&r.jsxs("div",{className:"qa-meta-card",children:[r.jsx("div",{className:"qa-meta-card__label",children:"Suppressed"}),r.jsx("div",{className:"qa-meta-card__value",children:k.suppressionReason.replace(/_/g," ")})]}),k.ownerId&&r.jsxs("div",{className:"qa-meta-card",children:[r.jsx("div",{className:"qa-meta-card__label",children:"Owner ID"}),r.jsx("div",{className:"qa-meta-card__value",children:k.ownerId})]})]}),(k.expectedOutcome||(f==null?void 0:f.expected))&&r.jsxs("div",{className:"qa-expected",children:["Expected: ",r.jsx("strong",{children:(f==null?void 0:f.expected)??k.expectedOutcome})]}),(f==null?void 0:f.path)&&f.path.length>0&&r.jsxs(r.Fragment,{children:[r.jsx("div",{className:"qa-sim-head",children:"Journey Path"}),r.jsx("ol",{className:"qa-path",children:f.path.map((n,d)=>r.jsxs("li",{className:`qa-path__step qa-path__step--${n.status}`,children:[r.jsx("span",{className:"qa-path__num",children:d+1}),r.jsx("span",{className:"qa-path__dot",style:{background:B[n.status]}}),r.jsxs("div",{className:"qa-path__body",children:[r.jsx("div",{className:"qa-path__label",children:n.label||n.nodeId}),n.action&&r.jsx("div",{className:"qa-path__action",children:n.action})]}),r.jsx("code",{className:"qa-path__node",children:n.nodeId})]},d))})]}),r.jsx("div",{className:"qa-sim-head",children:"Test Results"}),E.has(k.id)&&!f?r.jsxs("div",{className:"qa-sim-loading",children:[r.jsx("span",{className:"qa-running-state__spinner"}),r.jsxs("span",{children:["Simulating ",k.name,"…"]})]}):f?G.map(n=>{const d=f.checks.filter(o=>o.suite===n.name);return d.length===0?null:r.jsxs("div",{className:"qa-simgroup",children:[r.jsx("div",{className:"qa-simgroup__head",children:n.name}),r.jsx("ul",{className:"qa-checks",children:d.map((o,m)=>r.jsxs("li",{className:`qa-check qa-check--${o.status}`,children:[r.jsx("span",{className:"qa-check__ok",style:{background:B[o.status]},children:hr[o.status]}),r.jsxs("div",{className:"qa-check__body",children:[r.jsx("div",{className:"qa-check__title",children:o.title}),r.jsx("div",{className:"qa-check__desc",children:o.description})]}),r.jsx("span",{className:`qa-check__verdict qa-check__verdict--${o.status}`,children:K[o.status]})]},m))})]},n.name)}):r.jsx("div",{className:"qa-empty",children:r.jsx("p",{children:"Click the profile again to run its simulation."})})]}):r.jsx("div",{className:"qa-empty",children:r.jsx("p",{children:"Select a profile to simulate its journey."})})})]})]})]})}function jr({journey:e,selectedNode:i,profiles:t,setProfiles:l,selectedProfileIds:g,setSelectedProfileIds:x,qaRuns:c,activeRunId:_,onSelectRun:T,testPlans:u,activePlanId:w,onSelectPlan:G,onSynthSuites:z,onExtendSuites:S,extendError:h,clearExtendError:y,synthRunning:q,onRunQA:R,qaRunning:E,qaProgress:F,qaLogs:C,canSynth:I,selectedWalkId:Q,onSelectWalk:J,onPathChange:P,onSimResult:p,activeTab:v,onTabChange:j}){const $=u.find(M=>M.id===w)??u[u.length-1],O=c.find(M=>M.id===_)??c[c.length-1]??null;return b.useEffect(()=>{v==="qa"&&u.length===0&&I&&!q&&!E&&z()},[v]),r.jsxs("aside",{className:"jo-inspector",children:[r.jsxs("div",{className:"jo-inspector__tabs",role:"tablist",children:[r.jsxs("button",{type:"button",role:"tab",className:v==="profiles"?"is-on":"",onClick:()=>j("profiles"),children:["Profiles ",r.jsx("span",{className:"jo-pill",children:t.length})]}),r.jsx("button",{type:"button",role:"tab",className:v==="criteria"?"is-on":"",onClick:()=>j("criteria"),children:"Criteria"}),r.jsxs("button",{type:"button",role:"tab",className:v==="qa"?"is-on":"",onClick:()=>j("qa"),children:["QA Runs",c.length>0&&r.jsx("span",{className:`jo-pill jo-pill--${((O==null?void 0:O.report.verdict)??"warn")==="pass"?"ok":"warn"}`,children:c.length})]})]}),r.jsxs("div",{className:`jo-inspector__body${v==="qa"?" jo-inspector__body--qa":""}`,children:[v==="profiles"&&r.jsx(lr,{profiles:t,setProfiles:l,selectedIds:g,setSelectedIds:x,testSuites:($==null?void 0:$.suites)??[],onExtendSuites:S,extendError:h,clearExtendError:y,synthRunning:q,canSynth:I}),v==="criteria"&&r.jsx(pr,{journey:e}),v==="qa"&&r.jsx(mr,{testPlans:u,activePlanId:w,onSelectPlan:G,synthRunning:q,onExtend:S,extendError:h,clearExtendError:y,onPathChange:P,onSimResult:p})]})]})}function wr(e,i){const t=i.filter(_=>_.consent).length,l=i.filter(_=>_.consent&&_.fcap<3).length,g=i.filter(_=>_.fcap>=3).length,x=i.filter(_=>!_.consent).length,c=[];return g>0&&c.push({id:"w1",level:"warn",msg:`${g} profiles near frequency cap will be filtered.`}),x>0&&c.push({id:"w2",level:"info",msg:`${x} profiles lack consent and will be suppressed at step S.`}),c.push({id:"w3",level:"info",msg:"Identity namespace 'Email' detected on entry event."}),{holdouts:e.holdouts,suppression:e.suppression,criteria:e.criteria,nodeReach:{n1:i.length,n2:i.length,n3:t,n4:l,n5:Math.round(l*.9*.6),n6:Math.round(l*.9),n7:Math.round(l*.9*.4),n8:Math.round(l*.9),n9:Math.round(l*.9*.27),n10:Math.round(l*.9*.73)},warnings:c}}export{jr as I,kr as S,ar as a,wr as c,vr as q};
