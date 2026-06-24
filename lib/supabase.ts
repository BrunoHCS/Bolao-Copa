import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Player = {
  id: string
  username: string
  display_name: string
  is_admin: boolean
  total_points: number
  created_at: string
}

export type Game = {
  id: string
  home_team: string
  away_team: string
  home_flag: string
  away_flag: string
  match_date: string
  stage: string
  match_number?: number | null
  stage_order?: number | null
  home_team_id?: string | null
  away_team_id?: string | null
  home_slot?: string | null
  away_slot?: string | null
  winner_team_id?: string | null
  loser_team_id?: string | null
  is_published?: boolean | null
  home_score: number | null
  away_score: number | null
  is_finished: boolean
}

export type Bet = {
  id: string
  player_id: string
  game_id: string
  home_score: number
  away_score: number
  points: number
}

export type Group = {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
}

export type GroupMember = {
  group_id: string
  player_id: string
  joined_at: string
}

export type WorldCupTeam = {
  id: string
  name: string
  flag: string
  group_code: string
  group_seed: number
}

export type GroupStanding = {
  team_id: string
  team_name: string
  flag: string
  group_code: string
  played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  fair_play_points: number | null
  manual_tiebreak_order: number | null
  group_position: number
  qualified_status: string
}

export type BestThird = Omit<GroupStanding, 'fair_play_points' | 'manual_tiebreak_order' | 'group_position' | 'qualified_status'> & {
  third_rank: number
  qualified: boolean
}
