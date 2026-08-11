import { PrismaClient } from "@prisma/client"
import argon2 from "argon2"

const db = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  const school = await db.school.create({
    data: {
      name: "Test School",
      address: "123 Main Street, Kanyakumari",
      phone: "9876543210",
      email: "info@testschool.com",
      subscriptionStatus: "active",
    },
  })
  console.log("School created:", school.id)

  const adminHash = await argon2.hash(process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345")
  const admin = await db.user.create({
    data: {
      email: "admin@testschool.com",
      passwordHash: adminHash,
      name: "Test Admin",
      role: "ADMINISTRATOR",
      schoolId: school.id,
      isActive: true,
    },
  })
  console.log("Admin created:", admin.email)

  const teacherHash = await argon2.hash(process.env.SEED_TEACHER_PASSWORD ?? "Teacher@12345")
  const teacher = await db.user.create({
    data: {
      email: "teacher@testschool.com",
      passwordHash: teacherHash,
      name: "Test Teacher",
      role: "SUBJECT_TEACHER",
      schoolId: school.id,
      isActive: true,
    },
  })
  console.log("Teacher created:", teacher.email)

  const principal = await db.user.create({
    data: {
      email: "principal@testschool.com",
      passwordHash: await argon2.hash(process.env.SEED_PRINCIPAL_PASSWORD ?? "Principal@12345"),
      name: "Test Principal",
      role: "PRINCIPAL",
      schoolId: school.id,
      isActive: true,
    },
  })
  console.log("Principal created:", principal.email)

  console.log("Seeding complete.")
  console.log("")
  console.log("Test credentials (override via SEED_*_PASSWORD env vars):")
  console.log("  Admin:     admin@testschool.com")
  console.log("  Teacher:   teacher@testschool.com")
  console.log("  Principal: principal@testschool.com")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
