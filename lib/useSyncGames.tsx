/**
 * Hook para sincronizar jogos da WC2026 API com debounce no lado do cliente
 * Use isto no seu componente para garantir que os dados sempre estejam atualizados
 */

import { useEffect, useRef, useCallback } from 'react'

interface SyncResponse {
  success: boolean
  cached?: boolean
  gamesUpdated?: number
  totalMatches?: number
  gameStatus?: 'noGame' | 'upcoming' | 'live'
  error?: string
}

export function useSyncGames(enabled = true) {
  const lastSyncRef = useRef<Date | null>(null)
  const isSyncingRef = useRef(false)

  const sync = useCallback(async (): Promise<SyncResponse | null> => {
    if (!enabled || isSyncingRef.current) return null

    try {
      isSyncingRef.current = true

      const response = await fetch('/api/sync-games', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data: SyncResponse = await response.json()

      if (data.success) {
        lastSyncRef.current = new Date()
        console.log('[useSyncGames] Sync bem-sucedido:', data)
      } else {
        console.error('[useSyncGames] Erro no sync:', data.error)
      }

      return data
    } catch (error) {
      console.error('[useSyncGames] Erro ao chamar sync:', error)
      return { success: false, error: String(error) }
    } finally {
      isSyncingRef.current = false
    }
  }, [enabled])

  // Tentar sync quando componente monta
  useEffect(() => {
    if (enabled) {
      sync()
    }
  }, [enabled, sync])

  return {
    sync,
    lastSync: lastSyncRef.current,
    isSyncing: isSyncingRef.current,
  }
}

/**
 * Componente de exemplo usando o hook
 */
export function SyncGamesButton() {
  const { sync, lastSync, isSyncing } = useSyncGames()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => sync()}
        disabled={isSyncing}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {isSyncing ? 'Sincronizando...' : 'Sincronizar Jogos'}
      </button>
      {lastSync && (
        <span className="text-sm text-gray-500">
          Última atualização: {lastSync.toLocaleTimeString('pt-BR')}
        </span>
      )}
    </div>
  )
}
