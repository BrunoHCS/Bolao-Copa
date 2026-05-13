import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/cron
 * Endpoint chamado pelo Vercel Cron (1x/dia no plano gratuito)
 * Realiza um sync diário dos jogos da WC2026 API
 */
export async function GET(request: NextRequest) {
  try {
    // Validar que a requisição vem do Vercel Cron
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token || token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Chamar o endpoint de sincronização
    const syncResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync-games`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SYNC_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const syncData = await syncResponse.json()

    if (!syncResponse.ok) {
      console.error('[cron] Erro no sync:', syncData)
      return NextResponse.json(
        {
          success: false,
          error: 'Sync falhou',
          details: syncData,
        },
        { status: 500 }
      )
    }

    console.log('[cron] Sync realizado com sucesso:', syncData)

    return NextResponse.json(
      {
        success: true,
        message: 'Cron job executado com sucesso',
        syncResult: syncData,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[cron] Erro:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}

/**
 * HEAD /api/cron
 * Vercel Cron faz um HEAD request antes de chamar o GET
 */
export async function HEAD() {
  return new Response(null, { status: 200 })
}
