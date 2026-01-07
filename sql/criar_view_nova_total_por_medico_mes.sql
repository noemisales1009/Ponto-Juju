-- ============================================
-- CRIAR VIEW: nova_total_por_medico_mes
-- Agrega dados de pontos por médico por mês
-- com informações bancárias de medicos_juju
-- ============================================

-- ============================================
-- CRIAR VIEW: nova_total_por_medico_mes
-- Agrega dados de pontos por médico por mês
-- com informações bancárias de medicos_juju
-- ============================================

-- CRIAR a VIEW (ou REPLACE se já existir)
CREATE OR REPLACE VIEW public.nova_total_por_medico_mes AS
SELECT
  p.user_id,
  m.medico AS medico_nome,
  m.cpf,
  m.banco,
  m.agencia,
  m.variacao,
  m.conta,
  EXTRACT(YEAR FROM p.data_dia) AS ano,
  TO_CHAR(p.data_dia, 'Month') AS nome_mes,
  COALESCE(SUM(CASE WHEN p.falta IS NULL THEN COALESCE(p.valor_plantao, 500) ELSE 0 END), 0) AS total_valor_plantao,
  COUNT(CASE WHEN p.falta IS NULL THEN p.id END) AS total_plantao_realizados,
  COUNT(CASE WHEN p.falta IS NOT NULL THEN p.id END) AS total_faltas,
  COALESCE(SUM(CASE WHEN p.falta IS NULL THEN COALESCE(p.valor_plantao, 500) ELSE 0 END), 0) AS total_a_pagar
FROM
  public.ponto_juju2 p
  LEFT JOIN public.medicos_juju m ON p.user_id = m.user_id
GROUP BY
  p.user_id,
  m.medico,
  m.cpf,
  m.banco,
  m.agencia,
  m.variacao,
  m.conta,
  EXTRACT(YEAR FROM p.data_dia),
  TO_CHAR(p.data_dia, 'Month')
ORDER BY
  ano DESC,
  nome_mes DESC,
  medico_nome ASC;

-- ============================================
-- CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================

-- Índice para buscas por user_id
CREATE INDEX IF NOT EXISTS idx_nova_total_user_id 
  ON public.nova_total_por_medico_mes (user_id);

-- Índice para buscas por período (ano + mês)
CREATE INDEX IF NOT EXISTS idx_nova_total_ano_mes 
  ON public.nova_total_por_medico_mes (ano, nome_mes);

-- Índice para buscas por banco (para relatórios de transferências)
CREATE INDEX IF NOT EXISTS idx_nova_total_banco 
  ON public.nova_total_por_medico_mes (banco);

-- ============================================
-- TESTAR A VIEW
-- ============================================
-- SELECT * FROM public.nova_total_por_medico_mes LIMIT 10;
-- SELECT COUNT(*) FROM public.nova_total_por_medico_mes;
-- SELECT DISTINCT ano, nome_mes FROM public.nova_total_por_medico_mes ORDER BY ano DESC, nome_mes DESC;
