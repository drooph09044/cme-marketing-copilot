"""
Growth Vibes — Agentic Pipeline
Nine agents: Profile → Audience → Segmentation → Campaign → Journey →
             Content → Decisioning → Execution → Analytics
Each agent reads real data from data/raw/ and Azure AI Search.
No re-embedding is triggered unless rag.sync_index() is called explicitly.
"""
from __future__ import annotations

import json
import math
import uuid
from datetime import datetime
from typing import Any

import pandas as pd

from app.config import settings
from app.embeddings import get_azure_client

_AGENT_LLM_TIMEOUT_SECONDS = 2.0

# ─── shared helpers ───────────────────────────────────────────────────────────

def _rag(query: str, k: int = 5) -> str:
    """Retrieve RAG context — reads from existing index, never re-embeds."""
    try:
        from app.rag import search_remote
        docs = search_remote(query, k=k)
        return "\n\n".join(d.page_content for d in docs)
    except Exception:
        return ""


def _llm_json(
    system: str, user: str, max_tokens: int = 900, seed: int | None = None
) -> dict[str, Any]:
    """Single LLM call → parsed JSON dict. Falls back to {'text': raw} on error.

    Pass ``seed`` alongside the already-zero ``temperature`` to request
    reproducible output: on a stable model build the same prompt then yields the
    same completion instead of drifting between otherwise-identical calls.
    """
    # Keep every synchronous agent endpoint bounded.  The shared SDK client is
    # configured for long-running embedding/index work, including retries, but
    # an interactive profile/audience request must fail promptly so the caller
    # can surface an actionable provider error instead of appearing stuck.
    client = get_azure_client().with_options(
        timeout=_AGENT_LLM_TIMEOUT_SECONDS,
        max_retries=0,
    )
    create_kwargs: dict[str, Any] = {
        "model": settings.azure_deployment,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0,
        "max_completion_tokens": max_tokens,
    }
    if seed is not None:
        create_kwargs["seed"] = seed
    resp = client.chat.completions.create(**create_kwargs)
    raw = (resp.choices[0].message.content or "").strip()
    # Strip markdown code fences
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:].strip()
    try:
        return json.loads(raw)
    except Exception:
        return {"text": raw}


def _df(filename: str) -> pd.DataFrame:
    path = settings.data_root / "raw" / filename
    if not path.exists():
        return pd.DataFrame()
    for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
        try:
            return pd.read_csv(path, encoding=enc)
        except Exception:
            continue
    return pd.DataFrame()


def _safe(v: Any) -> Any:
    """Make pandas/numpy scalar values safe for FastAPI's JSON serializer."""
    if v is None:
        return None
    try:
        if bool(pd.isna(v)):
            return None
    except (TypeError, ValueError):
        pass
    item = getattr(v, "item", None)
    if callable(item):
        v = item()
    if isinstance(v, float) and not math.isfinite(v):
        return None
    return v


def _clean_row(row: dict) -> dict:
    return {k: _safe(v) for k, v in row.items()}


# ─── 1. Profile Agent ─────────────────────────────────────────────────────────

