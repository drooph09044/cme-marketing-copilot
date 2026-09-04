"""Prompt templates per LLM node. One constant per node.

Keep prompts terse and structured — every model the router targets must
follow them. Always demand JSON when downstream parses structured output.
"""

from __future__ import annotations

FIT_PROMPT = """You are a marketing-automation QA reviewer.

Given:
- SEGMENT: {segment_json}
- JOURNEY: name={journey_name}, goal={journey_goal}, entry_criteria={entry_criteria_json}, touchpoint_count={tp_count}

Decide whether this SEGMENT is a sensible audience for this JOURNEY.

Return a JSON object that matches this schema:
  verdict: "pass" | "warn" | "fail"
  score: float in [0,1]
  reasons: list of short strings (max 5)
  summary: one-sentence rationale

Be specific. Cite which segment rule conflicts with which entry criterion, if any.
"""

STRUCTURE_EXPLAIN_PROMPT = """You are a marketing-automation QA reviewer.

A static analyzer produced these findings for a journey graph:
{findings_json}

Journey context: name={journey_name}, touchpoint_count={tp_count}.

Rewrite each finding with a one-sentence explanation that a marketer would
understand. Keep `nodeId` and `severity` exactly as given. Return a JSON
array of objects with keys: nodeId, severity, message.
"""

