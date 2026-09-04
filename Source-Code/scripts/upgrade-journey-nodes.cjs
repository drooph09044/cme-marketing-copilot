/**
 * Upgrades all old-format journey JSON files to the new format
 * with proper CONDITION, WAIT, and MESSAGE nodes.
 *
 * Groups:
 *  A - blueprint-only (no touchpoints, no entryCriteria) — synthesize everything
 *  B - has touchpoints/entryCriteria but no journey.nodes
 *  C - has simple ENTRY/MESSAGE/EXIT only — insert WAIT + CONDITION nodes
 */

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "../data/journeys");

// ─── helpers ────────────────────────────────────────────────────────────────

function channelFromArray(ch) {
  return Array.isArray(ch) ? ch[0] : ch || "EMAIL";
}

function channelToMeta(ch) {
  const c = (ch || "").toUpperCase();
  if (c === "EMAIL") return { cta: "Learn More", theme: "Email campaign message" };
  if (c === "PUSH") return { cta: "Open App", theme: "Push notification message" };
  if (c === "SMS") return { cta: "Reply Now", theme: "SMS message" };
  return { cta: "Engage Now", theme: "Outbound message" };
}

/**
 * Build new journey.nodes from touchpoints + exit conditions.
 * Pattern: ENTRY → [COND?] → [WAIT] → MESSAGE → [COND?] → [WAIT] → ... → EXIT
 */
function buildNodes(touchpoints, exitConditions, journeyType, entryCriteria) {
  const nodes = [];
  let idx = 0;
  const id = () => `n${++idx}`;

  const exitEvent = exitConditions?.[0]?.event || null;
  const exitEventId = exitConditions?.[0]?.eventId || null;
  const entryEvent = entryCriteria?.event || "audience_qualified";
  const entryEventId = entryCriteria?.eventId || `evt_${entryEvent}_001`;

  const isEventBased =
    journeyType === "event-based" ||
    journeyType === "event_based" ||
    journeyType === "event";

  // Sort touchpoints by offsetHours ascending (treat undefined as 0)
  const sorted = [...touchpoints].sort(
    (a, b) => (a.timing?.offsetHours || 0) - (b.timing?.offsetHours || 0)
  );

  // ENTRY
  const entryId = id();
  nodes.push({ id: entryId, type: "ENTRY", event: entryEvent, eventId: entryEventId });

  let prevOffset = 0;

  for (let i = 0; i < sorted.length; i++) {
    const tp = sorted[i];
    const offset = tp.timing?.offsetHours || 0;
    const delta = i === 0 ? offset : offset - prevOffset;
    const isFirst = i === 0;

    // For event-based: check conversion before first message
    if (exitEvent && isEventBased && isFirst) {
      const condId = id();
      const nextNodeId = `n${idx + 1}`; // placeholder — fixed up below
      nodes.push({
        id: condId,
        type: "CONDITION",
        condition: {
          eventToCheck: exitEvent,
          field: toCamelCase(exitEvent),
          operator: "EQUALS",
          value: true,
        },
        trueBranch: "EXIT",
        falseBranch: nextNodeId,
      });
    }

    // WAIT if there's a gap
    if (delta > 0) {
      const waitId = id();
      nodes.push({ id: waitId, type: "WAIT", durationHours: delta });
    }

    // MESSAGE
    const msgId = id();
    nodes.push({ id: msgId, type: "MESSAGE", tpId: tp.tpId });
    prevOffset = offset;

    // CONDITION after message (check exit / conversion) — for all journeys with exit event
    if (exitEvent && i < sorted.length - 1) {
      const condId = id();
      const nextNodeId = `n${idx + 1}`; // placeholder — fixed up below
      nodes.push({
        id: condId,
        type: "CONDITION",
        condition: {
          eventToCheck: exitEvent,
          field: toCamelCase(exitEvent),
          operator: "EQUALS",
          value: true,
        },
        trueBranch: "EXIT",
        falseBranch: nextNodeId,
      });
    }
  }

  // EXIT
  const exitId = id();
  nodes.push({ id: exitId, type: "EXIT" });

  // Fix up all CONDITION.falseBranch placeholders
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "CONDITION" && node.falseBranch) {
      const next = nodes[i + 1];
      if (next) node.falseBranch = next.id;
    }
  }

  return nodes;
}

function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Synthesize touchpoints for blueprint-only files from their nodeOverrides.
 * Maps: n3 → EMAIL, n6 → PUSH, n9 → EMAIL, n10 → PUSH
 */
