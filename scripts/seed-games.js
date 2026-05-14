/**
 * Script para popular a tabela games com dados iniciais da WC2026 API
 * Execute com: node scripts/seed-games.js
 *
 * Este script é útil para:
 * - Popular o banco com todos os 64 jogos da Copa 2026
 * - Sincronizar external_ids
 * - Testar a integração antes da Copa começar
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas')
  console.error('   Defina: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const WC2026_API_BASE = 'https://wc2026api.com/api'

async function getMatches() {
  const response = await fetch(`${WC2026_API_BASE}/matches`)
  return response.json()
}

function mapStage(apiStage) {
  const stageMap = {
    'Group Stage': 'Fase de Grupos',
    'Round of 16': 'Oitavas',
    'Quarterfinals': 'Quartas',
    'Semifinals': 'Semifinais',
    'Third Place Playoff': '3º Lugar',
    'Final': 'Final',
  }
  return stageMap[apiStage] || apiStage
}

async function seedGames() {
  console.log('🔄 Iniciando população de jogos...')

  try {
    // Buscar jogos da API
    console.log('📥 Buscando jogos da WC2026 API...')
    const matches = await getMatches()
    console.log(`✅ ${matches.length} jogos encontrados`)

    let inserted = 0
    let updated = 0
    let skipped = 0

    for (const match of matches) {
      const gameData = {
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

      // Verificar se já existe
      const { data: existingGame } = await supabase
        .from('games')
        .select('id')
        .eq('external_id', match.id)
        .single()

      if (existingGame) {
        // Update
        const { error } = await supabase
          .from('games')
          .update(gameData)
          .eq('external_id', match.id)

        if (error) {
          console.error(`⚠️  Erro atualizando ${match.home_team} x ${match.away_team}:`, error)
        } else {
          updated++
        }
      } else {
        // Insert
        const { error } = await supabase
          .from('games')
          .insert({
            ...gameData,
            created_at: new Date().toISOString(),
          })

        if (error) {
          if (error.code === '23505') {
            // Violação de constraint (provavelmente external_id duplicate)
            skipped++
          } else {
            console.error(`⚠️  Erro inserindo ${match.home_team} x ${match.away_team}:`, error)
          }
        } else {
          inserted++
        }
      }

      // Mostrar progresso
      const total = inserted + updated + skipped
      if (total % 10 === 0) {
        console.log(`   Processados: ${total}/${matches.length}`)
      }
    }

    console.log('\n✅ População concluída!')
    console.log(`   Inseridos: ${inserted}`)
    console.log(`   Atualizados: ${updated}`)
    console.log(`   Pulados: ${skipped}`)
  } catch (error) {
    console.error('❌ Erro durante a população:', error)
    process.exit(1)
  }
}

// Executar
seedGames().then(() => {
  console.log('\n🎉 Pronto! Você pode agora usar /api/sync-games para manter os dados atualizados.')
  process.exit(0)
})
