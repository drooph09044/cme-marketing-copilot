# Identity Implementation Change Log

This file lists the main files added or changed for the ID Graph implementation.

## Purpose

The implementation keeps the legacy ID Graph user experience, but improves the matching decision layer.

The legacy UI still has:

- Configuration
- Graph View
- Tabular View
- Report View
- Golden Records

The backend adds:

- matching field preparation
- feature-level confidence
- weighted contribution scoring
- match classification into `exact`, `strong`, `medium`, and `weak`
- person clustering for accepted match tiers
- separate household links
- primary identifier configuration
- identifier-priority merge ordering
- cluster guardrails for distinct emails, phones, and names

## New Or Changed Pipeline Files

| File | Status | What It Does |
| --- | --- | --- |
| `legacy_idres/enhanced_prepare_matching_fields.py` | Added | Prepares matching-ready fields from configured source fields and writes `enhanced_prepared_records.csv`. |
| `legacy_idres/enhanced_candidate_pair_scoring.py` | Added/changed | Reads prepared records, generates candidate pairs from configured strategies, compares features, calculates confidence, and classifies match tiers. |
| `legacy_idres/enhanced_clustering.py` | Added/changed | Clusters accepted `exact`, `strong`, `medium`, and `weak` person links, applies identifier-priority ordering and cluster guardrails, and writes same-address household links separately. |
| `legacy_idres/enhanced_golden_records.py` | Added/changed | Builds golden records from person clusters and writes superseded IDs. |

## Configuration And Documentation Files

| File | Status | What It Does |
| --- | --- | --- |
| `legacy_idres/enhanced_identity_config/media_identity_config.yaml` | Added/changed | Stores Media-specific primary matching settings, matching cleanup, candidate strategies, feature comparison pipelines, weights, thresholds, identifier priority, cluster guardrails, and clustering prefixes. |
| `legacy_idres/enhanced_identity_config/sports_identity_config.yaml` | Added | Stores Sports-specific matching settings, Sports input/output paths, Sports field mappings, feature comparison pipelines, weights, thresholds, identifier priority, cluster guardrails, and clustering prefixes. |
| `legacy_idres/enhanced_identity_config/docs.md` | Changed | Review-ready documentation explaining the pipeline, matching methods, scoring, classification, examples, and UI behavior. |
| `legacy_idres/enhanced_identity_config/implementation_change_log.md` | Added | This file. Lists files added/changed and summarizes what each change does. |

## UI And Backend Integration Files

| File | Status | What Changed |
| --- | --- | --- |
| `legacy_idres/backend/app.py` | Changed | Runs the pipeline as prepare fields, score pairs, cluster, and golden records; sends edge evidence, match tier counts, and cluster summary details to the existing ID Graph APIs. |
| `src/idres/pages/IDGraph.jsx` | Changed | Keeps the legacy ID Graph flow while showing primary identifier controls, matched fields, match tiers, feature contribution evidence, and the field behind probabilistic evidence such as `Probabilistic Signal (Device ID)`. Configured sources load primary identifiers, weights, thresholds, and strategy order from YAML; hardcoded presets are limited to legacy fallback flows. |
| `src/idres/pages/IDGraph_ReportingChild.jsx` | Changed | Shows match tier decisions, records by source, and feature contribution totals for selected graph clusters. |

## Generated Output Files

These are produced by running the identity pipeline.

| Output | What It Contains |
| --- | --- |
| `legacy_idres/matching_output/media/candidate_pairs.csv` | Candidate pairs with matched fields, matching techniques, feature confidence, feature contribution, final confidence, and relationship classification. |
| `legacy_idres/matching_output/media/enhanced_prepared_records.csv` | Source records with derived matching fields. Original values remain unchanged. |
| `legacy_idres/clustering_output/media/clustered_records.csv` | Source records assigned to person clusters. |
| `legacy_idres/clustering_output/media/household_links.csv` | Secondary household links for different person clusters sharing the same standardized address and ZIP. |
| `legacy_idres/clustering_output/media/cluster_summary.json` | Summary of cluster counts and relationship counts. |
| `legacy_idres/golden_records_output/media/golden_records.csv` | One golden record per person cluster. |
| `legacy_idres/golden_records_output/media/superseded_ids.csv` | Source record to golden record bridge. |
| `legacy_idres/golden_records_output/media/golden_record_summary.json` | Golden record summary counts. |
| `legacy_idres/matching_output/sports/candidate_pairs.csv` | Sports candidate pairs with matched fields, matching techniques, feature confidence, feature contribution, final confidence, and match tier. |
| `legacy_idres/matching_output/sports/enhanced_prepared_records.csv` | Sports source records with derived matching fields. Original values remain unchanged. |
| `legacy_idres/clustering_output/sports/clustered_records.csv` | Sports source records assigned to person clusters. |
| `legacy_idres/clustering_output/sports/household_links.csv` | Sports secondary household links for different person clusters sharing the same standardized address and ZIP. |
| `legacy_idres/clustering_output/sports/cluster_summary.json` | Summary of Sports cluster counts and match tier counts. |
| `legacy_idres/golden_records_output/sports/golden_records.csv` | One golden record per Sports person cluster. |
| `legacy_idres/golden_records_output/sports/superseded_ids.csv` | Sports source record to golden record bridge. |
| `legacy_idres/golden_records_output/sports/golden_record_summary.json` | Sports golden record summary counts. |

## Main Logic Changes

