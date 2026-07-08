from typing import Generic, TypeVar, Any, Protocol
import uuid

T = TypeVar("T")

class IRepository(Protocol[T]):
    """
    Abstract interface for Generic Repositories following Hexagonal Architecture.
    Responsible exclusively for persistence. Business rules do not belong here.
    """
    
    async def get_by_id(self, id: uuid.UUID) -> T | None:
        """Fetch a single entity by its primary key."""
        ...
        
    async def list(self, **filters: Any) -> list[T]:
        """Fetch a list of entities matching the given filters."""
        ...
        
    def add(self, entity: T) -> None:
        """Add a new entity to the session."""
        ...
        
    def update(self, entity: T) -> None:
        """Update an existing entity in the session."""
        ...
        
    async def delete(self, id: uuid.UUID) -> None:
        """Delete an entity by its primary key."""
        ...
