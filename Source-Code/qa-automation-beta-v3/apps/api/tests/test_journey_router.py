from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_list_journeys_returns_curated_set(client):
    resp = await client.get("/journeys")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 6
    # Each summary must have id + name to power the dropdown.
    assert all("id" in j and "name" in j for j in body)


async def test_get_journey_returns_rich_shape(client):
    resp = await client.get("/journey?id=season-ticket-renewal-journey")
    assert resp.status_code == 200
    j = resp.json()
    assert j["useCaseId"] == "season-ticket-renewal-journey"
    assert "entryCriteria" in j and "touchpoints" in j and "journey" in j


async def test_get_journey_unknown_returns_404(client):
    resp = await client.get("/journey?id=nope")
    assert resp.status_code == 404
