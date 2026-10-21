-- ============================================================
-- ETAPA 1 — SEGURANÇA DO APP DE PONTO (rode ESTE arquivo primeiro)
-- ============================================================
-- Projeto Supabase: Hospital Dr. Juvêncio Mattos / Checklist / main (PRODUÇÃO)
--
-- O QUE FAZ (nada disto apaga ou altera dados):
--   1. ponto_juju2: ninguém forja o "created_by"; fecha a leitura aberta a quem não fez login
--   2. ponto_juju2: o navegador só grava as colunas que o app envia (não grava valor_plantao)
--   3. usuarios:    ninguém consegue definir/alterar o próprio "role" (virar admin)
--   4. medicos_juju: ninguém altera CPF/banco/agência/conta pelo navegador
--   5. periodo_juju e setor_juju: somente leitura (ninguém altera os preços dos plantões)
--   6. Valida valores no banco (falta só vazio ou 'Sim'; tamanho de nome e foto)
--   7. Financeiro e Distribuição: só admin; Ganhos: cada médico vê só o seu
--
-- O QUE NÃO FAZ (fica para a ETAPA 2, depois de confirmar que nenhum outro sistema depende disso):
--   * fechar a LEITURA sem login de usuarios e medicos_juju (CPF e conta continuam legíveis por
--     quem tem a chave pública do projeto até a Etapa 2)
--
-- ANTES DE RODAR:
--   [ ] Faça um backup (Database > Backups)
--   [ ] Rode no SQL Editor (botão Run). É uma transação: se qualquer comando falhar, NADA é aplicado.
--
-- DEPOIS DE RODAR, teste (veja a lista no final do arquivo).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0) Função auxiliar: "o usuário logado é admin?"
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- ------------------------------------------------------------
-- 1) ponto_juju2: políticas
-- ------------------------------------------------------------
-- Políticas permissivas se SOMAM. Estas duas existem hoje e anulariam a regra nova:
--   * INSERT "Usuários autenticados podem criar pontos": só exige estar logado
--   * SELECT "Permitir leitura de todos os pontos": using true (qualquer um, até sem login, lê tudo)
-- A leitura para logados continua pela política "Apenas logados podem ver pontos".
DROP POLICY IF EXISTS "Usuários autenticados podem criar pontos" ON public.ponto_juju2;
DROP POLICY IF EXISTS "Permitir leitura de todos os pontos" ON public.ponto_juju2;
DROP POLICY IF EXISTS "Qualquer autenticado pode inserir ponto/falta" ON public.ponto_juju2;
DROP POLICY IF EXISTS "Autenticado insere ponto/falta como ele mesmo" ON public.ponto_juju2;

CREATE POLICY "Autenticado insere ponto/falta como ele mesmo"
  ON public.ponto_juju2
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());
  -- Opcional (Semi 1 desativado no app): bloquear também no banco, trocando a linha acima por:
  -- WITH CHECK (created_by = auth.uid() AND setor_id <> 1);

-- ------------------------------------------------------------
-- 2) ponto_juju2: permissão por coluna (só o que o app envia)
-- ------------------------------------------------------------
-- O trigger continua calculando valor_plantao, periodo_id e dia_semana_calculado
-- (permissão de coluna vale para o que o usuário informa, não para o que o trigger calcula).
REVOKE INSERT, UPDATE ON public.ponto_juju2 FROM anon, authenticated;

GRANT INSERT (user_id, created_by, data, data_dia, turno, setor_id, falta, turno_preenchido)
  ON public.ponto_juju2 TO authenticated;

GRANT UPDATE (data, data_dia, turno, falta, turno_preenchido)
  ON public.ponto_juju2 TO authenticated;

-- ------------------------------------------------------------
-- 3) usuarios: a coluna "role" não pode ser definida nem alterada pelo navegador
-- ------------------------------------------------------------
-- Troca a permissão de tabela inteira por permissão por coluna, SEM a coluna role.
-- As demais colunas continuam como antes (outros sistemas não são afetados).
-- role só muda pelo SQL Editor (ou service_role).
REVOKE INSERT, UPDATE ON public.usuarios FROM anon, authenticated;

GRANT INSERT (user_id, nome, setor, funcao, email, foto, ativo, setor_id)
  ON public.usuarios TO anon, authenticated;

GRANT UPDATE (nome, setor, funcao, email, foto, ativo, setor_id)
  ON public.usuarios TO anon, authenticated;

-- ------------------------------------------------------------
-- 4) medicos_juju: dados bancários e CPF não podem ser alterados pelo navegador
-- ------------------------------------------------------------
-- O navegador só pode editar o nome (coluna "medico"), usado em "Meu Perfil".
REVOKE INSERT, UPDATE, DELETE ON public.medicos_juju FROM anon, authenticated;
GRANT UPDATE (medico) ON public.medicos_juju TO authenticated;

-- ------------------------------------------------------------
-- 5) periodo_juju e setor_juju: somente leitura
-- ------------------------------------------------------------
-- O app (e o trigger) só LEEM estas tabelas. SELECT não é alterado.
REVOKE INSERT, UPDATE, DELETE ON public.periodo_juju FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.setor_juju FROM anon, authenticated;

