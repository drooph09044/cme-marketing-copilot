import journeyLibrarySeed from "../data/journeyLibrary.js";
import { DEFAULT_SEGMENT_SOURCE_URL } from "./segmentFeed";

const customJourneySeed = { categories: [] };

export const THEME = {
  bg: "#080B10",
  surface: "#0E1420",
  card: "#131B28",
  border: "#1E2D42",
  text: "#E2EAF4",
  muted: "#7A8FA8",
  dim: "#3D5068",
};

export const TOPBAR = {
  brand: "EXL Marketing Copilot",
};

export const WORKSPACE_ROUTES = [
  { id: "bp", label: "Campaigns & Journeys", accent: "#C89B3C", parent: "act" },
  { id: "cfg", label: "Journey Config", accent: "#2680EB", parent: "act" },
  { id: "qa", label: "QA & Automation", accent: "#0FB8B8", parent: "act" },
];

export const SIDEBAR_SECTIONS = [
  {
    id: "act",
    title: "Activation & Journeys",
    accent: "#2680EB",
    description: "Journey authoring, blueprinting, QA, and deployment readiness.",
    items: [
      { id: "bp", label: "Campaigns & Journeys", pill: "Catalogue" },
      { id: "cfg", label: "Journey Config", pill: "AJO" },
      { id: "qa", label: "QA & Automation", pill: "Validate" },
    ],
  },
];

export const FLOW_LANES = [
  { id: "trigger", label: "TRIGGER & ENTRY", color: "#2680EB" },
  { id: "email", label: "EMAIL", color: "#C89B3C" },
  { id: "push", label: "PUSH", color: "#F59E0B" },
  { id: "decision", label: "DECISION", color: "#8B5CF6" },
  { id: "exit", label: "EXIT", color: "#22C55E" },
];

export const PHASE_HEADERS = [
  "Entry",
  "Holdout",
  "A/B",
  "Email D-7",
  "Decision",
  "Wait",
  "Push D-5",
  "Decision",
  "Wait",
  "Email D-3",
  "Push D-1",
  "Decision",
  "Exit",
];

export const EDGE_COLORS = {
  flow: "#3D5068",
  yes: "#22C55E",
  no: "#EF4444",
  holdout: "#0FB8B8",
  varA: "#E5C97A",
  varB: "#C4B5FD",
};

const WAIT_NODE_IDS = ["n5", "n8"];
const HOLDOUT_NODE_IDS = ["n1"];
const HOLDOUT_EXIT_NODE_IDS = ["n14"];
const SPLIT_NODE_IDS = ["n2"];

const JOURNEY_VERTICAL_CATEGORIES = {
  sports: {
    id: "sports",
    name: "Sports",
    description: "Ticketing, season engagement, attendance, and fan lifecycle journeys.",
  },
  media: {
    id: "media",
    name: "Media",
    description: "Streaming, subscriptions, content onboarding, and conversion journeys.",
  },
  telecom: {
    id: "telecom",
    name: "Telecom",
    description: "Telco onboarding, care recovery, and bundle growth journeys.",
  },
  automotive: {
    id: "automotive",
    name: "Automotive",
    description: "Vehicle service reminders, maintenance lifecycle, and premium care upsell journeys.",
  },
};

const EXPLICIT_VERTICAL_BY_SLUG = {
  "attendance-recovery-journey": "sports",
  "fan-loyalty-anniversary-journey": "sports",
  "game-day-engagement-journey": "sports",
  "group-ticket-sales-journey": "sports",
  "lapsed-fan-winback-journey": "sports",
  "new-fan-onboarding-journey": "sports",
  "playoff-presale-conversion-journey": "sports",
  "season-kickoff-engagement-journey": "sports",
  "season-ticket-renewal-journey": "sports",
  "season-ticket-upsell-journey": "sports",
  "stream-engagement": "sports",
  "build-brand-start-the-season": "sports",
  "fuel-fans-integrate-new-fans": "sports",
  "monetize-moments-showcase-new-merchandise": "sports",
  "merch-shopping": "sports",
  "volunteer-engagement": "sports",
  "newsletter-signup": "sports",
  "golf-travel": "sports",
  "fantasy-engagement": "sports",
  "content-platform-onboarding-journey": "media",
  "free-to-paid-conversion-journey": "media",
  "streaming-long-term-winback-journey": "media",
  "streaming-winback-journey": "media",
  "subscription-renewal-journey": "media",
  "cross-sell-bundle-expansion-journey": "telecom",
  "customer-service-recovery-save-journey": "telecom",
  "telco-onboarding-value-realisation-journey": "telecom",
  "vehicle-service-lapse-recovery-journey": "automotive",
  "high-mileage-tire-change-journey": "automotive",
  "battery-replacement-lifecycle-journey": "automotive",
  "multi-vehicle-household-care-journey": "automotive",
  "premium-service-upsell-journey": "automotive",
  "seasonal-maintenance-reminder-journey": "automotive",
};

