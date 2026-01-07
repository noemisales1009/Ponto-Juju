-- ============================================
-- CORRIGIR ÍNDICES DA TABELA ponto_juju2
-- ============================================

-- ❌ REMOVER: Índice redundante que indexa apenas 'data' (timestamp)
DROP INDEX IF EXISTS idx_ponto_data;

-- ❌ REMOVER: Índice redundante de user_id, data_dia
DROP INDEX IF EXISTS idx_ponto_user_dia_unico;

-- ✅ ADICIONAR: Índice composto para a query principal do dashboard
-- Query: SELECT * FROM ponto_juju2 WHERE data_dia = '2026-01-08' AND setor_id = 3
CREATE INDEX IF NOT EXISTS idx_ponto_setor_data_dia 
ON public.ponto_juju2 (setor_id, data_dia DESC);

-- ✅ MANTER: Índices existentes que são úteis
-- idx_ponto_setor_id - indexa buscas por setor
-- idx_ponto_user_id - indexa buscas por usuário
-- idx_ponto_juju2_periodo_id - indexa relacionamento com períodos

-- ✅ VERIFICAR: Índice em data_dia para queries por data
CREATE INDEX IF NOT EXISTS idx_ponto_data_dia 
ON public.ponto_juju2 (data_dia DESC);

-- ============================================
-- RESULTADO: Índices otimizados
-- ============================================
-- idx_ponto_setor_id: Buscar por setor
-- idx_ponto_user_id: Buscar por usuário
-- idx_ponto_data_dia: Buscar por data
-- idx_ponto_setor_data_dia: Buscar por setor + data (DASHBOARD)
-- idx_ponto_juju2_periodo_id: Relacionamento
