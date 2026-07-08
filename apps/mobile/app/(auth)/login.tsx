import React, { useState } from "react"
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from "react-native"
import { router } from "expo-router"
import { useAuthStore } from "../../src/stores/authStore"

export default function LoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const { login, isLoading } = useAuthStore()

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter your email and password.")
      return
    }
    try {
      await login(email.trim(), password)
    } catch (error: any) {
      Alert.alert("Login Failed", error.message)
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
          <Text style={styles.tagline}>Smart School Management</Text>
        </View>
        <View style={styles.form}>
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
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#64748B"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => router.push("/(auth)/forgot-password")}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.footer}>EduConnect 2026 - Tamil Nadu Schools</Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  header: { alignItems: "center", marginBottom: 48 },
  logo: { fontSize: 36, fontWeight: "800", color: "#FFFFFF", letterSpacing: -1 },
  tagline: { fontSize: 15, color: "#94A3B8", marginTop: 6 },
  form: { backgroundColor: "#1E293B", borderRadius: 20, padding: 24, gap: 8 },
  label: { fontSize: 13, fontWeight: "600", color: "#CBD5E1", marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: "#0F172A", borderRadius: 12, padding: 14, fontSize: 15, color: "#FFFFFF", borderWidth: 1, borderColor: "#334155" },
  button: { backgroundColor: "#6366F1", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  forgotLink: { alignItems: "center", marginTop: 12, paddingVertical: 4 },
  forgotText: { color: "#6366F1", fontSize: 14, fontWeight: "600" },
  footer: { textAlign: "center", color: "#475569", fontSize: 12, marginTop: 32 },
})

