import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin


class Class(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "classes"
    __table_args__ = (
        UniqueConstraint("schoolId", "name", "section", name="uq_classes_school_name_section"),
    )

    schoolId: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    section: Mapped[str | None] = mapped_column(String(50), nullable=True)
    academicYear: Mapped[str | None] = mapped_column(String(50), nullable=True)
    classTeacherId: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    isActive: Mapped[bool] = mapped_column(Boolean, insert_default=True, default=True, nullable=False)

    school = relationship("School", init=False)
    classTeacher = relationship("User", foreign_keys=[classTeacherId], init=False)


class Subject(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "subjects"
    __table_args__ = (
        UniqueConstraint("schoolId", "name", name="uq_subjects_school_name"),
    )

    schoolId: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    colorHex: Mapped[str] = mapped_column(String(10), insert_default="#7C6FFF", default="#7C6FFF", nullable=False)
    periodsPerWeek: Mapped[int] = mapped_column(Integer, insert_default=5, default=5, nullable=False)
    isActive: Mapped[bool] = mapped_column(Boolean, insert_default=True, default=True, nullable=False)

    school = relationship("School", init=False)


class TeacherSubject(Base, TimestampMixin):
    __tablename__ = "teacher_subjects"

    teacherId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    subjectId: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    isPrimary: Mapped[bool] = mapped_column(Boolean, insert_default=False, default=False, nullable=False)
    canSubstitute: Mapped[bool] = mapped_column(Boolean, insert_default=True, default=True, nullable=False)

    teacher = relationship("User", init=False)
    subject = relationship("Subject", init=False)


class PeriodDefinition(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "period_definitions"
    __table_args__ = (
        UniqueConstraint("schoolId", "periodNumber", name="uq_period_definitions_school_number"),
    )

    schoolId: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), index=True, nullable=False)
    periodNumber: Mapped[int] = mapped_column(Integer, nullable=False)
    startTime: Mapped[str] = mapped_column(String(10), nullable=False)
    endTime: Mapped[str] = mapped_column(String(10), nullable=False)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    isBreak: Mapped[bool] = mapped_column(Boolean, insert_default=False, default=False, nullable=False)
    isActive: Mapped[bool] = mapped_column(Boolean, insert_default=True, default=True, nullable=False)

    school = relationship("School", init=False)
