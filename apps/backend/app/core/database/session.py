from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator
import structlog
from contextlib import asynccontextmanager

from app.core.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

if settings.database_url:
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        future=True,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )
    
    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        class_=AsyncSession,
    )
else:
    # Handle the case where database_url is not set (e.g. testing without DB or initial setup)
    engine = None
    AsyncSessionLocal = None

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing a database session."""
    if AsyncSessionLocal is None:
        raise RuntimeError("Database URL is not configured.")
        
    async with AsyncSessionLocal() as session:
        yield session