def run_profile_agent(customer_id: str) -> dict[str, Any]:
    """
    Customer 360: demographics + campaign interaction history + AI summary.
    Input:  customer_id (exact or partial match)
    Reads:  customers.csv, campaign_interactions.csv, Azure AI Search
    Output: profile, interactions, ai {summary, interests, engagement_quality,
            next_best_action, customer_score}
    """
    customers = _df("customers.csv")
    if customers.empty:
        return {"error": "customers.csv not found"}

    match = customers[customers["customer_id"] == customer_id]
    if match.empty:
        mask = customers["customer_id"].str.contains(
            customer_id,
            case=False,
            na=False,
            regex=False,
        )
        match = customers[mask]
    if match.empty:
        return {
            "error": f"Customer '{customer_id}' not found",
            "total_customers": int(len(customers)),
        }

    profile = _clean_row(match.iloc[0].to_dict())
    resolved_customer_id = str(profile.get("customer_id") or customer_id)

    # Interaction history from real data
    idf = _df("campaign_interactions.csv")
    interactions: dict[str, Any] = {"total_interactions": 0}
    if not idf.empty and "customer_id" in idf.columns:
        ci = idf[idf["customer_id"] == resolved_customer_id]
        n = len(ci)
        if n > 0:
            opened = int(ci["opened_flag"].sum()) if "opened_flag" in ci.columns else 0
            clicked = int(ci["clicked_flag"].sum()) if "clicked_flag" in ci.columns else 0
            converted = int(ci["converted_flag"].sum()) if "converted_flag" in ci.columns else 0
            revenue = (
                round(float(ci["conversion_value"].sum()), 2)
                if "conversion_value" in ci.columns
                else 0.0
            )
            interactions = {
                "total_interactions": n,
                "opened": opened,
                "clicked": clicked,
                "converted": converted,
                "total_revenue": revenue,
                "open_rate": round(opened / n * 100, 1),
                "ctr": round(clicked / n * 100, 1),
                "conversion_rate": round(converted / n * 100, 1),
                "channels": (
                    {
                        str(channel): int(count)
                        for channel, count in ci["channel"].value_counts().items()
                    }
                    if "channel" in ci.columns
                    else {}
                ),
                "last_interaction": (
                    str(ci["interaction_date"].max())
                    if "interaction_date" in ci.columns
                    else None
                ),
            }

    ctx = _rag(
        f"customer profile {profile.get('lifecycle_stage','')} "
        f"{profile.get('generation','')} behavior interests purchase history",
        k=4,
    )

    ai = _llm_json(
        "You are a Customer Analytics AI. Given customer data return ONLY a JSON object (no markdown) with:\n"
        "summary (2-sentence customer description), interests (list of 4 tags), "
        "engagement_quality (High|Medium|Low), next_best_action (string), customer_score (0-100 int).",
        f"Profile: {json.dumps(profile, default=str)}\n"
        f"Interactions: {json.dumps(interactions, default=str)}\n"
        f"Knowledge base context:\n{ctx[:600]}",
        max_tokens=400,
    )

    return {
        "customer_id": resolved_customer_id,
        "profile": profile,
        "interactions": interactions,
        "ai": ai,
    }


# ─── 2. Audience Agent ────────────────────────────────────────────────────────

def run_audience_agent(
    criteria: str,
    lifecycle_stages: list[str] | None = None,
    churn_risk_max: float | None = None,
    clv_min: float | None = None,
    age_min: int | None = None,
    age_max: int | None = None,
    countries: list[str] | None = None,
    generations: list[str] | None = None,
) -> dict[str, Any]:
    """
    Build and size an audience using criteria + optional attribute filters.
    Input:  criteria (text), optional column filters
    Reads:  customers.csv, Azure AI Search
    Output: audience count, demographics breakdown, sample, ai insights
    """
    customers = _df("customers.csv")
    if customers.empty:
        return {"error": "customers.csv not found"}

    df = customers.copy()

    if lifecycle_stages and "lifecycle_stage" in df.columns:
        df = df[df["lifecycle_stage"].isin(lifecycle_stages)]
    if churn_risk_max is not None and "churn_risk_score" in df.columns:
        df = df[df["churn_risk_score"] <= churn_risk_max]
    if clv_min is not None and "estimated_clv" in df.columns:
        df = df[df["estimated_clv"] >= clv_min]
    if age_min is not None and "age" in df.columns:
        df = df[df["age"] >= age_min]
    if age_max is not None and "age" in df.columns:
        df = df[df["age"] <= age_max]
    if countries and "primary_country" in df.columns:
        df = df[df["primary_country"].isin(countries)]
    if generations and "generation" in df.columns:
        df = df[df["generation"].isin(generations)]

    count = int(len(df))

    demographics: dict[str, dict] = {}
    for col in ("lifecycle_stage", "generation", "gender", "income_band", "primary_country"):
        if col in df.columns:
            demographics[col] = {str(k): int(v) for k, v in df[col].value_counts().head(10).items()}

    clv_stats: dict[str, float] = {}
    if "estimated_clv" in df.columns and count > 0:
        clv_stats = {
            "avg_clv": round(float(df["estimated_clv"].mean()), 2),
            "total_clv": round(float(df["estimated_clv"].sum()), 2),
            "min_clv": round(float(df["estimated_clv"].min()), 2),
            "max_clv": round(float(df["estimated_clv"].max()), 2),
        }

    churn_stats: dict[str, Any] = {}
    if "churn_risk_score" in df.columns and count > 0:
        churn_stats = {
            "avg_churn_risk": round(float(df["churn_risk_score"].mean()), 3),
            "high_risk_count": int((df["churn_risk_score"] > 0.7).sum()),
            "low_risk_count": int((df["churn_risk_score"] < 0.3).sum()),
        }

    sample_cols = [c for c in ("customer_id", "first_name", "last_name", "lifecycle_stage",
                                "generation", "estimated_clv", "churn_risk_score") if c in df.columns]
    sample = df[sample_cols].head(10).fillna("").to_dict(orient="records")

    ctx = _rag(
        f"audience segment {criteria} customer targeting "
        f"{' '.join(lifecycle_stages or [])} {' '.join(generations or [])}",
        k=4,
    )

    ai = _llm_json(
        "You are an Audience Strategy AI. Return ONLY JSON with: "
        "audience_name (descriptive), description (2 sentences), "
        "top_insights (list of 3), recommended_channels (list), best_offer_type (string).",
        f"Criteria: {criteria}\nSize: {count} of {len(customers)}\n"
        f"Demographics: {json.dumps(demographics, default=str)}\n"
        f"CLV: {json.dumps(clv_stats)}\nChurn: {json.dumps(churn_stats)}\n"
        f"Knowledge base:\n{ctx[:500]}",
        max_tokens=400,
    )

    return {
        "count": count,
        "total_customers": int(len(customers)),
        "filters": {
            "criteria": criteria, "lifecycle_stages": lifecycle_stages,
            "churn_risk_max": churn_risk_max, "clv_min": clv_min,
            "age_range": [age_min, age_max], "countries": countries,
            "generations": generations,
        },
        "demographics": demographics,
        "clv_stats": clv_stats,
        "churn_stats": churn_stats,
        "sample": sample,
        "ai": ai,
    }


