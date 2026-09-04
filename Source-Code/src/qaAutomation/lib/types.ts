// Core domain types for the Journey Test Console.

export type NodeType =
  | "entry"
  | "read_audience"
  | "unitary_event"
  | "business_event"
  | "reaction_event"
  | "condition"
  | "wait"
  | "wait_until"
  | "jump"
  | "split"
  | "increment"
  | "channel"
  | "channel_email"
  | "channel_push"
  | "channel_sms"
  | "channel_inapp"
  | "channel_web"
  | "channel_card"
  | "channel_dm"
  | "code"
  | "custom_action"
  | "ac_delivery"
  | "update_audience"
  | "update_profile"
  | "data_source"
  | "aep_query"
  | "external_ds"
  | "suppression"
  | "criteria"
  | "consent"
  | "quiet_hours"
  | "exit"
  | "end_success"
  | "end_error"
  | "end_timeout";

export interface JourneyNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  title: string;
  sub: string;
  meta?: string;
}

export type JourneyEdge = [string, string] | [string, string, string];

export interface Holdout {
  id: string;
  name: string;
  pct: number;
  basis: string;
  scope: string;
}

export interface Suppression {
  id: string;
  label: string;
  count: number;
  source: string;
}

export type CriterionStatus = "ok" | "warn" | "err";

export interface Criterion {
  id: string;
  label: string;
  status: CriterionStatus;
  note?: string;
}

export interface JourneySummary {
  id: string;
  name: string;
  status: string;
  version: number;
  updated: string;
  owner: string;
}

export interface Journey extends JourneySummary {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  holdouts: Holdout[];
  suppression: Suppression[];
  criteria: Criterion[];
}

export type ProfileTag = "test" | "control" | "suppressed" | "fcap-risk" | "holdout";

export interface Profile {
  id: string;
  name: string;
  region: string;
  age: number;
  consent: boolean;
  fcap: number;
  lastSend: string;
  segment: string;
  tag: ProfileTag;
  // Optional test-case label set by the LLM during synth.
  scenario?: string;
  // Archetype describing how this profile traverses the journey (holdout,
  // early_convert, late_convert, never_convert, ineligible, etc.).
  archetype?: string;
}

export type WarnLevel = "info" | "warn" | "err";

export interface PreflightWarning {
  id: string;
  level: WarnLevel;
  msg: string;
}

export interface Preflight {
  holdouts: Holdout[];
  suppression: Suppression[];
  criteria: Criterion[];
  nodeReach: Record<string, number>;
  warnings: PreflightWarning[];
}

export type RunStatus = "idle" | "running" | "passed" | "failed";

export interface LogLine {
  ts: string;
  level: WarnLevel;
  node: string;
  label: string;
  msg: string;
}

export interface RunStats {
  total: number;
  eligible: number;
  suppressed: number;
  holdout: number;
  test: number;
}

export interface RunState {
  status: RunStatus;
  visited: Set<string>;
  active: string | null;
  logs: LogLine[];
  progress: number;
  stats?: RunStats;
  started?: number;
  ended?: number;
  duration?: number;
}

export interface TestEvent {
  eventType: string;
  identityNamespace: string;
  identifier: string;
  waitOverrideSeconds: number;
  payload: unknown;
}

// ─── QA Automation types ────────────────────────────────────────────────────

export interface SegmentRule {
  id: string;
  field: string;
  value: string;
  joiner: string;
}

export interface Segment {
  id: string;
  name: string;
  purpose: string;
  size: string;
  refresh: string;
  exclusions: string;
  status: string;
  rules: SegmentRule[];
  isPreset: boolean;
}

export type QAVerdict = "pass" | "warn" | "fail";
export type QASeverity = "info" | "warn" | "err";

export interface FitFinding {
  verdict: QAVerdict;
  score: number;
  reasons: string[];
  summary: string;
}

export interface StructureFinding {
  nodeId: string;
  severity: QASeverity;
  message: string;
}

export interface WalkStep {
  nodeId: string;
  verdict: QAVerdict;
  reason: string;
}

export interface WalkTrace {
  profile: Record<string, unknown>;
  steps: WalkStep[];
  endedAt: string;
  verdict: QAVerdict;
}

export interface SuiteSummary {
  name: string;
  description?: string;
  expectedOutcome?: string;
  profileCount?: number;
}

/** A journey-level QA concern, simulated per profile. */
export interface TestSuite {
  name: string;
  description?: string;
  expectedOutcome?: string;
  /** How many test cases this suite covers for the journey. */
  testCount?: number;
  /** The individual test cases (shown when a suite is expanded). */
  testCases?: Array<{ title: string; description?: string }>;
  /** Deprecated — suites no longer own profiles. Kept optional for back-compat. */
  profiles?: Record<string, unknown>[];
}