### 0. Primary Matching Configuration

The source configuration now has a business-facing identity matching section.

- `primary_tag` stores the selected Primary Identifier and applies a preset for feature weights, candidate strategy order, and clustering priority.
- `primary_tag_presets` keeps those presets in config so the UI can change behavior without code edits.
- Current Media and Sports primary matching use Email and Phone as available Primary Identifiers.
- Sports intentionally uses the same common identity features as Media: Email, Phone, Name, Address, and Probabilistic Signals.
- Future industries can add key identifiers such as Customer ID, Account ID, Loyalty ID, or Vehicle ID in configuration.
- The UI now attempts to load a YAML config for the selected source first. If no source-specific YAML config exists, it falls back to the legacy blocking configuration.

### 1. Matching Field Preparation

Original source values are kept. Derived fields are created only for matching.

Examples:

- Email plus tags are ignored during matching.
- Repeated `@` is cleaned during matching.
- Configured email domain typos are corrected during matching.
- Phone is normalized to digits for exact comparison.
- Configured low-quality or incomplete phone values are removed from matching.
- Name fields such as raw name, first name, last name, and initials are derived.
- Soundex and Jaro-Winkler are calculated only during Name Matching; they are not stored as prepared record fields.
- Address fields such as address_standardized, house number, street name, and ZIP are derived.
- Derived matching-field output column names are configured in `matching_field_preparation.derived_field_names`.
- Matching-field preparation is now a separate pipeline script, so field cleanup can be reviewed independently from pair scoring.

### 2. Candidate Generation

Candidate generation only discovers possible pairs. It does not assign `exact`, `strong`, `medium`, or `weak`.

Current configured strategies:

- Same Email
- Same Phone
- Name + ZIP
- Address + ZIP
Device ID and IP are not used as default candidate-generation strategies.

Candidate generation is now driven by `candidate_generation.strategy_definitions`. Each strategy defines whether it is enabled, which strategy type to use, which matching fields to compare, and the business-readable label to write into output.

### 3. Feature Comparison

Each feature produces one confidence value:

- `email_confidence`
- `phone_confidence`
- `name_confidence`
- `address_confidence`
- `probabilistic_confidence`

Feature comparison is now configured under one business-readable `features` section. Each configured feature keeps its weight, comparison method pipeline, threshold, label, and no-match behavior together. The code supplies reusable comparison functions, while YAML decides which method runs for each feature.

### 4. Name Matching Waterfall

The Name feature uses configured order:

1. First Name + Last Name
2. Initials
3. First 3 Characters
4. First Initial + Full Last Name
5. Full First Name + Last Initial
6. Soundex
7. Jaro-Winkler

Partial-name matches do not immediately stop the Name feature. Soundex and Jaro-Winkler can validate or improve the same final `name_confidence`. They are not separate identity decisions or prepared-record fields.

### 5. Cumulative Confidence

Each feature confidence is multiplied by its weight.

Example:

| Feature | Confidence | Weight | Contribution |
| --- | ---: | ---: | ---: |
| Email | 1.00 | 45 | 45 |
| Name | 1.00 | 30 | 30 |
| Phone | missing | 35 | 0 |

Final confidence is the sum of the feature contributions. Missing fields do not subtract from the score; they simply add no contribution.

### 6. Match Classification

Pairs are classified before clustering using legacy-style match tiers:

- `exact`
- `strong`
- `medium`
- `weak`

The output also includes `decision_reason`, which explains why the pair was classified.

Accepted match tiers enter person clustering. Weak edges are accepted only when they match configured safe weak patterns, such as email-only. Weak phone-only edges are visible in pair output but do not form person clusters. Household linking is secondary and is written separately when different person clusters share the same standardized address and ZIP.

### 7. Cluster Guardrails And Identifier Priority

The clusterer processes accepted person links by configured identifier priority:

1. Email
2. Phone
3. Name
4. Address
5. Probabilistic Signals

Before merging two groups, the clusterer checks configured guardrails:

- maximum distinct standardized emails
- maximum distinct standardized phones
- maximum distinct standardized names
- maximum cluster size

If a link would create an unsafe cluster, the merge is blocked and counted in `cluster_summary.json`.

## Current Refreshed Output Counts

Latest refreshed Media outputs:

| Metric | Count |
| --- | ---: |
| Accepted matched pairs | 271,329 |
| Exact links | 3,189 |
| Strong links | 454 |
| Medium links | 3,659 |
| Weak links | 264,027 |
| Multi-record clusters | 2,033 |
| Largest cluster size | 43 |
| Golden records | 33,282 |
| Superseded IDs | 84,284 |
| Household links | 64 |

Latest refreshed Sports outputs:

| Metric | Count |
| --- | ---: |
| Accepted matched pairs | 424,936 |
| Exact links | 19,015 |
| Strong links | 14 |
| Medium links | 288,638 |
| Weak links | 117,269 |
| Multi-record clusters | 1,274 |
| Largest cluster size | 153 |
| Golden records | 29,631 |
| Superseded IDs | 59,710 |
| Household links | 0 |

## Review Positioning

Use this wording in review:

The Media ID Graph keeps the same legacy ID Graph workflow, but replaces the old mixed blocking/scoring decision with a clearer CDP-style pairwise matching layer. It prepares matching fields, compares each identity feature independently, calculates confidence from configurable weights, classifies links into `exact`, `strong`, `medium`, and `weak` before clustering, and writes household links separately from person clusters.


