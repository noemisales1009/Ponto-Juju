-- ============================================
-- REMOVER CONSTRAINT que impede múltiplos turnos
-- ============================================
-- A constraint atual impede ter 2 pontos no mesmo dia
-- Vamos remover para permitir múltiplos turnos

ALTER TABLE public.ponto_juju2 
DROP CONSTRAINT IF EXISTS unique_ponto_user_dia;

-- ============================================
-- CRIAR NOVA CONSTRAINT que permite múltiplos turnos
-- mas impede duplicar o MESMO TURNO
-- ============================================
ALTER TABLE public.ponto_juju2
ADD CONSTRAINT unique_ponto_user_dia_turno UNIQUE (user_id, data_dia, turno);

-- ============================================
-- VERIFICAR as constraints
-- ============================================
-- SELECT constraint_name, table_name 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'ponto_juju2';
