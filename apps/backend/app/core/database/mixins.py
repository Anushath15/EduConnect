import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from uuid7 import uuid7


def generate_uuid7() -> uuid.UUID:
    """Generates a UUIDv7 for better database index locality."""
    return uuid7()


def utc_now() -> datetime:
    """Returns the current UTC time."""
    return datetime.now(timezone.utc)


class UUIDMixin:
    """Mixin that adds a UUIDv7 primary key column."""
    
    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        primary_key=True, 
        default=generate_uuid7,
        init=False
    )


class TimestampMixin:
    """Mixin that adds created_at and updated_at columns."""
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=utc_now,
        nullable=False,
        init=False
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
        init=False
    )


class SoftDeleteMixin:
    """
    Mixin that adds soft delete capabilities. 
    Only apply this to specific entities that require recovery or audit history (e.g., Users, Teachers).
    """
    
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, 
        default=False, 
        nullable=False,
        init=False
    )
    
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), 
        default=None, 
        nullable=True,
        init=False
    )

    def soft_delete(self) -> None:
        """Marks the entity as deleted."""
        self.is_deleted = True
        self.deleted_at = utc_now()