# ─── 3. Segmentation Agent ────────────────────────────────────────────────────

def run_segmentation_agent(audience_description: str) -> dict[str, Any]:
    """
    Slice customers into named segments by lifecycle, CLV tier, churn risk, and generation.
    Input:  audience_description (text)
    Reads:  customers.csv, Azure AI Search
    Output: segments list, ai strategy
    """
    customers = _df("customers.csv")
    if customers.empty:
        return {"error": "customers.csv not found"}

    segments: list[dict[str, Any]] = []

    # Lifecycle segments
    if "lifecycle_stage" in customers.columns:
        for stage, grp in customers.groupby("lifecycle_stage"):
            segments.append({
                "name": str(stage).replace("_", " ").title(),
                "type": "lifecycle",
                "size": int(len(grp)),
                "pct": round(len(grp) / len(customers) * 100, 1),
                "avg_clv": round(float(grp["estimated_clv"].mean()), 2) if "estimated_clv" in grp.columns else None,
                "avg_churn_risk": round(float(grp["churn_risk_score"].mean()), 3) if "churn_risk_score" in grp.columns else None,
            })

    # CLV tier segments
    if "estimated_clv" in customers.columns:
        p33 = float(customers["estimated_clv"].quantile(0.33))
        p66 = float(customers["estimated_clv"].quantile(0.66))
        for name, mask in [
            ("VIP / High Value", customers["estimated_clv"] >= p66),
            ("Mid Value", (customers["estimated_clv"] >= p33) & (customers["estimated_clv"] < p66)),
            ("Low Value", customers["estimated_clv"] < p33),
        ]:
            grp = customers[mask]
            segments.append({
                "name": name,
                "type": "clv_tier",
                "size": int(len(grp)),
                "pct": round(len(grp) / len(customers) * 100, 1),
                "avg_clv": round(float(grp["estimated_clv"].mean()), 2),
                "avg_churn_risk": round(float(grp["churn_risk_score"].mean()), 3) if "churn_risk_score" in grp.columns else None,
                "clv_threshold": {"min": round(float(grp["estimated_clv"].min()), 2), "max": round(float(grp["estimated_clv"].max()), 2)},
            })

    # Churn risk segments
    if "churn_risk_score" in customers.columns:
        for name, mask in [
            ("High Churn Risk", customers["churn_risk_score"] > 0.7),
            ("At-Risk", (customers["churn_risk_score"] >= 0.4) & (customers["churn_risk_score"] <= 0.7)),
            ("Stable", customers["churn_risk_score"] < 0.4),
        ]:
            grp = customers[mask]
            segments.append({
                "name": name,
                "type": "churn_risk",
                "size": int(len(grp)),
                "pct": round(len(grp) / len(customers) * 100, 1),
                "avg_clv": round(float(grp["estimated_clv"].mean()), 2) if "estimated_clv" in grp.columns else None,
                "avg_churn_risk": round(float(grp["churn_risk_score"].mean()), 3),
            })

    ctx = _rag(f"customer segmentation {audience_description} segments strategy", k=4)

    ai = _llm_json(
        "You are a Segmentation Strategy AI. Return ONLY JSON with: "
        "strategy (1-sentence), priority_segments (list of top 3 segment names to target first), "
        "segment_actions (dict: segment_name → recommended action string), "
        "quick_wins (list of 2 immediate opportunities).",
        f"Request: {audience_description}\nSegments: {json.dumps(segments[:8], default=str)}\n"
        f"Knowledge base:\n{ctx[:400]}",
        max_tokens=400,
    )

    return {"total_customers": int(len(customers)), "segments": segments, "ai": ai}