function synthTouchpoints(nodeOverrides, brief) {
  const tps = [];
  let tpIdx = 1;

  // Typical offsets for a multi-touch win-back or engagement sequence
  const offsetsBySlot = { email1: 24, push1: 72, email2: 168, push2: 336 };

  const nodeChannelMap = {
    n3: { channel: "EMAIL", offsetKey: "email1" },
    n6: { channel: "PUSH", offsetKey: "push1" },
    n9: { channel: "EMAIL", offsetKey: "email2" },
    n10: { channel: "PUSH", offsetKey: "push2" },
  };

  for (const [nodeId, meta] of Object.entries(nodeChannelMap)) {
    if (!nodeOverrides?.[nodeId]) continue;
    const override = nodeOverrides[nodeId];
    const titleParts = override.title || [];
    const subtitleParts = override.subtitle || [];
    const cta = titleParts.join(" ") || meta.channel + " message";
    const theme = subtitleParts.join(" — ") || brief || "Outbound engagement message";
    const offset = offsetsBySlot[meta.offsetKey];
    tps.push({
      tpId: `TP${tpIdx++}`,
      label: cta,
      timing: { description: `+${offset}h from entry`, offsetHours: offset },
      channel: meta.channel,
      messageTheme: theme,
      cta,
      tracking: {
        campaignId: `${meta.channel.toLowerCase()}_${meta.offsetKey}`,
        deliveryId: `del_${meta.channel.toLowerCase()}_${tpIdx}`,
        trackingEvents:
          meta.channel === "EMAIL"
            ? ["email_sent", "email_open", "email_click"]
            : ["push_sent", "push_click"],
      },
    });
  }

  // Fallback: at least one EMAIL touchpoint
  if (tps.length === 0) {
    tps.push({
      tpId: "TP1",
      label: "Primary Email",
      timing: { description: "24h from entry", offsetHours: 24 },
      channel: "EMAIL",
      messageTheme: brief || "Engagement email",
      cta: "Learn More",
      tracking: {
        campaignId: "email_primary",
        deliveryId: "del_email_1",
        trackingEvents: ["email_sent", "email_open", "email_click"],
      },
    });
  }

  return tps;
}

/**
 * Synthesize entryCriteria for blueprint-only files.
 */
function synthEntryCriteria(journeyOverrides, name) {
  const audience = journeyOverrides?.audience || "Journey_Audience";
  const slug = (name || audience).toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return {
    event: slug + "_qualified",
    eventId: `evt_${slug}_001`,
    conditions: [
      {
        field: "audienceSegment",
        operator: "EQUALS",
        value: audience,
      },
    ],
    identity: { primaryId: "customerId", namespace: "ECID" },
    audienceName: audience,
  };
}

/**
 * Synthesize exitConditions for blueprint-only files from journeyOverrides.
 */
function synthExitConditions(journeyOverrides, name) {
  const objective = journeyOverrides?.objective || "";
  // Infer exit event from objective keywords
  let event = "journey_goal_achieved";
  if (/ticket|purchase|buy|order/i.test(objective)) event = "purchase_completed";
  else if (/app|reactivat|session|install/i.test(objective)) event = "app_session_started";
  else if (/renewal|renew|subscribe/i.test(objective)) event = "renewal_completed";
  else if (/loyalty|points|reward/i.test(objective)) event = "loyalty_enrolled";
  else if (/winback|win.back|lapsed/i.test(objective)) event = "purchase_completed";
  else if (/upsell|upgrade|premium/i.test(objective)) event = "upgrade_completed";

  return [
    {
      event,
      eventId: `evt_${event}_001`,
      action: "IMMEDIATE_EXIT",
    },
  ];
}

// ─── main upgrade ────────────────────────────────────────────────────────────

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
let upgraded = 0;
let skipped = 0;

for (const file of files) {
  const filePath = path.join(DIR, file);
  const d = JSON.parse(fs.readFileSync(filePath, "utf8"));

  const nodes = (d.journey || {}).nodes || [];
  const types = new Set(nodes.map((n) => n.type));
  const isNewFormat = types.has("CONDITION") || types.has("WAIT");

  if (isNewFormat) {
    skipped++;
    continue; // already upgraded
  }

  let updated = false;

  if (!d.touchpoints || d.touchpoints.length === 0) {
    // ── Group A: blueprint-only ─────────────────────────────────────────────
    // Files with journeyOverrides/nodeOverrides but no touchpoints

    if (!d.journeyOverrides && !d.useCaseId && !d.entryCriteria) {
      // Truly nothing to work with — skip
      skipped++;
      continue;
    }

    const touchpoints = synthTouchpoints(d.nodeOverrides, d.brief);
    const entryCriteria = synthEntryCriteria(d.journeyOverrides, d.name);
    const exitConditions = synthExitConditions(d.journeyOverrides, d.name);

    d.touchpoints = touchpoints;
    d.entryCriteria = entryCriteria;
    d.exitConditions = exitConditions;
    d.journey = {
      type: "scheduled",
      nodes: buildNodes(touchpoints, exitConditions, "scheduled", entryCriteria),
    };

    // Also add useCaseId so isSourceJourneyRecord picks it up
    if (!d.useCaseId) {
      d.useCaseId = d.slug || file.replace(".json", "");
    }

    updated = true;
  } else if (d.touchpoints?.length > 0 && nodes.length === 0) {
    // ── Group B: has touchpoints but no journey block ───────────────────────
    const journeyType = d.journey?.type || "event-based";
    d.journey = {
      type: journeyType,
      nodes: buildNodes(d.touchpoints, d.exitConditions, journeyType, d.entryCriteria),
    };
    updated = true;
  } else {
    // ── Group C: simple ENTRY/MESSAGE/EXIT — rebuild with WAIT + CONDITION ──
    const journeyType = d.journey?.type || "scheduled";
    d.journey = {
      ...d.journey,
      nodes: buildNodes(d.touchpoints, d.exitConditions, journeyType, d.entryCriteria),
    };
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(filePath, JSON.stringify(d, null, 2));
    upgraded++;
    console.log("✓ upgraded:", file);
  }
}

console.log(`\nDone. Upgraded: ${upgraded}, Already new format: ${skipped}`);
