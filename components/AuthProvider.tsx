'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { clearLocalAuthState, getPlayerForSessionSafe, withTimeout } from '@/lib/auth'
import { supabase, type Player } from '@/lib/supabase'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthContextValue = {
  status: AuthStatus
  loading: boolean
  session: Session | null
  player: Player | null
  refreshPlayer: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(false)

  const setAnonymous = useCallback(() => {
    setStatus('anonymous')
    setSession(null)
    setPlayer(null)
  }, [])

  const loadSession = useCallback(async (nextSession: Session | null) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    if (!nextSession) {
      if (mountedRef.current && requestIdRef.current === requestId) setAnonymous()
      return
    }

    setStatus('loading')

    const userResult = await withTimeout(supabase.auth.getUser())
    const authUser = userResult.data?.data.user

    if (userResult.error || userResult.data?.error || !authUser || authUser.id !== nextSession.user.id) {
      await clearLocalAuthState()
      if (mountedRef.current && requestIdRef.current === requestId) setAnonymous()
      return
    }

    const playerResult = await getPlayerForSessionSafe(nextSession)
    if (playerResult.error || !playerResult.data) {
      if (mountedRef.current && requestIdRef.current === requestId) setAnonymous()
      return
    }

    if (!mountedRef.current || requestIdRef.current !== requestId) return

    setSession(nextSession)
    setPlayer(playerResult.data)
    setStatus('authenticated')
  }, [setAnonymous])

  const refreshPlayer = useCallback(async () => {
    if (!session) {
      setAnonymous()
      return
    }

    const playerResult = await getPlayerForSessionSafe(session)
    if (playerResult.error || !playerResult.data) {
      setAnonymous()
      return
    }

    setPlayer(playerResult.data)
    setStatus('authenticated')
  }, [session, setAnonymous])

  const signOut = useCallback(async () => {
    requestIdRef.current += 1
    await clearLocalAuthState()
    setAnonymous()
  }, [setAnonymous])

  useEffect(() => {
    mountedRef.current = true

    const bootstrap = async () => {
      setStatus('loading')
      const sessionResult = await withTimeout(supabase.auth.getSession())

      if (sessionResult.error || sessionResult.data?.error) {
        await clearLocalAuthState()
        if (mountedRef.current) setAnonymous()
        return
      }

      await loadSession(sessionResult.data?.data.session ?? null)
    }

    bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void loadSession(nextSession)
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [loadSession, setAnonymous])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    loading: status === 'loading',
    session,
    player,
    refreshPlayer,
    signOut,
  }), [player, refreshPlayer, session, signOut, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
