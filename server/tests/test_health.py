import pytest


@pytest.mark.asyncio
async def test_health_ok(client):
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "version" in data


@pytest.mark.asyncio
async def test_health_no_token_required(client):
    """Health endpoint must be publicly reachable (no auth header)."""
    res = await client.get("/health")
    assert res.status_code == 200
