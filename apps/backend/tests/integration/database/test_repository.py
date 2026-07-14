import pytest
from sqlalchemy import String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database.base import Base
from app.core.database.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin
from app.core.shared.repositories.base import BaseAsyncRepository


# Dummy model for testing the repository
class DummyEntity(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "dummy_entities"

    name: Mapped[str] = mapped_column(String(50), nullable=False)


class DummyRepository(BaseAsyncRepository[DummyEntity]):
    pass


@pytest.mark.anyio
async def test_repository_add_and_get(db_session: AsyncSession) -> None:
    repo = DummyRepository(db_session, DummyEntity)

    # Create
    entity = DummyEntity(name="Test Entity")
    repo.add(entity)
    await db_session.flush()

    # Read
    fetched = await repo.get_by_id(entity.id)
    assert fetched is not None
    assert fetched.name == "Test Entity"
    assert fetched.id == entity.id


@pytest.mark.anyio
async def test_repository_list(db_session: AsyncSession) -> None:
    repo = DummyRepository(db_session, DummyEntity)

    repo.add(DummyEntity(name="Entity A"))
    repo.add(DummyEntity(name="Entity B"))
    await db_session.flush()

    results = await repo.list()
    assert len(results) >= 2

    results_filtered = await repo.list(name="Entity A")
    assert len(results_filtered) == 1
    assert results_filtered[0].name == "Entity A"


@pytest.mark.anyio
async def test_repository_soft_delete(db_session: AsyncSession) -> None:
    repo = DummyRepository(db_session, DummyEntity)
    entity = DummyEntity(name="To Delete")
    repo.add(entity)
    await db_session.flush()

    entity.soft_delete()
    await db_session.flush()

    fetched = await repo.get_by_id(entity.id)
    assert fetched is not None
    assert fetched.is_deleted is True
    assert fetched.deleted_at is not None


@pytest.mark.anyio
async def test_repository_delete(db_session: AsyncSession) -> None:
    repo = DummyRepository(db_session, DummyEntity)
    entity = DummyEntity(name="To Hard Delete")
    repo.add(entity)
    await db_session.flush()

    await repo.delete(entity.id)
    await db_session.flush()

    fetched = await repo.get_by_id(entity.id)
    assert fetched is None
