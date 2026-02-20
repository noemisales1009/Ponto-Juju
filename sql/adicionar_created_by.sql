-- ============================================
-- ADICIONAR COLUNA created_by
-- Para rastrear QUEM registrou o ponto/falta
-- ============================================
-- Permite controlar edição: só quem criou pode editar

-- 1️⃣ ADICIONAR COLUNA created_by
ALTER TABLE public.ponto_juju2 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 2️⃣ ATUALIZAR registros existentes (definir como o próprio user_id)
UPDATE public.ponto_juju2 
SET created_by = user_id 
WHERE created_by IS NULL;

-- 3️⃣ TORNAR OBRIGATÓRIO (após popular dados existentes)
ALTER TABLE public.ponto_juju2 
ALTER COLUMN created_by SET NOT NULL;

-- 4️⃣ DEFINIR VALOR PADRÃO (quem está autenticado)
ALTER TABLE public.ponto_juju2 
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 5️⃣ CRIAR ÍNDICE para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_ponto_created_by 
ON public.ponto_juju2 USING btree (created_by);

-- 6️⃣ VERIFICAR ESTRUTURA
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'ponto_juju2' 
-- ORDER BY ordinal_position;
