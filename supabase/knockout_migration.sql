-- ===================================================
-- BOLAO COPA 2026 - Grupos da Copa e mata-mata
-- Execute este arquivo no SQL Editor do Supabase.
-- Ele preserva games, bets e players existentes.
-- ===================================================

create extension if not exists pgcrypto;

create table if not exists public.world_cup_teams (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  flag text not null default '🏳',
  group_code text not null check (group_code in ('A','B','C','D','E','F','G','H','I','J','K','L')),
  group_seed integer not null check (group_seed between 1 and 4),
  created_at timestamptz default now()
);

create table if not exists public.team_standings_overrides (
  team_id uuid primary key references public.world_cup_teams(id) on delete cascade,
  fair_play_points integer,
  manual_tiebreak_order integer,
  notes text,
  updated_at timestamptz default now()
);

alter table public.games add column if not exists match_number integer unique;
alter table public.games add column if not exists stage_order integer default 10;
alter table public.games add column if not exists home_team_id uuid references public.world_cup_teams(id);
alter table public.games add column if not exists away_team_id uuid references public.world_cup_teams(id);
alter table public.games add column if not exists home_slot text;
alter table public.games add column if not exists away_slot text;
alter table public.games add column if not exists winner_team_id uuid references public.world_cup_teams(id);
alter table public.games add column if not exists loser_team_id uuid references public.world_cup_teams(id);
alter table public.games add column if not exists is_published boolean default true;

create table if not exists public.fifa_third_place_mappings (
  qualified_groups text primary key,
  match_74_group text,
  match_77_group text,
  match_79_group text,
  match_80_group text,
  match_81_group text,
  match_82_group text,
  match_85_group text,
  match_87_group text,
  updated_at timestamptz default now()
);

alter table public.world_cup_teams enable row level security;
alter table public.team_standings_overrides enable row level security;
alter table public.fifa_third_place_mappings enable row level security;

drop policy if exists "Selecoes visiveis para todos" on public.world_cup_teams;
create policy "Selecoes visiveis para todos" on public.world_cup_teams
  for select using (true);

drop policy if exists "Desempates visiveis para todos" on public.team_standings_overrides;
create policy "Desempates visiveis para todos" on public.team_standings_overrides
  for select using (true);

