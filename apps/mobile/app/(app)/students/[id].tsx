import React, { useCallback, useEffect, useState } from "react"
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { api } from "../../../src/api/client"
import { useAuthStore } from "../../../src/stores/authStore"
import { ScreenHeader } from "../../../src/components/ScreenHeader"
import { LoadingView, ErrorView } from "../../../src/components/StatusView"
import { colors, spacing, radius, typography } from "../../../src/theme"
import { STUDENT_EDIT_ROLES } from "@educonnect/shared"

interface Student {
  id: string
  rollNumber?: string
  name: string
  email?: string
  phone?: string
  dateOfBirth?: string
  gender?: string
  bloodGroup?: string
  address?: string
  // Academic
  class?: { id: string; name: string; section: string }
  // Parent
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  // Emergency
  emergencyContact?: string
  emergencyPhone?: string
  // Meta
  isActive: boolean
  admissionDate?: string
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("")
  return (
    <View style={av.container}>
      <Text style={av.text}>{initials}</Text>
    </View>
  )
}

const av = StyleSheet.create({
  container: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
  },
  text: { color: colors.textPrimary, fontSize: 24, fontWeight: "700" },
})

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <View style={ir.row}>
      <Text style={ir.label}>{label}</Text>
      <Text style={ir.value}>{value}</Text>
    </View>
  )
}

const ir = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: 13, color: colors.textMuted, flex: 1 },
  value: { fontSize: 13, color: colors.textPrimary, flex: 2, textAlign: "right" },
})

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sc.container}>
      <Text style={sc.title}>{title}</Text>
      {children}
    </View>
  )
}

const sc = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  title: { fontSize: 11, color: colors.primary, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: spacing.sm },
})

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const canEdit = STUDENT_EDIT_ROLES.includes((user?.role ?? "") as any)

  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    api.get(`/v1/students/${id}`)
      .then(r => setStudent(r.data.data))
      .catch(() => setError("Failed to load student details."))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const handleDeactivate = () => {
    Alert.alert(
      "Deactivate Student",
      `Remove ${student?.name} from active roster? Historical data is preserved.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/v1/students/${id}`)
              Alert.alert("Done", "Student deactivated.", [{ text: "OK", onPress: () => router.back() }])
            } catch (e: any) {
              Alert.alert("Error", e?.response?.data?.error?.message ?? "Could not deactivate.")
            }
          },
        },
      ]
    )
  }

  if (loading) return <LoadingView label="Loading student..." />
  if (error || !student) return <ErrorView message={error ?? "Student not found"} onRetry={load} />

  const dob = student.dateOfBirth
    ? new Date(student.dateOfBirth).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : undefined

  return (
    <View style={s.container}>
      <ScreenHeader
        title="Student Detail"
        showBack
        rightAction={
          canEdit
            ? { icon: "create-outline", onPress: () => Alert.alert("Edit", "Edit functionality coming soon.") }
            : undefined
        }
      />
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Hero */}
        <View style={s.hero}>
          <Avatar name={student.name} />
          <View style={s.heroInfo}>
            <Text style={s.heroName}>{student.name}</Text>
            {student.rollNumber && <Text style={s.heroRoll}>Roll #{student.rollNumber}</Text>}
            {student.class && (
              <Text style={s.heroClass}>{student.class.name} – {student.class.section}</Text>
            )}
            <View style={[s.statusBadge, !student.isActive && s.inactiveBadge]}>
              <Text style={s.statusText}>{student.isActive ? "Active" : "Inactive"}</Text>
            </View>
          </View>
        </View>

        {/* Personal Info */}
        <Section title="Personal Information">
          <InfoRow label="Email"        value={student.email} />
          <InfoRow label="Phone"        value={student.phone} />
          <InfoRow label="Date of Birth" value={dob} />
          <InfoRow label="Gender"       value={student.gender} />
          <InfoRow label="Blood Group"  value={student.bloodGroup} />
          <InfoRow label="Address"      value={student.address} />
        </Section>

        {/* Academic */}
        <Section title="Academic Information">
          <InfoRow label="Class"        value={student.class ? `${student.class.name} ${student.class.section}` : undefined} />
          <InfoRow label="Roll Number"  value={student.rollNumber} />
          <InfoRow label="Admission"    value={student.admissionDate ? new Date(student.admissionDate).toLocaleDateString("en-IN") : undefined} />
        </Section>

        {/* Parent / Guardian */}
        {(student.parentName || student.parentPhone || student.parentEmail) && (
          <Section title="Parent / Guardian">
            <InfoRow label="Name"   value={student.parentName} />
            <InfoRow label="Phone"  value={student.parentPhone} />
            <InfoRow label="Email"  value={student.parentEmail} />
          </Section>
        )}

        {/* Emergency Contact */}
        {(student.emergencyContact || student.emergencyPhone) && (
          <Section title="Emergency Contact">
            <InfoRow label="Name"   value={student.emergencyContact} />
            <InfoRow label="Phone"  value={student.emergencyPhone} />
          </Section>
        )}

        {/* Deactivate */}
        {canEdit && student.isActive && (
          <TouchableOpacity style={s.deactivateBtn} onPress={handleDeactivate}>
            <Ionicons name="person-remove-outline" size={18} color={colors.danger} />
            <Text style={s.deactivateText}>Deactivate Student</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl },
  hero: {
    flexDirection: "row", gap: spacing.lg, alignItems: "center",
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  heroInfo: { flex: 1 },
  heroName: { ...typography.title, marginBottom: 2 },
  heroRoll: { ...typography.caption, marginBottom: 2 },
  heroClass: { fontSize: 13, color: colors.primary, fontWeight: "600", marginBottom: 6 },
  statusBadge: {
    alignSelf: "flex-start", backgroundColor: colors.successMuted,
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  inactiveBadge: { backgroundColor: colors.dangerMuted },
  statusText: { fontSize: 11, color: colors.success, fontWeight: "700" },
  editBtn: { padding: spacing.xs },
  deactivateBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.dangerMuted, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.md, justifyContent: "center",
  },
  deactivateText: { color: colors.danger, fontSize: 14, fontWeight: "700" },
})
