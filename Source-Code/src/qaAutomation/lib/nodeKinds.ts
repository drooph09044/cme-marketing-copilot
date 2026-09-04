import type { NodeType } from "./types";

export type NodeTone = "source" | "logic" | "action" | "data" | "accent" | "danger" | "warn" | "exit" | "neutral";

export interface NodeKindMeta {
  label: string;
  glyph: string;
  tone: NodeTone;
  category: string;
}

// All journey node types organised by palette category.
export const NODE_KIND: Record<NodeType, NodeKindMeta> = {
  // Sources / Events
  entry:           { label: "Segment Qualification", glyph: "SQ", tone: "source",  category: "Sources" },
  read_audience:   { label: "Read Audience",         glyph: "RA", tone: "source",  category: "Sources" },
  unitary_event:   { label: "Unitary Event",         glyph: "UE", tone: "source",  category: "Sources" },
  business_event:  { label: "Business Event",        glyph: "BE", tone: "source",  category: "Sources" },
  reaction_event:  { label: "Reaction",              glyph: "RX", tone: "source",  category: "Sources" },

  // Orchestration
  condition:       { label: "Condition",             glyph: "IF", tone: "logic",   category: "Orchestration" },
  wait:            { label: "Wait",                  glyph: "WT", tone: "logic",   category: "Orchestration" },
  wait_until:      { label: "Wait Until",            glyph: "WU", tone: "logic",   category: "Orchestration" },
  jump:            { label: "Jump",                  glyph: "JP", tone: "logic",   category: "Orchestration" },
  split:           { label: "Holdout / A-B Split",   glyph: "AB", tone: "accent",  category: "Orchestration" },
  increment:       { label: "Increment Metric",      glyph: "++", tone: "logic",   category: "Orchestration" },

  // Actions / Channels
  channel:         { label: "Email",                 glyph: "EM", tone: "action",  category: "Actions" },
  channel_email:   { label: "Email",                 glyph: "EM", tone: "action",  category: "Actions" },
  channel_push:    { label: "Push Notification",     glyph: "PN", tone: "action",  category: "Actions" },
  channel_sms:     { label: "SMS",                   glyph: "SM", tone: "action",  category: "Actions" },
  channel_inapp:   { label: "In-App Message",        glyph: "IA", tone: "action",  category: "Actions" },
  channel_web:     { label: "Web Personalization",   glyph: "WB", tone: "action",  category: "Actions" },
  channel_card:    { label: "Content Card",          glyph: "CC", tone: "action",  category: "Actions" },
  channel_dm:      { label: "Direct Mail",           glyph: "DM", tone: "action",  category: "Actions" },
  code:            { label: "Code",                  glyph: "{}", tone: "action",  category: "Actions" },
  custom_action:   { label: "Custom Action",         glyph: "CA", tone: "action",  category: "Actions" },
  ac_delivery:     { label: "Campaign Delivery",     glyph: "AC", tone: "action",  category: "Actions" },

  // Audience / Data
  update_audience: { label: "Update Audience",       glyph: "UA", tone: "data",    category: "Audience" },
  update_profile:  { label: "Update Profile",        glyph: "UP", tone: "data",    category: "Audience" },
  data_source:     { label: "Data Source",           glyph: "DS", tone: "data",    category: "Data sources" },
  aep_query:       { label: "Profile Query",         glyph: "QY", tone: "data",    category: "Data sources" },
  external_ds:     { label: "External Source",       glyph: "EX", tone: "data",    category: "Data sources" },

  // Pre-flight / Analytics constructs
  suppression:     { label: "Global Suppression",    glyph: "SU", tone: "danger",  category: "Analytics" },
  criteria:        { label: "Frequency Cap",         glyph: "FC", tone: "warn",    category: "Analytics" },
  consent:         { label: "Consent Gate",          glyph: "CG", tone: "warn",    category: "Analytics" },
  quiet_hours:     { label: "Quiet Hours",           glyph: "QH", tone: "warn",    category: "Analytics" },

  // Exits
  exit:            { label: "End",                   glyph: "ED", tone: "exit",    category: "Exits" },
  end_success:     { label: "End — Success",         glyph: "OK", tone: "exit",    category: "Exits" },
  end_error:       { label: "End — Error",           glyph: "ER", tone: "exit",    category: "Exits" },
  end_timeout:     { label: "End — Timeout",         glyph: "TO", tone: "exit",    category: "Exits" },
};

export const NODE_CATEGORIES = [
  "Sources",
  "Orchestration",
  "Actions",
  "Audience",
  "Data sources",
  "Analytics",
  "Exits",
] as const;
