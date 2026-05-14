/**
 * Cliente para a WC2026 API
 * Documentação: https://wc2026api.com
 * Limite: 100 requisições/dia
 */

const WC2026_API_BASE = 'https://wc2026api.com/api'

// Tipos da API WC2026
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
  status: 'Not Started' | 'In Progress' | 'Finished' | 'Postponed'
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

// Mapear stage do WC2026 para o nosso formato
function mapStage(apiStage: string): string {
  const stageMap: Record<string, string> = {
    'Group Stage': 'Fase de Grupos',
    'Round of 16': 'Oitavas',
    'Quarterfinals': 'Quartas',
    'Semifinals': 'Semifinais',
    'Third Place Playoff': '3º Lugar',
    'Final': 'Final',
  }
  return stageMap[apiStage] || apiStage
}

// Buscar todos os jogos da API
export async function getAllMatches(): Promise<WC2026Match[]> {
  try {
    const response = await fetch(`${WC2026_API_BASE}/matches`, {
      next: { revalidate: 0 }, // Sem cache no Next.js
    })

    if (!response.ok) {
      throw new Error(`WC2026 API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error('[WC2026] Erro ao buscar matches:', error)
    throw error
  }
}

// Buscar um jogo específico
export async function getMatch(externalId: number): Promise<WC2026Match> {
  try {
    const response = await fetch(`${WC2026_API_BASE}/match/${externalId}`, {
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      throw new Error(`WC2026 API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error(`[WC2026] Erro ao buscar match ${externalId}:`, error)
    throw error
  }
}

// Buscar jogo de teste (Brasil x Argentina)
export async function getTestMatch(): Promise<WC2026Match> {
  try {
    const response = await fetch(`${WC2026_API_BASE}/test/match`, {
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      throw new Error(`WC2026 API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error('[WC2026] Erro ao buscar test match:', error)
    throw error
  }
}

// Buscar classificações dos grupos
export async function getGroupStandings(): Promise<WC2026GroupStandings[]> {
  try {
    const response = await fetch(`${WC2026_API_BASE}/standings`, {
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      throw new Error(`WC2026 API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error('[WC2026] Erro ao buscar standings:', error)
    throw error
  }
}

// Mapear jogo da API para nosso formato de banco de dados
export function mapMatchToGame(match: WC2026Match): {
  external_id: number
  home_team: string
  away_team: string
  home_flag: string
  away_flag: string
  match_date: string
  stage: string
  home_score: number | null
  away_score: number | null
  is_finished: boolean
} {
  return {
    external_id: match.id,
    home_team: match.home_team,
    away_team: match.away_team,
    home_flag: match.home_flag,
    away_flag: match.away_flag,
    match_date: match.match_date,
    stage: mapStage(match.stage),
    home_score: match.home_score,
    away_score: match.away_score,
    is_finished: match.status === 'Finished',
  }
}