PROFILE_SYNTH_PROMPT = """You are designing a QA TEST PLAN for a marketing journey against an audience
segment. The plan has TWO parts:

  (A) TEST SUITES — journey-level QA concerns. Each suite is a CHECK applied to
      the WHOLE cohort (not a group of profiles). Every generated profile is run
      against EVERY suite at test time.
  (B) PROFILE COHORT — one realistic audience of synthetic people. Each profile
      represents an ARCHETYPE of how a real person moves through THIS journey
      (derived from the journey's touchpoints/timing + the segment rules).

SEGMENT DEFINITION:
{segment_json}

JOURNEY NODES (entry → message touchpoints → exit, in order):
{nodes_json}

JOURNEY TOUCHPOINTS (each MESSAGE node references one by tpId; `timing.relativeDay`
gives WHEN it fires, `channel` gives the channel, `messageTheme` the content):
{touchpoints_json}

ENTRY CRITERIA (what qualifies / filters at the gate):
{entry_criteria_json}

────────────────────────────────────────────────────────────────────────────
PART A — TEST SUITES (fixed taxonomy). Include a suite ONLY when the journey
actually exercises it. DO NOT invent suites with no matching journey behaviour.
Each name must be EXACTLY one of:

- "Audience Qualification" — who ENTERS. Always include. Verifies eligible enter,
  ineligible are filtered, and holdout/control members are held back.
- "Suppression & Exclusion" — include when the journey sends messages. Verifies
  consent OFF, channel opt-outs, frequency-cap exhaustion, and active-case /
  open-appointment exclusions.
- "Experiment Traffic Split" — ONLY if the journey has a SPLIT / A-B node.
  Verifies variant allocation and holdback routing.
- "Personalization Rendering" — include if touchpoints carry themes / dynamic
  content. Verifies the right content variant renders for the profile.
- "Channel Discovery" — include if the journey has MESSAGE nodes. Verifies
  per-channel delivery readiness (email / push / sms / service-app).
- "Wait Node Timing" — include if touchpoints are time-spaced (relativeDay
  differs) or the journey has WAIT nodes. Verifies reminder spacing / cooldown /
  follow-up timing.
- "Exit Condition Logic" — always include. Verifies how profiles LEAVE: goal/exit
  conditions (booking, purchase, lead capture) and TTL/timeout.

Each suite object:
{{
  "name": "<exact suite name>",
  "description": "<one short sentence — what it verifies for THIS journey>",
  "expectedOutcome": "<one sentence>",
  "testCases": [
    {{ "title": "<short test-case name, 3-6 words>",
       "description": "<one short sentence of what this case checks>" }},
    … 3-10 concrete test cases that THIS suite covers for THIS journey …
  ]
}}
The test cases must be SPECIFIC to this journey's rules/touchpoints (e.g. for
Suppression: "Opt-out flag honoured", "Active service case excluded", "Open
appointment skip", "Frequency cap reached"). NO profiles inside suites.

────────────────────────────────────────────────────────────────────────────
PART B — PROFILE COHORT. Generate a realistic cohort of synthetic PEOPLE, sized
from the journey + segment complexity (typically 6-12 profiles; no padding).
Cover each ARCHETYPE the journey admits and spread across segment rule values.

ARCHETYPES (each profile carries one). A profile is SUPPRESSED (not messaged) for
exactly one of THREE reasons — make all three present:
- "holdout"            — in the HOLDOUT SEGMENT (control); suppressionReason="holdout_segment".
- "consent_suppressed" — lacks the consent needed to message; suppressionReason="no_consent".
- "experiment_holdback"— in the experiment's HOLDBACK arm; suppressionReason="experiment_holdback".
Messaged archetypes:
- "experiment_variant_a" / "experiment_variant_b" — eligible, routed to that A/B arm.
- "eligible_converter" — eligible, proceeds and converts.
Other:
- "ineligible"         — fails an entry rule; filtered at the gate (category="ineligible").
- "fcap_capped"        — eligible but frequency-capped.
ALWAYS include ≥1 of EACH suppression reason (holdout, no_consent, experiment_holdback),
≥1 ineligible, and a spread of eligible / variant converters. If the journey has NO
A/B split, drop the experiment_variant_* and experiment_holdback archetypes.

CONSENT MODEL — consent is GLOBAL or PER-CHANNEL, never just one boolean:
- "globalConsent" (bool): blanket marketing consent across all channels.
- "channelConsent" {{email, sms, push, call}}: per-channel opt-in.
- A profile may have GLOBAL consent (globalConsent=true → reachable on every channel
  it has opted into), or CHANNEL-ONLY consent (globalConsent=false but one or more
  channelConsent=true → reachable ONLY on those channels), or NO consent
  (globalConsent=false and all channelConsent=false → consent_suppressed).
Cover the spread: some global-consent profiles, some channel-only (e.g. email+push but
not sms/call), and the no-consent suppressed ones. Set "consentScope" to
"global" | "channel" | "none" accordingly.

DOMAIN-AWARE METADATA — infer the journey's DOMAIN (automotive, streaming, retail,
telco, sports…) and give 4-6 realistic labelled metadata cards that fit it
(e.g. auto → Vehicle, Last service, Odometer, Preferred dealer; streaming → Plan,
Last watched, Devices). Keep values realistic.

PROFILE SHAPE (every cohort profile, exactly):
{{
  "id": "AT-001",                 // sequential ID: AT-001, AT-002, …
  "name": "Riya N.",              // believable first name + last initial
  "initials": "RI",
  "summary": "Service-due SUV owner",
  "archetype": "<one archetype above>",
  "scenarioTag": "Variant B dealer-personalized reminder",
  "scenarioTone": "variant" | "eligible" | "excluded",
  "expectedOutcome": "Variant B dealer-personalized reminder",
  "region": "US" | "DE" | "FR" | "NL" | "ES" | "IT" | "UK",
  "age": <int 18-80>,
  "fcap": <int 0-3>,
  "category": "eligible" | "ineligible" | "excluded",
  "holdout": <bool — true ONLY for holdout_segment>,
  "globalConsent": <bool>,
  "consentScope": "global" | "channel" | "none",
  "channelConsent": {{ "email": <bool>, "sms": <bool>, "push": <bool>, "call": <bool> }},
  "suppressionReason": "holdout_segment" | "no_consent" | "experiment_holdback" | null,
  "metadata": [ {{ "label": "Vehicle", "value": "2021 Chevrolet Traverse" }}, … 4-6 cards … ],
  "ownerId": "OWN-400284",
  "rationale": "<one short sentence>"
}}

RULES:
- `scenarioTone`: "excluded" for any suppressed/ineligible profile; "variant" for A/B
  variant archetypes; "eligible" otherwise.
- `scenarioTag` examples: "Variant B dealer-personalized reminder", "EXCLUDED — no consent",
  "EXCLUDED — holdout segment", "EXCLUDED — experiment holdback".
- `suppressionReason` is set ONLY for suppressed archetypes (holdout / consent_suppressed /
  experiment_holdback); null otherwise.
- `name` is a real human name (first + last initial), NEVER a description.

PERMUTATION COVERAGE — the cohort must exercise the meaningful CROSS-PRODUCT for THIS
journey: {{ each suppression reason }} × {{ global vs channel-only consent }} × {{ each
A/B arm if a split exists }} × {{ key segment rule values }}. Don't pad with duplicates,
but ensure every relevant combination the journey can distinguish has at least one profile.

Hint on cohort size: {hint_count} (0 = size purely from the permutations above).

────────────────────────────────────────────────────────────────────────────
OUTPUT — a single JSON object:
{{
  "suites": [ {{ "name", "description", "expectedOutcome", "testCases": [ {{ "title", "description" }}, … ] }}, ... ],
  "profiles": [ {{ ...rich cohort profile... }}, ... ]
}}
"""

