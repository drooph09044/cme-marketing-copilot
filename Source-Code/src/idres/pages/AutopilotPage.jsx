import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PRECONFIGURED_JOURNEYS } from "../../../shared/suiteData";
import { saveJourney as storeJourney, getJourneyBySlug } from "../../shared/journeyStore";
import "./AutopilotPage.css";

/* ── Pipeline steps ── */
const PIPELINE_STEPS = [
  { id: "blueprint",     label: "Blueprint",              sub: "Designing campaign strategy",                  durationMs: 10000 },
  { id: "audience",      label: "Audience & Segments",    sub: "Qualifying the target segment",                durationMs: 8000  },
  { id: "creative",      label: "Creative set",           sub: "Generating channel templates",                 durationMs: 6000  },
  { id: "journey_brief", label: "Journey build & brief",  sub: "Assembling the flow and drafting the brief",   durationMs: 9000  },
];

const POST_STEPS = [
  { id: "qa_run",    label: "QA automation", sub: "Running test suites against live profiles", durationMs: 7000 },
  { id: "analytics", label: "Analytics",      sub: "Seeding outcome metrics and dashboards",    durationMs: 5000 },
];

const EXAMPLE_GOALS = [
  "Identify subscribers showing churn signals such as declining watch time, reduced engagement, cancelled notifications, or payment issues. Predict churn probability, determine likely causes, and activate personalised retention campaigns and targeted content recommendations.",
  "Win back high churn-risk VIPs with a 3-email sequence, an SMS reminder, and a 10% holdout",
  "Onboard new signups over their first 2 weeks and A/B test the activation email",
  "Re-engage customers who haven't purchased in 90 days across email and push",
  "Drive repeat purchases from high-propensity customers with a limited-time offer",
];

const QUICK_CHIPS = [
  { label: "Golden flow",   icon: "✦" },
  { label: "Win-back",      icon: "↩" },
  { label: "Onboarding",    icon: "→" },
  { label: "Re-engagement", icon: "⟳" },
];

const NODE_COLORS = {
  ENTRY:     "#3b82f6",
  A_B_SPLIT: "#8b5cf6",
  MESSAGE:   "#f59e0b",
  WAIT:      "#06b6d4",
  BRANCH:    "#f59e0b",
  GOAL:      "#10b981",
  EXIT:      "#ef4444",
};

const JOURNEY_FLOWS = {
  churn: [
    { type: "ENTRY",   label: "Churn Signal Detected", sub: "Score ≥ 74, Low engagement"    },
    { type: "MESSAGE", label: "Retention Email",        sub: "Personalised win-back offer"   },
    { type: "MESSAGE", label: "SMS Alert",              sub: "Urgent re-engagement nudge"    },
    { type: "WAIT",    label: "Wait 2 days",            sub: null                            },
    { type: "BRANCH",  label: "Response Check",         sub: "Opened or clicked?"            },
    { type: "MESSAGE", label: "Loyalty Reward",         sub: "Engaged path — exclusive offer"},
    { type: "MESSAGE", label: "Final Offer",            sub: "Inactive path — last attempt"  },
    { type: "GOAL",    label: "Retained",               sub: "Subscription continues"        },
    { type: "EXIT",    label: "Churned",                sub: "Suppressed for 90 days"        },
  ],
  signup: [
    { type: "ENTRY",   label: "New User Signup",        sub: "Email verified, account created"},
    { type: "MESSAGE", label: "Welcome Email",          sub: "Brand intro + quick start guide"},
    { type: "WAIT",    label: "Wait 2 days",            sub: null                             },
    { type: "MESSAGE", label: "Onboarding Email",       sub: "Feature walkthrough series"    },
    { type: "WAIT",    label: "Wait 3 days",            sub: null                             },
    { type: "BRANCH",  label: "Engagement Check",       sub: "Opened or clicked?"            },
    { type: "MESSAGE", label: "Feature Highlight",      sub: "Engaged path — advanced tips"  },
    { type: "MESSAGE", label: "Re-engagement Nudge",    sub: "Inactive path — gentle push"   },
    { type: "GOAL",    label: "Activation",             sub: "First value moment reached"    },
  ],
};

/* ── Helpers ── */
function parseGoalIntent(text) {
  const t = text.toLowerCase();
  const channels = [];
  if (t.includes("email")) channels.push("Email");
  if (t.includes("sms"))   channels.push("SMS");
  if (t.includes("push"))  channels.push("Push");
  if (t.includes("in_app") || t.includes("in-app") || t.includes("inapp")) channels.push("In-App");
  if (channels.length === 0) channels.push("Email");

  let category = "onboarding";
  if (t.includes("win back") || t.includes("winback") || t.includes("churn") || t.includes("lapsed") || t.includes("re-engage") || t.includes("reengage") || t.includes("declining") || t.includes("watch time")) category = "reengagement";
  else if (t.includes("onboard") || t.includes("signup")) category = "onboarding";
  else if (t.includes("purchase") || t.includes("buy") || t.includes("upsell") || t.includes("repeat")) category = "conversion";
  else if (t.includes("loyalty") || t.includes("vip") || t.includes("reward")) category = "loyalty";
  else if (t.includes("seasonal") || t.includes("kickoff")) category = "engagement";

  const hasAB      = t.includes("a/b") || t.includes("ab test") || t.includes("variant");
  const hasHoldout = t.includes("holdout") || t.includes("control");
  const stepCount  = Math.max(8, (channels.length * 3) + (hasAB ? 3 : 0) + (hasHoldout ? 1 : 0) + 5);
  return { channels, category, hasAB, hasHoldout, stepCount };
}

function generateJourneyName(text) {
  const t = text.toLowerCase();
  const durationMatch = t.match(/(\d+)[- ]?(day|week|month)/);
  const duration = durationMatch ? `${durationMatch[1]}-${durationMatch[2].charAt(0).toUpperCase() + durationMatch[2].slice(1)}` : null;
  const channels = [];
  if (t.includes("email")) channels.push("Email");
  if (t.includes("sms"))   channels.push("SMS");
  if (t.includes("push"))  channels.push("Push");
  const channelStr = channels.length === 1 ? channels[0] : channels.length > 1 ? "Multi-Channel" : "Email";
  let audience = "";
  if (t.includes("vip") || t.includes("high-value")) audience = "VIP";
  else if (t.includes("new signup") || t.includes("new sign") || t.includes("signup")) audience = "New Signup";
  else if (t.includes("lapsed") || t.includes("inactive") || t.includes("churn") || t.includes("declining") || t.includes("watch time")) audience = "Subscriber";
  else if (t.includes("high propensity") || t.includes("high-propensity")) audience = "High-Propensity";
  else if (t.includes("subscriber")) audience = "Subscriber";
  else if (t.includes("purchas")) audience = "Buyer";
  else if (t.includes("fan")) audience = "Fan";
  let verb = "";
  if (t.includes("win back") || t.includes("winback")) verb = "Win-Back";
  else if (t.includes("re-engage") || t.includes("reengage")) verb = "Re-Engagement";
  else if (t.includes("onboard")) verb = "Onboarding";
  else if (t.includes("upsell") || t.includes("upgrade")) verb = "Upsell";
  else if (t.includes("repeat") || t.includes("repurchase")) verb = "Repeat-Purchase";
  else if (t.includes("retention") || t.includes("retain") || t.includes("churn") || t.includes("declining") || t.includes("watch time")) verb = "Retention";
  else if (t.includes("loyalty") || t.includes("reward")) verb = "Loyalty";
  else if (t.includes("activation") || t.includes("activate")) verb = "Activation";
  else if (t.includes("conversion") || t.includes("convert")) verb = "Conversion";
  else verb = "Engagement";
  const hasAB      = t.includes("a/b") || t.includes("ab test") || t.includes("variant");
  const hasHoldout = t.includes("holdout") || t.includes("control");
  const qualifier  = [hasAB ? "A/B" : null, hasHoldout ? "Holdout" : null].filter(Boolean).join(" + ");
  const parts = [audience, duration, verb, channelStr !== "Email" ? channelStr : null, qualifier || null].filter(Boolean);
  return parts.length >= 2 ? parts.join(" ") : `${verb} ${channelStr} Journey`;
}

function buildPreviewNodes(intent, audienceDesc) {
  const nodes = [];
  nodes.push({ type: "ENTRY",  label: "Enters on audience match", sub: audienceDesc });
  if (intent.hasHoldout) nodes.push({ type: "BRANCH", label: "Holdout gate", sub: "10% exit — no messages" });
  if (intent.hasAB)      nodes.push({ type: "A_B_SPLIT", label: "A/B Split", sub: "50% · 50% random split" });
  intent.channels.forEach((ch, i) => {
    nodes.push({ type: "MESSAGE", label: `${ch}${intent.hasAB ? ` — Variant ${i % 2 === 0 ? "A" : "B"}` : ""}`, sub: `Primary message · Day ${(i + 1) * 2}` });
  });
  nodes.push({ type: "WAIT",   label: `Wait ${intent.channels.length * 2} days`, sub: "Allow late engagement window" });
  nodes.push({ type: "BRANCH", label: "Engagement check?", sub: "Has user clicked or opened in last 48h?" });
  nodes.push({ type: "GOAL",   label: "Goal reached",       sub: "Conversion event detected" });
  nodes.push({ type: "EXIT",   label: "Exit journey",       sub: "End of flow" });
  return nodes;
}

function getJourneyFlow(goalText, intent) {
  const t = goalText.toLowerCase();
  if (t.includes("churn") || t.includes("watch time") || t.includes("retention") || t.includes("declining")) return JOURNEY_FLOWS.churn;
  if (t.includes("signup") || t.includes("onboard") || t.includes("new user")) return JOURNEY_FLOWS.signup;
  return buildPreviewNodes(intent, "Target audience");
}

function getQAData(goalText) {
  const t = goalText.toLowerCase();
  const isChurn = t.includes("churn") || t.includes("watch time") || t.includes("declining") || t.includes("retention");
  if (isChurn) {
    return {
      profiles: [
        { id: "P-001", name: "Sarah M.",  score: 82, metric: "Watch: 12 min/wk", lastSeen: "15 days ago", status: "High risk" },
        { id: "P-002", name: "James K.",  score: 78, metric: "Watch: 8 min/wk",  lastSeen: "22 days ago", status: "High risk" },
        { id: "P-003", name: "Alex T.",   score: 91, metric: "Watch: 5 min/wk",  lastSeen: "30 days ago", status: "Critical" },
        { id: "P-004", name: "Priya R.",  score: 75, metric: "Watch: 20 min/wk", lastSeen: "10 days ago", status: "Moderate" },
      ],
      suites: [
        {
          name: "Entry Criteria Validation",
          cases: [
            { label: "Churn score threshold (≥74) correctly filters eligible subscribers", pass: true },
            { label: "Watch time signal computed from last 30-day window", pass: true },
            { label: "Payment issue flag correctly propagated from billing events", pass: true },
            { label: "Deduplication — profile cannot enter segment more than once per 90 days", pass: true },
          ],
        },
        {
          name: "Journey Flow Validation",
          cases: [
            { label: "Retention email dispatches within 1 hour of segment entry", pass: true },
            { label: "SMS sends exactly 48 hours after email with no open/click", pass: true },
            { label: "Branch: opened/clicked path routes to Loyalty Reward step", pass: true },
            { label: "Branch: inactive path routes to Final Offer step", pass: true },
            { label: "Suppression applied after Final Offer — no messages for 90 days", pass: true },
            { label: "Goal event (subscription renewal) correctly exits journey", pass: false },
          ],
        },
        {
          name: "Channel & Content Checks",
          cases: [
            { label: "Email renders correctly across Gmail, Outlook, Apple Mail", pass: true },
            { label: "Personalisation tokens resolve for all 4 test profiles", pass: true },
            { label: "SMS character limit (160) respected in all variants", pass: true },
            { label: "Unsubscribe link present and functional in email footer", pass: true },
          ],
        },
      ],
    };
  }
  return {
    profiles: [
      { id: "P-001", name: "Emma L.",   score: null, metric: "Account age: 2 days",  lastSeen: "Today",      status: "New signup" },
      { id: "P-002", name: "Noah B.",   score: null, metric: "Account age: 7 days",  lastSeen: "2 days ago", status: "New signup" },
      { id: "P-003", name: "Isla W.",   score: null, metric: "Account age: 14 days", lastSeen: "3 days ago", status: "New signup" },
      { id: "P-004", name: "Liam C.",   score: null, metric: "Account age: 28 days", lastSeen: "1 day ago",  status: "New signup" },
    ],
    suites: [
      {
        name: "Entry Criteria Validation",
        cases: [
          { label: "Account age ≤ 30 days filter correctly applied", pass: true },
          { label: "Email verified flag = true required before entry", pass: true },
          { label: "Profile cannot re-enter onboarding journey after completion", pass: true },
          { label: "Source tag 'new_signup' correctly identified in CDP", pass: true },
        ],
      },
      {
        name: "Journey Flow Validation",
        cases: [
          { label: "Welcome email sends within 30 minutes of account creation", pass: true },
          { label: "Day 2 wait respected before onboarding email dispatches", pass: true },
          { label: "Branch: opened/clicked routes to Feature Highlight path", pass: true },
          { label: "Branch: inactive routes to Re-engagement Nudge path", pass: true },
          { label: "Activation goal event correctly terminates journey", pass: true },
          { label: "Day 5 re-engagement timing matches configuration (±5 min)", pass: false },
        ],
      },
      {
        name: "Channel & Content Checks",
        cases: [
          { label: "Welcome email subject line personalised with [Name] token", pass: true },
          { label: "Feature walkthrough links resolve to correct in-app deep links", pass: true },
          { label: "Onboarding email renders on mobile (320px) without overflow", pass: true },
          { label: "Unsubscribe honoured — no further messages after opt-out", pass: true },
        ],
      },
    ],
  };
}

