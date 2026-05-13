/**
 * Tipos TypeScript para integração WC2026 API
 * Adicione isto ao seu lib/supabase.ts existente se desejar centralizar tipos
 */

import type { Game } from '@/lib/supabase'

// Tipos da API WC2026
export type WC2026MatchStatus = 'Not Started' | 'In Progress' | 'Finished' | 'Postponed'

export interface WC2026Match {
  id: number
  home_team: string
  away_team: string
  home_flag: string
  away_flag: string
  home_code: string
  away_code: string
  match_date: string
  stage: string
  status: WC2026MatchStatus
  home_score: number | null
  away_score: number | null
}

export interface WC2026Standing {
  group: string
  team: string
  flag: string
  played: number
  won: number
  draw: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

export interface WC2026GroupStandings {
  group: string
  standings: WC2026Standing[]
}

// Tipo para resposta do sync
export interface SyncGamesResponse {
  success: boolean
  cached?: boolean
  gamesUpdated?: number
  totalMatches?: number
  durationMs?: number
  gameStatus?: 'noGame' | 'upcoming' | 'live'
  nextDebounce?: number
  errors?: string[]
  error?: string
  message?: string
}

// Tipo para registros de sync_log
export interface SyncLog {
  id: number
  synced_at: string
  status: 'ok' | 'partial' | 'error'
  games_updated: number
  error_message: string | null
  duration_ms: number | null
}

// Estender tipo Game existente com external_id
export interface GameWithExternal extends Game {
  external_id?: number | null
}
