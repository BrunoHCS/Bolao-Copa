import type { Session } from '@supabase/supabase-js'
import { supabase, type Player } from '@/lib/supabase'

export type AuthResult<T> = {
  data: T | null
  error?: Error
  timedOut?: boolean
}

const AUTH_TIMEOUT_MS = 5000

function toError(error: unknown, fallback: string) {
  if (error instanceof Error) return error
  if (typeof error === 'object' && error && 'message' in error) {
    return new Error(String(error.message))
  }
  return new Error(fallback)
}

export async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs = AUTH_TIMEOUT_MS,
): Promise<AuthResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const data = await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Tempo limite excedido')), timeoutMs)
      }),
    ])

    return { data }
  } catch (error) {
    return {
      data: null,
      error: toError(error, 'Erro inesperado'),
      timedOut: error instanceof Error && error.message === 'Tempo limite excedido',
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

function getSupabaseStorageKey() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null

  try {
    const host = new URL(supabaseUrl).host
    const projectRef = host.split('.')[0]
    return projectRef ? `sb-${projectRef}-auth-token` : null
  } catch {
    return null
  }
}

export async function clearLocalAuthState() {
  try {
    await withTimeout(supabase.auth.signOut({ scope: 'local' }), 2500)
  } catch {
    // Manual storage cleanup below is the important fallback.
  }

  if (typeof window === 'undefined') return

  const knownKey = getSupabaseStorageKey()
  if (knownKey) window.localStorage.removeItem(knownKey)

  for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i)
    if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
      window.localStorage.removeItem(key)
    }
  }
}

export async function getCurrentSessionSafe(): Promise<AuthResult<Session>> {
  const result = await withTimeout(supabase.auth.getSession())

  if (result.error || !result.data) {
    return { data: null, error: result.error, timedOut: result.timedOut }
  }

  const { data, error } = result.data
  if (error) {
    await clearLocalAuthState()
    return { data: null, error: toError(error, 'Sessao invalida') }
  }

  return { data: data.session }
}

export async function getPlayerForSessionSafe(session: Session): Promise<AuthResult<Player>> {
  const result = await withTimeout(
    supabase.from('players').select('*').eq('id', session.user.id).single(),
  )

  if (result.error || !result.data) {
    return { data: null, error: result.error, timedOut: result.timedOut }
  }

  const { data, error } = result.data
  if (error || !data) {
    await clearLocalAuthState()
    return { data: null, error: toError(error, 'Perfil nao encontrado') }
  }

  return { data }
}

export async function getCurrentPlayerSafe(): Promise<AuthResult<Player>> {
  const session = await getCurrentSessionSafe()
  if (session.error || session.timedOut || !session.data) {
    return { data: null, error: session.error, timedOut: session.timedOut }
  }

  return getPlayerForSessionSafe(session.data)
}
