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

interface Period {
  id: string
  periodNumber: number
  label: string
  startTime: string
  endTime: string
  isBreak: boolean
}

export default function PeriodsScreen() {
  const { user } = useAuthStore()
  const canManage = SCHOOL_CONFIG_ROLES.includes((user?.role ?? "") as any)

  const [periods, setPeriods]   = useState<Period[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [periodNumber, setPeriodNumber] = useState("")
  const [label, setLabel]             = useState("")
  const [startTime, setStartTime]     = useState("")
  const [endTime, setEndTime]         = useState("")
  const [isBreak, setIsBreak]         = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api.get("/v1/periods")
      .then(r => setPeriods(r.data.data ?? []))
      .catch(() => setError("Failed to load periods."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setPeriodNumber("")
    setLabel("")
    setStartTime("")
    setEndTime("")
    setIsBreak(false)
  }

  const handleCreate = async () => {
    const num = parseInt(periodNumber, 10)
    if (isNaN(num) || num < 1) {
      Alert.alert("Required", "Enter a valid period number.")
      return
    }
    if (!startTime.trim() || !endTime.trim()) {
      Alert.alert("Required", "Start time and end time are required (e.g. 08:00).")
      return
    }

    setSubmitting(true)
    try {
      await api.post("/v1/periods", {
        periodNumber: num,
        label: label.trim() || undefined,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        isBreak,
      })
      setShowCreate(false)
      resetForm()
      load()
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error?.message ?? "Could not create period.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={s.container}>
      <ScreenHeader title="Periods" subtitle="Daily period schedule" showBack />

      {loading ? (
        <LoadingView label="Loading periods..." />
      ) : error ? (
        <ErrorView message={error} onRetry={load} />
      ) : periods.length === 0 ? (
        <EmptyView title="No periods configured" icon="time-outline" />
      ) : (
        <FlatList
          data={[...periods].sort((a, b) => a.periodNumber - b.periodNumber)}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item }) => (
            <View style={[s.card, item.isBreak && s.breakCard]}>
              <View style={[s.numBadge, item.isBreak && s.breakNumBadge]}>
                <Text style={s.numText}>{item.isBreak ? "—" : item.periodNumber}</Text>
              </View>
              <View style={s.info}>
                <Text style={s.cardLabel}>
                  {item.label || (item.isBreak ? "Break" : `Period ${item.periodNumber}`)}
                </Text>
                <Text style={s.time}>{item.startTime} – {item.endTime}</Text>
              </View>
              {item.isBreak && (
                <View style={s.breakTag}>
                  <Text style={s.breakTagText}>Break</Text>
                </View>
              )}
            </View>
          )}
        />
      )}

      {canManage && (
        <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Add Period</Text>
              <TouchableOpacity onPress={() => { setShowCreate(false); resetForm() }}>
                <Text style={s.cancel}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>Period Number *</Text>
            <TextInput
              style={s.input} value={periodNumber} onChangeText={setPeriodNumber}
              placeholder="e.g. 1" placeholderTextColor={colors.textFaint} keyboardType="number-pad"
            />

            <Text style={s.fieldLabel}>Label (optional)</Text>
            <TextInput
              style={s.input} value={label} onChangeText={setLabel}
              placeholder="e.g. Morning Assembly" placeholderTextColor={colors.textFaint}
            />

            <View style={s.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Start Time *</Text>
                <TextInput
                  style={s.input} value={startTime} onChangeText={setStartTime}
                  placeholder="08:00" placeholderTextColor={colors.textFaint}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>End Time *</Text>
                <TextInput
                  style={s.input} value={endTime} onChangeText={setEndTime}
                  placeholder="08:45" placeholderTextColor={colors.textFaint}
                />
              </View>
            </View>

            <View style={s.switchRow}>
              <Text style={s.switchLabel}>This is a Break / Lunch</Text>
              <Switch
                value={isBreak}
                onValueChange={setIsBreak}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.textPrimary}
              />
            </View>

            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={colors.textPrimary} />
                : <Text style={s.submitText}>Create Period</Text>}
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
  breakCard: { backgroundColor: colors.surfaceAlt, opacity: 0.8 },
  numBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
  },
  breakNumBadge: { backgroundColor: colors.border },
  numText: { color: colors.textPrimary, fontWeight: "700", fontSize: 14 },
  info: { flex: 1 },
  cardLabel: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  time: { ...typography.caption, marginTop: 2 },
  breakTag: {
    backgroundColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  breakTagText: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
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
  fieldLabel: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.border, color: colors.textPrimary, padding: spacing.md, fontSize: 14,
  },
  timeRow: { flexDirection: "row", gap: spacing.sm },
  switchRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.lg, backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md, padding: spacing.md,
  },
  switchLabel: { ...typography.body, color: colors.textPrimary },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    padding: spacing.md, alignItems: "center", marginTop: spacing.lg,
  },
  submitText: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
})
