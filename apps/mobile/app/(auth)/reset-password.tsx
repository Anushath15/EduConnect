import React, { useState } from "react"
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { api } from "../../src/api/client"

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()

  const [token, setToken]               = useState("")
  const [newPassword, setNewPassword]   = useState("")
  const [confirm, setConfirm]           = useState("")
  const [loading, setLoading]           = useState(false)
  const [showPass, setShowPass]         = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)

  const handleReset = async () => {
    if (!token.trim()) {
      Alert.alert("Required", "Enter the reset token from your email.")
      return
    }
    if (newPassword.length < 8) {
      Alert.alert("Weak password", "Password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirm) {
      Alert.alert("Mismatch", "Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      await api.post("/v1/auth/reset-password", {
        token: token.trim(),
        newPassword,
      })
      Alert.alert(
        "Password Reset",
        "Your password has been updated. Please sign in with your new password.",
        [{ text: "Sign In", onPress: () => router.replace("/(auth)/login") }]
      )
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error?.message ?? "Reset failed. The token may have expired.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.logo}>EduConnect</Text>
          <Text style={styles.tagline}>Create a new password</Text>
        </View>

        <View style={styles.form}>
          {!!email && (
            <Text style={styles.emailHint}>Resetting for: {email}</Text>
          )}

          <Text style={styles.label}>Reset Token</Text>
          <TextInput
            style={styles.input}
            placeholder="Paste token from email"
            placeholderTextColor="#64748B"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>New Password</Text>
          <View style={styles.passRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="New password"
              placeholderTextColor="#64748B"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
              <Text style={styles.eyeText}>{showPass ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.passRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Confirm new password"
              placeholderTextColor="#64748B"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
              <Text style={styles.eyeText}>{showConfirm ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rules}>
            <Text style={styles.rulesTitle}>Password requirements:</Text>
            {["At least 8 characters", "One uppercase letter", "One number", "One special character"].map(r => (
              <Text key={r} style={styles.ruleItem}>· {r}</Text>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleReset}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Reset Password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  header: { alignItems: "center", marginBottom: 32 },
  logo: { fontSize: 36, fontWeight: "800", color: "#FFFFFF", letterSpacing: -1 },
  tagline: { fontSize: 15, color: "#94A3B8", marginTop: 6 },
  form: { backgroundColor: "#1E293B", borderRadius: 20, padding: 24, gap: 8 },
  emailHint: { fontSize: 13, color: "#6366F1", marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "600", color: "#CBD5E1", marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: "#0F172A", borderRadius: 12, padding: 14, fontSize: 15, color: "#FFFFFF", borderWidth: 1, borderColor: "#334155" },
  passRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyeBtn: { backgroundColor: "#0F172A", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14, borderWidth: 1, borderColor: "#334155" },
  eyeText: { color: "#6366F1", fontSize: 13, fontWeight: "600" },
  rules: { backgroundColor: "#0F172A", borderRadius: 12, padding: 12, marginTop: 8 },
  rulesTitle: { fontSize: 12, color: "#94A3B8", marginBottom: 6, fontWeight: "600" },
  ruleItem: { fontSize: 12, color: "#64748B", lineHeight: 20 },
  button: { backgroundColor: "#6366F1", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  backLink: { alignItems: "center", marginTop: 12, paddingVertical: 4 },
  backText: { color: "#6366F1", fontSize: 14, fontWeight: "600" },
})
