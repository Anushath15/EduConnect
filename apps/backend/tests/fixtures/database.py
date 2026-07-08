import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator
import uuid
import os

from app.core.database.base import Base
from app.core.config import get_settings

settings = get_settings()

# Use a specific test database if provided, else construct one
TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL", 
    "sqlite+aiosqlite:///:memory:"  # fallback for isolated tests if PG not available
)

@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"

@pytest.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        
    await engine.dispose()

@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Returns an async session for testing, scoped to a transaction 
    that is rolled back after each test.
    """
    connection = await test_engine.connect()
    transaction = await connection.begin()
    
    AsyncSessionLocal = async_sessionmaker(
        bind=connection, 
        expire_on_commit=False,
        class_=AsyncSession,
        join_transaction_mode="create_savepoint"
    )
    
    session = AsyncSessionLocal()
    yield session
    
    await session.close()
    await transaction.rollback()
    await connection.close()
