"""
Semantic Tagger — Lightweight column-to-tag mapping using SentenceTransformers.

Uses optional all-MiniLM-L6-v2 cosine similarity when explicitly enabled.
The Databricks App uses exact and token matching by default, so deployments
do not require sentence-transformers or PyTorch.

Usage:
    from semantic_tagger import SemanticTagger
    tagger = SemanticTagger()
    results = tagger.tag_columns(["billing_email", "contact_phone", "subscriber_name"])
    # => {"billing_email": {"tag": "email", "score": 0.91}, ...}
"""

import os

import numpy as np

# ── Canonical tag vocabulary ─────────────────────────────────────────────────
# Each tag has a rich description to give the embedding model enough context.
CANONICAL_TAGS = {
    # Identity
    "record_id":          "record identifier unique ID row key primary key subscription ID session ID event ID ticket ID engagement ID",
    "first_name":         "person first name given name",
    "last_name":          "person last name surname family name",
    "full_name":          "person full name complete name subscriber name customer name recipient name",
    "email":              "email address electronic mail e-mail",
    "phone":              "phone number telephone contact number mobile cell",
    "dob":                "date of birth birthday birth date age",
    "subscriber_id":      "subscriber identifier customer ID member ID account number",

    # Address
    "address":            "street address mailing address residence billing address home address",
    "city":               "city town municipality locality billing city home city",
    "state":              "state province region territory billing state home state",
    "zip":                "zip code postal code postcode ZIP+4 billing zip home zip",
    "shipping_address":   "shipping address delivery address ship to address",
    "shipping_city":      "shipping city delivery city ship to city",
    "shipping_state":     "shipping state delivery state ship to state",
    "shipping_zip":       "shipping zip delivery postal code ship to zip",

    # Device / Digital
    "device_id":          "device identifier device ID hardware ID UDID",
    "device_type":        "device type platform device category mobile desktop tablet",
    "device_model":       "device model hardware model phone model",
    "device_platform":    "device platform operating system mobile platform iOS Android",
    "ip_address":         "IP address network address internet protocol",
    "user_agent":         "user agent browser agent client info",
    "push_token":         "push notification token push ID FCM APNs",
    "advertising_id":     "advertising ID ad tracker IDFA GAID",

    # Session / Event
    "session_start_time": "session start time timestamp login time",
    "session_duration":   "session duration watch time viewing length minutes",
    "event_type":         "event type action type activity login click purchase",
    "event_timestamp":    "event timestamp event time event date occurrence time",
    "content_type":       "content type media type video category genre",
    "team":               "team sports team favorite team watched team matchup",
    "is_live":            "is live stream live broadcast real-time",

    # App
    "app_version":        "app version application version software version build",
    "os_version":         "operating system version OS version system version",

    # Subscription / Billing
    "subscription_tier":  "subscription tier plan level membership premium free basic VIP",
    "billing_amount":     "billing amount charge monthly payment price cost",
    "billing_date":       "billing date payment date invoice date charge date",
    "payment_method":     "payment method credit card payment type debit PayPal",
    "account_status":     "account status active suspended cancelled closed",
    "signup_date":        "signup date registration date account creation date",

    # Support
    "ticket_number":      "ticket number case number support ID reference number",
    "category":           "category issue type problem category topic",
    "priority":           "priority urgency severity level high medium low",
    "status":             "status state current status open closed pending",
    "created_date":       "created date open date ticket date start date",
    "resolved_date":      "resolved date close date resolution date end date",
    "satisfaction_score":  "satisfaction score CSAT rating feedback NPS",

    # Email Campaign
    "campaign_name":      "campaign name marketing campaign promo name newsletter",
    "send_date":          "send date email date dispatch date campaign date",
    "opened":             "opened email opened read status",
    "open_date":          "open date read date opened timestamp",
    "clicked":            "clicked link clicked click status",
    "click_url":          "click URL link destination href",
    "unsubscribed":       "unsubscribed opt out email preference",
    "email_client":       "email client mail app reader outlook gmail",

    # Commerce
    "order_number":       "order number purchase ID order ID transaction ID",
    "item":               "item product merchandise goods SKU",
    "item_price":         "item price cost amount unit price",
    "quantity":           "quantity count number of items",
    "order_date":         "order date purchase date buy date transaction date",
    "order_status":       "order status delivery status shipping status",
    "is_guest":           "guest checkout anonymous purchase no account",
}

# Similarity threshold — columns below this get no tag assignment
DEFAULT_THRESHOLD = 0.35