/** A generated cohort member with rich, domain-specific metadata. */
export interface CohortProfile {
  id: string;
  name: string;
  initials?: string;
  summary?: string;
  archetype?: string;
  scenarioTag?: string;
  scenarioTone?: "variant" | "eligible" | "excluded";
  expectedOutcome?: string;
  category?: "eligible" | "ineligible" | "excluded";
  holdout?: boolean;
  region?: string;
  age?: number;
  fcap?: number;
  ownerId?: string;
  // Consent model: global OR per-channel.
  globalConsent?: boolean;
  consentScope?: "global" | "channel" | "none";
  channelConsent?: { email?: boolean; sms?: boolean; push?: boolean; call?: boolean };
  // Why a profile is suppressed (not messaged), if applicable.
  suppressionReason?: "holdout_segment" | "no_consent" | "experiment_holdback" | null;
  metadata?: Array<{ label: string; value: string }>;
  // Back-compat / legacy fields.
  consent?: boolean;
  channelPreferences?: { email?: boolean; sms?: boolean; push?: boolean; call?: boolean };
  rationale?: string;
  [k: string]: unknown;
}

/** One test-case result for a single profile. */
export interface SimulationCheck {
  suite?: string;
  title: string;
  description?: string;
  status: "pass" | "fail" | "skipped";
}

/** A test case / step is PASS, FAIL, or SKIPPED ("did not execute"). */
export type CaseStatus = "pass" | "fail" | "skipped";

/** One node the profile traversed during simulation. */
export interface SimulationStep {
  nodeId: string;
  label?: string;
  action?: string;
  status: CaseStatus;
}

/** Per-profile simulation — the journey path taken + a status per test case. */
export interface SimulationResult {
  profileId: string;
  expected?: string;
  path?: SimulationStep[];
  checks: SimulationCheck[];
  verdict: "pass" | "fail";
}

/** Compact summary of a profile's simulation — drives the canvas-corner overlay. */
export interface SimSummary {
  profileId: string;
  profileName: string;
  verdict: "pass" | "fail";
  pass: number;
  fail: number;
  skipped: number;
  total: number;
  steps: number;
  stopped: boolean;   // true if the journey stopped before completing (early exit/suppression)
}

export interface SimulateStatusResponse {
  simId: string;
  status: "running" | "done" | "failed";
  result?: SimulationResult;
  error?: string;
}

/** A versioned collection of suites generated for a specific journey+segment. */
export interface TestPlan {
  id: string;
  createdAt: string;
  journeyId: string;
  segmentId: string;
  /** Journey-level concern suites. */
  suites: TestSuite[];
  /** The shared profile cohort — every profile runs against every suite. */
  profiles: CohortProfile[];
}

/** A single completed QA run. Runs are versioned — every Run QA produces a new
 *  one, keyed by the backend runId, so prior results stay viewable. */
export interface QARunResult {
  id: string;            // backend runId
  createdAt: string;     // ISO timestamp
  journeyId: string;
  segmentId: string;
  planId: string | null; // which TestPlan (profile set) it ran against
  profileCount: number;
  report: QAReport;
}

export interface QAReport {
  runId: string;
  journeyId: string;
  segmentId: string;
  modelProvider: string;
  verdict: QAVerdict;
  summary: string;
  fit: FitFinding;
  structure: StructureFinding[];
  walks: WalkTrace[];
  suites?: SuiteSummary[];
  createdAt: string;
  durationMs: number;
}

export interface QARunRequest {
  journeyId: string;
  segmentId: string;
  profileCount?: number;
  suites?: TestSuite[];
  /** All profiles from the profiles tab — combined with suites to run the
   *  full cross-product: every profile × every scenario template. */
  baseProfiles?: Record<string, unknown>[];
}

export interface ProfileSynthRequest {
  journeyId: string;
  segmentId: string;
  profileCount?: number;
}

export interface ProfileSynthExtendRequest {
  journeyId: string;
  segmentId: string;
  instruction: string;
  existingProfiles?: CohortProfile[];
  count?: number;
}

export interface ProfileSynthJobResponse {
  synthId: string;
  status: "running";
}

export interface ProfileSynthStatusResponse {
  synthId: string;
  status: "running" | "done" | "failed";
  suites?: TestSuite[];
  profiles?: CohortProfile[];
  error?: string;
}

export interface QARunResponse {
  runId: string;
  status: "queued";
}
