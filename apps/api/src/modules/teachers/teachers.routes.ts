import { FastifyInstance } from "fastify"
import { z } from "zod"

import { db } from "../../core/database/prisma.js"
import { Errors } from "../../core/errors/AppError.js"
import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"

// ── Zod schemas ──────────────────────────────────────────────────────────────

const configSchema = z.object({
  maxPeriodsPerDay:       z.number().int().min(1).max(12).optional(),
  maxPeriodsPerWeek:      z.number().int().min(1).max(60).optional(),
  maxConsecutivePeriods:  z.number().int().min(1).max(8).default(3),
  preferredDaysOff:       z.array(z.enum(["MON","TUE","WED","THU","FRI","SAT"])).default([]),
  isOverrideActive:       z.boolean().default(true),
})

const assignSubjectSchema = z.object({
  subjectId:     z.string().uuid("subjectId must be a valid UUID"),
  isPrimary:     z.boolean().default(false),
  canSubstitute: z.boolean().default(true),
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the teacher if they belong to this school, otherwise throws 404. */
async function findOwnedTeacherOrThrow(id: string, schoolId: string) {
  const teacher = await db.user.findFirst({ where: { id, schoolId, isActive: true } })
  if (!teacher) throw Errors.NOT_FOUND("Teacher")
  return teacher
}

/** Returns the subject if it belongs to this school, otherwise throws 404. */
async function findOwnedSubjectOrThrow(id: string, schoolId: string) {
  const subject = await db.subject.findFirst({ where: { id, schoolId, isActive: true } })
  if (!subject) throw Errors.NOT_FOUND("Subject")
  return subject
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function teachersRoutes(fastify: FastifyInstance) {

  /** List all teaching staff with their assigned subjects. */
  fastify.get("/v1/teachers", {
    preHandler: [authenticateWithTenant],
  }, async (request, reply) => {
    const teachers = await db.user.findMany({
      where: {
        schoolId: request.user.schoolId,
        isActive: true,
        role: { in: ["PRINCIPAL","VICE_PRINCIPAL","COORDINATOR",
                     "CLASS_TEACHER","SUBJECT_TEACHER","TEMP_TEACHER","INTERN"] },
      },
      select: {
        id:           true,
        name:         true,
        email:        true,
        role:         true,
        teacherConfig:true,
        taughtSubjects: {
          select: {
            isPrimary:     true,
            canSubstitute: true,
            subject: { select: { id: true, name: true, code: true, colorHex: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    })
    return reply.send({ success: true, data: teachers })
  })

  /** Single teacher detail. */
  fastify.get("/v1/teachers/:id", {
    preHandler: [authenticateWithTenant],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const teacher = await db.user.findFirst({
      where: { id, schoolId: request.user.schoolId, isActive: true },
      select: {
        id:           true,
        name:         true,
        email:        true,
        role:         true,
        teacherConfig:true,
        taughtSubjects: {
          select: {
            isPrimary:     true,
            canSubstitute: true,
            subject: { select: { id: true, name: true, code: true, colorHex: true } },
          },
        },
      },
    })
    if (!teacher) throw Errors.NOT_FOUND("Teacher")
    return reply.send({ success: true, data: teacher })
  })

  /** Update period limits and day-off preferences for a teacher. */
  fastify.put("/v1/teachers/:id/config", {
    preHandler: [authenticateWithTenant, requirePermission("staff:edit")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = configSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    await findOwnedTeacherOrThrow(id, request.user.schoolId)
    const updated = await db.user.update({
      where:  { id },
      data:   { teacherConfig: parsed.data },
      select: { id: true, name: true, role: true, teacherConfig: true },
    })
    return reply.send({ success: true, data: updated })
  })

  /**
   * Assign a subject to a teacher.
   *
   * Fixed C-002: previously only checked that a subjectId was provided.
   * Now verifies both the teacher AND the subject belong to this school,
   * preventing cross-school subject assignments.
   */
  fastify.post("/v1/teachers/:id/subjects", {
    preHandler: [authenticateWithTenant, requirePermission("staff:edit")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = assignSubjectSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    const schoolId = request.user.schoolId

    // Both teacher and subject must belong to this school.
    await findOwnedTeacherOrThrow(id, schoolId)
    await findOwnedSubjectOrThrow(parsed.data.subjectId, schoolId)

    try {
      const assignment = await db.teacherSubject.create({
        data: {
          teacherId:    id,
          subjectId:    parsed.data.subjectId,
          isPrimary:    parsed.data.isPrimary,
          canSubstitute:parsed.data.canSubstitute,
        },
        include: { subject: { select: { name: true, code: true } } },
      })
      return reply.status(201).send({ success: true, data: assignment })
    } catch (err: any) {
      if (err.code === "P2002") throw Errors.DUPLICATE("Subject assignment")
      throw err
    }
  })

  /**
   * Remove a subject assignment from a teacher.
   *
   * Fixed C-002: previously called deleteMany({ where: { teacherId, subjectId } })
   * with no school boundary check. An admin from School A could remove subject
   * assignments from teachers in School B.
   */
  fastify.delete("/v1/teachers/:id/subjects/:subjectId", {
    preHandler: [authenticateWithTenant, requirePermission("staff:edit")],
  }, async (request, reply) => {
    const { id, subjectId } = request.params as { id: string; subjectId: string }
    await findOwnedTeacherOrThrow(id, request.user.schoolId)
    await db.teacherSubject.deleteMany({ where: { teacherId: id, subjectId } })
    return reply.send({ success: true, data: { message: "Subject removed from teacher" } })
  })
}