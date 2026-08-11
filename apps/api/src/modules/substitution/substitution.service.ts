import { db } from "../../core/database/prisma.js"
import { AppError, Errors } from "../../core/errors/AppError.js"

export class SubstitutionService {
  async findAvailableTeachers(schoolId: string, date: Date, periodId: string) {
    const dayOfWeek = this.getDayOfWeek(date)
    const weekStart = this.getWeekStart(date)

    const allTeachers = await db.user.findMany({
      where: {
        schoolId,
        isActive: true,
        role: { in: ["CLASS_TEACHER","SUBJECT_TEACHER","TEMP_TEACHER","COORDINATOR","VICE_PRINCIPAL"] },
      },
      select: { id: true, name: true, role: true },
    })

    const busySlots = await db.timetableSlot.findMany({
      where: { schoolId, periodId, dayOfWeek: dayOfWeek as any, weekStartDate: weekStart },
      select: { teacherId: true },
    })

    const busyIds = new Set(busySlots.map(s => s.teacherId))
    const available = allTeachers.filter(t => !busyIds.has(t.id))

    const counts = await db.timetableSlot.groupBy({
      by: ["teacherId"],
      where: { teacherId: { in: available.map(t => t.id) }, weekStartDate: weekStart },
      _count: { id: true },
    })
    const countMap = new Map(counts.map(c => [c.teacherId, c._count.id]))

    return available
      .map(t => ({ ...t, periodCount: countMap.get(t.id) ?? 0 }))
      .sort((a, b) => a.periodCount - b.periodCount)
  }

  async markAbsent(
    schoolId: string,
    absentTeacherId: string,
    date: Date,
    slotIds: string[],
    assignedById: string
  ) {
    const activeLock = await db.timetableLock.findFirst({
      where: { schoolId, unlockedAt: null },
    })
    if (activeLock) throw Errors.TIMETABLE_LOCKED()

    // Atomic: verify all slots AND insert all substitution rows inside one
    // transaction. If any slot fails the ownership check, no rows are inserted.
    // If any insert fails, the transaction rolls back.
    return db.$transaction(async (tx) => {
      const validSlots = await tx.timetableSlot.findMany({
        where: { id: { in: slotIds }, schoolId, teacherId: absentTeacherId },
        select: { id: true },
      })
      const validSlotIds = new Set(validSlots.map(s => s.id))
      const invalid = slotIds.filter(id => !validSlotIds.has(id))
      if (invalid.length > 0) {
        throw new AppError(
          "INVALID_SLOT",
          "One or more selected periods do not belong to this teacher in this school.",
          400
        )
      }

      // Re-check inside the transaction to avoid the race where a second
      // mark-absent call for the same slots passes the validation check
      // before the first one inserts. There is no DB-level unique constraint
      // on (timetableSlotId, date), so we enforce it here.
      const existing = await tx.substitution.findMany({
        where: { timetableSlotId: { in: slotIds }, date, status: { in: ["PENDING", "REQUESTED", "ACCEPTED"] } },
        select: { timetableSlotId: true },
      })
      const alreadyMarked = new Set(existing.map(s => s.timetableSlotId))
      const fresh = slotIds.filter(id => !alreadyMarked.has(id))
      if (fresh.length === 0) {
        throw new AppError(
          "ALREADY_MARKED",
          "All selected periods already have pending substitution requests.",
          409
        )
      }

      return Promise.all(
        fresh.map(slotId =>
          tx.substitution.create({
            data: {
              school:        { connect: { id: schoolId } },
              timetableSlot: { connect: { id: slotId } },
              absentTeacher: { connect: { id: absentTeacherId } },
              assignedBy:    { connect: { id: assignedById } },
              date,
              status: "PENDING",
            },
          })
        )
      )
    })
  }

  async assignSubstitute(
    substitutionId: string,
    substituteTeacherId: string,
    schoolId: string
  ) {
    const sub = await db.substitution.findUnique({ where: { id: substitutionId } })
    if (!sub) throw Errors.NOT_FOUND("Substitution")
    if (sub.schoolId !== schoolId) throw Errors.FORBIDDEN()
    if (sub.status !== "PENDING") {
      throw new AppError("ALREADY_ASSIGNED", "Substitution already assigned", 400)
    }

    const substitute = await db.user.findFirst({
      where: { id: substituteTeacherId, schoolId, isActive: true },
    })
    if (!substitute) {
      throw new AppError("INVALID_TEACHER", "substituteTeacherId is not an active teacher in this school", 400)
    }

    return db.substitution.update({
      where: { id: substitutionId },
      data: {
        substituteTeacher: { connect: { id: substituteTeacherId } },
        status: "REQUESTED",
        requestSentAt: new Date(),
      },
    })
  }

  async respond(
    substitutionId: string,
    userId: string,
    action: "accept" | "decline",
    schoolId: string
  ) {
    const sub = await db.substitution.findUnique({
      where: { id: substitutionId },
      include: { timetableSlot: true },
    })
    if (!sub) throw Errors.NOT_FOUND("Substitution")
    if (sub.schoolId !== schoolId) throw Errors.FORBIDDEN()
    if (sub.substituteTeacherId !== userId) throw Errors.FORBIDDEN()
    if (sub.status !== "REQUESTED") {
      throw new AppError("INVALID_STATUS", "Substitution is not in REQUESTED state", 400)
    }

    if (action === "accept") {
      try {
        await db.$transaction([
          db.substitution.update({
            where: { id: substitutionId },
            data: { status: "ACCEPTED", respondedAt: new Date() },
          }),
          db.timetableSlot.create({
            data: {
              school:        { connect: { id: sub.schoolId } },
              teacher:       { connect: { id: userId } },
              class:         { connect: { id: sub.timetableSlot.classId } },
              subject:       { connect: { id: sub.timetableSlot.subjectId } },
              period:        { connect: { id: sub.timetableSlot.periodId } },
              dayOfWeek:     sub.timetableSlot.dayOfWeek,
              weekStartDate: sub.timetableSlot.weekStartDate,
            },
          }),
        ])
      } catch (err: any) {
        if (err.code === "P2002") {
          throw new AppError("SCHEDULE_CONFLICT", "You already have a class scheduled at this time.", 409)
        }
        throw err
      }
    } else {
      await db.substitution.update({
        where: { id: substitutionId },
        data: { status: "DECLINED", respondedAt: new Date() },
      })
    }
  }

  async getHistory(schoolId: string, page: number, limit: number) {
    const [data, total] = await Promise.all([
      db.substitution.findMany({
        where: { schoolId },
        include: {
          absentTeacher:     { select: { name: true } },
          substituteTeacher: { select: { name: true } },
          timetableSlot: {
            include: {
              subject: { select: { name: true, code: true } },
              period:  { select: { periodNumber: true, startTime: true, endTime: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      db.substitution.count({ where: { schoolId } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  private getDayOfWeek(date: Date): string {
    return ["SUN","MON","TUE","WED","THU","FRI","SAT"][date.getDay()]
  }

  private getWeekStart(date: Date): Date {
    const d   = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }
}

export const substitutionService = new SubstitutionService()
