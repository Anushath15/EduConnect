import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins import TimestampMixin, UUIDMixin
from app.core.shared.domain.enums import DayOfWeek, SubstitutionStatus, SwapStatus


class TimetableSlot(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "timetable_slots"
    __table_args__ = (
        UniqueConstraint("teacherId", "periodId", "dayOfWeek", "weekStartDate", name="uq_timetable_slots_teacher"),
        UniqueConstraint("classId", "periodId", "dayOfWeek", "weekStartDate", name="uq_timetable_slots_class"),
    )

    schoolId: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), index=True, nullable=False)
    teacherId: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    classId: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), index=True, nullable=False)
    subjectId: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    periodId: Mapped[uuid.UUID] = mapped_column(ForeignKey("period_definitions.id"), nullable=False)
    dayOfWeek: Mapped[DayOfWeek] = mapped_column(Enum(DayOfWeek, name="dayofweek_enum"), nullable=False)
    weekStartDate: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    room: Mapped[str | None] = mapped_column(String(100), nullable=True)
    slotType: Mapped[str] = mapped_column(String(50), insert_default="regular", default="regular", nullable=False)
    isActive: Mapped[bool] = mapped_column(Boolean, insert_default=True, default=True, nullable=False)

    school = relationship("School", init=False)
    teacher = relationship("User", foreign_keys=[teacherId], init=False)
    slotClass = relationship("Class", foreign_keys=[classId], init=False)
    subject = relationship("Subject", init=False)
    period = relationship("PeriodDefinition", init=False)


class TimetableLock(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "timetable_locks"

    schoolId: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), index=True, nullable=False)
    lockedById: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    lockedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    unlockedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    school = relationship("School", init=False)
    lockedBy = relationship("User", foreign_keys=[lockedById], init=False)


class Substitution(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "substitutions"

    schoolId: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), index=True, nullable=False)
    timetableSlotId: Mapped[uuid.UUID] = mapped_column(ForeignKey("timetable_slots.id"), nullable=False)
    absentTeacherId: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    substituteTeacherId: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    status: Mapped[SubstitutionStatus] = mapped_column(
        Enum(SubstitutionStatus, name="substitutionstatus_enum"),
        insert_default=SubstitutionStatus.PENDING,
        default=SubstitutionStatus.PENDING,
        nullable=False,
    )
    assignedById: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    requestSentAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    respondedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    declineReason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    school = relationship("School", init=False)
    timetableSlot = relationship("TimetableSlot", init=False)
    absentTeacher = relationship("User", foreign_keys=[absentTeacherId], init=False)
    substituteTeacher = relationship("User", foreign_keys=[substituteTeacherId], init=False)
    assignedBy = relationship("User", foreign_keys=[assignedById], init=False)


class SwapRequest(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "swap_requests"

    schoolId: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), index=True, nullable=False)
    requesterId: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    receiverId: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    requesterSlotId: Mapped[uuid.UUID] = mapped_column(ForeignKey("timetable_slots.id"), index=True, nullable=False)
    receiverSlotId: Mapped[uuid.UUID] = mapped_column(ForeignKey("timetable_slots.id"), index=True, nullable=False)
    status: Mapped[SwapStatus] = mapped_column(
        Enum(SwapStatus, name="swapstatus_enum"),
        insert_default=SwapStatus.PENDING,
        default=SwapStatus.PENDING,
        nullable=False,
    )
    message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    declineReason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expiresAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    respondedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    school = relationship("School", init=False)
    requester = relationship("User", foreign_keys=[requesterId], init=False)
    receiver = relationship("User", foreign_keys=[receiverId], init=False)
