-- ============================================
-- VIEW: nova_total_por_medico_mes
-- DEFINIÇÃO REAL, copiada do banco em produção.
-- Usada por: Painel Admin e Relatório Financeiro.
--
-- Colunas de valor:
--   valor_soma_total = soma dos plantões sem falta (valor_plantao; 500,00 se estiver vazio)
--   total_a_pagar    = valor_soma_total - 20,00 (desconto FIXO por médico/mês)
--
-- ATENÇÃO:
--  * Esta view expõe CPF e dados bancários de todos os médicos. Para restringir a
--    administradores, aplique sql/ETAPA_1_seguranca.sql.
--  * Não é possível criar índice em view comum; os índices ficam em ponto_juju2.
-- ============================================

create or replace view public.nova_total_por_medico_mes as
select
  p.user_id,
  m.medico as medico_nome,
  m.cpf,
  m.banco,
  m.agencia,
  m.variacao,
  m.conta,
  EXTRACT(year from p.data_dia)::integer as ano,
  to_char(p.data_dia::timestamp with time zone, 'TMMonth'::text) as nome_mes,
  sum(
    case
      when p.falta is null then COALESCE(p.valor_plantao, 500.00)
      else 0.00
    end
  ) as valor_soma_total,
  count(
    case
      when p.falta is null then p.id
      else null::bigint
    end
  ) as total_plantao_realizados,
  count(
    case
      when p.falta is not null then p.id
      else null::bigint
    end
  ) as total_faltas,
  sum(
    case
      when p.falta is null then COALESCE(p.valor_plantao, 500.00)
      else 0.00
    end
  ) - 20.00 as total_a_pagar
from
  ponto_juju2 p
  left join medicos_juju m on p.user_id = m.user_id
group by
  p.user_id,
  m.medico,
  m.cpf,
  m.banco,
  m.agencia,
  m.variacao,
  m.conta,
  (EXTRACT(year from p.data_dia)),
  (to_char(p.data_dia::timestamp with time zone, 'TMMonth'::text))
order by
  (EXTRACT(year from p.data_dia)::integer) desc,
  (to_char(p.data_dia::timestamp with time zone, 'TMMonth'::text)) desc,
  m.medico;
