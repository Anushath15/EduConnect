import React, { useState } from "react"
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from "react-native"
import { router } from "expo-router"
import { api } from "../../src/api/client"

export default function ForgotPasswordScreen() {
  const [email, setEmail]       = useState("")
  const [loading, setLoading]   = useState(false)

  const handleSend = async () => {
    const trimmed = email.trim()
    if (!trimmed) {
      Alert.alert("Required", "Please enter your email address.")
      return
    }

    setLoading(true)
    try {
      await api.post("/v1/auth/forgot-password", { email: trimmed })
      // Always navigate forward regardless of whether the email exists
      // (server response is always the same to prevent user enumeration)
      router.push({
        pathname: "/(auth)/reset-password",
        params: { email: trimmed },
      })
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error?.message ?? "Something went wrong. Please try again.")
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
          <Text style={styles.tagline}>Reset your password</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.instruction}>
            Enter your registered email address and we'll send you a reset link.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="admin@school.com"
            placeholderTextColor="#64748B"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  header: { alignItems: "center", marginBottom: 40 },
  logo: { fontSize: 36, fontWeight: "800", color: "#FFFFFF", letterSpacing: -1 },
  tagline: { fontSize: 15, color: "#94A3B8", marginTop: 6 },
  form: { backgroundColor: "#1E293B", borderRadius: 20, padding: 24, gap: 8 },
  instruction: { fontSize: 14, color: "#94A3B8", lineHeight: 20, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: "600", color: "#CBD5E1", marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: "#0F172A", borderRadius: 12, padding: 14, fontSize: 15, color: "#FFFFFF", borderWidth: 1, borderColor: "#334155" },
  button: { backgroundColor: "#6366F1", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  backLink: { alignItems: "center", marginTop: 12, paddingVertical: 4 },
  backText: { color: "#6366F1", fontSize: 14, fontWeight: "600" },
})
