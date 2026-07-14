import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, MappedAsDataclass, mapped_column
from uuid_extensions import uuid7  # type: ignore[import-untyped]


def generate_uuid7() -> uuid.UUID:
    """Generates a UUIDv7 for better database index locality."""
    return uuid.UUID(str(uuid7()))


def utc_now() -> datetime:
    """Returns the current UTC time."""
    return datetime.now(timezone.utc)


class UUIDMixin(MappedAsDataclass):
    """
    Mixin that adds a UUIDv7 primary key column.
    Inherits MappedAsDataclass so SQLAlchemy handles it correctly.
    """

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        insert_default=generate_uuid7,
        default_factory=generate_uuid7,
        init=False,
    )


class TimestampMixin(MappedAsDataclass):
    """
    Mixin that adds UTC-aware created_at and updated_at columns.
    Inherits MappedAsDataclass so SQLAlchemy handles it correctly.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        insert_default=utc_now,
        default_factory=utc_now,
        nullable=False,
        init=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        insert_default=utc_now,
        onupdate=utc_now,
        default_factory=utc_now,
        nullable=False,
        init=False,
    )


class SoftDeleteMixin(MappedAsDataclass):
    """
    Mixin that adds soft delete capabilities.
    Only apply to entities where recovery or audit history has value.
    Entities: Users, Students, Teachers, Classes, Subjects, Resources, Announcements.
    NOT for: junction tables, audit logs, event tables, cache tables.
    """

    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        insert_default=False,
        default=False,
        nullable=False,
        init=False,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        insert_default=None,
        default=None,
        nullable=True,
        init=False,
    )

    def soft_delete(self) -> None:
        """Marks the entity as logically deleted."""
        self.is_deleted = True
        self.deleted_at = utc_now()
