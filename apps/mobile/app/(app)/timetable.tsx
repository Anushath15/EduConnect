import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, FlatList,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { api } from "../../src/api/client"
import { useAuthStore } from "../../src/stores/authStore"
import { ScreenHeader } from "../../src/components/ScreenHeader"
import { LoadingView, ErrorView, EmptyView } from "../../src/components/StatusView"
import { colors, spacing, radius, typography } from "../../src/theme"
import { DAY_LABELS, WORKING_DAYS, SWAP_REQUEST_ROLES } from "@educonnect/shared"
import type { TimetableSlotExpanded, DayOfWeek } from "@educonnect/shared"

interface Period {
  id: string
  periodNumber: number
  startTime: string
  endTime: string
  isBreak: boolean
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  date.setHours(0, 0, 0, 0)
  return date
}
function toISODate(d: Date): string { return d.toISOString().split("T")[0] }
function addDays(d: Date, n: number): Date {
  const copy = new Date(d); copy.setDate(copy.getDate() + n); return copy
}
function formatWeekLabel(monday: Date): string {
  const sat = addDays(monday, 5)
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
  return `${monday.toLocaleDateString("en-IN", opts)} - ${sat.toLocaleDateString("en-IN", opts)}`
}

export default function TimetableScreen() {
  const { user } = useAuthStore()
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [viewMode, setViewMode] = useState<"MY" | "ALL">("MY")

  const [slots, setSlots] = useState<TimetableSlotExpanded[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canRequestSwap = SWAP_REQUEST_ROLES.includes((user?.role ?? "") as any)
  const [swapTarget, setSwapTarget] = useState<TimetableSlotExpanded | null>(null)
  const [chosenMySlotId, setChosenMySlotId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      api.get("/v1/timetable", { params: { weekStartDate: toISODate(weekStart) } }),
      api.get("/v1/periods")
    ])
      .then(([slotsRes, periodsRes]) => {
        setSlots(slotsRes.data.data)
        setPeriods(periodsRes.data.data.sort((a: any, b: any) => a.periodNumber - b.periodNumber))
      })
      .catch((err) => {
        const msg = err?.response?.status === 403 ? "Permission denied." : "Failed to load timetable."
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [weekStart])

  useEffect(() => { loadData() }, [loadData])

  const goToWeek = (delta: number) => setWeekStart((prev) => addDays(prev, delta * 7))

  const visibleSlots = useMemo(() => {
    if (viewMode === "ALL") return slots
    return slots.filter(s => s.teacher.id === user?.id)
  }, [slots, viewMode, user?.id])

  const mySlotsThisWeek = useMemo(() => slots.filter(s => s.teacher.id === user?.id), [slots, user?.id])

  const openSwapModal = (slot: TimetableSlotExpanded) => {
    if (slot.teacher.id === user?.id) return
    if (!canRequestSwap) { Alert.alert("Not available", "Your role cannot request class swaps."); return }
    if (mySlotsThisWeek.length === 0) {
      Alert.alert("No classes to offer", "You have no classes scheduled this week to offer in a swap.")
      return
    }
    setSwapTarget(slot)
    setChosenMySlotId(null)
    setMessage("")
  }

  const submitSwap = () => {
    if (!swapTarget || !chosenMySlotId) {
      Alert.alert("Pick a class", "Choose which of your classes you want to offer.")
      return
    }
    setSubmitting(true)
    api.post("/v1/swaps", {
      requesterSlotId: chosenMySlotId,
      receiverSlotId: swapTarget.id,
      message: message.trim() || undefined,
    })
      .then(() => {
        setSwapTarget(null)
        Alert.alert("Request sent", "Your swap request has been sent. Track it from Swap Requests.")
      })
      .catch((err) => {
        const msg = err?.response?.data?.error?.message ?? "Could not send swap request."
        Alert.alert("Error", msg)
      })
      .finally(() => setSubmitting(false))
  }

  const getSlot = (day: DayOfWeek, periodNumber: number) => {
    return visibleSlots.find(s => s.dayOfWeek === day && s.period.periodNumber === periodNumber)
  }

  return (
    <View style={s.container}>
      <ScreenHeader title="Timetable" subtitle={formatWeekLabel(weekStart)} showBack={false} />

      <View style={s.controls}>
        <View style={s.weekNav}>
          <TouchableOpacity onPress={() => goToWeek(-1)} style={s.weekNavBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
            <Text style={s.weekNavText}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setWeekStart(getMonday(new Date()))}>
            <Text style={s.thisWeekLink}>This week</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goToWeek(1)} style={s.weekNavBtn}>
            <Text style={s.weekNavText}>Next</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={s.viewToggle}>
          <TouchableOpacity
            style={[s.toggleChip, viewMode === "MY" && s.toggleChipActive]}
            onPress={() => setViewMode("MY")}
          >
            <Text style={[s.toggleText, viewMode === "MY" && s.toggleTextActive]}>My Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleChip, viewMode === "ALL" && s.toggleChipActive]}
            onPress={() => setViewMode("ALL")}
          >
            <Text style={[s.toggleText, viewMode === "ALL" && s.toggleTextActive]}>All Classes</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <LoadingView label="Loading timetable..." />
      ) : error ? (
        <ErrorView message={error} onRetry={loadData} />
      ) : periods.length === 0 ? (
        <EmptyView title="No periods defined" icon="time-outline" />
      ) : (
        <ScrollView style={s.scrollContainer} contentContainerStyle={{ padding: spacing.md }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Header Row */}
              <View style={s.gridRow}>
                <View style={[s.gridCell, s.headerCell, { width: 80 }]} />
                {WORKING_DAYS.map(day => (
                  <View key={day} style={[s.gridCell, s.headerCell]}>
                    <Text style={s.headerText}>{DAY_LABELS[day]}</Text>
                  </View>
                ))}
              </View>

              {/* Grid Rows */}
              {periods.map(p => (
                <View key={p.id} style={s.gridRow}>
                  {/* Time / Period Column */}
                  <View style={[s.gridCell, s.timeCell, { width: 80 }]}>
                    <Text style={s.timeText}>{p.startTime}</Text>
                    <Text style={s.periodText}>{p.isBreak ? "Break" : `P${p.periodNumber}`}</Text>
                    <Text style={s.timeText}>{p.endTime}</Text>
                  </View>

                  {/* Day Columns */}
                  {WORKING_DAYS.map(day => {
                    if (p.isBreak) {
                      return (
                        <View key={day} style={[s.gridCell, s.breakCell]}>
                          <Text style={s.breakText}>BREAK</Text>
                        </View>
                      )
                    }

                    const slot = getSlot(day, p.periodNumber)
                    if (!slot) return <View key={day} style={[s.gridCell, s.emptyCell]} />

                    const isMine = slot.teacher.id === user?.id

                    return (
                      <TouchableOpacity
                        key={day}
                        style={[s.gridCell, s.slotCell, { backgroundColor: slot.subject.colorHex + "22" }]}
                        onPress={() => openSwapModal(slot)}
                        activeOpacity={isMine ? 1 : 0.7}
                      >
                        <View style={[s.colorBar, { backgroundColor: slot.subject.colorHex }]} />
                        <Text style={s.slotSubject} numberOfLines={1}>{slot.subject.code}</Text>
                        <Text style={s.slotClass}>{slot.class.name} {slot.class.section}</Text>
                        {viewMode === "ALL" && !isMine && (
                          <Text style={s.slotTeacher} numberOfLines={1}>{slot.teacher.name}</Text>
                        )}
                        {!isMine && canRequestSwap && viewMode === "MY" && (
                           <Ionicons name="swap-horizontal" size={14} color={slot.subject.colorHex} style={{ marginTop: 2 }} />
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      )}

      {/* Swap Modal */}
      <Modal visible={!!swapTarget} animationType="slide" transparent onRequestClose={() => setSwapTarget(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Request Swap</Text>
              <TouchableOpacity onPress={() => setSwapTarget(null)}>
                <Text style={s.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {swapTarget && (
              <View style={s.targetCard}>
                <Text style={s.targetLabel}>You want:</Text>
                <Text style={s.targetSubject}>{swapTarget.subject.name}</Text>
                <Text style={s.targetMeta}>
                  {DAY_LABELS[swapTarget.dayOfWeek]}, {swapTarget.period.startTime} -{" "}
                  {swapTarget.period.endTime} - {swapTarget.teacher.name}
                </Text>
              </View>
            )}

            <Text style={s.fieldLabel}>Offer one of your classes in return:</Text>
            <FlatList
              data={mySlotsThisWeek}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 200 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.pickerRow, chosenMySlotId === item.id && s.pickerRowActive]}
                  onPress={() => setChosenMySlotId(item.id)}
                >
                  <View style={[s.subjectDot, { backgroundColor: item.subject.colorHex }]} />
                  <Text style={s.pickerRowText}>
                    {item.subject.name} - {DAY_LABELS[item.dayOfWeek]} {item.period.startTime}
                  </Text>
                  {chosenMySlotId === item.id && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />

            <Text style={s.fieldLabel}>Message (optional)</Text>
            <TextInput
              style={s.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Add a note for the other teacher"
              placeholderTextColor={colors.textFaint}
              multiline
            />

            <TouchableOpacity
              style={[s.submitBtn, submitting && s.submitBtnDisabled]}
              onPress={submitSwap}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color={colors.textPrimary} />
                : <Text style={s.submitBtnText}>Send Request</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  controls: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  weekNav: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  weekNavBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  weekNavText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  thisWeekLink: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  viewToggle: {
    flexDirection: "row", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm,
  },
  toggleChip: {
    paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  toggleChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  toggleText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  toggleTextActive: { color: colors.primary },
  scrollContainer: { flex: 1 },
  gridRow: { flexDirection: "row" },
  gridCell: { width: 110, minHeight: 70, borderBottomWidth: 1, borderRightWidth: 1, borderColor: colors.border, padding: 4 },
  headerCell: { minHeight: 40, justifyContent: "center", alignItems: "center", backgroundColor: colors.surface },
  headerText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  timeCell: { backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center" },
  timeText: { fontSize: 10, color: colors.textFaint },
  periodText: { fontSize: 12, fontWeight: "700", color: colors.textPrimary, marginVertical: 2 },
  breakCell: { backgroundColor: colors.surfaceAlt, justifyContent: "center", alignItems: "center", opacity: 0.6 },
  breakText: { fontSize: 11, fontWeight: "700", color: colors.textFaint, letterSpacing: 1 },
  emptyCell: { backgroundColor: colors.bg },
  slotCell: { borderRadius: radius.sm, margin: 2, padding: 6, position: "relative", overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  colorBar: { position: "absolute", top: 0, bottom: 0, left: 0, width: 3 },
  slotSubject: { fontSize: 12, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  slotClass: { fontSize: 10, color: colors.textSecondary },
  slotTeacher: { fontSize: 9, color: colors.textMuted, marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  modalTitle: { ...typography.title },
  modalClose: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  targetCard: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  targetLabel: { ...typography.caption },
  targetSubject: { ...typography.body, fontWeight: "700", color: colors.textPrimary, marginTop: 2 },
  targetMeta: { ...typography.caption, marginTop: 2 },
  fieldLabel: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  pickerRowActive: { backgroundColor: colors.primaryMuted },
  pickerRowText: { flex: 1, color: colors.textPrimary, fontSize: 13 },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, minHeight: 60, textAlignVertical: "top" },
  submitBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.lg },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
})