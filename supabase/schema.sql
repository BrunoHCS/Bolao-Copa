-- ===================================================
-- BOLÃO COPA 2026 — Schema SQL para o Supabase
-- Execute este arquivo no SQL Editor do Supabase
-- ===================================================

-- Tabela de jogadores (usuários)
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
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

create policy "Qualquer autenticado pode criar player" on public.players
  for insert with check (true);

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
('Brasil', 'México', '🇧🇷', '🇲🇽', '2026-06-12 18:00:00-03', 'Fase de Grupos'),
('Argentina', 'Canadá', '🇦🇷', '🇨🇦', '2026-06-13 15:00:00-03', 'Fase de Grupos'),
('França', 'Alemanha', '🇫🇷', '🇩🇪', '2026-06-14 18:00:00-03', 'Fase de Grupos'),
('Portugal', 'Espanha', '🇵🇹', '🇪🇸', '2026-06-15 18:00:00-03', 'Fase de Grupos'),
('Uruguai', 'Estados Unidos', '🇺🇾', '🇺🇸', '2026-06-16 21:00:00-03', 'Fase de Grupos'),
('Inglaterra', 'Japão', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇯🇵', '2026-06-17 18:00:00-03', 'Fase de Grupos'),
('Brasil', 'Alemanha', '🇧🇷', '🇩🇪', '2026-06-18 18:00:00-03', 'Fase de Grupos'),
('Argentina', 'França', '🇦🇷', '🇫🇷', '2026-06-19 21:00:00-03', 'Fase de Grupos');
