import axios from "axios"

import { getTokenCookie, clearAuthCookies } from "@/lib/cookies"
 
// All requests go through the Next.js rewrite proxy:
// /api/staff         → {BACKEND}/v1/staff
// /api/school/stats  → {BACKEND}/v1/school/stats
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
})
 
api.interceptors.request.use((config) => {
  const token = getTokenCookie()
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`
  return config
})
 
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      clearAuthCookies()
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)
 
export interface ApiResponse<T> { success: boolean; data: T }
 
export async function get<T>(url: string): Promise<T> {
  const res = await api.get<ApiResponse<T>>(url)
  return res.data.data
}
export async function post<T>(url: string, body?: object): Promise<T> {
  const res = await api.post<ApiResponse<T>>(url, body)
  return res.data.data
}
export async function patch<T>(url: string, body: object): Promise<T> {
  const res = await api.patch<ApiResponse<T>>(url, body)
  return res.data.data
}
export async function del<T>(url: string): Promise<T> {
  const res = await api.delete<ApiResponse<T>>(url)
  return res.data.data
}