# ─── 4. Campaign Agent ────────────────────────────────────────────────────────

def run_campaign_agent(
    segment_name: str,
    goal: str,
    channels: list[str] | None = None,
    duration_days: int = 14,
) -> dict[str, Any]:
    """
    Generate a campaign draft for a segment and goal.
    Input:  segment_name, goal, channels, duration_days
    Reads:  marketing_campaigns.csv, Azure AI Search
    Output: campaign draft with name, objective, KPIs, schedule
    """
    cdf = _df("marketing_campaigns.csv")
    similar: list[dict] = []
    if not cdf.empty and "target_segment" in cdf.columns:
        keyword = segment_name.split()[0] if segment_name else ""
        mask = cdf["target_segment"].str.contains(keyword, case=False, na=False)
        sim = cdf[mask].head(5)
        if not sim.empty:
            similar = _clean_row_list(sim.to_dict(orient="records"))

    ctx = _rag(
        f"campaign {goal} segment {segment_name} channel {' '.join(channels or [])} "
        "template objective KPIs success metrics",
        k=5,
    )

    ai = _llm_json(
        "You are a Campaign Strategy AI. Return ONLY JSON with: "
        "campaign_name, objective (1 measurable sentence), "
        "target_audience (description with estimated size number), "
        "channels (list of {channel, role}), "
        "schedule ({launch_date, end_date, duration_days}), "
        "kpis (list of {kpi, baseline, target, measurement_method}), "
        "budget_estimate (string), success_definition (1 sentence).",
        f"Segment: {segment_name}\nGoal: {goal}\n"
        f"Channels: {channels or ['Email','SMS']}\nDuration: {duration_days} days\n"
        f"Similar campaigns in system:\n{json.dumps(similar[:3], default=str)}\n"
        f"Knowledge base:\n{ctx[:700]}",
        max_tokens=700,
    )

    return {
        "input": {"segment_name": segment_name, "goal": goal, "channels": channels, "duration_days": duration_days},
        "similar_campaigns_found": len(similar),
        "campaign": ai,
    }


# ─── 5. Journey Agent ─────────────────────────────────────────────────────────

def run_journey_agent(campaign: dict[str, Any]) -> dict[str, Any]:
    """
    Design a customer journey for a campaign.
    Input:  campaign dict (from Campaign Agent or manual)
    Reads:  journey JSON templates from data/raw, Azure AI Search
    Output: journey with steps, entry trigger, exit clauses, settings
    """
    from app.tools import _load_journey_store, _JOURNEY_STORE, _journey_name
    _load_journey_store()

    templates: list[dict] = []
    for j in _JOURNEY_STORE[:5]:
        jt = j.get("journeyTable", {})
        # channel field may be a str or a list — normalise to str
        def _ch(tp: dict) -> str:
            c = tp.get("channel", "")
            return c[0] if isinstance(c, list) else str(c)
        templates.append({
            "name": _journey_name(j),
            "duration": jt.get("totalDuration"),
            "goal": jt.get("journeyGoal"),
            "touchpoints": len(j.get("touchpoints", [])),
            "channels": list({_ch(tp) for tp in j.get("touchpoints", [])}),
        })

    ctx = _rag(
        f"journey sequence timing {campaign.get('objective', campaign.get('goal', ''))} "
        f"touchpoints entry exit trigger",
        k=5,
    )

    ai = _llm_json(
        "You are a Journey Architect AI. Return ONLY JSON with: "
        "journey_name, "
        "steps (list of {day, channel, theme, message_hook, cta, wait_condition}, 4-6 steps), "
        "entry_trigger (string), exit_clauses (list), "
        "frequency_cap ({max_messages, window_days}), "
        "total_duration_days (int), holdout_pct (int), priority_level (High|Medium|Low).",
        f"Campaign:\n{json.dumps(campaign, default=str)[:800]}\n"
        f"Available templates:\n{json.dumps(templates, default=str)}\n"
        f"Knowledge base:\n{ctx[:600]}",
        max_tokens=700,
    )

    return {
        "campaign_name": campaign.get("campaign_name") or campaign.get("name", ""),
        "templates_referenced": len(templates),
        "journey": ai,
    }


