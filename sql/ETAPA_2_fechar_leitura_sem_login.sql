-- ============================================================
-- ETAPA 2 — FECHAR A LEITURA SEM LOGIN (rode SÓ depois da Etapa 1 e de confirmar os outros sistemas)
-- ============================================================
-- Hoje, quem tem a chave pública do projeto (ela está no JavaScript do site) consegue LER,
-- sem fazer login, as tabelas usuarios (e-mails, papéis) e medicos_juju (CPF, banco, agência, conta).
--
-- Esta etapa liga a proteção por linha (RLS) nessas duas tabelas e tira o acesso de quem não fez login.
--
-- ATENÇÃO — PODE QUEBRAR OUTRO SISTEMA:
--   Qualquer app/robô do hospital que leia usuarios, medicos_juju, ponto_juju2, setor_juju ou
--   periodo_juju usando a chave pública SEM login deixa de funcionar.
--   CONFIRME ANTES (Logs > API Gateway > filtro de Pathname /rest/v1/usuarios etc., últimos 7 dias):
--   se só aparecer o app de ponto, pode rodar.
--
-- ANTES DE RODAR: backup. Roda numa transação (se algo falhar, nada é aplicado).
-- Requer a Etapa 1 (função public.is_admin_user()).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- usuarios
-- ------------------------------------------------------------
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- A política antiga (using true, role public) reabriria a leitura sem login: sai.
DROP POLICY IF EXISTS "Permitir leitura de todos os usuários" ON public.usuarios;

-- Leitura: qualquer usuário logado (o app lista os médicos)
DROP POLICY IF EXISTS "usuarios_select_autenticado" ON public.usuarios;
CREATE POLICY "usuarios_select_autenticado"
  ON public.usuarios FOR SELECT TO authenticated
  USING (true);

-- Edição: somente a própria linha
DROP POLICY IF EXISTS "usuarios_update_proprio" ON public.usuarios;
CREATE POLICY "usuarios_update_proprio"
  ON public.usuarios FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Sem acesso para quem não fez login; logado só edita nome e foto (como o app faz)
REVOKE ALL ON public.usuarios FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.usuarios FROM authenticated;
GRANT UPDATE (nome, foto) ON public.usuarios TO authenticated;

-- ------------------------------------------------------------
-- medicos_juju (CPF, banco, agência, conta)
-- ------------------------------------------------------------
-- ANTES: confira se os nomes são iguais nas duas tabelas. Depois desta etapa, os colegas passam a
-- aparecer com usuarios.nome (o app já usa essa alternativa). Se esta consulta devolver linhas,
-- os nomes mostrados vão mudar:
--   SELECT m.medico, u.nome FROM public.medicos_juju m JOIN public.usuarios u USING (user_id)
--   WHERE m.medico IS DISTINCT FROM u.nome;
ALTER TABLE public.medicos_juju ENABLE ROW LEVEL SECURITY;

-- A política antiga (using true, role public) anularia a restrição: sai.
DROP POLICY IF EXISTS "Permitir leitura de todos os médicos" ON public.medicos_juju;

-- Leitura: a própria linha, ou todas se for admin
DROP POLICY IF EXISTS "medicos_select_proprio_ou_admin" ON public.medicos_juju;
CREATE POLICY "medicos_select_proprio_ou_admin"
  ON public.medicos_juju FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_admin_user());

-- Edição: somente a própria linha (e, pela permissão por coluna da Etapa 1, somente o nome)
DROP POLICY IF EXISTS "medicos_update_proprio" ON public.medicos_juju;
CREATE POLICY "medicos_update_proprio"
  ON public.medicos_juju FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

REVOKE ALL ON public.medicos_juju FROM anon;

-- ------------------------------------------------------------
-- Demais tabelas do app de ponto: sem acesso para quem não fez login
-- ------------------------------------------------------------
DO $$
DECLARE
  obj text;
BEGIN
  FOREACH obj IN ARRAY ARRAY['ponto_juju2', 'setor_juju', 'periodo_juju', 'auditoria_medicos']
  LOOP
    IF to_regclass('public.' || obj) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', obj);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- TESTE DEPOIS DE RODAR: os mesmos testes da Etapa 1, e abra os OUTROS sistemas do hospital que usam
-- este projeto para ver se continuam funcionando.
--
-- PARA DESFAZER:
--   ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.medicos_juju DISABLE ROW LEVEL SECURITY;
--   GRANT SELECT ON public.usuarios, public.medicos_juju, public.ponto_juju2,
--                   public.setor_juju, public.periodo_juju, public.auditoria_medicos TO anon;
--   GRANT INSERT, UPDATE ON public.usuarios TO authenticated;   -- (a Etapa 1 já limita a coluna role)
-- ============================================================
