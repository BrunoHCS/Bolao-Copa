-- ===================================================
-- GRUPOS — Execute este arquivo no SQL Editor do Supabase
-- ===================================================

-- Extensão para hashing de senha (já vem no Supabase)
create extension if not exists pgcrypto;

-- Tabela de grupos
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  password_hash text not null,
  owner_id uuid references public.players(id) on delete cascade,
  created_at timestamptz default now()
);

-- Tabela de membros do grupo
create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, player_id)
);

-- RLS
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Grupos: visíveis apenas para membros
create policy "Grupo visível apenas para membros" on public.groups
  for select using (
    exists (
      select 1 from public.group_members
      where group_id = id and player_id = auth.uid()
    )
  );

create policy "Autenticado pode criar grupo" on public.groups
  for insert with check (auth.uid() is not null);

create policy "Dono pode atualizar grupo" on public.groups
  for update using (owner_id = auth.uid());

create policy "Dono pode deletar grupo" on public.groups
  for delete using (owner_id = auth.uid());

-- Membros: visíveis apenas para outros membros do mesmo grupo
create policy "Membros visíveis apenas para membros do grupo" on public.group_members
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.player_id = auth.uid()
    )
  );

create policy "Usuário insere a si mesmo via rpc" on public.group_members
  for insert with check (player_id = auth.uid());

create policy "Usuário pode sair do grupo" on public.group_members
  for delete using (player_id = auth.uid());

create policy "Palpites só antes do jogo" on public.bets
  for insert with check (
    auth.uid()::text = player_id::text AND
    (select match_date from public.games where id = game_id) > now()
  );

-- ===================================================
-- Função: criar grupo (já adiciona o criador como membro)
-- ===================================================
create or replace function create_group(
  group_name text,
  group_description text,
  group_password text
)
returns uuid as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  insert into public.groups (name, description, password_hash, owner_id)
  values (
    trim(group_name),
    trim(group_description),
    crypt(group_password, gen_salt('bf')),
    auth.uid()
  )
  returning id into new_id;

  -- Criador já entra como membro automaticamente
  insert into public.group_members (group_id, player_id)
  values (new_id, auth.uid());

  return new_id;
end;
$$ language plpgsql security definer;

-- ===================================================
-- Função: entrar em grupo (verifica senha)
-- ===================================================
create or replace function join_group(
  group_id_param uuid,
  group_password text
)
returns json as $$
declare
  stored_hash text;
  group_name text;
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'error', 'Não autenticado');
  end if;

  select g.password_hash, g.name
  into stored_hash, group_name
  from public.groups g
  where g.id = group_id_param;

  if stored_hash is null then
    return json_build_object('success', false, 'error', 'Grupo não encontrado');
  end if;

  -- Verificar se já é membro
  if exists (
    select 1 from public.group_members
    where group_id = group_id_param and player_id = auth.uid()
  ) then
    return json_build_object('success', false, 'error', 'Você já é membro deste grupo');
  end if;

  -- Verificar senha
  if stored_hash = crypt(group_password, stored_hash) then
    insert into public.group_members (group_id, player_id)
    values (group_id_param, auth.uid())
    on conflict do nothing;
    return json_build_object('success', true, 'group_name', group_name);
  end if;

  return json_build_object('success', false, 'error', 'Senha incorreta');
end;
$$ language plpgsql security definer;

-- ===================================================
-- Função: buscar grupo por nome (para entrar)
-- Retorna apenas id e nome, sem expor senha
-- ===================================================
create or replace function search_group_by_name(search_name text)
returns table(id uuid, name text, description text, member_count bigint) as $$
begin
  return query
  select
    g.id,
    g.name,
    g.description,
    count(gm.player_id) as member_count
  from public.groups g
  left join public.group_members gm on gm.group_id = g.id
  where lower(g.name) = lower(trim(search_name))
  group by g.id, g.name, g.description;
end;
$$ language plpgsql security definer;
