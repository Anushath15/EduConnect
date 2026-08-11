"use client"
import Link               from "next/link"
import { useQuery }       from "@tanstack/react-query"
import { BookOpen, Users } from "lucide-react"

import { get }            from "@/lib/api"
import { AdminLayout }    from "@/components/AdminLayout"
 
interface ClassItem {
  id:           string
  name:         string
  section:      string | null
  academicYear: string | null
  studentCount: number
  classTeacher: { id: string; name: string } | null
  isActive:     boolean
}
 
export default function ClassesPage() {
  const { data: classes = [], isLoading } = useQuery<ClassItem[]>({
    queryKey: ["classes"],
    queryFn:  () => get<ClassItem[]>("/classes"),
    staleTime: 60_000,
  })
 
  const active = classes.filter((c) => c.isActive)
 
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground mt-1">
            {active.length} active class{active.length !== 1 ? "es" : ""}
          </p>
        </div>
 
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-xl border bg-card">
            <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No classes yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add classes via the mobile app
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {active.map((cls) => (
              <Link
                key={cls.id}
                href={`/students?classId=${cls.id}`}
                className="rounded-xl border bg-card p-5 hover:bg-accent/50 transition-colors group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {cls.academicYear ?? "Current"}
                  </span>
                </div>
 
                <p className="text-lg font-bold">
                  {cls.name}
                  {cls.section ? <span className="text-muted-foreground font-normal"> — {cls.section}</span> : null}
                </p>
 
                <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""}</span>
                </div>
 
                {cls.classTeacher && (
                  <p className="text-xs text-muted-foreground mt-1.5 truncate">
                    Teacher: {cls.classTeacher.name}
                  </p>
                )}
 
                <p className="text-xs text-primary mt-3 font-medium group-hover:underline">
                  View roster →
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}