import importlib.util
import json
import re
from pathlib import Path
import pandas as pd
from flask import jsonify, request
import numpy as np


ROOT = Path(__file__).resolve().parent.parent
LEGACY_ROOT = ROOT / "legacy_idres"
PRESET_JOURNEYS_DIR = ROOT / "data" / "journeys"
CUSTOM_JOURNEYS_DIR = ROOT / "data" / "customJourneys"
CUSTOM_SEGMENTS_DIR = ROOT / "data" / "customSegments"


def load_legacy_app():
    import sys
    legacy_backend = str(Path(__file__).resolve().parent.parent / "legacy_idres" / "backend")
    if legacy_backend not in sys.path:
        sys.path.insert(0, legacy_backend)
    legacy_app_path = LEGACY_ROOT / "backend" / "app.py"
    spec = importlib.util.spec_from_file_location("legacy_idres_backend_app", legacy_app_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load legacy backend from {legacy_app_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


app = load_legacy_app()

app.json.sort_keys = False

def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def slugify(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")
    return cleaned or fallback


def read_json_files(directory: Path):
    if not directory.exists():
        return []

    records = []
    for path in sorted(directory.glob("*.json")):
        try:
            records.append(json.loads(path.read_text(encoding="utf-8")))
        except Exception as exc:
            print(f"[WARNING] Skipping invalid JSON file {path}: {exc}")
    return records


def write_json(path: Path, payload):
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


@app.get("/api/copilot/bootstrap")
def copilot_bootstrap():
    journeys = read_json_files(PRESET_JOURNEYS_DIR) + read_json_files(CUSTOM_JOURNEYS_DIR)
    custom_segments = read_json_files(CUSTOM_SEGMENTS_DIR)
    return jsonify(
        {
            "journeys": journeys,
            "customSegments": custom_segments,
            "defaultSegmentSourceUrl": "/api/segments",
        }
    )


@app.post("/api/copilot/journeys")
def save_copilot_journey():
    payload = request.get_json(silent=True) or {}
    journey = payload.get("journey")
    if not isinstance(journey, dict):
        return jsonify({"error": "journey payload is required"}), 400

    slug = slugify(str(journey.get("slug") or journey.get("name") or ""), "custom-journey")
    record = dict(journey)
    record["slug"] = slug

    output_path = CUSTOM_JOURNEYS_DIR / f"{slug}.json"
    write_json(output_path, record)

    return jsonify({"journey": record, "saved": True, "path": str(output_path.relative_to(ROOT))})


@app.post("/api/copilot/segments")
def save_copilot_segment():
    payload = request.get_json(silent=True) or {}
    segment = payload.get("segment")
    if not isinstance(segment, dict):
        return jsonify({"error": "segment payload is required"}), 400

    segment_id = slugify(str(segment.get("id") or segment.get("name") or ""), "custom-segment").replace("-", "_")
    record = dict(segment)
    record["id"] = segment_id

    output_path = CUSTOM_SEGMENTS_DIR / f"{segment_id}.json"
    write_json(output_path, record)

    return jsonify({"segment": record, "saved": True, "path": str(output_path.relative_to(ROOT))})


# Load General Data
CSV_PATH = ROOT / "data" / "general_data.csv"

# -------------------------------
# Load Measurement Data
# -------------------------------
df = pd.read_csv(CSV_PATH)

# -------------------------------
# Data Cleaning
# -------------------------------
df["event_ts"] = pd.to_datetime(df["event_ts"], errors="coerce")
df["event_name"] = df["event_name"].str.lower()
df["bounce_classification"] = df["bounce_classification"].str.lower()
print(df.columns)


# =========================================================
# 1 SUMMARY API (KPI CARDS)
# =========================================================
@app.route("/api/copilot/journey/measurement/generalsummary", methods=["GET"])
def get_measurement_summary():

    filtered_df = df.copy()

    Email_sent = (filtered_df["event_name"] == "email_sent").sum()
    Email_delivered = (filtered_df["event_name"] == "email_delivered").sum()
    Email_opened = (filtered_df["event_name"] == "email_opened").sum()
    Email_clicked = (filtered_df["event_name"] == "email_clicked").sum()
    Email_unsubscribed = (filtered_df["event_name"] == "email_unsubscribed").sum()
    revenue = filtered_df["revenue"].fillna(0).sum()
    Email_delivery_rate = ((filtered_df["event_name"] == "email_delivered").sum() / (filtered_df["event_name"] == "email_sent").sum())
    Email_open_rate = ((filtered_df["event_name"] == "email_opened").sum() / (filtered_df["event_name"] == "email_delivered").sum())
    Click_Percentage = ((filtered_df["event_name"] == "email_clicked").sum() / (filtered_df["event_name"] == "email_delivered").sum())
    Bounce_Rate = ((filtered_df["event_name"] == "email_bounced").sum()/(filtered_df["event_name"] == "email_sent").sum())
    Unsubscribed_rate = ((filtered_df["event_name"] == "email_unsubscribed").sum()/(filtered_df["event_name"] == "email_delivered").sum())

        # ---------- Date ranges ----------
    max_date = filtered_df["event_ts"].max()

    last_week_start = max_date - pd.Timedelta(days=7)
    prev_week_start = max_date - pd.Timedelta(days=14)

    last_week_df = filtered_df[
        (filtered_df["event_ts"] > last_week_start) &
        (filtered_df["event_ts"] <= max_date)
    ]

    prev_week_df = filtered_df[
        (filtered_df["event_ts"] > prev_week_start) &
        (filtered_df["event_ts"] <= last_week_start)
    ]

  
    # Helpers
    def safe_div(n, d):
        return n / d if d != 0 else 0

    def compute_kpis(df):
        sent = (df["event_name"] == "email_sent").sum()
        delivered = (df["event_name"] == "email_delivered").sum()
        bounced = (df["event_name"] == "email_bounced").sum()
        
        return {
            "Bounce_Rate": safe_div(bounced, sent),
            "Email_delivery_rate": safe_div(delivered, sent),
            "Email_open_rate": safe_div((df["event_name"] == "email_opened").sum(), delivered),
            "Click_Percentage": safe_div((df["event_name"] == "email_clicked").sum(), delivered),
            "Unsubscribed_rate": safe_div((df["event_name"] == "email_unsubscribed").sum(), delivered)
        }

    def percent_change(curr, prev):
        return ((curr - prev) / prev * 100) if prev != 0 else 0

    # Compute KPIs
    last_kpis = compute_kpis(last_week_df)
    prev_kpis = compute_kpis(prev_week_df)

    # % change
    kpi_changes = {
        k: percent_change(last_kpis[k], prev_kpis[k])
        for k in last_kpis
    }

    print(kpi_changes)


    return jsonify({
        "Email_sent": int(Email_sent),
        "Email_delivered": int(Email_delivered),
        "Email_delivery_rate":round(float(Email_delivery_rate),2),
        "Email_delivery_growth_percent": round(float(kpi_changes["Email_delivery_rate"]), 3),
        "Email_opened": int(Email_opened),
        "Email_open_rate":round(float(Email_open_rate),2),
        "Email_open_growth_percent": round(float(kpi_changes["Email_open_rate"]), 3),
        "Email_clicked": int(Email_clicked),
        "Email_Click_percentage":round(float(Click_Percentage),2),
        "Click_percentage_growth_percent": round(float(kpi_changes["Click_Percentage"]), 3),
        "Email_unsubscribed": int(Email_unsubscribed),
        "Emails_unsubscribed_rate" :round(float(Unsubscribed_rate),2),
        "Unsubscribed_growth_percent": round(float(kpi_changes["Unsubscribed_rate"]), 3),
        "revenue": round(float(revenue),2),
        "Email_Bounce_rate":round(float(Bounce_Rate),2),
        "Bounce_growth_percent": round(float(kpi_changes["Bounce_Rate"]), 2),
            
    })

# ========================================================
# 3 Deliver Funnel 
# ========================================================

@app.route("/api/copilot/journey/measurement/deliverfunnel", methods=["GET"])
def get_channel_metrics():

    filtered_df = df.copy()
    total = len(filtered_df)

    METRICS = {
        "sent":      ["sent"],
        "delivered": ["delivered"],
        "opened":    ["opened"],
        "clicked":   ["clicked"],
        "bounced":   ["bounced"],
    }

    result = {}
    for metric, keywords in METRICS.items():
        count = int(filtered_df["event_name"].apply(
            lambda x: any(kw in str(x).lower() for kw in keywords)
        ).sum())
        result[metric] = {
            "count":      count,
            "percentage": f"{round((count / total * 100), 2)}%" if total > 0 else "0%"
        }

    result["revenue"] = round(
        filtered_df["revenue"].fillna(0).sum(), 2
    ) if "revenue" in filtered_df.columns else 0

    return jsonify(result)



# ========================================================
# 3 CHANNEL MIX
# ========================================================
@app.route("/api/copilot/journey/measurement/channelmix", methods=["GET"])
def get_channel_mix():

    filtered_df = df.copy()

    total = len(filtered_df)

    CHANNEL_KEYWORDS = {
        "Email": ["email"],
        "SMS":   ["sms"],
        "Push Notifications":  ["push"],
    }

    result = {}
    for channel, keywords in CHANNEL_KEYWORDS.items():
        count = filtered_df["event_name"].apply(
            lambda x: any(kw in str(x).lower() for kw in keywords)
        ).sum()
        result[channel] = f"{round((count / total * 100), 2)}%" if total > 0 else "0%"

    return jsonify(result)

# =========================================================
# 2 Heatmap
# =========================================================

# Load HeatMap Data
Heatmap_CSV_PATH = ROOT / "data" / "Omnichannel.csv"

# -------------------------------
# Load Measurement Data
# -------------------------------
heatmap_df = pd.read_csv(Heatmap_CSV_PATH)


# Convert date column (optional but recommended)
heatmap_df["event_ts"] = pd.to_datetime(heatmap_df["event_ts"], format="%d-%m-%Y %H:%M", errors="coerce")

@app.route("/api/submission_rate", methods=["GET"])
def submission_rate():

    # 1. By Channel
    by_channel = heatmap_df.groupby("channel").agg(
        delivered=("event_name", lambda x: (x == "delivered").sum()),
        submitted=("event_name", lambda x: (x == "submission").sum())
    ).reset_index()

    by_channel["submission_rate"] = (
        (by_channel["submitted"] / by_channel["delivered"]) * 100
    ).replace([float("inf"), -float("inf")], 0).fillna(0).round(2)

# Add % sign
    by_channel["submission_rate"] = by_channel["submission_rate"].astype(str) + "%"

    # 2. By Country
    by_country = heatmap_df.groupby("country_code").agg(
        delivered=("event_name", lambda x: (x == "delivered").sum()),
        submitted=("event_name", lambda x: (x == "submission").sum())
    ).reset_index()

    by_country["submission_rate"] = (
        (by_country["submitted"] / by_country["delivered"]) * 100
    ).replace([float("inf"), -float("inf")], 0).fillna(0).round(2)

# Add % sign
    by_country["submission_rate"] = by_country["submission_rate"].astype(str) + "%"

    # By Device
    by_device = heatmap_df.groupby("device_platform", dropna=False).agg(
        delivered=("event_name", lambda x: (x == "delivered").sum()),
        submitted=("event_name", lambda x: (x == "submission").sum())
    ).reset_index()

    by_device["submission_rate"] = (
        (by_device["submitted"] / by_device["delivered"]) * 100
    ).replace([float("inf"), -float("inf")], 0).fillna(0).round(2)

# Add % sign
    by_device["submission_rate"] = by_device["submission_rate"].astype(str) + "%"

    return jsonify({
        "by_channel": by_channel.to_dict(orient="records"),
        "by_country": by_country.to_dict(orient="records"),
        "by_device": by_device.to_dict(orient="records")
    })

# =========================================================
# 2 CAMPAIGN BREAKDOWN
# =========================================================
@app.route("/api/copilot/journey/measurement/generalcampaign", methods=["GET"])
def get_measurement_campaign_kpis():

    filtered_df = df.copy()

    result = filtered_df.groupby(["campaign_id", "campaign_name"]).agg(
        sent=("event_name", lambda x: (x == "email_sent").sum()),
        delivered=("event_name", lambda x: (x == "email_delivered").sum()),
        opened=("event_name", lambda x: (x == "email_opened").sum()),
        clicked=("event_name", lambda x: (x == "email_clicked").sum()),
        unsubscribed=("event_name", lambda x: (x == "email_unsubscribed").sum()),
        bounced=("event_name", lambda x: (x == "email_bounced").sum()),
        hard_bounce=("bounce_classification", lambda x: (x == "hard").sum()),
        soft_bounce=("bounce_classification", lambda x: (x == "soft").sum()),
        revenue=("revenue", lambda x: x.fillna(0).sum()),
        status=("status", lambda x: "Live" if x.max() else "Ended")
    ).reset_index()

    # Rates
    result["Email_delivery_rate"] = round(result["delivered"] / result["sent"],2)
    result["Email_open_rate"] = round(result["opened"] / result["delivered"],2)
    result["Email_click_rate"] = round(result["clicked"] / result["delivered"],2)
    #result["Click to open rate"] = round(result["clicked"] / result["opened"],2)
    #result["Open rate"]= round(result["opened"] / result["delivered"],2)
    result["Email_unsubscribed_rate"]= round(result["unsubscribed"] / result["delivered"],2)

    # Rename columns to required format
    result = result.rename(columns={
        "campaign_id": "Campaign id",
        "campaign_name":"Campaign Name",
        "sent": "Email sent",
        "delivered": "Email delivered",
        "opened": "Email opened",
        "clicked": "Email clicked",
        "unsubscribed": "Email unsubscribed",
        "bounced": "Email bounced",
        "hard_bounce": "Email hard bounce",
        "soft_bounce": "Email soft bounce",
        "status":"status"
    })

    result = result.fillna(0)

    return jsonify({
        "total_campaigns": len(result),
        "data": result.to_dict(orient="records")
    })



# =========================================================
# 2.1 CAMPAIGN API
# =========================================================

from flask import jsonify
import pandas as pd

@app.route("/api/copilot/journey/measurement/generalcampaign/<campaign_id>", methods=["GET"])
def get_campaign_kpis_by_name(campaign_id):
    try:
        # Case-insensitive filtering
        filtered_df = df[df["campaign_id"].str.lower() == campaign_id.lower()].copy()

        if filtered_df.empty:
            return jsonify({"error": f"Campaign '{campaign_id}' not found"}), 404

        # KPI aggregation
        result = filtered_df.groupby(["campaign_id", "campaign_name"]).agg(
            sent=("event_name", lambda x: (x == "email_sent").sum()),
            delivered=("event_name", lambda x: (x == "email_delivered").sum()),
            opened=("event_name", lambda x: (x == "email_opened").sum()),
            clicked=("event_name", lambda x: (x == "email_clicked").sum()),
            unsubscribed=("event_name", lambda x: (x == "email_unsubscribed").sum()),
            bounced=("event_name", lambda x: (x == "email_bounced").sum()),
            hard_bounce=("bounce_classification", lambda x: (x == "hard").sum()),
            soft_bounce=("bounce_classification", lambda x: (x == "soft").sum()),
            revenue=("revenue", lambda x: round(x.fillna(0).sum(), 2)),
            status=("status", lambda x: "Live" if x.max() else "Ended")
        ).reset_index()

        # Fix numpy types (VERY IMPORTANT)
        int_cols = [
            "sent", "delivered", "opened", "clicked",
            "unsubscribed", "bounced", "hard_bounce", "soft_bounce"
        ]

        for col in int_cols:
            result[col] = result[col].astype(int)
        # Rates
        result["Email_delivery_rate"] = round(result["delivered"] / result["sent"],2)
        result["Email_open_rate"] = round(result["opened"] / result["delivered"],2)
        result["Email_click_rate"] = round(result["clicked"] / result["delivered"],2)
        result["Email_bounce_rate"] = round(result["bounced"] / result["sent"],2)
        #result["Open rate"]= round(result["opened"] / result["delivered"],2)
        result["Email_unsubscribed_rate"]= round(result["unsubscribed"] / result["delivered"],2)


        result["revenue"] = result["revenue"].astype(float).round(2)
        # Rename columns to required format
        result = result.rename(columns={
            "campaign_id": "Campaign_id",
            "campaign_name":"Campaign name",
            "sent": "Email sent",
            "delivered": "Email delivered",
            "opened": "Email opened",
            "clicked": "Email clicked",
            "unsubscribed": "Email unsubscribed",
            "bounced": "Email bounced",
            "hard_bounce": "Email hard bounce",
            "soft_bounce": "Email soft bounce",

        })

        # Return JSON
        return jsonify(result.to_dict(orient="records")[0])

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# =========================================================
# 3 TREND API (LINE CHART)
# =========================================================
@app.route("/api/copilot/journey/measurement/generaltrend", methods=["GET"])
def get_measurement_trend():

    filtered_df = df.copy()
    
    trend = filtered_df.groupby(filtered_df["event_ts"].dt.date).agg(
        sent=("event_name", lambda x: (x == "email_sent").sum()),
        delivered=("event_name", lambda x: (x == "email_delivered").sum()),
        opened=("event_name", lambda x: (x == "email_opened").sum()),
        clicked=("event_name", lambda x: (x == "email_clicked").sum()),
        revenue=("revenue", lambda x: round(x.fillna(0).sum(), 2))
    ).reset_index()

    trend = trend.rename(columns={
        "sent": "Email sent",
        "delivered": "Email delivered",
        "opened": "Email opened",
        "clicked": "Email clicked",
        "event_ts": "Email sent date"
    })



    trend = trend.fillna(0)

    return jsonify(trend.to_dict(orient="records"))
# =========================================================
# 3.1 Campaign Level General Trend
# =========================================================

@app.route("/api/copilot/journey/measurement/generaltrend/<campaign_id>", methods=["GET"])
def get_measurement_trend_by_campaign(campaign_id):

    filtered_df = df.copy()
    # Case-insensitive filtering
    filtered_df = filtered_df[filtered_df["campaign_id"].str.lower() == campaign_id.lower()].copy()

    if filtered_df.empty:
        return jsonify({"error": f"Campaign '{campaign_id}' not found"}), 404
    
    trend = filtered_df.groupby(
        [filtered_df["event_ts"].dt.date,"campaign_id","campaign_name"]).agg(
        sent=("event_name", lambda x: (x == "email_sent").sum()),
        delivered=("event_name", lambda x: (x == "email_delivered").sum()),
        opened=("event_name", lambda x: (x == "email_opened").sum()),
        clicked=("event_name", lambda x: (x == "email_clicked").sum()),
        revenue=("revenue", lambda x: round(x.fillna(0).sum(), 2))
    ).reset_index()

    trend = trend.rename(columns={
        "campaign_name":"Campaign Name",
        "sent": "Email sent",
        "delivered": "Email delivered",
        "opened": "Email opened",
        "clicked": "Email clicked",
        "event_ts": "Email sent date"
    })



    trend = trend.fillna(0)

    return jsonify(trend.to_dict(orient="records"))

# =========================================================
# 4 DISTRIBUTION API (PIE CHART)
# =========================================================
@app.route("/api/copilot/journey/measurement/generaldistribution", methods=["GET"])
def get_measurement_distribution():

    filtered_df = df.copy()

    Email_clicked = (filtered_df["event_name"] == "email_clicked").sum()
    Email_opened = (filtered_df["event_name"] == "email_opened").sum()
    Email_unsubscribed = (filtered_df["event_name"] == "email_unsubscribed").sum()
    Email_bounced = (filtered_df["event_name"] == "email_bounced").sum()

    return jsonify([
        {"metric": "Email clicked", "value": int(Email_clicked)},
        {"metric": "Email opened", "value": int(Email_opened)},
        {"metric": "Email unsubscribed", "value": int(Email_unsubscribed)},
        {"metric": "Email bounced", "value": int(Email_bounced)}
    ])

# =========================================================
# 4.1 DISTRIBUTION API BY CAMPAIGN (PIE CHART)
# =========================================================
@app.route("/api/copilot/journey/measurement/generaldistribution/<campaign_id>", methods=["GET"])
def get_measurement_distribution_by_campaign(campaign_id):

    filtered_df = df.copy()

    # Case-insensitive filtering
    filtered_df = filtered_df[filtered_df["campaign_id"].str.lower() == campaign_id.lower()].copy()
    if filtered_df.empty:
        return jsonify({"error": f"Campaign '{campaign_id}' not found"}), 404

    trend = filtered_df.groupby(
        ["campaign_id", "campaign_name"]
    ).agg(
        sent=("event_name", lambda x: (x == "email_sent").sum()),
        delivered=("event_name", lambda x: (x == "email_delivered").sum()),
        opened=("event_name", lambda x: (x == "email_opened").sum()),
        clicked=("event_name", lambda x: (x == "email_clicked").sum()),
        unsubscribed=("is_unsubscribed", "sum"),
        bounced=("is_bounced", "sum"),
        revenue=("revenue", lambda x: round(x.fillna(0).sum(), 2))
    ).reset_index()

    trend["Open Rate"] = (
        trend["opened"] / trend["delivered"]
    ).fillna(0)

    trend["CTR"] = (
        trend["clicked"] / trend["delivered"]
    ).fillna(0)

    trend["Unsubscribe Rate"] = (
        trend["unsubscribed"] / trend["delivered"]
    ).fillna(0)

    trend["Open Rate"] = trend["Open Rate"].apply(
        lambda x: f"{x:.2%}"
    )

    trend["CTR"] = trend["CTR"].apply(
        lambda x: f"{x:.2%}"
    )

    trend["Unsubscribe Rate"] = trend["Unsubscribe Rate"].apply(
        lambda x: f"{x:.2%}"
    )

    trend = trend.rename(columns={
        "campaign_id": "Campaign ID",
        "campaign_name": "Campaign Name",
        "sent": "Emails Sent",
        "delivered": "Emails Delivered",
        "opened": "Emails Opened",
        "clicked": "Emails Clicked",
        "unsubscribed": "Unsubscribed",
        "bounced": "Bounced",
        "revenue": "Revenue"
    })

    return jsonify(
        trend.to_dict(orient="records")
    )

# Load UTM Data
UTM_CSV_PATH = ROOT / "data" / "UTM_data.csv"

# -------------------------------
# Load Measurement Data
# -------------------------------
utm_df = pd.read_csv(UTM_CSV_PATH)

# ------------------------------
conversion_events = ["trial_started", "purchase_completed", "signup_completed"]

utm_df["is_conversion"] = utm_df["event_name"].isin(conversion_events).astype(int)
utm_df["conversion_revenue"] = utm_df["revenue"].fillna(0) * utm_df["is_conversion"]

# -------------------------------
# CAMPAIGN KPI API
# -------------------------------
@app.route("/api/copilot/journey/measurement/utmcampaign", methods=["GET"])
def campaign_kpi():

    kpi = utm_df.groupby("campaign_id").agg({
        "event_name": lambda x: (x == "email_sent").sum(),
        "is_delivered": "sum",
        "is_opened": "sum",
        "is_clicked": "sum",
        "is_landing_page_visitor": "sum",
        "is_conversion": "sum",
        "conversion_revenue": "sum",
        "is_bounced": "sum",
        "is_unsubscribed": "sum"
    }).reset_index()

    kpi.columns = [
        "campaign_id", "Email Sent", "Email delivered", "Email opened", "Email clicked",
        "Landing Visitors", "Email conversions", "Revenue",
        "Email Bounced", "Email unsubscribed"
    ]

    # Round revenue
    kpi["Revenue"] = kpi["Revenue"].round(2)

    # Rates
    kpi["Email Delivery Rate"] = (kpi["Email delivered"] / kpi["Email Sent"]).fillna(0).round(2)
    kpi["Open Rate"] = (kpi["Email opened"] / kpi["Email delivered"]).fillna(0).round(2)
    kpi["Clicked through Rate"] = (kpi["Email clicked"] / kpi["Email delivered"]).fillna(0).round(2)
    kpi["Email Conversion Rate"] = (kpi["Email conversions"] / kpi["Email Sent"]).fillna(0).round(2)
    kpi["Email Bounce Rate"] = (kpi["Email Bounced"] / kpi["Email Sent"]).fillna(0).round(2)
    kpi["Email Unsubscribe Rate"] = (kpi["Email unsubscribed"] / kpi["Email delivered"]).fillna(0).round(2)

    return jsonify(kpi.to_dict(orient="records"))

# ---------------------------------------------------------
# CAMPAIGN_ID KPI API (FILTERED BY CAMPAIGN)
# ---------------------------------------------------------
@app.route("/api/copilot/journey/measurement/utmcampaign/<campaign_id>", methods=["GET"])
def campaign_kpi_by_id(campaign_id):

    # -------------------------------
    # FILTER DATA FOR GIVEN CAMPAIGN
    # -------------------------------
    df_filtered = utm_df[utm_df["campaign_id"] == campaign_id]

    # Handle invalid campaign_id
    if df_filtered.empty:
        return jsonify({
            "error": f"No data found for campaign_id: {campaign_id}"
        }), 404

    # -------------------------------
    # KPI CALCULATION
    # -------------------------------
    utm_kpi = df_filtered.agg({
        "event_name": lambda x: (x == "email_sent").sum(),
        "is_delivered": "sum",
        "is_opened": "sum",
        "is_clicked": "sum",
        "is_landing_page_visitor": "sum",
        "is_conversion": "sum",
        "conversion_revenue": "sum",
        "is_bounced": "sum",
        "is_unsubscribed": "sum"
    })

    utm_kpi = utm_kpi.to_frame(name="value").T

    utm_kpi.columns = [
        "Sent", "Delivered", "Opened", "Clicked",
        "Landing Visitors", "Conversions", "Revenue",
        "Bounced", "Unsubscribed"
    ]

    utm_kpi.insert(0, "campaign_id", campaign_id)

    # Round revenue
    utm_kpi["Revenue"] = utm_kpi["Revenue"].round(2)

    # -------------------------------
    # RATE CALCULATIONS
    # -------------------------------
    utm_kpi["Delivery Rate"] = (utm_kpi["Delivered"] / utm_kpi["Sent"]).fillna(0)
    utm_kpi["Open Rate"] = (utm_kpi["Opened"] / utm_kpi["Delivered"]).fillna(0)
    utm_kpi["CTR"] = (utm_kpi["Clicked"] / utm_kpi["Delivered"]).fillna(0)
    utm_kpi["Conversion Rate"] = (utm_kpi["Conversions"] / utm_kpi["Sent"]).fillna(0)
    utm_kpi["Bounce Rate"] = (utm_kpi["Bounced"] / utm_kpi["Sent"]).fillna(0)
    utm_kpi["Unsubscribe Rate"] = (utm_kpi["Unsubscribed"] / utm_kpi["Delivered"]).fillna(0)

    return jsonify(kpi.to_dict(orient="records")[0])

# -------------------------------
# TREND KPI API
# -------------------------------
@app.route("/api/copilot/journey/measurement/utmtrend", methods=["GET"])
def trend_kpi():

    utm_df["event_date"] = pd.to_datetime(utm_df["event_ts"]).dt.date

    utm_trend = utm_df.groupby(["event_date"]).agg({
        "is_delivered": "sum",
        "is_opened": "sum",
        "is_clicked": "sum",
        "is_conversion": "sum",
        "conversion_revenue": "sum"
    }).reset_index()

    utm_trend["Revenue"] = utm_trend["conversion_revenue"].round(2)
    utm_trend.drop(columns=["conversion_revenue"], inplace=True)
    column_map = {
    "is_delivered": "Email Delivered",
    "is_opened": "Email Opened",
    "is_clicked": "Email Clicked",
    "is_conversion": "Email Conversions",
    "conversion_revenue": "Email Revenue"
    }

    utm_trend = utm_trend.rename(columns=column_map)

    return jsonify(utm_trend.to_dict(orient="records"))


# -------------------------------
# FUNNEL API
# -------------------------------
@app.route("/api/copilot/journey/measurement/utmsummary", methods=["GET"])
def funnel_kpi():

    funnel = {
        "Email Sent": int(utm_df["event_name"].eq("email_sent").sum()),
        "Email Delivered": int(utm_df["is_delivered"].sum()),
        "Email Opened": int(utm_df["is_opened"].sum()),
        "Email Clicked": int(utm_df["is_clicked"].sum()),  #   FIXED
        "Email Landing Visitors": int(utm_df["is_landing_page_visitor"].sum()),
        "Email Conversions": int(utm_df["is_conversion"].sum())
    }

    return jsonify(funnel)



# Load UTM Data
FORM_CSV_PATH = ROOT / "data" / "Form_data.csv"
# -------------------------------
# Load Form Data
# -------------------------------
form_df = pd.read_csv(FORM_CSV_PATH)

# -------------------------------
# ---------------------------------------------------------
# FORM KPI API (ALL FORMS)
# ---------------------------------------------------------
@app.route("/api/copilot/journey/measurement/form", methods=["GET"])
def form_kpi():


    temp_df = form_df.copy()

    # -----------------------------
    # EVENT FLAGS
    # -----------------------------
    temp_df["is_form_viewed"] = temp_df["event_name"].eq("form_viewed").astype(int)
    temp_df["is_form_started"] = temp_df["event_name"].eq("form_started").astype(int)

    temp_df["is_form_submitted"] = (
        (temp_df["event_name"] == "form_submitted") |
        (temp_df["form_submission_status"].astype(str).str.lower() == "submitted")
    ).astype(int)

    temp_df["is_high_quality_submission"] = (
        (temp_df["is_form_submitted"] == 1) &
        (temp_df["form_required_fields_count"] > 0) &
        (temp_df["form_question_count"] >= temp_df["form_required_fields_count"])
    ).astype(int)

    temp_df["form_complexity_score"] = (
        (temp_df["form_question_count"] * 0.4) +
        (temp_df["form_required_fields_count"] * 0.6)
    )

    # -----------------------------
    # GROUPBY KPI
    # -----------------------------

    temp_df["is_landing_page_viewed"] = (
    temp_df["event_name"] == "landing_page_viewed"
    ).astype(int)
    form_kpi = temp_df.groupby(
        ["campaign_id", "form_id", "form_name"]
    ).agg({
        "is_landing_page_viewed": "sum",
        "is_form_viewed": "sum",
        "is_form_started": "sum",
        "is_form_submitted": "sum",
        "is_high_quality_submission": "sum",
        "form_completion_time": "sum",
        "form_question_count": "mean",
        "form_required_fields_count": "mean",
        "form_complexity_score": "mean"
    }).reset_index()

    form_kpi.columns = [
        "campaign_id", "form_id", "form_name",
        "Landing Page Visitors", "Form Viewed", "Form Started",
        "Form Submitted", "High Quality Submissions",
        "Total Completion Time", "Avg Question Count",
        "Avg Required Fields", "Form Complexity Score"
    ]

    # -----------------------------
    # KPI CALCULATIONS
    # -----------------------------
    form_kpi["Form View Rate"] = (
        form_kpi["Form Viewed"] / form_kpi["Landing Page Visitors"]
    ).replace([float("inf"), -float("inf")], 0).fillna(0)

    form_kpi["Form Start Rate"] = (
        form_kpi["Form Started"] / form_kpi["Form Viewed"]
    ).fillna(0)

    form_kpi["Form Completion Rate"] = (
        form_kpi["Form Submitted"] / form_kpi["Form Started"]
    ).replace([float("inf"), -float("inf")], 0).fillna(0)

    form_kpi["Form Conversion Rate"] = (
        form_kpi["Form Submitted"] / form_kpi["Landing Page Visitors"]
    ).fillna(0)

    form_kpi["Form Drop-off Rate"] = (
        1 - (form_kpi["Form Submitted"] / form_kpi["Form Started"])
    ).replace([np.inf, -np.inf], 0).fillna(0)

    form_kpi["Avg Completion Time"] = (
        form_kpi["Total Completion Time"] / form_kpi["Form Submitted"]
    ).replace([np.inf, -np.inf], 0).fillna(0)

    form_kpi["Lead Quality Rate"] = (
        form_kpi["High Quality Submissions"] / form_kpi["Form Submitted"]
    ).replace([np.inf, -np.inf], 0).fillna(0)

    # Format %
    pct_cols = [
        "Form View Rate", "Form Start Rate", "Form Completion Rate",
        "Form Conversion Rate", "Form Drop-off Rate", "Lead Quality Rate"
    ]

    # -----------------------------
    # ROUND ALL FLOAT COLUMNS (2 DECIMAL)
    # -----------------------------
    float_cols = form_kpi.select_dtypes(include=["float64", "float32"]).columns
    form_kpi[float_cols] = form_kpi[float_cols].round(2)

    for col in pct_cols:
        form_kpi[col] = form_kpi[col].apply(lambda x: f"{x:.2%}")

    return jsonify(form_kpi.to_dict(orient="records"))

if __name__ == "__main__":
    print(f"Unified EXL CDP backend starting... ROOT={ROOT}")
    app.run(debug=True, port=5001, use_reloader=False)