function getMeasurementPlan(goalText) {
  const t = goalText.toLowerCase();
  if (t.includes("churn") || t.includes("watch time") || t.includes("retention") || t.includes("declining")) {
    return {
      kpis: [
        { name: "Reactivation rate",    target: "> 15%",   tracking: "Subscription events"  },
        { name: "Churn rate reduction", target: "−20%",    tracking: "Cancellation signals" },
        { name: "Watch time recovery",  target: "+40%",    tracking: "Viewing analytics"    },
        { name: "Campaign ROI",         target: "> 3:1",   tracking: "Revenue attribution"  },
        { name: "Email response rate",  target: "> 20%",   tracking: "Email engagement"     },
      ],
      signals: ["Email opens", "SMS responses", "App re-launch", "Subscription renewal"],
    };
  }
  return {
    kpis: [
      { name: "Email open rate",      target: "> 35%",    tracking: "Email engagement"    },
      { name: "Click-through rate",   target: "> 8%",     tracking: "Email engagement"    },
      { name: "Feature adoption",     target: "> 25%",    tracking: "Product analytics"   },
      { name: "30-day retention",     target: "> 70%",    tracking: "Subscription status" },
      { name: "Time to first value",  target: "< 3 days", tracking: "Product events"      },
    ],
    signals: ["App login", "Feature usage", "Email clicks", "Profile completion"],
  };
}

function getHardcodedAudience(goalText) {
  const t = goalText.toLowerCase();
  if (t.includes("churn") || t.includes("watch time") || t.includes("declining") || t.includes("retention")) {
    return {
      name: "Subscribers showing churn signals",
      description: "Customers exhibiting early churn indicators including declining watch time, reduced notification engagement, or payment-related issues over the past 30 days.",
      criteria: [
        { field: "Churn Score",         operator: "≥", value: "74"             },
        { field: "Watch Minutes (30D)", operator: "≤", value: "Low threshold"  },
        { field: "Engagement Rate",     operator: "≤", value: "Low threshold"  },
      ],
      stats: { total: 245000, target: 18400, coverage: 7.5 },
    };
  }
  return {
    name: "New user signups in last 30 days",
    description: "Recently registered users who have verified their email address and created an account within the last 30 days, eligible for onboarding campaigns.",
    criteria: [
      { field: "Account Age",    operator: "≤", value: "30 days" },
      { field: "Email Verified", operator: "=", value: "true"    },
    ],
    stats: { total: 245000, target: 12800, coverage: 5.2 },
  };
}

function getBlueprintStrategy(goalText) {
  const t = goalText.toLowerCase();
  if (t.includes("churn") || t.includes("watch time") || t.includes("declining") || t.includes("retention")) {
    return [
      "Identify subscribers with churn probability score ≥ 74 using predictive signals from watch time, engagement rate, and payment history.",
      "Activate a multi-channel retention sequence starting with a personalised email offer, followed by an SMS nudge after 2 days of no response.",
      "Branch logic routes highly engaged users to a loyalty reward path, while inactive users receive a final conversion offer before suppression.",
      "Suppress churned users from further messaging for 90 days to protect sender reputation and reduce unsubscribe rates.",
    ];
  }
  return [
    "Target newly verified accounts created within the last 30 days to maximise activation during the highest-intent window.",
    "Deliver a sequenced onboarding series over 5 days, introducing the core product value proposition at each step.",
    "Branch engagement check at Day 5 to separate active explorers from passive signups, applying tailored follow-up strategies to each path.",
    "Measure activation via the first meaningful product action (feature use, content play, or purchase) within 3 days of signup.",
  ];
}

function buildJourneyCanvasData(flowNodes) {
  const LANE_DEFS = [
    { id: "trigger",  label: "TRIGGER",    color: "#2680EB" },
    { id: "email",    label: "EMAIL",      color: "#C89B3C" },
    { id: "push",     label: "SMS / PUSH", color: "#F59E0B" },
    { id: "decision", label: "DECISION",   color: "#8B5CF6" },
    { id: "exit",     label: "EXIT",       color: "#22C55E" },
  ];
  const LANE_ORDER = ["trigger", "email", "push", "decision", "exit"];
  const LANE_H = 108, NODE_H = 68, NODE_W = 172, COL_W = 228;
  const LANE_LBL_W = 64, PAD_T = 28, PAD_B = 20;

  const typeToLane = (fn, isPathB) => {
    switch (fn.type) {
      case "ENTRY":     return { lane: "trigger",  kind: "start",    accent: "#2680EB" };
      case "WAIT":      return { lane: "decision", kind: "wait",     accent: "#64748b" };
      case "BRANCH":
      case "A_B_SPLIT": return { lane: "decision", kind: "decision", accent: "#8B5CF6" };
      case "GOAL":      return { lane: "exit",     kind: "end",      accent: "#22C55E" };
      case "EXIT":      return { lane: "exit",     kind: "endDashed",accent: "#ef4444" };
      case "MESSAGE": {
        const l = (fn.label || "").toLowerCase();
        const isSMS = l.includes("sms") || l.includes("text") || l.includes("alert") || l.includes("nudge") || isPathB;
        return { lane: isSMS ? "push" : "email", kind: "action", accent: isSMS ? "#F59E0B" : "#C89B3C" };
      }
      default: return { lane: "trigger", kind: "action", accent: "#64748b" };
    }
  };

  const brIdx = flowNodes.findIndex(n => n.type === "BRANCH" || n.type === "A_B_SPLIT");
  const hasBranch = brIdx >= 0;
  const afterBr = hasBranch ? flowNodes.slice(brIdx + 1) : [];
  const pathA = afterBr.filter((_, i) => i % 2 === 0);
  const pathB = afterBr.filter((_, i) => i % 2 === 1);
  const preFn = hasBranch ? flowNodes.slice(0, brIdx + 1) : flowNodes;

  const usedLanes = new Set();
  const tempNodes = [];
  preFn.forEach((fn, i) => {
    const ti = typeToLane(fn, false); usedLanes.add(ti.lane);
    tempNodes.push({ id: `n${i}`, fn, ...ti, col: i });
  });
  pathA.forEach((fn, j) => {
    const ti = typeToLane(fn, false); usedLanes.add(ti.lane);
    tempNodes.push({ id: `n${brIdx + 1 + j * 2}`, fn, ...ti, col: brIdx + 1 + j });
  });
  pathB.forEach((fn, j) => {
    const ti = typeToLane(fn, true); usedLanes.add(ti.lane);
    tempNodes.push({ id: `n${brIdx + 2 + j * 2}`, fn, ...ti, col: brIdx + 1 + j });
  });

  const lanes = LANE_ORDER.filter(id => usedLanes.has(id)).map(id => LANE_DEFS.find(l => l.id === id));
  const laneIdxMap = Object.fromEntries(lanes.map((l, i) => [l.id, i]));
  const getNodeY = (laneId) => PAD_T + laneIdxMap[laneId] * LANE_H + (LANE_H - NODE_H) / 2;

  const colLaneCount = {};
  const nodes = tempNodes.map(tn => {
    const key = `${tn.col}:${tn.lane}`;
    colLaneCount[key] = (colLaneCount[key] || 0) + 1;
    const offsetY = (colLaneCount[key] - 1) * (NODE_H + 10);
    return {
      id: tn.id, type: tn.fn.type, label: tn.fn.label, sub: tn.fn.sub,
      lane: tn.lane, kind: tn.kind, accent: tn.accent, col: tn.col,
      x: LANE_LBL_W + tn.col * COL_W,
      y: getNodeY(tn.lane) + offsetY,
    };
  });

  const edges = [];
  for (let i = 1; i < preFn.length; i++) edges.push({ id: `e${i-1}`, f: `n${i-1}`, t: `n${i}`, tp: "flow" });
  if (hasBranch) {
    if (pathA[0]) edges.push({ id: "ey", f: `n${brIdx}`, t: `n${brIdx+1}`, tp: "yes", lbl: "Engaged" });
    if (pathB[0]) edges.push({ id: "en", f: `n${brIdx}`, t: `n${brIdx+2}`, tp: "no",  lbl: "Inactive" });
    for (let j = 1; j < pathA.length; j++) edges.push({ id: `eA${j}`, f: `n${brIdx+1+(j-1)*2}`, t: `n${brIdx+1+j*2}`, tp: "flow" });
    for (let j = 1; j < pathB.length; j++) edges.push({ id: `eB${j}`, f: `n${brIdx+2+(j-1)*2}`, t: `n${brIdx+2+j*2}`, tp: "flow" });
  }

  const maxCol = Math.max(...nodes.map(n => n.col));
  const totalW = LANE_LBL_W + (maxCol + 1) * COL_W + 36;
  const totalH = PAD_T + lanes.length * LANE_H + PAD_B;
  return { nodes, edges, lanes, totalW, totalH, NODE_W, NODE_H, LANE_H, LANE_LBL_W, PAD_T };
}

function getChannelPlan(intent, goalText) {
  const t = goalText.toLowerCase();
  const isChurn = t.includes("churn") || t.includes("watch time") || t.includes("declining");
  const plans = {
    Email:    isChurn ? "Primary retention channel. Delivers a personalised win-back offer with dynamic content based on the subscriber's viewing history and engagement profile." : "Primary onboarding channel. Delivers a sequenced welcome series introducing key features and guiding the user to their first value moment.",
    SMS:      isChurn ? "Urgency nudge sent 2 days after the initial email if no engagement is detected. Short-form message with direct CTA to the app." : "Activation reminder sent to users who have not opened the welcome email within 48 hours.",
    Push:     isChurn ? "Re-engagement push for users who still have the app installed but have not responded to email or SMS." : "Welcome push on first app open, surfacing the most-used features for new accounts.",
    "In-App": isChurn ? "Targeted in-app banner shown on next app session, offering a retention incentive to users flagged as high churn risk." : "First-session tooltip tour triggered on next login, guiding the user through the core onboarding flow.",
  };
  return (intent?.channels || []).map((ch) => ({ channel: ch, description: plans[ch] || "Channel activated for this journey." }));
}

