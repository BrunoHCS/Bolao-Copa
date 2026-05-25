-- ===================================================
-- BOLAO COPA 2026 - Fix registration profile creation
-- Execute this file in the Supabase SQL Editor.
-- ===================================================

-- 1. Ensure players are tied to Supabase Auth users.
DELETE FROM public.players p
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = p.id
);

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_id_fkey;

ALTER TABLE public.players
  ADD CONSTRAINT players_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- 2. Keep direct client inserts safe. New signups are handled by the trigger.
DROP POLICY IF EXISTS "Qualquer autenticado pode criar player" ON public.players;
DROP POLICY IF EXISTS "Usuario cria seu proprio player" ON public.players;
DROP POLICY IF EXISTS "Usuário cria seu próprio player" ON public.players;

CREATE POLICY "Usuario cria seu proprio player"
  ON public.players
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. Create player profiles from auth metadata, bypassing RLS safely.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_username text;
  profile_display_name text;
BEGIN
  profile_username := lower(trim(coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(new.email, '@', 1),
    new.id::text
  )));

  profile_display_name := trim(coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    profile_username
  ));

  INSERT INTO public.players (id, username, display_name, is_admin, total_points)
  VALUES (new.id, profile_username, profile_display_name, false, 0)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill auth users that were created before the trigger existed.
INSERT INTO public.players (id, username, display_name, is_admin, total_points)
SELECT
  u.id,
  lower(trim(coalesce(
    nullif(u.raw_user_meta_data ->> 'username', ''),
    split_part(u.email, '@', 1),
    u.id::text
  ))) AS username,
  trim(coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(u.raw_user_meta_data ->> 'username', ''),
    split_part(u.email, '@', 1),
    u.id::text
  )) AS display_name,
  false AS is_admin,
  0 AS total_points
FROM auth.users u
LEFT JOIN public.players p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
