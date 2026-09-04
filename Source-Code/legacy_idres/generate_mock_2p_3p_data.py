"""
generate_mock_2p_3p_data.py
Generates realistic 2P and 3P enrichment data based on golden records.

Run from legacy_idres/:
    python generate_mock_2p_3p_data.py
"""
import csv
import hashlib
import random
import os
from pathlib import Path

random.seed(42)

ROOT = Path(__file__).resolve().parent
GOLDEN_CSV = ROOT / "golden_records.csv"
OUTPUT_DIR = ROOT / "generated_data" / "enrichment"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Load golden records ────────────────────────────────────────────────────
print("Loading golden records...")
records = []
with open(GOLDEN_CSV, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        records.append(row)

print(f"Loaded {len(records)} golden records")

# ── 2P Dataset 1: Fan Scores (Sports Analytics Partner) ──────────────────
# Join key: email — 60% match rate
# Source: "SportsIQ Partner Network"
print("\nGenerating 2P fan scores...")

fan_scores_rows = []
preferred_teams = ["Lakers", "Warriors", "Cowboys", "Patriots", "Yankees", "Cubs", "Chiefs", "Eagles"]
content_affinity = ["Live Sports", "Highlights", "Analysis", "Fantasy", "Behind the Scenes", "Interviews"]
engagement_tiers = ["High", "Medium", "Low"]

matched = 0
for rec in records:
    email = rec.get("email", "").strip()
    if not email or email == "[EXCLUDED]":
        continue
    # 60% match rate
    if random.random() > 0.60:
        continue
    matched += 1
    fan_scores_rows.append({
        "email":                    email,
        "fan_score":                round(random.uniform(20, 98), 1),
        "preferred_team":           random.choice(preferred_teams),
        "content_affinity":         random.choice(content_affinity),
        "venue_visits_12m":         random.randint(0, 24),
        "last_venue_visit":         f"2026-0{random.randint(1,4)}-{random.randint(1,28):02d}",
        "merchandise_spend_band":   random.choice(["$0", "$1-50", "$51-200", "$200+"]),
        "fantasy_participation":    random.choice(["Yes", "No", "No", "No"]),
        "partner_source":           "SportsIQ",
        "data_vintage":             "2026-Q1",
        "match_key":                "email",
        "data_party":               "2P"
    })

with open(OUTPUT_DIR / "2p_fan_scores.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fan_scores_rows[0].keys())
    writer.writeheader()
    writer.writerows(fan_scores_rows)
print(f"  2p_fan_scores.csv: {len(fan_scores_rows)} rows ({matched} matched from {len(records)})")

# ── 2P Dataset 2: Location/Geo Data (Location Partner) ───────────────────
# Join key: device_id — 50% match rate
# Source: "GeoSignal Location Network"
print("\nGenerating 2P location data...")

location_rows = []
dma_regions = ["New York DMA", "Los Angeles DMA", "Chicago DMA", "Dallas DMA",
               "Houston DMA", "Philadelphia DMA", "Miami DMA", "Atlanta DMA",
               "Boston DMA", "San Francisco DMA"]
venue_types  = ["Stadium", "Arena", "Sports Bar", "Team Store", "Practice Facility"]

device_seen = set()
for rec in records:
    device_id = rec.get("device_id", "").strip()
    if not device_id or device_id in device_seen:
        continue
    if random.random() > 0.50:
        continue
    device_seen.add(device_id)
    location_rows.append({
        "device_id":                device_id,
        "golden_id":                rec.get("golden_id", ""),
        "home_dma":                 random.choice(dma_regions),
        "home_zip":                 rec.get("zip", ""),
        "work_zip":                 f"{random.randint(10000,99999):05d}",
        "stadium_visits_12m":       random.randint(0, 20),
        "last_stadium_visit":       f"2026-0{random.randint(1,4)}-{random.randint(1,28):02d}",
        "travel_radius_miles":      random.choice([10, 25, 50, 100, 250]),
        "frequent_venue_type":      random.choice(venue_types),
        "avg_dwell_time_mins":      random.randint(45, 240),
        "weekend_sports_visitor":   random.choice(["Yes", "Yes", "No"]),
        "partner_source":           "GeoSignal",
        "data_vintage":             "2026-Q1",
        "match_key":                "device_id",
        "data_party":               "2P"
    })

with open(OUTPUT_DIR / "2p_location_data.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=location_rows[0].keys())
    writer.writeheader()
    writer.writerows(location_rows)
print(f"  2p_location_data.csv: {len(location_rows)} rows")

# ── 3P Dataset 1: Demographics (Experian-style vendor) ───────────────────
# Join key: zip + phone_prefix (first 3 digits) — 40% match rate
# Source: "DataBridge Demographics"
print("\nGenerating 3P demographics data...")

demo_rows = []
age_ranges      = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
income_bands    = ["<$30K", "$30-50K", "$50-75K", "$75-100K", "$100-150K", "$150K+"]
education_levels= ["High School", "Some College", "Bachelor's", "Graduate"]
home_ownership  = ["Owner", "Renter", "Unknown"]

seen_zip_phone = set()
for rec in records:
    zip_code = rec.get("zip", "").strip()[:5]
    phone    = rec.get("phone", "").strip().replace("-","")[:3]
    key      = f"{zip_code}_{phone}"
    if not zip_code or not phone or key in seen_zip_phone:
        continue
    if random.random() > 0.40:
        continue
    seen_zip_phone.add(key)
    demo_rows.append({
        "zip":                      zip_code,
        "phone_prefix":             phone,
        "golden_id_ref":            rec.get("golden_id", ""),
        "estimated_age_range":      random.choice(age_ranges),
        "estimated_income_band":    random.choice(income_bands),
        "household_size":           random.randint(1, 6),
        "education_level":          random.choice(education_levels),
        "homeowner_flag":           random.choice(home_ownership),
        "presence_of_children":     random.choice(["Yes", "No", "Unknown"]),
        "length_of_residence_yrs":  random.randint(0, 20),
        "political_affiliation":    "Not Available",
        "partner_source":           "DataBridge",
        "data_vintage":             "2025-Q4",
        "match_key":                "zip+phone_prefix",
        "data_party":               "3P"
    })

with open(OUTPUT_DIR / "3p_demographics.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=demo_rows[0].keys())
    writer.writeheader()
    writer.writerows(demo_rows)
print(f"  3p_demographics.csv: {len(demo_rows)} rows")

# ── 3P Dataset 2: LTV & Propensity (TransUnion-style vendor) ─────────────
# Join key: SHA256 hash of lowercase email — 35% match rate
# Source: "TrueSignal Analytics"
print("\nGenerating 3P LTV/propensity data...")

ltv_rows = []
segment_codes = ["HIGH_VALUE_SPORTS", "MID_VALUE_MEDIA", "LOW_VALUE_LAPSED",
                 "UPSELL_READY", "CHURN_RISK", "LOYAL_SUBSCRIBER", "NEW_ACQUIRABLE"]

for rec in records:
    email = rec.get("email", "").strip().lower()
    if not email or email == "[excluded]":
        continue
    if random.random() > 0.35:
        continue
    email_hash = hashlib.sha256(email.encode()).hexdigest()
    ltv_rows.append({
        "email_sha256":             email_hash,
        "golden_id_ref":            rec.get("golden_id", ""),
        "ltv_score":                round(random.uniform(10, 99), 1),
        "ltv_band":                 random.choice(["High", "Medium", "Low"]),
        "churn_propensity_score":   round(random.uniform(0, 1), 3),
        "upsell_propensity_score":  round(random.uniform(0, 1), 3),
        "acquisition_propensity":   round(random.uniform(0, 1), 3),
        "predicted_annual_value":   round(random.uniform(50, 2500), 2),
        "segment_code":             random.choice(segment_codes),
        "model_version":            "v2.4.1",
        "score_date":               "2026-04-01",
        "partner_source":           "TrueSignal",
        "data_vintage":             "2026-Q1",
        "match_key":                "email_sha256",
        "data_party":               "3P"
    })

with open(OUTPUT_DIR / "3p_ltv_propensity.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=ltv_rows[0].keys())
    writer.writeheader()
    writer.writerows(ltv_rows)
print(f"  3p_ltv_propensity.csv: {len(ltv_rows)} rows")

# ── Summary ───────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("ENRICHMENT DATA GENERATION COMPLETE")
print("="*60)
print(f"\nOutput directory: {OUTPUT_DIR}")
print(f"\nFiles generated:")
print(f"  2p_fan_scores.csv       — {len(fan_scores_rows)} rows  (join: email)")
print(f"  2p_location_data.csv    — {len(location_rows)} rows  (join: device_id)")
print(f"  3p_demographics.csv     — {len(demo_rows)} rows  (join: zip+phone_prefix)")
print(f"  3p_ltv_propensity.csv   — {len(ltv_rows)} rows  (join: email_sha256)")
print(f"\nData Party Summary:")
print(f"  1P: subscription_billing, streaming_activity, app_events,")
print(f"      customer_support, email_engagement")
print(f"  2P: 2p_fan_scores, 2p_location_data")
print(f"  3P: 3p_demographics, 3p_ltv_propensity")
print(f"\nUsage rules:")
print(f"  1P only  → Identity Resolution (blocking + clustering)")
print(f"  2P + 3P  → Enrichment only (LTV, affinity, demographics)")
