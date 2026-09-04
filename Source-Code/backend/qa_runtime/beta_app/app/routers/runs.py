"""Run endpoints — QA mode + standalone profile synth.

- POST /profiles/synth   Generate test suites without running QA.
- POST /runs/qa          Start a LangGraph QA run; accepts optional pre-generated suites.
- GET  /runs/{id}/stream SSE stream of run progress.
- GET  /runs/{id}/report Final QA report.
"""

from __future__ import annotations

import asyncio
import logging
import time
import traceback
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.data.loaders import get_journey_by_id, get_segment_by_id
from app.llm.router import current_provider
from app.qa.emit import emit_done, emit_step
from app.qa.graph import build_qa_graph
from app.qa.nodes.profile_synth import extend_cohort, simulate_profile, synthesize_plan
from app.qa.schemas import (
    ProfileSynthExtendRequest,
    ProfileSynthJobResponse,
    ProfileSynthRequest,
    ProfileSynthStatusResponse,
    QAReport,
    QARunRequest,
    QARunResponse,
    SimulateJobResponse,
    SimulateRequest,
    SimulateStatusResponse,
)
from app.qa.store import registry
from app.qa.synth_store import registry as synth_registry
from app.qa.sim_store import registry as sim_registry

logger = logging.getLogger(__name__)
router = APIRouter(tags=["runs"])

_graph: object | None = None


def _get_graph() -> object:
    global _graph
    if _graph is None:
        _graph = build_qa_graph()
    return _graph


def _build_report(run_id: str, final_state: dict, started: float, provider: str) -> dict:
    duration_ms = int((time.time() - started) * 1000)
    return QAReport(
        runId=run_id,
        journeyId=final_state["journey"]["useCaseId"],
        segmentId=final_state["segment"]["id"],
        modelProvider=provider,
        verdict=final_state.get("verdict", "fail"),
        summary=final_state.get("summary", ""),
        fit=final_state["fit"],
        structure=list(final_state.get("structure", [])),
        walks=list(final_state.get("walks", [])),
        suites=final_state.get("suite_summaries", []),
        createdAt=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        durationMs=duration_ms,
    ).model_dump(mode="json")


async def _execute_run(run_id: str, journey_id: str, segment_id: str, profile_count: int,
                       suites: list | None = None,
                       base_profiles: list | None = None) -> None:
    started = time.time()
    provider = current_provider()
    suite_count = len(suites) if suites else 0
    base_count = len(base_profiles) if base_profiles else 0
    logger.info(
        "QA run %s started — provider=%s journey=%s segment=%s suites=%d base_profiles=%d",
        run_id, provider, journey_id, segment_id, suite_count, base_count,
    )
    try:
        graph_input: dict = {
            "run_id": run_id,
            "journey_id": journey_id,
            "segment_id": segment_id,
            "profile_count": profile_count,
        }
        if suites:
            graph_input["suites"] = [s.model_dump() if hasattr(s, "model_dump") else s for s in suites]
        if base_profiles:
            graph_input["base_profiles"] = base_profiles

        logger.info("QA run %s — invoking graph", run_id)
        final_state = await _get_graph().ainvoke(graph_input)

        n_walks = len(final_state.get("walks", []))
        verdict = final_state.get("verdict", "fail")
        logger.info("QA run %s — graph complete: verdict=%s walks=%d", run_id, verdict, n_walks)

        report = _build_report(run_id, final_state, started, provider)
        registry.save_report(run_id, report)
        status = "passed" if report["verdict"] != "fail" else "failed"
        logger.info("QA run %s — emitting done status=%s duration=%.1fs", run_id, status, (time.time() - started))
        await emit_done(run_id, status=status, duration_ms=report["durationMs"], report_url=f"/runs/{run_id}/report")

    except Exception as exc:
        elapsed_ms = int((time.time() - started) * 1000)
        tb = traceback.format_exc()
        logger.error("QA run %s FAILED after %.1fs:\n%s", run_id, elapsed_ms / 1000, tb)

        error_msg = f"{type(exc).__name__}: {exc}"
        # Emit an error step so the frontend SSE stream shows the failure message.
        try:
            await emit_step(
                run_id,
                node_id="error",
                label="Run failed",
                msg=error_msg,
                progress=0,
                level="err",
            )
        except Exception:
            pass
        await emit_done(run_id, status="failed", duration_ms=elapsed_ms,
                        report_url=f"/runs/{run_id}/report")
        registry.save_report(run_id, {
            "runId": run_id,
            "verdict": "fail",
            "summary": f"Run failed: {error_msg}",
            "journeyId": journey_id,
            "segmentId": segment_id,
            "modelProvider": provider,
            "fit": {"verdict": "fail", "score": 0.0, "reasons": [error_msg], "summary": ""},
            "structure": [],
            "walks": [],
            "suites": [],
            "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "durationMs": elapsed_ms,
        })


