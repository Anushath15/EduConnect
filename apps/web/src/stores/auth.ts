"use client"
import { create } from "zustand"

import { setAuthCookies, clearAuthCookies, getTokenCookie, getUserCookie } from "@/lib/cookies"
 
export interface WebUser {
  id:      string
  name:    string
  email:   string
  role:    string
  schoolId:string
  school?: { id: string; name: string; subscriptionStatus: string }
}
 
interface AuthState {
  token:          string | null
  user:           WebUser | null
  isAuthenticated:boolean
  login:  (email: string, password: string) => Promise<void>
  logout: () => void
  init:   () => void
}
 
export const useAuthStore = create<AuthState>((set) => ({
  token:           null,
  user:            null,
  isAuthenticated: false,
 
  init: () => {
    const token = getTokenCookie()
    const user  = getUserCookie<WebUser>()
    if (token && user) set({ token, user, isAuthenticated: true })
  },
 
  login: async (email: string, password: string) => {
    // FIXED: /api/auth/login (not /api/v1/auth/login)
    // next.config.js rewrite: /api/:path* → {BACKEND}/v1/:path*
    // So /api/auth/login → /v1/auth/login on the backend ✓
    const res = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    })
 
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error?.message || "Invalid email or password")
    }
 
    const body       = await res.json()
    const accessToken = body.data.accessToken
 
    // Fetch full user profile with the new token
    const meRes = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const meBody = await meRes.json()
    const user   = meBody.data as WebUser
 
    setAuthCookies(accessToken, user)
    set({ token: accessToken, user, isAuthenticated: true })
  },
 
  logout: () => {
    clearAuthCookies()
    set({ token: null, user: null, isAuthenticated: false })
    if (typeof window !== "undefined") window.location.href = "/login"
  },
}))