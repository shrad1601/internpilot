import pytest
from internpilot import auth


@pytest.mark.asyncio
async def test_pair_valid_code(client):
    code = auth.init_pairing()
    res = await client.post("/pair", json={"code": code})
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert len(data["token"]) > 20


@pytest.mark.asyncio
async def test_pair_wrong_code(client):
    code = auth.init_pairing()
    wrong = "000001" if code != "000001" else "000002"
    res = await client.post("/pair", json={"code": wrong})
    assert res.status_code == 400
    assert "detail" in res.json()


@pytest.mark.asyncio
async def test_pair_code_single_use(client):
    """The pairing code can only be used once."""
    code = auth.init_pairing()
    r1 = await client.post("/pair", json={"code": code})
    r2 = await client.post("/pair", json={"code": code})
    assert r1.status_code == 200
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_pair_no_pending_code(client):
    """Pairing with no code generated returns 400."""
    res = await client.post("/pair", json={"code": "123456"})
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_pair_expired_code(client):
    """Simulate an expired code by back-dating its timestamp."""
    auth.init_pairing()
    assert auth._pending is not None
    auth._pending.created_at -= 400  # past the 5-min TTL
    code = auth._pending.code
    res = await client.post("/pair", json={"code": code})
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_token_verified_after_pairing(client):
    code = auth.init_pairing()
    res = await client.post("/pair", json={"code": code})
    token = res.json()["token"]
    assert auth.verify_token(token)


@pytest.mark.asyncio
async def test_token_survives_restart(client):
    code = auth.init_pairing()
    token = (await client.post("/pair", json={"code": code})).json()["token"]
    assert oct(auth.TOKEN_PATH.stat().st_mode & 0o777) == "0o600"

    auth.reset()  # simulate process restart
    assert not auth.verify_token(token)
    assert auth.load_persisted_token()
    assert auth.verify_token(token)


@pytest.mark.asyncio
async def test_expired_code_issues_new_code(client):
    auth.init_pairing()
    auth._pending.created_at -= 400
    old = auth._pending.code
    res = await client.post("/pair", json={"code": old})
    assert res.status_code == 400
    assert "new code" in res.json()["detail"]
    fresh = auth.get_current_code()
    assert fresh is not None
    assert (await client.post("/pair", json={"code": fresh})).status_code == 200


@pytest.mark.asyncio
async def test_health_rejects_stale_token(client):
    res = await client.get("/health", headers={"x-ip-token": "stale"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_wrong_token_rejected():
    auth.init_pairing()
    code = auth.get_current_code()
    auth.pair_with_code(code)
    assert not auth.verify_token("totally-wrong-token")


@pytest.mark.asyncio
async def test_new_code_ready_after_pairing(client):
    first = auth.init_pairing()
    assert (await client.post("/pair", json={"code": first})).status_code == 200
    nxt = auth.get_current_code()
    assert nxt is not None
    assert (await client.post("/pair", json={"code": nxt})).status_code == 200
