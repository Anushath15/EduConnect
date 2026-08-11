"use client"
import { useState }             from "react"
import { useQuery }             from "@tanstack/react-query"
import { BookOpen, Search }     from "lucide-react"

import { get }                  from "@/lib/api"
import { AdminLayout }          from "@/components/AdminLayout"
 
interface ClassItem   { id: string; name: string; section?: string }
interface StudentItem {
  id:          string
  name:        string
  rollNumber:  string | null
  class:       { name: string; section?: string }
  parentName:  string | null
  parentPhone: string | null
  isActive:    boolean
  joinedDate:  string | null
}
 
export default function StudentsPage() {
  const [search,   setSearch]   = useState("")
  const [classId,  setClassId]  = useState("")
 
  const { data: classes = [] } = useQuery<ClassItem[]>({
    queryKey: ["classes"],
    queryFn:  () => get<ClassItem[]>("/classes"),
    staleTime: 60_000,
  })
 
  const { data: students = [], isLoading } = useQuery<StudentItem[]>({
    queryKey: ["students", classId],
    queryFn:  () => get<StudentItem[]>(classId ? `/students?classId=${classId}` : "/students"),
    staleTime: 30_000,
  })
 
  const filtered = students.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )
 
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground mt-1">
            {filtered.length} student{filtered.length !== 1 ? "s" : ""}
            {classId ? " in selected class" : " across all classes"}
          </p>
        </div>
 
        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border bg-background pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.section ? ` — ${c.section}` : ""}
              </option>
            ))}
          </select>
        </div>
 
        {/* Table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">No students found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Add students via the mobile app"}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["Roll", "Name", "Class", "Parent", "Contact", "Joined"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {s.rollNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.class.name}{s.class.section ? ` ${s.class.section}` : ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.parentName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.parentPhone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.joinedDate ? new Date(s.joinedDate).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}