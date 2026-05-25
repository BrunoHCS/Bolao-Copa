-- ===================================================
-- BOLÃO COPA 2026 — Schema SQL para o Supabase
-- Execute este arquivo no SQL Editor do Supabase
-- ===================================================

-- Tabela de jogadores (usuários)
create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  is_admin boolean default false,
  total_points integer default 0,
  created_at timestamptz default now()
);

-- Tabela de jogos da copa
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  home_team text not null,
  away_team text not null,
  home_flag text not null,
  away_flag text not null,
  match_date timestamptz not null,
  stage text not null default 'Fase de Grupos',
  home_score integer,
  away_score integer,
  is_finished boolean default false,
  created_at timestamptz default now()
);

-- Tabela de palpites
create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,
  home_score integer not null,
  away_score integer not null,
  points integer default 0,
  created_at timestamptz default now(),
  unique(player_id, game_id)
);

-- RLS (Row Level Security)
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.bets enable row level security;

-- Políticas para players
create policy "Players visíveis para todos" on public.players
  for select using (true);

create policy "Usuário pode atualizar seus próprios dados" on public.players
  for update using (auth.uid()::text = id::text);

create policy "Usuario cria seu proprio player" on public.players
  for insert with check (auth.uid() = id);

-- Criar perfil automaticamente quando um usuario e cadastrado no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_username text;
  profile_display_name text;
begin
  profile_username := lower(trim(coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(new.email, '@', 1),
    new.id::text
  )));

  profile_display_name := trim(coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    profile_username
  ));

  insert into public.players (id, username, display_name, is_admin, total_points)
  values (new.id, profile_username, profile_display_name, false, 0)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Políticas para games
create policy "Jogos visíveis para todos" on public.games
  for select using (true);

create policy "Apenas admin insere jogos" on public.games
  for insert with check (
    exists (select 1 from public.players where id::text = auth.uid()::text and is_admin = true)
  );

create policy "Apenas admin atualiza jogos" on public.games
  for update using (
    exists (select 1 from public.players where id::text = auth.uid()::text and is_admin = true)
  );

-- Políticas para bets
create policy "Palpites visíveis para todos" on public.bets
  for select using (true);

create policy "Usuário cria seus próprios palpites" on public.bets
  for insert with check (auth.uid()::text = player_id::text);

create policy "Usuário atualiza seus próprios palpites" on public.bets
  for update using (auth.uid()::text = player_id::text);

create policy "Admin atualiza qualquer palpite" on public.bets
  for update using (
    exists (select 1 from public.players where id::text = auth.uid()::text and is_admin = true)
  );

-- Função para calcular e atualizar pontos após resultado
create or replace function calculate_points(game_id_param uuid)
returns void as $$
declare
  game_record record;
  bet_record record;
  pts integer;
begin
  select * into game_record from public.games where id = game_id_param;

  for bet_record in (select * from public.bets where game_id = game_id_param) loop
    pts := 0;
    if bet_record.home_score = game_record.home_score and bet_record.away_score = game_record.away_score then
      pts := 3;
    elsif (
      (bet_record.home_score > bet_record.away_score and game_record.home_score > game_record.away_score) or
      (bet_record.home_score < bet_record.away_score and game_record.home_score < game_record.away_score) or
      (bet_record.home_score = bet_record.away_score and game_record.home_score = game_record.away_score)
    ) then
      pts := 1;
    end if;

    update public.bets set points = pts where id = bet_record.id;
  end loop;

  -- Recalcular total de pontos de cada jogador
  update public.players p
  set total_points = (
    select coalesce(sum(b.points), 0)
    from public.bets b
    where b.player_id = p.id
  );
end;
$$ language plpgsql security definer;

