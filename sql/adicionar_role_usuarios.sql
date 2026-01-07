-- ============================================
-- ADICIONAR COLUNA ROLE NA TABELA USUARIOS
-- para controlar permissões de admin
-- ============================================

-- 1️⃣ ADICIONAR COLUNA role
ALTER TABLE public.usuarios 
ADD COLUMN role text DEFAULT 'medico' CHECK (role IN ('medico', 'admin', 'gerente'));

-- 2️⃣ CRIAR ÍNDICE para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON public.usuarios USING btree (role);

-- 3️⃣ ATUALIZAR ADMINS EXISTENTES
-- Descomente e execute para setar como admin:
-- UPDATE public.usuarios 
-- SET role = 'admin' 
-- WHERE email IN ('ns.cucacriativa@gmail.com', 'leliamachadobraga@gmail.com');

-- 4️⃣ CRIAR FUNÇÃO HELPER para checar se é admin
CREATE OR REPLACE FUNCTION is_admin(user_email text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios 
    WHERE email = user_email AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- 5️⃣ VERIFICAR DADOS
-- SELECT user_id, nome, email, role FROM public.usuarios;
