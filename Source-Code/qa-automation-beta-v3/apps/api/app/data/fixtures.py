"""In-memory fixture data for starter profiles and profile generation."""

from __future__ import annotations

import random
from typing import cast

from app.models import (
    Bias,
    Profile,
    ProfileTag,
)


PROFILES: list[Profile] = [
    Profile(id="p_00412", name="Lina Brandt",    region="DE", age=34, consent=True,  fcap=1, lastSend="12d", segment="dormant_30d", tag="control"),
    Profile(id="p_00413", name="Marc Dupont",    region="FR", age=29, consent=True,  fcap=2, lastSend="31d", segment="dormant_30d", tag="test"),
    Profile(id="p_00414", name="Sofia Romano",   region="IT", age=41, consent=False, fcap=0, lastSend="—",   segment="dormant_30d", tag="suppressed"),
    Profile(id="p_00415", name="Jens Vermeer",   region="NL", age=52, consent=True,  fcap=3, lastSend="2d",  segment="dormant_30d", tag="fcap-risk"),
    Profile(id="p_00416", name="Paula Iglesias", region="ES", age=22, consent=True,  fcap=0, lastSend="—",   segment="dormant_30d", tag="test"),
    Profile(id="p_00417", name="Tomáš Novák",    region="DE", age=38, consent=True,  fcap=1, lastSend="9d",  segment="dormant_30d", tag="test"),
]


_FIRST = ["Lina", "Marc", "Sofia", "Jens", "Paula", "Tomáš", "Anouk", "Pierre", "Greta", "Henrik", "Mira", "Bence", "Aiko", "Noor", "Elif", "Kai"]
_LAST = ["Brandt", "Dupont", "Romano", "Vermeer", "Iglesias", "Novák", "De Vries", "Müller", "Costa", "Lindgren", "Petrova", "Bauer"]
_REGIONS = ["DE", "FR", "NL", "ES", "IT"]


def _tag_for(consent: bool, fcap: int) -> ProfileTag:
    if not consent:
        return "suppressed"
    if fcap >= 3:
        return "fcap-risk"
    # Eligible profiles split into test / control / holdout cohorts.
    r = random.random()
    if r < 0.08:
        return cast(ProfileTag, "holdout")
    if r < 0.18:
        return cast(ProfileTag, "control")
    return cast(ProfileTag, "test")


def generate_profiles(count: int, bias: Bias, seed_offset: int) -> list[Profile]:
    """Generate `count` synthetic profiles. Deterministic per seed_offset."""
    rng = random.Random(0xA11CE ^ seed_offset)
    out: list[Profile] = []
    for i in range(count):
        name = f"{rng.choice(_FIRST)} {rng.choice(_LAST)}"
        region = rng.choice(_REGIONS)
        pid = "p_" + str(50000 + seed_offset + i + rng.randint(0, 9000))[:5]
        fcap = rng.randint(0, 3)
        consent = rng.random() > 0.12

        if bias == "edge":
            if rng.random() < 0.4:
                fcap = 3
            if rng.random() < 0.2:
                consent = False
        elif bias == "compliant":
            consent = True
            fcap = min(fcap, 2)

        out.append(
            Profile(
                id=pid,
                name=name,
                region=region,
                age=18 + rng.randint(0, 47),
                consent=consent,
                fcap=fcap,
                lastSend=f"{rng.randint(0, 39)}d",
                segment="dormant_30d",
                tag=_tag_for(consent, fcap),
            )
        )
    return out