drop policy if exists "Admin gerencia desempates" on public.team_standings_overrides;
create policy "Admin gerencia desempates" on public.team_standings_overrides
  for all using (
    exists (select 1 from public.players where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.players where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Mapeamentos visiveis para todos" on public.fifa_third_place_mappings;
create policy "Mapeamentos visiveis para todos" on public.fifa_third_place_mappings
  for select using (true);

drop policy if exists "Admin gerencia mapeamentos" on public.fifa_third_place_mappings;
create policy "Admin gerencia mapeamentos" on public.fifa_third_place_mappings
  for all using (
    exists (select 1 from public.players where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.players where id = auth.uid() and is_admin = true)
  );

insert into public.world_cup_teams (name, flag, group_code, group_seed) values
('México','🇲🇽','A',1),('África do Sul','🇿🇦','A',2),('Coreia do Sul','🇰🇷','A',3),('República Tcheca','🇨🇿','A',4),
('Canadá','🇨🇦','B',1),('Bósnia e Herzegovina','🇧🇦','B',2),('Catar','🇶🇦','B',3),('Suíça','🇨🇭','B',4),
('Brasil','🇧🇷','C',1),('Marrocos','🇲🇦','C',2),('Haiti','🇭🇹','C',3),('Escócia','🏴󠁧󠁢󠁳󠁣󠁴󠁿','C',4),
('Estados Unidos','🇺🇸','D',1),('Paraguai','🇵🇾','D',2),('Austrália','🇦🇺','D',3),('Turquia','🇹🇷','D',4),
('Alemanha','🇩🇪','E',1),('Curaçao','🇨🇼','E',2),('Costa do Marfim','🇨🇮','E',3),('Equador','🇪🇨','E',4),
('Holanda','🇳🇱','F',1),('Japão','🇯🇵','F',2),('Suécia','🇸🇪','F',3),('Tunísia','🇹🇳','F',4),
('Bélgica','🇧🇪','G',1),('Egito','🇪🇬','G',2),('Irã','🇮🇷','G',3),('Nova Zelândia','🇳🇿','G',4),
('Espanha','🇪🇸','H',1),('Cabo Verde','🇨🇻','H',2),('Arábia Saudita','🇸🇦','H',3),('Uruguai','🇺🇾','H',4),
('França','🇫🇷','I',1),('Senegal','🇸🇳','I',2),('Iraque','🇮🇶','I',3),('Noruega','🇳🇴','I',4),
('Argentina','🇦🇷','J',1),('Argélia','🇩🇿','J',2),('Áustria','🇦🇹','J',3),('Jordânia','🇯🇴','J',4),
('Portugal','🇵🇹','K',1),('RD Congo','🇨🇩','K',2),('Uzbequistão','🇺🇿','K',3),('Colômbia','🇨🇴','K',4),
('Inglaterra','🏴󠁧󠁢󠁥󠁮󠁧󠁿','L',1),('Croácia','🇭🇷','L',2),('Gana','🇬🇭','L',3),('Panamá','🇵🇦','L',4)
on conflict (name) do update set
  flag = excluded.flag,
  group_code = excluded.group_code,
  group_seed = excluded.group_seed;

update public.games set home_team = 'Catar' where home_team = 'Qatar';
update public.games set away_team = 'Catar' where away_team = 'Qatar';

update public.games g
set
  home_team_id = ht.id,
  home_flag = ht.flag
from public.world_cup_teams ht
where g.home_team = ht.name and g.home_team_id is null;

update public.games g
set
  away_team_id = at.id,
  away_flag = at.flag
from public.world_cup_teams at
where g.away_team = at.name and g.away_team_id is null;

update public.games
set stage_order = case stage
  when 'Fase de Grupos' then 10
  when '16 avos' then 20
  when 'Oitavas de Final' then 30
  when 'Quartas de Final' then 40
  when 'Semifinal' then 50
  when 'Disputa 3º Lugar' then 60
  when 'Final' then 70
  else coalesce(stage_order, 10)
end,
is_published = coalesce(is_published, true);

create or replace function public.get_group_standings()
returns table (
  team_id uuid,
  team_name text,
  flag text,
  group_code text,
  played integer,
  wins integer,
  draws integer,
  losses integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer,
  fair_play_points integer,
  manual_tiebreak_order integer,
  group_position integer,
  qualified_status text
) as $$
begin
  return query
  with team_games as (
    select
      t.id as team_id,
      t.name as team_name,
      t.flag,
      t.group_code,
      case when g.home_team_id = t.id then g.home_score else g.away_score end as gf,
      case when g.home_team_id = t.id then g.away_score else g.home_score end as ga
    from public.world_cup_teams t
    left join public.games g on (
      g.stage = 'Fase de Grupos'
      and g.is_finished = true
      and (g.home_team_id = t.id or g.away_team_id = t.id)
    )
  ),
  totals as (
    select
      tg.team_id,
      tg.team_name,
      tg.flag,
      tg.group_code,
      count(tg.gf)::integer as played,
      count(*) filter (where tg.gf > tg.ga)::integer as wins,
      count(*) filter (where tg.gf = tg.ga)::integer as draws,
      count(*) filter (where tg.gf < tg.ga)::integer as losses,
      coalesce(sum(tg.gf), 0)::integer as goals_for,
      coalesce(sum(tg.ga), 0)::integer as goals_against,
      (coalesce(sum(tg.gf), 0) - coalesce(sum(tg.ga), 0))::integer as goal_difference,
      (
        count(*) filter (where tg.gf > tg.ga) * 3
        + count(*) filter (where tg.gf = tg.ga)
      )::integer as points
    from team_games tg
    group by tg.team_id, tg.team_name, tg.flag, tg.group_code
  ),
  ranked as (
    select
      totals.*,
      o.fair_play_points,
      o.manual_tiebreak_order,
      row_number() over (
        partition by totals.group_code
        order by
          totals.points desc,
          totals.goal_difference desc,
          totals.goals_for desc,
          totals.wins desc,
          coalesce(o.manual_tiebreak_order, 999) asc,
          coalesce(o.fair_play_points, 0) desc,
          totals.team_name asc
      )::integer as group_position
    from totals
    left join public.team_standings_overrides o on o.team_id = totals.team_id
  )
  select
    r.team_id,
    r.team_name,
    r.flag,
    r.group_code,
    r.played,
    r.wins,
    r.draws,
    r.losses,
    r.goals_for,
    r.goals_against,
    r.goal_difference,
    r.points,
    r.fair_play_points,
    r.manual_tiebreak_order,
    r.group_position,
    case
      when r.group_position <= 2 then 'Classificado'
      when r.group_position = 3 then 'Terceiro colocado'
      else 'Eliminado'
    end as qualified_status
  from ranked r
  order by r.group_code, r.group_position;
end;
$$ language plpgsql security definer;

create or replace function public.get_best_thirds()
returns table (
  third_rank integer,
  team_id uuid,
  team_name text,
  flag text,
  group_code text,
  played integer,
  wins integer,
  draws integer,
  losses integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer,
  qualified boolean
) as $$
begin
  return query
  with standings as (
    select
      s.*,
      row_number() over (
        order by
          s.points desc,
          s.goal_difference desc,
          s.goals_for desc,
          s.wins desc,
          coalesce(s.manual_tiebreak_order, 999) asc,
          coalesce(s.fair_play_points, 0) desc,
          s.group_code asc
      )::integer as third_rank
    from public.get_group_standings() s
    where s.group_position = 3
  )
  select
    s.third_rank,
    s.team_id,
    s.team_name,
    s.flag,
    s.group_code,
    s.played,
    s.wins,
    s.draws,
    s.losses,
    s.goals_for,
    s.goals_against,
    s.goal_difference,
    s.points,
    s.third_rank <= 8 as qualified
  from standings s
  order by s.third_rank;
end;
$$ language plpgsql security definer;

create or replace function public.generate_round_of_32()
returns text as $$
declare
  unfinished integer;
  generated integer := 0;
  third_groups text[];
  used_third_groups text[] := array[]::text[];
  team_home uuid;
  team_away uuid;
  slot_home text;
  slot_away text;
  match_rec record;
  away_group text;
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin = true) then
    raise exception 'Apenas admin pode gerar o mata-mata.';
  end if;

  select count(*) into unfinished
  from public.games
  where stage = 'Fase de Grupos' and is_finished = false;

  if unfinished > 0 then
    raise exception 'Ainda existem % jogos da fase de grupos sem resultado.', unfinished;
  end if;

  select array_agg(group_code order by group_code) into third_groups
  from public.get_best_thirds()
  where qualified = true;

  if coalesce(array_length(third_groups, 1), 0) <> 8 then
    raise exception 'Nao foi possivel identificar os 8 melhores terceiros.';
  end if;

  for match_rec in
    select * from (values
      (73, '2A', '2B', '2026-06-28 13:00:00-03'::timestamptz),
      (74, '1E', '3ABCDF', '2026-06-28 16:00:00-03'::timestamptz),
      (75, '1F', '2C', '2026-06-28 19:00:00-03'::timestamptz),
      (76, '1C', '2F', '2026-06-29 13:00:00-03'::timestamptz),
      (77, '1I', '3CDFGH', '2026-06-29 16:00:00-03'::timestamptz),
      (78, '2E', '2I', '2026-06-29 19:00:00-03'::timestamptz),
      (79, '1A', '3CEFHI', '2026-06-30 13:00:00-03'::timestamptz),
      (80, '1L', '3EHIJK', '2026-06-30 16:00:00-03'::timestamptz),
      (81, '1D', '3BEFIJ', '2026-07-01 13:00:00-03'::timestamptz),
      (82, '1G', '3AEHIJ', '2026-07-01 16:00:00-03'::timestamptz),
      (83, '2K', '2L', '2026-07-01 19:00:00-03'::timestamptz),
      (84, '1H', '2J', '2026-07-02 13:00:00-03'::timestamptz),
      (85, '1B', '3EFGIJ', '2026-07-02 16:00:00-03'::timestamptz),
      (86, '1J', '2H', '2026-07-02 19:00:00-03'::timestamptz),
      (87, '1K', '3DEIJL', '2026-07-03 13:00:00-03'::timestamptz),
      (88, '2D', '2G', '2026-07-03 16:00:00-03'::timestamptz)
    ) as m(match_number, home_slot, away_slot, match_date)
  loop
    slot_home := match_rec.home_slot;
    slot_away := replace(match_rec.away_slot, ' ', '');

    select s.team_id into team_home
    from public.get_group_standings() s
    where s.group_code = substring(slot_home from 2 for 1)
      and s.group_position = substring(slot_home from 1 for 1)::integer;

    if left(slot_away, 1) = '3' then
      select g into away_group
      from unnest(third_groups) as g
      where position(g in substring(slot_away from 2)) > 0
        and not (g = any(used_third_groups))
      order by position(g in substring(slot_away from 2))
      limit 1;

      if away_group is null then
        raise exception 'Nao foi possivel resolver o terceiro colocado para o jogo %.', match_rec.match_number;
      end if;

      used_third_groups := array_append(used_third_groups, away_group);
      select s.team_id into team_away
      from public.get_group_standings() s
      where s.group_code = away_group and s.group_position = 3;
      slot_away := '3' || away_group;
    else
      select s.team_id into team_away
      from public.get_group_standings() s
      where s.group_code = substring(slot_away from 2 for 1)
        and s.group_position = substring(slot_away from 1 for 1)::integer;
    end if;

    insert into public.games (
      match_number, stage_order, home_team_id, away_team_id, home_team, away_team,
      home_flag, away_flag, home_slot, away_slot, match_date, stage, is_published
    )
    select
      match_rec.match_number, 20, team_home, team_away,
      ht.name, at.name, ht.flag, at.flag, slot_home, slot_away,
      match_rec.match_date, '16 avos', true
    from public.world_cup_teams ht, public.world_cup_teams at
    where ht.id = team_home and at.id = team_away
    on conflict (match_number) do update set
      home_team_id = excluded.home_team_id,
      away_team_id = excluded.away_team_id,
      home_team = excluded.home_team,
      away_team = excluded.away_team,
      home_flag = excluded.home_flag,
      away_flag = excluded.away_flag,
      home_slot = excluded.home_slot,
      away_slot = excluded.away_slot,
      stage = excluded.stage,
      stage_order = excluded.stage_order,
      is_published = true;

    generated := generated + 1;
    away_group := null;
  end loop;

  perform public.ensure_knockout_placeholders();
  return generated || ' jogos dos 16 avos gerados/publicados.';
end;
$$ language plpgsql security definer;

create or replace function public.ensure_knockout_placeholders()
returns void as $$
declare
  m record;
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin = true) then
    raise exception 'Apenas admin pode preparar o mata-mata.';
  end if;

  for m in
    select * from (values
      (89, 30, 'Oitavas de Final', 'V73', 'V75', '2026-07-04 13:00:00-03'::timestamptz),
      (90, 30, 'Oitavas de Final', 'V74', 'V77', '2026-07-04 16:00:00-03'::timestamptz),
      (91, 30, 'Oitavas de Final', 'V76', 'V78', '2026-07-05 13:00:00-03'::timestamptz),
      (92, 30, 'Oitavas de Final', 'V79', 'V80', '2026-07-05 16:00:00-03'::timestamptz),
      (93, 30, 'Oitavas de Final', 'V83', 'V84', '2026-07-06 13:00:00-03'::timestamptz),
      (94, 30, 'Oitavas de Final', 'V81', 'V82', '2026-07-06 16:00:00-03'::timestamptz),
      (95, 30, 'Oitavas de Final', 'V86', 'V88', '2026-07-07 13:00:00-03'::timestamptz),
      (96, 30, 'Oitavas de Final', 'V85', 'V87', '2026-07-07 16:00:00-03'::timestamptz),
      (97, 40, 'Quartas de Final', 'V89', 'V90', '2026-07-09 16:00:00-03'::timestamptz),
      (98, 40, 'Quartas de Final', 'V93', 'V94', '2026-07-10 16:00:00-03'::timestamptz),
      (99, 40, 'Quartas de Final', 'V91', 'V92', '2026-07-11 16:00:00-03'::timestamptz),
      (100, 40, 'Quartas de Final', 'V95', 'V96', '2026-07-12 16:00:00-03'::timestamptz),
      (101, 50, 'Semifinal', 'V97', 'V98', '2026-07-14 16:00:00-03'::timestamptz),
      (102, 50, 'Semifinal', 'V99', 'V100', '2026-07-15 16:00:00-03'::timestamptz),
      (103, 60, 'Disputa 3º Lugar', 'L101', 'L102', '2026-07-18 16:00:00-03'::timestamptz),
      (104, 70, 'Final', 'V101', 'V102', '2026-07-19 16:00:00-03'::timestamptz)
    ) as p(match_number, stage_order, stage, home_slot, away_slot, match_date)
  loop
    insert into public.games (
      match_number, stage_order, stage, home_slot, away_slot, home_team, away_team,
      home_flag, away_flag, match_date, is_published
    )
    values (
      m.match_number, m.stage_order, m.stage, m.home_slot, m.away_slot,
      m.home_slot, m.away_slot, '🏳', '🏳', m.match_date, false
    )
    on conflict (match_number) do nothing;
  end loop;