PROFILE_SYNTH_EXTEND_PROMPT = """You are EXTENDING the PROFILE COHORT of an existing QA test plan for a
marketing journey + audience segment. The user describes additional profiles
they want; produce ONLY those NEW cohort members (do NOT duplicate existing ones).

SEGMENT DEFINITION:
{segment_json}

JOURNEY TOUCHPOINTS:
{touchpoints_json}

JOURNEY ENTRY CRITERIA:
{entry_criteria_json}

EXISTING COHORT (ids + names already present — your new profiles must ADD
coverage, not repeat these):
{existing_profiles_json}

USER INSTRUCTION (free-form English describing what additional profiles are needed):
"{instruction}"

Hint on count: {count} (0 = infer from the instruction; otherwise ~this many new profiles).

YOUR JOB
1. Produce NEW cohort profiles matching the user's intent. Each profile is a
   realistic person with an ARCHETYPE describing how they traverse the journey.
2. Each new profile MUST follow this EXACT shape and field TYPES (do not invent
   nested objects — `consent` is a single boolean, NOT an object):
   {{
     "id": "p_x001",
     "name": "<believable PERSON name fitting the region, e.g. 'Sofia Marchetti'>",
     "archetype": "holdout" | "early_convert" | "late_convert" | "last_touch_convert"
                  | "never_convert" | "ineligible" | "consent_suppressed"
                  | "channel_limited" | "fcap_capped" | "ab_variant_a" | "ab_variant_b",
     "scenario": "<short label of this person's journey behaviour, 4-8 words>",
     "region": "DE" | "FR" | "NL" | "ES" | "IT" | "US" | "UK",
     "age": <int 18-80>,
     "consent": <bool>,
     "fcap": <int 0-3>,
     "lastSend": "<Nd>" e.g. "12d",
     "channelPreferences": {{ "email": <bool>, "sms": <bool>, "push": <bool>, "call": <bool> }},
     "attributes": {{ "<rule.field>": "<value>" }},
     "category": "eligible" | "ineligible",
     "holdout": <bool — true ONLY for holdout archetype>,
     "violatedRules": ["<rule.id>", ...],
     "convertsAt": "<tpId where they convert, or ''>",
     "rationale": "<one short sentence>"
   }}
3. Make ids distinct from existing ones (suffix "_x001", "_x002", ...).
4. Honour every segment rule + journey constraint. `name` is a real human name,
   NEVER a description; match the name to the region.

OUTPUT — a single JSON object with ONLY the NEW cohort profiles (no suites):
{{
  "suites": [],
  "profiles": [ ... ONLY the new cohort profiles ... ]
}}
"""

