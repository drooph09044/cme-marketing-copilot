"""Profile endpoints — list + synthetic generation."""

from __future__ import annotations

from fastapi import APIRouter

from app.data import fixtures
from app.models import GenerateProfilesRequest, Profile

router = APIRouter(tags=["profiles"])


@router.get("/profiles", response_model=list[Profile])
def list_profiles() -> list[Profile]:
    return fixtures.PROFILES


@router.post("/profiles/generate", response_model=list[Profile])
def generate_profiles(req: GenerateProfilesRequest) -> list[Profile]:
    seed_offset = len(fixtures.PROFILES)
    new_profiles = fixtures.generate_profiles(req.count, req.bias, seed_offset)
    fixtures.PROFILES.extend(new_profiles)
    return new_profiles
