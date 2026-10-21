-- ============================================
-- TABELA: public.usuarios
-- DEFINIÇÃO REAL, copiada do banco em produção (referência; não precisa executar).
--
-- Pontos para conhecer:
--  * role: 'medico' (padrão), 'admin' ou 'gerente'. O app só libera as telas de gestão para 'admin'.
--  * A RLS e as permissões por coluna desta tabela estão em sql/ETAPA_1_seguranca.sql
--    (o navegador só pode editar nome e foto; role nunca).
--  * email não é único nesta tabela; a identificação do usuário é sempre por user_id (= auth.users.id).
-- ============================================

create table public.usuarios (
  user_id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default timezone ('America/Sao_Paulo'::text, now()),
  nome text not null,
  setor text null,
  funcao text not null,
  email text not null,
  foto text null,
  ativo boolean null default true,
  setor_id bigint null,
  role text null default 'medico'::text,
  constraint usuarios_pkey primary key (user_id),
  constraint usuarios_user_id_fkey foreign KEY (user_id) references auth.users (id) on update CASCADE on delete CASCADE,
  constraint usuarios_role_check check (
    (
      role = any (
        array['medico'::text, 'admin'::text, 'gerente'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_usuarios_role on public.usuarios using btree (role) TABLESPACE pg_default;

create index IF not exists idx_usuarios_email on public.usuarios using btree (email) TABLESPACE pg_default;

create index IF not exists idx_usuarios_ativo on public.usuarios using btree (ativo) TABLESPACE pg_default;

create index IF not exists idx_usuarios_setor_id on public.usuarios using btree (setor_id) TABLESPACE pg_default;
