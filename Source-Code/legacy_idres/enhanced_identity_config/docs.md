# Identity Resolution - Review Notes

This document explains the ID Graph matching approach in simple review language. The same design is available for Media and Sports through separate source-specific YAML configuration files.

The goal is not to change the whole UI experience. The goal is to improve the matching decision layer while keeping the familiar legacy match types: exact, strong, medium, and weak.

## 1. Overall Flow

| Step | What Happens | Main Output |
| --- | --- | --- |
| Standardized input | We start from already standardized source records. | source records |
| Matching field preparation | Create matching-ready fields without changing source values. | email_standardized, phone_standardized, name parts |
| Candidate generation | Find possible record pairs only. | candidate pairs |
| Feature comparison | Compare Email, Phone, Name, Address, and Probabilistic Signals separately. | one confidence per feature |
| Confidence scoring | Convert feature confidence into weighted contribution and one cumulative score. | final confidence |
| Match classification | Classify final confidence into exact, strong, medium, or weak. | edge_type / match_tier |
| Clustering | Cluster accepted exact/strong/medium/weak matched pairs in tier order. | person clusters |
| Household linking | Link separate person clusters that share the same address and ZIP. | household_links.csv |
| Golden records | Create one golden record per person cluster. | golden_records.csv |

Important principle:

Candidate generation only discovers possible pairs. It does not decide same person.

## 2. Primary Matching Configuration

The identity engine lets the business define what the identity run is primarily driven by.

| Setting | Current Media/Sports Value | Meaning |
| --- | --- | --- |
| Primary Identifier | Email or Phone | Preset that drives feature weights, candidate strategy order, and clustering priority. |
| Available Primary PII Fields | Email/Phone | These are the current primary fields available for identity scoring and UI tuning. |
| Available Key Identifiers | None enabled | Future industries can add Customer ID, Account ID, Vehicle ID, Loyalty ID, etc. |

This keeps the design industry-flexible. Media and Sports can be driven by Email or Phone today, while another industry can later choose a key identifier such as customer ID or vehicle ID without changing the UI pattern.

The primary identifier does not replace feature scoring. It applies a configurable preset. For example, selecting Phone makes Phone the highest-weight feature, runs phone candidate discovery first, and processes phone-based links first during clustering. Users can still manually tune weights after the preset is applied.

For configured identity sources, primary identifier options, feature weights, match thresholds, candidate strategy order, and identifier priority come from the YAML configuration. The UI reads and saves that YAML-backed configuration. Legacy hardcoded primary-tag presets are only used when a selected source does not have a YAML config.

| Primary Identifier Example | What Changes |
| --- | --- |
| Email | Same Email candidates first, Email highest weight, Email first in clustering priority |
| Phone | Same Phone candidates first, Phone highest weight, Phone first in clustering priority |

Name and Address are intentionally not Primary Identifiers. Name remains a fuzzy PII feature for scoring, and Address remains available for Address + ZIP candidate discovery, scoring support, and household linking. Neither should drive person identity by itself.

## 3. Why We Changed The Legacy Approach

The legacy pipeline already had useful parts:

- blocking
- exact matching
- Soundex
- Jaro-Winkler
- weighted score
- clustering
- golden records

The issue was that candidate generation, scoring, edge type, and clustering were tightly mixed.

Legacy flow was closer to:

`blocking -> compare fields -> weighted score -> edge tier -> clustering`

The new flow is:

`candidate pair -> feature confidence -> weighted cumulative score -> match classification -> clustering`

This is easier to review because we can now show:

- Email matched or not
- Phone matched or not
- Name matched by which method
- Address contributed only as lower-weight supporting evidence
- Probabilistic signal came from Device ID or IP Address
- Final relationship decision before clustering

## 4. Matching Field Preparation

Matching field preparation is not replacing standardization.

The input data is already standardized before the identity engine runs. This step only creates derived matching fields needed by the identity engine.

Original source values are not changed.

Source column names and derived matching column names are configured in `media_identity_config.yaml`. For example, the config maps the source email field to `email`, then creates `email_raw`, `email_standardized`, `email_name_part`, and `email_provider` for matching. If another industry uses different source columns, those names should be changed in config rather than in Python.

Key identifiers are also a future configuration extension point. Media and Sports currently use common PII features only: Email, Phone, Name, Address, and Probabilistic Signals.

