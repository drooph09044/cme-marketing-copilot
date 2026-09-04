"""Segment endpoints — list all + fetch one by id."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.data.loaders import get_segment_by_id, load_segments
from app.qa.schemas import SegmentModel

router = APIRouter(tags=["segments"])


@router.get("/segments", response_model=list[SegmentModel])
def list_segments() -> list[dict]:
    return load_segments()


@router.get("/segments/{segment_id}", response_model=SegmentModel)
def get_segment(segment_id: str) -> dict:
    seg = get_segment_by_id(segment_id)
    if seg is None:
        raise HTTPException(status_code=404, detail=f"Unknown segment {segment_id!r}")
    return seg