function getCreativeSamples(goalText, channels) {
  const t = goalText.toLowerCase();
  const isChurn = t.includes("churn") || t.includes("watch time") || t.includes("declining");
  const subjectLines = {
    Email:    isChurn ? "We miss you — here's something special" : "[Name], your journey starts here",
    SMS:      isChurn ? "Your subscription matters to us" : "Welcome! Get started in 2 minutes",
    Push:     isChurn ? "Come back — exclusive offer inside" : "Your account is ready — explore now",
    "In-App": isChurn ? "We've saved something for you" : "Welcome to your new experience",
  };
  return channels.map((ch) => ({
    channel: ch,
    subjectLine: subjectLines[ch] || "Message ready",
    template: "hero-banner",
    status: "Creative ready",
  }));
}

function pickBaseJourney(category) {
  const pref = {
    reengagement: ["lapsed-fan-winback-journey", "attendance-recovery-journey"],
    onboarding:   ["new-fan-onboarding-journey", "fuel-fans-integrate-new-fans"],
    conversion:   ["season-ticket-upsell-journey", "merch-shopping"],
    loyalty:      ["fan-loyalty-anniversary-journey"],
    engagement:   ["game-day-engagement-journey", "season-kickoff-engagement-journey"],
  }[category] || [];
  for (const slug of pref) {
    const found = getJourneyBySlug(slug);
    if (found) return found;
  }
  return PRECONFIGURED_JOURNEYS[0];
}

function buildAIJourneyRecord({ name, slug, goal, intent, audienceDesc }) {
  const base = pickBaseJourney(intent.category);
  return {
    ...base,
    slug, name,
    isPreset: false, active: true, status: "READY",
    categoryId: "ai-generated", categoryName: "AI Generated",
    subCategoryId: "ai-generated", subCategoryName: "AI Generated",
    clientTag: "ai", _aiGenerated: true,
    _aiGoal: goal, _aiGeneratedAt: new Date().toISOString(),
    blueprintForm: { ...(base.blueprintForm || {}), brief: goal, journeyCategory: "ai-generated", journeyType: slug, orchestrationType: "journey" },
    journeyForm: { ...(base.journeyForm || {}), name, objective: goal, audience: audienceDesc, channels: { email: intent.channels.includes("Email"), push: intent.channels.includes("Push"), sms: intent.channels.includes("SMS"), inApp: intent.channels.includes("In-App") } },
  };
}

function saveJourneyToStorage(record) {
  storeJourney(record);
}

function buildClarifyingMessage(goalText) {
  const t = goalText.toLowerCase();
  const q1 = t.includes("signup")
    ? "How are 'new signups' represented in your CDP? (e.g., tag like \"new_signup\", a specific source value, or a trigger event)"
    : t.includes("churn") || t.includes("lapsed") || t.includes("declining")
    ? "How do you define 'lapsed'? (e.g., no purchase in 90 days, no login in 60 days)"
    : "Who is the primary audience? (e.g., a tag, a segment, or an event condition)";
  const q2 = t.includes("a/b") || t.includes("variant")
    ? "What is the primary conversion you want to optimize for? (e.g., first login, click, first purchase)"
    : "What is the primary success metric? (e.g., click rate, conversion, revenue)";
  const q3 = t.includes("email only") || t.includes("email ony") ? null
    : "Which channels can we use besides email? (select any: sms, push, in_app — or reply 'email only')";
  return [q1, q2, q3].filter(Boolean).map((q, i) => `${i + 1}. ${q}`).join("\n");
}

const JC_API = "/jc-api";