# ─── 6. Content Generation Agent ──────────────────────────────────────────────

def run_content_agent(
    campaign: dict[str, Any],
    journey_step: dict[str, Any],
    customer_id: str | None = None,
) -> dict[str, Any]:
    """
    Generate personalized channel content for a journey step.
    Input:  campaign, journey_step ({day, channel, theme, cta}), optional customer_id
    Reads:  customer profile (optional), Azure AI Search for brand/product context
    Output: content {subject_line, headline, body_copy, cta_text, personalization_tokens}
    """
    customer_info = ""
    if customer_id:
        pr = run_profile_agent(customer_id)
        if "profile" in pr:
            p = pr["profile"]
            ai_p = pr.get("ai", {})
            customer_info = (
                f"Name: {p.get('first_name','')} {p.get('last_name','')}, "
                f"Lifecycle: {p.get('lifecycle_stage','')}, "
                f"Generation: {p.get('generation','')}, "
                f"CLV: ${p.get('estimated_clv','')}, "
                f"Interests: {ai_p.get('interests', [])}, "
                f"Engagement: {ai_p.get('engagement_quality','')}"
            )

    channel = journey_step.get("channel", "Email")
    ctx = _rag(
        f"content {channel} {campaign.get('campaign_name','')} "
        f"{journey_step.get('theme','')} brand guidelines personalization",
        k=4,
    )

    ai = _llm_json(
        f"You are a {channel} Content AI. Return ONLY JSON with: "
        "channel, subject_line (for email) or opening_line (for SMS/Push), "
        "headline, body_copy (2-3 sentences), cta_text, "
        "personalization_tokens (list of {{token_name}} placeholders), "
        "tone, estimated_reading_seconds (int).",
        f"Campaign: {campaign.get('campaign_name','')}\n"
        f"Objective: {campaign.get('objective','')}\n"
        f"Step: Day {journey_step.get('day','?')} | {channel} | {journey_step.get('theme','')}\n"
        f"CTA goal: {journey_step.get('cta','')}\n"
        f"Customer: {customer_info or 'Not specified (use generic personalization)'}\n"
        f"Brand context:\n{ctx[:500]}",
        max_tokens=500,
    )

    return {
        "campaign_name": campaign.get("campaign_name", ""),
        "step": journey_step,
        "customer_id": customer_id,
        "content": ai,
    }


# ─── 7. Decisioning Agent ─────────────────────────────────────────────────────