| Source Field | Matching Fields We Use | Why |
| --- | --- | --- |
| Email | email_raw, email_standardized, email_name_part, email_provider | compare exact emails, plus-tag variants, domain fixes, and provider differences |
| Phone | phone_raw, phone_standardized | exact phone comparison |
| Name | name_raw, first name, last name, initials | name waterfall comparison |
| Address | address_raw, address_standardized, house_number, street_name, ZIP | address/household comparison |
| Device/IP | device ID, IP address | probabilistic/enrichment only; not used for default candidate generation |

Example:

| Source Email | email_standardized |
| --- | --- |
| ROGER.COOK845+SPORTS@GMAIL.COM | roger.cook845@gmail.com |
| AAROA.WOODSS681@@OUTLOOK.COM | aaroa.woodss681@outlook.com |
| AAROA.WOODSS681@OUTLOOK.CO | aaroa.woodss681@outlook.com |

The original source values remain available in records and golden records.

Internal helper fields may exist in the prepared-record output for processing, but the review focus is only on these business-readable matching fields.

## 5. Candidate Generation

Candidate generation finds records that are worth comparing.

It does not classify records as exact, strong, medium, or weak.

Current candidate strategies are defined in YAML under `candidate_generation.strategy_definitions`.

| Strategy | What It Finds | Why We Use It |
| --- | --- | --- |
| Standardized Email Match | same email_standardized value | high precision candidate discovery, including plus-tag/domain-cleanup variants |
| Standardized Phone Match | same phone_standardized value | high precision candidate discovery |
| Name and ZIP Candidate | similar name parts within same ZIP | useful when email/phone are missing |
| Address and ZIP Candidate | same address and ZIP | household discovery |

Device ID and IP address are not used for candidate generation because they can create noisy household/device-level pairs. They remain probabilistic/enrichment signals only.

Implementation note:

- Each strategy has an `enabled` flag, a `type`, configured fields, and a display `label`.
- `exact_fields` strategies compare configured matching fields exactly, such as `email_standardized` or `phone_standardized`.
- `name_zip_prefix` uses configured first-name, last-name, and ZIP fields with a configured character count.
- Candidate strategy display names are configured, so review wording can change without code changes.
- We are not using DBSCAN or machine-learning classification in the current Media identity engine.
- Sorted-neighborhood and canopy-style discovery can be added later if recall is still too low after reviewing output quality.

## 6. Feature Comparison

Each candidate pair is compared feature by feature.

The final feature confidence columns are:

- email_confidence
- phone_confidence
- name_confidence
- address_confidence
- probabilistic_confidence

Each feature produces one final confidence. We do not treat every comparison method as a separate identity decision.

Each feature is configured in `media_identity_config.yaml` under the `features` section.
That section keeps the feature weight, comparison pipeline, thresholds, labels, and no-match behavior together.
Algorithmic comparisons, such as Jaro-Winkler, calculate their own similarity value, while the config controls when the algorithm is used and what threshold it must pass.
Matching technique labels are configured per feature. UI wording such as `Standardized Email Exact Match`, `First Name + Last Name`, `Initials + Jaro-Winkler`, and `ZIP + House Number + Street` is not embedded in the Python comparison logic.

Soundex and Jaro-Winkler are not stored as prepared record fields. They are algorithms used inside the Name Matching step to decide the final `name_confidence`.

| Feature | Config Controls |
| --- | --- |
| Email | weight, raw exact method, standardized exact method, provider mismatch method, no-match confidence |
| Phone | weight, standardized exact method, no-match confidence |
| Name | weight, comparison pipeline, initials requirement, first-character count, similarity threshold |
| Address | weight, ZIP-first pipeline, house-number check, street similarity threshold |
| Probabilistic Signals | weight, contribution cap, device/IP enablement and confidence |

## 7. Email Matching

Email matching has three parts:

1. Prepare email for matching.
2. Compare email.
3. Produce one email confidence.

Email preparation:

- lowercase
- trim spaces
- remove plus tags
- handle repeated `@`
- collapse repeated dots
- apply configured domain corrections

Email comparison order:

| Order | Technique | Example |
| --- | --- | --- |
| 1 | Exact original email | john@gmail.com = john@gmail.com |
| 2 | Exact after cleanup | john+sports@gmail.com = john@gmail.com |
| 3 | Different provider or different standardized email | john@gmail.com vs john@outlook.com |

Examples:

| Email 1 | Email 2 | Result |
| --- | --- | --- |
| ROGER.COOK845@GMAIL.COM | ROGER.COOK845@GMAIL.COM | exact original email |
| ROGER.COOK845+SUB@GMAIL.COM | ROGER.COOK845@GMAIL.COM | same after plus-tag cleanup |
| AAROA.WOODSS681@@OUTLOOK.COM | AAROA.WOODSS681@OUTLOOK.COM | same after repeated @ cleanup |
| AAROA.WOODSS681@OUTLOOK.CO | AAROA.WOODSS681@OUTLOOK.COM | same after domain correction |
| john@gmail.com | john@outlook.com | different provider, not exact email match |

Current Media behavior:

- exact original email confidence comes from config
- exact standardized email confidence comes from config
- known domain typo correction is treated as data-quality cleanup
- different valid providers or different standardized emails use the configured no-match/different-provider confidence
- email Jaro-Winkler is not used in the matching layer

## 8. Phone Matching

Phone matching is intentionally simple.

Phone process:

1. Keep original phone.
2. Create phone_standardized digits.
3. Compare exact standardized phone.
4. Ignore configured low-quality or incomplete phone values during matching.

Examples:

| Phone 1 | Phone 2 | Result |
| --- | --- | --- |
| 212-894-2340 | 2128942340 | exact standardized phone |
| 212-894-2340 | 212-894-9999 | no phone match |

We do not use last 7 digits, prefixes, or partial phone matching by default.

Low-quality phone values such as repeated digits or incomplete local-only numbers are controlled in YAML under `matching_field_preparation.phone_normalization`. They are not hardcoded in Python.

## 9. Name Matching

Name matching is a waterfall.

That means the engine checks from stronger comparisons to weaker/fuzzy comparisons. The output is one final name_confidence, not separate Soundex/Jaro-Winkler scores.

Configured Media order:

| Order | Technique | Example |
| --- | --- | --- |
| 1 | First Name + Last Name | ROGER COOK vs ROGER COOK |
| 2 | Initials | R C vs ROGER COOK |
| 3 | First 3 Characters | ROG + COO |
| 4 | First Initial + Full Last Name | R COOK vs ROGER COOK |
| 5 | Full First Name + Last Initial | ROGER C vs ROGER COOK |
| 6 | Soundex | SMITH vs SMYTH |
| 7 | Jaro-Winkler | JOHNATHAN vs JONATHAN |

How it works:

- If first name and last name match exactly, name_confidence uses the configured exact-name confidence.
- If exact name fails, initials are checked.
- If initials are required and do not match, name matching stops.
- If initials match, the engine checks first-three characters and partial-name structures.
- Partial-name matches do not immediately stop the process; Soundex and Jaro-Winkler can validate or improve the same final name_confidence.
- Soundex and Jaro-Winkler are algorithms inside the same Name feature, not independent identity rules.

Examples:

| Name 1 | Name 2 | Matching Technique |
| --- | --- | --- |
| ROGER COOK | ROGER COOK | First Name + Last Name |
| R COOK | ROGER COOK | First Initial + Full Last Name |
| ROGER C | ROGER COOK | Full First Name + Last Initial |
| JOSUHA LEWIS | JOSHUA LEWIS | Initials + First Characters + Soundex + Name Similarity |
| CNDY COLLIER | CINDY COLLIER | First Initial + Full Last Name + Soundex + Name Similarity |
| SMITH | SMYTH | Initials + Soundex + Name Similarity |
| JOHNATHAN | JONATHAN | Jaro-Winkler name similarity when earlier structure is not enough |

Soundex and Jaro-Winkler do not create separate match decisions. They help generate one final name confidence for the Name feature.

## 10. Address Matching

Address is household/probabilistic evidence, not primary person identity evidence.

Address comparison order:

| Order | Technique |
| --- | --- |
| 1 | ZIP must match |
| 2 | House number must not conflict |
| 3 | Exact address_standardized value |
| 4 | Street similarity inside the same ZIP |

Examples:

| Address 1 | Address 2 | Result |
| --- | --- | --- |
| 215 Lincoln Drive, 1591 | 215 Lincoln Dr, 1591 | address evidence |
| 215 Lincoln Drive, 1591 | 824 Forest Lane, 1591 | same ZIP, different address |
| 215 Lincoln Drive, 1591 | 215 Lincoln Drive, 9999 | no positive address evidence |

A different address does not automatically mean different person. A customer can move or have multiple addresses.

## 11. Probabilistic Signals

Probabilistic signals are enrichment evidence only.

Current probabilistic fields:

- Device ID
- IP Address

Current behavior:

- Device matching can be enabled from config.
- IP matching is disabled by default.
- Probabilistic signals cannot independently create accepted person match tiers.
- Probabilistic contribution is capped by config.
- When a probabilistic signal contributes, the UI shows the actual field used, for example `Probabilistic Signal (Device ID)`.

Example:

| Evidence | Meaning |
| --- | --- |
| Same Device ID | probabilistic evidence only |
| Same IP Address | weak probabilistic evidence only, disabled by default |
| Device/IP only | not enough for an accepted person match tier |

## 12. Confidence Scoring

Scoring has two layers:

1. Feature confidence
2. Weighted cumulative contribution

Formula:

`feature contribution = feature confidence * feature weight`

Current feature weights are driven by the selected Primary Identifier.

| Primary Identifier | Email Weight | Phone Weight | Name Weight | Address Weight | Probabilistic Weight |
| --- | ---: | ---: | ---: | ---: | ---: |
| Email | 45 | 40 | 30 | 10 | 5 |
| Phone | 40 | 45 | 30 | 10 | 5 |

The selected primary identifier gets the highest weight. The other trusted PII identifier stays at or above the weak threshold so changing the primary identifier does not accidentally split clean email or phone identities.

Example:

| Feature | Confidence | Weight | Contribution |
| --- | ---: | ---: | ---: |
| Email | 1.00 | 45 | 45 |
| Phone | 0.00 | 40 | 0 |
| Name | 1.00 | 30 | 30 |
| Address | 0.00 | 10 | 0 |
| Probabilistic Signals | 0.00 | 5 | 0 |

Raw confidence:

`45 + 30 = 75`

Final confidence is the same weighted cumulative score. Missing fields do not add points, and they do not create a negative penalty.

This keeps the legacy scoring philosophy: every matched PII feature contributes its configured weight, all contributions add up to one overall score, and that score determines the match tier.

## 13. Match Classification

The identity engine classifies every scored pair using the same legacy match tiers and thresholds.

Match labels:

| Match Type | Meaning | Clustered? |
| --- | --- | --- |
| exact | highest-confidence match | yes |
| strong | high-confidence match | yes |
| medium | moderate-confidence match | yes |
| weak | partial-signal match | conditionally |

Current match tier thresholds:

| Setting | Value | Purpose |
| --- | ---: | --- |
| exact | 83 | full identity match |
| strong | 77 | high-confidence match |
| medium | 69 | moderate-confidence match |
| weak | 40 | partial-signal match / write threshold |

Pairs below the weak threshold are not written as matched edges.

Weak edges are visible for review, but only configured safe weak patterns are allowed to form person clusters. Current configuration allows weak `Email` links to cluster, but blocks weak phone-only links. This prevents shared or bad phone values such as `111-111-1111` from stitching unrelated people into the same golden record.

Examples:

| Evidence | Classification |
| --- | --- |
| Very high final confidence | exact |
| High final confidence | strong |
| Moderate final confidence | medium |
| Partial final confidence above weak threshold | weak |
| Final confidence below weak threshold | not written as a matched edge |

## 14. Output Used By UI

Important candidate-pair columns:

| Column | Meaning |
| --- | --- |
| matched_fields | fields that contributed evidence |
| matching_techniques | how those fields matched |
| matching_person_feature_count | count of matched person-level features: Email, Phone, Name |
| email_confidence | email feature confidence |
| phone_confidence | phone feature confidence |
| name_confidence | name feature confidence |
| address_confidence | address feature confidence |
| probabilistic_confidence | probabilistic feature confidence |
| email_contribution | email confidence multiplied by weight |
| phone_contribution | phone confidence multiplied by weight |
| name_contribution | name confidence multiplied by weight |
| address_contribution | address confidence multiplied by weight |
| probabilistic_contribution | probabilistic confidence multiplied by weight |
| final_confidence | final pair confidence used for match classification |
| edge_type | exact, strong, medium, or weak |
| match_tier | same value as edge_type for UI compatibility |
| relationship_classification | internal duplicate of match tier; UI should display match tier wording |
| decision_reason | short explanation of why the tier was assigned |

UI review should show:

- Matched Fields
- Matching Techniques
- Feature Evidence such as `Email 45/45`, `Name 30/30`
- Match Type
- Decision Reason
- Final Confidence

## 15. Cluster Guardrails And Merge Priority

The identity clusterer does not blindly merge every accepted link.

Before joining two groups, it checks cluster guardrails:

| Guardrail | Purpose |
| --- | --- |
| Max distinct standardized emails | prevents one cluster from collecting too many email identities |
| Max distinct standardized phones | prevents shared/bad phone values from over-merging |
| Max distinct standardized names | catches unusual clusters with too many names |
| Max cluster size | prevents very large graph collapse |

Merge links are processed in configured identifier priority:

`Email -> Phone -> Name -> Address -> Probabilistic Signals`

This means high-confidence person identifiers are considered before weaker probabilistic identifiers.

If a merge would violate a guardrail, that link is blocked and counted in the cluster summary.

## 16. End-To-End Example

Input records:

| Field | Record A | Record B |
| --- | --- | --- |
| Name | AAROA WOODSS | AAROA WOODSS |
| Email | AAROA.WOODSS681@OUTLOOK.COM | AAROA.WOODSS681@OUTLOOK.CO |
| Phone | blank | blank |
| Address | blank | blank |

Step-by-step:

| Step | Result |
| --- | --- |
| Email preparation | outlook.co is corrected to outlook.com |
| Email comparison | email_standardized values match |
| Email confidence | 1.00 |
| Name comparison | First Name + Last Name |
| Name confidence | 1.00 |
| Phone | missing, contributes 0 |
| Raw confidence | Email 40 + Name 30 = 70 |
| Final confidence | 70 |
| Match tier | medium |
| Clustering | accepted because medium links enter clustering |
| Golden record | created only after accepted cluster links are formed |

This keeps scoring explainable: feature confidence is always calculated first, then feature confidence is multiplied by feature weight, summed into final confidence, and classified using configured match-tier thresholds.

Household is handled separately from person matching. If two different person clusters share the same standardized address and ZIP, the engine writes a secondary household link in `household_links.csv`. That household link does not merge the people into one person cluster.

Important review note: a golden record can have a `household_id` even when `household_links.csv` has zero rows. That means the record belongs to an address-based household, but no other separate person cluster currently shares that same standardized address and ZIP.

## 17. UI Review View

The UI keeps the existing ID Graph flow:

- Configuration
- Graph View
- Tabular View
- Report View
- Golden Records

The ID Graph view adds clearer evidence:

| UI Area | What It Shows |
| --- | --- |
| Graph View | records and exact/strong/medium/weak links in the selected cluster |
| Edge Click | relationship tier, overall score, matched fields, feature contributions, and matching criteria |
| Tabular View | relationship tier, matched fields, overall score, and matching criteria for each linked record |
| Report View | tier distribution, records by source, and matched fields for the selected cluster |
| Top summary | exact, strong, medium, weak, and guardrail-blocked links when present |

Important wording:

- Records are customer/source records.
- Match links are accepted pairwise links.
- A cluster can have many links because many records can connect to the same customer.
- Pairs below the weak threshold do not enter clustering.

## 18. Current Sports Run

Sports now uses the same identity pipeline with a separate `sports_identity_config.yaml`.
Sports is configured with the same common identity features as Media: Email, Phone, Name, Address, and Probabilistic Signals.

| Output Metric | Current Sports Result |
| --- | ---: |
| Source records processed | 59,710 |
| Matched candidate pairs | 424,936 |
| Exact links | 19,015 |
| Strong links | 14 |
| Medium links | 288,638 |
| Weak links | 117,269 |
| Golden records | 29,631 |
| Multi-record golden records | 1,274 |
| Household links | 0 |

Sports uses the same matching ideas as Media: standardized Email, standardized Phone, Name + ZIP, and Address + ZIP candidate discovery; feature confidence for Email, Phone, Name, Address, and Probabilistic Signals; exact/strong/medium/weak classification; cluster guardrails; and separate household linking.

## 19. Incremental Update Status

The current identity engine runs as a full-refresh identity graph.

The config now records incremental mode as disabled:

`incremental_update.enabled = false`

Future incremental processing should keep stable golden IDs where possible and only reprocess new or changed records. That is intentionally not fully implemented yet.

## 20. Summary

The ID Graph keeps the familiar legacy UI flow but improves the matching decision layer.

Main improvements:

- candidate generation is separate from matching
- original values are preserved
- derived fields are used only for matching
- Email, Phone, Name, Address, and Probabilistic Signals each produce one confidence
- Name uses a waterfall with Soundex and Jaro-Winkler as fallbacks
- scoring is confidence multiplied by configurable weight
- missing evidence is not treated as disagreement
- match classification happens before clustering
- exact, strong, medium, and weak matched edges create clusters, using legacy tier ordering
- pairs below weak are excluded from clustering
- cluster guardrails protect against over-merging
- identifier priority controls merge order


