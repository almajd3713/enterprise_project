import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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
const SESSION_KEY = 'dms_auth_session'
const SESSION_TTL_MS = 10 * 60 * 1000

type PersistedSession = {
  token: string
  me: MeResponse
  expiresAt: number
}

function loadPersistedSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSession
    if (!parsed?.token || !parsed?.me || typeof parsed?.expiresAt !== 'number') {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    if (Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

function persistSession(token: string, me: MeResponse) {
  const payload: PersistedSession = {
    token,
    me,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
}

function clearPersistedSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialSession = loadPersistedSession()
  const [authToken, setAuthToken] = useState<string | null>(initialSession?.token ?? null)
  const [me, setMe] = useState<MeResponse | null>(initialSession?.me ?? null)

  async function refreshMe() {
    if (!authToken) return
    const profile = await apiGet<MeResponse>('/auth/me')
    setMe(profile)
    persistSession(authToken, profile)
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
      persistSession(response.token, profile)
    } catch {
      // Backend already authenticated and issued a token; keep session usable.
      const fallbackMe = {
        username: response.username,
        email: '',
        active: true,
        lastLoginAt: null,
        lastLogoutAt: null,
        role: response.role,
        roles: response.roles,
        departmentIds: [],
        permissions: response.permissions,
      }
      setMe(fallbackMe)
      persistSession(response.token, fallbackMe)
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
    clearPersistedSession()
  }

  useEffect(() => {
    if (!authToken) {
      setToken(null)
      clearPersistedSession()
      return
    }
    setToken(authToken)
    const persisted = loadPersistedSession()
    const msLeft = persisted ? persisted.expiresAt - Date.now() : SESSION_TTL_MS
    if (msLeft <= 0) {
      void logout()
      return
    }
    const timer = window.setTimeout(() => {
      void logout()
    }, msLeft)
    return () => window.clearTimeout(timer)
  }, [authToken])

  useEffect(() => {
    if (authToken && !me) {
      void refreshMe()
    }
  }, [authToken, me])

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
