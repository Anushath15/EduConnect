from typing import Protocol
from sqlalchemy.ext.asyncio import AsyncSession

class IUnitOfWork(Protocol):
    """
    Abstract Unit of Work interface to define transaction boundaries.
    """
    async def __aenter__(self) -> "IUnitOfWork":
        ...
        
    async def __aexit__(self, exc_type: type[BaseException] | None, exc_val: BaseException | None, exc_tb: object | None) -> None:
        ...
        
    async def commit(self) -> None:
        ...
        
    async def rollback(self) -> None:
        ...


class SQLAlchemyUnitOfWork(IUnitOfWork):
    """
    SQLAlchemy implementation of the Unit of Work.
    Each HTTP request/handler creates its own UoW via dependency injection.
    """
    
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        # Repositories are initialized here. E.g., self.users = UserRepository(self.session)

    async def __aenter__(self) -> "SQLAlchemyUnitOfWork":
        return self

    async def __aexit__(self, exc_type: type[BaseException] | None, exc_val: BaseException | None, exc_tb: object | None) -> None:
        if exc_type is not None:
            await self.rollback()
        else:
            await self.commit()
        # The session closing is handled by the dependency injection in get_db_session

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
