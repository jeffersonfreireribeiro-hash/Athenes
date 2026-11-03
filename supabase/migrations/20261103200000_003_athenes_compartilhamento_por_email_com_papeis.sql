-- Athenes: compartilhamento de documentos por e-mail, com papel por pessoa.
-- RASCUNHO PARA REVISÃO: ainda NÃO foi aplicado no Supabase de produção.
--
-- Papéis (guardados em `permissoes`: {"ana@x.com": "leitura" | "comentario" | "edicao"}):
--   leitura    -> só abre e lê
--   comentario -> lê e registra sugestões (não altera o texto)
--   edicao     -> lê e edita o conteúdo
-- Só o dono (user_id) muda quem tem acesso, o papel de cada um, o link público e apaga o documento.

alter table public.documentos_athenes add column if not exists permissoes jsonb not null default '{}'::jsonb;

create or replace function public.email_do_usuario() returns text
language sql stable set search_path = '' as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

drop policy if exists "ler_dono_convidado" on public.documentos_athenes;
create policy "ler_dono_convidado" on public.documentos_athenes for select to authenticated
  using (user_id = (select auth.uid()) or (select public.email_do_usuario()) = any (compartilhado_com) or publico_leitura);

drop policy if exists "atualizar_dono_convidado" on public.documentos_athenes;
create policy "atualizar_dono_convidado" on public.documentos_athenes for update to authenticated
  using (user_id = (select auth.uid()) or (permissoes ->> (select public.email_do_usuario())) in ('edicao', 'comentario'))
  with check (user_id = (select auth.uid()) or (permissoes ->> (select public.email_do_usuario())) in ('edicao', 'comentario'));

-- convidado edita o que o papel permite, mas nunca troca o dono nem a lista de acesso
create or replace function public.documentos_athenes_protege_dono() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare papel text;
begin
  new.user_id := old.user_id;
  if old.user_id is distinct from auth.uid() then
    papel := old.permissoes ->> public.email_do_usuario();
    new.compartilhado_com := old.compartilhado_com;
    new.permissoes := old.permissoes;
    new.publico_leitura := old.publico_leitura;
    if papel is distinct from 'edicao' then -- quem só comenta não altera o texto: só as sugestões
      new.titulo := old.titulo;
      new.conteudo_json := old.conteudo_json;
    end if;
  end if;
  return new;
end $$;

-- e-mails sempre em minúsculas (comparados com o do login)
create or replace function public.documentos_athenes_normaliza_emails() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.compartilhado_com := coalesce((select array_agg(distinct lower(btrim(e))) from unnest(new.compartilhado_com) e where btrim(e) <> ''), '{}');
  return new;
end $$;
drop trigger if exists documentos_athenes_normaliza_emails on public.documentos_athenes;
create trigger documentos_athenes_normaliza_emails before insert or update on public.documentos_athenes
  for each row execute function public.documentos_athenes_normaliza_emails();

create index if not exists documentos_athenes_compartilhado_idx on public.documentos_athenes using gin (compartilhado_com);
