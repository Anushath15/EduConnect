import uuid
from datetime import date
from typing import Any

from sqlalchemy import Boolean, Date, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin
from app.core.shared.domain.enums import BloodGroup, Gender


class Student(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("schoolId", "rollNumber", "classId", name="uq_students_school_roll_class"),
    )

    schoolId: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), index=True, nullable=False)
    classId: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    rollNumber: Mapped[str | None] = mapped_column(String(50), nullable=True)
    admissionNumber: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dateOfBirth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[Gender | None] = mapped_column(Enum(Gender, name="gender_enum"), nullable=True)
    bloodGroup: Mapped[BloodGroup | None] = mapped_column(Enum(BloodGroup, name="bloodgroup_enum"), nullable=True)
    photoUrl: Mapped[str | None] = mapped_column(String(500), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    parentName: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parentPhone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    emergencyContact: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    joinedDate: Mapped[date | None] = mapped_column(Date, nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, insert_default=True, default=True, nullable=False)

    school = relationship("School", init=False)
    studentClass = relationship("Class", foreign_keys=[classId], init=False)
