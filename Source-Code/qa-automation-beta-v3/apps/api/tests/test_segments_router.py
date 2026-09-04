from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_list_segments(client):
    resp = await client.get("/segments")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 4
    ids = {s["id"] for s in body}
    assert "seg_high_ltv_customers_who" in ids


async def test_get_segment_by_id(client):
    resp = await client.get("/segments/seg_high_ltv_customers_who")
    assert resp.status_code == 200
    assert resp.json()["id"] == "seg_high_ltv_customers_who"


async def test_get_segment_unknown_returns_404(client):
    resp = await client.get("/segments/nope")
    assert resp.status_code == 404
