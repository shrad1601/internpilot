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


@pytest.mark.asyncio
async def test_run_detail_keeps_field_labels_without_values(client):
    from internpilot import auth
    token = auth.pair_with_code(auth.init_pairing())
    h = {"x-ip-token": token}
    run_id = (await client.post("/runs", headers=h, json={
        "tabId": 1, "url": "https://x.test/apply", "title": "Apply"})).json()["runId"]
    snap = {"url": "https://x.test/apply", "domain": "x.test", "title": "Apply", "buttons": [],
            "fields": [{"agentId": "a", "frameId": 0, "kind": "text", "label": "Why us?",
                        "labelSources": ["label-for"], "required": True, "visible": True,
                        "disabled": False, "currentValue": "my private draft"}]}
    assert (await client.post(f"/runs/{run_id}/plan", headers=h, json={"runId": run_id, "snapshot": snap})).status_code == 200
    detail = (await client.get(f"/runs/{run_id}", headers=h)).json()
    assert detail["fields"][0]["label"] == "Why us?"
    assert "currentValue" not in detail["fields"][0]
