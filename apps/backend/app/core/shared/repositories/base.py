from typing import TypeVar, Generic, Any, Sequence
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.shared.repositories.interfaces import IRepository
from app.core.database.base import Base

T = TypeVar("T", bound=Base)

class BaseAsyncRepository(IRepository[T], Generic[T]):
    """
    Generic asynchronous SQLAlchemy repository.
    """
    
    def __init__(self, session: AsyncSession, model_class: type[T]) -> None:
        self.session = session
        self.model_class = model_class
        
    async def get_by_id(self, id: uuid.UUID) -> T | None:
        """Fetch a single entity by its primary key."""
        stmt = select(self.model_class).where(self.model_class.id == id) # type: ignore
        result = await self.session.execute(stmt)
        return result.scalars().first()
        
    async def list(self, **filters: Any) -> Sequence[T]:
        """Fetch a list of entities matching the given filters."""
        stmt = select(self.model_class).filter_by(**filters)
        result = await self.session.execute(stmt)
        return result.scalars().all()
        
    def add(self, entity: T) -> None:
        """Add a new entity to the session."""
        self.session.add(entity)
        
    def update(self, entity: T) -> None:
        """
        Update an existing entity in the session.
        With SQLAlchemy tracking, changes to the object are flushed automatically.
        This method is kept for interface completeness or manual tracking overrides.
        """
        self.session.add(entity)
        
    async def delete(self, id: uuid.UUID) -> None:
        """
        Delete an entity by its primary key.
        Note: If soft deletion is required, the specific entity repository
        should override this, or it should be handled in the service layer.
        """
        entity = await self.get_by_id(id)
        if entity:
            await self.session.delete(entity)
