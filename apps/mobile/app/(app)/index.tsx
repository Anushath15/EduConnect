import React from "react"
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from "react-native"
import { router } from "expo-router"
import { useAuthStore } from "../../src/stores/authStore"
import { colors, spacing, radius, typography } from "../../src/theme"
import { ROLE_LABELS, SCHOOL_CONFIG_ROLES, AUDIT_VIEW_ROLES } from "@educonnect/shared"

const BASE_CARDS = [
  { title: "Timetable",       desc: "View and manage class schedules",      route: "/timetable" },
  { title: "Teachers",        desc: "Manage teachers and assignments",       route: "/teachers" },
  { title: "Classes",         desc: "View class rosters and details",        route: "/classes" },
  { title: "Substitutions",   desc: "Handle teacher absences",              route: "/substitutions" },
  { title: "Swap Requests",   desc: "Review and respond to period swaps",   route: "/swap-requests" },
  { title: "Announcements",   desc: "School-wide notices and updates",      route: "/announcements" },
  { title: "Resources",       desc: "Book labs, grounds and shared spaces", route: "/resources" },
]

const ADMIN_CARDS = [
  { title: "Subjects",  desc: "Manage subject catalog",          route: "/subjects" },
  { title: "Periods",   desc: "Configure daily period schedule", route: "/periods" },
]

const AUDIT_CARD = { title: "Audit Logs", desc: "System activity and change history", route: "/audit-logs" }


function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default function DashboardScreen() {
  const { user, logout } = useAuthStore()
  const role = user?.role ?? ""

  const cards = [
    ...BASE_CARDS,
    ...(SCHOOL_CONFIG_ROLES.includes(role as any) ? ADMIN_CARDS : []),
    ...(AUDIT_VIEW_ROLES?.includes(role as any) ? [AUDIT_CARD] : []),
  ]

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ])
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>{getGreeting()}</Text>
          <Text style={s.name}>{user?.name ?? "User"}</Text>
          <Text style={s.role}>{ROLE_LABELS[user?.role ?? ""] ?? user?.role}</Text>
          {user?.school && <Text style={s.school}>{user.school.name}</Text>}
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.grid}>
        {cards.map((card) => (
          <TouchableOpacity
            key={card.title}
            style={s.card}
            onPress={() => router.push(card.route as any)}
          >
            <Text style={s.cardTitle}>{card.title}</Text>
            <Text style={s.cardDesc}>{card.desc}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}


const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
  },
  greeting: { fontSize: 14, color: colors.textMuted },
  name: { ...typography.title, marginTop: 2 },
  role: { fontSize: 13, color: colors.primary, marginTop: 2, fontWeight: "600" },
  school: { ...typography.caption, marginTop: 2 },
  logoutBtn: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderWidth: 1, borderColor: colors.border, marginLeft: spacing.md,
  },
  logoutText: { color: colors.textMuted, fontSize: 13 },
  grid: { padding: spacing.lg, gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, marginBottom: 4 },
  cardTitle: { ...typography.body, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 },
  cardDesc: { ...typography.caption, lineHeight: 18 },
})