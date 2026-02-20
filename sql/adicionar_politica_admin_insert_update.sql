-- ============================================
-- NOVAS POLÍTICAS RLS: CONTROLE POR CRIADOR
-- ============================================
-- REGRAS:
-- 1. Qualquer pessoa autenticada pode INSERIR ponto/falta para qualquer médico
-- 2. Só quem CRIOU (created_by) pode EDITAR/DELETAR, ou admin
-- 3. Exemplo: Pedro marca falta do João → só Pedro ou admin podem editar/deletar
-- ============================================

-- 🧹 REMOVER POLÍTICAS ANTIGAS
DROP POLICY IF EXISTS "Usuários autenticados podem criar pontos" ON public.ponto_juju2;
DROP POLICY IF EXISTS "Usuários podem editar APENAS seus próprios pontos" ON public.ponto_juju2;
DROP POLICY IF EXISTS "Usuários podem deletar APENAS seus próprios pontos" ON public.ponto_juju2;
DROP POLICY IF EXISTS "Admins podem inserir pontos para qualquer usuário" ON public.ponto_juju2;
DROP POLICY IF EXISTS "Admins podem atualizar qualquer ponto" ON public.ponto_juju2;
DROP POLICY IF EXISTS "Admins podem deletar qualquer ponto" ON public.ponto_juju2;

-- ============================================
-- 1️⃣ POLÍTICA INSERT: Qualquer autenticado pode inserir para qualquer médico
-- ============================================
CREATE POLICY "Qualquer autenticado pode inserir ponto/falta"
  ON public.ponto_juju2
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 2️⃣ POLÍTICA UPDATE: Só quem criou ou admin pode editar
-- ============================================
CREATE POLICY "Só quem criou ou admin pode editar"
  ON public.ponto_juju2
  FOR UPDATE
  USING (
    -- É o criador do registro
    created_by = auth.uid()
    OR
    -- OU é admin/gerente
    EXISTS (
      SELECT 1 
      FROM public.usuarios 
      WHERE usuarios.user_id = auth.uid() 
      AND usuarios.role IN ('admin', 'gerente')
    )
  )
  WITH CHECK (
    -- É o criador do registro
    created_by = auth.uid()
    OR
    -- OU é admin/gerente
    EXISTS (
      SELECT 1 
      FROM public.usuarios 
      WHERE usuarios.user_id = auth.uid() 
      AND usuarios.role IN ('admin', 'gerente')
    )
  );

-- ============================================
-- 3️⃣ POLÍTICA DELETE: Só quem criou ou admin pode deletar
-- ============================================
CREATE POLICY "Só quem criou ou admin pode deletar"
  ON public.ponto_juju2
  FOR DELETE
  USING (
    -- É o criador do registro
    created_by = auth.uid()
    OR
    -- OU é admin/gerente
    EXISTS (
      SELECT 1 
      FROM public.usuarios 
      WHERE usuarios.user_id = auth.uid() 
      AND usuarios.role IN ('admin', 'gerente')
    )
  );

-- ============================================
-- VERIFICAR POLÍTICAS APÓS ATUALIZAR
-- ============================================
-- Execute para ver todas as políticas da tabela:
-- SELECT policyname, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'ponto_juju2' 
-- ORDER BY cmd;

-- 🔍 TESTE: Verificar estrutura
-- SELECT user_id, nome, email, role 
-- FROM public.usuarios 
-- WHERE user_id = auth.uid();