-- ------------------------------------------------------------
-- 6) Validação no banco (NOT VALID: vale para novos registros e edições; não bloqueia dados antigos)
-- ------------------------------------------------------------
-- falta só pode ser NULL (presente) ou 'Sim'. O app só trata 'Sim' como falta, mas a view financeira
-- trata TODO valor não nulo como falta; um valor estranho faria a tela e o pagamento discordarem.
-- Antes, confira se há lixo:  SELECT falta, count(*) FROM public.ponto_juju2 GROUP BY falta;
ALTER TABLE public.ponto_juju2 DROP CONSTRAINT IF EXISTS ponto_juju2_falta_valida;
ALTER TABLE public.ponto_juju2
  ADD CONSTRAINT ponto_juju2_falta_valida CHECK (falta IS NULL OR falta = 'Sim') NOT VALID;

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_nome_tamanho;
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_nome_tamanho CHECK (char_length(nome) BETWEEN 2 AND 100) NOT VALID;

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_foto_tamanho;
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_foto_tamanho CHECK (foto IS NULL OR char_length(foto) <= 700000) NOT VALID;

ALTER TABLE public.medicos_juju DROP CONSTRAINT IF EXISTS medicos_juju_medico_tamanho;
ALTER TABLE public.medicos_juju
  ADD CONSTRAINT medicos_juju_medico_tamanho CHECK (medico IS NULL OR char_length(medico) BETWEEN 2 AND 100) NOT VALID;

-- ------------------------------------------------------------
-- 7) Views financeiras: só admin; Ganhos: cada médico vê só o seu
-- ------------------------------------------------------------
-- Views ignoram a RLS. Estas são as MESMAS views de produção (mesmas colunas), com um filtro a mais.

-- 7a) nova_total_por_medico_mes -> só admin (CPF, banco, conta e valores de todos)
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
where
  public.is_admin_user()
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

-- 7b) v_ganhos_mensais_usuario -> cada médico vê só o seu (admin vê todos)
create or replace view public.v_ganhos_mensais_usuario as
select
  v_ganhos_usuario.user_id,
  v_ganhos_usuario.usuario_nome,
  v_ganhos_usuario.ano,
  v_ganhos_usuario.mes_numero,
  v_ganhos_usuario.nome_mes,
  count(*) as total_plantoes,
  sum(v_ganhos_usuario.valor_plantao) as total_ganhos
from
  v_ganhos_usuario
where
  v_ganhos_usuario.user_id = (select auth.uid())
  or public.is_admin_user()
group by
  v_ganhos_usuario.user_id,
  v_ganhos_usuario.usuario_nome,
  v_ganhos_usuario.ano,
  v_ganhos_usuario.mes_numero,
  v_ganhos_usuario.nome_mes
order by
  v_ganhos_usuario.ano desc,
  v_ganhos_usuario.mes_numero desc,
  v_ganhos_usuario.usuario_nome;

-- 7c) v_distribuicao_faltas -> só admin (v_bonus_por_medico_mes lê desta, então herda a restrição)
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
where
  public.is_admin_user()
order by
  f.data_dia,
  f.turno_curto,
  f.falta_id;

-- 7d) Permissões das views: sem acesso sem login; só usuários logados
REVOKE ALL ON public.nova_total_por_medico_mes FROM anon;
REVOKE ALL ON public.v_ganhos_mensais_usuario FROM anon;
REVOKE ALL ON public.v_distribuicao_faltas FROM anon;
REVOKE ALL ON public.v_bonus_por_medico_mes FROM anon;

GRANT SELECT ON public.nova_total_por_medico_mes TO authenticated;
GRANT SELECT ON public.v_ganhos_mensais_usuario TO authenticated;
GRANT SELECT ON public.v_distribuicao_faltas TO authenticated;
GRANT SELECT ON public.v_bonus_por_medico_mes TO authenticated;

-- 7e) Views base que o app NÃO consulta direto: fechar para todos.
-- As views acima rodam com as permissões do dono (postgres) e continuam lendo estas.
-- vw_medicos_completo expõe CPF, banco e e-mail de todos.
DO $$
DECLARE
  obj text;
BEGIN
  FOREACH obj IN ARRAY ARRAY['v_ganhos_usuario', 'vw_medicos_completo', 'v_ponto_detalhado2_nova']
  LOOP
    IF to_regclass('public.' || obj) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', obj);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- TESTE DEPOIS DE RODAR (pelo app, em https://… do ponto):
--   Como médico comum:
--     [ ] entrar e ver a tela de plantões com os nomes dos colegas
--     [ ] bater ponto
--     [ ] registrar uma falta para um colega
--     [ ] editar e deletar o próprio ponto
--     [ ] "Meus Pontos" e "Ganhos" mostram os valores
--     [ ] "Meu Perfil": salvar o nome
--   Como admin:
--     [ ] Painel Admin, Financeiro, Distribuição e Escala abrem e listam os médicos
--   Se OUTRO sistema do hospital quebrar, veja "PARA DESFAZER" abaixo e me avise.
--
-- PARA DESFAZER (devolve as permissões antigas; não mexe em dados):
--   GRANT INSERT, UPDATE ON public.ponto_juju2 TO anon, authenticated;
--   GRANT INSERT, UPDATE ON public.usuarios TO anon, authenticated;
--   GRANT INSERT, UPDATE, DELETE ON public.medicos_juju TO anon, authenticated;
--   GRANT INSERT, UPDATE, DELETE ON public.periodo_juju TO anon, authenticated;
--   GRANT INSERT, UPDATE, DELETE ON public.setor_juju TO anon, authenticated;
--   CREATE POLICY "Permitir leitura de todos os pontos" ON public.ponto_juju2 FOR SELECT USING (true);
--   CREATE POLICY "Usuários autenticados podem criar pontos" ON public.ponto_juju2 FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
--   GRANT SELECT ON public.v_ganhos_usuario, public.vw_medicos_completo TO anon, authenticated;
--   (as views voltam ao normal rodando sql/criar_view_nova_total_por_medico_mes.sql,
--    sql/criar_view_distribuicao_faltas.sql e sql/criar_views_ganhos.sql)
-- ============================================================
