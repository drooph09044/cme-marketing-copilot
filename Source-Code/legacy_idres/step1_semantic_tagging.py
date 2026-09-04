"""
Step 1 — Semantic Tagging
Column-level mapping using SentenceTransformers all-MiniLM-L6-v2.
Maps each source CSV's columns to canonical tags via embedding similarity.

Supports MULTIPLE source systems (e.g., media, sports, automotive).
Uses exact manual overrides for known files, with embedding fallback for unknown columns.

Output: tag_mappings.json
"""

import csv
import json
import os
from services.pipeline_base import PipelineStepContext
from services.semantic_tagging_service import SemanticTaggingService
import pipeline_uc_bootstrap  # noqa: F401

from legacy_pipeline_config import default_source_systems, pipeline_directory, source_file_map

def _csv_name(value):
    text = str(value)
    return text if text.lower().endswith(".csv") else f"{text}.csv"

def _configured_source_file_map(stage):
    return {
        source: {
            _csv_name(name): [_csv_name(alias) for alias in aliases]
            for name, aliases in files.items()
        }
        for source, files in source_file_map(stage).items()
    }

INPUT_DIR = pipeline_directory("generated_data", "generated_data")
DEFAULT_SOURCE_SYSTEMS = default_source_systems()
SOURCE_SYSTEM_FILES = _configured_source_file_map("semantic")


OUTPUT_FILE = "tag_mappings.json"
CACHE_FILE = "tag_mappings_cache.json"


