import type { DayOfWeek } from "@prisma/client"

import { db } from "../../core/database/prisma.js"
import { AppError } from "../../core/errors/AppError.js"

import { TimetableGenerator } from "./engine/generator.js"
import type { TimetableConstraints } from "./engine/types.js"

// Default teacher workload values (applied when isOverrideActive is false or config is missing)
const DEFAULT_MAX_PERIODS_PER_WEEK   = 40
const DEFAULT_MAX_PERIODS_PER_DAY    = 8
const DEFAULT_MAX_CONSECUTIVE        = 3
const DEFAULT_PREFERRED_DAYS_OFF: string[] = []

interface TeacherConfig {
  isOverrideActive?:    boolean
  maxPeriodsPerWeek?:   number
  maxPeriodsPerDay?:    number
  maxConsecutivePeriods?: number
  preferredDaysOff?:    string[]
}

export class TimetableService {

  async generate(schoolId: string, weekStartDate: Date) {
    // Reject if a lock is active for this school.
    const activeLock = await db.timetableLock.findFirst({
      where: { schoolId, unlockedAt: null },
    })
    if (activeLock) {
      throw new AppError("TIMETABLE_LOCKED", "Timetable is currently locked", 400)
    }

    // Load all constraint data in parallel — avoids N sequential round trips.
    const [teachers, classes, subjects, periods, teacherSubjects, school] = await Promise.all([
      db.user.findMany({
        where: {
          schoolId,
          isActive: true,
          role: { in: ["CLASS_TEACHER","SUBJECT_TEACHER","TEMP_TEACHER","COORDINATOR","VICE_PRINCIPAL"] },
        },
        select: { id: true, name: true, teacherConfig: true },
      }),
      db.class.findMany({
        where:  { schoolId, isActive: true },
        select: { id: true, name: true, section: true },
      }),
      db.subject.findMany({
        where:  { schoolId, isActive: true },
        select: { id: true, name: true, code: true, periodsPerWeek: true },
      }),
      db.periodDefinition.findMany({
        where:   { schoolId },
        select:  { id: true, periodNumber: true, isBreak: true },
        orderBy: { periodNumber: "asc" },
      }),
      db.teacherSubject.findMany({
        where:  { teacher: { schoolId } },
        select: { teacherId: true, subjectId: true },
      }),
      db.school.findUnique({
        where:  { id: schoolId },
        select: { config: true },
      }),
    ])

    // Build teacherId → subjectId[] map for the generator.
    const teacherSubjectMap = new Map<string, string[]>()
    for (const { teacherId, subjectId } of teacherSubjects) {
      if (!teacherSubjectMap.has(teacherId)) teacherSubjectMap.set(teacherId, [])
      teacherSubjectMap.get(teacherId)!.push(subjectId)
    }

    if (teacherSubjectMap.size === 0) {
      throw new AppError(
        "NO_ASSIGNMENTS",
        "No teacher-subject assignments found. Assign subjects to teachers first.",
        400
      )
    }

    // Derive working days from school config, defaulting to Mon-Sat
    const schoolConfig = school?.config as { workingDays?: string[] } | null
    const workingDays  = schoolConfig?.workingDays ?? ["MON","TUE","WED","THU","FRI","SAT"]

    // Parse teacherConfig JSON for each teacher; apply defaults if override not active
    const constraints: TimetableConstraints = {
      teachers: teachers.map((t) => {
        const cfg = (t.teacherConfig ?? {}) as TeacherConfig
        const useOverride = cfg.isOverrideActive === true
        return {
          id:                   t.id,
          name:                 t.name,
          subjectIds:           teacherSubjectMap.get(t.id) ?? [],
          maxPeriodsPerWeek:    useOverride ? (cfg.maxPeriodsPerWeek   ?? DEFAULT_MAX_PERIODS_PER_WEEK) : DEFAULT_MAX_PERIODS_PER_WEEK,
          maxPeriodsPerDay:     useOverride ? (cfg.maxPeriodsPerDay     ?? DEFAULT_MAX_PERIODS_PER_DAY)  : DEFAULT_MAX_PERIODS_PER_DAY,
          maxConsecutivePeriods:useOverride ? (cfg.maxConsecutivePeriods ?? DEFAULT_MAX_CONSECUTIVE)     : DEFAULT_MAX_CONSECUTIVE,
          preferredDaysOff:     useOverride ? (cfg.preferredDaysOff     ?? DEFAULT_PREFERRED_DAYS_OFF)   : DEFAULT_PREFERRED_DAYS_OFF,
        }
      }),
      classes: classes.map(c => ({ ...c, section: c.section ?? "" })),
      subjects: subjects.map(s => ({ ...s, code: s.code ?? "" })),
      periods,
      workingDays,
      teacherSubjectMap,
    }

    const result = new TimetableGenerator(constraints).generate()


    if (result.slots.length === 0) {
      throw new AppError(
        "GENERATION_FAILED",
        "Could not generate a valid timetable. Check teacher-subject assignments.",
        400
      )
    }

    /**
     * Fixed C-003: deleteMany and createMany are now wrapped in a single
     * database transaction.
     *
     * Previously these were two separate Prisma calls. If createMany failed
     * for ANY reason after deleteMany succeeded (unique constraint violation,
     * DB timeout, network error, process crash), the school's entire timetable
     * for the week was permanently lost with no recovery path.
     *
     * With $transaction, PostgreSQL treats both as one atomic operation:
     * if createMany throws, PostgreSQL automatically rolls back deleteMany
     * and the original timetable is preserved.
     */
    await db.$transaction(async (tx) => {
      await tx.timetableSlot.deleteMany({ where: { schoolId, weekStartDate } })

      await tx.timetableSlot.createMany({
        data: result.slots.map((slot) => ({
          schoolId,
          classId:      slot.classId,
          subjectId:    slot.subjectId,
          teacherId:    slot.teacherId,
          periodId:     slot.periodId,
          dayOfWeek:    slot.day as DayOfWeek,   // was 'as any' — now properly typed
          weekStartDate,
        })),
      })
    })

    return {
      generated:     result.slots.length,
      conflicts:     result.conflicts,
      conflictCount: result.conflicts.length,
      durationMs:    result.stats.durationMs,
      success:       result.success,
    }
  }

