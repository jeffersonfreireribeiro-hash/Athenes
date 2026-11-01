-- SPDX-License-Identifier: GPL-3.0-or-later
-- Migração 001: Tabela principal de documentos e revisões colaborativas do Athenes

create table if not exists public.documentos_athenes (
  id text primary key,
  titulo text not null default 'Sem título',
  autor text default '',
  norma text default 'abnt',
  conteudo_json jsonb not null default '{}'::jsonb,
  sugestoes_json jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por text default 'Autor'
);

alter table public.documentos_athenes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'documentos_athenes' and policyname = 'Leitura colaborativa documentos_athenes'
  ) then
    create policy "Leitura colaborativa documentos_athenes"
      on public.documentos_athenes for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'documentos_athenes' and policyname = 'Insercao colaborativa documentos_athenes'
  ) then
    create policy "Insercao colaborativa documentos_athenes"
      on public.documentos_athenes for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'documentos_athenes' and policyname = 'Atualizacao colaborativa documentos_athenes'
  ) then
    create policy "Atualizacao colaborativa documentos_athenes"
      on public.documentos_athenes for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'documentos_athenes' and policyname = 'Exclusao colaborativa documentos_athenes'
  ) then
    create policy "Exclusao colaborativa documentos_athenes"
      on public.documentos_athenes for delete
      to anon, authenticated
      using (true);
  end if;
end $$;
