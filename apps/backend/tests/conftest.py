import pytest
from httpx import AsyncClient, ASGITransport
from typing import AsyncGenerator
from fastapi import FastAPI

from app.main import create_app

pytest_plugins = [
    "tests.fixtures.database"
]

@pytest.fixture
def app() -> FastAPI:
    """Returns the FastAPI application instance."""
    return create_app()

@pytest.fixture
async def async_client(app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Provides an asynchronous test client for API testing."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client
