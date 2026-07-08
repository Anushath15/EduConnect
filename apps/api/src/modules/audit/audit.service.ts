import { db } from "../../core/database/prisma.js"

export class AuditService {
  async getLogs(
    schoolId: string,
    page: number,
    limit: number,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: any = { schoolId }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate)   where.createdAt.lte = endDate
    }

    const [total, logs] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
    ])

    return {
      logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }
}

export const auditService = new AuditService()
