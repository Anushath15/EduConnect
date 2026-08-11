import type { FastifyInstance } from "fastify"
import { z } from "zod"
import type { AttendanceStatus } from "@prisma/client"

import { db } from "../../core/database/prisma.js"
import { Errors } from "../../core/errors/AppError.js"
import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"
 
// ── Zod schemas ───────────────────────────────────────────────────────────────
 
const dateRegex = /^\d{4}-\d{2}-\d{2}$/
 
const markSchema = z.object({
  studentId: z.string().uuid(),
  date:      z.string().regex(dateRegex, "date must be YYYY-MM-DD"),
  status:    z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED", "HALF_DAY"]),
  periodId:  z.string().uuid().optional(),
  notes:     z.string().max(500).optional(),
})
 
const bulkSchema = z.object({
  classId:  z.string().uuid(),
  date:     z.string().regex(dateRegex, "date must be YYYY-MM-DD"),
  periodId: z.string().uuid().optional(),
  records:  z.array(z.object({
    studentId: z.string().uuid(),
    status:    z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED", "HALF_DAY"]),
    notes:     z.string().max(500).optional(),
  })).min(1).max(200),
})
 
const summaryQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year:  z.coerce.number().int().min(2020).max(2100).optional(),
})
 
// ── Helper ────────────────────────────────────────────────────────────────────
 
/**
 * Upsert attendance without relying on the composite unique key.
 *
 * Prisma's generated TypeScript for @@unique([studentId, date, periodId])
 * types periodId as `string` (not `string | null`) in the where input,
 * so db.attendance.upsert({ where: { studentId_date_periodId: { ..., periodId: null } } })
 * fails the type-checker even though the SQL would work fine.
 *
 * Solution: findFirst (which accepts null in where) then update-by-id or create.
 */
async function upsertAttendance(
  client: typeof db,
  payload: {
    schoolId:  string
    studentId: string
    classId:   string
    date:      Date
    periodId:  string | null
    status:    AttendanceStatus
    notes:     string | null
    markedById:string
  }
) {
  const existing = await client.attendance.findFirst({
    where: {
      studentId: payload.studentId,
      date:      payload.date,
      periodId:  payload.periodId,
    },
  })
  if (existing) {
    return client.attendance.update({
      where: { id: existing.id },
      data:  { status: payload.status, notes: payload.notes, markedById: payload.markedById },
    })
  }
  return client.attendance.create({ data: payload })
}
 
// ── Routes ────────────────────────────────────────────────────────────────────
 
export async function attendanceRoutes(fastify: FastifyInstance) {
 
  /** Mark attendance for a single student. */
  fastify.post("/v1/attendance", {
    preHandler: [authenticateWithTenant, requirePermission("attendance:mark")],
  }, async (request, reply) => {
    const parsed = markSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    const { studentId, date, status, periodId, notes } = parsed.data
    const { schoolId, userId } = request.user
 
    const student = await db.student.findFirst({
      where: { id: studentId, schoolId, isActive: true },
    })
    if (!student) throw Errors.NOT_FOUND("Student")
 
    const record = await upsertAttendance(db, {
      schoolId,
      studentId,
      classId:   student.classId,
      date:      new Date(date),
      periodId:  periodId ?? null,
      status:    status as AttendanceStatus,
      notes:     notes ?? null,
      markedById: userId,
    })
    return reply.status(201).send({ success: true, data: record })
  })
 
  /** Mark attendance for an entire class — atomic: all succeed or none. */
  fastify.post("/v1/attendance/bulk", {
    preHandler: [authenticateWithTenant, requirePermission("attendance:mark")],
  }, async (request, reply) => {
    const parsed = bulkSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    const { classId, date, periodId, records } = parsed.data
    const { schoolId, userId } = request.user
 
    const cls = await db.class.findFirst({ where: { id: classId, schoolId } })
    if (!cls) throw Errors.NOT_FOUND("Class")
 
    const parsedDate  = new Date(date)
    const resolvedPid = periodId ?? null
 
    const results = await db.$transaction(async (tx) => {
      return Promise.all(
        records.map((r) =>
          upsertAttendance(tx as unknown as typeof db, {
            schoolId,
            studentId: r.studentId,
            classId,
            date:      parsedDate,
            periodId:  resolvedPid,
            status:    r.status as AttendanceStatus,
            notes:     r.notes ?? null,
            markedById: userId,
          })
        )
      )
    })
    return reply.status(201).send({
      success: true,
      data:    { marked: results.length, date, classId },
    })
  })
 
  /** Get all attendance records for a class on a date. */
  fastify.get("/v1/attendance/class/:classId", {
    preHandler: [authenticateWithTenant, requirePermission("attendance:view")],
  }, async (request, reply) => {
    const { classId }  = request.params as { classId: string }
    const query        = request.query   as { date?: string; periodId?: string }
    const { schoolId } = request.user
 
    const cls = await db.class.findFirst({ where: { id: classId, schoolId } })
    if (!cls) throw Errors.NOT_FOUND("Class")
 
    const where: any = { classId, schoolId }
    if (query.date)     where.date     = new Date(query.date)
    if (query.periodId) where.periodId = query.periodId
 
    const attendance = await db.attendance.findMany({
      where,
      include: {
        student:  { select: { id: true, name: true, rollNumber: true } },
        markedBy: { select: { id: true, name: true } },
        period:   { select: { periodNumber: true, label: true } },
      },
      orderBy: { student: { name: "asc" } },
    })
    return reply.send({ success: true, data: attendance })
  })
 
  /** Monthly attendance summary for one student. */
  fastify.get("/v1/attendance/student/:studentId/summary", {
    preHandler: [authenticateWithTenant, requirePermission("attendance:view")],
  }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string }
    const qParsed = summaryQuerySchema.safeParse(request.query)
    if (!qParsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: qParsed.error.errors[0].message },
      })
    }
    const { schoolId } = request.user
 
    const student = await db.student.findFirst({ where: { id: studentId, schoolId, isActive: true } })
    if (!student) throw Errors.NOT_FOUND("Student")
 
    const now   = new Date()
    const month = qParsed.data.month ?? now.getMonth() + 1
    const year  = qParsed.data.year  ?? now.getFullYear()
 
    const records = await db.attendance.findMany({
      where: {
        studentId,
        schoolId,
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0),
        },
      },
    })
 
    const present = records.filter((r) => r.status === "PRESENT").length
    return reply.send({
      success: true,
      data: {
        month,
        year,
        total:          records.length,
        present,
        absent:         records.filter((r) => r.status === "ABSENT").length,
        late:           records.filter((r) => r.status === "LATE").length,
        excused:        records.filter((r) => r.status === "EXCUSED").length,
        halfDay:        records.filter((r) => r.status === "HALF_DAY").length,
        attendanceRate: records.length > 0
          ? Math.round((present / records.length) * 1000) / 10
          : 0,
      },
    })
  })
}