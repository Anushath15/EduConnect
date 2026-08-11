import { FastifyInstance } from "fastify"
import { z } from "zod"

import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"
import { db } from "../../core/database/prisma.js"

const studentSchema = z.object({
  classId:         z.string().uuid("classId must be a valid UUID"),
  name:            z.string().min(1).max(100),
  rollNumber:      z.string().max(20).optional(),
  admissionNumber: z.string().max(50).optional(),
  dateOfBirth:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD").optional(),
  gender:          z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  bloodGroup:      z.enum(["A_POS","A_NEG","B_POS","B_NEG","O_POS","O_NEG","AB_POS","AB_NEG"]).optional(),
  photoUrl:        z.string().url("photoUrl must be a valid URL").optional(),
  address:         z.string().max(500).optional(),
  parentName:      z.string().max(100).optional(),
  parentPhone:     z.string().max(15).optional(),
  emergencyContact: z.object({
    name:         z.string(),
    phone:        z.string(),
    relationship: z.string(),
  }).optional(),
  joinedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "joinedDate must be YYYY-MM-DD").optional(),
})

const updateStudentSchema = studentSchema.partial()

export async function studentsRoutes(fastify: FastifyInstance) {

  fastify.get("/v1/students", {
    preHandler: [authenticateWithTenant, requirePermission("student:view")],
  }, async (request, reply) => {
    const { classId, search, page = "1", limit = "50" } = request.query as {
      classId?: string; search?: string; page?: string; limit?: string
    }
    const pageNum  = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const skip     = (pageNum - 1) * limitNum
    const where: any = { schoolId: request.user.schoolId, isActive: true }
    if (classId) where.classId = classId
    if (search) {
      where.OR = [
        { name:            { contains: search, mode: "insensitive" } },
        { rollNumber:      { contains: search, mode: "insensitive" } },
        { admissionNumber: { contains: search, mode: "insensitive" } },
      ]
    }
    const [data, total] = await Promise.all([
      db.student.findMany({
        where,
        select: {
          id: true, name: true, rollNumber: true, admissionNumber: true,
          gender: true, bloodGroup: true, photoUrl: true, joinedDate: true, isActive: true,
          class: { select: { id: true, name: true, section: true } },
        },
        orderBy: [{ class: { name: "asc" } }, { rollNumber: "asc" }, { name: "asc" }],
        skip, take: limitNum,
      }),
      db.student.count({ where }),
    ])
    return reply.send({ success: true, data, meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } })
  })

  fastify.get("/v1/students/:id", {
    preHandler: [authenticateWithTenant, requirePermission("student:view")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const student = await db.student.findFirst({
      where: { id, schoolId: request.user.schoolId, isActive: true },
      include: { class: { select: { id: true, name: true, section: true, academicYear: true } } },
    })
    if (!student) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Student not found" } })
    return reply.send({ success: true, data: student })
  })

  fastify.post("/v1/students", {
    preHandler: [authenticateWithTenant, requirePermission("student:create")],
  }, async (request, reply) => {
    const parsed = studentSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message } })
    const cls = await db.class.findFirst({ where: { id: parsed.data.classId, schoolId: request.user.schoolId, isActive: true } })
    if (!cls) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Class not found" } })
    try {
      const { dateOfBirth, joinedDate, ...rest } = parsed.data
      const student = await db.student.create({
        data: {
          schoolId: request.user.schoolId,
          ...rest,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          joinedDate:  joinedDate  ? new Date(joinedDate)  : undefined,
        },
        include: { class: { select: { id: true, name: true, section: true } } },
      })
      return reply.status(201).send({ success: true, data: student })
    } catch (err: any) {
      if (err.code === "P2002") return reply.status(409).send({ success: false, error: { code: "DUPLICATE", message: "A student with this roll number already exists in this class" } })
      throw err
    }
  })

  fastify.put("/v1/students/:id", {
    preHandler: [authenticateWithTenant, requirePermission("student:edit")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updateStudentSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message } })
    const existing = await db.student.findFirst({ where: { id, schoolId: request.user.schoolId, isActive: true } })
    if (!existing) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Student not found" } })
    if (parsed.data.classId) {
      const cls = await db.class.findFirst({ where: { id: parsed.data.classId, schoolId: request.user.schoolId, isActive: true } })
      if (!cls) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Class not found" } })
    }
    const { dateOfBirth, joinedDate, ...rest } = parsed.data
    const updated = await db.student.update({
      where: { id },
      data: { ...rest, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined, joinedDate: joinedDate ? new Date(joinedDate) : undefined },
      include: { class: { select: { id: true, name: true, section: true } } },
    })
    return reply.send({ success: true, data: updated })
  })

  fastify.delete("/v1/students/:id", {
    preHandler: [authenticateWithTenant, requirePermission("student:edit")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await db.student.findFirst({ where: { id, schoolId: request.user.schoolId, isActive: true } })
    if (!existing) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Student not found" } })
    await db.student.update({ where: { id }, data: { isActive: false } })
    return reply.send({ success: true, data: { message: "Student deactivated" } })
  })

  fastify.post("/v1/students/bulk-import", {
    preHandler: [authenticateWithTenant, requirePermission("student:create")],
  }, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "CSV file is required" } })
    if (!data.filename.endsWith(".csv")) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "File must be a .csv" } })
    const chunks: Buffer[] = []
    for await (const chunk of data.file) { chunks.push(chunk) }
    const csvText = Buffer.concat(chunks).toString("utf-8")
    const lines   = csvText.split("\n").map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "CSV must have a header row and at least one data row" } })
    const headers = lines[0].split(",").map(h => h.trim())
    for (const req of ["classId","name"]) {
      if (!headers.includes(req)) return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: `CSV missing required column: ${req}` } })
    }
    const classIds = new Set<string>()
    const rows = lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim())
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = values[i] ?? "" })
      if (row.classId) classIds.add(row.classId)
      return row
    })
    const validClasses = await db.class.findMany({ where: { id: { in: [...classIds] }, schoolId: request.user.schoolId, isActive: true }, select: { id: true } })
    const validClassIds = new Set(validClasses.map(c => c.id))
    let created = 0, skipped = 0
    const errors: string[] = []
    for (const [index, row] of rows.entries()) {
      const rowNum = index + 2
      if (!row.name?.trim()) { errors.push(`Row ${rowNum}: name is required`); skipped++; continue }
      if (!validClassIds.has(row.classId)) { errors.push(`Row ${rowNum}: classId not found`); skipped++; continue }
      try {
        await db.student.create({
          data: {
            schoolId: request.user.schoolId, classId: row.classId, name: row.name,
            rollNumber: row.rollNumber || undefined, admissionNumber: row.admissionNumber || undefined,
            gender:    (["MALE","FEMALE","OTHER"].includes(row.gender) ? row.gender as any : undefined),
            bloodGroup:(["A_POS","A_NEG","B_POS","B_NEG","O_POS","O_NEG","AB_POS","AB_NEG"].includes(row.bloodGroup) ? row.bloodGroup as any : undefined),
            parentName: row.parentName || undefined, parentPhone: row.parentPhone || undefined,
            dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : undefined,
            joinedDate:  row.joinedDate  ? new Date(row.joinedDate)  : undefined,
          },
        })
        created++
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err.code === "P2002" ? "duplicate roll number" : err.message}`)
        skipped++
      }
    }
    return reply.status(201).send({ success: true, data: { created, skipped, errors: errors.slice(0, 20) } })
  })
}