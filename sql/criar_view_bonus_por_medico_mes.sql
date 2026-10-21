-- ============================================
-- VIEW: v_bonus_por_medico_mes
-- DEFINIÇÃO REAL, copiada do banco em produção.
-- Usada por: tela "Distribuição de Faltas" (resumo de bônus por médico).
--
-- Depende de v_distribuicao_faltas (sql/criar_view_distribuicao_faltas.sql).
-- Soma, por médico presente/mês/setor, os bônus recebidos por cobrir faltas.
-- Para restringir a admins, aplique sql/ETAPA_1_seguranca.sql
-- (basta filtrar v_distribuicao_faltas; esta view herda a restrição).
-- ============================================

create or replace view public.v_bonus_por_medico_mes as
select
  v_distribuicao_faltas.medico_presente_id as user_id,
  v_distribuicao_faltas.medico_presente_nome as nome,
  v_distribuicao_faltas.ano,
  v_distribuicao_faltas.mes_numero,
  v_distribuicao_faltas.setor_id,
  v_distribuicao_faltas.setor_nome,
  count(distinct v_distribuicao_faltas.falta_id) as total_coberturas,
  sum(v_distribuicao_faltas.bonus_por_medico) as total_bonus
from
  v_distribuicao_faltas
where
  v_distribuicao_faltas.medico_presente_id is not null
group by
  v_distribuicao_faltas.medico_presente_id,
  v_distribuicao_faltas.medico_presente_nome,
  v_distribuicao_faltas.ano,
  v_distribuicao_faltas.mes_numero,
  v_distribuicao_faltas.setor_id,
  v_distribuicao_faltas.setor_nome
order by
  (sum(v_distribuicao_faltas.bonus_por_medico)) desc;
