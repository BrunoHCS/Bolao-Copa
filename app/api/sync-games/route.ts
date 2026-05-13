import { createClient } from '@supabase/supabase-js'
import { getAllMatches, mapMatchToGame } from '@/lib/wc2026'
import { NextRequest, NextResponse } from 'next/server'

// Cliente Supabase com chave de serviço (server-side apenas)
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// Intervalo mínimo entre syncs (em minutos)
const DEBOUNCE_CONFIG = {
  noGame: 60, // 60 min sem jogo hoje
  upcoming: 15, // 15 min com jogo a caminho
  live: 2, // 2 min com jogo ao vivo
}

/**
 * Verifica se é necessário fazer sync baseado no tempo desde o último
 */
async function shouldSync(
  lastSyncAt: Date | null,
  gameStatus: 'noGame' | 'upcoming' | 'live'
): Promise<boolean> {
  if (!lastSyncAt) return true // Primeiro sync

  const debounceMinutes =
    gameStatus === 'live'
      ? DEBOUNCE_CONFIG.live
      : gameStatus === 'upcoming'
        ? DEBOUNCE_CONFIG.upcoming
        : DEBOUNCE_CONFIG.noGame

  const minutesElapsed = (Date.now() - lastSyncAt.getTime()) / 1000 / 60
  return minutesElapsed >= debounceMinutes
}

/**
 * Determina o status dos jogos (para debounce inteligente)
 */
async function getGameStatus(matches: any[]): Promise<'noGame' | 'upcoming' | 'live'> {
  const now = new Date()
  const hasLive = matches.some(
    (m) => m.status === 'In Progress'
  )
  const hasUpcoming = matches.some((m) => {
    const matchTime = new Date(m.match_date)
    return matchTime > now && matchTime < new Date(now.getTime() + 24 * 60 * 60 * 1000)
  })

  if (hasLive) return 'live'
  if (hasUpcoming) return 'upcoming'
  return 'noGame'
}

/**
 * GET /api/sync-games
 * Sincroniza jogos da WC2026 API com o Supabase
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Buscar último sync do banco de dados
    const { data: lastSync } = await supabaseServiceRole
      .from('sync_log')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single()

    const lastSyncAt = lastSync ? new Date(lastSync.synced_at) : null

    // Buscar todos os jogos da API externa
    const matches = await getAllMatches()

    // Determinar status dos jogos para debounce inteligente
    const gameStatus = await getGameStatus(matches)

    // Verificar se deve fazer sync (debounce)
    const mustSync = await shouldSync(lastSyncAt, gameStatus)

    if (!mustSync) {
      return NextResponse.json(
        {
          success: true,
          cached: true,
          message: `Sync realizado há ${Math.round((Date.now() - lastSyncAt!.getTime()) / 60000)} minutos. Próximo sync disponível em ${DEBOUNCE_CONFIG[gameStatus]}min.`,
        },
        { status: 200 }
      )
    }

    let gamesUpdated = 0
    const errors: string[] = []

    // Processar cada jogo
    for (const match of matches) {
      try {
        const gameData = mapMatchToGame(match)

        // Buscar jogo existente
        const { data: existingGame } = await supabaseServiceRole
          .from('games')
          .select('id, home_score, away_score, is_finished')
          .eq('external_id', gameData.external_id)
          .single()

        if (!existingGame) {
          // Novo jogo: INSERT
          const { error } = await supabaseServiceRole
            .from('games')
            .insert({
              ...gameData,
              created_at: new Date().toISOString(),
            })

          if (error) {
            errors.push(`INSERT ${match.home_team} x ${match.away_team}: ${error.message}`)
          } else {
            gamesUpdated++
          }
        } else {
          // Jogo existente: verificar se precisa UPDATE
          const scoreChanged =
            existingGame.home_score !== gameData.home_score ||
            existingGame.away_score !== gameData.away_score

          if (scoreChanged || existingGame.is_finished !== gameData.is_finished) {
            const { error } = await supabaseServiceRole
              .from('games')
              .update(gameData)
              .eq('external_id', gameData.external_id)

            if (error) {
              errors.push(`UPDATE ${match.home_team} x ${match.away_team}: ${error.message}`)
            } else {
              gamesUpdated++

              // Se jogo foi finalizado agora, calcular pontos
              if (
                !existingGame.is_finished &&
                gameData.is_finished
              ) {
                try {
                  await supabaseServiceRole.rpc('calculate_points', {
                    game_id_param: existingGame.id,
                  })
                } catch (rpcError) {
                  errors.push(`RPC calculate_points para ${match.home_team} x ${match.away_team}: ${String(rpcError)}`)
                }
              }
            }
          }
        }
      } catch (matchError) {
        errors.push(`Erro processando ${match.home_team} x ${match.away_team}: ${String(matchError)}`)
      }
    }

    const duration = Date.now() - startTime
    const syncStatus = errors.length === 0 ? 'ok' : 'partial'

    // Registrar no sync_log
    await supabaseServiceRole.from('sync_log').insert({
      status: syncStatus,
      games_updated: gamesUpdated,
      error_message: errors.length > 0 ? errors.join('\n') : null,
      duration_ms: duration,
    })

    return NextResponse.json(
      {
        success: true,
        cached: false,
        gamesUpdated,
        totalMatches: matches.length,
        durationMs: duration,
        gameStatus,
        nextDebounce: DEBOUNCE_CONFIG[gameStatus],
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 200 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.error('[sync-games] Erro:', error)

    // Registrar erro no sync_log (ignorar se falhar)
    try {
      await supabaseServiceRole
        .from('sync_log')
        .insert({
          status: 'error',
          games_updated: 0,
          error_message: errorMessage,
          duration_ms: duration,
        })
    } catch (logError) {
      console.error('[sync-games] Erro ao registrar em sync_log:', logError)
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        durationMs: duration,
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sync-games
 * Endpoint para chamar sync via POST (útil para testes e webhooks)
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  // Validar token de sincronização (deve ser igual a SYNC_TOKEN no .env)
  if (!token || token !== process.env.SYNC_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return GET(request)
}