async def _execute_synth(synth_id: str, segment: dict, journey: dict, profile_count: int) -> None:
    seg_name = segment.get("name", synth_id)
    logger.info("Synth %s started — segment=%s", synth_id, seg_name)
    try:
        resp = await synthesize_plan(segment, journey, profile_count)
        logger.info("Synth %s done — %d suites, %d cohort profiles",
                    synth_id, len(resp.suites), len(resp.profiles))
        synth_registry.set_result(synth_id, resp.model_dump(mode="json"))
    except Exception as exc:
        tb = traceback.format_exc()
        logger.error("Synth %s FAILED:\n%s", synth_id, tb)
        synth_registry.set_error(synth_id, f"{type(exc).__name__}: {exc}")


@router.post("/profiles/synth", response_model=ProfileSynthJobResponse)
async def synth_profiles(req: ProfileSynthRequest) -> ProfileSynthJobResponse:
    """Schedule a profile-synth job and return immediately with a synthId.

    LLM calls for the full suite plan can take 30-90s; doing it inline would
    blow past the Next.js dev proxy timeout. Frontend polls
    GET /profiles/synth/{synthId} until status flips from "running".
    """
    journey = get_journey_by_id(req.journeyId)
    if journey is None:
        raise HTTPException(status_code=404, detail=f"Unknown journey {req.journeyId!r}")
    segment = get_segment_by_id(req.segmentId)
    if segment is None:
        raise HTTPException(status_code=404, detail=f"Unknown segment {req.segmentId!r}")

    job = synth_registry.create(journey_id=req.journeyId, segment_id=req.segmentId)
    asyncio.create_task(_execute_synth(job.synth_id, segment, journey, req.profileCount))
    return ProfileSynthJobResponse(synthId=job.synth_id, status="running")


async def _execute_extend(synth_id: str, segment: dict, journey: dict,
                           instruction: str, existing_profiles: list, count: int) -> None:
    logger.info("Extend %s started — instruction=%r count=%d", synth_id, instruction[:60], count)
    try:
        resp = await extend_cohort(segment, journey, instruction, existing_profiles, count)
        logger.info("Extend %s done — %d new profiles", synth_id, len(resp.profiles))
        synth_registry.set_result(synth_id, resp.model_dump(mode="json"))
    except Exception as exc:
        logger.error("Extend %s FAILED: %s", synth_id, traceback.format_exc())
        synth_registry.set_error(synth_id, f"{type(exc).__name__}: {exc}")


@router.post("/profiles/synth/extend", response_model=ProfileSynthJobResponse)
async def extend_profiles(req: ProfileSynthExtendRequest) -> ProfileSynthJobResponse:
    """Schedule an extension job that adds profiles per a natural-language
    instruction. Returns a synthId — frontend polls the same status endpoint.
    """
    journey = get_journey_by_id(req.journeyId)
    if journey is None:
        raise HTTPException(status_code=404, detail=f"Unknown journey {req.journeyId!r}")
    segment = get_segment_by_id(req.segmentId)
    if segment is None:
        raise HTTPException(status_code=404, detail=f"Unknown segment {req.segmentId!r}")

    job = synth_registry.create(journey_id=req.journeyId, segment_id=req.segmentId)
    asyncio.create_task(_execute_extend(
        job.synth_id, segment, journey, req.instruction, req.existingProfiles, req.count,
    ))
    return ProfileSynthJobResponse(synthId=job.synth_id, status="running")


