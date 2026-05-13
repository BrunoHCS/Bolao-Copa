# Arquitetura de Sincronização WC2026 API

## Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUÁRIO (Frontend)                        │
│                      app/page.tsx (React)                        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ useSyncGames() hook
                 │ GET /api/sync-games
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                   NEXT.JS API ROUTE                              │
│              app/api/sync-games/route.ts                         │
│                                                                  │
│  1. Verifica tempo desde último sync                            │
│  2. Aplica debounce inteligente                                 │
│  3. Se passou intervalo mínimo:                                 │
│     → Chama getAllMatches() da WC2026 API                       │
│     → Para cada jogo:                                            │
│        • INSERT novo jogo                                        │
│        • UPDATE placar mudou                                     │
│        • RPC calculate_points se finalizou                       │
│  4. Registra resultado em sync_log                              │
└────┬─────────────────────────────────────────────────────────────┘
     │
     ├─────────────────────────────────────┐
     │                                     │
     ↓                                     ↓
┌──────────────────┐         ┌──────────────────────┐
│  WC2026 API      │         │  Supabase Database   │
│  (100 req/dia)   │         │                      │
│                  │         │  tables:             │
│  /api/matches    │────────→│  • games             │
│  /api/match/:id  │         │    - external_id     │
│  /api/standings  │         │    - home_score      │
│                  │         │    - away_score      │
│                  │         │    - is_finished     │
│                  │         │  • sync_log          │
└──────────────────┘         │    - status          │
                             │    - duration_ms     │
                             │    - error_message   │
                             └──────────────────────┘
```

## Fluxo de Requisição Detalhado

```
PASSO 1: VERIFICAR NECESSIDADE DE SYNC
╔════════════════════════════════════════════╗
║ GET /api/sync-games                        ║
║ (sem autenticação, protegido por debounce) ║
╚════════════════════════════════════════════╝
         ↓
   ┌─────────────────────────────────────────┐
   │ Buscar último sync em sync_log           │
   │ Determinar status dos jogos              │
   │ (none/upcoming/live)                     │
   └─────────────────────────────────────────┘
         ↓
   ┌─────────────────────────────────────────┐
   │ Debounce:                               │
   │ • none:     aguardar 60 min             │
   │ • upcoming: aguardar 15 min             │
   │ • live:     aguardar 2 min              │
   └─────────────────────────────────────────┘
         ↓
   ┌──────────────────┬──────────────────┐
   │ Passou ?         │ Não              │
   └──────────────────┴──────────────────┘
         ↓
   Retorna: {
     success: true,
     cached: true,
     message: "Último sync há X minutos..."
   }


PASSO 2: BUSCAR DADOS DA API
╔════════════════════════════════════════════╗
║ getAllMatches() → WC2026 API               ║
║ GET https://wc2026api.com/api/matches      ║
╚════════════════════════════════════════════╝
         ↓
   ┌─────────────────────────────────────────┐
   │ WC2026 retorna array de 64 jogos:       │
   │ [{                                       │
   │   id: 1,                                │
   │   home_team: "Brasil",                  │
   │   away_team: "Argentina",               │
   │   status: "In Progress" | "Finished"... │
   │   home_score: 2,                        │
   │   away_score: 1                         │
   │ }, ...]                                 │
   └─────────────────────────────────────────┘


PASSO 3: SINCRONIZAR COM SUPABASE
╔════════════════════════════════════════════╗
║ Para cada jogo da API:                     ║
╚════════════════════════════════════════════╝
         ↓
   ┌─────────────────────────────────────────┐
   │ SELECT * FROM games                     │
   │ WHERE external_id = match.id            │
   └─────────────────────────────────────────┘
         ↓
    ┌────────────────┬─────────────────┐
    │ Existe ?       │ Não             │
    └────────────────┴─────────────────┘
         ↓
    ┌──────────────────────────────────────┐
    │ INSERT novo jogo com:                │
    │ • external_id = match.id             │
    │ • home_team, away_team, ...          │
    │ • home_score = null (ainda não joga) │
    │ • is_finished = false                │
    └──────────────────────────────────────┘
         ↓
    Sim (jogo existe)
         ↓
    ┌──────────────────────────────────────┐
    │ Score mudou ou status mudou ?        │
    │ (home_score, away_score, is_finished)│
    └──────────────────────────────────────┘
         ↓
    ┌────────────────┬─────────────────┐
    │ Sim            │ Não             │
    └────────────────┴─────────────────┘
    ↓                ↓
   UPDATE           (nada)


