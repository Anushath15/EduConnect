import React, { useCallback, useEffect, useState } from "react"
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { api } from "../../src/api/client"
import { useAuthStore } from "../../src/stores/authStore"
import { ScreenHeader } from "../../src/components/ScreenHeader"
import { LoadingView, ErrorView, EmptyView } from "../../src/components/StatusView"
import { colors, spacing, radius, typography } from "../../src/theme"

interface AuditLog {
  id: string
  action: string
  entityType?: string
  entityId?: string
  ipAddress?: string
  createdAt: string
  user?: {
    id: string
    name: string
    role: string
  }
}

interface Meta {
  total: number
  page: number
  limit: number
  totalPages: number
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function ActionBadge({ action }: { action: string }) {
  const method = action.split(" ")[0]
  const color =
    method === "POST"   ? colors.primary  :
    method === "PUT"    ? "#F59E0B"        :
    method === "PATCH"  ? "#F59E0B"        :
    method === "DELETE" ? colors.danger    : colors.textMuted

  return (
    <View style={[ab.badge, { borderColor: color }]}>
      <Text style={[ab.text, { color }]}>{method}</Text>
    </View>
  )
}

const ab = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontSize: 10, fontWeight: "700" },
})

export default function AuditLogsScreen() {
  const { user } = useAuthStore()

  const [logs, setLogs]     = useState<AuditLog[]>([])
  const [meta, setMeta]     = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [page, setPage]     = useState(1)

  const load = useCallback(async (p = 1, append = false) => {
    if (p === 1) setLoading(true)
    setError(null)
    try {
      const res = await api.get("/v1/audit-logs", { params: { page: p, limit: 20 } })
      const newLogs: AuditLog[] = res.data.data
      const newMeta: Meta = res.data.meta
      setLogs(prev => append ? [...prev, ...newLogs] : newLogs)
      setMeta(newMeta)
      setPage(p)
    } catch {
      setError("Failed to load audit logs.")
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { load(1) }, [load])

  const handleRefresh = () => {
    setRefreshing(true)
    load(1)
  }

  const handleLoadMore = () => {
    if (!meta || page >= meta.totalPages || loadingMore) return
    setLoadingMore(true)
    load(page + 1, true)
  }

  if (loading) return <LoadingView label="Loading audit logs..." />
  if (error)   return <ErrorView message={error} onRetry={() => load(1)} />

  return (
    <View style={s.container}>
      <ScreenHeader title="Audit Logs" subtitle="System activity history" showBack />

      {logs.length === 0 ? (
        <EmptyView title="No audit logs yet" icon="shield-checkmark-outline" />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
              : meta && page < meta.totalPages
                ? <TouchableOpacity style={s.loadMoreBtn} onPress={handleLoadMore}>
                    <Text style={s.loadMoreText}>Load more</Text>
                  </TouchableOpacity>
                : null
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardTop}>
                <ActionBadge action={item.action} />
                <Text style={s.time}>{formatTime(item.createdAt)}</Text>
              </View>
              <Text style={s.action} numberOfLines={2}>{item.action}</Text>
              <View style={s.cardBottom}>
                <View style={s.userRow}>
                  <Ionicons name="person-outline" size={12} color={colors.textFaint} />
                  <Text style={s.userName}>{item.user?.name ?? "Unknown"}</Text>
                  <Text style={s.userRole}>· {item.user?.role ?? ""}</Text>
                </View>
                {item.entityType && (
                  <View style={s.entityBadge}>
                    <Text style={s.entityText}>{item.entityType}</Text>
                  </View>
                )}
              </View>
              {item.ipAddress && (
                <Text style={s.ip}>IP: {item.ipAddress}</Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.xl, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, gap: spacing.xs,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  time: { ...typography.caption, fontSize: 11 },
  action: { fontSize: 13, color: colors.textPrimary, fontWeight: "500", marginTop: 4 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  userName: { fontSize: 12, color: colors.textMuted },
  userRole: { fontSize: 11, color: colors.textFaint },
  entityBadge: { backgroundColor: colors.primaryMuted, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  entityText: { color: colors.primary, fontSize: 11, fontWeight: "600" },
  ip: { fontSize: 11, color: colors.textFaint },
  loadMoreBtn: { alignItems: "center", paddingVertical: 12 },
  loadMoreText: { color: colors.primary, fontWeight: "600" },
})
