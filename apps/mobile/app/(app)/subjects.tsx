import React, { useCallback, useEffect, useState } from "react"
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, Switch,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { api } from "../../src/api/client"
import { useAuthStore } from "../../src/stores/authStore"
import { ScreenHeader } from "../../src/components/ScreenHeader"
import { LoadingView, ErrorView, EmptyView } from "../../src/components/StatusView"
import { colors, spacing, radius, typography } from "../../src/theme"
import { SCHOOL_CONFIG_ROLES } from "@educonnect/shared"

interface Subject {
  id: string
  name: string
  code: string
  colorHex: string
  periodsPerWeek: number
  isActive: boolean
}

export default function SubjectsScreen() {
  const { user } = useAuthStore()
  const canManage = SCHOOL_CONFIG_ROLES.includes((user?.role ?? "") as any)

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName]             = useState("")
  const [code, setCode]             = useState("")
  const [colorHex, setColorHex]     = useState("#6366F1")
  const [periodsPerWeek, setPeriodsPerWeek] = useState("5")

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api.get("/v1/subjects")
      .then(r => setSubjects(r.data.data))
      .catch(() => setError("Failed to load subjects. Check your connection."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setName("")
    setCode("")
    setColorHex("#6366F1")
    setPeriodsPerWeek("5")
  }

  const handleCreate = async () => {
    if (!name.trim() || !code.trim()) {
      Alert.alert("Required", "Name and code are required.")
      return
    }
    const ppw = parseInt(periodsPerWeek, 10)
    if (isNaN(ppw) || ppw < 1 || ppw > 40) {
      Alert.alert("Invalid", "Periods per week must be between 1 and 40.")
      return
    }
    setSubmitting(true)
    try {
      await api.post("/v1/subjects", {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        colorHex,
        periodsPerWeek: ppw,
      })
      setShowCreate(false)
      resetForm()
      load()
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error?.message ?? "Could not create subject.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = (subject: Subject) => {
    Alert.alert(
      "Deactivate Subject",
      `Remove "${subject.name}" from the timetable? This will not delete historical data.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/v1/subjects/${subject.id}`)
              load()
            } catch (e: any) {
              Alert.alert("Error", e?.response?.data?.error?.message ?? "Could not deactivate.")
            }
          },
        },
      ]
    )
  }

  const PRESET_COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#3B82F6","#EC4899","#8B5CF6","#14B8A6"]

  return (
    <View style={s.container}>
      <ScreenHeader title="Subjects" subtitle="Subject catalog" showBack />

      {loading ? (
        <LoadingView label="Loading subjects..." />
      ) : error ? (
        <ErrorView message={error} onRetry={load} />
      ) : subjects.length === 0 ? (
        <EmptyView title="No subjects yet" icon="book-outline" />
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={[s.colorDot, { backgroundColor: item.colorHex }]} />
              <View style={s.info}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.code}>{item.code}</Text>
              </View>
              <View style={s.badge}>
                <Text style={s.badgeText}>{item.periodsPerWeek} pw</Text>
              </View>
              {canManage && (
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => handleDeactivate(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {/* FAB */}
      {canManage && (
        <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Add Subject</Text>
              <TouchableOpacity onPress={() => { setShowCreate(false); resetForm() }}>
                <Text style={s.cancel}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Name *</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Mathematics" placeholderTextColor={colors.textFaint} />

            <Text style={s.label}>Code *</Text>
            <TextInput style={s.input} value={code} onChangeText={setCode} placeholder="e.g. MATH" placeholderTextColor={colors.textFaint} autoCapitalize="characters" />

            <Text style={s.label}>Periods per Week *</Text>
            <TextInput style={s.input} value={periodsPerWeek} onChangeText={setPeriodsPerWeek} keyboardType="number-pad" placeholder="5" placeholderTextColor={colors.textFaint} />

            <Text style={s.label}>Color</Text>
            <View style={s.colorRow}>
              {PRESET_COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => setColorHex(c)}>
                  <View style={[s.colorSwatch, { backgroundColor: c }, colorHex === c && s.colorSwatchActive]} />
                </TouchableOpacity>
              ))}
            </View>
            <View style={[s.colorPreview, { backgroundColor: colorHex }]}>
              <Text style={s.colorPreviewText}>{colorHex}</Text>
            </View>

            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={colors.textPrimary} />
                : <Text style={s.submitText}>Create Subject</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.xl, gap: spacing.sm },
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
  },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  info: { flex: 1 },
  name: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  code: { ...typography.caption, marginTop: 2 },
  badge: {
    backgroundColor: colors.primaryMuted, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  badgeText: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  deleteBtn: { padding: 4 },
  fab: {
    position: "absolute", bottom: 28, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.xl, paddingBottom: 40,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  sheetTitle: { ...typography.title },
  cancel: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  label: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.border, color: colors.textPrimary, padding: spacing.md, fontSize: 14,
  },
  colorRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.xs },
  colorSwatch: { width: 30, height: 30, borderRadius: 15 },
  colorSwatchActive: { borderWidth: 3, borderColor: colors.textPrimary },
  colorPreview: { borderRadius: radius.sm, padding: spacing.sm, alignItems: "center", marginTop: spacing.sm },
  colorPreviewText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    padding: spacing.md, alignItems: "center", marginTop: spacing.lg,
  },
  submitText: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
})