PASSO 4: CALCULAR PONTOS (se jogo finalizou)
╔════════════════════════════════════════════╗
║ SELECT RPC('calculate_points', game_id)    ║
║ (atualiza coluna 'points' em bets)         ║
╚════════════════════════════════════════════╝
         ↓
    Supabase RPC:
    • Palpite placar exato = 3 pontos
    • Palpite resultado (W/D/L) = 1 ponto
    • Nenhum = 0 pontos


PASSO 5: REGISTRAR SINCRONIZAÇÃO
╔════════════════════════════════════════════╗
║ INSERT INTO sync_log (                     ║
║   status, games_updated, duration_ms, ... ║
║ )                                          ║
╚════════════════════════════════════════════╝
         ↓
    Registra:
    • status: 'ok' | 'partial' | 'error'
    • games_updated: quantidade
    • duration_ms: tempo gasto
    • error_message: se houver erros


PASSO 6: RESPOSTA AO FRONTEND
╔════════════════════════════════════════════╗
║ Retorna:                                   ║
║ {                                          ║
║   success: true,                           ║
║   cached: false,                           ║
║   gamesUpdated: 3,                         ║
║   totalMatches: 64,                        ║
║   durationMs: 1250,                        ║
║   gameStatus: 'live',                      ║
║   nextDebounce: 2                          ║
║ }                                          ║
╚════════════════════════════════════════════╝
```

## Cron Job (Vercel)

```
Vercel Cron (plano gratuito)
        │
        ├── 1 cron por deploy
        ├── Frequência mínima: 1x/dia
        │
        └→ Configurado em vercel.json
           schedule: "0 */6 * * *" (a cada 6 horas)
           path: "/api/cron"
           │
           └→ GET /api/cron
              (com Authorization: Bearer CRON_SECRET)
              │
              └→ Chama POST /api/sync-games
                 (com Authorization: Bearer SYNC_TOKEN)
                 │
                 └→ Executa sync independente do usuário
```

## Controle de Requisições

```
100 Requisições/dia da WC2026 API
│
├─ Cron job (Vercel):        4 requests  (6h, 12h, 18h, 24h)
│
├─ Usuários (debounce):      ~86 requests
│  ├─ Sem jogo hoje:   60min debounde = ~24 req máx
│  ├─ Jogo próximo:    15min debounce = ~16 req/jogo
│  └─ Ao vivo:         2min debounce  = ~45 req/jogo
│
└─ TOTAL:                     ~90-100 requests/dia ✅
```

## Segurança

```
┌─────────────────────────────────────────┐
│ GET /api/sync-games                     │
│ (SEM autenticação, protegido por        │
│  debounce de servidor)                  │
│                                         │
│ ✅ Qualquer um pode chamar              │
│ ✅ Mas só faz sync se passou intervalo  │
│ ✅ Nenhuma chave exposta no frontend    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ POST /api/sync-games                    │
│ (COM autenticação)                      │
│                                         │
│ Header: Authorization: Bearer SYNC_TOKEN│
│ ❌ Apenas use para webhooks/internals   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ GET /api/cron                           │
│ (COM autenticação - Vercel)             │
│                                         │
│ Header: Authorization: Bearer CRON_SECRET│
│ ❌ Apenas Vercel Cron pode chamar       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ SUPABASE_SERVICE_ROLE_KEY               │
│ ❌ NUNCA exponha no frontend            │
│ ✅ Apenas em .env.local e variáveis do  │
│    servidor (Next.js API routes)        │
└─────────────────────────────────────────┘
```

## Performance & Escalabilidade

```
1. Debounce reduz requisições:
   100 usuários online simultaneamente
   = 1 requisição para a API (primeira chamada)
   = resto lê cache do Supabase

2. Supabase cache (read replicas):
   - Centenas de queries/segundo
   - Sem impacto na WC2026 API

3. Vercel Cron:
   - Sync mesmo sem usuários online
   - Plano gratuito: 1x/dia
   - Configurado: 4x/dia (melhor cobertura)

4. Índices no banco:
   - games.external_id: para UPDATE rápido
   - sync_log.synced_at: para verificar último sync
```
