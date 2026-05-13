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