-- Jogos da Copa do Mundo 2026 — Fase de Grupos (seleção)
insert into public.games (home_team, away_team, home_flag, away_flag, match_date, stage) values
('México', 'África do Sul', '🇲🇽', '🇿🇦', '2026-06-11 16:00:00-03', 'Fase de Grupos'),
('Coreia do Sul', 'República Tcheca', '🇰🇷', '🇨🇿', '2026-06-11 23:00:00-03', 'Fase de Grupos'),
('Canadá', 'Bósnia e Herzegovina', '🇨🇦', '🇧🇦', '2026-06-12 16:00:00-03', 'Fase de Grupos'),
('Estados Unidos', 'Paraguai', '🇺🇸', '🇵🇾', '2026-06-12 22:00:00-03', 'Fase de Grupos'),
('Qatar', 'Suíça', '🇶🇦', '🇨🇭', '2026-06-13 16:00:00-03', 'Fase de Grupos'),
('Brasil', 'Marrocos', '🇧🇷', '🇲🇦', '2026-06-13 19:00:00-03', 'Fase de Grupos'),
('Haiti', 'Escócia', '🇭🇹', '🇬🇧', '2026-06-13 22:00:00-03', 'Fase de Grupos'),
('Austrália', 'Turquia', '🇦🇺', '🇹🇷', '2026-06-14 01:00:00-03', 'Fase de Grupos'),
('Alemanha', 'Curaçau', '🇩🇪', '🇨🇼', '2026-06-14 14:00:00-03', 'Fase de Grupos'),
('Holanda', 'Japão', '🇳🇱', '🇯🇵', '2026-06-14 17:00:00-03', 'Fase de Grupos'),
('Costa do Marfim', 'Equador', '🇨🇮', '🇪🇨', '2026-06-14 20:00:00-03', 'Fase de Grupos'),
('Suécia', 'Tunísia', '🇸🇪', '🇹🇳', '2026-06-14 23:00:00-03', 'Fase de Grupos'),
('Espanha', 'Cabo Verde', '🇪🇸', '🇨🇻', '2026-06-15 13:00:00-03', 'Fase de Grupos'),
('Bélgica', 'Egito', '🇧🇪', '🇪🇬', '2026-06-15 16:00:00-03', 'Fase de Grupos'),
('Arábia Saudita', 'Uruguai', '🇸🇦', '🇺🇾', '2026-06-15 19:00:00-03', 'Fase de Grupos'),
('Irã', 'Nova Zelândia', '🇮🇷', '🇳🇿', '2026-06-15 22:00:00-03', 'Fase de Grupos'),
('França', 'Senegal', '🇫🇷', '🇸🇳', '2026-06-16 16:00:00-03', 'Fase de Grupos'),
('Iraque', 'Noruega', '🇮🇶', '🇳🇴', '2026-06-16 19:00:00-03', 'Fase de Grupos'),
('Argentina', 'Argélia', '🇦🇷', '🇩🇿', '2026-06-16 22:00:00-03', 'Fase de Grupos'),
('Áustria', 'Jordânia', '🇦🇹', '🇯🇴', '2026-06-17 01:00:00-03', 'Fase de Grupos'),
('Portugal', 'RD Congo', '🇵🇹', '🇨🇩', '2026-06-17 14:00:00-03', 'Fase de Grupos'),
('Inglaterra', 'Croácia', '🇬🇧', '🇭🇷', '2026-06-17 17:00:00-03', 'Fase de Grupos'),
('Gana', 'Panamá', '🇬🇭', '🇵🇦', '2026-06-17 20:00:00-03', 'Fase de Grupos'),
('Uzbequistão', 'Colômbia', '🇺🇿', '🇨🇴', '2026-06-17 23:00:00-03', 'Fase de Grupos'),
('República Tcheca', 'África do Sul', '🇨🇿', '🇿🇦', '2026-06-18 13:00:00-03', 'Fase de Grupos'),
('Suíça', 'Bósnia e Herzegovina', '🇨🇭', '🇧🇦', '2026-06-18 16:00:00-03', 'Fase de Grupos'),
('Canadá', 'Qatar', '🇨🇦', '🇶🇦', '2026-06-18 19:00:00-03', 'Fase de Grupos'),
('México', 'Coreia do Sul', '🇲🇽', '🇰🇷', '2026-06-18 22:00:00-03', 'Fase de Grupos'),
('Estados Unidos', 'Austrália', '🇺🇸', '🇦🇺', '2026-06-19 16:00:00-03', 'Fase de Grupos'),
('Escócia', 'Marrocos', '🇬🇧', '🇲🇦', '2026-06-19 19:00:00-03', 'Fase de Grupos'),
('Brasil', 'Haiti', '🇧🇷', '🇭🇹', '2026-06-19 22:00:00-03', 'Fase de Grupos'),
('Turquia', 'Paraguai', '🇹🇷', '🇵🇾', '2026-06-20 13:00:00-03', 'Fase de Grupos'),
('Alemanha', 'Costa do Marfim', '🇩🇪', '🇨🇮', '2026-06-20 16:00:00-03', 'Fase de Grupos'),
('Equador', 'Curaçau', '🇪🇨', '🇨🇼', '2026-06-20 19:00:00-03', 'Fase de Grupos'),
('Holanda', 'Suécia', '🇳🇱', '🇸🇪', '2026-06-20 22:00:00-03', 'Fase de Grupos'),
('Tunísia', 'Japão', '🇹🇳', '🇯🇵', '2026-06-21 01:00:00-03', 'Fase de Grupos'),
('Espanha', 'Arábia Saudita', '🇪🇸', '🇸🇦', '2026-06-21 13:00:00-03', 'Fase de Grupos'),
('Uruguai', 'Cabo Verde', '🇺🇾', '🇨🇻', '2026-06-21 16:00:00-03', 'Fase de Grupos'),
('Bélgica', 'Irã', '🇧🇪', '🇮🇷', '2026-06-21 19:00:00-03', 'Fase de Grupos'),
('Nova Zelândia', 'Egito', '🇳🇿', '🇪🇬', '2026-06-21 22:00:00-03', 'Fase de Grupos'),
('França', 'Iraque', '🇫🇷', '🇮🇶', '2026-06-22 16:00:00-03', 'Fase de Grupos'),
('Noruega', 'Senegal', '🇳🇴', '🇸🇳', '2026-06-22 19:00:00-03', 'Fase de Grupos'),
('Argentina', 'Áustria', '🇦🇷', '🇦🇹', '2026-06-22 22:00:00-03', 'Fase de Grupos'),
('Jordânia', 'Argélia', '🇯🇴', '🇩🇿', '2026-06-23 01:00:00-03', 'Fase de Grupos'),
('Portugal', 'Uzbequistão', '🇵🇹', '🇺🇿', '2026-06-23 13:00:00-03', 'Fase de Grupos'),
('Inglaterra', 'Gana', '🇬🇧', '🇬🇭', '2026-06-23 16:00:00-03', 'Fase de Grupos'),
('Panamá', 'Croácia', '🇵🇦', '🇭🇷', '2026-06-23 19:00:00-03', 'Fase de Grupos'),
('Colômbia', 'RD Congo', '🇨🇴', '🇨🇩', '2026-06-23 22:00:00-03', 'Fase de Grupos'),
('África do Sul', 'Coreia do Sul', '🇿🇦', '🇰🇷', '2026-06-24 13:00:00-03', 'Fase de Grupos'),
('República Tcheca', 'México', '🇨🇿', '🇲🇽', '2026-06-24 13:00:00-03', 'Fase de Grupos'),
('Suíça', 'Canadá', '🇨🇭', '🇨🇦', '2026-06-24 16:00:00-03', 'Fase de Grupos'),
('Bósnia e Herzegovina', 'Qatar', '🇧🇦', '🇶🇦', '2026-06-24 16:00:00-03', 'Fase de Grupos'),
('Marrocos', 'Haiti', '🇲🇦', '🇭🇹', '2026-06-25 13:00:00-03', 'Fase de Grupos'),
('Escócia', 'Brasil', '🇬🇧', '🇧🇷', '2026-06-25 13:00:00-03', 'Fase de Grupos'),
('Paraguai', 'Austrália', '🇵🇾', '🇦🇺', '2026-06-25 16:00:00-03', 'Fase de Grupos'),
('Turquia', 'Estados Unidos', '🇹🇷', '🇺🇸', '2026-06-25 16:00:00-03', 'Fase de Grupos'),
('Curaçau', 'Costa do Marfim', '🇨🇼', '🇨🇮', '2026-06-25 19:00:00-03', 'Fase de Grupos'),
('Equador', 'Alemanha', '🇪🇨', '🇩🇪', '2026-06-25 19:00:00-03', 'Fase de Grupos'),
('Japão', 'Suécia', '🇯🇵', '🇸🇪', '2026-06-26 13:00:00-03', 'Fase de Grupos'),
('Tunísia', 'Holanda', '🇹🇳', '🇳🇱', '2026-06-26 13:00:00-03', 'Fase de Grupos'),
('Egito', 'Irã', '🇪🇬', '🇮🇷', '2026-06-26 16:00:00-03', 'Fase de Grupos'),
('Nova Zelândia', 'Bélgica', '🇳🇿', '🇧🇪', '2026-06-26 16:00:00-03', 'Fase de Grupos'),
('Cabo Verde', 'Arábia Saudita', '🇨🇻', '🇸🇦', '2026-06-26 19:00:00-03', 'Fase de Grupos'),
('Uruguai', 'Espanha', '🇺🇾', '🇪🇸', '2026-06-26 19:00:00-03', 'Fase de Grupos'),
('Senegal', 'Iraque', '🇸🇳', '🇮🇶', '2026-06-27 13:00:00-03', 'Fase de Grupos'),
('Noruega', 'França', '🇳🇴', '🇫🇷', '2026-06-27 13:00:00-03', 'Fase de Grupos'),
('Argélia', 'Áustria', '🇩🇿', '🇦🇹', '2026-06-27 16:00:00-03', 'Fase de Grupos'),
('Jordânia', 'Argentina', '🇯🇴', '🇦🇷', '2026-06-27 16:00:00-03', 'Fase de Grupos'),
('Colômbia', 'Portugal', '🇨🇴', '🇵🇹', '2026-06-27 19:00:00-03', 'Fase de Grupos'),
('RD Congo', 'Uzbequistão', '🇨🇩', '🇺🇿', '2026-06-27 19:00:00-03', 'Fase de Grupos'),
('Panamá', 'Inglaterra', '🇵🇦', '🇬🇧', '2026-06-27 20:30:00-03', 'Fase de Grupos'),
('Croácia', 'Gana', '🇭🇷', '🇬🇭', '2026-06-27 20:30:00-03', 'Fase de Grupos');