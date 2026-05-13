-- ===================================================
-- BOLÃO COPA 2026 — Grupos
-- Execute no SQL Editor do Supabase
-- ===================================================

-- Habilitar extensão de criptografia
create extension if not exists pgcrypto;

-- Tabela de grupos
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  password_hash text not null,
  owner_id uuid references public.players(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- Tabela de membros dos grupos
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  player_id uuid references public.players(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique(group_id, player_id)
);

-- RLS
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Políticas para groups:
-- Só membros do grupo podem ver o grupo
create policy "Membros veem o grupo" on public.groups
  for select using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id
        and player_id::text = auth.uid()::text
    )
  );

-- Qualquer autenticado pode inserir (a função create_group controla a lógica)
create policy "Autenticado pode criar grupo" on public.groups
  for insert with check (owner_id::text = auth.uid()::text);

-- Dono pode atualizar e deletar
create policy "Dono pode atualizar grupo" on public.groups
  for update using (owner_id::text = auth.uid()::text);

create policy "Dono pode deletar grupo" on public.groups
  for delete using (owner_id::text = auth.uid()::text);

-- Políticas para group_members:
-- Só membros do grupo veem os outros membros
create policy "Membros veem membros do grupo" on public.group_members
  for select using (
    exists (
      select 1 from public.group_members gm2
      where gm2.group_id = group_members.group_id
        and gm2.player_id::text = auth.uid()::text
    )
  );

create policy "Inserção controlada por função" on public.group_members
  for insert with check (player_id::text = auth.uid()::text);

create policy "Membro pode sair do grupo" on public.group_members
  for delete using (player_id::text = auth.uid()::text);

-- ===================================================
-- Função: criar grupo (hash a senha, insere grupo e o criador como membro)
-- ===================================================
create or replace function create_group(group_name text, group_password text)
returns uuid as $$
declare
  new_group_id uuid;
  current_player_id uuid;
begin
  current_player_id := auth.uid();
  if current_player_id is null then
    raise exception 'Não autenticado';
  end if;

  if length(trim(group_name)) < 3 then
    raise exception 'Nome do grupo deve ter ao menos 3 caracteres';
  end if;

  if length(group_password) < 4 then
    raise exception 'Senha do grupo deve ter ao menos 4 caracteres';
  end if;

  -- Inserir o grupo com a senha hasheada
  insert into public.groups (name, password_hash, owner_id)
  values (
    trim(group_name),
    crypt(group_password, gen_salt('bf')),
    current_player_id
  )
  returning id into new_group_id;

  -- Adicionar o criador como membro automaticamente
  insert into public.group_members (group_id, player_id)
  values (new_group_id, current_player_id);

  return new_group_id;
end;
$$ language plpgsql security definer;

-- ===================================================
-- Função: entrar no grupo (verifica senha, adiciona membro)
-- ===================================================
create or replace function join_group(group_id_param uuid, group_password text)
returns text as $$
declare
  group_record record;
  current_player_id uuid;
begin
  current_player_id := auth.uid();
  if current_player_id is null then
    raise exception 'Não autenticado';
  end if;

  -- Buscar o grupo sem RLS (security definer)
  select * into group_record
  from public.groups
  where id = group_id_param;

  if not found then
    raise exception 'Grupo não encontrado';
  end if;

  -- Verificar senha
  if group_record.password_hash != crypt(group_password, group_record.password_hash) then
    raise exception 'Senha incorreta';
  end if;

  -- Verificar se já é membro
  if exists (
    select 1 from public.group_members
    where group_id = group_id_param and player_id = current_player_id
  ) then
    raise exception 'Você já faz parte deste grupo';
  end if;

  -- Adicionar como membro
  insert into public.group_members (group_id, player_id)
  values (group_id_param, current_player_id);

  return 'ok';
end;
$$ language plpgsql security definer;

-- ===================================================
-- Função: buscar grupo por ID (sem RLS, para validação pré-entrada)
-- Retorna apenas nome e dono — sem expor a senha
-- ===================================================
create or replace function get_group_preview(group_id_param uuid)
returns table(id uuid, name text, owner_name text, member_count bigint) as $$
begin
  return query
  select
    g.id,
    g.name,
    p.display_name as owner_name,
    count(gm.id) as member_count
  from public.groups g
  join public.players p on p.id = g.owner_id
  left join public.group_members gm on gm.group_id = g.id
  where g.id = group_id_param
  group by g.id, g.name, p.display_name;
end;
$$ language plpgsql security definer;
