import pytest
from httpx import AsyncClient, ASGITransport

from internpilot import auth
from internpilot.main import app


@pytest.fixture(autouse=True)
def reset_auth():
    """Isolate auth state for every test."""
    auth.reset()
    yield
    auth.reset()


@pytest.fixture
async def client():
    """HTTP client wired to the FastAPI app (no network, no lifespan)."""
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=True),
        base_url="http://test",
    ) as c:
        yield c