end;
$$ language plpgsql security definer;

create or replace function public.fill_knockout_slot(match_number_param integer, slot text, team_id_param uuid)
returns void as $$
declare
  t record;
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin = true) then
    raise exception 'Apenas admin pode preencher jogos do mata-mata.';
  end if;

  select * into t from public.world_cup_teams where id = team_id_param;
  if not found then
    raise exception 'Selecao nao encontrada.';
  end if;

  if slot = 'home' then
    update public.games
    set home_team_id = t.id, home_team = t.name, home_flag = t.flag
    where match_number = match_number_param;
  elsif slot = 'away' then
    update public.games
    set away_team_id = t.id, away_team = t.name, away_flag = t.flag
    where match_number = match_number_param;
  else
    raise exception 'Slot invalido.';
  end if;

  update public.games
  set is_published = home_team_id is not null and away_team_id is not null
  where match_number = match_number_param;
end;
$$ language plpgsql security definer;

create or replace function public.advance_knockout_winner(game_id_param uuid, winner_team_id_param uuid default null)
returns text as $$
declare
  g record;
  winner uuid;
  loser uuid;
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin = true) then
    raise exception 'Apenas admin pode avancar vencedores.';
  end if;

  select * into g from public.games where id = game_id_param;
  if not found then
    raise exception 'Jogo nao encontrado.';
  end if;

  if g.stage = 'Fase de Grupos' then
    raise exception 'Avanco automatico so vale para mata-mata.';
  end if;

  if not g.is_finished or g.home_score is null or g.away_score is null then
    raise exception 'Informe o resultado antes de avancar o vencedor.';
  end if;

  if g.home_score > g.away_score then
    winner := g.home_team_id;
    loser := g.away_team_id;
  elsif g.away_score > g.home_score then
    winner := g.away_team_id;
    loser := g.home_team_id;
  else
    winner := winner_team_id_param;
    if winner is null then
      raise exception 'Jogo empatado. Escolha manualmente o vencedor.';
    end if;
    if winner = g.home_team_id then
      loser := g.away_team_id;
    elsif winner = g.away_team_id then
      loser := g.home_team_id;
    else
      raise exception 'Vencedor manual nao pertence a este jogo.';
    end if;
  end if;

  update public.games
  set winner_team_id = winner, loser_team_id = loser
  where id = g.id;

  if g.match_number in (73, 75) then
    perform public.fill_knockout_slot(89, case when g.match_number = 73 then 'home' else 'away' end, winner);
  elsif g.match_number in (74, 77) then
    perform public.fill_knockout_slot(90, case when g.match_number = 74 then 'home' else 'away' end, winner);
  elsif g.match_number in (76, 78) then
    perform public.fill_knockout_slot(91, case when g.match_number = 76 then 'home' else 'away' end, winner);
  elsif g.match_number in (79, 80) then
    perform public.fill_knockout_slot(92, case when g.match_number = 79 then 'home' else 'away' end, winner);
  elsif g.match_number in (83, 84) then
    perform public.fill_knockout_slot(93, case when g.match_number = 83 then 'home' else 'away' end, winner);
  elsif g.match_number in (81, 82) then
    perform public.fill_knockout_slot(94, case when g.match_number = 81 then 'home' else 'away' end, winner);
  elsif g.match_number in (86, 88) then
    perform public.fill_knockout_slot(95, case when g.match_number = 86 then 'home' else 'away' end, winner);
  elsif g.match_number in (85, 87) then
    perform public.fill_knockout_slot(96, case when g.match_number = 85 then 'home' else 'away' end, winner);
  elsif g.match_number in (89, 90) then
    perform public.fill_knockout_slot(97, case when g.match_number = 89 then 'home' else 'away' end, winner);
  elsif g.match_number in (93, 94) then
    perform public.fill_knockout_slot(98, case when g.match_number = 93 then 'home' else 'away' end, winner);
  elsif g.match_number in (91, 92) then
    perform public.fill_knockout_slot(99, case when g.match_number = 91 then 'home' else 'away' end, winner);
  elsif g.match_number in (95, 96) then
    perform public.fill_knockout_slot(100, case when g.match_number = 95 then 'home' else 'away' end, winner);
  elsif g.match_number in (97, 98) then
    perform public.fill_knockout_slot(101, case when g.match_number = 97 then 'home' else 'away' end, winner);
  elsif g.match_number in (99, 100) then
    perform public.fill_knockout_slot(102, case when g.match_number = 99 then 'home' else 'away' end, winner);
  elsif g.match_number = 101 then
    perform public.fill_knockout_slot(104, 'home', winner);
    perform public.fill_knockout_slot(103, 'home', loser);
  elsif g.match_number = 102 then
    perform public.fill_knockout_slot(104, 'away', winner);
    perform public.fill_knockout_slot(103, 'away', loser);
  end if;

  return 'Vencedor avancado.';
end;
$$ language plpgsql security definer;
