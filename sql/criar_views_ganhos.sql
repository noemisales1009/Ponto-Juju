-- ============================================
-- VIEW OTIMIZADA PARA GANHOS/EARNINGS
-- ============================================

CREATE OR REPLACE VIEW public.v_ganhos_usuario AS
SELECT
  p.id as ponto_id,
  p.user_id,
  m.medico as usuario_nome,
  p.data_dia as data,
  -- Transforma o número do dia da semana em nome em português
  CASE EXTRACT(DOW FROM p.data_dia)
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Segunda'
    WHEN 2 THEN 'Terça'
    WHEN 3 THEN 'Quarta'
    WHEN 4 THEN 'Quinta'
    WHEN 5 THEN 'Sexta'
    WHEN 6 THEN 'Sábado'
  END as dia_semana,
  p.turno,
  s.nome_setor as setor,
  -- Pega o valor do plantão; se estiver nulo, pega o valor padrão do período
  COALESCE(p.valor_plantao, per.valor_por_plantao, 0) as valor_plantao,
  EXTRACT(MONTH FROM p.data_dia) as mes_numero,
  EXTRACT(YEAR FROM p.data_dia) as ano,
  TO_CHAR(p.data_dia, 'TMMonth') as nome_mes
FROM public.ponto_juju2 p
LEFT JOIN public.medicos_juju m ON p.user_id = m.user_id
LEFT JOIN public.setor_juju s ON p.setor_id = s.id
LEFT JOIN public.periodo_juju per ON p.periodo_id = per.id
WHERE p.falta IS NULL  -- Importante: Ignora as faltas para não pagar o que não foi trabalhado
ORDER BY p.data_dia DESC;


-- ============================================
-- VIEW PARA RELATÓRIO MENSAL
-- ============================================

CREATE OR REPLACE VIEW public.v_ganhos_mensais_usuario AS
SELECT
  user_id,
  usuario_nome,
  ano,
  mes_numero,
  nome_mes,
  COUNT(*) as total_plantoes,
  SUM(valor_plantao) as total_ganhos
FROM public.v_ganhos_usuario
GROUP BY user_id, usuario_nome, ano, mes_numero, nome_mes
ORDER BY ano DESC, mes_numero DESC, usuario_nome ASC;
