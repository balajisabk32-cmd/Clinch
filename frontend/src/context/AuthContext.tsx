import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import {
  ApiError, SESSION_EXPIRED, authApi, tokenStore,
  type AuthUser, type Tab,
} from '../lib/authClient'

/**
 * Session state.
 *
 * `isLoading` starts TRUE and only becomes false once /auth/me has answered.
 * Route guards wait on it, which is what prevents the two classic failures: a
 * flash of protected content before the check completes, and a redirect loop
 * where the guard bounces to /login because it read `user === null` a
 * millisecond too early.
 *
 * The cached user is shown while that call is in flight so the shell does not
 * blank out — but it is never trusted: whatever /auth/me returns replaces it,
 * and a 401 clears everything.
 */

interface AuthState {
  user: AuthUser | null
  tabs: Tab[]
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<AuthUser>
  logout: (reason?: 'expired' | 'manual') => void
  refresh: () => Promise<void>
  can: (permission: string) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => tokenStore.cachedUser())
  const [tabs, setTabs] = useState<Tab[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  // The effect body must RE-ARM this, not just disarm it on cleanup.
  // StrictMode mounts, unmounts and remounts every component in development;
  // the cleanup set `mounted.current = false` and nothing ever set it back, so
  // from the second mount onward every `if (mounted.current)` guard below was
  // permanently false. The visible result was an app that authenticated
  // correctly -- /auth/login and /auth/me both returned 200 -- and then sat on
  // "Checking your session..." forever, because setLoading(false) was skipped.
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const logout = useCallback((reason: 'expired' | 'manual' = 'manual') => {
    tokenStore.clear()
    try {
      sessionStorage.removeItem('dealflow360_force_intro')
      sessionStorage.setItem('dealflow360_intro_shown', 'true')
      localStorage.setItem('dealflow360_intro_shown', 'true')
    } catch {}
    if (!mounted.current) return
    setUser(null)
    setTabs([])
    setLoading(false)
    const fromPath = typeof window !== 'undefined' ? window.location.pathname : ''
    // If the user is on the public landing page, stay on the landing page!
    if (fromPath === '/' || fromPath === '') {
      return
    }
    const target = reason === 'expired'
      ? `/login?expired=true&from=${encodeURIComponent(fromPath)}`
      : '/login'
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign(target)
    }
  }, [])

  /** Validate the stored token against the server. */
  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null); setTabs([]); setLoading(false)
      return
    }
    try {
      const me = await authApi.me()
      if (!mounted.current) return
      setUser(me)
      setTabs(me.tabs ?? [])
      tokenStore.set(tokenStore.get()!, me)
    } catch (err) {
      if (!mounted.current) return
      // 401 already cleared storage in the interceptor. Anything else (server
      // down, network blip) must NOT sign the user out -- that would log people
      // out every time the backend restarts.
      if (err instanceof ApiError && err.status === 401) {
        setUser(null); setTabs([])
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // Listeners for expired session and cross-component logout.
  useEffect(() => {
    const onExpired = () => logout('expired')
    const onManualLogout = () => logout('manual')
    window.addEventListener(SESSION_EXPIRED, onExpired)
    window.addEventListener('dealflow360:logout', onManualLogout)
    return () => {
      window.removeEventListener(SESSION_EXPIRED, onExpired)
      window.removeEventListener('dealflow360:logout', onManualLogout)
    }
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    const res = await authApi.login(email, password)
    tokenStore.set(res.access_token, res.user)
    if (mounted.current) {
      setUser(res.user)
      setTabs(res.tabs ?? [])
      setLoading(false)
    }
    return res.user
  }, [])

  const can = useCallback(
    (permission: string) => !!user?.permissions?.includes(permission),
    [user],
  )

  const value = useMemo<AuthState>(() => ({
    user, tabs,
    isAuthenticated: !!user,
    isLoading, error,
    login, logout, refresh, can,
  }), [user, tabs, isLoading, error, login, logout, refresh, can])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
