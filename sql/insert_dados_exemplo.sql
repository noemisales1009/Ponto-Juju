-- ============================================
-- INSERIR DADOS DE EXEMPLO NO SUPABASE
-- ============================================

-- ============================================
-- 1. INSERIR SETORES (se não existir)
-- ============================================
INSERT INTO public.setor_juju (setor, ativo)
VALUES 
  ('UTI Pediátrica', true),
  ('Semi Intensiva', true),
  ('Clínica Geral', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. INSERIR PERÍODOS (se não existir)
-- ============================================
INSERT INTO public.periodo_juju (setor_id, periodo, valor_por_plantao)
VALUES
  (1, 'Manhã Semana (07h - 13h)', 875),
  (1, 'Tarde Semana (13h - 19h)', 825),
  (1, 'Noite Semana (19h - 07h)', 1900),
  (1, 'Manhã Final de Semana (07h - 13h)', 950),
  (1, 'Tarde Final de Semana (13h - 19h)', 925),
  (1, 'Noite Final de Semana (19h - 07h)', 2400),
  (2, 'Manhã Semana (07h - 13h)', 825),
  (2, 'Tarde Semana (13h - 19h)', 800),
  (2, 'Noite Semana (19h - 07h)', 1800),
  (2, 'Manhã Final de Semana (07h - 13h)', 900),
  (2, 'Tarde Final de Semana (13h - 19h)', 875),
  (2, 'Noite Final de Semana (19h - 07h)', 2000)
ON CONFLICT DO NOTHING;

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
-- 4. INSERIR MÉDICOS
-- ============================================
-- Você pode obter os user_id dos usuários criados acima
-- Para este exemplo, usarei placeholders que você precisa substituir
-- Execute primeiro: SELECT user_id, email FROM public.usuarios;

-- Depois substitua os UUIDs dos user_id reais

-- Exemplo (SUBSTITUA OS UUIDS):
-- INSERT INTO public.medicos_juju (user_id, medico, banco, agencia, variacao, cpf, conta)
-- VALUES
--   ('UUID_ADILLA', 'Dra. Adilla Stefany', 'Itaú', '1234', '001', '12345678901', '123456-7'),
--   ('UUID_ANDRE', 'Dr. André Vinicius Reis Queiroga', 'Banco do Brasil', '5678', '000', '98765432101', '654321-9'),
--   ('UUID_JOAO', 'Dr. João Silva', 'Caixa', '0001', '001', '11111111111', '111111-1'),
--   ('UUID_MARIA', 'Dra. Maria Santos', 'Bradesco', '2222', '001', '22222222222', '222222-2'),
--   ('UUID_CARLOS', 'Dr. Carlos Oliveira', 'Santander', '3333', '001', '33333333333', '333333-3')
-- ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- INSTRUÇÕES PARA COMPLETAR:
-- ============================================
-- 1. Execute primeiro: SELECT user_id, email FROM public.usuarios;
-- 2. Copie os UUIDs retornados
-- 3. Substitua 'UUID_ADILLA', 'UUID_ANDRE', etc. pelos UUIDs reais
-- 4. Execute o INSERT acima com os UUIDs corretos

-- ============================================
-- 5. INSERIR DADOS DE EXEMPLO DE PONTOS
-- ============================================
-- Você também pode inserir alguns pontos de exemplo:
-- INSERT INTO public.ponto_juju2 (user_id, data, turno, setor_id, turno_preenchido)
-- VALUES
--   ('UUID_ADILLA', now(), 'Manhã Semana (07h - 13h)', 1, true),
--   ('UUID_ANDRE', now(), 'Tarde Semana (13h - 19h)', 2, true),
--   ('UUID_JOAO', now(), 'Noite Semana (19h - 07h)', 3, true);

-- ============================================
-- 6. INSERIR DADOS DE EXEMPLO DE FALTAS
-- ============================================
-- INSERT INTO public.falta_medico (user_id, data_falta)
-- VALUES
--   ('UUID_ADILLA', CURRENT_DATE - INTERVAL '1 day'),
--   ('UUID_ANDRE', CURRENT_DATE);
