-- ============================================================
-- ETAPA 1b — REGRA DE FALTAS NO BANCO (rode depois da Etapa 1)
-- ============================================================
-- A REGRA (definida pela Noemi):
--   * Qualquer médico pode REGISTRAR uma falta (para si ou para um colega).
--   * Só quem REGISTROU a falta pode retirá-la/editá-la.
--   * O ADMIN pode adicionar e retirar qualquer registro.
--   * Ponto de PRESENÇA: cada médico bate só o próprio.
--
-- O QUE ESTE ARQUIVO CORRIGE (hoje o banco permite mais do que a regra):
--   1. Médico comum só pode inserir para OUTRO médico se for uma FALTA ('Sim').
--      (antes: dava para registrar presença/pagamento para um colega, pela API)
--   2. Médico comum não consegue transformar uma falta de colega em presença ao editar.
--   3. O papel 'gerente' deixa de poder apagar/editar registros dos outros (só admin).
--
-- O admin continua com tudo pela política "Admins Podem Tudo" (já existente).
-- NÃO apaga nem altera dados. Roda numa transação (se falhar, nada é aplicado).
--
-- ANTES DE RODAR, veja se existe alguém com papel 'gerente' (se existir e ele deve poder apagar,
-- me avise antes):
--   SELECT role, count(*) FROM public.usuarios GROUP BY role;
-- ============================================================

BEGIN;

-- 1) INSERT: o próprio ponto/falta, ou FALTA para um colega. created_by sempre = quem está logado.
DROP POLICY IF EXISTS "Autenticado insere ponto/falta como ele mesmo" ON public.ponto_juju2;
DROP POLICY IF EXISTS "Insere o próprio ponto ou falta de colega" ON public.ponto_juju2;
CREATE POLICY "Insere o próprio ponto ou falta de colega"
  ON public.ponto_juju2
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND (user_id = (select auth.uid()) OR falta = 'Sim')
  );
  -- Opcional (Semi 1 desativado): acrescentar "AND setor_id <> 1" dentro do WITH CHECK.

-- 2) UPDATE: só quem registrou. Em registro de colega, ele precisa continuar sendo falta.
--    (a política antiga também liberava 'gerente')
DROP POLICY IF EXISTS "Usuários podem editar APENAS seus próprios pontos" ON public.ponto_juju2;
DROP POLICY IF EXISTS "Edita quem registrou" ON public.ponto_juju2;
CREATE POLICY "Edita quem registrou"
  ON public.ponto_juju2
  FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (
    created_by = (select auth.uid())
    AND (user_id = (select auth.uid()) OR falta = 'Sim')
  );

-- 3) DELETE: só quem registrou. (a política antiga também liberava 'gerente')
DROP POLICY IF EXISTS "Usuários podem deletar APENAS seus próprios pontos" ON public.ponto_juju2;
DROP POLICY IF EXISTS "Apaga quem registrou" ON public.ponto_juju2;
CREATE POLICY "Apaga quem registrou"
  ON public.ponto_juju2
  FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

COMMIT;

-- ============================================================
-- TESTE DEPOIS DE RODAR (pelo app):
--   Médico comum A e médico comum B:
--     [ ] A bate o próprio ponto                                   -> funciona
--     [ ] A registra uma FALTA para B                              -> funciona
--     [ ] B tenta apagar a falta que A registrou                   -> não aparece botão / é recusado
--     [ ] A apaga a falta que ele mesmo registrou                  -> funciona
--     [ ] A edita a falta e desmarca "Registrar como Falta"        -> recusado ("sem permissão")
--   Admin:
--     [ ] apaga e adiciona falta/ponto de qualquer médico          -> funciona
--
-- PARA DESFAZER (volta às regras anteriores, incluindo gerente):
--   DROP POLICY "Insere o próprio ponto ou falta de colega" ON public.ponto_juju2;
--   DROP POLICY "Edita quem registrou" ON public.ponto_juju2;
--   DROP POLICY "Apaga quem registrou" ON public.ponto_juju2;
--   CREATE POLICY "Autenticado insere ponto/falta como ele mesmo" ON public.ponto_juju2
--     FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
--   CREATE POLICY "Usuários podem editar APENAS seus próprios pontos" ON public.ponto_juju2 FOR UPDATE
--     USING ((created_by = auth.uid()) OR EXISTS (SELECT 1 FROM usuarios WHERE usuarios.user_id = auth.uid() AND usuarios.role = ANY (ARRAY['admin','gerente'])))
--     WITH CHECK ((created_by = auth.uid()) OR EXISTS (SELECT 1 FROM usuarios WHERE usuarios.user_id = auth.uid() AND usuarios.role = ANY (ARRAY['admin','gerente'])));
--   CREATE POLICY "Usuários podem deletar APENAS seus próprios pontos" ON public.ponto_juju2 FOR DELETE
--     USING ((created_by = auth.uid()) OR EXISTS (SELECT 1 FROM usuarios WHERE usuarios.user_id = auth.uid() AND usuarios.role = ANY (ARRAY['admin','gerente'])));
-- ============================================================