WALK_PROMPT = """You are running ONE TEST SUITE against ONE profile by simulating that profile
walking through the journey. You evaluate the journey ONLY through the lens of
the given suite's concern, and emit a verdict for THIS suite.

TEST SUITE BEING EVALUATED:
  name: {suite_name}
  concern: {suite_description}
  expected: {suite_expected}

PROFILE (note `archetype` — it describes how this person traverses the journey):
{profile_json}

JOURNEY NODES (entry → message touchpoints → exit, in order):
{nodes_json}

JOURNEY TOUCHPOINTS (tpId, `timing.relativeDay` = when it fires, `channel`,
`messageTheme`). The spacing between touchpoints is the WAIT/timing of the journey:
{touchpoints_json}

JOURNEY ENTRY CRITERIA:
{entry_criteria_json}

GENERAL JOURNEY SEMANTICS (apply within the suite's lens):
- archetype "holdout" / holdout==true: qualifies but is HELD BACK — must reach NO
  message touchpoint. Held back = pass; reaching a message = fail.
- consent==false / archetype "consent_suppressed": must NOT be messaged. Reaching a
  message = fail; suppressed before any message = pass.
- category=="ineligible" / archetype "ineligible": entry gate SHOULD filter at ENTRY
  (pass). Reaching a message = fail (gate broken).
- channel_limited: at a touchpoint whose channel the profile opted out of, that step
  is "warn" (gracefully skipped); other channels still deliver.
- converters (early/late/last_touch): they EXIT (convert) at their `convertsAt`
  touchpoint and receive no further messages — that is correct "pass" behaviour.
- never_convert: receives every eligible touchpoint and reaches EXIT/TTL — "pass".

SUITE-SPECIFIC FOCUS — judge mainly the concern named above:
- Audience Qualification → did entry correctly admit/▸filter this profile?
- Suppression & Exclusion → were consent/channel/fcap/holdout suppressions honoured?
- Channel Discovery → did each touchpoint's channel deliver or correctly skip?
- Wait Node Timing → did touchpoints fire in the right relative-day order / spacing,
  and stop once the profile converted?
- Personalization Rendering → would the right themed content render for this profile?
- Experiment Traffic Split → was the profile routed to the correct variant/holdback?
- Exit Condition Logic → did the profile leave via the correct exit (convert / TTL)?

Walk the nodes in order. For each node emit a step. When a node is a MESSAGE whose
touchpoint has a `timing.relativeDay`, note the wait before it in the reason
(e.g. "fires Day -60, 30d after previous"). Emit:
  nodeId, verdict ("pass"|"warn"|"fail"), reason (one short sentence tied to THIS suite).

Stop at the profile's exit/convert point or first "fail"; otherwise walk to EXIT.

Return JSON: {{
  "steps": [...],
  "endedAt": "<last nodeId visited>",
  "verdict": "pass" | "warn" | "fail"
}}.
"""

VERDICT_PROMPT = """You are writing the executive summary of a QA run.

FIT FINDING: {fit_json}
STRUCTURE FINDINGS: {structure_json}

WALK SUMMARY (aggregated — not raw traces). Fields:
- total: number of profile walks
- counts: overall pass/warn/fail tally
- perSuite: pass/warn/fail per test suite
- eligible / ineligible: pass/warn/fail split by profile category
- sampleFailures / sampleWarnings: a representative sample (capped) of
  failing/warning walks with their suite, scenario, endedAt, and reason
{walk_summary_json}

The overall verdict has ALREADY been computed deterministically: {computed_verdict}

Produce a 3-paragraph plain-English summary suitable for a marketer:
1. Whether the segment fits the journey.
2. Notable structural issues, if any.
3. What the simulated walks revealed — use the counts and perSuite breakdown,
   call out how eligible vs ineligible profiles fared, and cite the most
   important failures/warnings from the samples (do NOT invent any not listed).

Return JSON: {{ "verdict": "{computed_verdict}", "summary": "<text>" }}.
The verdict field MUST equal "{computed_verdict}".
"""

