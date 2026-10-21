-- OBSOLETO: NÃO EXECUTE. Este arquivo define a mesma view (nova_total_por_medico_mes) de forma diferente
-- da que está em produção e depende de v_ponto_detalhado2_nova. A definição real está em
-- sql/criar_view_nova_total_por_medico_mes.sql.

-- ============================================
-- VIEW: RELATÓRIO MENSAL POR MÉDICO
-- com valores zerando em caso de FALTA
-- ============================================

CREATE OR REPLACE VIEW public.nova_total_por_medico_mes AS
SELECT
  v.user_id, 
  v.medico_nome, 
  m_info.cpf, 
  m_info.banco, 
  m_info.agencia, 
  m_info.variacao, 
  m_info.conta, 
  v.ano, 
  v.nome_mes,
  -- ✅ SÓ SOMA VALOR SE NÃO FOR FALTA
  SUM(
    CASE 
      WHEN v.falta = 'Sim' THEN 0
      ELSE COALESCE(v.valor_por_plantao, 0)
    END
  ) AS total_valor_plantao,
  -- ✅ CONTA PLANTÕES REALIZADOS (sem faltas)
  COUNT(
    CASE 
      WHEN v.falta != 'Sim' AND v.falta IS NOT NULL THEN 1
      WHEN v.falta IS NULL THEN 1
    END
  ) AS total_plantao_realizados,
  -- ✅ CONTA FALTAS SEPARADAMENTE
  COUNT(
    CASE 
      WHEN v.falta = 'Sim' THEN 1 
    END
  ) AS total_faltas
FROM
  v_ponto_detalhado2_nova v
  LEFT JOIN medicos_juju m_info ON v.user_id = m_info.user_id
GROUP BY
  v.user_id, 
  v.medico_nome, 
  m_info.cpf, 
  m_info.banco, 
  m_info.agencia, 
  m_info.variacao, 
  m_info.conta, 
  v.ano, 
  v.nome_mes
ORDER BY 
  v.ano DESC, 
  v.nome_mes DESC, 
  v.medico_nome ASC;
