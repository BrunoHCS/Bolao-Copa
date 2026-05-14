#!/usr/bin/env node

/**
 * Script de validação da integração WC2026 API
 * Execute com: node scripts/validate-setup.js
 * 
 * Este script valida:
 * - Variáveis de ambiente configuradas
 * - Conexão com Supabase
 * - Acesso à WC2026 API
 * - Status das tabelas (games, sync_log)
 */

const { createClient } = require('@supabase/supabase-js')

const checks = {
  env: false,
  supabase: false,
  api: false,
  tables: false,
}

async function checkEnv() {
  console.log('\n📋 Checando variáveis de ambiente...')
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SYNC_TOKEN',
    'CRON_SECRET',
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    console.log(`   ❌ Variáveis faltando: ${missing.join(', ')}`)
    console.log(`   💡 Copie .env.example para .env.local e preencha os valores`)
    return false
  }

  console.log(`   ✅ Todas as variáveis configuradas`)
  return true
}

async function checkSupabase() {
  console.log('\n🔌 Testando conexão com Supabase...')

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Tentar uma query simples
    const { data, error } = await supabase.from('players').select('count', { count: 'exact' })

    if (error) {
      console.log(`   ❌ Erro ao conectar: ${error.message}`)
      return false
    }

    console.log(`   ✅ Conectado ao Supabase`)
    return true
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`)
    return false
  }
}

async function checkAPI() {
  console.log('\n🌐 Testando conexão com WC2026 API...')

  try {
    const response = await fetch('https://wc2026api.com/api/matches', {
      headers: { 'User-Agent': 'BoloCopa2026-Validator' },
    })

    if (!response.ok) {
      console.log(`   ❌ API respondeu com status ${response.status}`)
      return false
    }

    const data = await response.json()

    if (!Array.isArray(data) || data.length === 0) {
      console.log(`   ⚠️  API retornou resposta vazia ou inválida`)
      return false
    }

    console.log(`   ✅ API acessível (${data.length} jogos encontrados)`)
    return true
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`)
    console.log(`   💡 Verifique sua conexão com a internet ou acesso a https://wc2026api.com`)
    return false
  }
}

async function checkTables() {
  console.log('\n📊 Checando estrutura das tabelas...')

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Verificar tabela games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .limit(1)

    if (gamesError && !gamesError.message.includes('no rows')) {
      console.log(`   ❌ Erro ao acessar tabela 'games': ${gamesError.message}`)
      return false
    }

    // Verificar se external_id existe
    const { data: gamesCheck, error: extError } = await supabase
      .from('games')
      .select('external_id')
      .limit(1)

    if (extError && !extError.message.includes('column')) {
      console.log(`   ⚠️  Coluna 'external_id' pode não existir em 'games'`)
      console.log(`   💡 Execute migration_wc2026_sync.sql no Supabase`)
      return false
    }

    // Verificar tabela sync_log
    const { data: syncLog, error: syncError } = await supabase
      .from('sync_log')
      .select('id')
      .limit(1)

    if (syncError && syncError.message.includes('relation')) {
      console.log(`   ⚠️  Tabela 'sync_log' não existe`)
      console.log(`   💡 Execute migration_wc2026_sync.sql no Supabase`)
      return false
    }

    console.log(`   ✅ Estrutura das tabelas OK`)
    return true
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`)
    return false
  }
}

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔍 VALIDAÇÃO - Integração WC2026 API')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  checks.env = await checkEnv()
  if (!checks.env) {
    console.log('\n❌ Configure as variáveis de ambiente primeiro')
    process.exit(1)
  }

  checks.supabase = await checkSupabase()
  checks.api = await checkAPI()
  checks.tables = await checkTables()

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 RESUMO:')
  console.log(`   Variáveis de ambiente: ${checks.env ? '✅' : '❌'}`)
  console.log(`   Supabase:              ${checks.supabase ? '✅' : '❌'}`)
  console.log(`   WC2026 API:            ${checks.api ? '✅' : '❌'}`)
  console.log(`   Estrutura de tabelas:  ${checks.tables ? '✅' : '⚠️'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (checks.env && checks.supabase && checks.api && checks.tables) {
    console.log('\n✅ Tudo OK! Você pode usar /api/sync-games')
    console.log('\n   Para testar: npm run dev')
    console.log('              curl http://localhost:3000/api/sync-games')
    process.exit(0)
  } else if (checks.env && checks.supabase && checks.api) {
    console.log('\n⚠️  Execute a migration SQL e execute este script novamente')
    console.log('\n   supabase/migration_wc2026_sync.sql')
    process.exit(1)
  } else {
    console.log('\n❌ Verifique os erros acima e tente novamente')
    process.exit(1)
  }
}

run()