/* SVG icon helpers */
const IconCheck = ({ size = 10, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const IconWarn = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const IconCircle = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
  </svg>
);
const IconSend = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);
const IconSpinner = ({ size = 15 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", animation: "ap-spin 0.7s linear infinite", flexShrink: 0 }} />
);
const IconCopilot = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
export default function AutopilotPage() {
  const navigate = useNavigate();

  const [messages, setMessages] = useState([{
    role: "ai",
    text: "I'm Journey Autopilot. Tell me the campaign goal in one line and I'll build the whole thing end to end — the target audience, the cross-channel journey, quality checks, and measurement.\n\nIf I need a detail or two, I'll ask first.",
  }]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("idle");
  const [stepProgresses, setStepProgresses] = useState({});
  const [completedSteps, setCompletedSteps] = useState([]);
  const [activeStep, setActiveStep] = useState(null);
  const [goalText, setGoalText] = useState("");
  const [journeyRecord, setJourneyRecord] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qaWarnings] = useState(4);
  const messagesEndRef = useRef(null);

  const [clarifyingQuestions, setClarifyingQuestions] = useState([]);
  const [clarifyingAnswers, setClarifyingAnswers] = useState({});
  const [clarifyingConfirmed, setClarifyingConfirmed] = useState(false);
  const [useChatFallback, setUseChatFallback] = useState(false);
  const [jcRunId, setJcRunId] = useState(null);
  const [audienceSegment, setAudienceSegment] = useState(null);
  const [clarifyingLoading, setClarifyingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("workflow");
  const [copilotInput, setCopilotInput] = useState("");
  const [briefApproved, setBriefApproved] = useState(false);
  const [audienceSubTab, setAudienceSubTab] = useState("definition");
  const [blueprintApproved, setBlueprintApproved] = useState(false);
  const [audienceApproved, setAudienceApproved] = useState(false);
  const [qaApproved, setQaApproved] = useState(false);
  const [pipelineGate, setPipelineGate] = useState(null); // 'blueprint' | 'audience' | null
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const blueprintApprovalRef = useRef(null);
  const audienceApprovalRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (phase === "building") setActiveTab("workflow");
  }, [phase]);

  function addAiMessage(text, delay = 700) {
    return new Promise((resolve) => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [...prev, { role: "ai", text }]);
        resolve();
      }, delay);
    });
  }

  async function runStep(step) {
    setActiveStep(step.id);
    setStepProgresses((prev) => ({ ...prev, [step.id]: 0 }));
    const tickInterval = 100;
    const totalTicks   = step.durationMs / tickInterval;
    let tick = 0;
    await new Promise((resolve) => {
      const timer = setInterval(() => {
        tick++;
        const eased = Math.min(100, Math.round(100 * (1 - Math.pow(1 - tick / totalTicks, 2.2))));
        setStepProgresses((prev) => ({ ...prev, [step.id]: eased }));
        if (tick >= totalTicks) { clearInterval(timer); setStepProgresses((prev) => ({ ...prev, [step.id]: 100 })); resolve(); }
      }, tickInterval);
    });
    setCompletedSteps((prev) => [...prev, step.id]);
    setActiveStep(null);
    await new Promise((r) => setTimeout(r, 180));
  }

  function waitForGate(ref) {
    return new Promise((resolve) => { ref.current = resolve; });
  }

  async function runPipeline(intent, name, audienceDesc, slug, goal) {
    const record = buildAIJourneyRecord({ name, slug, goal, intent, audienceDesc });

    // Step 1: Blueprint — then pause for user approval (show popup)
    await runStep(PIPELINE_STEPS[0]);
    setPipelineGate("blueprint");
    setShowBlueprintModal(true);
    await addAiMessage(
      `The Campaign Blueprint is ready for review. Approve it in the popup to continue.`,
      400
    );
    await waitForGate(blueprintApprovalRef);
    setPipelineGate(null);

    // Step 2: Audience — then pause for user approval (show popup)
    await runStep(PIPELINE_STEPS[1]);
    setPipelineGate("audience");
    setShowAudienceModal(true);
    await addAiMessage(
      `Audience segment qualified. Approve it in the popup to proceed.`,
      400
    );
    await waitForGate(audienceApprovalRef);
    setPipelineGate(null);

    // Steps 3-4: creative, journey_brief
    for (let i = 2; i < PIPELINE_STEPS.length; i++) await runStep(PIPELINE_STEPS[i]);

    saveJourneyToStorage(record);
    setJourneyRecord(record);
    setPhase("done");
    setActiveTab("workflow");
    await addAiMessage(
      `Journey built. Running QA automation and analytics setup now — review results in the QA Automation tab, then approve to unlock Launch.`,
      400
    );

    // Run post-pipeline steps (QA + Analytics) animated
    for (const step of POST_STEPS) await runStep(step);
    await addAiMessage(
      `QA automation complete — ${record.name || name} passed all entry, flow, and channel checks with one advisory. Review the QA tab and approve to enable Launch.`,
      500
    );
  }

  function handleBlueprintApprove() {
    setBlueprintApproved(true);
    setShowBlueprintModal(false);
    blueprintApprovalRef.current?.();
    setActiveTab("workflow");
  }

  function handleAudienceApprove() {
    setAudienceApproved(true);
    setShowAudienceModal(false);
    audienceApprovalRef.current?.();
    setActiveTab("workflow");
  }

  function handleStartOver() {
    setPhase("idle");
    setMessages([{
      role: "ai",
      text: "I'm Journey Autopilot. Tell me the campaign goal in one line and I'll build the whole thing end to end — the target audience, the cross-channel journey, quality checks, and measurement.\n\nIf I need a detail or two, I'll ask first.",
    }]);
    setInput("");
    setGoalText("");
    setStepProgresses({});
    setCompletedSteps([]);
    setActiveStep(null);
    setJourneyRecord(null);
    setClarifyingQuestions([]);
    setClarifyingAnswers({});
    setClarifyingConfirmed(false);
    setUseChatFallback(false);
    setJcRunId(null);
    setAudienceSegment(null);
    setActiveTab("workflow");
    setBriefApproved(false);
    setBlueprintApproved(false);
    setAudienceApproved(false);
    setQaApproved(false);
    setPipelineGate(null);
    setShowBlueprintModal(false);
    setShowAudienceModal(false);
    setAudienceSubTab("definition");
  }

  function handleSaveJourney(status) {
    if (!journeyRecord) return;
    const hardAud     = goalText ? getHardcodedAudience(goalText) : null;
    const measurement = goalText ? getMeasurementPlan(goalText) : null;
    const parsedIntent = goalText ? parseGoalIntent(goalText) : null;
    const fNodes      = goalText && parsedIntent ? getJourneyFlow(goalText, parsedIntent) : null;
    const tCount      = audienceSegment?.member_count ?? hardAud?.stats.target ?? 0;
    const totCount    = audienceSegment?.total        ?? hardAud?.stats.total  ?? 0;
    const record = {
      ...journeyRecord,
      status,
      active: status === "Active",
      activated_at: status === "Active" ? new Date().toISOString().split("T")[0] : null,
      audience: hardAud ? {
        segment_id:   "ai-generated",
        segment_name: hardAud.name,
        description:  hardAud.description,
        size:         tCount,
        criteria:     hardAud.criteria,
        coverage_pct: hardAud.stats.coverage,
      } : (journeyRecord.audience || null),
      _savedAt:         new Date().toISOString(),
      _savedStatus:     status,
      _audienceData:    hardAud ? { ...hardAud, stats: { ...hardAud.stats, target: tCount, total: totCount } } : null,
      _measurementData: measurement,
      _flowNodes:       fNodes,
      _channels:        parsedIntent?.channels || [],
    };
    storeJourney(record);
    navigate("/campaigns-and-journeys");
  }

  async function pollForAudienceData(runId) {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`${JC_API}/runs/${encodeURIComponent(runId)}`);
        if (!res.ok) continue;
        const run = await res.json();
        const seg = run?.artifacts?.audience_segment_report;
        if (seg && seg.qualified_audience !== undefined) {
          setAudienceSegment({
            member_count: seg.qualified_audience,
            total: seg.total_customers,
            coverage_pct: seg.coverage_pct,
            columns: seg.recommended_channels ?? [],
            title: seg.title,
            description: seg.description,
          });
          return;
        }
        if (run?.status === "complete" || run?.status === "rejected") return;
      } catch { /* non-fatal */ }
    }
  }

  function deriveAudienceDesc(combinedText) {
    const t = combinedText.toLowerCase();
    if (t.includes("signup")) return "New signups (email present)";
    if (t.includes("churn") || t.includes("lapsed") || t.includes("declining") || t.includes("watch time")) return "Subscribers showing churn signals";
    if (t.includes("vip")) return "High-value VIP customers";
    if (t.includes("subscriber")) return "Active subscribers approaching renewal";
    return "Active customers matching criteria";
  }

  async function handleBuildCampaign() {
    setClarifyingConfirmed(true);
    const intent      = parseGoalIntent(goalText);
    const name        = generateJourneyName(goalText);
    const slug        = `ai-generated-${Date.now()}`;
    const combined    = goalText + " " + Object.values(clarifyingAnswers).join(" ");
    if (combined.toLowerCase().includes("email only")) { intent.channels.length = 0; intent.channels.push("Email"); }
    const audienceDesc = deriveAudienceDesc(combined);

    const answerLines = clarifyingQuestions
      .filter((q) => clarifyingAnswers[q.id])
      .map((q) => `• ${q.question}: **${clarifyingAnswers[q.id]}**`)
      .join("\n");
    await addAiMessage(
      `Got it. Here's what I'll build:\n\n${answerLines}\n\nStarting now — defining audience, building the journey, running QA, and setting up measurement.`,
      500
    );
    setPhase("building");

    try {
      const clarifications = clarifyingQuestions.map((q) => ({
        question_id: q.id,
        question: q.question,
        answer: clarifyingAnswers[q.id] ?? (q.options?.[0] ?? ""),
      }));
      const res = await fetch(`${JC_API}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: goalText, clarifications }),
      });
      if (res.ok) {
        const data = await res.json();
        setJcRunId(data.run_id);
        pollForAudienceData(data.run_id);
      }
    } catch { /* non-fatal */ }

    await runPipeline(intent, name, audienceDesc, slug, goalText);
  }

  async function handleSubmit(text) {
    const trimmed = (text || input).trim();
    if (!trimmed) return;
    setInput("");
    setIsProcessing(true);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);

    if (phase === "idle") {
      setGoalText(trimmed);
      setPhase("clarifying");
      setClarifyingLoading(true);

      try {
        const res = await fetch(`${JC_API}/campaign/clarifications`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed }),
        });
        if (!res.ok) throw new Error("API unavailable");
        const data = await res.json();
        setClarifyingQuestions(data.questions || []);
        setClarifyingLoading(false);
        setIsProcessing(false);
        setMessages((prev) => [...prev, {
          role: "ai",
          text: "I have a few questions to tailor this campaign precisely. Please select your preferences.",
        }]);
      } catch {
        setClarifyingLoading(false);
        setUseChatFallback(true);
        await addAiMessage(`I need to know a few things to build this precisely:\n\n${buildClarifyingMessage(trimmed)}`, 950);
        setIsProcessing(false);
      }
    } else if (phase === "clarifying" && useChatFallback) {
      const intent   = parseGoalIntent(goalText);
      const name     = generateJourneyName(goalText);
      const slug     = `ai-generated-${Date.now()}`;
      const combined = (goalText + " " + trimmed).toLowerCase();
      if (combined.includes("email only") || combined.includes("email ony")) { intent.channels.length = 0; intent.channels.push("Email"); }
      const audienceDesc = deriveAudienceDesc(combined);
      const catLabels = { reengagement: "re-engagement", onboarding: "onboarding", conversion: "conversion", loyalty: "loyalty", engagement: "engagement" };
      await addAiMessage(
        `${intent.channels.join(", ").toLowerCase()} ${catLabels[intent.category] || "journey"}${intent.hasAB ? " that A/B tests the primary message (50/50 split)" : ""}. ${intent.hasHoldout ? "Includes a 10% holdout control group. " : ""}Building it now — audience, journey, QA, and measurement.`,
        750
      );
      setIsProcessing(false);
      setPhase("building");
      await runPipeline(intent, name, audienceDesc, slug, goalText);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }

  const intent     = goalText ? parseGoalIntent(goalText) : null;
  const stepStatus = (id) => completedSteps.includes(id) ? "done" : activeStep === id ? "active" : "idle";

  function chipStatus(chipId) {
    if (chipId === "blueprint_gate") {
      if (blueprintApproved) return "done";
      if (completedSteps.includes("blueprint")) return "needs-approval";
      return "idle";
    }
    if (chipId === "audience_gate") {
      if (audienceApproved) return "done";
      if (blueprintApproved && completedSteps.includes("audience")) return "needs-approval";
      return "idle";
    }
    return stepStatus(chipId);
  }

  const ALL_WORKFLOW_CHIPS = [
    { id: "blueprint",       label: "Blueprint",           sub: PIPELINE_STEPS[0].sub, type: "step"  },
    { id: "blueprint_gate",  label: "Blueprint approval",  sub: "",                     type: "gate"  },
    { id: "audience",        label: "Audience & Segments", sub: PIPELINE_STEPS[1].sub, type: "step"  },
    { id: "audience_gate",   label: "Audience approval",   sub: "",                     type: "gate"  },
    { id: "creative",        label: "Creative set",          sub: PIPELINE_STEPS[2].sub, type: "step"  },
    { id: "journey_brief",   label: "Journey build & brief", sub: PIPELINE_STEPS[3].sub, type: "step"  },
    { id: "qa_run",          label: "QA automation",        sub: POST_STEPS[0].sub,      type: "step"  },
    { id: "analytics",       label: "Analytics",            sub: POST_STEPS[1].sub,      type: "step"  },
  ];

  /* ══════════════════════════════════════════
     WORKSPACE — building or done
  ══════════════════════════════════════════ */
  if (phase === "building" || phase === "done") {
    const derivedName  = journeyRecord?.name || (goalText ? generateJourneyName(goalText) : "Building...");
    const flowNodes    = goalText && intent ? getJourneyFlow(goalText, intent) : null;
    const measurement  = goalText ? getMeasurementPlan(goalText) : null;
    const hardAudience = goalText ? getHardcodedAudience(goalText) : null;
    const creatives    = intent   ? getCreativeSamples(goalText, intent.channels) : [];
    const strategy     = goalText ? getBlueprintStrategy(goalText) : [];
    const channelPlan  = intent   ? getChannelPlan(intent, goalText) : [];

    const TABS = [
      {
        id: "workflow", label: "Workflow",
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
      },
      {
        id: "blueprint", label: "Campaign Blueprint",
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
      },
      {
        id: "audience", label: "Audience & Segments",
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
      },
      {
        id: "creative", label: "Creative Sets",
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
      },
      {
        id: "measurement", label: "Measurement",
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
      },
      {
        id: "journey_flow", label: "Journey Workflow",
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
      },
      {
        id: "qa", label: "QA Automation",
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
      },
      {
        id: "launch", label: "Launch",
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/></svg>,
      },
    ];

    const isBuilding = phase === "building";
    const qaData     = goalText ? getQAData(goalText) : null;
    const targetCount = audienceSegment?.member_count ?? hardAudience?.stats.target ?? 0;
    const totalCount  = audienceSegment?.total        ?? hardAudience?.stats.total  ?? 0;
    const canvasData = flowNodes ? buildJourneyCanvasData(flowNodes) : null;

    return (
      <div className="ap-workspace">

        {/* ── Workspace header ── */}
        <div className="ap-ws-header">
          <button className="ap-back-link ap-ws-back" onClick={() => navigate("/overview")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back to journeys
          </button>
          <div className="ap-ws-title-block">
            <span className="ap-ws-label">AGENTIC WORKFLOW</span>
            <div className="ap-ws-title">{derivedName}</div>
          </div>
          <div className="ap-ws-header-meta">
            <span className="ap-ws-live-pill"><span className="ap-ready-dot" />Live</span>
            <span className="ap-ws-status-pill">{isBuilding ? "Building" : "Complete"}</span>
            <button className="ap-launch-btn-sm" style={{ marginLeft: 8 }} onClick={() => navigate("/autopilot")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/></svg>
              Start Over
            </button>
            <button className="ap-launch-btn-sm danger" style={{ marginLeft: 6 }} onClick={() => navigate("/autopilot")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
              Discard
            </button>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="ap-ws-tabs">
          {TABS.map((t) => {
            const gateLockedBlueprint = pipelineGate === "blueprint" && !["workflow","blueprint"].includes(t.id);
            const gateLockedAudience  = pipelineGate === "audience"  && !["workflow","audience"].includes(t.id);
            const buildingLocked      = isBuilding && t.id !== "workflow" && pipelineGate === null;
            const launchLocked        = t.id === "launch" && !qaApproved;
            const disabled = buildingLocked || gateLockedBlueprint || gateLockedAudience || launchLocked;
            return (
              <button
                key={t.id}
                className={`ap-ws-tab ${activeTab === t.id ? "active" : ""} ${disabled ? "ap-ws-tab-disabled" : ""} ${t.id === "launch" && qaApproved ? "ap-ws-tab-launch" : ""}`}
                onClick={() => { if (!disabled) setActiveTab(t.id); }}
                title={launchLocked ? "Approve QA to unlock Launch" : undefined}
              >
                {t.icon}{t.label}
                {t.id === "launch" && !qaApproved && <span className="ap-tab-lock">🔒</span>}
              </button>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div className="ap-ws-body">

          {/* Left: copilot chat */}
          <div className="ap-copilot-sidebar">
            <div className="ap-copilot-title">
              <IconCopilot />
              Journey copilot
            </div>
            <div className="ap-copilot-sub">Ask about this journey, or act on what needs you</div>

            <div className="ap-copilot-suggested">
              <div className="ap-copilot-suggested-label">SUGGESTED</div>
              {["Summarize the brief", "What are the measurement criteria?", "Show audience breakdown"].map((s) => (
                <button key={s} className="ap-copilot-suggestion" onClick={() => setCopilotInput(s)}>{s}</button>
              ))}
            </div>

            <div className="ap-copilot-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`ap-msg ${msg.role === "user" ? "user" : ""}`}>
                  <div className="ap-msg-avatar">
                    {msg.role === "ai" ? <IconCopilot size={12} /> : "U"}
                  </div>
                  <div className="ap-msg-bubble">
                    {msg.text.split("\n").map((line, j) => <p key={j}>{line}</p>)}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="ap-copilot-input-row">
              <input
                className="ap-copilot-input"
                placeholder="Ask about this journey…"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && copilotInput.trim()) setCopilotInput(""); }}
              />
              <button className="ap-chat-send" style={{ flexShrink: 0, width: 32, height: 32 }} disabled={!copilotInput.trim()}>
                <IconSend />
              </button>
            </div>
          </div>

          {/* Main: tab content */}
          <div className="ap-ws-main">

            {/* ── WORKFLOW TAB ── */}
            {activeTab === "workflow" && (
              <div className="ap-ws-tab-content">
                <div className="ap-wf-layout">

                  {/* Right: chips only (full width now — no plan card) */}
                  <div className="ap-wf-right" style={{ flex: 1 }}>

                    {/* Step chips */}
                    <div className="ap-ws-card">
                      <div className="ap-ws-card-title">Autopilot Campaign Workflow</div>
                      <div className="ap-wf-chips">

                        {ALL_WORKFLOW_CHIPS.map((chip, chipIdx) => {
                          const st = chipStatus(chip.id);
                          const isGate = chip.type === "gate";
                          const isLast = chipIdx === ALL_WORKFLOW_CHIPS.length - 1;
                          return (
                            <div key={chip.id} className="ap-wf-chip-row">
                              <div className={`ap-wf-chip ${st}`}>
                                <div className="ap-wf-chip-icon">
                                  {st === "done"           && <IconCheck />}
                                  {st === "active"         && <div className="ap-step-spinner" style={{ width: 9, height: 9, borderWidth: 2 }} />}
                                  {st === "needs-approval" && <IconWarn />}
                                  {st === "idle"           && <IconCircle />}
                                </div>
                                <div className="ap-wf-chip-body">
                                  <div className="ap-wf-chip-label">{chip.label}</div>
                                  <div className="ap-wf-chip-sub">
                                    {st === "done"            ? (isGate ? "Approved" : "Done")
                                     : st === "active"        ? chip.sub
                                     : st === "needs-approval" ? "Awaiting review"
                                     : "Pending"}
                                  </div>
                                </div>
                              </div>
                              {!isLast && (
                                <div className="ap-wf-chip-arrow">
                                  <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                                    <line x1="5" y1="0" x2="5" y2="10" stroke={st === "done" ? "#3b82f6" : "var(--border)"} strokeWidth="1.5"/>
                                    <path d="M1 7 L5 12 L9 7" stroke={st === "done" ? "#3b82f6" : "var(--border)"} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Inline approval gate cards ── */}
                    {pipelineGate === "blueprint" && (
                      <div className="ap-gate-card ap-gate-card--blueprint">
                        <div className="ap-gate-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                        </div>
                        <div className="ap-gate-body">
                          <div className="ap-gate-title">Blueprint ready for review</div>
                          <div className="ap-gate-sub">Review the Campaign Blueprint tab — strategy, channel plan, and measurement framework. Approve to proceed with audience segmentation.</div>
                        </div>
                        <div className="ap-gate-actions">
                          <button className="ap-gate-view-btn" onClick={() => setActiveTab("blueprint")}>View Blueprint →</button>
                          <button className="ap-gate-approve-btn" onClick={handleBlueprintApprove}>Approve Blueprint</button>
                        </div>
                      </div>
                    )}

                    {pipelineGate === "audience" && (
                      <div className="ap-gate-card ap-gate-card--audience">
                        <div className="ap-gate-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                        </div>
                        <div className="ap-gate-body">
                          <div className="ap-gate-title">Audience segment qualified</div>
                          <div className="ap-gate-sub">Review segment criteria, coverage, and definition in the Audience & Segments tab. Approve to begin creative generation and journey build.</div>
                        </div>
                        <div className="ap-gate-actions">
                          <button className="ap-gate-view-btn" onClick={() => setActiveTab("audience")}>View Audience →</button>
                          <button className="ap-gate-approve-btn" onClick={handleAudienceApprove}>Approve Audience</button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}

            {/* ── CAMPAIGN BLUEPRINT TAB ── */}
            {activeTab === "blueprint" && (!isBuilding || pipelineGate === "blueprint" || blueprintApproved) && (
              <div className="ap-ws-tab-content">
                <div className="ap-ws-card">
                  <div className="ap-ws-card-title">
                    Campaign Blueprint
                    <span className="ap-bp-pill" style={{ textTransform: "capitalize", marginLeft: 8 }}>{intent?.category}</span>
                    {intent?.channels.map((ch) => <span key={ch} className="ap-bp-ch" style={{ marginLeft: 4 }}>{ch}</span>)}
                  </div>
                  <div className="ap-bp-name" style={{ fontSize: 20, marginBottom: 8 }}>{journeyRecord?.name}</div>
                  <div className="ap-bp-desc">
                    {(journeyRecord?.journeyForm?.objective || journeyRecord?.blueprintForm?.brief || goalText || "").slice(0, 500)}
                  </div>
                </div>

                {/* Q&A summary */}
                {clarifyingQuestions.filter((q) => clarifyingAnswers[q.id]).length > 0 && (
                  <div className="ap-ws-card">
                    <div className="ap-ws-card-title">Campaign Q&amp;A</div>
                    <div className="ap-clarify-summary-grid">
                      {clarifyingQuestions.filter((q) => clarifyingAnswers[q.id]).map((q) => (
                        <div key={q.id} className="ap-clarify-summary-row">
                          <div className="ap-clarify-summary-q">{q.question}</div>
                          <div className="ap-clarify-summary-a">{clarifyingAnswers[q.id]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Blueprint strategy */}
                <div className="ap-ws-card">
                  <div className="ap-ws-card-title">Blueprint Strategy</div>
                  <ul className="ap-bp-strategy-list">
                    {strategy.map((point, i) => (
                      <li key={i} className="ap-bp-strategy-item">
                        <span className="ap-bp-strategy-bullet" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Channel plan */}
                <div className="ap-ws-card">
                  <div className="ap-ws-card-title">Channel Plan</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {channelPlan.map((cp) => (
                      <div key={cp.channel} className="ap-bp-channel-row">
                        <span className="ap-bp-ch" style={{ flexShrink: 0 }}>{cp.channel}</span>
                        <span className="ap-bp-channel-desc">{cp.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Measurement framework preview */}
                {measurement && (
                  <div className="ap-ws-card">
                    <div className="ap-ws-card-title">Measurement Framework</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {measurement.kpis.slice(0, 4).map((kpi) => (
                        <div key={kpi.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                          <span style={{ fontWeight: 600, minWidth: 180 }}>{kpi.name}</span>
                          <span style={{ color: "var(--accent)", fontWeight: 700 }}>{kpi.target}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>via {kpi.tracking}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Blueprint approval action */}
                {!blueprintApproved && pipelineGate === "blueprint" && (
                  <div className="ap-tab-approve-row">
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>Looks good? Approve the blueprint to continue.</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>This will start audience segmentation.</div>
                    </div>
                    <button className="ap-gate-approve-btn" onClick={handleBlueprintApprove}>
                      <IconCheck size={12} color="#fff" /> Approve Blueprint
                    </button>
                  </div>
                )}
                {blueprintApproved && (
                  <div className="ap-tab-approved-badge">
                    <IconCheck size={13} color="#10b981" /> Blueprint approved
                  </div>
                )}
              </div>
            )}

            {/* ── AUDIENCE & SEGMENTS TAB ── */}
            {activeTab === "audience" && (!isBuilding || pipelineGate === "audience" || audienceApproved) && (
              <div className="ap-ws-tab-content">
                {audienceSegment ? (
                  /* Live API data */
                  <div className="ap-ws-card">
                    <div className="ap-ws-card-title">
                      {hardAudience?.name || audienceSegment.title || journeyRecord?.journeyForm?.audience || "Target Segment"}
                      <span className="ap-bp-audience-tag" style={{ marginLeft: 8, background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>Live data</span>
                    </div>
                    {audienceSegment.description && (
                      <div className="ap-bp-desc" style={{ marginBottom: 16 }}>{audienceSegment.description}</div>
                    )}
                    <div className="ap-seg-stats">
                      <div className="ap-seg-stat">
                        <div className="ap-seg-stat-val" style={{ color: "var(--accent)" }}>{(audienceSegment.member_count ?? 0).toLocaleString()}</div>
                        <div className="ap-seg-stat-lbl">Target audience</div>
                      </div>
                      {/* {audienceSegment.total > 0 && (
                        <div className="ap-seg-stat">
                          <div className="ap-seg-stat-val">{((audienceSegment.member_count / audienceSegment.total) * 100).toFixed(1)}%</div>
                          <div className="ap-seg-stat-lbl">Coverage</div>
                        </div>
                      )} */}
                    </div>
                    {audienceSegment.columns?.length > 0 && (
                      <div className="ap-seg-columns" style={{ marginTop: 16 }}>
                        <div className="ap-seg-columns-label">Recommended channels</div>
                        <div className="ap-seg-columns-list">
                          {audienceSegment.columns.map((col) => <span key={col} className="ap-seg-column-chip">{col}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                ) : hardAudience ? (
                  /* Hardcoded audience data — rich view */
                  <>
                    {/* Header card */}
                    <div className="ap-ws-card">
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <div className="ap-bp-name" style={{ fontSize: 18, margin: 0 }}>{hardAudience.name}</div>
                        <span className="ap-bp-audience-tag" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>Ready</span>
                        {jcRunId && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}><div className="ap-step-spinner" style={{ width: 10, height: 10, borderWidth: 2 }} />Fetching live data…</span>}
                      </div>
                      <div className="ap-bp-desc" style={{ marginBottom: 0 }}>{hardAudience.description}</div>
                    </div>

                    {/* KPI cards row */}
                    <div className="ap-aud-kpi-row">
                      {[
                        { label: "Target Audience",  value: targetCount.toLocaleString(),  delta: null, color: "var(--accent)"        },
                        { label: "Coverage",         value: (audienceSegment?.coverage_pct ?? hardAudience.stats.coverage) + "%", delta: null, color: "#10b981" },
                        { label: goalText.toLowerCase().includes("churn") ? "Critical Risk" : "Email Verified",
                          value: goalText.toLowerCase().includes("churn") ? "2,200" : "11,520",
                          delta: goalText.toLowerCase().includes("churn") ? "0.9% of base" : "90% of signups",
                          color: goalText.toLowerCase().includes("churn") ? "#ef4444" : "#10b981" },
                        { label: goalText.toLowerCase().includes("churn") ? "Avg Churn Score" : "App Installed",
                          value: goalText.toLowerCase().includes("churn") ? "81.3" : "8,960",
                          delta: goalText.toLowerCase().includes("churn") ? "High risk band" : "70% of signups",
                          color: "#f59e0b" },
                      ].map((kpi) => (
                        <div key={kpi.label} className="ap-aud-kpi-card">
                          <div className="ap-aud-kpi-val" style={{ color: kpi.color }}>{kpi.value}</div>
                          <div className="ap-aud-kpi-lbl">{kpi.label}</div>
                          {kpi.delta && <div className="ap-aud-kpi-delta">{kpi.delta}</div>}
                        </div>
                      ))}
                    </div>

                    {/* Charts row */}
                    <div className="ap-aud-charts-row">
                      {/* Coverage donut */}
                      <div className="ap-ws-card ap-aud-chart-card">
                        <div className="ap-ws-card-title">Audience Coverage</div>
                        <div className="ap-aud-donut-wrap">
                          <svg viewBox="0 0 120 120" width="120" height="120">
                            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--bg-secondary)" strokeWidth="16"/>
                            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--accent)" strokeWidth="16"
                              strokeDasharray={`${hardAudience.stats.coverage / 100 * 301.6} 301.6`}
                              strokeLinecap="round" transform="rotate(-90 60 60)"/>
                            <text x="60" y="56" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--text-primary)">{hardAudience.stats.coverage}%</text>
                            <text x="60" y="70" textAnchor="middle" fontSize="9" fill="var(--text-muted)">coverage</text>
                          </svg>
                          <div className="ap-aud-donut-legend">
                            <div className="ap-aud-donut-legend-item"><span style={{ background: "var(--accent)" }} />Target: {hardAudience.stats.target.toLocaleString()}</div>
                            <div className="ap-aud-donut-legend-item"><span style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} />Remaining: {(hardAudience.stats.total - hardAudience.stats.target).toLocaleString()}</div>
                          </div>
                        </div>
                      </div>

                      {/* Channel distribution bar chart */}
                      <div className="ap-ws-card ap-aud-chart-card" style={{ flex: 1 }}>
                        <div className="ap-ws-card-title">Channel Reach</div>
                        {(goalText.toLowerCase().includes("churn")
                          ? [{ ch: "Email", pct: 92 }, { ch: "SMS", pct: 78 }, { ch: "Push", pct: 45 }]
                          : [{ ch: "Email", pct: 100 }, { ch: "Push", pct: 70 }, { ch: "SMS", pct: 30 }]
                        ).map(({ ch, pct }) => (
                          <div key={ch} className="ap-aud-bar-row">
                            <div className="ap-aud-bar-label">{ch}</div>
                            <div className="ap-aud-bar-track">
                              <div className="ap-aud-bar-fill" style={{ width: pct + "%" }} />
                            </div>
                            <div className="ap-aud-bar-pct">{pct}%</div>
                          </div>
                        ))}

                        {/* Risk / Readiness breakdown */}
                        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                          <div className="ap-ws-card-title" style={{ fontSize: 11, marginBottom: 10 }}>
                            {goalText.toLowerCase().includes("churn") ? "Risk distribution" : "Onboarding readiness"}
                          </div>
                          {(goalText.toLowerCase().includes("churn")
                            ? [{ label: "Low watch time", pct: 62, color: "#ef4444" }, { label: "Payment issues", pct: 28, color: "#f59e0b" }, { label: "Notifications off", pct: 10, color: "#8b5cf6" }]
                            : [{ label: "Profile complete", pct: 50, color: "#10b981" }, { label: "App installed", pct: 70, color: "var(--accent)" }, { label: "First login", pct: 35, color: "#f59e0b" }]
                          ).map(({ label, pct, color }) => (
                            <div key={label} className="ap-aud-bar-row">
                              <div className="ap-aud-bar-label">{label}</div>
                              <div className="ap-aud-bar-track">
                                <div className="ap-aud-bar-fill" style={{ width: pct + "%", background: color }} />
                              </div>
                              <div className="ap-aud-bar-pct">{pct}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Definition + Insights sub-tabs */}
                    <div className="ap-ws-card">
                      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
                        {["definition", "insights"].map((tab) => (
                          <button key={tab} style={{ padding: "8px 16px", fontSize: 13, fontWeight: audienceSubTab === tab ? 600 : 500, color: audienceSubTab === tab ? "var(--accent)" : "var(--text-muted)", background: "none", border: "none", borderBottom: audienceSubTab === tab ? "2px solid var(--accent)" : "2px solid transparent", cursor: "pointer" }}
                            onClick={() => setAudienceSubTab(tab)}>
                            {tab === "definition" ? "Definition" : "Profile & Insights"}
                          </button>
                        ))}
                      </div>
                      {audienceSubTab === "definition" && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 10 }}>Segment criteria</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {hardAudience.criteria.map((c, i) => (
                              <div key={i} className="ap-seg-criteria-row">
                                <span className="ap-seg-criteria-field">{c.field}</span>
                                <span className="ap-seg-criteria-op">{c.operator}</span>
                                <span className="ap-seg-criteria-val">{c.value}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 10 }}>Exclusion rules</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {(goalText.toLowerCase().includes("churn")
                                ? [{ field: "Suppressed", operator: "=", value: "true" }, { field: "Churned date", operator: "<", value: "90 days ago" }]
                                : [{ field: "Onboarding complete", operator: "=", value: "true" }, { field: "Opted out", operator: "=", value: "true" }]
                              ).map((c, i) => (
                                <div key={i} className="ap-seg-criteria-row" style={{ opacity: 0.7 }}>
                                  <span className="ap-seg-criteria-field">{c.field}</span>
                                  <span className="ap-seg-criteria-op" style={{ color: "#ef4444" }}>{c.operator}</span>
                                  <span className="ap-seg-criteria-val">{c.value}</span>
                                  <span style={{ fontSize: 10, color: "#ef4444", marginLeft: "auto" }}>EXCLUDE</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {audienceSubTab === "insights" && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 12 }}>Top profile attributes</div>
                          <div className="ap-aud-insights-grid">
                            {(goalText.toLowerCase().includes("churn")
                              ? [{ attr: "Age range", val: "28–44" }, { attr: "Tenure", val: "12–36 months" }, { attr: "Plan type", val: "Standard (68%)" }, { attr: "Device", val: "Mobile (74%)" }, { attr: "Region", val: "Urban (61%)" }, { attr: "Last content", val: "Sport / Drama" }]
                              : [{ attr: "Age range", val: "18–34" }, { attr: "Source", val: "Organic (52%)" }, { attr: "Plan type", val: "Trial (88%)" }, { attr: "Device", val: "Mobile (82%)" }, { attr: "Region", val: "Urban (58%)" }, { attr: "Referral", val: "Social (44%)" }]
                            ).map(({ attr, val }) => (
                              <div key={attr} className="ap-aud-insight-row">
                                <span className="ap-aud-insight-attr">{attr}</span>
                                <span className="ap-aud-insight-val">{val}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="ap-ws-card">
                    <div className="ap-ws-card-title">Audience &amp; Segments</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {journeyRecord?.journeyForm?.audience || "Active customers matching criteria"}
                    </div>
                  </div>
                )}

                {/* Segment breakdown table */}
                {hardAudience && (
                  <div className="ap-ws-card">
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                      <div className="ap-ws-card-title" style={{ marginBottom: 0 }}>Segment Breakdown</div>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Total audience: <strong style={{ color: "var(--accent)" }}>{targetCount.toLocaleString()}</strong>
                      </span>
                    </div>
                    <table className="ap-meas-table">
                      <thead>
                        <tr>
                          <th>Attribute</th>
                          <th>Value</th>
                          <th>% of Target</th>
                          <th>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(goalText.toLowerCase().includes("churn")
                          ? [
                              { attr: "Churn score ≥ 90 (Critical)", val: "Critical band",   pct: 12,  count: Math.round(targetCount * 0.12)  },
                              { attr: "Churn score 74–89 (High)",    val: "High risk band",  pct: 88,  count: Math.round(targetCount * 0.88)  },
                              { attr: "Primary reason: Watch time",  val: "< 20 min/week",  pct: 62,  count: Math.round(targetCount * 0.62)  },
                              { attr: "Primary reason: Payments",    val: "Failed/overdue",  pct: 28,  count: Math.round(targetCount * 0.28)  },
                              { attr: "Email reachable",             val: "Valid address",   pct: 94,  count: Math.round(targetCount * 0.94)  },
                              { attr: "SMS opted-in",                val: "Consent given",   pct: 78,  count: Math.round(targetCount * 0.78)  },
                              { attr: "App installed",               val: "iOS or Android",  pct: 81,  count: Math.round(targetCount * 0.81)  },
                            ]
                          : [
                              { attr: "Email verified",              val: "Verified = true", pct: 90,  count: Math.round(targetCount * 0.90)  },
                              { attr: "App installed",               val: "iOS or Android",  pct: 70,  count: Math.round(targetCount * 0.70)  },
                              { attr: "Profile complete",            val: "≥ 80% filled",   pct: 50,  count: Math.round(targetCount * 0.50)  },
                              { attr: "First login done",            val: "< 24h after reg", pct: 65,  count: Math.round(targetCount * 0.65)  },
                              { attr: "Push notifications on",       val: "Opted-in",        pct: 58,  count: Math.round(targetCount * 0.58)  },
                              { attr: "Source: Organic",             val: "Direct / SEO",    pct: 52,  count: Math.round(targetCount * 0.52)  },
                              { attr: "Source: Paid / Referral",     val: "Ad / Social",     pct: 48,  count: Math.round(targetCount * 0.48)  },
                            ]
                        ).map(({ attr, val, pct, count }) => (
                          <tr key={attr}>
                            <td style={{ fontWeight: 500 }}>{attr}</td>
                            <td style={{ color: "var(--text-muted)" }}>{val}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ flex: 1, height: 6, background: "var(--bg-secondary)", borderRadius: 99, overflow: "hidden", minWidth: 60 }}>
                                  <div style={{ height: "100%", width: pct + "%", background: "var(--accent)", borderRadius: 99 }} />
                                </div>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 28 }}>{pct}%</span>
                              </div>
                            </td>
                            <td style={{ color: "var(--accent)", fontWeight: 700 }}>{count.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Audience approval action */}
                {!audienceApproved && pipelineGate === "audience" && (
                  <div className="ap-tab-approve-row">
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>Segment looks right? Approve to continue building.</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>This will start creative generation and journey assembly.</div>
                    </div>
                    <button className="ap-gate-approve-btn" onClick={handleAudienceApprove}>
                      <IconCheck size={12} color="#fff" /> Approve Audience
                    </button>
                  </div>
                )}
                {audienceApproved && (
                  <div className="ap-tab-approved-badge">
                    <IconCheck size={13} color="#10b981" /> Audience approved
                  </div>
                )}
              </div>
            )}

            {/* ── CREATIVE SETS TAB ── */}
            {activeTab === "creative" && !isBuilding && (
              <div className="ap-ws-tab-content">
                <div className="ap-ws-card">
                  <div className="ap-ws-card-title">Creative Sets</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                    {creatives.map((cr) => (
                      <div key={cr.channel} className="ap-creative-card">
                        <div className="ap-creative-card-header">
                          <span className="ap-bp-ch">{cr.channel}</span>
                          <span className="ap-creative-badge-ready">Creative ready</span>
                        </div>
                        <div className="ap-creative-template-slot">
                          <div className="ap-creative-template-label">Template</div>
                          <div className="ap-creative-template-name">{cr.template}</div>
                        </div>
                        <div className="ap-creative-subject-label">Subject / headline</div>
                        <div className="ap-creative-subject">{cr.subjectLine}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── MEASUREMENT TAB ── */}
            {activeTab === "measurement" && !isBuilding && measurement && (
              <div className="ap-ws-tab-content">
                <div className="ap-ws-card">
                  <div className="ap-ws-card-title">KPI Targets</div>
                  <table className="ap-meas-table">
                    <thead>
                      <tr>
                        <th>KPI</th>
                        <th>Target</th>
                        <th>Tracking</th>
                      </tr>
                    </thead>
                    <tbody>
                      {measurement.kpis.map((kpi) => (
                        <tr key={kpi.name}>
                          <td>{kpi.name}</td>
                          <td style={{ color: "var(--accent)", fontWeight: 700 }}>{kpi.target}</td>
                          <td style={{ color: "var(--text-muted)" }}>{kpi.tracking}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ap-ws-card">
                  <div className="ap-ws-card-title">Signals Tracked</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    {measurement.signals.map((sig) => (
                      <span key={sig} className="ap-seg-column-chip" style={{ fontSize: 12, padding: "5px 12px" }}>{sig}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── QA AUTOMATION TAB ── */}
            {activeTab === "qa" && !isBuilding && qaData && (
              <div className="ap-ws-tab-content">

                {/* Status bar */}
                <div className="ap-qa-status-bar">
                  <div className="ap-qa-status-item">
                    <span className="ap-qa-dot pass" />
                    {qaData.suites.flatMap(s => s.cases).filter(c => c.pass).length} passed
                  </div>
                  <div className="ap-qa-status-item">
                    <span className="ap-qa-dot fail" />
                    {qaData.suites.flatMap(s => s.cases).filter(c => !c.pass).length} failed
                  </div>
                  <div className="ap-qa-status-item">
                    <span className="ap-qa-dot pending-dot" />
                    QA automation pending approval
                  </div>
                </div>

                {/* Test profiles */}
                <div className="ap-ws-card">
                  <div className="ap-ws-card-title">Test Profiles</div>
                  <div className="ap-qa-profiles-grid">
                    {qaData.profiles.map((p) => (
                      <div key={p.id} className="ap-qa-profile-card">
                        <div className="ap-qa-profile-avatar">{p.name.charAt(0)}</div>
                        <div className="ap-qa-profile-body">
                          <div className="ap-qa-profile-name">{p.name}</div>
                          <div className="ap-qa-profile-id">{p.id}</div>
                          <div className="ap-qa-profile-meta">{p.metric}</div>
                          <div className="ap-qa-profile-meta">Last seen: {p.lastSeen}</div>
                        </div>
                        <span className={`ap-qa-profile-badge ${p.status === "Critical" ? "critical" : p.status === "High risk" ? "high" : p.status === "Moderate" ? "moderate" : "normal"}`}>
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Test suites */}
                {qaData.suites.map((suite) => {
                  const passed = suite.cases.filter(c => c.pass).length;
                  return (
                    <div key={suite.name} className="ap-ws-card">
                      <div className="ap-qa-suite-header">
                        <div className="ap-ws-card-title" style={{ margin: 0 }}>{suite.name}</div>
                        <span className="ap-qa-suite-score">{passed}/{suite.cases.length} passed</span>
                      </div>
                      <div className="ap-qa-cases">
                        {suite.cases.map((c, i) => (
                          <div key={i} className={`ap-qa-case-row ${c.pass ? "pass" : "fail"}`}>
                            <div className="ap-qa-case-icon">
                              {c.pass
                                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                              }
                            </div>
                            <div className="ap-qa-case-label">{c.label}</div>
                            <span className={`ap-qa-case-status ${c.pass ? "pass" : "fail"}`}>{c.pass ? "PASS" : "FAIL"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* QA approval / status */}
                {!qaApproved ? (
                  <div className="ap-tab-approve-row" style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)" }}>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>Review complete — approve to enable Launch</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {qaData.suites.flatMap(s => s.cases).filter(c => !c.pass).length} advisory item(s) noted. Journey is ready to launch.
                      </div>
                    </div>
                    <button className="ap-gate-approve-btn" style={{ background: "#10b981" }} onClick={() => { setQaApproved(true); setActiveTab("launch"); }}>
                      <IconCheck size={12} color="#fff" /> Approve QA &amp; Enable Launch
                    </button>
                  </div>
                ) : (
                  <div className="ap-tab-approved-badge">
                    <IconCheck size={13} color="#10b981" /> QA approved — Launch is now available
                  </div>
                )}
              </div>
            )}

            {/* ── JOURNEY WORKFLOW TAB ── */}
            {activeTab === "journey_flow" && !isBuilding && canvasData && (() => {
              const { nodes: cn, edges: ce, lanes, totalW, totalH, NODE_W: NW, NODE_H: NH, LANE_H, LANE_LBL_W, PAD_T } = canvasData;
              const byId = Object.fromEntries(cn.map(n => [n.id, n]));
              const trunc = (s, n) => !s ? "" : s.length > n ? s.slice(0, n) + "…" : s;
              const getKind = t => ({ ENTRY:"TRIGGER", MESSAGE:"ACTION", WAIT:"WAIT", BRANCH:"DECISION", A_B_SPLIT:"SPLIT", GOAL:"GOAL", EXIT:"EXIT" }[t] || t);
              return (
                <div className="ap-ws-tab-content">
                  <div className="ap-ws-card" style={{ padding: "16px 0 0", overflow: "hidden" }}>
                    <div className="ap-ws-card-title" style={{ padding: "0 20px 12px" }}>
                      Journey Flow
                      <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 12, marginLeft: 10 }}>
                        {flowNodes.length} steps · {intent?.channels?.join(", ")} · {intent?.category}
                      </span>
                    </div>
                    <div style={{ overflowX: "auto", overflowY: "hidden", width: "100%", paddingBottom: 16 }}>
                      <svg width={totalW} height={totalH} style={{ display: "block", minWidth: totalW }}>
                        <defs>
                          <marker id="ap-arr"   viewBox="0 0 8 8" refX="6" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#3D5068"/></marker>
                          <marker id="ap-arr-y" viewBox="0 0 8 8" refX="6" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#22C55E"/></marker>
                          <marker id="ap-arr-n" viewBox="0 0 8 8" refX="6" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#EF4444"/></marker>
                        </defs>

                        {/* Lane backgrounds + labels */}
                        {lanes.map((lane, li) => {
                          const laneY = PAD_T + li * LANE_H;
                          return (
                            <g key={lane.id}>
                              <rect x={0} y={laneY} width={totalW} height={LANE_H}
                                fill={li % 2 === 0 ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.06)"} />
                              <rect x={0} y={laneY} width={LANE_LBL_W} height={LANE_H} fill={lane.color + "20"} />
                              <line x1={LANE_LBL_W} y1={laneY} x2={totalW} y2={laneY} stroke={lane.color + "28"} strokeWidth="1" />
                              <text x={LANE_LBL_W / 2} y={laneY + LANE_H / 2}
                                textAnchor="middle" dominantBaseline="middle"
                                fontSize="8.5" fontWeight="800" fill={lane.color}
                                letterSpacing="1.1"
                                transform={`rotate(-90,${LANE_LBL_W/2},${laneY + LANE_H/2})`}
                              >{lane.label}</text>
                            </g>
                          );
                        })}
                        <line x1={0} y1={PAD_T + lanes.length * LANE_H} x2={totalW} y2={PAD_T + lanes.length * LANE_H} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                        <line x1={LANE_LBL_W} y1={PAD_T} x2={LANE_LBL_W} y2={PAD_T + lanes.length * LANE_H} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                        {/* Edges */}
                        {ce.map((e) => {
                          const fn = byId[e.f], tn = byId[e.t];
                          if (!fn || !tn) return null;
                          const isBranchSrc = fn.type === "BRANCH" || fn.type === "A_B_SPLIT";
                          const isNo = e.tp === "no";
                          let fx, fy;
                          if (isBranchSrc && isNo) {
                            fx = fn.x + NW / 2; fy = fn.y + NH;
                          } else {
                            fx = fn.x + NW; fy = fn.y + NH / 2;
                          }
                          const tx = tn.x, ty = tn.y + NH / 2;
                          const clr = e.tp === "yes" ? "#22C55E" : e.tp === "no" ? "#EF4444" : "#3D5068";
                          const mid = (fx + tx) / 2;
                          const d = (isBranchSrc && isNo)
                            ? `M${fx},${fy} C${fx},${(fy+ty)/2} ${tx},${(fy+ty)/2} ${tx},${ty}`
                            : `M${fx},${fy} C${mid},${fy} ${mid},${ty} ${tx},${ty}`;
                          const mkr = e.tp === "yes" ? "ap-arr-y" : e.tp === "no" ? "ap-arr-n" : "ap-arr";
                          const lx = (fx + tx) / 2, ly = (fy + ty) / 2;
                          return (
                            <g key={e.id}>
                              <path d={d} fill="none" stroke={clr} strokeWidth={e.tp === "flow" ? "1.5" : "1.8"}
                                strokeDasharray={isNo ? "5 3" : undefined} markerEnd={`url(#${mkr})`} />
                              {e.lbl && (
                                <>
                                  <rect x={lx-26} y={ly-9} width={52} height={16} rx={4} fill={clr+"22"} stroke={clr} strokeWidth="0.8" />
                                  <text x={lx} y={ly+4} textAnchor="middle" fontSize="9" fill={clr} fontWeight="700">{e.lbl}</text>
                                </>
                              )}
                            </g>
                          );
                        })}

                        {/* Nodes */}
                        {cn.map((n) => {
                          const acc = n.accent;
                          const isDecision = n.type === "BRANCH" || n.type === "A_B_SPLIT";
                          const isMid = n.type === "ENTRY" || n.type === "GOAL" || n.type === "EXIT";
                          if (isDecision) {
                            const cx = n.x + NW/2, cy = n.y + NH/2;
                            const hw = NW/2-3, hh = NH/2-3;
                            return (
                              <g key={n.id}>
                                <polygon points={`${cx},${cy-hh} ${cx+hw},${cy} ${cx},${cy+hh} ${cx-hw},${cy}`}
                                  fill="var(--bg-secondary,#12141a)" stroke={acc} strokeWidth="1.5" />
                                <text x={cx} y={cy-4} textAnchor="middle" fontSize="10" fontWeight="700" fill={acc}>{trunc(n.label,14)}</text>
                                {n.sub && <text x={cx} y={cy+11} textAnchor="middle" fontSize="8.5" fill="var(--text-muted,#94a3b8)">{trunc(n.sub,18)}</text>}
                              </g>
                            );
                          }
                          const rx = isMid ? NH/2 : 6;
                          return (
                            <g key={n.id}>
                              <rect x={n.x} y={n.y} width={NW} height={NH} rx={rx}
                                fill="var(--bg-panel,#1a1d23)" stroke={acc} strokeWidth="1.5" />
                              {!isMid && <rect x={n.x} y={n.y+rx} width={3} height={NH-rx*2} fill={acc} rx="1.5" />}
                              <text x={n.x+NW/2} y={n.y+18} textAnchor="middle" fontSize="8" fontWeight="800" fill={acc} letterSpacing="0.6">{getKind(n.type)}</text>
                              <text x={n.x+NW/2} y={n.y+36} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text-primary,#e2e8f0)">{trunc(n.label,20)}</text>
                              {n.sub && <text x={n.x+NW/2} y={n.y+52} textAnchor="middle" fontSize="9" fill="var(--text-muted,#94a3b8)">{trunc(n.sub,24)}</text>}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  <div className="ap-ws-card">
                    <div className="ap-ws-card-title">Journey Summary</div>
                    <div className="ap-seg-stats" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                      {[
                        { label: "Total steps",  val: flowNodes.length },
                        { label: "Channels",     val: intent?.channels?.length ?? 1 },
                        { label: "Branch nodes", val: flowNodes.filter(n => n.type === "BRANCH").length },
                        { label: "Exit paths",   val: flowNodes.filter(n => n.type === "EXIT" || n.type === "GOAL").length },
                      ].map(({ label, val }) => (
                        <div key={label} className="ap-seg-stat">
                          <div className="ap-seg-stat-val">{val}</div>
                          <div className="ap-seg-stat-lbl">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── LAUNCH TAB ── */}
            {activeTab === "launch" && !isBuilding && (
              <div className="ap-ws-tab-content">
                {!qaApproved ? (
                  <div className="ap-launch-locked">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Launch locked</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Go to the QA Automation tab and approve QA to unlock Launch.</div>
                  </div>
                ) : (
                  <>
                    {/* Pre-launch checklist */}
                    <div className="ap-ws-card">
                      <div className="ap-ws-card-title">Pre-launch Checklist</div>
                      <div className="ap-launch-checklist">
                        {[
                          { label: "Campaign Blueprint approved",    done: blueprintApproved },
                          { label: "Audience segment approved",      done: audienceApproved  },
                          { label: "Creative sets validated",        done: true              },
                          { label: "Journey flow configured",        done: true              },
                          { label: "Measurement framework seeded",   done: true              },
                          { label: "QA automation passed",           done: qaApproved        },
                        ].map(({ label, done }) => (
                          <div key={label} className={`ap-launch-check-row ${done ? "done" : "pending"}`}>
                            <div className="ap-launch-check-icon">
                              {done
                                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/></svg>
                              }
                            </div>
                            <span>{label}</span>
                            <span className={`ap-launch-check-badge ${done ? "done" : "pending"}`}>{done ? "Done" : "Pending"}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Launch summary */}
                    <div className="ap-ws-card">
                      <div className="ap-ws-card-title">Launch Summary</div>
                      <div className="ap-launch-summary-grid">
                        <div className="ap-launch-summary-item">
                          <div className="ap-launch-summary-label">Journey</div>
                          <div className="ap-launch-summary-val">{journeyRecord?.name || derivedName}</div>
                        </div>
                        <div className="ap-launch-summary-item">
                          <div className="ap-launch-summary-label">Target audience</div>
                          <div className="ap-launch-summary-val">{targetCount.toLocaleString()} profiles</div>
                        </div>
                        <div className="ap-launch-summary-item">
                          <div className="ap-launch-summary-label">Channels</div>
                          <div className="ap-launch-summary-val">{intent?.channels.join(", ")}</div>
                        </div>
                        <div className="ap-launch-summary-item">
                          <div className="ap-launch-summary-label">Journey steps</div>
                          <div className="ap-launch-summary-val">{flowNodes?.length ?? "—"}</div>
                        </div>
                      </div>
                    </div>

                    {/* Launch action bar */}
                    <div className="ap-launch-action-bar">
                      <div className="ap-launch-secondary-btns">
                        <button className="ap-launch-btn-sm" onClick={handleStartOver}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/></svg>
                          Start Over
                        </button>
                        <button className="ap-launch-btn-sm danger" onClick={handleStartOver}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                          Discard
                        </button>
                      </div>
                      <div className="ap-launch-primary-btns">
                        <button className="ap-launch-btn-draft" onClick={() => handleSaveJourney("Draft")}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                          Save as Draft
                        </button>
                        <button className="ap-launch-btn-activate" onClick={() => handleSaveJourney("Active")}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/></svg>
                          Activate
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>{/* end ap-ws-main */}
        </div>{/* end ap-ws-body */}

        {/* ── Blueprint Approval Modal ── */}
        {showBlueprintModal && (
          <div className="ap-modal-overlay">
            <div className="ap-modal ap-modal--wide">
              {/* Header */}
              <div className="ap-modal-header">
                <div className="ap-modal-header-left">
                  <div className="ap-modal-icon-inline" style={{ background: "rgba(59,130,246,0.12)", color: "var(--accent)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                  </div>
                  <div>
                    <div className="ap-modal-title">Campaign Blueprint Ready</div>
                    <div className="ap-modal-subtitle">Review the strategy before audience segmentation begins</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {intent?.channels.map((ch) => <span key={ch} className="ap-bp-ch">{ch}</span>)}
                  {intent?.category && <span className="ap-bp-pill" style={{ textTransform: "capitalize" }}>{intent.category}</span>}
                </div>
              </div>

              <div className="ap-modal-two-col">
                {/* Left: strategy */}
                <div className="ap-modal-section">
                  <div className="ap-modal-section-title">Blueprint Strategy</div>
                  <ul className="ap-modal-checklist">
                    {strategy.map((pt, i) => (
                      <li key={i}><IconCheck size={11} color="#10b981" /><span>{pt}</span></li>
                    ))}
                  </ul>
                </div>

                {/* Right: channel plan + measurement */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div className="ap-modal-section">
                    <div className="ap-modal-section-title">Channel Plan</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {channelPlan.map((cp) => (
                        <div key={cp.channel} className="ap-modal-channel-row">
                          <span className="ap-bp-ch" style={{ flexShrink: 0, fontSize: 11 }}>{cp.channel}</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>{cp.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {measurement && (
                    <div className="ap-modal-section">
                      <div className="ap-modal-section-title">Measurement KPIs</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {measurement.kpis.map((kpi) => (
                          <div key={kpi.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                            <span style={{ color: "var(--text-muted)" }}>{kpi.name}</span>
                            <span style={{ fontWeight: 700, color: "var(--accent)" }}>{kpi.target}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {measurement.signals.map((s) => (
                          <span key={s} className="ap-seg-column-chip" style={{ fontSize: 11 }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="ap-modal-actions">
                <button className="ap-gate-view-btn" onClick={() => { setShowBlueprintModal(false); setActiveTab("blueprint"); }}>
                  View Full Blueprint →
                </button>
                <button className="ap-gate-approve-btn" onClick={handleBlueprintApprove}>
                  <IconCheck size={12} color="#fff" /> Approve Blueprint
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Audience Approval Modal ── */}
        {showAudienceModal && (
          <div className="ap-modal-overlay">
            <div className="ap-modal ap-modal--wide">
              {/* Header */}
              <div className="ap-modal-header">
                <div className="ap-modal-header-left">
                  <div className="ap-modal-icon-inline" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                  </div>
                  <div>
                    <div className="ap-modal-title">Audience Segment Qualified</div>
                    {hardAudience && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginTop: 2 }}>{hardAudience.name}</div>
                    )}
                    <div className="ap-modal-subtitle">Review segment criteria and coverage before creative generation</div>
                  </div>
                </div>
                <span className="ap-bp-audience-tag" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>Ready</span>
              </div>

              {hardAudience && (
                <div className="ap-modal-two-col">
                  {/* Left: name + description + criteria + exclusions */}
                  <div className="ap-modal-section">
                    <div className="ap-modal-aud-name" style={{ marginBottom: 6 }}>{hardAudience.name}</div>
                    <div className="ap-modal-aud-desc" style={{ marginBottom: 14 }}>{hardAudience.description}</div>

                    <div className="ap-modal-section-title">Segment Criteria</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                      {hardAudience.criteria.map((c, i) => (
                        <div key={i} className="ap-seg-criteria-row">
                          <span className="ap-seg-criteria-field">{c.field}</span>
                          <span className="ap-seg-criteria-op">{c.operator}</span>
                          <span className="ap-seg-criteria-val">{c.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="ap-modal-section-title">Exclusion Rules</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {(goalText.toLowerCase().includes("churn")
                        ? [{ field: "Suppressed", operator: "=", value: "true" }, { field: "Churned date", operator: "<", value: "90 days ago" }]
                        : [{ field: "Onboarding complete", operator: "=", value: "true" }, { field: "Opted out", operator: "=", value: "true" }]
                      ).map((c, i) => (
                        <div key={i} className="ap-seg-criteria-row" style={{ opacity: 0.75 }}>
                          <span className="ap-seg-criteria-field">{c.field}</span>
                          <span className="ap-seg-criteria-op" style={{ color: "#ef4444" }}>{c.operator}</span>
                          <span className="ap-seg-criteria-val">{c.value}</span>
                          <span style={{ fontSize: 10, color: "#ef4444", marginLeft: "auto" }}>EXCLUDE</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: KPI stats + channel reach */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div className="ap-modal-section">
                      <div className="ap-modal-section-title">Audience Size</div>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {[
                          { label: "Target Audience", val: (audienceSegment?.member_count ?? hardAudience.stats.target ?? 0).toLocaleString(), color: "var(--accent)" },
                          // { label: "Coverage",        val: (audienceSegment?.coverage_pct ?? hardAudience.stats.coverage) + "%",          color: "#10b981" },
                        ].map((s) => (
                          <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="ap-modal-section">
                      <div className="ap-modal-section-title">Channel Reach</div>
                      {(goalText.toLowerCase().includes("churn")
                        ? [{ ch: "Email", pct: 92 }, { ch: "SMS", pct: 78 }, { ch: "Push", pct: 45 }]
                        : [{ ch: "Email", pct: 100 }, { ch: "Push", pct: 70 }, { ch: "SMS", pct: 30 }]
                      ).map(({ ch, pct }) => (
                        <div key={ch} className="ap-aud-bar-row" style={{ marginBottom: 4 }}>
                          <div className="ap-aud-bar-label">{ch}</div>
                          <div className="ap-aud-bar-track">
                            <div className="ap-aud-bar-fill" style={{ width: pct + "%" }} />
                          </div>
                          <div className="ap-aud-bar-pct">{pct}%</div>
                        </div>
                      ))}
                    </div>

                    <div className="ap-modal-section">
                      <div className="ap-modal-section-title">{goalText.toLowerCase().includes("churn") ? "Risk Distribution" : "Onboarding Readiness"}</div>
                      {(goalText.toLowerCase().includes("churn")
                        ? [{ label: "Low watch time", pct: 62, color: "#ef4444" }, { label: "Payment issues", pct: 28, color: "#f59e0b" }, { label: "Notifications off", pct: 10, color: "#8b5cf6" }]
                        : [{ label: "Profile complete", pct: 50, color: "#10b981" }, { label: "App installed", pct: 70, color: "var(--accent)" }, { label: "First login", pct: 35, color: "#f59e0b" }]
                      ).map(({ label, pct, color }) => (
                        <div key={label} className="ap-aud-bar-row" style={{ marginBottom: 4 }}>
                          <div className="ap-aud-bar-label">{label}</div>
                          <div className="ap-aud-bar-track">
                            <div className="ap-aud-bar-fill" style={{ width: pct + "%", background: color }} />
                          </div>
                          <div className="ap-aud-bar-pct">{pct}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="ap-modal-actions">
                <button className="ap-gate-view-btn" onClick={() => { setShowAudienceModal(false); setActiveTab("audience"); }}>
                  View Full Segment →
                </button>
                <button className="ap-gate-approve-btn" style={{ background: "#10b981" }} onClick={handleAudienceApprove}>
                  <IconCheck size={12} color="#fff" /> Approve Audience
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  /* ══════════════════════════════════════════
     HOME SCREEN — idle or clarifying
  ══════════════════════════════════════════ */
  const hasUserMessages = messages.some((m) => m.role === "user");

  return (
    <div className="ap-home">
      <div className="ap-home-inner">

        {/* Title + subtitle */}
        <h1 className="ap-home-title">Journey Autopilot</h1>
        <p className="ap-home-sub">
          Describe the journey you want to launch — your agents will plan, build, QA, and measure it.
        </p>

        {/* Chat area */}
        <div className="ap-home-chat-area">

          {/* Messages (show when there's conversation) */}
          {messages.length > 0 && (
            <div className="ap-home-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`ap-msg ${msg.role === "user" ? "user" : ""}`}>
                  <div className="ap-msg-avatar">
                    {msg.role === "ai"
                      ? <IconCopilot size={12} />
                      : "U"}
                  </div>
                  <div className="ap-msg-bubble">
                    {msg.text.split("\n").map((line, j) => <p key={j}>{line}</p>)}
                  </div>
                </div>
              ))}

              {/* Clarifying questions inline */}
              {clarifyingQuestions.length > 0 && !useChatFallback && (
                <div className="ap-msg">
                  <div className="ap-msg-avatar"><IconCopilot size={12} /></div>
                  <div className="ap-msg-bubble ap-msg-bubble--clarify">
                    {clarifyingLoading ? (
                      <div className="ap-clarify-loading">
                        <div className="ap-step-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                        <span>Analysing your goal…</span>
                      </div>
                    ) : clarifyingConfirmed ? (
                      <div className="ap-clarify-confirmed">
                        <div className="ap-clarify-confirmed-title">
                          <IconCheck size={13} color="#10b981" />
                          Confirmed — building campaign
                        </div>
                        <div className="ap-clarify-summary-grid">
                          {clarifyingQuestions.map((q) => (
                            <div key={q.id} className="ap-clarify-summary-row">
                              <div className="ap-clarify-summary-q">{q.question}</div>
                              <div className="ap-clarify-summary-a">{clarifyingAnswers[q.id] ?? "—"}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="ap-clarify-title">A few questions to tailor this campaign</div>
                        <div className="ap-clarify-questions">
                          {clarifyingQuestions.map((q) => (
                            <div key={q.id} className="ap-clarify-q-block">
                              <div className="ap-clarify-q-label">{q.question}</div>
                              <div className="ap-clarify-options">
                                {q.options.map((opt) => (
                                  <button
                                    key={opt}
                                    className={`ap-clarify-opt ${clarifyingAnswers[q.id] === opt ? "selected" : ""}`}
                                    onClick={() => setClarifyingAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                  >
                                    {clarifyingAnswers[q.id] === opt && <IconCheck size={10} color="currentColor" />}
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="ap-clarify-footer">
                          <button
                            className="ap-build-btn"
                            disabled={Object.keys(clarifyingAnswers).length < clarifyingQuestions.length}
                            onClick={handleBuildCampaign}
                          >
                            <IconCopilot size={13} />
                            Build Campaign
                          </button>
                          <span className="ap-clarify-hint">
                            {Object.keys(clarifyingAnswers).length}/{clarifyingQuestions.length} answered
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {isTyping && (
                <div className="ap-msg">
                  <div className="ap-msg-avatar"><IconCopilot size={12} /></div>
                  <div className="ap-msg-bubble">
                    <div className="ap-typing"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input */}
          <div className="ap-home-input-wrap">
            <textarea
              className="ap-home-input"
              placeholder="Describe the campaign goal you want to launch..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
            />
            <button
              className="ap-home-send"
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isProcessing}
            >
              {isProcessing ? <IconSpinner size={15} /> : <IconSend />}
            </button>
          </div>

          {/* Audience opt */}
          <div className="ap-home-audience-opt">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
            Use your own audience data
          </div>
        </div>

        {/* Suggestion chips — idle only */}
        {phase === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>

            {/* Quick chips row */}
            <div className="ap-home-chips">
              <span className="ap-home-chip-group-label">Quick starts:</span>
              {QUICK_CHIPS.map((c) => (
                <button
                  key={c.label}
                  className="ap-home-chip quick"
                  onClick={() => handleSubmit(c.label)}
                >
                  <span style={{ marginRight: 5, opacity: 0.7 }}>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>

            {/* Example goals */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {EXAMPLE_GOALS.map((goal) => (
                <button
                  key={goal}
                  className="ap-goal-chip"
                  onClick={() => handleSubmit(goal)}
                >
                  {goal.length > 120 ? goal.slice(0, 120) + "…" : goal}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
