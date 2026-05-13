-- ===================================================
-- Migração: Adicionar suporte para sincronização WC2026 API
-- Execute este arquivo no SQL Editor do Supabase
-- ===================================================

-- Adicionar coluna para referenciar o jogo na API externa
ALTER TABLE public.games
  ADD COLUMN external_id integer unique;

-- Adicionar índice para melhorar performance de busca
CREATE INDEX IF NOT EXISTS idx_games_external_id ON public.games(external_id);

-- Tabela de controle: quando foi o último sync e status
CREATE TABLE IF NOT EXISTS public.sync_log (
  id serial primary key,
  synced_at timestamptz default now(),
  status text,        -- 'ok' | 'error'
  games_updated integer default 0,
  error_message text,
  duration_ms integer
);

-- Índice para facilitar consultas recentes
CREATE INDEX IF NOT EXISTS idx_sync_log_synced_at ON public.sync_log(synced_at DESC);