def write_json_file(filepath, payload):
    with open(filepath, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def build_semantic_tagging_service():
    return SemanticTaggingService(
        context=PipelineStepContext(
            source_systems=list(SOURCE_SYSTEM_FILES.keys()),
            default_source_systems=DEFAULT_SOURCE_SYSTEMS,
        ),
        input_dir=INPUT_DIR,
        abort_if_uc_runtime=pipeline_uc_bootstrap.abort_if_uc_runtime,
        get_selected_source_systems=get_selected_source_systems,
        get_source_files=get_source_files,
        load_existing_mappings_if_valid=load_existing_mappings_if_valid,
        ensure_ml=_ensure_ml,
        sentence_transformer_factory=lambda model_name: SentenceTransformer(model_name),
        source_system_files=SOURCE_SYSTEM_FILES,
        resolve_input_filepath=resolve_input_filepath,
        load_columns=load_columns,
        is_missing_input_error=lambda _exc: False,
        compute_tag_mapping=compute_tag_mapping,
        manual_overrides=MANUAL_OVERRIDES,
        automotive_common_overrides=AUTOMOTIVE_COMMON_OVERRIDES,
        output_file=OUTPUT_FILE,
        cache_file=CACHE_FILE,
        write_json=write_json_file,
        # Databricks Apps does not need a transformer model to tag governed,
        # known schemas.  Manual mappings are deterministic and any new column
        # can safely retain its original name until it is explicitly governed.
        ml_required=False,
        skip_missing_inputs=False,
    )

# Optional: choose which source systems to process
# Example:
#   SOURCE_SYSTEMS=media python semantic_tagging.py
#   SOURCE_SYSTEMS=sports python semantic_tagging.py
#   SOURCE_SYSTEMS=automotive python semantic_tagging.py
#   SOURCE_SYSTEMS=media,sports,automotive python semantic_tagging.py

# Similarity threshold for accepting an embedding-based tag match
SIMILARITY_THRESHOLD = 0.30

# Defer heavy ML imports — only load if we actually need to compute embeddings.
_ML_AVAILABLE = None  # None = not yet checked


def _ensure_ml():
    global _ML_AVAILABLE, np, SentenceTransformer
    if _ML_AVAILABLE is not None:
        return _ML_AVAILABLE
    try:
        import numpy as np
        from sentence_transformers import SentenceTransformer
        _ML_AVAILABLE = True
    except ImportError:
        _ML_AVAILABLE = False
    return _ML_AVAILABLE


# ---------------------------------------------------------------------
# SOURCE-SYSTEM CONFIGURATION
# ---------------------------------------------------------------------
# canonical output key -> possible physical filenames in generated_data/



def get_selected_source_systems():
    raw = os.getenv("SOURCE_SYSTEMS", ",".join(DEFAULT_SOURCE_SYSTEMS))
    selected = [s.strip().lower() for s in raw.split(",") if s.strip()]
    invalid = [s for s in selected if s not in SOURCE_SYSTEM_FILES]
    if invalid:
        print(f"[WARN] Ignoring unknown source systems: {invalid}")
        selected = [s for s in selected if s in SOURCE_SYSTEM_FILES]
    if not selected:
        selected = DEFAULT_SOURCE_SYSTEMS
    return selected


def get_source_files(selected_source_systems):
    """Return canonical source file keys expected in the output mapping."""
    files = []
    for system in selected_source_systems:
        files.extend(SOURCE_SYSTEM_FILES.get(system, {}).keys())
    return files


def resolve_input_filepath(canonical_source_file):
    """
    Find the actual physical file in INPUT_DIR for a canonical source file key.
    Example:
      canonical 'subscription_billing.csv' may exist physically as either:
        - subscription_billing.csv
        - med_subscription_billing.csv
    Returns full filepath if found, else None.
    """
    for source_system, file_map in SOURCE_SYSTEM_FILES.items():
        aliases = file_map.get(canonical_source_file, [])
        for candidate_name in aliases:
            for candidate_path in (
                os.path.join(INPUT_DIR, source_system, candidate_name),
                os.path.join(INPUT_DIR, candidate_name),
            ):
                if os.path.exists(candidate_path):
                    return candidate_path
    return None


# ---------------------------------------------------------------------
# CANONICAL TAGS
# ---------------------------------------------------------------------

BASE_CANONICAL_TAGS = {
    # Common person/contact/profile fields
    "first_name": "person first name given name",
    "last_name": "person last name surname family name",
    "full_name": "person full name complete name",
    "email": "email address electronic mail",
    "phone": "phone number telephone contact number",
    "address": "street address mailing address residence",
    "city": "city town municipality",
    "state": "state province region",
    "zip": "zip code postal code",
    "dob": "date of birth birthday birth date",

    # Account / subscription / identity
    "subscription_tier": "subscription tier plan level membership",
    "signup_date": "signup date registration date account creation",
    "account_status": "account status active suspended cancelled",
    "record_id": "record identifier unique ID row key",
    "customer_id": "customer identifier customer profile ID",
    "account_id": "account identifier customer account ID",
    "loyalty_id": "loyalty account identifier rewards account ID",
    "household_id": "household identifier family household ID",
    "golden_record_id": "golden record identifier unified customer ID",
    "username": "username login handle account name",
    "oauth_user_id": "oauth user identifier external identity provider user ID",
    "email_verified": "email verified flag verified email status",
    "phone_verified": "phone verified flag verified phone status",

    # Device / app / session
    "device_id": "device identifier device ID hardware ID",
    "device_type": "device type platform device category",
    "device_model": "device model hardware model phone model",
    "device_platform": "device platform operating system mobile platform",
    "session_start": "session start time timestamp login time",
    "session_end": "session end time timestamp logout time",
    "session_duration": "session duration watch time viewing length",
    "content_type": "content type media type video category",
    "team": "team sports team favorite team",
    "ip_address": "IP address network address internet protocol",
    "user_agent": "user agent browser agent client info",
    "is_live": "is live stream live broadcast real-time",
    "event_type": "event type action type activity",
    "event_timestamp": "event timestamp event time event date",
    "app_version": "app version application version software version",
    "os_version": "operating system version OS version",
    "push_token": "push notification token push ID",
    "advertising_id": "advertising ID ad tracker IDFA GAID",
    "venue_id": "venue identifier stadium arena venue ID",

    # Support / service / marketing / orders
    "ticket_number": "ticket number case number support ID",
    "category": "category issue type problem category",
    "priority": "priority urgency severity level",
    "status": "status state current status",
    "created_date": "created date open date ticket date created timestamp",
    "updated_date": "updated date modified date last updated timestamp",
    "resolved_date": "resolved date close date resolution date",
    "satisfaction_score": "satisfaction score CSAT rating feedback",
    "campaign_name": "campaign name marketing campaign promo name",
    "send_date": "send date email date dispatch date",
    "opened": "opened email opened read status",
    "open_date": "open date read date opened timestamp",
    "clicked": "clicked link clicked click status",
    "click_date": "click date clicked timestamp click time",
    "click_url": "click URL link destination",
    "unsubscribed": "unsubscribed opt out email preference",
    "unsubscribe_date": "unsubscribe date opt-out timestamp unsubscribe time",
    "email_client": "email client mail app reader",
    "email_bounce_type": "email bounce type delivery failure classification",

    # Commerce / billing / shipping
    "order_number": "order number purchase ID order ID",
    "item": "item product merchandise goods",
    "item_price": "item price cost amount",
    "quantity": "quantity count number of items",
    "order_date": "order date purchase date buy date",
    "order_status": "order status delivery status shipping status",
    "is_guest": "guest checkout anonymous purchase no account",
    "payment_method": "payment method credit card payment type",
    "billing_amount": "billing amount charge monthly payment",
    "billing_date": "billing date invoice date payment date",
    "shipping_address": "shipping address delivery address",
    "shipping_city": "shipping city delivery city",
    "shipping_state": "shipping state delivery state",
    "shipping_zip": "shipping zip delivery postal code",
}

SPORTS_CANONICAL_TAGS = {
    # Core account / domain-specific IDs
    "fan_account_id": "fan account identifier supporter profile ID",
    "ticketing_account_id": "ticketing account identifier box office account ID",
    "ticket_account_id": "ticket account identifier box office account key",
    "loyalty_member_id": "loyalty membership identifier rewards member ID",
    "commerce_customer_id": "commerce customer identifier merchandise customer ID",
    "streaming_account_id": "streaming subscription identifier OTT account ID",
    "fantasy_account_id": "fantasy gaming account identifier gaming profile ID",
    "ticket_order_id": "ticket order identifier ticket transaction ID",
    "commerce_order_id": "commerce order identifier e-commerce purchase ID",
    "campaign_event_id": "campaign event identifier marketing touch event ID",
    "campaign_id": "campaign identifier marketing campaign ID",
    "digital_session_id": "digital session identifier app or web session ID",
    "streaming_session_id": "streaming session identifier OTT watch session ID",
    "authenticated_user_id": "authenticated user identifier signed-in user ID",
    "linked_fan_account_id": "linked fan account identifier related fan profile ID",
    "linked_ticketing_account_id": "linked ticketing account identifier related ticketing account ID",
    "resolved_profile_id": "resolved profile identifier unified fan or customer ID",
    "original_purchaser_account_id": "original purchaser account identifier original buyer account ID",

    # Profile / fan attributes
    "address_line2": "address line 2 apartment suite secondary address line",
    "gender_code": "gender code declared gender classification",
    "fan_since_year": "fan since year supporter since year first fandom year",
    "sport_list": "sports list favorite sports followed sports",
    "primary_team_id": "primary team identifier favorite team ID",
    "secondary_team_id": "secondary team identifier second favorite team ID",
    "favorite_team_code": "favorite team code preferred team code",
    "primary_team_code": "primary team code main supported team code",
    "primary_team_affinity": "primary team affinity top team preference",
    "player_affinity_id": "player affinity identifier favorite player ID",
    "state_of_residence": "state of residence home state region",
    "registration_source": "registration source signup source acquisition channel",
    "oauth_provider_code": "oauth provider code identity provider type",
    "last_login_at": "last login timestamp most recent sign-in time",

    # Consent / contactability
    "is_opt_in_email": "email consent marketing email opt-in flag",
    "is_opt_in_push": "push consent push notification opt-in flag",
    "is_opt_in_sms": "SMS consent text message opt-in flag",
    "consent_status_code": "consent status code privacy preference status",
    "recipient_id_type": "recipient identifier type addressable identity type",
    "source_system_code": "source system code originating platform identifier",

    # Marketing / campaign interactions
    "ab_test_variant": "A/B test variant experimentation cohort treatment group",
    "campaign_objective": "campaign objective marketing goal purpose",
    "channel_code": "channel code marketing channel communication channel",
    "attribution_window_days": "attribution window days campaign attribution lookback period",
    "delivery_status_code": "delivery status code message delivery result",
    "personalization_tier": "personalization tier audience personalization level",
    "is_send_time_optimized": "send time optimized flag optimized message delivery timing",
    "conversion_event_type": "conversion event type attributed conversion category",
    "conversion_amount": "conversion amount attributed revenue conversion value",
    "converted_at": "conversion timestamp converted date time",

    # Digital engagement / app behavior
    "content_item_count": "content item count number of items viewed",
    "device_os_code": "device operating system code OS platform code",
    "event_id_context": "event context identifier contextual game or event ID",
    "referral_campaign_id": "referral campaign identifier source campaign ID",
    "screen_path_sequence": "screen path sequence navigation path page flow",
    "session_context_code": "session context code session context category",
    "platform_code": "platform code app or channel platform code",
    "platform_name": "platform name application platform name",
    "is_live_game_feature_engaged": "live game feature engaged flag real-time feature interaction",
    "is_location_permission_granted": "location permission granted flag device location consent",
    "is_push_notification_opened": "push notification opened flag engagement with push message",
    "is_push_notification_received": "push notification received flag delivery received status",
    "is_ticket_purchase_initiated": "ticket purchase initiated flag purchase funnel start",
    "is_ticket_purchase_completed": "ticket purchase completed flag purchase funnel completion",

    # OTT / streaming
    "away_team_code": "away team code away team abbreviation",
    "home_team_code": "home team code home team abbreviation",
    "completion_pct": "completion percent stream completion percentage",
    "concurrent_stream_count": "concurrent stream count simultaneous stream count",
    "content_type_code": "content type code media type classification",
    "device_type_code": "device type code device class code",
    "geo_ip_city": "geo IP city city inferred from IP address",
    "geo_ip_state_code": "geo IP state code region inferred from IP address",
    "is_out_of_market": "out-of-market flag territorial restriction flag",
    "is_primary_profile": "primary profile flag household primary profile indicator",
    "platform_os_code": "platform operating system code platform OS code",
    "profile_name": "profile name streaming profile display name",
    "stream_started_at": "stream started timestamp playback start time",
    "stream_ended_at": "stream ended timestamp playback end time",
    "subscription_tier_code": "subscription tier code plan level code",
    "watch_duration_seconds": "watch duration seconds viewing duration in seconds",

    # Ticketing / event access
    "delivery_method_code": "delivery method code ticket delivery method",
    "event_date": "event date scheduled game or match date",
    "face_value_amount": "face value amount base ticket price",
    "purchase_channel_code": "purchase channel code sale channel classification",
    "promo_code": "promo code discount or campaign code",
    "row_label": "row label seating row label",
    "seat_number": "seat number assigned seat identifier",
    "section_code": "section code seating section identifier",
    "team_id": "team identifier sports team ID",
    "ticket_count": "ticket count number of tickets purchased",
    "ticket_type": "ticket type admission ticket category",
    "transaction_amount": "transaction amount payment amount transaction value",
    "is_transferred": "ticket transferred flag transfer status",

    # Commerce / merchandise
    "order_status_code": "order status code order lifecycle status",
    "order_total_amount": "order total amount total order value",
    "discount_amount": "discount amount promotional savings amount",
    "shipping_amount": "shipping amount shipping fee amount",
    "subtotal_amount": "subtotal amount pre-tax pre-shipping total",
    "item_count": "item count number of items purchased",
    "product_category_list": "product category list merchandise category names",
    "product_sku_list": "product SKU list stock keeping unit list",
    "referral_channel_code": "referral channel code referral source channel",
    "payment_method_code": "payment method code payment type code",
    "is_gift": "gift order flag indicates gift purchase",
    "shipping_address_line2": "shipping address line 2 apartment suite second address line",
    "shipping_country_code": "shipping country code shipping destination country",

    # Loyalty
    "current_point_balance": "current point balance available loyalty points",
    "lifetime_points_earned": "lifetime points earned total loyalty points earned",
    "lifetime_points_redeemed": "lifetime points redeemed total loyalty points redeemed",
    "membership_tier": "membership tier loyalty program tier level",
    "enrolled_date": "enrolled date loyalty enrollment date",
    "last_activity_date": "last activity date most recent loyalty activity",
    "referral_source": "referral source program referral source",

    # Fantasy / gaming / regulated
    "account_type_code": "account type code profile type classification",
    "active_team_count": "active team count number of active fantasy teams",
    "preferred_contest_format": "preferred contest format favorite contest format",
    "last_contest_date": "last contest date most recent contest participation date",
    "lifetime_contest_count": "lifetime contest count total contests entered",
    "lifetime_entry_fee_amount": "lifetime entry fee amount total entry fees paid",
    "lifetime_winnings_amount": "lifetime winnings amount total fantasy winnings",
    "is_geo_restricted": "geo restricted flag location-based eligibility restriction",
    "is_kyc_completed": "KYC completed flag identity verification completion",
    "is_self_excluded": "self-excluded flag responsible gaming exclusion status",
    "kyc_document_hash": "KYC document hash identity verification document fingerprint hash",
    "kyc_document_type": "KYC document type identity document category",
}

AUTOMOTIVE_CANONICAL_TAGS = {
    # Automotive IDs / entities
    "vehicle_id": "vehicle identifier connected car vehicle ID",
    "vin": "vehicle identification number VIN",
    "dealer_id": "dealer identifier dealership ID",
    "staff_id": "dealer staff employee identifier",
    "model_id": "vehicle model identifier model ID",
    "campaign_id": "automotive campaign identifier campaign ID",
    "eligibility_id": "campaign eligibility record identifier",
    "campaign_interaction_id": "campaign interaction event identifier",
    "subscription_id": "connected services subscription identifier",
    "contact_id": "customer contact record identifier",
    "address_id": "customer address record identifier",
    "insurance_policy_id": "insurance policy identifier",
    "insurance_claim_id": "insurance claim identifier",
    "loyalty_transaction_id": "loyalty transaction record identifier",
    "app_session_id": "mobile app session identifier",
    "nps_survey_id": "NPS survey response identifier",
    "recall_id": "vehicle recall campaign identifier",
    "recall_response_id": "vehicle recall response identifier",
    "sales_transaction_id": "vehicle sales transaction identifier",
    "appointment_id": "service appointment identifier",
    "service_line_item_id": "service line item identifier",
    "service_order_id": "service order repair order identifier",
    "support_case_id": "customer support case identifier",
    "telematics_month_id": "monthly telematics summary identifier",
    "trade_in_id": "trade in vehicle record identifier",
    "health_report_id": "vehicle health report identifier",
    "ownership_id": "vehicle ownership record identifier",
    "warranty_claim_id": "warranty claim identifier",
    "website_session_id": "website session identifier",

    # Automotive profile / vehicle / service attributes
    "line1": "street address line one",
    "state_province": "state province region",
    "country_code": "country code ISO country",
    "gender": "customer gender",
    "generation": "customer generation cohort",
    "lifecycle_stage": "customer lifecycle stage",
    "customer_since": "customer since date",
    "preferred_language": "customer preferred language",
    "income_band": "estimated income band",
    "estimated_clv": "estimated customer lifetime value",
    "churn_risk_score": "customer churn risk score",
    "ev_propensity_score": "electric vehicle propensity score",
    "dealer_code": "dealer code dealership code",
    "dealer_name": "dealer name dealership name",
    "brand": "automotive brand make",
    "brand_affiliation": "dealer brand affiliation",
    "model_name": "vehicle model name",
    "model_year": "vehicle model year",
    "trim": "vehicle trim level",
    "body_style": "vehicle body style",
    "powertrain_type": "vehicle powertrain type",
    "current_mileage": "current vehicle mileage odometer",
    "odometer": "vehicle odometer mileage",
    "vehicle_status": "vehicle status",
    "plan_name": "connected services plan name",
    "subscription_status": "subscription status active cancelled",
    "trial_flag": "trial subscription flag",
    "auto_renew_flag": "auto renew flag",
    "points_balance": "loyalty points balance",
    "lifetime_points": "loyalty lifetime points",
    "nps_score": "net promoter score",
    "csat_score": "customer satisfaction score",
    "campaign_type": "marketing campaign type",
    "campaign_code": "campaign code",
    "campaign_name": "campaign name",
    "eligible_flag": "campaign eligibility flag",
    "eligibility_reason": "campaign eligibility reason",
    "recall_response_status": "recall response status",
    "service_category": "service category",
    "operation_code": "service operation code",
    "warranty_covered_flag": "warranty covered flag",
    "telematics_safety_score": "telematics safety score",
}

CANONICAL_TAGS = {
    **BASE_CANONICAL_TAGS,
    **SPORTS_CANONICAL_TAGS,
    **AUTOMOTIVE_CANONICAL_TAGS,
}


# ---------------------------------------------------------------------
# MANUAL OVERRIDES (ALIGNED TO YOUR MAPPING)
# ---------------------------------------------------------------------

AUTOMOTIVE_COMMON_OVERRIDES = {
    "customer_id": "customer_id",
    "household_id": "household_id",
    "golden_record_id": "golden_record_id",
    "account_id": "account_id",
    "loyalty_id": "loyalty_id",
    "loyalty_account_id": "loyalty_id",
    "email": "email",
    "email_address": "email",
    "primary_email": "email",
    "phone": "phone",
    "phone_number": "phone",
    "mobile_phone": "phone",
    "home_phone": "phone",
    "primary_phone": "phone",
    "first_name": "first_name",
    "last_name": "last_name",
    "full_name": "full_name",
    "birth_date": "dob",
    "date_of_birth": "dob",
    "dob": "dob",
    "line1": "address",
    "address_line1": "address",
    "city": "city",
    "primary_city": "city",
    "state_province": "state",
    "primary_state_province": "state",
    "postal_code": "zip",
    "zip_code": "zip",
    "zip": "zip",
    "vehicle_id": "device_id",
    "vin": "device_id",
    "ip_address": "ip_address",
    "created_at": "created_date",
    "updated_at": "updated_date",
    "eligibility_id": "record_id",
    "campaign_interaction_id": "record_id",
    "subscription_id": "record_id",
    "address_id": "record_id",
    "contact_id": "record_id",
    "staff_id": "record_id",
    "dealer_id": "record_id",
    "dtc_event_id": "record_id",
    "insurance_claim_id": "record_id",
    "insurance_policy_id": "record_id",
    "loyalty_transaction_id": "record_id",
    "app_session_id": "record_id",
    "nps_survey_id": "record_id",
    "recall_response_id": "record_id",
    "recall_id": "record_id",
    "sales_transaction_id": "record_id",
    "appointment_id": "record_id",
    "service_line_item_id": "record_id",
    "service_order_id": "record_id",
    "support_case_id": "record_id",
    "telematics_month_id": "record_id",
    "trade_in_id": "record_id",
    "health_report_id": "record_id",
    "model_id": "record_id",
    "ownership_id": "record_id",
    "warranty_claim_id": "record_id",
    "website_session_id": "record_id",
}

MANUAL_OVERRIDES = {
    # -----------------------------------------------------------------
    # MEDIA
    # -----------------------------------------------------------------
    "subscription_billing.csv": {
        "subscription_id": "record_id",
        "subscriber_id": "push_token",
        "subscriber_name": "full_name",
        "billing_email": "email",
        "contact_phone": "phone",
        "billing_address": "address",
        "billing_city": "city",
        "billing_state": "state",
        "billing_zip": "zip",
        "subscription_tier": "subscription_tier",
        "monthly_amount": "billing_amount",
        "payment_method": "payment_method",
        "billing_date": "billing_date",
        "account_status": "account_status",
    },
    "streaming_activity.csv": {
        "session_id": "record_id",
        "user_email": "email",
        "device_id": "device_id",
        "device_type": "device_type",
        "session_start_time": "session_start",
        "session_duration_min": "session_duration",
        "content_type": "content_type",
        "team_watched": "team",
        "ip_address": "ip_address",
        "user_agent": "user_agent",
        "is_live": "is_live",
    },
    "app_events.csv": {
        "event_id": "record_id",
        "event_type": "event_type",
        "app_user_email": "email",
        "device_id": "device_id",
        "device_platform": "device_platform",
        "device_model": "device_model",
        "app_version": "app_version",
        "os_version": "os_version",
        "event_timestamp": "event_timestamp",
        "push_notification_token": "push_token",
        "advertising_id": "advertising_id",
        "ip_address": "ip_address",
    },
    "customer_support.csv": {
        "ticket_id": "record_id",
        "ticket_number": "ticket_number",
        "customer_name": "full_name",
        "customer_email": "email",
        "customer_phone": "phone",
        "customer_address": "address",
        "customer_city": "city",
        "customer_state": "state",
        "customer_zip": "zip",
        "account_tier": "subscription_tier",
        "category": "category",
        "priority": "priority",
        "status": "status",
        "created_date": "created_date",
        "resolved_date": "resolved_date",
        "satisfaction_score": "satisfaction_score",
    },
    "email_engagement.csv": {
        "engagement_id": "record_id",
        "recipient_email": "email",
        "recipient_name": "full_name",
        "recipient_phone": "phone",
        "subscription_tier": "subscription_tier",
        "campaign_name": "campaign_name",
        "send_date": "send_date",
        "opened": "opened",
        "open_date": "open_date",
        "clicked": "clicked",
        "click_url": "click_url",
        "unsubscribed": "unsubscribed",
        "email_client": "email_client",
    },

    # -----------------------------------------------------------------
    # SPORTS
    # -----------------------------------------------------------------
    "spt_fan_accounts.csv": {
        "fan_account_id": "record_id",
        "registration_source": "registration_source",
        "first_name": "first_name",
        "last_name": "last_name",
        "account_email": "email",
        "phone_mobile": "phone",
        "birth_date": "dob",
        "gender_code": "gender_code",
        "address_line1": "address",
        "address_line2": "address_line2",
        "city": "city",
        "state_code": "state",
        "zip_code": "zip",
        "country_code": "shipping_country_code",
        "primary_team_id": "primary_team_id",
        "secondary_team_id": "secondary_team_id",
        "fan_since_year": "fan_since_year",
        "sport_list": "sport_list",
        "oauth_provider_code": "oauth_provider_code",
        "oauth_uid": "oauth_user_id",
        "is_email_verified": "email_verified",
        "is_phone_verified": "phone_verified",
        "is_opt_in_email": "is_opt_in_email",
        "is_opt_in_sms": "is_opt_in_sms",
        "is_opt_in_push": "is_opt_in_push",
        "account_status": "status",
        "registration_date": "signup_date",
        "last_login_at": "last_login_at",
        "created_at": "created_date",
        "updated_at": "updated_date",
    },
    "spt_ticket_orders.csv": {
        "ticket_order_id": "record_id",
        "ticketing_account_id": "ticket_account_id",
        "purchaser_first_name": "first_name",
        "purchaser_last_name": "last_name",
        "purchaser_email": "email",
        "purchaser_phone": "phone",
        "billing_zip_code": "zip",
        "event_id": "event_id_context",
        "event_date": "event_timestamp",
        "venue_id": "venue_id",
        "team_id": "team_id",
        "section_code": "section_code",
        "row_label": "row_label",
        "seat_number": "seat_number",
        "ticket_count": "ticket_count",
        "ticket_type": "ticket_type",
        "face_value_amount": "face_value_amount",
        "transaction_amount": "transaction_amount",
        "purchase_channel_code": "purchase_channel_code",
        "delivery_method_code": "delivery_method_code",
        "is_transferred": "is_transferred",
        "original_purchaser_account_id": "original_purchaser_account_id",
        "promo_code": "promo_code",
        "purchased_at": "order_date",
        "created_at": "created_date",
    },
    "spt_loyalty_members.csv": {
        "loyalty_member_id": "record_id",
        "enrolled_date": "enrolled_date",
        "membership_tier": "membership_tier",
        "first_name": "first_name",
        "last_name": "last_name",
        "member_email": "email",
        "member_phone": "phone",
        "birth_date": "dob",
        "gender_code": "gender_code",
        "address_line1": "address",
        "city": "city",
        "state_code": "state",
        "zip_code": "zip",
        "lifetime_points_earned": "lifetime_points_earned",
        "lifetime_points_redeemed": "lifetime_points_redeemed",
        "current_point_balance": "current_point_balance",
        "favorite_team_code": "favorite_team_code",
        "is_opt_in_email": "is_opt_in_email",
        "is_opt_in_sms": "is_opt_in_sms",
        "is_opt_in_push": "is_opt_in_push",
        "referral_source": "referral_source",
        "linked_ticketing_account_id": "linked_ticketing_account_id",
        "last_activity_date": "last_activity_date",
        "account_status": "status",
        "created_at": "created_date",
        "updated_at": "updated_date",
    },
    "spt_app_events.csv": {
        "digital_session_id": "record_id",
        "authenticated_user_id": "authenticated_user_id",
        "device_advertising_id": "advertising_id",
        "device_fingerprint": "device_id",
        "session_email": "email",
        "oauth_relay_email": "email",
        "platform_code": "platform_os_code",
        "device_os_code": "device_os_code",
        "device_model": "device_model",
        "app_version": "app_version",
        "session_started_at": "session_start",
        "session_ended_at": "session_end",
        "session_duration_seconds": "session_duration",
        "session_context_code": "session_context_code",
        "venue_id_detected": "venue_id",
        "event_id_context": "event_id_context",
        "screen_path_sequence": "screen_path_sequence",
        "content_item_count": "content_item_count",
        "is_ticket_purchase_initiated": "is_ticket_purchase_initiated",
        "is_ticket_purchase_completed": "is_ticket_purchase_completed",
        "is_live_game_feature_engaged": "is_live_game_feature_engaged",
        "is_push_notification_received": "is_push_notification_received",
        "is_push_notification_opened": "is_push_notification_opened",
        "is_location_permission_granted": "is_location_permission_granted",
        "referral_campaign_id": "referral_campaign_id",
        "consent_status_code": "consent_status_code",
        "created_at": "created_date",
    },
    "spt_commerce_orders.csv": {
        "commerce_order_id": "record_id",
        "commerce_customer_id": "commerce_customer_id",
        "order_email": "email",
        "purchaser_first_name": "first_name",
        "purchaser_last_name": "last_name",
        "purchaser_phone": "phone",
        "shipping_address_line1": "shipping_address",
        "shipping_address_line2": "shipping_address_line2",
        "shipping_city": "shipping_city",
        "shipping_state_code": "shipping_state",
        "shipping_zip_code": "shipping_zip",
        "shipping_country_code": "shipping_country_code",
        "billing_zip_code": "zip",
        "ordered_at": "order_date",
        "order_status_code": "order_status_code",
        "product_sku_list": "product_sku_list",
        "product_category_list": "product_category_list",
        "primary_team_affinity": "primary_team_affinity",
        "player_affinity_id": "player_affinity_id",
        "item_count": "quantity",
        "subtotal_amount": "subtotal_amount",
        "discount_amount": "discount_amount",
        "shipping_amount": "shipping_amount",
        "order_total_amount": "order_total_amount",
        "payment_method_code": "payment_method_code",
        "is_gift": "is_gift",
        "gift_recipient_email": "is_gift",
        "referral_channel_code": "referral_channel_code",
        "promo_code": "promo_code",
        "created_at": "created_date",
    },
    "spt_ott_streaming_sessions.csv": {
        "streaming_session_id": "record_id",
        "streaming_account_id": "streaming_account_id",
        "platform_code": "platform_os_code",
        "subscriber_email": "email",
        "subscriber_first_name": "first_name",
        "subscriber_last_name": "last_name",
        "subscriber_zip_code": "zip",
        "profile_name": "profile_name",
        "is_primary_profile": "is_primary_profile",
        "device_type_code": "device_type_code",
        "device_id": "device_id",
        "platform_os_code": "platform_os_code",
        "content_id": "digital_session_id",
        "content_type_code": "content_type_code",
        "home_team_code": "home_team_code",
        "away_team_code": "away_team_code",
        "event_id": "event_id_context",
        "stream_started_at": "session_start",
        "stream_ended_at": "session_end",
        "watch_duration_seconds": "session_duration",
        "completion_pct": "completion_pct",
        "concurrent_stream_count": "concurrent_stream_count",
        "geo_ip_state_code": "geo_ip_state_code",
        "geo_ip_city": "geo_ip_city",
        "subscription_tier_code": "subscription_tier_code",
        "is_out_of_market": "is_out_of_market",
        "created_at": "created_date",
    },
    "spt_fantasy_gaming_accounts.csv": {
        "fantasy_account_id": "record_id",
        "platform_code": "platform_os_code",
        "platform_name": "platform_name",
        "account_email": "email",
        "account_username": "username",
        "first_name": "first_name",
        "last_name": "last_name",
        "birth_date": "dob",
        "phone_mobile": "phone",
        "is_phone_verified": "is_kyc_completed",
        "is_kyc_completed": "is_kyc_completed",
        "kyc_document_type": "kyc_document_type",
        "kyc_document_hash": "kyc_document_hash",
        "state_of_residence": "state_of_residence",
        "country_code": "shipping_country_code",
        "account_type_code": "account_type_code",
        "sport_list": "sport_list",
        "primary_team_code": "primary_team_code",
        "lifetime_contest_count": "lifetime_contest_count",
        "lifetime_entry_fee_amount": "lifetime_entry_fee_amount",
        "lifetime_winnings_amount": "lifetime_winnings_amount",
        "preferred_contest_format": "preferred_contest_format",
        "active_team_count": "active_team_count",
        "account_status": "status",
        "is_self_excluded": "is_self_excluded",
        "is_geo_restricted": "is_geo_restricted",
        "registration_date": "signup_date",
        "last_contest_date": "last_contest_date",
        "created_at": "created_date",
    },
    "spt_marketing_campaign_events.csv": {
        "campaign_event_id": "record_id",
        "campaign_id": "campaign_id",
        "campaign_name": "campaign_name",
        "campaign_objective": "campaign_objective",
        "channel_code": "channel_code",
        "sent_at": "send_date",
        "resolved_profile_id": "resolved_profile_id",
        "recipient_id_type": "recipient_id_type",
        "recipient_address": "email",
        "source_system_code": "source_system_code",
        "delivery_status_code": "delivery_status_code",
        "bounce_type": "email_bounce_type",
        "opened_at": "open_date",
        "clicked_at": "click_date",
        "click_url": "click_url",
        "conversion_event_type": "conversion_event_type",
        "converted_at": "conversion_event_type",
        "conversion_amount": "conversion_amount",
        "unsubscribed_at": "unsubscribe_date",
        "suppression_reason": "is_self_excluded",
        "ab_test_variant": "ab_test_variant",
        "personalization_tier": "personalization_tier",
        "is_send_time_optimized": "is_send_time_optimized",
        "attribution_window_days": "attribution_window_days",
        "created_at": "created_date",
    },
}


# ---------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------

def load_columns(filepath):
    """Read just the header row from a CSV."""
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        return next(reader)


def normalize_column_name(col):
    return col.replace("_", " ").replace("-", " ").strip().lower()


def compute_tag_mapping(model, columns, source_file):
    """
    Map columns to canonical tags using embedding similarity + manual overrides.
    Uses normalized embeddings so dot product approximates cosine similarity.
    """
    overrides = {}
    if source_file.startswith("aut_"):
        overrides.update(AUTOMOTIVE_COMMON_OVERRIDES)
    overrides.update(MANUAL_OVERRIDES.get(source_file, {}))

    # If every column is explicitly mapped, use overrides exactly
    if columns and all(col in overrides for col in columns):
        return {col: overrides[col] for col in columns}

    # Production Databricks Apps intentionally omit the heavyweight optional
    # sentence-transformers dependency.  Known manual mappings still apply;
    # preserving an unmapped source name is safer than failing the whole
    # identity pipeline or guessing a semantic tag without the model.
    if model is None:
        return {col: overrides.get(col, col) for col in columns}

    tag_names = list(CANONICAL_TAGS.keys())
    tag_descriptions = list(CANONICAL_TAGS.values())

    # Encode all canonical tag descriptions once
    tag_embeddings = model.encode(
        tag_descriptions,
        show_progress_bar=False,
        normalize_embeddings=True
    )

    mapping = {}

    # Batch encode only the columns that do not have manual overrides
    non_override_cols = [col for col in columns if col not in overrides]
    if non_override_cols:
        cleaned_cols = [normalize_column_name(col) for col in non_override_cols]
        col_embeddings = model.encode(
            cleaned_cols,
            show_progress_bar=False,
            normalize_embeddings=True
        )
        encoded_lookup = {
            col: col_embeddings[idx] for idx, col in enumerate(non_override_cols)
        }
    else:
        encoded_lookup = {}

    for col in columns:
        # Manual override wins first
        if col in overrides:
            mapping[col] = overrides[col]
            continue

        col_embedding = encoded_lookup[col]
        similarities = np.dot(tag_embeddings, col_embedding)
        best_idx = int(np.argmax(similarities))
        best_score = float(similarities[best_idx])

        if best_score > SIMILARITY_THRESHOLD:
            mapping[col] = tag_names[best_idx]
        else:
            mapping[col] = col  # Keep original if no good match

    return mapping


def cache_or_output_contains_all_expected_files(payload, expected_files):
    """
    Supports payloads like:
      { "file.csv": { ... } }

    Returns True only if all expected files are present.
    """
    if not isinstance(payload, dict):
        return False
    return all(source_file in payload for source_file in expected_files)


def load_existing_mappings_if_valid(expected_files):
    """
    Reuse CACHE_FILE or OUTPUT_FILE only if they already contain all expected files.
    Prevents old cache from blocking newly added source files or renamed files.
    """
    for path, label in [(CACHE_FILE, "cache"), (OUTPUT_FILE, "output")]:
        if not os.path.exists(path):
            continue

        try:
            with open(path, "r", encoding="utf-8") as f:
                payload = json.load(f)
        except Exception:
            print(f"[WARN] Could not read {label} file: {path}. Will regenerate.")
            continue

        if cache_or_output_contains_all_expected_files(payload, expected_files):
            print(f"Found reusable {label} file at {path}")
            if path == CACHE_FILE:
                print("Using cached tag mappings.\n")
                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2)
            else:
                print("Using existing tag mappings as-is.\n")
            return payload
        else:
            print(f"{path} exists, but does not contain all expected files for this run.")
            print("Regenerating mappings.\n")

    return None


# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------

def main():
    return build_semantic_tagging_service().run()

    print("=== Step 1: Semantic Tagging ===\n")

    selected_source_systems = get_selected_source_systems()
    source_files = get_source_files(selected_source_systems)

    print(f"Selected source systems: {', '.join(selected_source_systems)}")
    print(f"Expected canonical source files: {len(source_files)}\n")

    # Reuse cache/output only if it contains all expected files
    existing = load_existing_mappings_if_valid(source_files)
    if existing is not None:
        return existing

    if not _ensure_ml():
        print("[ERROR] sentence-transformers not available and no valid cached mappings found.")
        print("Install with: pip install sentence-transformers")
        raise SystemExit(1)

    print("Loading SentenceTransformers model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("Model loaded.\n")

    all_mappings = {}

    for source_system in selected_source_systems:
        print(f"--- Processing source system: {source_system} ---")

        for canonical_source_file in SOURCE_SYSTEM_FILES.get(source_system, {}).keys():
            filepath = resolve_input_filepath(canonical_source_file)

            if not filepath:
                print(f"  SKIP: {canonical_source_file} not found (no matching alias in {INPUT_DIR})")
                continue

            actual_input_name = os.path.basename(filepath)
            columns = load_columns(filepath)

            # IMPORTANT:
            # use canonical_source_file for overrides + output key
            mapping = compute_tag_mapping(model, columns, canonical_source_file)
            all_mappings[canonical_source_file] = mapping

            print(f"  {canonical_source_file} (from {actual_input_name}):")
            for col, tag in mapping.items():
                is_override = (
                    col in MANUAL_OVERRIDES.get(canonical_source_file, {})
                    or (canonical_source_file.startswith("aut_") and col in AUTOMOTIVE_COMMON_OVERRIDES)
                )
                marker = " (override)" if is_override else ""
                print(f"    {col:35s} -> {tag}{marker}")
            print()

    # Save output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_mappings, f, indent=2)
    print(f"Saved tag mappings to {OUTPUT_FILE}")

    # Cache for next run
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(all_mappings, f, indent=2)
    print(f"Cached mappings to {CACHE_FILE}")

    print("\n=== Semantic tagging complete! ===")
    return all_mappings


if __name__ == "__main__":
    main()
