from typing import Any

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins import TimestampMixin, UUIDMixin


class School(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "schools"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subscriptionStatus: Mapped[str] = mapped_column(
        String(50), insert_default="trial", default="trial", nullable=False
    )
    config: Mapped[dict[str, Any]] = mapped_column(
        JSONB, insert_default=dict, default_factory=dict, nullable=False
    )
    isActive: Mapped[bool] = mapped_column(
        Boolean, insert_default=True, default=True, nullable=False
    )
    
    users = relationship("User", back_populates="school", init=False)
