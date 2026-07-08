import {
  TimetableConstraints,
  TeacherData,
  SlotAssignment,
  Conflict,
  GenerationResult,
} from "./types.js"

interface Requirement {
  classId: string
  subjectId: string
  count: number
  eligibleTeachers: string[]
}

export class TimetableGenerator {
  private assignments: SlotAssignment[] = []
  private teacherBusy        = new Map<string, Set<string>>()   // teacherId -> Set<"day-periodId">
  private classBusy          = new Map<string, Set<string>>()   // classId   -> Set<"day-periodId">
  private teacherPeriodCount = new Map<string, number>()         // teacherId -> total periods this week
  private teacherDayCount    = new Map<string, Map<string, number>>() // teacherId -> day -> count

  constructor(private readonly constraints: TimetableConstraints) {}

  generate(): GenerationResult {
    const start = Date.now()

    const requirements = this.buildRequirements()
    // Schedule hardest-to-assign first (fewest eligible teachers)
    requirements.sort((a, b) => a.eligibleTeachers.length - b.eligibleTeachers.length)

    for (const req of requirements) {
      let placed   = 0
      let attempts = 0
      const maxAttempts = req.count * 30 // higher ceiling for constraint-rich solving

      while (placed < req.count && attempts < maxAttempts) {
        const slot = this.findBestSlot(req)
        if (slot) {
          this.applyAssignment(slot)
          placed++
        }
        attempts++
      }
    }

    const conflicts = this.detectConflicts()

    return {
      success: conflicts.length === 0,
      slots:   this.assignments,
      conflicts,
      stats: {
        generated:     this.assignments.length,
        conflictCount: conflicts.length,
        durationMs:    Date.now() - start,
      },
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildRequirements(): Requirement[] {
    const reqs: Requirement[] = []

    for (const cls of this.constraints.classes) {
      for (const subject of this.constraints.subjects) {
        if (subject.periodsPerWeek === 0) continue

        const eligible = this.constraints.teachers
          .filter(t => this.constraints.teacherSubjectMap.get(t.id)?.includes(subject.id))
          .map(t => t.id)

        if (eligible.length === 0) continue

        reqs.push({
          classId:          cls.id,
          subjectId:        subject.id,
          count:            subject.periodsPerWeek,
          eligibleTeachers: eligible,
        })
      }
    }

    return reqs
  }

  private getTeacherById(id: string): TeacherData | undefined {
    return this.constraints.teachers.find(t => t.id === id)
  }

  /**
   * Returns the count of consecutive periods a teacher has on a given day,
   * ending at the slot immediately BEFORE `beforePeriodNumber`.
   * Used to predict whether adding a new period would violate maxConsecutivePeriods.
   */
  private consecutiveCountBefore(teacherId: string, day: string, beforePeriodNumber: number): number {
    const activePeriods = this.constraints.periods.filter(p => !p.isBreak)
    // Find periods just before the target, in descending order
    const sorted = [...activePeriods]
      .filter(p => p.periodNumber < beforePeriodNumber)
      .sort((a, b) => b.periodNumber - a.periodNumber)

    let consecutive = 0
    let expectedNext = beforePeriodNumber - 1

    for (const p of sorted) {
      if (p.periodNumber !== expectedNext) break
      const slotKey = day + "-" + p.id
      if (this.teacherBusy.get(teacherId)?.has(slotKey)) {
        consecutive++
        expectedNext--
      } else {
        break
      }
    }

    return consecutive
  }

  private findBestSlot(req: Requirement): SlotAssignment | null {
    const days    = this.constraints.workingDays
    const periods = this.constraints.periods.filter(p => !p.isBreak)

    // Randomise day order to spread load evenly
    const shuffledDays = [...days].sort(() => Math.random() - 0.5)

    for (const day of shuffledDays) {
      for (const period of periods) {
        const slotKey = day + "-" + period.id

        // Skip if the class is already occupied at this slot
        if (this.classBusy.get(req.classId)?.has(slotKey)) continue

        // Sort teachers by ascending weekly load so we balance workloads
        const sortedTeachers = [...req.eligibleTeachers].sort((a, b) =>
          (this.teacherPeriodCount.get(a) ?? 0) - (this.teacherPeriodCount.get(b) ?? 0)
        )

        for (const teacherId of sortedTeachers) {
          // Already teaching somewhere else this slot?
          if (this.teacherBusy.get(teacherId)?.has(slotKey)) continue

          const teacher = this.getTeacherById(teacherId)
          if (!teacher) continue

          // ── Constraint 1: preferred days off ─────────────────────────────
          if (teacher.preferredDaysOff.includes(day)) continue

          // ── Constraint 2: weekly period cap ──────────────────────────────
          const weeklyCount = this.teacherPeriodCount.get(teacherId) ?? 0
          if (weeklyCount >= teacher.maxPeriodsPerWeek) continue

          // ── Constraint 3: daily period cap ───────────────────────────────
          const dayCount = this.teacherDayCount.get(teacherId)?.get(day) ?? 0
          if (dayCount >= teacher.maxPeriodsPerDay) continue

          // ── Constraint 4: consecutive period limit ────────────────────────
          const consecutive = this.consecutiveCountBefore(teacherId, day, period.periodNumber)
          if (consecutive >= teacher.maxConsecutivePeriods) continue

          // All constraints satisfied — use this slot
          return {
            teacherId,
            classId:   req.classId,
            subjectId: req.subjectId,
            periodId:  period.id,
            day,
          }
        }
      }
    }

    return null
  }

  private applyAssignment(slot: SlotAssignment): void {
    const key = slot.day + "-" + slot.periodId

    // Initialise busy sets
    if (!this.teacherBusy.has(slot.teacherId)) this.teacherBusy.set(slot.teacherId, new Set())
    if (!this.classBusy.has(slot.classId))     this.classBusy.set(slot.classId, new Set())

    this.teacherBusy.get(slot.teacherId)!.add(key)
    this.classBusy.get(slot.classId)!.add(key)

    // Update weekly count
    this.teacherPeriodCount.set(
      slot.teacherId,
      (this.teacherPeriodCount.get(slot.teacherId) ?? 0) + 1
    )

    // Update daily count
    if (!this.teacherDayCount.has(slot.teacherId)) {
      this.teacherDayCount.set(slot.teacherId, new Map())
    }
    const dayMap = this.teacherDayCount.get(slot.teacherId)!
    dayMap.set(slot.day, (dayMap.get(slot.day) ?? 0) + 1)

    this.assignments.push(slot)
  }

  private detectConflicts(): Conflict[] {
    const conflicts: Conflict[] = []
    const seen = new Map<string, string>()

    for (const slot of this.assignments) {
      // Teacher double-booking
      const teacherKey = "t-" + slot.teacherId + "-" + slot.day + "-" + slot.periodId
      if (seen.has(teacherKey)) {
        conflicts.push({
          type:        "TEACHER_DOUBLE_BOOKING",
          message:     "Teacher " + slot.teacherId + " double-booked on " + slot.day,
          affectedIds: [slot.teacherId],
        })
      } else {
        seen.set(teacherKey, slot.teacherId)
      }

      // Class double-booking
      const classKey = "c-" + slot.classId + "-" + slot.day + "-" + slot.periodId
      if (seen.has(classKey)) {
        conflicts.push({
          type:        "CLASS_DOUBLE_BOOKING",
          message:     "Class " + slot.classId + " double-booked on " + slot.day,
          affectedIds: [slot.classId],
        })
      } else {
        seen.set(classKey, slot.classId)
      }
    }

    // Per-teacher workload check (uses each teacher's configured cap)
    for (const [teacherId, count] of this.teacherPeriodCount) {
      const teacher = this.getTeacherById(teacherId)
      const cap     = teacher?.maxPeriodsPerWeek ?? 40
      if (count > cap) {
        conflicts.push({
          type:        "WORKLOAD_EXCEEDED",
          message:     `Teacher ${teacherId} has ${count} periods, exceeding cap of ${cap}`,
          affectedIds: [teacherId],
        })
      }
    }

    return conflicts
  }
}