  async getWeekTimetable(schoolId: string, weekStartDate: Date) {
    return db.timetableSlot.findMany({
      where:   { schoolId, weekStartDate },
      include: {
        class:   { select: { name: true, section: true } },
        subject: { select: { name: true, code: true, colorHex: true } },
        teacher: { select: { id: true, name: true } },
        period:  { select: { periodNumber: true, startTime: true, endTime: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
    })
  }

  async assignSubjectToTeacher(schoolId: string, teacherId: string, subjectId: string) {
    const [teacher, subject] = await Promise.all([
      db.user.findFirst({ where: { id: teacherId, schoolId, isActive: true } }),
      db.subject.findFirst({ where: { id: subjectId, schoolId, isActive: true } }),
    ])
    if (!teacher) throw new AppError("INVALID_TEACHER", "Teacher not found in this school", 400)
    if (!subject) throw new AppError("INVALID_SUBJECT", "Subject not found in this school", 400)

    return db.teacherSubject.upsert({
      where:  { teacherId_subjectId: { teacherId, subjectId } },
      create: { teacherId, subjectId },
      update: {},
    })
  }

  async getTeacherAssignments(schoolId: string) {
    return db.teacherSubject.findMany({
      where:   { teacher: { schoolId } },
      include: {
        teacher: { select: { name: true, role: true } },
        subject: { select: { name: true, code: true } },
      },
    })
  }
}

export const timetableService = new TimetableService()