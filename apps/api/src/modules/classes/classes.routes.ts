import { FastifyInstance } from "fastify"
import { z } from "zod"

import { db } from "../../core/database/prisma.js"
import { Errors } from "../../core/errors/AppError.js"
import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"

// ── Zod schemas ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  name:           z.string().min(1).max(10),
  section:        z.string().min(1).max(5),
  academicYear:   z.string().regex(/^\d{4}-\d{4}$/, "Format must be YYYY-YYYY"),
  classTeacherId: z.string().uuid().optional(),
})

const patchSchema = z.object({
  name:         z.string().min(1).max(10).optional(),
  section:      z.string().min(1).max(5).optional(),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/).optional(),
})

const assignTeacherSchema = z.object({
  classTeacherId: z.string().uuid().nullable(),
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the class if it belongs to schoolId, otherwise throws 404.
 * Use this before any mutating operation to prevent cross-tenant access.
 */
async function findOwnedClassOrThrow(id: string, schoolId: string) {
  const cls = await db.class.findFirst({ where: { id, schoolId } })
  if (!cls) throw Errors.NOT_FOUND("Class")
  return cls
}

/** Checks that a userId is an active staff member of the given school. */
async function validateStaffMember(userId: string, schoolId: string) {
  const user = await db.user.findFirst({ where: { id: userId, schoolId, isActive: true } })
  if (!user) throw Errors.NOT_FOUND("Staff member")
  return user
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function classesRoutes(fastify: FastifyInstance) {

  /** List all active classes for the school, with student counts. */
  fastify.get("/v1/classes", {
    preHandler: [authenticateWithTenant],
  }, async (request, reply) => {
    const classes = await db.class.findMany({
      where:   { schoolId: request.user.schoolId, isActive: true },
      orderBy: [{ name: "asc" }, { section: "asc" }],
      include: {
        classTeacher: { select: { id: true, name: true } },
        _count:       { select: { students: { where: { isActive: true } } } },
      },
    })
    const data = classes.map(({ _count, ...rest }) => ({
      ...rest,
      studentCount: _count.students,
    }))
    return reply.send({ success: true, data })
  })

  /** Class detail with full student roster. */
  fastify.get("/v1/classes/:id", {
    preHandler: [authenticateWithTenant, requirePermission("student:view")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const cls = await db.class.findFirst({
      where:   { id, schoolId: request.user.schoolId },
      include: {
        classTeacher: { select: { id: true, name: true, email: true } },
        students:     { where: { isActive: true }, orderBy: { rollNumber: "asc" } },
      },
    })
    if (!cls) throw Errors.NOT_FOUND("Class")
    return reply.send({ success: true, data: cls })
  })

  /** Create a new class. */
  fastify.post("/v1/classes", {
    preHandler: [authenticateWithTenant, requirePermission("school:config")],
  }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    const { classTeacherId, ...rest } = parsed.data
    if (classTeacherId) await validateStaffMember(classTeacherId, request.user.schoolId)

    try {
      const cls = await db.class.create({
        data: { schoolId: request.user.schoolId, classTeacherId: classTeacherId ?? null, ...rest },
      })
      return reply.status(201).send({ success: true, data: cls })
    } catch (err: any) {
      if (err.code === "P2002") throw Errors.DUPLICATE("Class name + section")
      throw err
    }
  })

  /** Update class name, section, or academic year. */
  fastify.patch("/v1/classes/:id", {
    preHandler: [authenticateWithTenant, requirePermission("school:config")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = patchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    await findOwnedClassOrThrow(id, request.user.schoolId)
    try {
      const cls = await db.class.update({ where: { id }, data: parsed.data })
      return reply.send({ success: true, data: cls })
    } catch (err: any) {
      if (err.code === "P2002") throw Errors.DUPLICATE("Class name + section")
      throw err
    }
  })

  /** Assign or unassign a class teacher (pass null to unassign). */
  fastify.patch("/v1/classes/:id/teacher", {
    preHandler: [authenticateWithTenant, requirePermission("school:config")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = assignTeacherSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    await findOwnedClassOrThrow(id, request.user.schoolId)
    if (parsed.data.classTeacherId) {
      await validateStaffMember(parsed.data.classTeacherId, request.user.schoolId)
    }
    const cls = await db.class.update({
      where: { id },
      data:  { classTeacherId: parsed.data.classTeacherId },
    })
    return reply.send({ success: true, data: cls })
  })

  /**
   * Soft-delete (deactivate) a class.
   *
   * Fixed C-002: previously had no schoolId guard on the update query.
   * An admin from School A could deactivate a class in School B by
   * knowing its UUID. findOwnedClassOrThrow() now enforces ownership.
   */
  fastify.delete("/v1/classes/:id", {
    preHandler: [authenticateWithTenant, requirePermission("school:config")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await findOwnedClassOrThrow(id, request.user.schoolId)
    await db.class.update({ where: { id }, data: { isActive: false } })
    return reply.send({ success: true, data: { message: "Class deactivated" } })
  })
}