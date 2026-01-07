-- ============================================
-- POLÍTICA ADICIONAL: ADMIN DELETE
-- ============================================
-- Permite que usuários com role='admin' deletem QUALQUER registro
-- Necessário para a função "Gerenciamento de Dados"

-- 1️⃣ Remover a política antiga (caso exista com erro)
DROP POLICY IF EXISTS "Admins podem deletar qualquer ponto" ON public.ponto_juju2;

-- 2️⃣ Criar a política nova
CREATE POLICY "Admins podem deletar qualquer ponto"
  ON public.ponto_juju2
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.usuarios 
      WHERE usuarios.user_id = auth.uid() 
      AND usuarios.role = 'admin'
    )
  );

-- ============================================
-- VERIFICAR POLÍTICAS APÓS ADICIONAR
-- ============================================
-- Execute para ver todas as políticas da tabela:
-- SELECT * FROM pg_policies WHERE tablename = 'ponto_juju2';
