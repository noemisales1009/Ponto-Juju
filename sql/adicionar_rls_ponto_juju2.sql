-- ============================================
-- ADICIONAR ROW LEVEL SECURITY (RLS) 
-- na tabela ponto_juju2
-- ============================================
-- Permite que cada usuário edite/delete APENAS seus próprios pontos/faltas

-- 1️⃣ HABILITAR RLS na tabela
ALTER TABLE public.ponto_juju2 ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICA 1: SELECT (Ver pontos)
-- ============================================
-- Apenas usuários AUTENTICADOS podem VER todos os pontos
-- (necessário para mostrar no dashboard)
CREATE POLICY "Apenas logados podem ver pontos"
  ON public.ponto_juju2
  FOR SELECT
  USING (auth.uid() is not null);

-- ============================================
-- POLÍTICA 2: INSERT (Criar pontos)
-- ============================================
-- Qualquer pessoa autenticada pode CRIAR pontos/faltas
-- (o user_id deve ser preenchido automaticamente)
CREATE POLICY "Usuários autenticados podem criar pontos"
  ON public.ponto_juju2
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- POLÍTICA 3: UPDATE (Editar pontos)
-- ============================================
-- Cada usuário SÓ pode EDITAR seus próprios pontos
-- (data, turno, falta podem ser alterados)
CREATE POLICY "Usuários podem editar APENAS seus próprios pontos"
  ON public.ponto_juju2
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- POLÍTICA 4: DELETE (Deletar pontos)
-- ============================================
-- Cada usuário SÓ pode DELETAR seus próprios pontos/faltas
CREATE POLICY "Usuários podem deletar APENAS seus próprios pontos"
  ON public.ponto_juju2
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- VERIFICAR POLÍTICAS CRIADAS
-- ============================================
-- Para verificar se as políticas foram criadas:
-- SELECT * FROM pg_policies WHERE tablename = 'ponto_juju2';