@router.get("/profiles/synth/{synth_id}", response_model=ProfileSynthStatusResponse)
async def get_synth_status(synth_id: str) -> ProfileSynthStatusResponse:
    job = synth_registry.get(synth_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Unknown synth job {synth_id!r}")
    suites = job.result.get("suites") if job.result else None
    profiles = job.result.get("profiles") if job.result else None
    return ProfileSynthStatusResponse(
        synthId=job.synth_id,
        status=job.status,
        suites=suites,
        profiles=profiles,
        error=job.error,
    )


# ── Per-profile journey simulation ──────────────────────────────────────────

async def _execute_simulate(sim_id: str, journey: dict, segment: dict,
                            profile: dict, suites: list) -> None:
    pid = profile.get("id", sim_id)
    logger.info("Simulate %s started — profile=%s", sim_id, pid)
    try:
        suite_dicts = [s.model_dump() if hasattr(s, "model_dump") else s for s in suites]
        result = await simulate_profile(journey, segment, profile, suite_dicts)
        logger.info("Simulate %s done — profile=%s verdict=%s checks=%d",
                    sim_id, pid, result.verdict, len(result.checks))
        sim_registry.set_result(sim_id, result.model_dump(mode="json"))
    except Exception as exc:
        logger.error("Simulate %s FAILED: %s", sim_id, traceback.format_exc())
        sim_registry.set_error(sim_id, f"{type(exc).__name__}: {exc}")


@router.post("/simulate", response_model=SimulateJobResponse)
async def start_simulate(req: SimulateRequest) -> SimulateJobResponse:
    """Schedule a per-profile journey simulation. Frontend polls GET /simulate/{id}."""
    journey = get_journey_by_id(req.journeyId)
    if journey is None:
        raise HTTPException(status_code=404, detail=f"Unknown journey {req.journeyId!r}")
    segment = get_segment_by_id(req.segmentId)
    if segment is None:
        raise HTTPException(status_code=404, detail=f"Unknown segment {req.segmentId!r}")

    job = sim_registry.create(profile_id=str(req.profile.get("id", "")))
    asyncio.create_task(_execute_simulate(job.sim_id, journey, segment, req.profile, req.suites))
    return SimulateJobResponse(simId=job.sim_id, status="running")


@router.get("/simulate/{sim_id}", response_model=SimulateStatusResponse)
async def get_simulate_status(sim_id: str) -> SimulateStatusResponse:
    job = sim_registry.get(sim_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Unknown sim job {sim_id!r}")
    return SimulateStatusResponse(
        simId=job.sim_id,
        status=job.status,
        result=job.result,  # pydantic coerces the dict to SimulationResult
        error=job.error,
    )


@router.post("/runs/qa", response_model=QARunResponse)
async def start_qa_run(req: QARunRequest) -> QARunResponse:
    if get_journey_by_id(req.journeyId) is None:
        raise HTTPException(status_code=404, detail=f"Unknown journey {req.journeyId!r}")
    if get_segment_by_id(req.segmentId) is None:
        raise HTTPException(status_code=404, detail=f"Unknown segment {req.segmentId!r}")

    run = registry.create(journey_id=req.journeyId, segment_id=req.segmentId, profile_count=req.profileCount)
    asyncio.create_task(_execute_run(
        run.run_id, req.journeyId, req.segmentId, req.profileCount,
        req.suites,
        req.baseProfiles,
    ))
    return QARunResponse(runId=run.run_id, status="queued")


@router.get("/runs/{run_id}/stream")
async def stream_run(run_id: str) -> EventSourceResponse:
    if registry.get(run_id) is None:
        raise HTTPException(status_code=404, detail="Unknown run id")

    logger.info("SSE stream opened — run=%s", run_id)

    async def gen() -> AsyncIterator[dict[str, str]]:
        async for ev in registry.subscribe(run_id):
            logger.debug("SSE emit event=%s run=%s", ev.get("event"), run_id)
            yield ev

    # ping=15 sends a SSE comment every 15s to keep the connection alive through
    # proxies and load balancers (including the Next.js dev proxy).
    return EventSourceResponse(gen(), ping=15)


@router.get("/runs/{run_id}/report")
async def get_report(run_id: str) -> dict:
    report = registry.get_report(run_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not ready or unknown run id")
    return report
