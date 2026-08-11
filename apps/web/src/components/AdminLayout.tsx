"use client"
import { useEffect } from "react"
import Link  from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, BookOpen, Calendar,
  Repeat, Megaphone, Building2, Settings, LogOut,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth"
 
const nav = [
  { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard },
  { href: "/staff",        label: "Staff",         icon: Users },
  { href: "/classes",      label: "Classes",       icon: BookOpen },
  { href: "/students",     label: "Students",      icon: BookOpen },
  { href: "/timetable",    label: "Timetable",     icon: Calendar },
  { href: "/substitutions",label: "Substitutions", icon: Repeat },
  { href: "/announcements",label: "Announcements", icon: Megaphone },
  { href: "/resources",    label: "Resources",     icon: Building2 },
  { href: "/settings",     label: "Settings",      icon: Settings },
]
 
export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, init } = useAuthStore()
  const pathname = usePathname()
 
  useEffect(() => { init() }, [init])
 
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-64 border-r bg-card flex flex-col flex-shrink-0">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-bold">E</span>
            </div>
            EduConnect
          </Link>
        </div>
        {user && (
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.role}</p>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto space-y-1 p-4">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}>
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t">
          <button onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  )
}