def run_decision_agent(
    customer_id: str,
    campaign: dict[str, Any],
    journey: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Determine next best action for a customer in a campaign.
    Checks eligibility, frequency cap, engagement quality, CLV viability.
    Input:  customer_id, campaign dict, optional journey dict
    Reads:  customers.csv, campaign_interactions.csv, Azure AI Search
    Output: eligibility_checks, decision {action, reason, next_touchpoint, confidence}
    """
    pr = run_profile_agent(customer_id)
    profile = pr.get("profile", {})
    interactions = pr.get("interactions", {})
    ai_profile = pr.get("ai", {})

    checks: list[dict[str, Any]] = []

    # 1. Interaction history exists
    total_ints = interactions.get("total_interactions", 0)
    checks.append({
        "rule": "Has interaction history",
        "status": "pass" if total_ints > 0 else "warn",
        "detail": f"{total_ints} past campaign interactions",
    })

    # 2. Frequency cap (≤4 messages per campaign window)
    freq_cap = journey.get("journey", {}).get("frequency_cap", {}).get("max_messages", 4) if journey else 4
    checks.append({
        "rule": f"Frequency cap (max {freq_cap} messages)",
        "status": "pass" if total_ints < freq_cap else "review",
        "detail": f"Customer has {total_ints} recorded interactions",
    })

    # 3. Engagement quality
    engagement = ai_profile.get("engagement_quality", "Unknown")
    eng_status = {"High": "pass", "Medium": "warn", "Low": "review"}.get(engagement, "warn")
    checks.append({
        "rule": "Engagement quality threshold",
        "status": eng_status,
        "detail": f"AI-assessed engagement: {engagement}",
    })

    # 4. CLV threshold
    clv = float(profile.get("estimated_clv") or 0)
    checks.append({
        "rule": "CLV viability (>$50)",
        "status": "pass" if clv > 50 else "warn",
        "detail": f"Estimated CLV: ${clv:,.2f}",
    })

    # 5. Conversion history
    conv_rate = interactions.get("conversion_rate", 0)
    checks.append({
        "rule": "Historical conversion rate",
        "status": "pass" if conv_rate >= 10 else "warn",
        "detail": f"Conversion rate from past campaigns: {conv_rate}%",
    })

    ctx = _rag(
        f"decisioning rules eligibility next best action "
        f"{campaign.get('campaign_name','')} {profile.get('lifecycle_stage','')}",
        k=4,
    )

    ai = _llm_json(
        "You are a Campaign Decisioning AI. Return ONLY JSON with: "
        "action (send_email|send_sms|send_offer|wait|exit_journey), "
        "reason (1 sentence), "
        "next_touchpoint ({channel, timing, message_theme}), "
        "confidence_score (0-100 int), "
        "personalization_hint (key personalization to apply).",
        f"Customer: {json.dumps(profile, default=str)[:300]}\n"
        f"Eligibility: {json.dumps(checks, default=str)}\n"
        f"Campaign: {campaign.get('campaign_name','')}\n"
        f"Customer score: {ai_profile.get('customer_score', 50)}\n"
        f"Context:\n{ctx[:400]}",
        max_tokens=400,
    )

    return {
        "customer_id": customer_id,
        "eligibility_checks": checks,
        "all_passed": all(c["status"] == "pass" for c in checks),
        "decision": ai,
    }


# ─── 8. Execution Agent ───────────────────────────────────────────────────────

def run_execution_agent(
    decision: dict[str, Any],
    campaign_id: str | None = None,
) -> dict[str, Any]:
    """
    Simulate campaign execution based on a decisioning output.
    Input:  decision dict (from Decisioning Agent), optional campaign_id
    Output: execution_id, status, delivery record, next_step
    """
    action = decision.get("decision", {}).get("action", "unknown")
    customer_id = decision.get("customer_id", "unknown")
    execution_id = f"EXEC-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.utcnow().isoformat()

    channel_map = {
        "send_email": "Email",
        "send_sms": "SMS",
        "send_offer": "In-App/Offer",
        "wait": None,
        "exit_journey": None,
    }
    channel = channel_map.get(action)

    if action in ("wait", "exit_journey"):
        status = "held" if action == "wait" else "exited"
        delivery: dict | None = None
    else:
        # 92% simulated success rate
        import random
        delivered = random.random() < 0.92
        status = "delivered" if delivered else "failed"
        delivery = {
            "channel": channel,
            "sent_at": now,
            "status": status,
            "message_id": f"MSG-{uuid.uuid4().hex[:10].upper()}",
            "delivery_provider": "AJO Outbound",
        }

    return {
        "execution_id": execution_id,
        "campaign_id": campaign_id,
        "customer_id": customer_id,
        "action": action,
        "channel": channel,
        "status": status,
        "delivery": delivery,
        "executed_at": now,
        "next_step": decision.get("decision", {}).get("next_touchpoint"),
    }


# ─── 9. Analytics Agent ───────────────────────────────────────────────────────

def run_analytics_agent(campaign_id: str | None = None) -> dict[str, Any]:
    """
    Compute real performance metrics from campaign_interactions.csv + AI insights.
    Input:  optional campaign_id (if None: all campaigns)
    Reads:  campaign_interactions.csv, marketing_campaigns.csv, Azure AI Search
    Output: metrics, channel_breakdown, top_campaigns, ai insights
    """
    idf = _df("campaign_interactions.csv")
    cdf = _df("marketing_campaigns.csv")

    if idf.empty:
        return {"error": "campaign_interactions.csv not found"}

    df = idf.copy()
    scope = "all_campaigns"
    if campaign_id:
        if "campaign_id" in df.columns:
            df = df[df["campaign_id"] == campaign_id]
        scope = campaign_id
    if len(df) == 0:
        return {"error": f"No interactions found for scope: {scope}"}

    total = int(len(df))
    opened = int(df["opened_flag"].sum()) if "opened_flag" in df.columns else 0
    clicked = int(df["clicked_flag"].sum()) if "clicked_flag" in df.columns else 0
    converted = int(df["converted_flag"].sum()) if "converted_flag" in df.columns else 0
    revenue = round(float(df["conversion_value"].sum()), 2) if "conversion_value" in df.columns else 0.0
    aov = round(revenue / max(converted, 1), 2)

    metrics = {
        "total_interactions": total,
        "open_rate_pct": round(opened / total * 100, 1),
        "ctr_pct": round(clicked / total * 100, 1),
        "conversion_rate_pct": round(converted / total * 100, 1),
        "total_revenue": revenue,
        "aov": aov,
        "opens": opened,
        "clicks": clicked,
        "conversions": converted,
    }

    # Channel breakdown
    channel_stats: dict[str, Any] = {}
    if "channel" in df.columns:
        for ch, grp in df.groupby("channel"):
            n = int(len(grp))
            ch_opens = int(grp["opened_flag"].sum()) if "opened_flag" in grp.columns else 0
            ch_clicks = int(grp["clicked_flag"].sum()) if "clicked_flag" in grp.columns else 0
            ch_conv = int(grp["converted_flag"].sum()) if "converted_flag" in grp.columns else 0
            ch_rev = round(float(grp["conversion_value"].sum()), 2) if "conversion_value" in grp.columns else 0.0
            channel_stats[str(ch)] = {
                "interactions": n,
                "open_rate": round(ch_opens / n * 100, 1),
                "ctr": round(ch_clicks / n * 100, 1),
                "conversion_rate": round(ch_conv / n * 100, 1),
                "revenue": ch_rev,
            }

    # Top campaigns by revenue (only if showing all)
    top_campaigns: list[dict] = []
    if not campaign_id and "campaign_id" in df.columns:
        for cid, grp in df.groupby("campaign_id"):
            n = int(len(grp))
            conv = int(grp["converted_flag"].sum()) if "converted_flag" in grp.columns else 0
            rev = round(float(grp["conversion_value"].sum()), 2) if "conversion_value" in grp.columns else 0.0
            cname = str(cid)
            if not cdf.empty and "campaign_id" in cdf.columns and "campaign_name" in cdf.columns:
                cn_row = cdf[cdf["campaign_id"] == str(cid)]
                if not cn_row.empty:
                    cname = str(cn_row.iloc[0]["campaign_name"])
            top_campaigns.append({
                "campaign_id": str(cid),
                "campaign_name": cname,
                "interactions": n,
                "conversion_rate": round(conv / n * 100, 1),
                "revenue": rev,
            })
        top_campaigns = sorted(top_campaigns, key=lambda x: x["revenue"], reverse=True)[:10]

    ctx = _rag(
        f"campaign analytics performance benchmarks {scope} "
        "open rate CTR conversion revenue insights recommendations",
        k=4,
    )

    ai = _llm_json(
        "You are a Campaign Analytics AI. Return ONLY JSON with: "
        "performance_summary (2 sentences), "
        "top_insights (list of 3 specific data-driven insights), "
        "recommendations (list of 3 actionable items), "
        "risk_flags (list of concerns if any).",
        f"Metrics: {json.dumps(metrics)}\n"
        f"Channel breakdown: {json.dumps(channel_stats)}\n"
        f"Knowledge base:\n{ctx[:500]}",
        max_tokens=450,
    )

    return {
        "scope": scope,
        "metrics": metrics,
        "channel_breakdown": channel_stats,
        "top_campaigns": top_campaigns,
        "ai": ai,
    }


# ─── internal helper ──────────────────────────────────────────────────────────

def _clean_row_list(rows: list[dict]) -> list[dict]:
    return [{k: _safe(v) for k, v in r.items()} for r in rows]
