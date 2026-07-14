from typing import AsyncGenerator

import structlog
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

_engine: AsyncEngine | None = None
_async_session_factory: async_sessionmaker[AsyncSession] | None = None

if settings.database_url:
    _engine = create_async_engine(
        settings.database_url,
        echo=False,
        future=True,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

    _async_session_factory = async_sessionmaker(
        bind=_engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        class_=AsyncSession,
    )


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing a database session."""
    if _async_session_factory is None:
        raise RuntimeError("Database URL is not configured.")

    async with _async_session_factory() as session:
        yield session