function slugifyValue(value, fallback = "journey") {
  const cleaned = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function inferVerticalCategory(record = {}, category = {}) {
  const slug = record.slug ?? record.useCaseId ?? slugifyValue(record.name ?? record.journeyTable?.journeyName, "journey");
  const explicit = EXPLICIT_VERTICAL_BY_SLUG[slug];
  if (explicit && JOURNEY_VERTICAL_CATEGORIES[explicit]) {
    return JOURNEY_VERTICAL_CATEGORIES[explicit];
  }

  const haystack = [
    slug,
    record.name,
    record.categoryId,
    record.categoryName,
    record.category?.categoryId,
    record.category?.categoryName,
    record.journeyTable?.journeyCategory,
    record.journeyTable?.journeyName,
    record.journeyTable?.journeyGoal,
    category?.id,
    category?.name,
    category?.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(?:telco|telecom|prepaid|postpaid|network|arpu|bundle|service|care)/i.test(haystack)) {
    return JOURNEY_VERTICAL_CATEGORIES.telecom;
  }
  if (/(?:automotive|vehicle|service interval|mileage|odometer|tire|tyre|battery|dealership|household|maintenance|oil change)/i.test(haystack)) {
    return JOURNEY_VERTICAL_CATEGORIES.automotive;
  }
  if (/(?:stream|streaming|subscription|subscriber|content|ott|media|view|watch)/i.test(haystack)) {
    return JOURNEY_VERTICAL_CATEGORIES.media;
  }
  return JOURNEY_VERTICAL_CATEGORIES.sports;
}

function inferSubCategoryMeta(record = {}, category = {}, verticalCategory = JOURNEY_VERTICAL_CATEGORIES.sports) {
  const sourceIdCandidates = [
    record.subCategoryId,
    record.category?.categoryId,
    record.categoryId && record.categoryId !== verticalCategory.id ? record.categoryId : "",
    category?.id && category.id !== verticalCategory.id ? category.id : "",
  ];
  const sourceNameCandidates = [
    record.subCategoryName,
    record.category?.categoryName,
    record.journeyTable?.journeyCategory,
    record.categoryName && record.categoryName !== verticalCategory.name ? record.categoryName : "",
    category?.name && category.name !== verticalCategory.name ? category.name : "",
  ];
  const sourceId = sourceIdCandidates.find((candidate) => String(candidate ?? "").trim()) ?? "";
  const sourceName = sourceNameCandidates.find((candidate) => String(candidate ?? "").trim()) ?? "General";
  return {
    id: slugifyValue(sourceId || sourceName, `${verticalCategory.id}-general`),
    name: String(sourceName || "General").trim() || "General",
  };
}

function compactText(value, max = 88) {
  const cleaned = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "";
  }
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function channelsFromTouchpoints(touchpoints = []) {
  const seen = new Set();
  touchpoints.forEach((touchpoint) => {
    const raw = touchpoint?.channel;
    const values = Array.isArray(raw) ? raw : [raw];
    values.forEach((entry) => {
      const key = String(entry ?? "").trim().toUpperCase();
      if (key) {
        seen.add(key);
      }
    });
  });
  return seen;
}

function firstTouchpointByChannel(touchpoints = [], channel, skip = 0) {
  const needle = String(channel ?? "").trim().toUpperCase();
  if (!needle) {
    return null;
  }
  let seen = 0;
  for (const touchpoint of touchpoints) {
    const values = Array.isArray(touchpoint?.channel) ? touchpoint.channel : [touchpoint?.channel];
    const match = values.some((entry) => String(entry ?? "").trim().toUpperCase() === needle);
    if (!match) {
      continue;
    }
    if (seen === skip) {
      return touchpoint;
    }
    seen += 1;
  }
  return null;
}

function summarizeCondition(condition) {
  const field = condition?.field ? String(condition.field) : "condition";
  const operator = condition?.operator ? String(condition.operator).replace(/_/g, " ").toLowerCase() : "is";
  const value = condition?.value !== undefined ? String(condition.value) : "";
  return compactText(`${field} ${operator} ${value}`, 56);
}

function normalizeDurationLabel(value, fallback = "21 days") {
  const match = String(value ?? "").match(/(\d+)\s*day/i);
  if (!match) {
    return fallback;
  }
  return `${Number(match[1])} days`;
}

function normalizeFrequencyCap(config) {
  const max = Number(config?.maxMessagesPerUser);
  const windowDays = Number(config?.timeWindowDays);
  if (!Number.isFinite(max) || max <= 0) {
    return "Max 3 per week";
  }
  if (Number.isFinite(windowDays) && windowDays > 0) {
    return `Max ${max} per ${windowDays} days`;
  }
  return `Max ${max} per week`;
}

const DEFAULT_JOURNEY_FORM_TEMPLATE = {
  name: "Playoff Ticket Urgency - Game 62",
  objective:
    "Drive incremental ticket purchases for Game 62 using urgency-based orchestration, Gold tier personalization, and a controlled holdout for lift measurement.",
  entryTrigger: "audienceQualified",
  audience: "LAC_PlayoffPush_3GameAttendees",
  channels: {
    email: true,
    push: true,
    sms: false,
    inApp: false,
  },
  duration: "21 days",
  frequencyCap: "Max 3 per week",
  variantA: "Standard playoff cadence",
  variantB: "Personalized plus Gold early access",
  split: 50,
  holdout: 10,
  attribution: "Last-touch (21-day)",
};

const DEFAULT_ORCHESTRATION_FORM = {
  orchestrationType: "journey",
  singleChannel: "email",
  singleTriggerType: "event",
  singleTriggerEvent: "audienceQualified",
  singleSendOffsetHours: 0,
  singleOutcomeWindowHours: 24,
  singleUseHoldout: true,
  singleUseAB: false,
};

const SINGLE_TOUCHPOINT_CHANNELS = {
  email: {
    lane: "email",
    accent: "#C89B3C",
    label: "Email Touchpoint",
    templateId: "ajo_email_single_touch",
    cjaEvents: "emailSend, emailDelivery, emailOpen, emailClick",
  },
  push: {
    lane: "push",
    accent: "#F59E0B",
    label: "Push Touchpoint",
    templateId: "ajo_push_single_touch",
    cjaEvents: "pushSend, pushOpen, pushClick",
  },
  sms: {
    lane: "push",
    accent: "#0FB8B8",
    label: "SMS Touchpoint",
    templateId: "ajo_sms_single_touch",
    cjaEvents: "smsSend, smsDelivery, smsClick",
  },
  inApp: {
    lane: "push",
    accent: "#8B5CF6",
    label: "In-App Touchpoint",
    templateId: "ajo_inapp_single_touch",
    cjaEvents: "inAppDisplay, inAppClick",
  },
};

function channelTitleFromKey(channel) {
  if (channel === "inApp") {
    return "In-App";
  }
  return String(channel ?? "email")
    .trim()
    .toUpperCase();
}

function withBlueprintDefaults(form = {}) {
  const merged = {
    ...clone(DEFAULT_ORCHESTRATION_FORM),
    ...clone(form ?? {}),
  };
  const validChannels = Object.keys(SINGLE_TOUCHPOINT_CHANNELS);
  if (!validChannels.includes(merged.singleChannel)) {
    merged.singleChannel = DEFAULT_ORCHESTRATION_FORM.singleChannel;
  }
  if (!["event", "scheduled"].includes(merged.singleTriggerType)) {
    merged.singleTriggerType = DEFAULT_ORCHESTRATION_FORM.singleTriggerType;
  }
  merged.singleSendOffsetHours = clamp(Number(merged.singleSendOffsetHours ?? 0), 0, 168);
  merged.singleOutcomeWindowHours = clamp(Number(merged.singleOutcomeWindowHours ?? 24), 1, 168);
  merged.singleUseHoldout = Boolean(merged.singleUseHoldout);
  merged.singleUseAB = Boolean(merged.singleUseAB);
  return merged;
}

function phaseLabelFromChannel(channel) {
  if (channel === "inApp") {
    return "In-App";
  }
  return String(channel ?? "email")
    .trim()
    .toUpperCase();
}

const BASE_FLOW_NODES = [
  {
    id: "n0",
    lane: "trigger",
    column: 0,
    kind: "start",
    title: ["Audience", "Qualified"],
    subtitle: [">=3 home games", "no ticket 14d"],
    accent: "#2680EB",
  },
  {
    id: "n1",
    lane: "trigger",
    column: 1,
    kind: "holdout",
    title: ["Holdout", "Gate"],
    subtitle: ["10% exit", "no messages"],
    accent: "#0FB8B8",
  },
  {
    id: "n2",
    lane: "trigger",
    column: 2,
    kind: "split",
    title: ["A/B", "Split"],
    subtitle: ["50% Var A", "50% Var B"],
    accent: "#8B5CF6",
  },
  {
    id: "n3",
    lane: "email",
    column: 3,
    kind: "action",
    title: ["Email 1A"],
    subtitle: ["D-7 generic", "primary CTA"],
    accent: "#C89B3C",
  },
  {
    id: "n3b",
    lane: "email",
    column: 3,
    kind: "action",
    title: ["Email 1B"],
    subtitle: ["D-7 personalized", "Gold offer"],
    accent: "#E5C97A",
    variantBadge: "VAR B",
    offsetY: 74,
  },
  {
    id: "n4",
    lane: "decision",
    column: 4,
    kind: "decision",
    title: ["Email", "Opened?"],
    subtitle: ["24h check", "branch next"],
    accent: "#8B5CF6",
  },
  {
    id: "n5",
    lane: "trigger",
    column: 5,
    kind: "wait",
    title: ["Wait 2d"],
    subtitle: ["post-open", "monitor buy"],
    accent: "#4A9EF5",
  },
  {
    id: "n6",
    lane: "push",
    column: 6,
    kind: "action",
    title: ["Push 1"],
    subtitle: ["D-5 urgency", "deep link"],
    accent: "#F59E0B",
  },
  {
    id: "n7",
    lane: "decision",
    column: 7,
    kind: "decision",
    title: ["Push", "Clicked?"],
    subtitle: ["24h check", "branch next"],
    accent: "#8B5CF6",
  },
  {
    id: "n8",
    lane: "trigger",
    column: 8,
    kind: "wait",
    title: ["Wait 2d"],
    subtitle: ["retargeting", "purchase watch"],
    accent: "#4A9EF5",
  },
  {
    id: "n9",
    lane: "email",
    column: 9,
    kind: "action",
    title: ["Email 2B"],
    subtitle: ["Gold follow-up", "offer close"],
    accent: "#E5C97A",
    variantBadge: "VAR B",
  },
  {
    id: "n10",
    lane: "push",
    column: 10,
    kind: "action",
    title: ["Push 2"],
    subtitle: ["D-1 last chance", "app link"],
    accent: "#F59E0B",
  },
  {
    id: "n11",
    lane: "decision",
    column: 11,
    kind: "decision",
    title: ["Ticket", "Purchased?"],
    subtitle: ["conversion", "or timeout"],
    accent: "#8B5CF6",
  },
  {
    id: "n12",
    lane: "exit",
    column: 12,
    kind: "end",
    title: ["Exit", "Converted"],
    subtitle: ["purchase", "captured"],
    accent: "#22C55E",
  },
  {
    id: "n13",
    lane: "exit",
    column: 12,
    kind: "endDashed",
    title: ["Exit", "21d TTL"],
    subtitle: ["time-to-live", "expired"],
    accent: "#4A5568",
    offsetY: 74,
  },
  {
    id: "n14",
    lane: "exit",
    column: 1,
    kind: "end",
    title: ["Exit", "Holdout"],
    subtitle: ["baseline", "measure only"],
    accent: "#0FB8B8",
    offsetY: 74,
  },
];

const BASE_FLOW_EDGES = [
  { id: "e0", from: "n0", to: "n1", type: "flow", label: "" },
  { id: "e1", from: "n1", to: "n2", type: "flow", label: "90%" },
  { id: "e2", from: "n1", to: "n14", type: "holdout", label: "10%" },
  { id: "e3", from: "n2", to: "n3", type: "varA", label: "Var A" },
  { id: "e4", from: "n2", to: "n3b", type: "varB", label: "Var B" },
  { id: "e5", from: "n3", to: "n4", type: "flow", label: "" },
  { id: "e6", from: "n3b", to: "n4", type: "flow", label: "" },
  { id: "e7", from: "n4", to: "n5", type: "yes", label: "Yes" },
  { id: "e8", from: "n4", to: "n6", type: "no", label: "No" },
  { id: "e9", from: "n5", to: "n6", type: "flow", label: "" },
  { id: "e10", from: "n6", to: "n7", type: "flow", label: "" },
  { id: "e11", from: "n7", to: "n8", type: "yes", label: "Yes" },
  { id: "e12", from: "n7", to: "n11", type: "no", label: "No" },
  { id: "e13", from: "n8", to: "n9", type: "varB", label: "Var B" },
  { id: "e14", from: "n8", to: "n10", type: "flow", label: "" },
  { id: "e15", from: "n9", to: "n11", type: "flow", label: "" },
  { id: "e16", from: "n10", to: "n11", type: "flow", label: "" },
  { id: "e17", from: "n11", to: "n12", type: "yes", label: "Yes" },
  { id: "e18", from: "n11", to: "n13", type: "no", label: "No" },
];

function buildVerticalTemplateOverrides(categoryId, context = {}) {
  if (categoryId !== JOURNEY_VERTICAL_CATEGORIES.automotive.id) {
    return {
      nodeOverrides: {},
      detailOverrides: {},
    };
  }

  const audience = context.audience || "Automotive_Service_Audience";
  const duration = context.duration || "journey window";

  return {
    nodeOverrides: {
      n0: {
        title: ["Audience", "Qualified"],
        subtitle: ["service-ready", "audience refresh"],
      },
      n3: {
        title: ["Email 1A"],
        subtitle: ["service due", "book your slot"],
      },
      n3b: {
        title: ["Email 1B"],
        subtitle: ["personalized care", "offer reminder"],
      },
      n5: {
        title: ["Wait 2d"],
        subtitle: ["post-open", "service watch"],
      },
      n6: {
        title: ["Push 1"],
        subtitle: ["book service", "app deep link"],
      },
      n8: {
        title: ["Wait 2d"],
        subtitle: ["retargeting", "booking watch"],
      },
      n9: {
        title: ["Email 2B"],
        subtitle: ["follow-up", "close the booking"],
      },
      n10: {
        title: ["Push 2"],
        subtitle: ["last reminder", "schedule now"],
      },
      n11: {
        title: ["Service", "Booked?"],
        subtitle: ["appointment", "or follow-up"],
      },
      n12: {
        title: ["Exit", "Booked"],
        subtitle: ["service", "scheduled"],
      },
      n13: {
        title: ["Exit", "No Response"],
        subtitle: ["nurture", "expired"],
      },
    },
    detailOverrides: {
      n0: {
        rows: [
          { key: "segment", value: audience },
          { key: "conditions", value: "service or maintenance audience qualified" },
          { key: "entryEvent", value: "audienceQualified" },
          { key: "cjaEvents", value: "journeyEntry, audienceQualified" },
        ],
        note: "Automotive journeys enter from a qualified service or maintenance audience.",
      },
      n3: {
        rows: [
          { key: "templateId", value: "ajo_email_service_var_a" },
          { key: "subject", value: "Your vehicle may be due for service soon" },
          { key: "sendTime", value: "Journey sequence - first service reminder" },
          { key: "cjaEvents", value: "emailSend, emailDelivery, emailOpen" },
        ],
        note: "Variant A uses a straightforward service reminder to encourage booking without a heavy incentive.",
      },
      n3b: {
        rows: [
          { key: "templateId", value: "ajo_email_service_var_b" },
          { key: "subject", value: "{{first_name}}, reserve care for your {{vehicle_model}}" },
          { key: "sendTime", value: "Journey sequence - personalized reminder" },
          { key: "cjaEvents", value: "emailSend, emailDelivery, emailOpen" },
        ],
        note: "Variant B adds vehicle-aware personalization and value messaging for higher-intent owners.",
      },
      n5: {
        rows: [
          { key: "duration", value: "P2D" },
          { key: "exitRule", value: "exit early if a service booking or lead is captured" },
          { key: "reEval", value: "check appointment and lead events every 4h" },
          { key: "cjaEvents", value: "waitEntered, waitCompleted" },
        ],
        note: "The wait step gives owners a short buffer to act before another service reminder is sent.",
      },
      n6: {
        rows: [
          { key: "templateId", value: "ajo_push_service_reminder" },
          { key: "message", value: "Reserve your preferred service slot now" },
          { key: "deepLink", value: "brandapp://service/schedule?vehicle={{vehicle_id}}" },
          { key: "cjaEvents", value: "pushSend, pushOpen, pushClick" },
        ],
        note: "Push 1 is designed to convert intent into a booking with a direct path into service scheduling.",
      },
      n8: {
        rows: [
          { key: "duration", value: "P2D" },
          { key: "exitRule", value: "exit early when a booking is confirmed" },
          { key: "monitor", value: "watch appointmentBooked, serviceLeadSubmitted, bookingStarted" },
          { key: "cjaEvents", value: "waitEntered, waitCompleted" },
        ],
        note: "The retargeting wait monitors service-intent signals without over-messaging engaged owners.",
      },
      n9: {
        rows: [
          { key: "templateId", value: "ajo_email_service_followup_var_b" },
          { key: "subject", value: "A convenient service slot is still available" },
          { key: "eligibility", value: "owners with recent service interest" },
          { key: "cjaEvents", value: "emailSend, emailDelivery, emailOpen, bookingAssist" },
        ],
        note: "This follow-up closes the journey with a convenience-led reminder for owners who showed interest.",
      },
      n10: {
        rows: [
          { key: "templateId", value: "ajo_push_service_last_call" },
          { key: "message", value: "Final reminder to schedule your vehicle service" },
          { key: "deepLink", value: "brandapp://service/schedule" },
          { key: "cjaEvents", value: "pushSend, pushOpen, pushClick, bookingAssist" },
        ],
        note: "Push 2 is the final reminder before the service nurture window expires.",
      },
      n11: {
        title: "Service Booked?",
        rows: [
          { key: "condition", value: `service appointment booked or lead submitted within ${duration}` },
          { key: "yesPath", value: "Exit Booked" },
          { key: "noPath", value: "Exit No Response" },
          { key: "cjaEvents", value: "conversionChecked, pathRouted" },
        ],
        note: "Automotive conversion checks for a service booking or lead submission.",
      },
      n12: {
        title: "Exit Booked",
        rows: [
          { key: "trigger", value: "service appointment confirmed" },
          { key: "suppression", value: "stop remaining service reminders" },
          { key: "cjaEvents", value: "serviceAppointmentBooked, journeyConversion" },
          { key: "downstream", value: "eligible for service follow-up journey" },
        ],
        note: "Owners exit immediately once a booking is captured so follow-up journeys can take over.",
      },
      n13: {
        title: "Exit No Response",
        rows: [
          { key: "trigger", value: "journey reached time-to-live without a booking" },
          { key: "status", value: "no appointment or lead captured" },
          { key: "cjaEvents", value: "journeyExpired, noResponse" },
          { key: "downstream", value: "return to maintenance nurture pool" },
        ],
        note: "No-response exits keep the profile eligible for future maintenance and care journeys.",
      },
    },
  };
}

function mergeOverrideMaps(...maps) {
  return maps.reduce((acc, map) => {
    Object.entries(map ?? {}).forEach(([id, override]) => {
      acc[id] = {
        ...(acc[id] ?? {}),
        ...clone(override),
      };
    });
    return acc;
  }, {});
}

export const NODE_DETAILS = {
  n0: {
    title: "Audience Entry",
    kind: "start",
    accent: "#2680EB",
    rows: [
      { key: "segment", value: "LAC_PlayoffPush_3GameAttendees" },
      { key: "conditions", value: "homeGameAttend >= 3 in 45d\nno ticketPurchase for Game 62 in 14d" },
      { key: "entryEvent", value: "audienceQualified" },
      { key: "cjaEvents", value: "journeyEntry, audienceQualified" },
    ],
    note: "Entry is audience-driven in AJO and starts only after the qualification audience refresh completes.",
  },
  n1: {
    title: "Holdout Gate",
    kind: "holdout",
    accent: "#0FB8B8",
    rows: [
      { key: "holdoutPct", value: "10%" },
      { key: "assignment", value: "deterministic hash on fanId" },
      { key: "exitRule", value: "immediate exit with passive measurement" },
      { key: "cjaEvents", value: "holdoutAssigned, liftBaselineTracked" },
    ],
    note: "This node protects incrementality measurement by excluding the holdout population from message delivery.",
  },
  n2: {
    title: "A/B Split",
    kind: "split",
    accent: "#8B5CF6",
    rows: [
      { key: "variantA", value: "50% standard cadence" },
      { key: "variantB", value: "50% personalized plus Gold early access" },
      { key: "assignment", value: "stable hash on fanId" },
      { key: "cjaEvents", value: "experimentAssigned, experimentExposure" },
    ],
    note: "The split is deterministic so repeat entry checks keep a profile in the same arm.",
  },
  n3: {
    title: "Email 1A",
    kind: "action",
    accent: "#C89B3C",
    rows: [
      { key: "templateId", value: "ajo_email_playoff_var_a" },
      { key: "subject", value: "Playoffs are almost here - lock in Game 62" },
      { key: "sendTime", value: "D-7 at 10:00 AM PT" },
      { key: "cjaEvents", value: "emailSend, emailDelivery, emailOpen" },
    ],
    note: "Variant A is the control arm and keeps the message general with urgency-driven copy.",
  },
  n3b: {
    title: "Email 1B",
    kind: "action",
    accent: "#E5C97A",
    rows: [
      { key: "templateId", value: "ajo_email_playoff_var_b" },
      { key: "subject", value: "{{first_name}}, your section {{seat_section}} is almost sold out" },
      { key: "sendTime", value: "D-7 at 10:00 AM PT" },
      { key: "cjaEvents", value: "emailSend, emailDelivery, emailOpen" },
    ],
    note: "Variant B injects seat and tier personalization to test incremental lift over the control arm.",
  },
  n4: {
    title: "Email Opened?",
    kind: "decision",
    accent: "#8B5CF6",
    rows: [
      { key: "condition", value: "emailOpen within 24h" },
      { key: "yesPath", value: "wait 2 days before push" },
      { key: "noPath", value: "advance directly to push urgency" },
      { key: "cjaEvents", value: "decisionEvaluated, pathRouted" },
    ],
    note: "This branch reduces over-messaging for profiles that already signaled interest with an open.",
  },
  n5: {
    title: "Wait 2d",
    kind: "wait",
    accent: "#4A9EF5",
    rows: [
      { key: "duration", value: "P2D" },
      { key: "exitRule", value: "exit early if ticketPurchase is observed" },
      { key: "reEval", value: "check purchase event every 4h" },
      { key: "cjaEvents", value: "waitEntered, waitCompleted" },
    ],
    note: "The wait node gives opened-email profiles a short buffer before the next paid-media touch.",
  },
  n6: {
    title: "Push 1",
    kind: "action",
    accent: "#F59E0B",
    rows: [
      { key: "templateId", value: "ajo_push_urgency_d5" },
      { key: "message", value: "Only a limited number of seats remain for Game 62" },
      { key: "deepLink", value: "clippers://tickets/game-62?section={{seat_section}}" },
      { key: "cjaEvents", value: "pushSend, pushOpen, pushClick" },
    ],
    note: "Push 1 is tuned for urgency and uses app deep linking when the profile is app-capable.",
  },
  n7: {
    title: "Push Clicked?",
    kind: "decision",
    accent: "#8B5CF6",
    rows: [
      { key: "condition", value: "pushClick within 24h" },
      { key: "yesPath", value: "hold two days then continue nurturing" },
      { key: "noPath", value: "jump to purchase decision checkpoint" },
      { key: "cjaEvents", value: "decisionEvaluated, pushEngagement" },
    ],
    note: "Push engagement is treated as a high-intent signal, so the next message is delayed slightly.",
  },
  n8: {
    title: "Wait 2d",
    kind: "wait",
    accent: "#4A9EF5",
    rows: [
      { key: "duration", value: "P2D" },
      { key: "exitRule", value: "exit early on ticketPurchase" },
      { key: "monitor", value: "watch orderComplete and checkoutStart" },
      { key: "cjaEvents", value: "waitEntered, waitCompleted" },
    ],
    note: "The retargeting wait keeps the journey from becoming noisy while conversion signals are monitored.",
  },
  n9: {
    title: "Email 2B",
    kind: "action",
    accent: "#E5C97A",
    rows: [
      { key: "templateId", value: "ajo_email_gold_offer_var_b" },
      { key: "subject", value: "Your Gold early access window is closing" },
      { key: "eligibility", value: "loyaltyTier = Gold" },
      { key: "cjaEvents", value: "emailSend, emailDelivery, emailOpen, purchaseAssist" },
    ],
    note: "This message only applies to Variant B and is designed to close with an exclusive Gold offer.",
  },
  n10: {
    title: "Push 2",
    kind: "action",
    accent: "#F59E0B",
    rows: [
      { key: "templateId", value: "ajo_push_last_chance_d1" },
      { key: "message", value: "Game 62 is tomorrow - this is the final chance to buy" },
      { key: "deepLink", value: "clippers://tickets/game-62" },
      { key: "cjaEvents", value: "pushSend, pushOpen, pushClick, purchaseAssist" },
    ],
    note: "Push 2 is the final urgency touch and is intended to capture last-minute converters.",
  },
  n11: {
    title: "Ticket Purchased?",
    kind: "decision",
    accent: "#8B5CF6",
    rows: [
      { key: "condition", value: "ticketPurchase for Game 62 within 21d" },
      { key: "yesPath", value: "Exit Converted" },
      { key: "noPath", value: "Exit 21d TTL" },
      { key: "cjaEvents", value: "conversionChecked, pathRouted" },
    ],
    note: "This decision is the primary conversion checkpoint used by both AJO exit logic and CJA reporting.",
  },
  n12: {
    title: "Exit Converted",
    kind: "end",
    accent: "#22C55E",
    rows: [
      { key: "trigger", value: "ticketPurchase confirmed" },
      { key: "suppression", value: "stop all remaining messages" },
      { key: "cjaEvents", value: "journeyConversion, orderComplete" },
      { key: "downstream", value: "eligible for upsell or post-purchase journey" },
    ],
    note: "Converted profiles exit immediately and become eligible for the next fan-life-cycle experience.",
  },
  n13: {
    title: "Exit 21d TTL",
    kind: "end",
    accent: "#4A5568",
    rows: [
      { key: "trigger", value: "journey reached 21-day time-to-live" },
      { key: "suppression", value: "remove from active journey audience" },
      { key: "cjaEvents", value: "journeyExpired" },
      { key: "downstream", value: "eligible for lapsed win-back audience" },
    ],
    note: "TTL expiration closes the play without a conversion and prepares the profile for re-engagement logic.",
  },
  n14: {
    title: "Exit Holdout",
    kind: "end",
    accent: "#0FB8B8",
    rows: [
      { key: "trigger", value: "holdout gate selected profile" },
      { key: "delivery", value: "no outbound channel actions" },
      { key: "cjaEvents", value: "holdoutAssigned, passiveLiftTracking" },
      { key: "downstream", value: "used only for incrementality comparison" },
    ],
    note: "Holdout profiles never receive the journey treatment, but their downstream outcomes are still measured.",
  },
};

export const BLUEPRINT_PROGRESS = [
  { percent: 16, message: "Parsing brief..." },
  { percent: 38, message: "Mapping audience and holdout logic..." },
  { percent: 61, message: "Placing journey nodes..." },
  { percent: 84, message: "Routing decisions and exits..." },
  { percent: 100, message: "Flowchart ready" },
];

export const CONFIG_PROGRESS = [
  { percent: 18, message: "Parsing objective..." },
  { percent: 36, message: "Validating audience inputs..." },
  { percent: 58, message: "Generating canvas..." },
  { percent: 79, message: "Configuring measurement..." },
  { percent: 100, message: "Journey config ready" },
];

export const DATA_CONNECTORS = [
  {
    id: "databricks",
    name: "Databricks Lakehouse",
    type: "Warehouse",
    status: "Connected",
    freshness: "15 min",
    entities: "Orders, attendance, merchandising",
    accent: "#F97316",
  },
  {
    id: "bigquery",
    name: "Google BigQuery",
    type: "Warehouse",
    status: "Connected",
    freshness: "30 min",
    entities: "Digital behavior, campaign exports, KPI marts",
    accent: "#60A5FA",
  },
  {
    id: "aep",
    name: "Adobe Experience Platform",
    type: "Profile Store",
    status: "Primary",
    freshness: "Streaming",
    entities: "Identity graph, consent, profile fragments",
    accent: "#EF4444",
  },
  {
    id: "blob",
    name: "Azure Blob Storage",
    type: "Object Store",
    status: "Connected",
    freshness: "Batch / 2h",
    entities: "Landing zone, model outputs, archive snapshots",
    accent: "#22C55E",
  },
  {
    id: "local",
    name: "Local System",
    type: "Flat Files / CSV",
    status: "Upload CSV",
    freshness: "Manual",
    entities: "Ad hoc profile seeds, campaign inputs, suppression files",
    accent: "#EAB308",
  },
];

export const PROFILE_WORKSPACE_CARDS = [];

export const SEGMENT_STATUS_OPTIONS = [
  "Production ready",
  "Ready for activation",
  "In QA review",
  "Needs review",
  "Draft",
];

export const SEGMENT_RULE_FIELD_OPTIONS = [
  "LTV Tier",
  "Recency",
  "Engagement Tier",
  "Content Affinity",
];

export const SEGMENT_RULE_VALUE_OPTIONS = ["High", "Medium", "Low"];

function rulesFor(...pairs) {
  return pairs.map(([field, value], index) => ({
    id: `rule_${index + 1}`,
    field,
    value,
    joiner: index === 0 ? "" : "AND",
  }));
}

export const SEGMENT_LIBRARY = [
  {
    id: "seg-01",
    name: "Recent_Event_Attendees_No_Purchase",
    purpose: "Ticketing conversion",
    size: "8.4K",
    refresh: "Streaming + 15m batch",
    exclusions: "Opt-out, active journey, premium buyers",
    status: "Ready for activation",
    rules: rulesFor(["LTV Tier", "High"], ["Recency", "Medium"]),
  },
  {
    id: "seg-02",
    name: "Subscription_Renewal_Window_10d",
    purpose: "Renewal urgency",
    size: "6.2K",
    refresh: "Hourly",
    exclusions: "Renewed, do-not-renew, collections",
    status: "Production ready",
    rules: rulesFor(["LTV Tier", "High"], ["Engagement Tier", "High"]),
  },
  {
    id: "seg-03",
    name: "Recent_Attendees_No_App_30d",
    purpose: "Engagement reactivation",
    size: "7.9K",
    refresh: "Nightly + app stream",
    exclusions: "Recent sessions, recent purchasers",
    status: "Ready for activation",
    rules: rulesFor(["Recency", "Medium"], ["Content Affinity", "High"]),
  },
  {
    id: "seg-04",
    name: "Lapsed_Customers_45d",
    purpose: "Win-back",
    size: "5.7K",
    refresh: "Daily",
    exclusions: "Recent buyers, global holdout",
    status: "In QA review",
    rules: rulesFor(["Recency", "Low"], ["Engagement Tier", "Low"]),
  },
  {
    id: "seg-05",
    name: "Recent_Merch_Buyers_90d",
    purpose: "Commerce retention",
    size: "4.8K",
    refresh: "Daily",
    exclusions: "Recent pre-order registrants",
    status: "Production ready",
    rules: rulesFor(["Content Affinity", "High"], ["LTV Tier", "Medium"]),
  },
  {
    id: "seg-06",
    name: "Premium_Browsers_14d",
    purpose: "High-value lead nurture",
    size: "2.1K",
    refresh: "Hourly",
    exclusions: "Open opportunities, suppressed leads",
    status: "Draft",
    rules: rulesFor(["LTV Tier", "High"], ["Content Affinity", "Medium"]),
  },
  {
    id: "seg-07",
    name: "App_Dormant_21d",
    purpose: "App return",
    size: "9.6K",
    refresh: "Hourly",
    exclusions: "New installs, active subscribers",
    status: "Ready for activation",
    rules: rulesFor(["Engagement Tier", "Low"], ["Recency", "Medium"]),
  },
  {
    id: "seg-08",
    name: "High_Value_Return_60d",
    purpose: "Retention expansion",
    size: "3.4K",
    refresh: "Daily",
    exclusions: "Current journeys, unresolved cases",
    status: "Needs review",
    rules: rulesFor(["LTV Tier", "Medium"], ["Content Affinity", "Low"]),
  },
];

export function buildAudienceWorkspaceCards(segments = SEGMENT_LIBRARY) {
  const countByStatus = SEGMENT_STATUS_OPTIONS.reduce((acc, status) => {
    acc[status] = segments.filter((segment) => segment.status === status).length;
    return acc;
  }, {});
  return [
    {
      title: "Audience Pipeline",
      accent: "#8B5CF6",
      metrics: [
        ["Production segments", String(segments.length)],
        ["Ready for activation", String(countByStatus["Ready for activation"])],
        ["Production ready", String(countByStatus["Production ready"])],
        ["In QA review", String(countByStatus["In QA review"])],
      ],
    },
  ];
}

export const TEST_SUITES = [
  { id: "TS-01", name: "Audience Qualification", description: "Correct fans enter the journey", testCount: 8 },
  { id: "TS-02", name: "Suppression & Exclusions", description: "Opt-out, holdout, and active journey rules", testCount: 6 },
  { id: "TS-03", name: "Experiment Traffic Split", description: "A/B allocation and holdback routing", testCount: 4 },
  { id: "TS-04", name: "Personalization Rendering", description: "Token expansion and subject line rendering", testCount: 12 },
  { id: "TS-05", name: "Channel Delivery", description: "Email and push readiness checks", testCount: 8 },
  { id: "TS-06", name: "Wait Node Timing", description: "Wait-node duration and timeout logic", testCount: 5 },
  { id: "TS-07", name: "Exit Condition Logic", description: "Conversion exit and TTL evaluation", testCount: 6 },
  { id: "TS-08", name: "CJA Event Firing", description: "Analytics emission to CJA", testCount: 7 },
];

export const AUTOMATION_PLAYBOOK = [
  {
    title: "Synthetic Regression Run",
    accent: "#0FB8B8",
    note: "Nightly profile simulation across the top three production journeys with holdout and suppression assertions.",
  },
  {
    title: "Token Render Audit",
    accent: "#2680EB",
    note: "Checks subject lines, push copy, deep links, and personalization fallbacks before activation.",
  },
  {
    title: "CJA Event Monitor",
    accent: "#C89B3C",
    note: "Verifies that entry, exposure, click, and conversion events reconcile between AJO and CJA workspaces.",
  },
];

export const PROFILES = [
  {
    id: "SP-001",
    name: "Marcus T.",
    type: "Season Ticket Gold",
    segment: "ClippersFaithful_Gold",
    games: 12,
    lastGame: "2026-03-14",
    appActive: false,
    loyaltyPoints: 8400,
    fanId: "FAN-100284",
    expectedOutcome: "Variant B Gold early access",
    expectedTone: "teal",
  },
  {
    id: "SP-002",
    name: "Priya K.",
    type: "Single-game buyer",
    segment: "SingleGame_FirstTime",
    games: 1,
    lastGame: "2026-03-13",
    appActive: true,
    loyaltyPoints: 260,
    fanId: "FAN-100913",
    expectedOutcome: "Variant A standard cadence",
    expectedTone: "teal",
  },
  {
    id: "SP-003",
    name: "DeShawn R.",
    type: "Lapsed 45d",
    segment: "Lapsed_45d",
    games: 6,
    lastGame: "2026-02-01",
    appActive: false,
    loyaltyPoints: 3180,
    fanId: "FAN-101772",
    expectedOutcome: "Variant B re-engagement",
    expectedTone: "teal",
  },
  {
    id: "SP-004",
    name: "Opted-out fan",
    type: "Suppressed",
    segment: "MarketingOptOut",
    games: 3,
    lastGame: "2026-03-10",
    appActive: false,
    loyaltyPoints: 960,
    fanId: "FAN-102011",
    expectedOutcome: "EXCLUDED opt-out suppression",
    expectedTone: "amber",
  },
  {
    id: "SP-005",
    name: "Holdout fan",
    type: "Holdout group",
    segment: "Holdout_10pct",
    games: 8,
    lastGame: "2026-03-14",
    appActive: true,
    loyaltyPoints: 5210,
    fanId: "FAN-102408",
    expectedOutcome: "EXCLUDED holdout group",
    expectedTone: "amber",
  },
  {
    id: "SP-006",
    name: "Active journey fan",
    type: "In active journey",
    segment: "ActiveJourney",
    games: 4,
    lastGame: "2026-03-09",
    appActive: true,
    loyaltyPoints: 1830,
    fanId: "FAN-102911",
    expectedOutcome: "EXCLUDED active journey",
    expectedTone: "amber",
  },
];

const MEDIA_TEST_SUITES = [
  { id: "TS-01", name: "Audience Qualification", description: "Eligible subscribers enter the lifecycle journey", testCount: 8 },
  { id: "TS-02", name: "Suppression & Exclusions", description: "Opt-out, active journey, and do-not-contact rules", testCount: 6 },
  { id: "TS-03", name: "Experiment Traffic Split", description: "A/B allocation and holdback routing", testCount: 4 },
  { id: "TS-04", name: "Personalization Rendering", description: "Token expansion for plan, genre, and tenure fields", testCount: 12 },
  { id: "TS-05", name: "Channel Delivery", description: "Email, push, and in-app delivery readiness checks", testCount: 8 },
  { id: "TS-06", name: "Wait Node Timing", description: "Delay, cooldown, and session-window logic", testCount: 5 },
  { id: "TS-07", name: "Exit Condition Logic", description: "Conversion, stream-start, and TTL evaluation", testCount: 6 },
  { id: "TS-08", name: "CJA Event Firing", description: "Analytics emission for subscriber lifecycle events", testCount: 7 },
];

const TELECOM_TEST_SUITES = [
  { id: "TS-01", name: "Audience Qualification", description: "Eligible subscribers enter the offer or care journey", testCount: 8 },
  { id: "TS-02", name: "Suppression & Exclusions", description: "DND, consent, collections, and active journey rules", testCount: 6 },
  { id: "TS-03", name: "Experiment Traffic Split", description: "A/B allocation and holdback routing", testCount: 4 },
  { id: "TS-04", name: "Personalization Rendering", description: "Token expansion for plan, bill date, and offer code fields", testCount: 12 },
  { id: "TS-05", name: "Channel Delivery", description: "SMS, push, email, and app delivery readiness checks", testCount: 8 },
  { id: "TS-06", name: "Wait Node Timing", description: "Delay, recharge window, and cooldown timing checks", testCount: 5 },
  { id: "TS-07", name: "Exit Condition Logic", description: "Recharge, upgrade, save, and TTL evaluation", testCount: 6 },
  { id: "TS-08", name: "CJA Event Firing", description: "Analytics emission for telecom conversion and care events", testCount: 7 },
];

const AUTOMOTIVE_TEST_SUITES = [
  { id: "TS-01", name: "Audience Qualification", description: "Eligible service-due owners enter the journey", testCount: 8 },
  { id: "TS-02", name: "Suppression & Exclusions", description: "Opt-out, active service case, and open appointment rules", testCount: 6 },
  { id: "TS-03", name: "Experiment Traffic Split", description: "A/B allocation and holdback routing", testCount: 4 },
  { id: "TS-04", name: "Personalization Rendering", description: "Token expansion for vehicle, dealer, mileage, and offer fields", testCount: 12 },
  { id: "TS-05", name: "Channel Delivery", description: "Email, push, and service-app delivery readiness checks", testCount: 8 },
  { id: "TS-06", name: "Wait Node Timing", description: "Reminder spacing, cooldown, and follow-up timing checks", testCount: 5 },
  { id: "TS-07", name: "Exit Condition Logic", description: "Appointment booking, lead capture, and TTL evaluation", testCount: 6 },
  { id: "TS-08", name: "CJA Event Firing", description: "Analytics emission for service-intent and booking events", testCount: 7 },
];

const MEDIA_AUTOMATION_PLAYBOOK = [
  {
    title: "Subscriber Regression Run",
    accent: "#0FB8B8",
    note: "Nightly profile simulation across the top lifecycle journeys with suppression, holdout, and conversion assertions.",
  },
  {
    title: "Content Token Audit",
    accent: "#2680EB",
    note: "Checks genre, plan, tenure, and recommendation tokens before subscriber campaigns go live.",
  },
  {
    title: "Lifecycle Event Monitor",
    accent: "#C89B3C",
    note: "Verifies entry, stream-start, upsell, and conversion events reconcile between AJO and CJA.",
  },
];

const TELECOM_AUTOMATION_PLAYBOOK = [
  {
    title: "Offer Regression Run",
    accent: "#0FB8B8",
    note: "Nightly subscriber simulation across recharge, upgrade, and save journeys with consent and suppression assertions.",
  },
  {
    title: "Offer Token Audit",
    accent: "#2680EB",
    note: "Checks plan, bill-due, region, and offer-code tokens before outbound delivery begins.",
  },
  {
    title: "Recharge Event Monitor",
    accent: "#C89B3C",
    note: "Verifies recharge, upgrade, care, and holdout events reconcile between journey execution and analytics.",
  },
];

const AUTOMOTIVE_AUTOMATION_PLAYBOOK = [
  {
    title: "Service Regression Run",
    accent: "#0FB8B8",
    note: "Nightly owner simulation across service, maintenance, and upsell journeys with booking and suppression assertions.",
  },
  {
    title: "Dealer Token Audit",
    accent: "#2680EB",
    note: "Checks vehicle model, dealer, mileage, and incentive tokens before service reminders go live.",
  },
  {
    title: "Booking Event Monitor",
    accent: "#C89B3C",
    note: "Verifies service-intent, lead, booking, and exit events reconcile between AJO and CJA.",
  },
];

const MEDIA_PROFILES = [
  {
    id: "MD-001",
    name: "Elena M.",
    type: "Premium annual subscriber",
    segment: "Premium_Annual_Loyal",
    attributes: [
      { label: "Plan", value: "Premium Annual" },
      { label: "Last stream", value: "2026-03-16" },
      { label: "Watch hrs 30d", value: "44.2h" },
      { label: "App active", value: "Yes" },
      { label: "Tenure", value: "3.2 years" },
      { label: "Subscriber ID", value: "SUB-200284" },
    ],
    expectedOutcome: "Variant B content-personalized reminder",
    expectedTone: "teal",
    variantArm: "Variant B",
    simulationMode: "normal",
  },
  {
    id: "MD-002",
    name: "Rahul V.",
    type: "Lapsing family subscriber",
    segment: "Family_Plan_Lapsing_30d",
    attributes: [
      { label: "Plan", value: "Family Monthly" },
      { label: "Last stream", value: "2026-03-05" },
      { label: "Watch hrs 30d", value: "6.8h" },
      { label: "App active", value: "No" },
      { label: "Tenure", value: "1.4 years" },
      { label: "Subscriber ID", value: "SUB-200913" },
    ],
    expectedOutcome: "Variant A reactivation cadence",
    expectedTone: "teal",
    variantArm: "Variant A",
    simulationMode: "delivery-warning",
  },
  {
    id: "MD-003",
    name: "Dana C.",
    type: "Ad-tier binge viewer",
    segment: "AdTier_Binge_Return",
    attributes: [
      { label: "Plan", value: "Ad-supported Monthly" },
      { label: "Last stream", value: "2026-03-15" },
      { label: "Watch hrs 30d", value: "23.5h" },
      { label: "App active", value: "Yes" },
      { label: "Tenure", value: "2.1 years" },
      { label: "Subscriber ID", value: "SUB-201772" },
    ],
    expectedOutcome: "Variant B personalized content return",
    expectedTone: "teal",
    variantArm: "Variant B",
    simulationMode: "normal",
  },
  {
    id: "MD-004",
    name: "Opted-out subscriber",
    type: "Suppressed",
    segment: "MarketingOptOut",
    attributes: [
      { label: "Plan", value: "Premium Monthly" },
      { label: "Last stream", value: "2026-03-12" },
      { label: "Watch hrs 30d", value: "12.1h" },
      { label: "App active", value: "Yes" },
      { label: "Tenure", value: "2.8 years" },
      { label: "Subscriber ID", value: "SUB-202011" },
    ],
    expectedOutcome: "EXCLUDED opt-out suppression",
    expectedTone: "amber",
    variantArm: "Variant A",
    simulationMode: "opt-out",
  },
  {
    id: "MD-005",
    name: "Holdout subscriber",
    type: "Holdout group",
    segment: "Holdout_10pct",
    attributes: [
      { label: "Plan", value: "Standard Annual" },
      { label: "Last stream", value: "2026-03-14" },
      { label: "Watch hrs 30d", value: "18.4h" },
      { label: "App active", value: "Yes" },
      { label: "Tenure", value: "2.5 years" },
      { label: "Subscriber ID", value: "SUB-202408" },
    ],
    expectedOutcome: "EXCLUDED holdout group",
    expectedTone: "amber",
    variantArm: "Variant A",
    simulationMode: "holdout",
  },
  {
    id: "MD-006",
    name: "Active churn-save subscriber",
    type: "In active journey",
    segment: "ActiveJourney",
    attributes: [
      { label: "Plan", value: "Premium Monthly" },
      { label: "Last stream", value: "2026-03-09" },
      { label: "Watch hrs 30d", value: "9.3h" },
      { label: "App active", value: "Yes" },
      { label: "Tenure", value: "1.8 years" },
      { label: "Subscriber ID", value: "SUB-202911" },
    ],
    expectedOutcome: "EXCLUDED active journey",
    expectedTone: "amber",
    variantArm: "Variant A",
    simulationMode: "active-journey",
  },
];

const TELECOM_PROFILES = [
  {
    id: "TL-001",
    name: "Karan P.",
    type: "Postpaid family owner",
    segment: "Postpaid_Upgrade_Eligible",
    attributes: [
      { label: "Plan", value: "5G Family Max" },
      { label: "Last bill pay", value: "2026-03-15" },
      { label: "ARPU", value: "$84 / month" },
      { label: "App active", value: "Yes" },
      { label: "Tenure", value: "4.1 years" },
      { label: "Subscriber ID", value: "TEL-300284" },
    ],
    expectedOutcome: "Variant B upgrade offer",
    expectedTone: "teal",
    variantArm: "Variant B",
    simulationMode: "normal",
  },
  {
    id: "TL-002",
    name: "Meera S.",
    type: "Prepaid recharge risk",
    segment: "Prepaid_Recharge_Lapse_14d",
    attributes: [
      { label: "Plan", value: "Prepaid Unlimited" },
      { label: "Last recharge", value: "2026-02-28" },
      { label: "ARPU", value: "$19 / month" },
      { label: "App active", value: "No" },
      { label: "Tenure", value: "1.1 years" },
      { label: "Subscriber ID", value: "TEL-300913" },
    ],
    expectedOutcome: "Variant A recharge reminder",
    expectedTone: "teal",
    variantArm: "Variant A",
    simulationMode: "delivery-warning",
  },
  {
    id: "TL-003",
    name: "Arjun N.",
    type: "Fiber bundle cross-sell",
    segment: "Fiber_Bundle_Ready",
    attributes: [
      { label: "Plan", value: "Home Fiber 500" },
      { label: "Last bill pay", value: "2026-03-11" },
      { label: "ARPU", value: "$62 / month" },
      { label: "App active", value: "Yes" },
      { label: "Tenure", value: "2.7 years" },
      { label: "Subscriber ID", value: "TEL-301772" },
    ],
    expectedOutcome: "Variant B bundle upsell",
    expectedTone: "teal",
    variantArm: "Variant B",
    simulationMode: "normal",
  },
  {
    id: "TL-004",
    name: "DND subscriber",
    type: "Suppressed",
    segment: "MarketingOptOut",
    attributes: [
      { label: "Plan", value: "Postpaid Plus" },
      { label: "Last bill pay", value: "2026-03-13" },
      { label: "ARPU", value: "$41 / month" },
      { label: "App active", value: "Yes" },
      { label: "Tenure", value: "3.3 years" },
      { label: "Subscriber ID", value: "TEL-302011" },
    ],
    expectedOutcome: "EXCLUDED DND suppression",
    expectedTone: "amber",
    variantArm: "Variant A",
    simulationMode: "opt-out",
  },
  {
    id: "TL-005",
    name: "Holdout subscriber",
    type: "Holdout group",
    segment: "Holdout_10pct",
    attributes: [
      { label: "Plan", value: "5G Unlimited" },
      { label: "Last bill pay", value: "2026-03-14" },
      { label: "ARPU", value: "$58 / month" },
      { label: "App active", value: "Yes" },
      { label: "Tenure", value: "2.9 years" },
      { label: "Subscriber ID", value: "TEL-302408" },
    ],
    expectedOutcome: "EXCLUDED holdout group",
    expectedTone: "amber",
    variantArm: "Variant A",
    simulationMode: "holdout",
  },
  {
    id: "TL-006",
    name: "Active complaint case",
    type: "In active journey",
    segment: "ActiveJourney",
    attributes: [
      { label: "Plan", value: "5G Max" },
      { label: "Last bill pay", value: "2026-03-09" },
      { label: "ARPU", value: "$76 / month" },
      { label: "App active", value: "Yes" },
      { label: "Tenure", value: "3.7 years" },
      { label: "Subscriber ID", value: "TEL-302911" },
    ],
    expectedOutcome: "EXCLUDED active care journey",
    expectedTone: "amber",
    variantArm: "Variant A",
    simulationMode: "active-journey",
  },
];

const AUTOMOTIVE_PROFILES = [
  {
    id: "AT-001",
    name: "Riya N.",
    type: "Service-due SUV owner",
    segment: "Battery_5Y_No_Replacement",
    attributes: [
      { label: "Vehicle", value: "2021 Chevrolet Traverse" },
      { label: "Last service", value: "2025-08-14" },
      { label: "Odometer", value: "61,240 mi" },
      { label: "App active", value: "No" },
      { label: "Preferred dealer", value: "EXL Downtown Motors" },
      { label: "Owner ID", value: "OWN-400284" },
    ],
    expectedOutcome: "Variant B dealer-personalized reminder",
    expectedTone: "teal",
    variantArm: "Variant B",
    simulationMode: "delivery-warning",
  },
  {
    id: "AT-002",
    name: "Vikram S.",
    type: "High-mileage commuter",
    segment: "Mileage_50K_No_Tire_Change",
    attributes: [
      { label: "Vehicle", value: "2020 GMC Terrain" },
      { label: "Last service", value: "2025-11-03" },
      { label: "Odometer", value: "54,880 mi" },
      { label: "App active", value: "Yes" },
      { label: "Preferred dealer", value: "North Loop Service Hub" },
      { label: "Owner ID", value: "OWN-400913" },
    ],
    expectedOutcome: "Variant A tire-service cadence",
    expectedTone: "teal",
    variantArm: "Variant A",
    simulationMode: "normal",
  },
  {
    id: "AT-003",
    name: "Neha P.",
    type: "Multi-vehicle household",
    segment: "Household_Multi_Vehicle",
    attributes: [
      { label: "Vehicle", value: "2022 Chevrolet Tahoe + 2021 Bolt EUV" },
      { label: "Last service", value: "2025-12-22" },
      { label: "Odometer", value: "38,410 mi household avg" },
      { label: "App active", value: "Yes" },
      { label: "Preferred dealer", value: "Westlake Premium Care" },
      { label: "Owner ID", value: "OWN-401772" },
    ],
    expectedOutcome: "Variant B household-care reminder",
    expectedTone: "teal",
    variantArm: "Variant B",
    simulationMode: "normal",
  },
  {
    id: "AT-004",
    name: "Do-not-contact owner",
    type: "Suppressed",
    segment: "MarketingOptOut",
    attributes: [
      { label: "Vehicle", value: "2019 Buick Encore" },
      { label: "Last service", value: "2025-10-18" },
      { label: "Odometer", value: "47,905 mi" },
      { label: "App active", value: "Yes" },
      { label: "Preferred dealer", value: "City Center Service" },
      { label: "Owner ID", value: "OWN-402011" },
    ],
    expectedOutcome: "EXCLUDED opt-out suppression",
    expectedTone: "amber",
    variantArm: "Variant A",
    simulationMode: "opt-out",
  },
  {
    id: "AT-005",
    name: "Holdout owner",
    type: "Holdout group",
    segment: "Holdout_10pct",
    attributes: [
      { label: "Vehicle", value: "2023 Cadillac XT5" },
      { label: "Last service", value: "2026-01-14" },
      { label: "Odometer", value: "22,180 mi" },
      { label: "App active", value: "Yes" },
      { label: "Preferred dealer", value: "Uptown Cadillac Care" },
      { label: "Owner ID", value: "OWN-402408" },
    ],
    expectedOutcome: "EXCLUDED holdout group",
    expectedTone: "amber",
    variantArm: "Variant A",
    simulationMode: "holdout",
  },
  {
    id: "AT-006",
    name: "Open service case owner",
    type: "In active journey",
    segment: "ActiveJourney",
    attributes: [
      { label: "Vehicle", value: "2022 Chevrolet Silverado" },
      { label: "Last service", value: "2026-03-09" },
      { label: "Odometer", value: "31,640 mi" },
      { label: "App active", value: "Yes" },
      { label: "Preferred dealer", value: "Airport Service Lane" },
      { label: "Owner ID", value: "OWN-402911" },
    ],
    expectedOutcome: "EXCLUDED active service journey",
    expectedTone: "amber",
    variantArm: "Variant A",
    simulationMode: "active-journey",
  },
];

const QA_SIMULATION_CONTEXT = {
  sports: {
    label: "Sports",
    entryEventLabel: "audience-qualified entry event",
    personalizationFields: "first_name and seat_section",
    deliveryChannels: "email and push",
    analyticsLabel: "journey measurement events",
    flowLabel: "sports fan journey",
    blockedLabel: "outbound journey delivery",
    reviewLabel: "delivery signal",
  },
  media: {
    label: "Media & OTT",
    entryEventLabel: "subscriber lifecycle entry event",
    personalizationFields: "first_name, favorite_genre, and plan_name",
    deliveryChannels: "email, push, and in-app",
    analyticsLabel: "subscriber lifecycle analytics events",
    flowLabel: "subscriber lifecycle journey",
    blockedLabel: "outbound lifecycle delivery",
    reviewLabel: "subscriber-delivery signal",
  },
  telecom: {
    label: "Telecom",
    entryEventLabel: "service-eligibility entry event",
    personalizationFields: "first_name, plan_name, and offer_code",
    deliveryChannels: "email, SMS, push, and app",
    analyticsLabel: "recharge, upgrade, and journey analytics events",
    flowLabel: "telecom growth journey",
    blockedLabel: "outbound offer delivery",
    reviewLabel: "channel-delivery signal",
  },
  automotive: {
    label: "Automotive",
    entryEventLabel: "service-due audience entry event",
    personalizationFields: "first_name, vehicle_model, and preferred_dealer",
    deliveryChannels: "email, push, and service-app",
    analyticsLabel: "booking, lead, and journey analytics events",
    flowLabel: "automotive service journey",
    blockedLabel: "outbound service delivery",
    reviewLabel: "service-delivery signal",
  },
};

const QA_SOURCE_CONFIG = {
  sports: {
    sourceLabel: "Sports",
    suites: TEST_SUITES,
    automationPlaybook: AUTOMATION_PLAYBOOK,
    profiles: PROFILES,
    failureSuiteId: "TS-04",
  },
  media: {
    sourceLabel: "Media & OTT",
    suites: MEDIA_TEST_SUITES,
    automationPlaybook: MEDIA_AUTOMATION_PLAYBOOK,
    profiles: MEDIA_PROFILES,
    failureSuiteId: "TS-05",
  },
  telecom: {
    sourceLabel: "Telecom",
    suites: TELECOM_TEST_SUITES,
    automationPlaybook: TELECOM_AUTOMATION_PLAYBOOK,
    profiles: TELECOM_PROFILES,
    failureSuiteId: "TS-02",
  },
  automotive: {
    sourceLabel: "Automotive",
    suites: AUTOMOTIVE_TEST_SUITES,
    automationPlaybook: AUTOMOTIVE_AUTOMATION_PLAYBOOK,
    profiles: AUTOMOTIVE_PROFILES,
    failureSuiteId: "TS-07",
  },
};

function normalizeQaSourceSystem(sourceSystem, fallback = "sports") {
  const candidate = String(sourceSystem ?? "")
    .trim()
    .toLowerCase();
  if (QA_SOURCE_CONFIG[candidate]) {
    return candidate;
  }
  return QA_SOURCE_CONFIG[fallback] ? fallback : "sports";
}

function readSelectedQaSourceSystem(fallback = "sports") {
  if (typeof window === "undefined") {
    return normalizeQaSourceSystem(fallback, "sports");
  }
  try {
    return normalizeQaSourceSystem(window.localStorage.getItem("cdp_source_system"), fallback);
  } catch {
    return normalizeQaSourceSystem(fallback, "sports");
  }
}

function getQaConfigForSource(sourceSystem = "sports") {
  return QA_SOURCE_CONFIG[normalizeQaSourceSystem(sourceSystem, "sports")] ?? QA_SOURCE_CONFIG.sports;
}

function getQaSimulationContext(sourceSystem = "sports") {
  return QA_SIMULATION_CONTEXT[normalizeQaSourceSystem(sourceSystem, "sports")] ?? QA_SIMULATION_CONTEXT.sports;
}

function findQaProfile(profileId, preferredSourceSystem = "sports") {
  const preferredSource = normalizeQaSourceSystem(preferredSourceSystem, "sports");
  const preferredConfig = getQaConfigForSource(preferredSource);
  const preferredProfile = preferredConfig.profiles.find((entry) => entry.id === profileId);
  if (preferredProfile) {
    return {
      sourceSystem: preferredSource,
      profile: preferredProfile,
    };
  }

  for (const sourceSystem of Object.keys(QA_SOURCE_CONFIG)) {
    const profile = QA_SOURCE_CONFIG[sourceSystem].profiles.find((entry) => entry.id === profileId);
    if (profile) {
      return {
        sourceSystem,
        profile,
      };
    }
  }

  return null;
}

function clone(value) {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function withEdgeIds(edges = []) {
  return edges.map((edge, index) => ({
    id: edge.id ?? `e${index}`,
    ...clone(edge),
  }));
}

function normalizeNodes(nodes = []) {
  return nodes.map((node) => clone(node));
}

function normalizeEdges(edges = []) {
  return withEdgeIds(edges);
}

function normalizeNodeDetails(details) {
  if (Array.isArray(details)) {
    return details.map((detail) => clone(detail));
  }
  return nodeDetailsMapToArray(details);
}

function applyNodeOverrides(baseNodes, overrides = {}) {
  return normalizeNodes(baseNodes).map((node) => {
    const override = overrides[node.id];
    return override ? { ...node, ...clone(override) } : node;
  });
}

function applyNodeDetailOverrides(baseDetails, overrides = {}) {
  const next = clone(baseDetails);
  Object.entries(overrides).forEach(([id, override]) => {
    next[id] = {
      ...next[id],
      ...clone(override),
      rows: override.rows ? clone(override.rows) : next[id].rows,
    };
  });
  return next;
}

export function nodeDetailsMapToArray(details) {
  return Object.entries(details).map(([id, detail]) => ({
    id,
    ...clone(detail),
  }));
}

export function nodeDetailsArrayToMap(entries = []) {
  return entries.reduce((acc, entry) => {
    acc[entry.id] = {
      title: entry.title,
      kind: entry.kind,
      accent: entry.accent,
      rows: clone(entry.rows),
      note: entry.note,
    };
    return acc;
  }, {});
}

function isSourceJourneyRecord(definition = {}) {
  return Boolean(definition?.useCaseId || definition?.journeyTable || definition?.touchpoints || definition?.entryCriteria);
}

function buildFlowFromJourneyNodes(definition) {
  const jsonNodes = definition.journey?.nodes;
  if (!Array.isArray(jsonNodes) || jsonNodes.length === 0) return null;

  const touchpoints = Array.isArray(definition.touchpoints) ? definition.touchpoints : [];
  const entryConditions = Array.isArray(definition.entryCriteria?.conditions) ? definition.entryCriteria.conditions : [];

  const tpById = {};
  for (const tp of touchpoints) {
    if (tp.tpId) tpById[tp.tpId] = tp;
  }
  const nodeById = {};
  for (const n of jsonNodes) nodeById[n.id] = n;

  const canvasNodes = [];
  const canvasEdges = [];
  let edgeCount = 0;
  const inlineExitCountByCol = {};

  const pushEdge = (from, to, type, label = "") => {
    canvasEdges.push({ id: `e${edgeCount++}`, from, to, type, label });
  };

  const channelToMeta = (ch) => {
    const c = (ch || "").toUpperCase();
    if (c === "EMAIL") return { lane: "email", accent: "#C89B3C" };
    if (c === "PUSH") return { lane: "push", accent: "#F59E0B" };
    if (c === "SMS") return { lane: "push", accent: "#F59E0B" };
    if (c === "IN_APP" || c === "INAPP" || c === "APP") return { lane: "email", accent: "#C89B3C" };
    return { lane: "trigger", accent: "#4A9EF5" };
  };

  const formatWait = (node) => {
    if (node.durationDays) return `Wait ${node.durationDays}d`;
    if (node.durationHours) {
      const h = node.durationHours;
      return h >= 24 ? `Wait ${Math.round(h / 24)}d` : `Wait ${h}h`;
    }
    return "Wait";
  };

  for (let i = 0; i < jsonNodes.length; i++) {
    const node = jsonNodes[i];
    const column = i;
    const nextNode = jsonNodes[i + 1];

    if (node.type === "ENTRY") {
      const firstCond = entryConditions[0] ? summarizeCondition(entryConditions[0]) : "profile qualifies";
      canvasNodes.push({
        id: node.id, lane: "trigger", column, kind: "start",
        title: ["Audience", "Qualified"],
        subtitle: [compactText(firstCond, 24), "entry event observed"],
        accent: "#2680EB",
      });
      if (nextNode) pushEdge(node.id, nextNode.id, "flow");

    } else if (node.type === "EXIT") {
      canvasNodes.push({
        id: node.id, lane: "exit", column, kind: "end",
        title: ["Exit", "Journey End"],
        subtitle: ["journey complete", "profile exits"],
        accent: "#22C55E",
      });

    } else if (node.type === "MESSAGE") {
      const tp = tpById[node.tpId];
      const rawCh = Array.isArray(tp?.channel) ? tp.channel[0] : tp?.channel;
      const { lane, accent } = channelToMeta(rawCh);
      canvasNodes.push({
        id: node.id, lane, column, kind: "action",
        title: [compactText(tp?.cta ?? "Send Message", 18), compactText(tp?.label ?? "", 16)],
        subtitle: [compactText(tp?.messageTheme ?? "outbound message", 28), (rawCh || "message").toUpperCase()],
        accent,
      });
      if (nextNode) pushEdge(node.id, nextNode.id, "flow");

    } else if (node.type === "CONDITION") {
      const field = node.condition?.field ?? node.condition?.eventToCheck ?? "condition";
      canvasNodes.push({
        id: node.id, lane: "decision", column, kind: "decision",
        title: [compactText(field.replace(/_/g, " "), 14), "Check?"],
        subtitle: ["route by result", "branch next"],
        accent: "#8B5CF6",
      });

      if (node.trueBranch === "EXIT") {
        const exitId = `${node.id}_exit_y`;
        const cnt = inlineExitCountByCol[column] ?? 0;
        inlineExitCountByCol[column] = cnt + 1;
        canvasNodes.push({
          id: exitId, lane: "exit", column, kind: "end",
          title: ["Early", "Exit"],
          subtitle: ["condition met", "exits journey"],
          accent: "#22C55E",
          offsetY: 74 * (cnt + 1),
        });
        pushEdge(node.id, exitId, "yes", "Yes");
      } else if (node.trueBranch && nodeById[node.trueBranch]) {
        pushEdge(node.id, node.trueBranch, "yes", "Yes");
      }

      if (node.falseBranch === "EXIT") {
        const exitId = `${node.id}_exit_n`;
        const cnt = inlineExitCountByCol[column] ?? 0;
        inlineExitCountByCol[column] = cnt + 1;
        canvasNodes.push({
          id: exitId, lane: "exit", column, kind: "end",
          title: ["Early", "Exit"],
          subtitle: ["no match", "exits journey"],
          accent: "#22C55E",
          offsetY: 74 * (cnt + 1),
        });
        pushEdge(node.id, exitId, "no", "No");
      } else if (node.falseBranch && nodeById[node.falseBranch]) {
        pushEdge(node.id, node.falseBranch, "no", "No");
      }

    } else if (node.type === "WAIT") {
      canvasNodes.push({
        id: node.id, lane: "trigger", column, kind: "wait",
        title: [formatWait(node)],
        subtitle: ["timed delay", "before next step"],
        accent: "#4A9EF5",
      });
      if (nextNode) pushEdge(node.id, nextNode.id, "flow");
    }
  }

  const maxColumn = canvasNodes.reduce((m, n) => Math.max(m, n.column ?? 0), 0);
  const phaseHeaders = [];
  for (let c = 0; c <= maxColumn; c++) {
    const primary = canvasNodes.find(n => (n.column ?? 0) === c && !String(n.id).includes("_exit_"));
    if (!primary) { phaseHeaders.push(""); continue; }
    if (primary.kind === "start") phaseHeaders.push("Entry");
    else if (primary.kind === "decision") phaseHeaders.push("Decision");
    else if (primary.kind === "wait") phaseHeaders.push("Wait");
    else if (primary.kind === "action") phaseHeaders.push(primary.lane === "email" ? "Email" : primary.lane === "push" ? "Push" : "Message");
    else if (primary.kind === "end") phaseHeaders.push("Exit");
    else phaseHeaders.push("");
  }

  return { nodes: canvasNodes, edges: canvasEdges, phaseHeaders };
}

function touchpointNodeTitle(touchpoint, fallbackTitle, touchpointIndex) {
  if (Number.isFinite(touchpointIndex) && touchpointIndex > 0) {
    return [`Touchpoint ${touchpointIndex}`];
  }
  return [fallbackTitle];
}

function touchpointNodeSubtitle(touchpoint, fallbackLineA, fallbackLineB) {
  const lineA = compactText(touchpoint?.cta ?? touchpoint?.timing?.description ?? fallbackLineA, 26);
  const lineB = compactText(touchpoint?.messageTheme ?? fallbackLineB, 32);
  return [lineA || fallbackLineA, lineB || fallbackLineB];
}

function touchpointDetailRows(touchpoint, fallbackTemplateId, fallbackCta) {
  const campaignId = touchpoint?.tracking?.campaignId ?? fallbackTemplateId;
  const eventList = Array.isArray(touchpoint?.tracking?.trackingEvents) ? touchpoint.tracking.trackingEvents : [];
  return [
    { key: "templateId", value: campaignId },
    { key: "subject", value: compactText(touchpoint?.messageTheme ?? fallbackCta, 120) },
    { key: "sendTime", value: compactText(touchpoint?.timing?.description ?? touchpoint?.label ?? "Journey sequence", 90) },
    { key: "cjaEvents", value: eventList.length ? eventList.join(", ") : "delivery and engagement events" },
  ];
}

function buildJourneyTemplateFromSourceRecord(definition, category, isPreset) {
  const verticalCategory = inferVerticalCategory(definition, category);
  const subCategory = inferSubCategoryMeta(definition, category, verticalCategory);
  const clientTag = definition.clientTag ?? "";
  const sourceCategoryId = verticalCategory.id;
  const sourceCategoryName = verticalCategory.name;
  const sourceCategoryDescription = verticalCategory.description;
  const slug = definition.slug ?? definition.useCaseId ?? slugifyValue(definition.name ?? definition.journeyTable?.journeyName, "journey");
  const name = definition.name ?? definition.journeyTable?.journeyName ?? "Untitled Journey";
  const touchpoints = Array.isArray(definition.touchpoints) ? definition.touchpoints : [];
  const emailA = firstTouchpointByChannel(touchpoints, "EMAIL", 0);
  const emailB = firstTouchpointByChannel(touchpoints, "EMAIL", 1);
  const emailFollowUp = firstTouchpointByChannel(touchpoints, "EMAIL", 2);
  const pushA =
    firstTouchpointByChannel(touchpoints, "PUSH", 0) ??
    firstTouchpointByChannel(touchpoints, "IN_APP", 0) ??
    firstTouchpointByChannel(touchpoints, "INAPP", 0) ??
    firstTouchpointByChannel(touchpoints, "APP", 0) ??
    firstTouchpointByChannel(touchpoints, "SMS", 0);
  const pushB =
    firstTouchpointByChannel(touchpoints, "PUSH", 1) ??
    firstTouchpointByChannel(touchpoints, "IN_APP", 1) ??
    firstTouchpointByChannel(touchpoints, "INAPP", 1) ??
    firstTouchpointByChannel(touchpoints, "APP", 1) ??
    firstTouchpointByChannel(touchpoints, "SMS", 1);
  const channels = channelsFromTouchpoints(touchpoints);
  const touchpointIndexById = new Map(
    touchpoints
      .map((touchpoint, index) => [touchpoint?.tpId, index + 1])
      .filter(([tpId]) => tpId),
  );
  const getTouchpointIndex = (touchpoint) => {
    if (!touchpoint) {
      return null;
    }
    if (touchpoint.tpId && touchpointIndexById.has(touchpoint.tpId)) {
      return touchpointIndexById.get(touchpoint.tpId);
    }
    const index = touchpoints.findIndex((entry) => entry === touchpoint);
    return index >= 0 ? index + 1 : null;
  };

  const entryConditions = Array.isArray(definition.entryCriteria?.conditions) ? definition.entryCriteria.conditions : [];
  const firstCondition = entryConditions[0] ? summarizeCondition(entryConditions[0]) : "profile qualifies";
  const secondCondition = entryConditions[1] ? summarizeCondition(entryConditions[1]) : "entry event observed";
  const objective = definition.journeyTable?.journeyGoal ?? "Drive measurable lift using orchestrated cross-channel engagement.";
  const brief = compactText(
    `${objective} Entry trigger: ${definition.entryCriteria?.event ?? definition.journeyTable?.entryTrigger ?? "audience_qualified"}.`,
    360,
  );

  const journeyOverrides = {
    name,
    objective,
    entryTrigger: definition.entryCriteria?.event ?? definition.journeyTable?.entryTrigger ?? DEFAULT_JOURNEY_FORM_TEMPLATE.entryTrigger,
    audience: definition.entryCriteria?.audienceName ?? DEFAULT_JOURNEY_FORM_TEMPLATE.audience,
    duration: normalizeDurationLabel(definition.journeyTable?.totalDuration, DEFAULT_JOURNEY_FORM_TEMPLATE.duration),
    frequencyCap: normalizeFrequencyCap(definition.ajoConfig?.frequencyCapping),
    variantA: compactText(emailA?.messageTheme ?? DEFAULT_JOURNEY_FORM_TEMPLATE.variantA, 54),
    variantB: compactText(emailB?.messageTheme ?? emailA?.messageTheme ?? DEFAULT_JOURNEY_FORM_TEMPLATE.variantB, 54),
    channels: {
      email: channels.has("EMAIL"),
      push: channels.has("PUSH"),
      sms: channels.has("SMS"),
      inApp: channels.has("IN_APP") || channels.has("INAPP") || channels.has("APP"),
    },
  };

  const nodeOverrides = {
    n0: {
      title: ["Audience", "Qualified"],
      subtitle: [firstCondition || "profile qualifies", secondCondition || "entry event observed"],
    },
    ...(emailA
      ? {
          n3: {
            title: touchpointNodeTitle(emailA, "Email 1A", getTouchpointIndex(emailA)),
            subtitle: touchpointNodeSubtitle(emailA, "email touch", "primary CTA"),
          },
        }
      : {}),
    ...(emailB
      ? {
          n3b: {
            title: touchpointNodeTitle(emailB, "Email 1B", getTouchpointIndex(emailB)),
            subtitle: touchpointNodeSubtitle(emailB, "variant touch", "personalized offer"),
            variantBadge: "VAR B",
          },
        }
      : {}),
    ...(emailFollowUp
      ? {
          n9: {
            title: touchpointNodeTitle(emailFollowUp, "Email 2B", getTouchpointIndex(emailFollowUp)),
            subtitle: touchpointNodeSubtitle(emailFollowUp, "follow-up", "offer close"),
            variantBadge: "VAR B",
          },
        }
      : {}),
    ...(pushA
      ? {
          n6: {
            title: touchpointNodeTitle(pushA, "Push 1", getTouchpointIndex(pushA)),
            subtitle: touchpointNodeSubtitle(pushA, "push touch", "deep link"),
          },
        }
      : {}),
    ...(pushB
      ? {
          n10: {
            title: touchpointNodeTitle(pushB, "Push 2", getTouchpointIndex(pushB)),
            subtitle: touchpointNodeSubtitle(pushB, "final nudge", "app link"),
          },
        }
      : {}),
  };

  const detailOverrides = {
    n0: {
      rows: [
        { key: "segment", value: definition.entryCriteria?.audienceName ?? "journeyAudience" },
        { key: "conditions", value: entryConditions.map((condition) => summarizeCondition(condition)).join("\n") || "event and profile conditions" },
        { key: "entryEvent", value: definition.entryCriteria?.event ?? definition.journeyTable?.entryTrigger ?? "audience_qualified" },
        { key: "cjaEvents", value: "journeyEntry, audienceQualified" },
      ],
      note: compactText(
        `Entry is triggered by ${definition.entryCriteria?.event ?? definition.journeyTable?.entryTrigger ?? "an audience-qualified event"}.`,
        160,
      ),
    },
    ...(emailA
      ? {
          n3: {
            rows: touchpointDetailRows(emailA, "email_variant_a", "Email touchpoint"),
            note: compactText("Variant A follows the baseline messaging path from the imported journey definition.", 160),
          },
        }
      : {}),
    ...(emailB
      ? {
          n3b: {
            rows: touchpointDetailRows(emailB, "email_variant_b", "Email touchpoint"),
            note: compactText("Variant B follows the personalized arm from the imported journey definition.", 160),
          },
        }
      : {}),
    ...(emailFollowUp
      ? {
          n9: {
            rows: touchpointDetailRows(emailFollowUp, "email_variant_b_followup", "Follow-up email"),
            note: compactText("This follow-up message reflects the latest imported email touchpoint.", 160),
          },
        }
      : {}),
    ...(pushA
      ? {
          n6: {
            rows: touchpointDetailRows(pushA, "push_touch_1", "Push touchpoint"),
            note: compactText("Push node configuration is mapped from the imported journey touchpoints.", 160),
          },
        }
      : {}),
    ...(pushB
      ? {
          n10: {
            rows: touchpointDetailRows(pushB, "push_touch_2", "Final push"),
            note: compactText("Final push settings are mapped from the imported journey touchpoints.", 160),
          },
        }
      : {}),
    ...(definition.analytics?.primaryKPI
      ? {
          n11: {
            rows: [
              { key: "condition", value: `${definition.analytics.primaryKPI} within ${normalizeDurationLabel(definition.journeyTable?.totalDuration)}` },
              { key: "yesPath", value: "Exit Converted" },
              { key: "noPath", value: "Exit 21d TTL" },
              { key: "cjaEvents", value: "conversionChecked, pathRouted" },
            ],
          },
          n12: {
            rows: [
              { key: "trigger", value: `${definition.analytics.primaryKPI} confirmed` },
              { key: "suppression", value: "stop all remaining messages" },
              { key: "cjaEvents", value: "journeyConversion, orderComplete" },
              { key: "downstream", value: "eligible for next lifecycle journey" },
            ],
          },
        }
      : {}),
  };

  const baseTemplate = buildBaseJourneyTemplate({
    categoryId: sourceCategoryId,
    categoryName: sourceCategoryName,
    categoryDescription: sourceCategoryDescription,
    subCategoryId: subCategory.id,
    subCategoryName: subCategory.name,
    clientTag,
    slug,
    name,
    brief,
    platform: "Adobe AJO",
    targetDate: "2026-05-10",
    journeyOverrides,
    nodeOverrides,
    detailOverrides,
    active: definition.active,
    status: definition.status,
    runStatus: definition.runStatus,
    isPreset,
    orchestrationType: touchpoints.length === 1 ? "single-touchpoint" : "journey",
    singleChannel: (() => {
      if (touchpoints.length !== 1) return "email";
      const ch = (touchpoints[0].channel ?? "").toUpperCase();
      if (ch === "SMS") return "sms";
      if (ch === "PUSH") return "push";
      if (ch === "IN_APP" || ch === "INAPP" || ch === "APP") return "inApp";
      return "email";
    })(),
  });

  const dynamicFlow = buildFlowFromJourneyNodes(definition);
  if (dynamicFlow) {
    return {
      ...baseTemplate,
      nodes: normalizeNodes(dynamicFlow.nodes),
      edges: normalizeEdges(dynamicFlow.edges),
      phaseHeaders: dynamicFlow.phaseHeaders,
    };
  }
  return baseTemplate;
}

function buildBaseJourneyTemplate({
  categoryId,
  categoryName,
  categoryDescription = "",
  subCategoryId = categoryId,
  subCategoryName = categoryName,
  clientTag = "",
  slug,
  name,
  brief,
  platform = "Adobe AJO",
  targetDate = "2026-04-18",
  journeyOverrides = {},
  nodeOverrides = {},
  detailOverrides = {},
  active = true,
  status = "",
  runStatus = "",
  isPreset = true,
  orchestrationType = "journey",
  singleChannel = "email",
}) {
  const verticalTemplateOverrides = buildVerticalTemplateOverrides(categoryId, {
    audience: journeyOverrides?.audience,
    duration: journeyOverrides?.duration,
  });
  const mergedNodeOverrides = mergeOverrideMaps(verticalTemplateOverrides.nodeOverrides, nodeOverrides);
  const mergedDetailOverrides = mergeOverrideMaps(verticalTemplateOverrides.detailOverrides, detailOverrides);
  const nodes = applyNodeOverrides(BASE_FLOW_NODES, mergedNodeOverrides);
  const nodeDetails = applyNodeDetailOverrides(NODE_DETAILS, mergedDetailOverrides);
  return {
    categoryId,
    categoryName,
    categoryDescription,
    subCategoryId,
    subCategoryName,
    clientTag,
    slug,
    name,
    isPreset,
    active,
    status,
    runStatus,
    blueprintForm: withBlueprintDefaults({
      brief,
      journeyCategory: categoryId,
      journeyType: slug,
      platform,
      targetDate,
      orchestrationType,
      singleChannel,
    }),
    journeyForm: {
      ...clone(DEFAULT_JOURNEY_FORM_TEMPLATE),
      name,
      ...clone(journeyOverrides),
    },
    nodes,
    edges: normalizeEdges(BASE_FLOW_EDGES),
    nodeDetails: nodeDetailsMapToArray(nodeDetails),
    phaseHeaders: clone(PHASE_HEADERS),
  };
}

function normalizeJourneyRecord(record, category) {
  const verticalCategory = inferVerticalCategory(record, category);
  const subCategory = inferSubCategoryMeta(record, category, verticalCategory);
  const verticalTemplateOverrides = buildVerticalTemplateOverrides(verticalCategory.id, {
    audience: record.journeyForm?.audience,
    duration: record.journeyForm?.duration,
  });
  return {
    categoryId: verticalCategory.id,
    categoryName: verticalCategory.name,
    categoryDescription: verticalCategory.description ?? "",
    subCategoryId: record.subCategoryId ?? subCategory.id,
    subCategoryName: record.subCategoryName ?? subCategory.name,
    clientTag: record.clientTag ?? "",
    slug: record.slug,
    name: record.name,
    isPreset: record.isPreset ?? false,
    active: typeof record.active === "boolean" ? record.active : true,
    status: record.status ?? "",
    runStatus: record.runStatus ?? "",
    blueprintForm: withBlueprintDefaults({
      ...clone(record.blueprintForm),
      journeyCategory: record.blueprintForm?.journeyCategory ?? record.categoryId ?? category.id,
      journeyType: record.blueprintForm?.journeyType ?? record.slug,
    }),
    journeyForm: clone({
      ...DEFAULT_JOURNEY_FORM_TEMPLATE,
      ...record.journeyForm,
      name: record.journeyForm?.name ?? record.name,
    }),
    nodes: record.nodes
      ? normalizeNodes(record.nodes)
      : applyNodeOverrides(BASE_FLOW_NODES, verticalTemplateOverrides.nodeOverrides),
    edges: normalizeEdges(record.edges ?? BASE_FLOW_EDGES),
    nodeDetails: record.nodeDetails
      ? normalizeNodeDetails(record.nodeDetails)
      : nodeDetailsMapToArray(applyNodeDetailOverrides(NODE_DETAILS, verticalTemplateOverrides.detailOverrides)),
    phaseHeaders: clone(record.phaseHeaders ?? PHASE_HEADERS),
  };
}

function expandJourneyDefinition(definition, category, isPreset) {
  if (definition.blueprintForm) {
    return normalizeJourneyRecord(
      {
        ...definition,
        isPreset,
      },
      category,
    );
  }
  if (isSourceJourneyRecord(definition)) {
    return buildJourneyTemplateFromSourceRecord(definition, category, isPreset);
  }
  const verticalCategory = inferVerticalCategory(definition, category);
  const subCategory = inferSubCategoryMeta(definition, category, verticalCategory);
  return buildBaseJourneyTemplate({
    categoryId: verticalCategory.id,
    categoryName: verticalCategory.name,
    categoryDescription: verticalCategory.description ?? "",
    subCategoryId: definition.subCategoryId ?? subCategory.id,
    subCategoryName: definition.subCategoryName ?? subCategory.name,
    clientTag: definition.clientTag ?? "",
    slug: definition.slug,
    name: definition.name,
    brief: definition.brief,
    platform: definition.platform,
    targetDate: definition.targetDate,
    journeyOverrides: definition.journeyOverrides,
    nodeOverrides: definition.nodeOverrides,
    detailOverrides: definition.detailOverrides,
    active: definition.active,
    status: definition.status,
    runStatus: definition.runStatus,
    isPreset,
  });
}

function expandJourneyLibrary(seed, isPreset) {
  return (seed.categories ?? []).flatMap((category) =>
    (category.journeys ?? []).map((definition) => expandJourneyDefinition(definition, category, isPreset)),
  );
}

export function hydrateJourneyRecords(records = []) {
  return (records ?? []).map((record) =>
    expandJourneyDefinition(
      record,
      {
        id: record.categoryId,
        name: record.categoryName,
        description: record.categoryDescription ?? "",
      },
      Boolean(record.isPreset),
    ),
  );
}

function buildCategoryDirectory() {
  return Object.values(JOURNEY_VERTICAL_CATEGORIES).map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description ?? "",
  }));
}

