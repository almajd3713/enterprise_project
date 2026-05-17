import { createContext, useContext, useMemo, useState } from 'react'
import { apiGet, apiPost, setToken } from '../../shared/api/http'
import type { LoginResponse, MeResponse } from '../../shared/types'

type AuthContextType = {
  token: string | null
  me: MeResponse | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  hasPermission: (p: string) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [me, setMe] = useState<MeResponse | null>(null)

  async function refreshMe() {
    if (!authToken) return
    const profile = await apiGet<MeResponse>('/auth/me')
    setMe(profile)
  }

  async function login(username: string, password: string) {
    // Ensure stale/invalid tokens are not sent on a new login attempt.
    setToken(null)
    const response = await apiPost<LoginResponse>('/auth/login', { username, password })
    setAuthToken(response.token)
    setToken(response.token)
    try {
      const profile = await apiGet<MeResponse>('/auth/me')
      setMe(profile)
    } catch {
      // Backend already authenticated and issued a token; keep session usable.
      setMe({
        username: response.username,
        email: '',
        active: true,
        lastLoginAt: null,
        lastLogoutAt: null,
        role: response.role,
        roles: response.roles,
        departmentIds: [],
        permissions: response.permissions,
      })
    }
  }

  async function logout() {
    if (authToken) {
      try {
        await apiPost('/auth/logout')
      } catch {
        // ignore logout server errors
      }
    }
    setAuthToken(null)
    setToken(null)
    setMe(null)
  }

  const value = useMemo<AuthContextType>(
    () => ({
      token: authToken,
      me,
      isAuthenticated: Boolean(authToken && me),
      login,
      logout,
      refreshMe,
      hasPermission: (p) => Boolean(me?.permissions.includes(p) || me?.roles.includes('ADMIN')),
    }),
    [authToken, me],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
