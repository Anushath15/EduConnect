"use client"
import { useQuery }   from "@tanstack/react-query"
import { Users, BookOpen, Calendar, AlertCircle, TrendingUp } from "lucide-react"

import { get }        from "@/lib/api"
import { AdminLayout } from "@/components/AdminLayout"
 
interface SchoolStats {
  teachers:             number
  students:             number
  classes:              number
  pendingSubstitutions: number
}
 
export default function DashboardPage() {
  const { data: stats, isLoading, error } = useQuery<SchoolStats>({
    queryKey: ["school-stats"],
    queryFn:  () => get<SchoolStats>("/school/stats"),
    staleTime: 30_000,
    retry: 1,
  })
 
  const cards = [
    { label: "Total Staff",           value: stats?.teachers,             icon: Users,       color: "text-blue-500",   bg: "bg-blue-500/10"   },
    { label: "Students",              value: stats?.students,             icon: BookOpen,    color: "text-green-500",  bg: "bg-green-500/10"  },
    { label: "Classes",               value: stats?.classes,              icon: Calendar,    color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Pending Substitutions", value: stats?.pendingSubstitutions, icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-500/10" },
  ]
 
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">School overview</p>
        </div>
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Could not load stats. Make sure the API server is running (docker compose up -d).
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                <div className={`rounded-lg ${card.bg} p-2`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-3xl font-bold">
                {isLoading
                  ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted" />
                  : (card.value ?? "—")}
              </p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Quick Actions</h2>
            </div>
            <div className="space-y-2">
              {[
                { href: "/staff",         icon: Users,       label: "Add Staff Member"       },
                { href: "/classes",       icon: BookOpen,    label: "View Classes"           },
                { href: "/substitutions", icon: AlertCircle, label: "Manage Substitutions"   },
              ].map((a) => (
                <a key={a.href} href={a.href}
                  className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                  <a.icon className="h-4 w-4" /> {a.label}
                </a>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold mb-4">System Status</h2>
            <div className="space-y-3">
              {[
                { label: "API Server",   ok: !error  },
                { label: "Database",     ok: !error  },
                { label: "Auth Service", ok: true    },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${s.ok ? "text-green-500" : "text-orange-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.ok ? "bg-green-500" : "bg-orange-500"}`} />
                    {s.ok ? "Operational" : "Check connection"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}