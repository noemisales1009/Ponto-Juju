-- ============================================
-- VIEW: v_distribuicao_faltas
-- DEFINIÇÃO REAL, copiada do banco em produção.
-- Usada por: tela "Distribuição de Faltas" (somente admin).
--
-- Regra: o valor do plantão de quem faltou (falta = 'Sim') é dividido igualmente entre
-- os médicos presentes no mesmo dia, turno (Manhã/Tarde/Noite) e setor.
-- Retorna uma linha por (falta x médico presente); o app agrupa por falta_id.
--
-- Observações:
--  * bonus_por_medico é arredondado em 2 casas; a soma dos bônus pode diferir em centavos do valor.
--  * Sem médicos presentes, bonus_por_medico = 0.
--  * Para restringir a admins, aplique sql/ETAPA_1_seguranca.sql.
-- ============================================

create or replace view public.v_distribuicao_faltas as
with
  turno_norm as (
    select
      ponto_juju2.id,
      ponto_juju2.data_dia,
      ponto_juju2.setor_id,
      ponto_juju2.user_id,
      ponto_juju2.falta,
      ponto_juju2.valor_plantao,
      ponto_juju2.turno,
      case
        when ponto_juju2.turno ~~* 'Manhã%'::text then 'Manhã'::text
        when ponto_juju2.turno ~~* 'Tarde%'::text then 'Tarde'::text
        when ponto_juju2.turno ~~* 'Noite%'::text
        or ponto_juju2.turno ~~* '%noite%'::text then 'Noite'::text
        else ponto_juju2.turno
      end as turno_curto
    from
      ponto_juju2
  ),
  faltas as (
    select
      p.id as falta_id,
      p.data_dia,
      p.turno_curto,
      p.setor_id,
      p.user_id as medico_ausente_id,
      u.nome as medico_ausente_nome,
      COALESCE(p.valor_plantao, 0::numeric) as valor_plantao
    from
      turno_norm p
      left join usuarios u on u.user_id = p.user_id
    where
      p.falta = 'Sim'::text
  ),
  presentes as (
    select
      p.data_dia,
      p.turno_curto,
      p.setor_id,
      p.user_id as medico_presente_id,
      u.nome as medico_presente_nome
    from
      turno_norm p
      left join usuarios u on u.user_id = p.user_id
    where
      p.falta is distinct from 'Sim'::text
  ),
  contagem as (
    select
      presentes.data_dia,
      presentes.turno_curto,
      presentes.setor_id,
      count(*) as total_presentes
    from
      presentes
    group by
      presentes.data_dia,
      presentes.turno_curto,
      presentes.setor_id
  )
select
  f.falta_id,
  f.data_dia,
  f.turno_curto as turno,
  f.setor_id,
  s.nome_setor as setor_nome,
  f.medico_ausente_id,
  f.medico_ausente_nome,
  f.valor_plantao,
  pr.medico_presente_id,
  pr.medico_presente_nome,
  COALESCE(c.total_presentes, 0::bigint) as total_presentes,
  case
    when COALESCE(c.total_presentes, 0::bigint) > 0 then round(f.valor_plantao / c.total_presentes::numeric, 2)
    else 0::numeric
  end as bonus_por_medico,
  EXTRACT(year from f.data_dia)::integer as ano,
  EXTRACT(month from f.data_dia)::integer as mes_numero
from
  faltas f
  left join presentes pr on pr.data_dia = f.data_dia
  and pr.turno_curto = f.turno_curto
  and pr.setor_id = f.setor_id
  left join contagem c on c.data_dia = f.data_dia
  and c.turno_curto = f.turno_curto
  and c.setor_id = f.setor_id
  left join setor_juju s on s.id = f.setor_id
order by
  f.data_dia,
  f.turno_curto,
  f.falta_id;
