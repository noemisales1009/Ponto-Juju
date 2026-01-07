-- ============================================
-- INSERIR DADOS COMPLETOS AUTOMATICAMENTE
-- ============================================

-- ============================================
-- 1. INSERIR SETORES
-- ============================================
INSERT INTO public.setor_juju (setor, ativo)
VALUES 
  ('UTI Pediátrica', true),
  ('Semi Intensiva', true),
  ('Clínica Geral', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. INSERIR PERÍODOS
-- ============================================
INSERT INTO public.periodo_juju (setor_id, periodo, valor_por_plantao)
SELECT 1, 'Manhã Semana (07h - 13h)', 875
UNION ALL SELECT 1, 'Tarde Semana (13h - 19h)', 825
UNION ALL SELECT 1, 'Noite Semana (19h - 07h)', 1900
UNION ALL SELECT 1, 'Manhã Final de Semana (07h - 13h)', 950
UNION ALL SELECT 1, 'Tarde Final de Semana (13h - 19h)', 925
UNION ALL SELECT 1, 'Noite Final de Semana (19h - 07h)', 2400
UNION ALL SELECT 2, 'Manhã Semana (07h - 13h)', 825
UNION ALL SELECT 2, 'Tarde Semana (13h - 19h)', 800
UNION ALL SELECT 2, 'Noite Semana (19h - 07h)', 1800
UNION ALL SELECT 2, 'Manhã Final de Semana (07h - 13h)', 900
UNION ALL SELECT 2, 'Tarde Final de Semana (13h - 19h)', 875
UNION ALL SELECT 2, 'Noite Final de Semana (19h - 07h)', 2000
WHERE NOT EXISTS (SELECT 1 FROM public.periodo_juju WHERE setor_id IN (1, 2));

-- ============================================
-- 3. INSERIR USUÁRIOS
-- ============================================
INSERT INTO public.usuarios (nome, email, funcao, setor, setor_id, ativo)
VALUES
  ('Dra. Adilla Stefany', 'adilla.stefany@hospital.com', 'Médica Pediatra', 'UTI Pediátrica', 1, true),
  ('Dr. André Vinicius Reis Queiroga', 'andre.queiroga@hospital.com', 'Médico Intensivista', 'Semi Intensiva', 2, true),
  ('Dr. João Silva', 'joao.silva@hospital.com', 'Médico Clínico', 'Clínica Geral', 3, true),
  ('Dra. Maria Santos', 'maria.santos@hospital.com', 'Médica Pediatra', 'UTI Pediátrica', 1, true),
  ('Dr. Carlos Oliveira', 'carlos.oliveira@hospital.com', 'Médico Intensivista', 'Semi Intensiva', 2, true)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 4. INSERIR MÉDICOS (vinculados aos usuários)
-- ============================================
INSERT INTO public.medicos_juju (user_id, medico, banco, agencia, variacao, cpf, conta)
SELECT 
  u.user_id,
  u.nome,
  CASE 
    WHEN u.nome ILIKE '%Adilla%' THEN 'Itaú'
    WHEN u.nome ILIKE '%André%' THEN 'Banco do Brasil'
    WHEN u.nome ILIKE '%João%' THEN 'Caixa'
    WHEN u.nome ILIKE '%Maria%' THEN 'Bradesco'
    WHEN u.nome ILIKE '%Carlos%' THEN 'Santander'
  END AS banco,
  CASE 
    WHEN u.nome ILIKE '%Adilla%' THEN '1234'
    WHEN u.nome ILIKE '%André%' THEN '5678'
    WHEN u.nome ILIKE '%João%' THEN '0001'
    WHEN u.nome ILIKE '%Maria%' THEN '2222'
    WHEN u.nome ILIKE '%Carlos%' THEN '3333'
  END AS agencia,
  '001' AS variacao,
  CASE 
    WHEN u.nome ILIKE '%Adilla%' THEN '12345678901'
    WHEN u.nome ILIKE '%André%' THEN '98765432101'
    WHEN u.nome ILIKE '%João%' THEN '11111111111'
    WHEN u.nome ILIKE '%Maria%' THEN '22222222222'
    WHEN u.nome ILIKE '%Carlos%' THEN '33333333333'
  END AS cpf,
  CASE 
    WHEN u.nome ILIKE '%Adilla%' THEN '123456'
    WHEN u.nome ILIKE '%André%' THEN '654321'
    WHEN u.nome ILIKE '%João%' THEN '111111'
    WHEN u.nome ILIKE '%Maria%' THEN '222222'
    WHEN u.nome ILIKE '%Carlos%' THEN '333333'
  END AS conta
FROM public.usuarios u
WHERE NOT EXISTS (
  SELECT 1 FROM public.medicos_juju m WHERE m.user_id = u.user_id
);

-- ============================================
-- 5. INSERIR PONTOS DE EXEMPLO
-- ============================================
INSERT INTO public.ponto_juju2 (user_id, data, turno, setor_id, turno_preenchido)
SELECT 
  u.user_id,
  timezone('America/Sao_Paulo'::text, now()),
  CASE 
    WHEN u.nome ILIKE '%Adilla%' THEN 'Manhã Semana (07h - 13h)'
    WHEN u.nome ILIKE '%André%' THEN 'Tarde Semana (13h - 19h)'
    WHEN u.nome ILIKE '%João%' THEN 'Noite Semana (19h - 07h)'
    WHEN u.nome ILIKE '%Maria%' THEN 'Manhã Semana (07h - 13h)'
    WHEN u.nome ILIKE '%Carlos%' THEN 'Tarde Semana (13h - 19h)'
  END AS turno,
  u.setor_id,
  true
FROM public.usuarios u
WHERE NOT EXISTS (
  SELECT 1 FROM public.ponto_juju2 p 
  WHERE p.user_id = u.user_id 
  AND DATE(p.data) = CURRENT_DATE
);

-- ============================================
-- 6. RELATÓRIO: Verificar dados inseridos
-- ============================================
SELECT '✅ USUÁRIOS INSERIDOS' AS status;
SELECT COUNT(*) as total FROM public.usuarios;

SELECT '✅ MÉDICOS INSERIDOS' AS status;
SELECT COUNT(*) as total FROM public.medicos_juju;

SELECT '✅ PERÍODOS INSERIDOS' AS status;
SELECT COUNT(*) as total FROM public.periodo_juju;

SELECT '✅ PONTOS INSERIDOS' AS status;
SELECT COUNT(*) as total FROM public.ponto_juju2;