SIMULATE_PROMPT = """You are simulating ONE profile's journey and evaluating EVERY TEST CASE of
EVERY suite for that profile. Each test case gets a binary PASS or FAIL.

PROFILE (note archetype, category, holdout, consent, channelPreferences, metadata):
{profile_json}

JOURNEY NODES (entry → message touchpoints → exit, in order):
{nodes_json}

JOURNEY TOUCHPOINTS (tpId, timing.relativeDay, channel, messageTheme):
{touchpoints_json}

ENTRY CRITERIA:
{entry_criteria_json}

TEST SUITES — each has a `name` and a list of `testCases` ({{title, description}}).
You MUST emit EXACTLY ONE check per test case (do not add, drop, merge, or rename
test cases). Use the test case's `title` verbatim as the check `title` and the
suite's `name` as `suite`:
{suites_json}

CONSENT — the profile has `globalConsent`, `consentScope`, and per-channel
`channelConsent` {{email, sms, push, call}}. A channel may be messaged only if the
profile has global consent OR per-channel consent for that channel. A touchpoint on
a non-consented channel must be correctly skipped.

SUPPRESSION — a suppressed profile carries `suppressionReason` (one of
"holdout_segment", "no_consent", "experiment_holdback"); it must NOT be messaged.

TEST CASE STATUS — each test case is exactly ONE of:
- "pass"    — the journey behaved correctly for this profile at that stage.
- "fail"    — the journey behaved INCORRECTLY (e.g. messaged a suppressed/non-consented
              profile, admitted an ineligible one, mis-routed a variant).
- "skipped" — DID NOT EXECUTE. The profile never reached this stage because the
              journey STOPPED EARLIER (suppressed at the gate, held back, exited, or
              converted). A stage that the profile never reaches CANNOT pass or fail —
              it is "skipped".

STOP-ON-SKIP — once the profile STOPS MOVING FORWARD (suppressed / held back /
ineligible-filtered / exited / converted), the journey does NOT proceed. EVERY test
case for a stage AFTER that stop point is "skipped". Do not mark a later stage pass
or fail if the profile never reached it. Examples:
- A no-consent / holdout / ineligible profile is stopped at the entry/holdout gate →
  the gate's own cases are "pass" (correctly stopped), and ALL downstream message /
  channel / wait / personalization / exit cases are "skipped".
- A profile that converts at touchpoint 1 → cases for later touchpoints are "skipped".
- A channel touchpoint correctly skipped (not consented) → that one case is "skipped",
  and the journey continues to the next consented touchpoint.

Set each check `description` to a one-sentence reason for its pass / fail / skip.
The overall `verdict` is "fail" if ANY check is "fail", else "pass" (skips never fail).

JOURNEY PATH — trace the ORDERED nodes the profile ACTUALLY reaches, from ENTRY to
where it stops. Once the profile stops, the path ENDS — do not list later nodes.
- `nodeId`: the journey node id (n1, n2, …).
- `label`: short label ("Entry — service due", "Day -60 Email", "Exit").
- `action`: "entered" / "delivered" / "skipped" (channel skipped, journey continues) /
  "suppressed" (stopped/held back here) / "converted" / "exited".
- `status`: "pass" if the node behaved correctly, "fail" if not, "skipped" if the
  channel/step was skipped.

Return JSON:
{{
  "profileId": "{profile_id}",
  "expected": "<the profile's expectedOutcome>",
  "path": [ {{ "nodeId": "n1", "label": "Entry — service due", "action": "entered", "status": "pass" }}, … ],
  "checks": [ {{ "suite": "<suite name>", "title": "<test case title, verbatim>",
                 "description": "<why this profile passed / failed / did not execute>",
                 "status": "pass" | "fail" | "skipped" }}, ... ],
  "verdict": "pass" | "fail"
}}
"""
