-- ===================================================
-- BOLÃO COPA 2026 — Correções de Segurança e Integridade
-- Execute este arquivo no SQL Editor do Supabase
-- ===================================================

-- -----------------------------------------------
-- 1. FK CASCADE: players → auth.users
--    Quando um usuário for deletado no painel do
--    Supabase, o registro em public.players é
--    apagado automaticamente.
-- -----------------------------------------------

-- Remove constraint antiga se existir (ignora erro se não existir)
ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_id_fkey;

ALTER TABLE public.players
  ADD CONSTRAINT players_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- -----------------------------------------------
-- 2. Limpar registros órfãos
--    Players que existem sem um auth.users
--    correspondente (sobras de deleções anteriores)
-- -----------------------------------------------

DELETE FROM public.players p
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = p.id
);

-- -----------------------------------------------
-- 3. Corrigir RLS: policy de INSERT em players
--    A policy antiga permitia qualquer autenticado
--    criar um player com QUALQUER id.
--    A nova exige que auth.uid() == id do player.
-- -----------------------------------------------

DROP POLICY IF EXISTS "Qualquer autenticado pode criar player" ON public.players;

CREATE POLICY "Usuário cria seu próprio player"
  ON public.players
  FOR INSERT
  WITH CHECK (auth.uid()::text = id::text);