export const PRECONFIGURED_JOURNEYS = [
  ...expandJourneyLibrary(journeyLibrarySeed, true),
  ...expandJourneyLibrary(customJourneySeed, false),
];

export const JOURNEY_CATEGORY_DIRECTORY = buildCategoryDirectory();

const DEFAULT_JOURNEY = PRECONFIGURED_JOURNEYS.find((journey) => journey.slug === "playoff-ticket-urgency") ?? PRECONFIGURED_JOURNEYS[0];

export const DEFAULT_BLUEPRINT_FORM = clone(DEFAULT_JOURNEY.blueprintForm);

export const DEFAULT_JOURNEY_FORM = clone(DEFAULT_JOURNEY.journeyForm);

export const BLUEPRINT_STATS = [
  { label: "Journey nodes", value: "15", color: "#4A9EF5" },
  { label: "Decision points", value: "3", color: "#8B5CF6" },
  { label: "Channel actions", value: "4", color: "#C89B3C" },
  { label: "Experiment arms", value: "2 (A/B)", color: "#C4B5FD" },
  { label: "Exit conditions", value: "3", color: "#22C55E" },
  { label: "Holdout gate", value: "10%", color: "#0FB8B8" },
];

export function buildIdleSuiteStatuses() {
  return TEST_SUITES.map((suite) => ({ suiteId: suite.id, status: "idle" }));
}