def _normalize(s: str) -> str:
    """Normalize a column/tag name for comparison: lowercase, strip separators."""
    return s.lower().replace("_", " ").replace("-", " ").strip()


def _token_overlap(a: str, b: str) -> float:
    """Jaccard similarity on word tokens."""
    ta = set(a.split())
    tb = set(b.split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


class SemanticTagger:
    """Lightweight semantic column tagger using sentence embeddings + string matching.

    Matching strategy (3 layers, best score wins):
      1. Exact name match  → 1.0
      2. Token overlap      → Jaccard score (good for partial name matches)
      3. Embedding cosine   → semantic similarity via SentenceTransformers

    The final score = max(token_overlap, embedding_similarity), clamped to [0, 1].
    Exact name matches always get 1.0.
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self._model = None
        self._embedding_load_attempted = False
        self._model_name = model_name
        self._tag_names = list(CANONICAL_TAGS.keys())
        self._tag_descriptions = list(CANONICAL_TAGS.values())
        # Pre-build normalized tag names for string matching
        self._tag_names_norm = [_normalize(t) for t in self._tag_names]
        self._tag_embeddings = None

    def _ensure_loaded(self):
        """Lazy-load model and pre-compute tag embeddings on first use."""
        if self._model is not None or self._embedding_load_attempted:
            return
        self._embedding_load_attempted = True
        if str(os.getenv("CODEX_ENABLE_EMBEDDING_TAGGER", "0")).lower() not in {
            "1",
            "true",
            "yes",
        }:
            return
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            return
        self._model = SentenceTransformer(self._model_name)
        # Embed "tag_name: description" so both the name and context are captured
        combined = [
            f"{name}: {desc}" for name, desc in zip(self._tag_names, self._tag_descriptions)
        ]
        self._tag_embeddings = self._model.encode(
            combined, show_progress_bar=False, normalize_embeddings=True
        )

    def _string_match(self, col_norm: str) -> tuple:
        """Try exact and token-overlap matching against tag names.

        Returns (best_tag_index, score) or (None, 0) if no good match.
        """
        best_idx = None
        best_score = 0.0

        for j, tag_norm in enumerate(self._tag_names_norm):
            # Exact match
            if col_norm == tag_norm:
                return j, 1.0

            # Token overlap (Jaccard)
            overlap = _token_overlap(col_norm, tag_norm)
            if overlap > best_score:
                best_score = overlap
                best_idx = j

        return best_idx, best_score

    def tag_columns(self, columns: list[str], threshold: float = DEFAULT_THRESHOLD) -> dict:
        """
        Map a list of column names to canonical tags.

        Returns dict: {column_name: {"tag": str, "score": float}}
        If score < threshold, tag is set to None (untagged).
        """
        self._ensure_loaded()

        col_embeddings = None
        if self._model is not None:
            # Clean column names for embedding when the optional model is
            # installed. Databricks Apps use the lexical fallback to avoid
            # installing PyTorch during every deployment.
            col_texts = [col.replace("_", " ").replace("-", " ") for col in columns]
            col_embeddings = self._model.encode(
                col_texts, show_progress_bar=False, normalize_embeddings=True
            )

        results = {}
        for i, col in enumerate(columns):
            col_norm = _normalize(col)

            # Layer 1+2: String matching (exact + token overlap)
            str_idx, str_score = self._string_match(col_norm)

            # Layer 3: optional embedding cosine similarity
            emb_idx = None
            emb_score = -1.0
            if col_embeddings is not None and self._tag_embeddings is not None:
                similarities = np.dot(self._tag_embeddings, col_embeddings[i])
                emb_idx = int(np.argmax(similarities))
                emb_score = float(similarities[emb_idx])

            # Pick the best score across all layers
            if str_score >= emb_score and str_idx is not None:
                best_idx = str_idx
                best_score = str_score
            elif emb_idx is not None:
                best_idx = emb_idx
                best_score = emb_score
            else:
                best_idx = str_idx
                best_score = str_score

            if best_idx is not None and best_score >= threshold:
                results[col] = {
                    "tag": self._tag_names[best_idx],
                    "score": round(best_score, 4),
                }
            else:
                results[col] = {
                    "tag": None,
                    "score": round(best_score, 4),
                }

        return results

    def get_vocabulary(self) -> list[dict]:
        """Return the full canonical tag vocabulary with descriptions."""
        return [
            {"tag": name, "description": desc}
            for name, desc in CANONICAL_TAGS.items()
        ]
