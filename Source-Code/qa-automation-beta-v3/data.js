// Journey + test fixtures for the prototype
window.__JOURNEY_DATA = (function () {
  const journey = {
    id: "jny_8af21",
    name: "Spring Re-engagement — Tier 1 EU",
    status: "Draft",
    version: 7,
    updated: "2026-05-10 14:22",
    owner: "m.alvarez@northwind.io",
    nodes: [
      { id: "n1",  type: "entry",           x: 40,   y: 260, title: "Segment Qualification", sub: "EU dormant 30d+",        meta: "412,308 profiles" },
      { id: "n2",  type: "unitary_event",   x: 40,   y: 380, title: "Unitary Event",         sub: "cart_abandoned",          meta: "namespace: Email" },
      { id: "n3",  type: "consent",         x: 260,  y: 260, title: "Consent Gate",          sub: "marketing_email = granted", meta: "Consent Service" },
      { id: "n4",  type: "suppression",     x: 460,  y: 260, title: "Global Suppression",    sub: "Unsubscribed · Bounced",  meta: "−38,910" },
      { id: "n5",  type: "criteria",        x: 660,  y: 260, title: "Frequency Cap",         sub: "≤ 3 / 7 days",            meta: "policy-fcap-eu" },
      { id: "n6",  type: "quiet_hours",     x: 660,  y: 380, title: "Quiet Hours",           sub: "Send 9–18 local",         meta: "Locale rules" },
      { id: "n7",  type: "split",           x: 860,  y: 260, title: "Holdout / A-B Split",   sub: "Control 10% · Test 90%",  meta: "holdout-A · deterministic" },
      { id: "n8",  type: "channel_email",   x: 1080, y: 140, title: "Email — Offer A",       sub: "Template t_re_07",        meta: "Send window 9–18 CET" },
      { id: "n9",  type: "wait",            x: 1080, y: 260, title: "Wait 48h",              sub: "Quiet hours respected",   meta: "" },
      { id: "n10", type: "channel_push",    x: 1080, y: 380, title: "Push — Reminder",       sub: "Variant B · iOS+Android", meta: "" },
      { id: "n11", type: "channel_sms",     x: 1080, y: 500, title: "SMS Fallback",          sub: "Only if push not delivered", meta: "DLR-aware" },
      { id: "n12", type: "condition",       x: 1300, y: 260, title: "Opened or Clicked?",    sub: "within 72h",              meta: "" },
      { id: "n13", type: "update_profile",  x: 1300, y: 400, title: "Update Profile",        sub: "last_engaged = now()",    meta: "AEP profile" },
      { id: "n14", type: "custom_action",   x: 1520, y: 140, title: "Custom Action",         sub: "POST /crm/reward",        meta: "loyalty-svc" },
      { id: "n15", type: "end_success",     x: 1520, y: 260, title: "End — Converted",       sub: "Goal: order_placed",     meta: "" },
      { id: "n16", type: "end_error",       x: 1520, y: 380, title: "End — No Action",       sub: "End of journey",         meta: "" },
    ],
    edges: [
      ["n1","n3"], ["n2","n3"],
      ["n3","n4"], ["n4","n5"], ["n5","n6"], ["n6","n7"],
      ["n7","n8","test"], ["n7","n9","test"], ["n7","n10","test"], ["n7","n11","test"],
      ["n8","n12"], ["n9","n12"], ["n10","n12"], ["n11","n12"],
      ["n12","n13","no"], ["n12","n14","yes"],
      ["n14","n15"], ["n13","n16"],
    ],
    holdouts: [
      { id: "ho_A", name: "Holdout A — Campaign control", pct: 10, basis: "Random, deterministic on profile_id", scope: "This journey" },
      { id: "ho_G", name: "Global brand holdout",          pct: 2,  basis: "Org-level, refreshed monthly",         scope: "All journeys" },
    ],
    suppression: [
      { id: "s1", label: "Unsubscribed (Email)",     count: 28_410, source: "Consent service" },
      { id: "s2", label: "Hard-bounced 30d",         count:  6_022, source: "Delivery telemetry" },
      { id: "s3", label: "Frequency cap exceeded",   count:  4_478, source: "policy-fcap-eu" },
      { id: "s4", label: "Quiet hours — locale",     count:  1_204, source: "Locale rules" },
    ],
    criteria: [
      { id: "c1", label: "Consent: marketing_email = granted",  status: "ok" },
      { id: "c2", label: "Region in (DE, FR, NL, ES, IT)",      status: "ok" },
      { id: "c3", label: "Age ≥ 18",                            status: "ok" },
      { id: "c4", label: "Frequency cap ≤ 3 sends / 7 days",    status: "warn", note: "12 profiles near cap" },
      { id: "c5", label: "Locale-aware send window 9–18",       status: "ok" },
    ],
  };

  const suites = [
    {
      id: "ts_smoke",
      name: "Smoke — Path coverage",
      desc: "Exercises every edge with one synthetic profile per branch.",
      coverage: 100,
      runs: 142,
      lastPass: "100%",
      cases: 11,
    },
    {
      id: "ts_holdout",
      name: "Holdout integrity",
      desc: "Asserts deterministic split, no leakage across reruns, 10±0.4% allocation.",
      coverage: 92,
      runs: 38,
      lastPass: "98%",
      cases: 6,
    },
    {
      id: "ts_suppress",
      name: "Suppression matrix",
      desc: "Validates every suppression source removes profiles before send.",
      coverage: 88,
      runs: 56,
      lastPass: "100%",
      cases: 14,
    },
    {
      id: "ts_fcap",
      name: "Frequency cap stress",
      desc: "Replays 14-day send history; checks cap-exceeded profiles are filtered.",
      coverage: 71,
      runs: 22,
      lastPass: "95%",
      cases: 9,
    },
    {
      id: "ts_locale",
      name: "Locale & quiet hours",
      desc: "Profiles across 6 locales; verifies send-window adherence.",
      coverage: 64,
      runs: 18,
      lastPass: "100%",
      cases: 8,
    },
    {
      id: "ts_consent",
      name: "Consent revocation replay",
      desc: "Replays GDPR revocation events mid-journey; asserts immediate suppression.",
      coverage: 80,
      runs: 14,
      lastPass: "100%",
      cases: 7,
    },
  ];

  const profiles = [
    { id: "p_00412", name: "Lina Brandt",      region: "DE", age: 34, consent: true,  fcap: 1, lastSend: "12d", segment: "dormant_30d", tag: "control" },
    { id: "p_00413", name: "Marc Dupont",      region: "FR", age: 29, consent: true,  fcap: 2, lastSend: "31d", segment: "dormant_30d", tag: "test" },
    { id: "p_00414", name: "Sofia Romano",     region: "IT", age: 41, consent: false, fcap: 0, lastSend: "—",  segment: "dormant_30d", tag: "suppressed" },
    { id: "p_00415", name: "Jens Vermeer",     region: "NL", age: 52, consent: true,  fcap: 3, lastSend: "2d",  segment: "dormant_30d", tag: "fcap-risk" },
    { id: "p_00416", name: "Paula Iglesias",   region: "ES", age: 22, consent: true,  fcap: 0, lastSend: "—",  segment: "dormant_30d", tag: "test" },
    { id: "p_00417", name: "Tomáš Novák",      region: "DE", age: 38, consent: true,  fcap: 1, lastSend: "9d",  segment: "dormant_30d", tag: "test" },
  ];

  const journeys = [
    { id: "jny_8af21", name: "Spring Re-engagement — Tier 1 EU",   status: "Draft",     version: 7,  updated: "2026-05-10 14:22", owner: "m.alvarez@northwind.io" },
    { id: "jny_2c903", name: "Welcome Onboarding — NA",             status: "Live",      version: 14, updated: "2026-05-09 11:08", owner: "k.tanaka@northwind.io"  },
    { id: "jny_91a4f", name: "Cart Abandoned — Recovery Flow",      status: "Live",      version: 22, updated: "2026-05-08 16:41", owner: "p.iglesias@northwind.io"},
    { id: "jny_55b1d", name: "Win-back — APAC dormant 60d+",        status: "Draft",     version: 3,  updated: "2026-05-07 09:19", owner: "j.vermeer@northwind.io" },
    { id: "jny_77f02", name: "Black Friday Pre-launch — Global",    status: "Scheduled", version: 2,  updated: "2026-05-06 18:55", owner: "m.alvarez@northwind.io" },
    { id: "jny_64e8a", name: "Loyalty Tier-up Nudge",                status: "Live",      version: 9,  updated: "2026-04-30 13:30", owner: "h.lindgren@northwind.io"},
  ];

  return { journey, journeys, suites, profiles };
})();