export function listJourneyCategories(journeys = PRECONFIGURED_JOURNEYS) {
  const directory = [];
  const seen = new Set();
  JOURNEY_CATEGORY_DIRECTORY.forEach((category) => {
    if (!category?.id || seen.has(category.id)) {
      return;
    }
    seen.add(category.id);
    directory.push({
      id: category.id,
      name: category.name,
      description: category.description ?? "",
    });
  });

  journeys.forEach((journey) => {
    if (!journey?.categoryId || seen.has(journey.categoryId)) {
      return;
    }
    seen.add(journey.categoryId);
    directory.push({
      id: journey.categoryId,
      name: journey.categoryName ?? journey.categoryId,
      description: journey.categoryDescription ?? "",
    });
  });

  const counts = journeys.reduce((acc, journey) => {
    acc[journey.categoryId] = (acc[journey.categoryId] ?? 0) + 1;
    return acc;
  }, {});

  return directory.filter((category) => counts[category.id]).map((category) => ({
    ...category,
    count: counts[category.id],
  }));
}

export function listJourneyOptions(journeys = PRECONFIGURED_JOURNEYS) {
  const categoryOrder = new Map(listJourneyCategories(journeys).map((category, index) => [category.id, index]));
  return journeys
    .map((journey) => ({
      slug: journey.slug,
      name: journey.name,
      isPreset: Boolean(journey.isPreset),
      categoryId: journey.categoryId,
      categoryName: journey.categoryName,
      subCategoryId: journey.subCategoryId ?? slugifyValue(journey.subCategoryName ?? journey.categoryName ?? "general", "general"),
      subCategoryName: journey.subCategoryName ?? journey.categoryName ?? "General",
      clientTag: journey.clientTag ?? "",
      active: journey.active,
      isActive: journey.isActive,
      status: journey.status ?? "",
      runStatus: journey.runStatus ?? "",
    }))
    .sort((left, right) => {
      const categoryDiff = (categoryOrder.get(left.categoryId) ?? 99) - (categoryOrder.get(right.categoryId) ?? 99);
      if (categoryDiff !== 0) {
        return categoryDiff;
      }
      if (left.isPreset !== right.isPreset) {
        return left.isPreset ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
}

export function listJourneySubcategories(journeys = PRECONFIGURED_JOURNEYS) {
  const ordered = [];
  const seen = new Set();
  const counts = new Map();

  listJourneyOptions(journeys).forEach((journey) => {
    const categoryId = journey.categoryId;
    const subCategoryId = journey.subCategoryId ?? "general";
    const key = `${categoryId}::${subCategoryId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    ordered.push({
      id: subCategoryId,
      name: journey.subCategoryName ?? "General",
      categoryId,
    });
  });

  return ordered.map((entry) => ({
    ...entry,
    count: counts.get(`${entry.categoryId}::${entry.id}`) ?? 0,
  }));
}

export function getJourneysByCategory(categoryId, journeys = PRECONFIGURED_JOURNEYS, subCategoryId = "") {
  return listJourneyOptions(journeys).filter(
    (journey) => journey.categoryId === categoryId && (!subCategoryId || journey.subCategoryId === subCategoryId),
  );
}

export function findJourneyBySlug(slug, journeys = PRECONFIGURED_JOURNEYS) {
  return journeys.find((journey) => journey.slug === slug) ?? journeys[0];
}

export function findJourneyCategoryById(categoryId, journeys = PRECONFIGURED_JOURNEYS) {
  return listJourneyCategories(journeys).find((category) => category.id === categoryId) ?? listJourneyCategories(journeys)[0];
}

export function createDefaultDashboardState() {
  return {
    key: "main",
    segmentSourceUrl: DEFAULT_SEGMENT_SOURCE_URL,
    blueprintForm: withBlueprintDefaults({
      ...clone(DEFAULT_JOURNEY.blueprintForm),
      journeyCategory: "",
      journeyType: "",
    }),
    journeyForm: clone(DEFAULT_JOURNEY.journeyForm),
    blueprintGenerated: false,
    journeyGenerated: false,
    blueprintNodes: clone(DEFAULT_JOURNEY.nodes),
    blueprintEdges: clone(DEFAULT_JOURNEY.edges),
    blueprintNodeDetails: clone(DEFAULT_JOURNEY.nodeDetails),
    blueprintPhaseHeaders: clone(DEFAULT_JOURNEY.phaseHeaders ?? PHASE_HEADERS),
    selectedJourneySlug: DEFAULT_JOURNEY.slug,
    suiteStatuses: buildIdleSuiteStatuses(),
  };
}

export function suiteStatusMap(statuses = []) {
  return statuses.reduce((acc, item) => {
    acc[item.suiteId] = item.status;
    return acc;
  }, {});
}

export function getBootstrapPayload(state) {
  const safeState = state ? clone(state) : createDefaultDashboardState();
  const statusMap = suiteStatusMap(safeState.suiteStatuses);
  const journeys = safeState.availableJourneys ?? PRECONFIGURED_JOURNEYS;
  const segments = safeState.availableSegments ?? safeState.segmentLibrary ?? SEGMENT_LIBRARY;
  const selectedJourney = findJourneyBySlug(
    safeState.selectedJourneySlug ?? safeState.blueprintForm?.journeyType ?? DEFAULT_BLUEPRINT_FORM.journeyType,
    journeys,
  );
  const qaSourceSystem = readSelectedQaSourceSystem(selectedJourney?.categoryId ?? "sports");
  const qaConfig = getQaConfigForSource(qaSourceSystem);
  const blueprintNodes = safeState.blueprintNodes ?? selectedJourney.nodes;
  const blueprintEdges = safeState.blueprintEdges ?? selectedJourney.edges;
  const blueprintNodeDetails = safeState.blueprintNodeDetails ?? selectedJourney.nodeDetails;
  const blueprintPhaseHeaders = safeState.blueprintPhaseHeaders ?? selectedJourney.phaseHeaders ?? PHASE_HEADERS;
  return {
    meta: TOPBAR,
    routes: clone(WORKSPACE_ROUTES),
    sections: clone(SIDEBAR_SECTIONS),
    dataProfile: {
      connectors: clone(DATA_CONNECTORS),
      segmentSourceUrl: safeState.segmentSourceUrl ?? DEFAULT_SEGMENT_SOURCE_URL,
    },
    audienceWorkspace: {
      cards: buildAudienceWorkspaceCards(segments),
      segments: clone(segments),
      statusOptions: clone(SEGMENT_STATUS_OPTIONS),
    },
    blueprint: {
      form: clone(withBlueprintDefaults(safeState.blueprintForm ?? selectedJourney.blueprintForm)),
      generated: safeState.blueprintGenerated,
      generatedAt: safeState.blueprintGeneratedAt,
      stats: clone(BLUEPRINT_STATS),
      lanes: clone(FLOW_LANES),
      phaseHeaders: clone(blueprintPhaseHeaders),
      nodes: clone(blueprintNodes),
      edges: normalizeEdges(blueprintEdges),
      nodeDetails: nodeDetailsArrayToMap(blueprintNodeDetails),
      availableJourneys: listJourneyOptions(journeys),
      availableJourneyCategories: listJourneyCategories(journeys),
      availableJourneySubcategories: listJourneySubcategories(journeys),
      campaignsJourneysReport: safeState.campaignsJourneysReport ? clone(safeState.campaignsJourneysReport) : null,
      progress: clone(BLUEPRINT_PROGRESS),
    },
    journey: {
      form: clone(safeState.journeyForm ?? selectedJourney.journeyForm),
      generated: safeState.journeyGenerated,
      generatedAt: safeState.journeyGeneratedAt,
      automationPlaybook: clone(qaConfig.automationPlaybook),
      progress: clone(CONFIG_PROGRESS),
    },
    qa: {
      sourceSystem: qaSourceSystem,
      sourceLabel: qaConfig.sourceLabel,
      profiles: clone(qaConfig.profiles),
      suites: qaConfig.suites.map((suite) => ({
        ...clone(suite),
        status: statusMap[suite.id] ?? "idle",
      })),
      automationPlaybook: clone(qaConfig.automationPlaybook),
      suiteScore: safeState.suiteScore ? clone(safeState.suiteScore) : null,
      lastRunAt: safeState.lastRunAt,
    },
  };
}

export function slugifyJourneyName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "journey";
}

export function makeUniqueJourneySlug(name, journeys = PRECONFIGURED_JOURNEYS) {
  const existing = new Set(journeys.map((journey) => journey.slug));
  const baseSlug = slugifyJourneyName(name);
  if (!existing.has(baseSlug)) {
    return baseSlug;
  }
  let counter = 2;
  while (existing.has(`${baseSlug}-${counter}`)) {
    counter += 1;
  }
  return `${baseSlug}-${counter}`;
}

export function makeUniqueSegmentId(name, segments = SEGMENT_LIBRARY) {
  const existing = new Set(segments.map((segment) => segment.id));
  const baseId = `seg_${slugifyJourneyName(name).replace(/-/g, "_")}`;
  if (!existing.has(baseId)) {
    return baseId;
  }
  let counter = 2;
  while (existing.has(`${baseId}_${counter}`)) {
    counter += 1;
  }
  return `${baseId}_${counter}`;
}

export function buildJourneyRecord({
  categoryId,
  categoryName,
  categoryDescription = "",
  subCategoryId,
  subCategoryName,
  clientTag = "",
  slug,
  name,
  blueprintForm,
  journeyForm,
  nodes,
  edges,
  nodeDetails,
  phaseHeaders,
  active = true,
  status = "active",
  runStatus = "",
  isPreset = false,
}) {
  return {
    categoryId,
    categoryName,
    categoryDescription,
    subCategoryId: subCategoryId ?? categoryId,
    subCategoryName: subCategoryName ?? categoryName,
    clientTag,
    slug,
    name,
    isPreset,
    active,
    status,
    runStatus,
    blueprintForm: clone(withBlueprintDefaults({
      ...blueprintForm,
      journeyCategory: categoryId,
      journeyType: slug,
    })),
    journeyForm: clone({
      ...journeyForm,
      name,
    }),
    nodes: normalizeNodes(nodes),
    edges: normalizeEdges(edges),
    nodeDetails: normalizeNodeDetails(nodeDetails),
    phaseHeaders: clone(phaseHeaders ?? PHASE_HEADERS),
  };
}

export function buildSingleTouchpointDraft({
  blueprintForm = {},
  journeyForm = {},
  blueprintStats = BLUEPRINT_STATS,
}) {
  const nextForm = withBlueprintDefaults(blueprintForm);
  const channelMeta = SINGLE_TOUCHPOINT_CHANNELS[nextForm.singleChannel] ?? SINGLE_TOUCHPOINT_CHANNELS.email;
  const holdout = clamp(Number(journeyForm?.holdout ?? DEFAULT_JOURNEY_FORM_TEMPLATE.holdout), 0, 50);
  const split = clamp(Number(journeyForm?.split ?? DEFAULT_JOURNEY_FORM_TEMPLATE.split), 10, 90);
  const useHoldout = Boolean(nextForm.singleUseHoldout) && holdout > 0;
  const useAB = Boolean(nextForm.singleUseAB);
  const sendOffset = clamp(Number(nextForm.singleSendOffsetHours ?? 0), 0, 168);
  const outcomeWindow = clamp(Number(nextForm.singleOutcomeWindowHours ?? 24), 1, 168);
  const triggerName = compactText(nextForm.singleTriggerEvent || "audienceQualified", 30);
  const triggerMode = nextForm.singleTriggerType === "scheduled" ? "schedule" : "event";
  const touchpointLabel = phaseLabelFromChannel(nextForm.singleChannel);
  const splitB = 100 - split;

  nextForm.singleUseHoldout = useHoldout;

  const nextJourneyForm = clone(journeyForm ?? {});
  nextJourneyForm.channels = {
    email: false,
    push: false,
    sms: false,
    inApp: false,
    [nextForm.singleChannel]: true,
  };
  nextJourneyForm.holdout = holdout;
  nextJourneyForm.split = split;

  const nodes = [
    {
      id: "n0",
      lane: "trigger",
      column: 0,
      kind: "start",
      title: ["Audience", "Qualified"],
      subtitle: [triggerMode, triggerName || "entry signal"],
      accent: "#2680EB",
    },
    ...(useHoldout
      ? [
          {
            id: "n1",
            lane: "trigger",
            column: 1,
            kind: "holdout",
            title: ["Holdout", "Gate"],
            subtitle: [`${holdout}% control`, "excluded path"],
            accent: "#0FB8B8",
          },
        ]
      : []),
    ...(useAB
      ? [
          {
            id: "n2",
            lane: "trigger",
            column: useHoldout ? 2 : 1,
            kind: "split",
            title: ["A/B", "Split"],
            subtitle: [`${split}% Var A`, `${splitB}% Var B`],
            accent: "#8B5CF6",
          },
        ]
      : []),
    {
      id: "n3",
      lane: channelMeta.lane,
      column: useAB ? (useHoldout ? 3 : 2) : useHoldout ? 2 : 1,
      kind: "action",
      title: [touchpointLabel, useAB ? "Var A" : "Touchpoint"],
      subtitle: [sendOffset ? `+${sendOffset}h offset` : "immediate send", "primary message"],
      accent: channelMeta.accent,
    },
    ...(useAB
      ? [
          {
            id: "n3b",
            lane: channelMeta.lane,
            column: useHoldout ? 3 : 2,
            kind: "action",
            title: [touchpointLabel, "Var B"],
            subtitle: [sendOffset ? `+${sendOffset}h offset` : "immediate send", "variant message"],
            accent: "#E5C97A",
            variantBadge: "VAR B",
            offsetY: 82,
          },
        ]
      : []),
    {
      id: "n4",
      lane: "decision",
      column: useAB ? (useHoldout ? 4 : 3) : useHoldout ? 3 : 2,
      kind: "decision",
      title: ["Conversion", "Observed?"],
      subtitle: [`${outcomeWindow}h check`, "route by outcome"],
      accent: "#8B5CF6",
    },
    {
      id: "n12",
      lane: "exit",
      column: useAB ? (useHoldout ? 5 : 4) : useHoldout ? 4 : 3,
      kind: "end",
      title: ["Exit", "Converted"],
      subtitle: ["goal reached", "stop sequence"],
      accent: "#22C55E",
    },
    {
      id: "n13",
      lane: "exit",
      column: useAB ? (useHoldout ? 5 : 4) : useHoldout ? 4 : 3,
      kind: "endDashed",
      title: ["Exit", "Window"],
      subtitle: [`${outcomeWindow}h ttl`, "no conversion"],
      accent: "#22C55E",
      offsetY: 82,
    },
    ...(useHoldout
      ? [
          {
            id: "n14",
            lane: "exit",
            column: 1,
            kind: "end",
            title: ["Exit", "Holdout"],
            subtitle: ["control group", `${holdout}% sample`],
            accent: "#0FB8B8",
          },
        ]
      : []),
  ];

  const decisionColumn = useAB ? (useHoldout ? 4 : 3) : useHoldout ? 3 : 2;
  const touchpointColumn = useAB ? (useHoldout ? 3 : 2) : useHoldout ? 2 : 1;
  const splitColumn = useHoldout ? 2 : 1;

  const edges = [];
  const pushEdge = (from, to, type, label = "") => {
    edges.push({
      id: `e${edges.length + 1}`,
      from,
      to,
      type,
      label,
    });
  };

  if (useHoldout) {
    pushEdge("n0", "n1", "flow");
    pushEdge("n1", "n14", "holdout", `${holdout}%`);
    if (useAB) {
      pushEdge("n1", "n2", "flow", `${100 - holdout}%`);
    }
  } else if (useAB) {
    pushEdge("n0", "n2", "flow", "100%");
  } else {
    pushEdge("n0", "n3", "flow", "100%");
  }

  if (useAB) {
    pushEdge("n2", "n3", "varA", `${split}%`);
    pushEdge("n2", "n3b", "varB", `${splitB}%`);
    pushEdge("n3", "n4", "flow");
    pushEdge("n3b", "n4", "flow");
  } else {
    pushEdge(useHoldout ? "n1" : "n0", "n3", "flow", useHoldout ? `${100 - holdout}%` : "100%");
    pushEdge("n3", "n4", "flow");
  }

  pushEdge("n4", "n12", "yes", "Yes");
  pushEdge("n4", "n13", "no", "No");

  const nodeDetails = {
    n0: {
      title: "Audience Qualified",
      kind: "start",
      accent: "#2680EB",
      rows: [
        { key: "segment", value: nextJourneyForm.audience ?? "Journey audience segment" },
        { key: "triggerType", value: triggerMode },
        { key: "trigger", value: triggerName || "audienceQualified" },
        { key: "cjaEvents", value: "journeyEntry, audienceQualified" },
      ],
      note: "Single-touchpoint campaigns begin with one entry signal and route to one outbound message.",
    },
    ...(useHoldout
      ? {
          n1: {
            title: "Holdout Gate",
            kind: "holdout",
            accent: "#0FB8B8",
            rows: [
              { key: "holdoutPct", value: `${holdout}%` },
              { key: "distribution", value: `${100 - holdout}% deliverable / ${holdout}% holdout` },
              { key: "method", value: "deterministic hash sampling" },
              { key: "cjaEvents", value: "holdoutAssigned, holdoutExit" },
            ],
            note: "Holdout remains excluded from outbound delivery so incrementality can be measured.",
          },
          n14: {
            title: "Exit Holdout",
            kind: "end",
            accent: "#0FB8B8",
            rows: [
              { key: "reason", value: "assigned to holdout control cohort" },
              { key: "messages", value: "suppressed by design" },
              { key: "cjaEvents", value: "holdoutExit, liftBaselineTracked" },
              { key: "downstream", value: "eligible for later campaign waves" },
            ],
            note: "This path captures baseline behavior for measurement and lift analysis.",
          },
        }
      : {}),
    ...(useAB
      ? {
          n2: {
            title: "A/B Split",
            kind: "split",
            accent: "#8B5CF6",
            rows: [
              { key: "variantA", value: `${split}% ${nextJourneyForm.variantA ?? "Variant A"}` },
              { key: "variantB", value: `${splitB}% ${nextJourneyForm.variantB ?? "Variant B"}` },
              { key: "assignment", value: "deterministic by profile id" },
              { key: "cjaEvents", value: "experimentAssigned, armExposure" },
            ],
            note: "Traffic split controls incremental learning for the single touchpoint campaign.",
          },
          n3b: {
            title: `${touchpointLabel} Variant B`,
            kind: "action",
            accent: "#E5C97A",
            rows: [
              { key: "templateId", value: `${channelMeta.templateId}_var_b` },
              { key: "subject", value: nextJourneyForm.variantB ?? "Variant B message" },
              { key: "sendTime", value: sendOffset ? `send ${sendOffset}h after trigger` : "send immediately on trigger" },
              { key: "cjaEvents", value: channelMeta.cjaEvents },
            ],
            note: "Variant B delivers an alternate creative while preserving identical trigger timing.",
          },
        }
      : {}),
    n3: {
      title: `${touchpointLabel} Touchpoint`,
      kind: "action",
      accent: channelMeta.accent,
      rows: [
        { key: "templateId", value: useAB ? `${channelMeta.templateId}_var_a` : channelMeta.templateId },
        { key: "subject", value: nextJourneyForm.variantA ?? nextJourneyForm.objective ?? "Primary campaign message" },
        { key: "sendTime", value: sendOffset ? `send ${sendOffset}h after trigger` : "send immediately on trigger" },
        { key: "cjaEvents", value: channelMeta.cjaEvents },
      ],
      note: "This is the only outbound touchpoint for the campaign.",
    },
    n4: {
      title: "Conversion Observed?",
      kind: "decision",
      accent: "#8B5CF6",
      rows: [
        { key: "condition", value: `primary conversion event within ${outcomeWindow} hours` },
        { key: "yesPath", value: "Exit Converted" },
        { key: "noPath", value: "Exit Window" },
        { key: "cjaEvents", value: "conversionChecked, outcomeEvaluated" },
      ],
      note: "Outcome checks determine whether profiles convert or age out of the single touchpoint window.",
    },
    n12: {
      title: "Exit Converted",
      kind: "end",
      accent: "#22C55E",
      rows: [
        { key: "trigger", value: "primary conversion event confirmed" },
        { key: "suppression", value: "stop duplicate sends for this campaign" },
        { key: "cjaEvents", value: "journeyConversion, conversionExit" },
        { key: "downstream", value: "eligible for next lifecycle campaign" },
      ],
      note: "Successful conversions exit immediately to prevent extra contact pressure.",
    },
    n13: {
      title: "Exit Window",
      kind: "endDashed",
      accent: "#22C55E",
      rows: [
        { key: "trigger", value: `${outcomeWindow}h window elapsed without conversion` },
        { key: "action", value: "mark non-converted for next-wave targeting" },
        { key: "cjaEvents", value: "windowExpired, nonConversionExit" },
        { key: "downstream", value: "feed retargeting and suppression logic" },
      ],
      note: "Profiles that do not convert in the window exit and can be considered for another campaign.",
    },
  };

  const nextStats = clone(blueprintStats).map((item) => ({ ...item }));
  nextStats.forEach((item) => {
    if (item.label === "Journey nodes") {
      item.value = String(nodes.length);
      return;
    }
    if (item.label === "Decision points") {
      item.value = "1";
      return;
    }
    if (item.label === "Channel actions") {
      item.value = useAB ? "2" : "1";
      return;
    }
    if (item.label === "Experiment arms") {
      item.value = useAB ? "2 (A/B)" : "1";
      return;
    }
    if (item.label === "Exit conditions") {
      item.value = useHoldout ? "3" : "2";
      return;
    }
    if (item.label === "Holdout gate") {
      item.value = useHoldout ? `${holdout}%` : "Off";
    }
  });

  const phaseHeaders = [
    "Entry",
    ...(useHoldout ? ["Holdout"] : []),
    ...(useAB ? ["A/B"] : []),
    touchpointLabel,
    "Decision",
    "Exit",
  ];

  return {
    blueprintForm: nextForm,
    journeyForm: nextJourneyForm,
    nodes: normalizeNodes(nodes).map((node) =>
      node.id === "n3"
        ? { ...node, column: touchpointColumn }
        : node.id === "n3b"
          ? { ...node, column: touchpointColumn }
          : node.id === "n2"
            ? { ...node, column: splitColumn }
            : node.id === "n4"
              ? { ...node, column: decisionColumn }
              : node,
    ),
    edges: normalizeEdges(edges),
    nodeDetails,
    stats: nextStats,
    phaseHeaders,
  };
}

export function buildSegmentRecord({
  id,
  name,
  purpose,
  size,
  refresh,
  exclusions,
  status,
  rules = [],
  isPreset = false,
}) {
  return {
    id,
    name,
    purpose,
    size,
    refresh,
    exclusions,
    status,
    rules: clone(rules),
    isPreset,
  };
}

export function createNodeDraft(count = 0) {
  const draftId = `n_custom_${count + 1}`;
  return {
    id: draftId,
    lane: "email",
    column: 4,
    kind: "action",
    title: ["New Node"],
    subtitle: ["Edit label", "and channel"],
    accent: "#C89B3C",
    x: 520 + count * 12,
    y: 200 + count * 12,
  };
}

export function createEdgeDraft(nodes = [], count = 0) {
  const from = nodes[0]?.id ?? "n0";
  const to = nodes[1]?.id ?? nodes[0]?.id ?? "n1";
  return {
    id: `e_custom_${count + 1}`,
    from,
    to,
    type: "flow",
    label: "",
  };
}

export function buildRunAllSuitesResult(sourceSystem = "sports") {
  const config = getQaConfigForSource(sourceSystem);
  const durations = [780, 920, 860, 1210, 800, 720, 930, 840];
  const failSuiteId = config.failureSuiteId ?? "TS-04";
  const scripted = config.suites.map((suite, index) => ({
    suiteId: suite.id,
    status: suite.id === failSuiteId ? "fail" : "pass",
    durationMs: durations[index] ?? durations[durations.length - 1],
  }));
  const passed = scripted.filter((item) => item.status === "pass").length;
  const failed = scripted.filter((item) => item.status === "fail").length;
  return {
    results: scripted,
    score: { passed, failed, label: `${passed} passed / ${failed} failed` },
  };
}

function buildStep(label, description, status) {
  return { label, description, status };
}

export function buildProfileSimulation(profileId, journeyForm = DEFAULT_JOURNEY_FORM, sourceSystem = "sports") {
  const resolvedProfile = findQaProfile(profileId, sourceSystem);
  if (!resolvedProfile?.profile) {
    throw new Error(`Unknown profile: ${profileId}`);
  }
  const { profile, sourceSystem: resolvedSourceSystem } = resolvedProfile;
  const simulationContext = getQaSimulationContext(resolvedSourceSystem);

  const split = Number(journeyForm.split ?? DEFAULT_JOURNEY_FORM.split);
  const holdout = Number(journeyForm.holdout ?? DEFAULT_JOURNEY_FORM.holdout);
  const variant = profile.variantArm ?? (profile.id === "SP-001" || profile.id === "SP-003" ? "Variant B" : "Variant A");
  const entryEventLabel = profile.entryEventLabel ?? simulationContext.entryEventLabel;
  const personalizationFields = profile.personalizationFields ?? simulationContext.personalizationFields;
  const deliveryChannels = profile.deliveryChannels ?? simulationContext.deliveryChannels;
  const analyticsLabel = profile.analyticsLabel ?? simulationContext.analyticsLabel;

  const steps = [
    buildStep("Segment qualification check", `Evaluating segment ${profile.segment}`, "pass"),
    buildStep("Suppression rule evaluation", "Checking opt-out, consent, and exclusion rules", "pass"),
    buildStep("Holdout group assignment", `Applying ${holdout}% deterministic holdout logic`, "pass"),
    buildStep("Experiment arm assignment", `Assigning ${split}% / ${100 - split}% traffic split`, "pass"),
    buildStep("Entry event trigger", `Simulating ${entryEventLabel}`, "pass"),
    buildStep("Personalization token resolution", `Resolving ${personalizationFields} for ${profile.name}`, "pass"),
    buildStep("Channel delivery simulation", `Testing ${deliveryChannels} delivery eligibility`, "pass"),
    buildStep("CJA event emission", `Validating ${analyticsLabel}`, "pass"),
  ];

  if (profile.simulationMode === "active-journey" || profile.segment === "ActiveJourney") {
    steps[0].status = "blocked";
    for (let index = 1; index < steps.length; index += 1) {
      steps[index].status = "skip";
    }
  } else if (profile.simulationMode === "opt-out" || profile.segment === "MarketingOptOut") {
    steps[1].status = "blocked";
    for (let index = 2; index < steps.length; index += 1) {
      steps[index].status = "skip";
    }
  } else if (profile.simulationMode === "holdout" || profile.segment === "Holdout_10pct") {
    steps[2].status = "blocked";
    for (let index = 3; index < steps.length; index += 1) {
      steps[index].status = "skip";
    }
  } else if (profile.simulationMode === "delivery-warning" || profile.appActive === false) {
    steps[6].status = "warn";
  }

  let summaryTone = "success";
  let summaryText = `${profile.name} progresses through the ${simulationContext.flowLabel} as expected in ${variant}.`;
  if (steps.some((step) => step.status === "blocked" || step.status === "skip")) {
    summaryTone = "blocked";
    summaryText = `${profile.name} is correctly excluded before ${simulationContext.blockedLabel}.`;
  } else if (steps.some((step) => step.status === "warn")) {
    summaryTone = "warning";
    summaryText = `${profile.name} qualifies, but at least one downstream ${simulationContext.reviewLabel} requires review.`;
  }

  return {
    profile: clone(profile),
    steps,
    summaryTone,
    summaryText,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function upsertDetailRow(rows = [], key, value) {
  const next = rows.map((row) => ({ ...row }));
  const index = next.findIndex((row) => row.key === key);
  if (index >= 0) {
    next[index].value = value;
    return next;
  }
  next.push({ key, value });
  return next;
}

const PROMPT_BASE_NUMBERS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const PROMPT_TENS = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const PROMPT_NUMBER_TOKEN =
  "(?:\\d{1,3}|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety(?:[-\\s](?:one|two|three|four|five|six|seven|eight|nine))?)";

function parsePromptNumber(value) {
  const token = String(value ?? "")
    .toLowerCase()
    .replace(/,/g, "")
    .trim();
  if (!token) {
    return undefined;
  }
  if (/^\d{1,3}$/.test(token)) {
    return Number(token);
  }
  const normalized = token.replace(/-/g, " ").replace(/\s+/g, " ");
  if (Object.prototype.hasOwnProperty.call(PROMPT_BASE_NUMBERS, normalized)) {
    return PROMPT_BASE_NUMBERS[normalized];
  }
  if (Object.prototype.hasOwnProperty.call(PROMPT_TENS, normalized)) {
    return PROMPT_TENS[normalized];
  }
  const parts = normalized.split(" ");
  if (parts.length === 2 && Object.prototype.hasOwnProperty.call(PROMPT_TENS, parts[0]) && Object.prototype.hasOwnProperty.call(PROMPT_BASE_NUMBERS, parts[1])) {
    return PROMPT_TENS[parts[0]] + PROMPT_BASE_NUMBERS[parts[1]];
  }
  return undefined;
}

function getPromptNumber(match, index, min, max) {
  const raw = match?.[index];
  const parsed = parsePromptNumber(raw);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return clamp(parsed, min, max);
}

function parsePromptAdjustments(prompt = "") {
  const text = String(prompt ?? "");
  const normalized = text
    .replace(/[;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const adjustments = {};
  const reg = (pattern) => new RegExp(pattern, "i");

  const waitPatterns = [
    reg(`\\b(?:wait|delay|pause|cooldown|hold|gap)(?:\\s*(?:period|perio|peroid|duration|time))?(?:\\s*(?:of|for|to|at|=|is|as|should be|make it))?\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:day|days|d)\\b`),
    reg(`\\b(${PROMPT_NUMBER_TOKEN})\\s*(?:day|days|d)\\s*(?:wait|delay|pause|cooldown|hold)\\b`),
    reg(`\\b(?:set|change|update)\\s*(?:the)?\\s*wait(?:\\s*(?:period|perio))?\\s*(?:to|at|=)?\\s*(${PROMPT_NUMBER_TOKEN})\\b`),
  ];
  for (const pattern of waitPatterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }
    const waitDays = getPromptNumber(match, 1, 1, 30);
    if (!Number.isFinite(waitDays)) {
      continue;
    }
    adjustments.waitDays = waitDays;
    break;
  }

  const holdoutPatterns = [
    reg(`\\b(?:holdout|hold back|hold-back|control(?:\\s*group)?)(?:\\s*(?:at|to|of|=|is|as|should be))?\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:%|percent|pct)?\\b`),
    reg(`\\b(${PROMPT_NUMBER_TOKEN})\\s*(?:%|percent|pct)\\s*(?:holdout|hold back|control(?:\\s*group)?)\\b`),
    reg(`\\bexclude\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:%|percent|pct)\\s*(?:as)?\\s*(?:holdout|control)\\b`),
  ];
  for (const pattern of holdoutPatterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }
    const holdout = getPromptNumber(match, 1, 0, 50);
    if (!Number.isFinite(holdout)) {
      continue;
    }
    adjustments.holdout = holdout;
    break;
  }

  let splitApplied = false;
  const splitPairPatterns = [
    { pattern: reg(`\\b(?:split|a\\/b|ab|traffic)(?:\\s*(?:at|to|of|=|is|should be))?\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:\\/|:|-|to)\\s*(${PROMPT_NUMBER_TOKEN})\\b`), reverse: false },
    { pattern: reg(`\\b(?:split|a\\/b|ab|traffic)(?:\\s*(?:at|to|of|=|is|should be))?\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:%|percent|pct)\\s*(?:and|\\/|to)\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:%|percent|pct)\\b`), reverse: false },
    { pattern: reg(`\\b(?:variant\\s*a|var\\s*a|arm\\s*a)\\s*(?:at|to|=|is|should be)?\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:%|percent|pct)?\\s*(?:and|,|\\/|to)?\\s*(?:variant\\s*b|var\\s*b|arm\\s*b)\\s*(?:at|to|=|is|should be)?\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:%|percent|pct)?\\b`), reverse: false },
    { pattern: reg(`\\b(?:variant\\s*b|var\\s*b|arm\\s*b)\\s*(?:at|to|=|is|should be)?\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:%|percent|pct)?\\s*(?:and|,|\\/|to)?\\s*(?:variant\\s*a|var\\s*a|arm\\s*a)\\s*(?:at|to|=|is|should be)?\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:%|percent|pct)?\\b`), reverse: true },
  ];
  for (const { pattern, reverse } of splitPairPatterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }
    let varA = getPromptNumber(match, 1, 0, 100);
    let varB = getPromptNumber(match, 2, 0, 100);
    if (reverse) {
      varA = getPromptNumber(match, 2, 0, 100);
      varB = getPromptNumber(match, 1, 0, 100);
    }
    if (Number.isFinite(varA) && Number.isFinite(varB) && varA + varB === 100) {
      adjustments.split = clamp(varA, 10, 90);
      splitApplied = true;
      break;
    }
  }
  if (!splitApplied) {
    const splitSinglePatterns = [
      reg(`\\b(?:variant\\s*a|var\\s*a|arm\\s*a)\\s*(?:at|to|=|is|should be)?\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:%|percent|pct)?\\b`),
      reg(`\\b(?:split|a\\/b|ab|traffic)(?:\\s*(?:at|to|of|=|is|should be))?\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:%|percent|pct)\\b`),
    ];
    for (const pattern of splitSinglePatterns) {
      const match = normalized.match(pattern);
      if (!match) {
        continue;
      }
      const split = getPromptNumber(match, 1, 10, 90);
      if (!Number.isFinite(split)) {
        continue;
      }
      adjustments.split = split;
      splitApplied = true;
      break;
    }
  }

  const durationPatterns = [
    reg(`\\b(?:duration|journey\\s*(?:length|window|runtime|run\\s*time)|ttl|time[-\\s]?to[-\\s]?live|run\\s*for)(?:\\s*(?:at|to|of|for|=|is|should be))?\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:day|days|d)\\b`),
    reg(`\\b(${PROMPT_NUMBER_TOKEN})\\s*(?:day|days|d)\\s*(?:duration|journey|window|ttl|time[-\\s]?to[-\\s]?live)\\b`),
  ];
  for (const pattern of durationPatterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }
    const durationDays = getPromptNumber(match, 1, 1, 365);
    if (!Number.isFinite(durationDays)) {
      continue;
    }
    adjustments.durationDays = durationDays;
    break;
  }

  const frequencyPatterns = [
    reg(`\\b(?:frequency\\s*cap|freq\\s*cap|max(?:imum)?|no\\s*more\\s*than|limit)(?:\\s*(?:at|to|of|=|is|should be))?\\s*(${PROMPT_NUMBER_TOKEN})\\s*(?:messages?|msgs?)?\\s*(?:per|\\/)\\s*(day|days|daily|week|weeks|weekly|month|months|monthly)\\b`),
    reg(`\\b(${PROMPT_NUMBER_TOKEN})\\s*(?:messages?|msgs?|x|times)\\s*(?:per|\\/)\\s*(day|days|daily|week|weeks|weekly|month|months|monthly)\\b`),
  ];
  for (const pattern of frequencyPatterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }
    const limit = getPromptNumber(match, 1, 1, 20);
    if (!Number.isFinite(limit)) {
      continue;
    }
    const cadenceToken = match[2].toLowerCase();
    const every = cadenceToken.startsWith("day")
      ? "day"
      : cadenceToken.startsWith("month")
        ? "month"
        : "week";
    adjustments.frequencyCap = `Max ${limit} per ${every}`;
    break;
  }

  if (/\bsfmc\b|\bsalesforce\b|\bmarketing cloud\b/i.test(normalized)) {
    adjustments.platform = "SFMC";
  } else if (/\bbraze\b/i.test(normalized)) {
    adjustments.platform = "Braze";
  } else if (/\bajo\b|\badobe\b|\bjourney optimizer\b/i.test(normalized)) {
    adjustments.platform = "Adobe AJO";
  }

  return adjustments;
}

export function applyPromptToJourneyDraft({
  prompt = "",
  blueprintForm = {},
  blueprintNodes = [],
  blueprintEdges = [],
  blueprintNodeDetails = {},
  journeyForm = {},
  blueprintStats = BLUEPRINT_STATS,
}) {
  const adjustments = parsePromptAdjustments(prompt);
  const nextForm = withBlueprintDefaults(blueprintForm);
  const nextJourneyForm = clone(journeyForm);
  const nextNodes = normalizeNodes(blueprintNodes);
  const nextEdges = normalizeEdges(blueprintEdges);
  const nextDetails = Array.isArray(blueprintNodeDetails)
    ? nodeDetailsArrayToMap(blueprintNodeDetails)
    : clone(blueprintNodeDetails ?? {});
  const nextStats = clone(blueprintStats);

  if (adjustments.platform) {
    nextForm.platform = adjustments.platform;
  }

  if (adjustments.waitDays && nextForm.orchestrationType === "single-touchpoint") {
    nextForm.singleSendOffsetHours = clamp(adjustments.waitDays * 24, 0, 168);
  }

  if (adjustments.holdout !== undefined && nextForm.orchestrationType === "single-touchpoint") {
    nextForm.singleUseHoldout = adjustments.holdout > 0;
  }

  if (adjustments.split !== undefined && nextForm.orchestrationType === "single-touchpoint") {
    nextForm.singleUseAB = true;
  }

  if (adjustments.waitDays) {
    const waitDays = adjustments.waitDays;
    WAIT_NODE_IDS.forEach((nodeId) => {
      const node = nextNodes.find((entry) => entry.id === nodeId);
      if (node) {
        node.title = [`Wait ${waitDays}d`];
        node.subtitle = [
          nodeId === "n5" ? "post-open" : "retargeting",
          `${waitDays}-day hold`,
        ];
      }
      const detail = nextDetails[nodeId];
      if (detail) {
        detail.title = `Wait ${waitDays}d`;
        detail.rows = upsertDetailRow(detail.rows, "duration", `P${waitDays}D`);
      }
    });
    const decision = nextDetails.n4;
    if (decision) {
      decision.rows = upsertDetailRow(decision.rows, "yesPath", `wait ${waitDays} days before push`);
    }
  }

  if (adjustments.holdout !== undefined) {
    const holdout = adjustments.holdout;
    nextJourneyForm.holdout = holdout;
    HOLDOUT_NODE_IDS.forEach((nodeId) => {
      const node = nextNodes.find((entry) => entry.id === nodeId);
      if (node) {
        node.subtitle = [`${holdout}% exit`, "no messages"];
      }
      const detail = nextDetails[nodeId];
      if (detail) {
        detail.rows = upsertDetailRow(detail.rows, "holdoutPct", `${holdout}%`);
      }
    });
    HOLDOUT_EXIT_NODE_IDS.forEach((nodeId) => {
      const node = nextNodes.find((entry) => entry.id === nodeId);
      if (node) {
        node.subtitle = ["baseline", `${holdout}% sample`];
      }
    });
    nextEdges.forEach((edge) => {
      if (edge.id === "e2") {
        edge.label = `${holdout}%`;
      }
      if (edge.id === "e1") {
        edge.label = `${Math.max(0, 100 - holdout)}%`;
      }
    });
    nextStats.forEach((item) => {
      if (item.label === "Holdout gate") {
        item.value = `${holdout}%`;
      }
    });
  }

  if (adjustments.split !== undefined) {
    const split = adjustments.split;
    nextJourneyForm.split = split;
    SPLIT_NODE_IDS.forEach((nodeId) => {
      const node = nextNodes.find((entry) => entry.id === nodeId);
      if (node) {
        node.subtitle = [`${split}% Var A`, `${100 - split}% Var B`];
      }
      const detail = nextDetails[nodeId];
      if (detail) {
        detail.rows = upsertDetailRow(detail.rows, "variantA", `${split}% ${nextJourneyForm.variantA ?? "variant A"}`);
        detail.rows = upsertDetailRow(detail.rows, "variantB", `${100 - split}% ${nextJourneyForm.variantB ?? "variant B"}`);
      }
    });
  }

  if (adjustments.durationDays) {
    nextJourneyForm.duration = `${adjustments.durationDays} days`;
    const ttl = nextDetails.n13;
    if (ttl) {
      ttl.rows = upsertDetailRow(ttl.rows, "trigger", `journey reached ${adjustments.durationDays}-day time-to-live`);
    }
  }

  if (adjustments.frequencyCap) {
    nextJourneyForm.frequencyCap = adjustments.frequencyCap;
  }

  return {
    blueprintForm: nextForm,
    journeyForm: nextJourneyForm,
    nodes: nextNodes,
    edges: nextEdges,
    nodeDetails: nextDetails,
    stats: nextStats,
    adjustments,
  };
}

export function calcHoldoutAudience(holdout) {
  return Math.round(14200 * (Number(holdout) / 100));
}

export function formatChannelState(channels) {
  return Object.entries(channels)
    .filter(([, enabled]) => enabled)
    .map(([channel]) => channel)
    .join(", ");
}
