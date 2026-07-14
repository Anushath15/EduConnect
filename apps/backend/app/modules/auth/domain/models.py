import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin
from app.core.shared.domain.enums import UserRole


class User(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    schoolId: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    passwordHash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="userrole_enum"), nullable=False)
    avatarUrl: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    preferredLanguage: Mapped[str] = mapped_column(
        String(10), insert_default="en", default="en", nullable=False
    )
    fcmToken: Mapped[str | None] = mapped_column(String(500), nullable=True)
    teacherConfig: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, insert_default=True, default=True, nullable=False)
    failedLoginCount: Mapped[int] = mapped_column(Integer, insert_default=0, default=0, nullable=False)
    lockedUntil: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lastLoginAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships using string references to avoid circular imports
    school = relationship("School", back_populates="users", init=False)


class RefreshToken(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "refresh_tokens"

    userId: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    tokenHash: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    expiresAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    isRevoked: Mapped[bool] = mapped_column(Boolean, insert_default=False, default=False, nullable=False)

    user = relationship("User", back_populates="refresh_tokens", init=False)
