import pytest
from httpx import AsyncClient
from app.core.config import get_settings

settings = get_settings()
BASE_URL = settings.api_v1_str

@pytest.mark.anyio
async def test_health_live(async_client: AsyncClient) -> None:
    response = await async_client.get(f"{BASE_URL}/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.anyio
async def test_health_ready(async_client: AsyncClient) -> None:
    response = await async_client.get(f"{BASE_URL}/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "database" in data
    assert "redis" in data

@pytest.mark.anyio
async def test_health_startup(async_client: AsyncClient) -> None:
    response = await async_client.get(f"{BASE_URL}/health/startup")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
