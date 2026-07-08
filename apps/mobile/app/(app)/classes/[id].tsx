import React, { useCallback, useEffect, useState } from "react"
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput,
} from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { api } from "../../../src/api/client"
import { useAuthStore } from "../../../src/stores/authStore"
import { useToast } from "../../../src/components/Toast"
import { ScreenHeader } from "../../../src/components/ScreenHeader"
import { LoadingView, ErrorView } from "../../../src/components/StatusView"
import { colors, spacing, radius } from "../../../src/theme"
import { SCHOOL_CONFIG_ROLES, STUDENT_EDIT_ROLES, ROLE_LABELS } from "@educonnect/shared"
import type { ClassDetail, Student } from "@educonnect/shared"

type TeacherOption = { id: string; name: string; email: string; role: string }

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const showToast = useToast()
  const canManageClass = SCHOOL_CONFIG_ROLES.includes((user?.role ?? "") as any)
  const canManageStudents = STUDENT_EDIT_ROLES.includes((user?.role ?? "") as any)

  const [cls, setCls] = useState<ClassDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [teacherPickerOpen, setTeacherPickerOpen] = useState(false)
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([])
  const [teacherOptionsLoading, setTeacherOptionsLoading] = useState(false)
  const [assigningTeacherId, setAssigningTeacherId] = useState<string | null>(null)

  const [studentModalOpen, setStudentModalOpen] = useState(false)
  const [sName, setSName] = useState("")
  const [sRollNumber, setSRollNumber] = useState("")
  const [sParentName, setSParentName] = useState("")
  const [sParentPhone, setSParentPhone] = useState("")
  const [savingStudent, setSavingStudent] = useState(false)

  const fetchClass = useCallback(() => {
    setLoading(true)
    setError(null)
    api.get(`/v1/classes/${id}`)
      .then((res) => setCls(res.data.data))
      .catch((err) => {
        const message = err?.response?.status === 404 ? "Class not found." : "Failed to load class. Check your connection."
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchClass() }, [fetchClass])

  const openTeacherPicker = () => {
    setTeacherPickerOpen(true)
    setTeacherOptionsLoading(true)
    api.get("/v1/teachers")
      .then((res) => setTeacherOptions(res.data.data))
      .catch(() => showToast("Could not load teacher list.", "error"))
      .finally(() => setTeacherOptionsLoading(false))
  }

  const assignTeacher = (teacherId: string | null) => {
    setAssigningTeacherId(teacherId ?? "none")
    api.patch(`/v1/classes/${id}/teacher`, { classTeacherId: teacherId })
      .then(() => {
        setTeacherPickerOpen(false)
        showToast(teacherId ? "Class teacher assigned" : "Class teacher removed")
        fetchClass()
      })
      .catch(() => showToast("Could not update class teacher.", "error"))
      .finally(() => setAssigningTeacherId(null))
  }

  const openAddStudent = () => {
    setSName(""); setSRollNumber(""); setSParentName(""); setSParentPhone("")
    setStudentModalOpen(true)
  }

  const submitStudent = () => {
    if (!sName.trim()) {
      showToast("Student name is required.", "error")
      return
    }
    setSavingStudent(true)
    api.post("/v1/students", {
      classId: id,
      name: sName.trim(),
      rollNumber: sRollNumber.trim() || undefined,
      parentName: sParentName.trim() || undefined,
      parentPhone: sParentPhone.trim() || undefined,
    })
      .then(() => {
        setStudentModalOpen(false)
        showToast("Student added")
        fetchClass()
      })
      .catch((err) => {
        const message = err?.response?.data?.error?.message ?? "Could not add student."
        showToast(message, "error")
      })
      .finally(() => setSavingStudent(false))
  }

  if (loading) return <LoadingView label="Loading class..." />
  if (error || !cls) return <ErrorView message={error ?? "Class not found."} onRetry={() => fetchClass()} />

  return (
    <View style={styles.container}>
      <ScreenHeader title={`${cls.name} - ${cls.section}`} subtitle={cls.academicYear} />

      <FlatList
        data={cls.students}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.teacherCard}>
            <View>
              <Text style={styles.teacherLabel}>Class Teacher</Text>
              <Text style={styles.teacherValue}>
                {cls.classTeacher ? cls.classTeacher.name : "Not assigned"}
              </Text>
              {cls.classTeacher && <Text style={styles.teacherEmail}>{cls.classTeacher.email}</Text>}
            </View>
            {canManageClass && (
              <TouchableOpacity style={styles.changeBtn} onPress={openTeacherPicker}>
                <Text style={styles.changeBtnText}>{cls.classTeacher ? "Change" : "Assign"}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyRoster}>
            <Ionicons name="people-outline" size={36} color={colors.textFaint} />
            <Text style={styles.emptyText}>No students yet</Text>
          </View>
        }
        renderItem={({ item }: { item: Student }) => (
          <TouchableOpacity onPress={() => router.push(`/students/${item.id}` as any)}>
            <View style={styles.studentCard}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentInitial}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{item.name}</Text>
                <Text style={styles.studentMeta}>
                  {item.rollNumber ? `Roll ${item.rollNumber}` : "No roll number"}
                  {item.parentName ? `  -  ${item.parentName}` : ""}
                </Text>
                {item.parentPhone && (
                  <View style={styles.phoneRow}>
                    <Ionicons name="call-outline" size={12} color={colors.textFaint} />
                    <Text style={styles.studentPhone}>{item.parentPhone}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {canManageStudents && (
        <TouchableOpacity style={styles.fab} onPress={openAddStudent}>
          <Ionicons name="person-add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <Modal visible={teacherPickerOpen} animationType="slide" transparent onRequestClose={() => setTeacherPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign Class Teacher</Text>
            {teacherOptionsLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              <FlatList
                data={teacherOptions}
                keyExtractor={(t) => t.id}
                style={{ maxHeight: 360 }}
                ListHeaderComponent={
                  cls.classTeacher ? (
                    <TouchableOpacity
                      style={styles.teacherOption}
                      disabled={assigningTeacherId !== null}
                      onPress={() => assignTeacher(null)}
                    >
                      <Text style={[styles.teacherOptionText, { color: colors.danger }]}>Remove class teacher</Text>
                      {assigningTeacherId === "none" && <ActivityIndicator size="small" color={colors.danger} />}
                    </TouchableOpacity>
                  ) : null
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.teacherOption}
                    disabled={assigningTeacherId !== null}
                    onPress={() => assignTeacher(item.id)}
                  >
                    <View>
                      <Text style={styles.teacherOptionText}>{item.name}</Text>
                      <Text style={styles.teacherOptionRole}>{ROLE_LABELS[item.role] ?? item.role}</Text>
                    </View>
                    {assigningTeacherId === item.id && <ActivityIndicator size="small" color={colors.primary} />}
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setTeacherPickerOpen(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={studentModalOpen} animationType="slide" transparent onRequestClose={() => setStudentModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Student</Text>
            <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={colors.textFaint} value={sName} onChangeText={setSName} />
            <TextInput style={styles.input} placeholder="Roll number (optional)" placeholderTextColor={colors.textFaint} value={sRollNumber} onChangeText={setSRollNumber} />
            <TextInput style={styles.input} placeholder="Parent name (optional)" placeholderTextColor={colors.textFaint} value={sParentName} onChangeText={setSParentName} />
            <TextInput style={styles.input} placeholder="Parent phone (optional)" placeholderTextColor={colors.textFaint} value={sParentPhone} onChangeText={setSParentPhone} keyboardType="phone-pad" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtnInline} onPress={() => setStudentModalOpen(false)} disabled={savingStudent}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={submitStudent} disabled={savingStudent}>
                {savingStudent ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.modalSaveText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 100 },
  teacherCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  teacherLabel: { fontSize: 12, color: colors.textFaint },
  teacherValue: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginTop: 2 },
  teacherEmail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  changeBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  changeBtnText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  studentCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, flexDirection: "row", alignItems: "center", gap: spacing.md },
  studentAvatar: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.primaryMuted, justifyContent: "center", alignItems: "center" },
  studentInitial: { color: colors.primary, fontWeight: "700" },
  studentName: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  studentMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  studentPhone: { fontSize: 12, color: colors.textFaint },
  emptyRoster: { paddingVertical: 40, alignItems: "center", gap: spacing.sm },
  emptyText: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
  fab: { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, gap: spacing.md, maxHeight: "80%" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.sm },
  input: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  modalCancelBtn: { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  modalCancelBtnInline: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  modalCancelText: { color: colors.textMuted, fontWeight: "600" },
  modalSaveBtn: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", backgroundColor: colors.primary },
  modalSaveText: { color: "#FFFFFF", fontWeight: "700" },
  teacherOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  teacherOptionText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  teacherOptionRole: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
})