-- ============================================================
-- PLANTÃO PASSADO E JÁ PAGO ("ponto trocado")
-- ============================================================
-- A REGRA (definida pela Noemi em 13/11/2026):
--   * Pedro passou o plantão para João e JÁ PAGOU João por fora.
--     João bate o ponto, para comprovar que foi. O valor do plantão vai para Pedro.
--   * Pedro avisa no app que passou o plantão. João confirma depois de bater o ponto.
--     Sem a confirmação de João, o valor continua sendo de João (ponto normal).
--   * Atraso de João: o desconto sai do valor do plantão, ou seja, do que Pedro recebe.
--   * Falta de colega no mesmo turno: o bônus continua indo para quem estava presente (João).
--   * Plantão só passado, SEM pagamento (Maria -> Joana): não usa nada disto. Joana bate o
--     ponto normalmente e recebe.
--
-- O QUE ESTE ARQUIVO FAZ (não apaga nem altera dados; pontos antigos continuam iguais):
--   1. Cria a coluna recebedor_id em ponto_juju2: quem recebe o valor do plantão.
--      Vazia = recebe quem bateu o ponto (todos os pontos de hoje).
--   2. Cria a tabela ponto_troca (o aviso de Pedro) e as funções registrar_troca,
--      cancelar_troca e confirmar_troca.
--   3. Recria as views do Financeiro e do Ganhos somando o valor para quem recebe.
--      São as MESMAS views de produção (mesmas colunas, mesmo filtro de admin), trocando
--      "p.user_id" por "quem recebe". Distribuição e Bônus NÃO mudam.
--
-- ORDEM: rodar DEPOIS de adicionar_localizacao_ponto.sql, adicionar_atraso_ponto.sql e
-- adicionar_pedidos_ponto.sql (usa a função fn_turno_curto criada no arquivo dos pedidos).
-- Pode ser rodado mais de uma vez. Roda numa transação (se falhar, nada é aplicado).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Coluna: quem recebe o valor do plantão
-- ------------------------------------------------------------
-- O app não consegue gravar esta coluna direto: a permissão de INSERT/UPDATE em ponto_juju2
-- é por coluna (sql/ETAPA_1_seguranca.sql) e recebedor_id não está na lista.
ALTER TABLE public.ponto_juju2
  ADD COLUMN IF NOT EXISTS recebedor_id uuid REFERENCES auth.users (id);

CREATE INDEX IF NOT EXISTS idx_ponto_recebedor_id
  ON public.ponto_juju2 (recebedor_id) WHERE recebedor_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2) Tabela dos avisos de troca
-- ------------------------------------------------------------
-- cedente = quem passou o plantão e já pagou (recebe o valor). substituto = quem vai trabalhar.
CREATE TABLE IF NOT EXISTS public.ponto_troca (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cedente_id uuid NOT NULL REFERENCES auth.users (id),
  substituto_id uuid NOT NULL REFERENCES auth.users (id),
  data_dia date NOT NULL,
  turno text NOT NULL CHECK (turno IN ('Manhã', 'Tarde', 'Noite')),
  setor_id bigint NOT NULL REFERENCES public.setor_juju (id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmada', 'cancelada')),
  ponto_id bigint REFERENCES public.ponto_juju2 (id) ON DELETE SET NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  confirmado_em timestamp with time zone,
  CHECK (cedente_id <> substituto_id)
);

-- Um aviso em aberto por plantão passado, e um por plantão coberto
CREATE UNIQUE INDEX IF NOT EXISTS uq_ponto_troca_cedente
  ON public.ponto_troca (cedente_id, data_dia, turno) WHERE status <> 'cancelada';
CREATE UNIQUE INDEX IF NOT EXISTS uq_ponto_troca_substituto
  ON public.ponto_troca (substituto_id, data_dia, turno) WHERE status <> 'cancelada';
CREATE UNIQUE INDEX IF NOT EXISTS uq_ponto_troca_ponto
  ON public.ponto_troca (ponto_id) WHERE ponto_id IS NOT NULL;

-- O Supabase dá acesso total a tabelas novas por padrão: tirar tudo e liberar só a leitura
ALTER TABLE public.ponto_troca ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ponto_troca FROM anon, authenticated;
GRANT SELECT ON public.ponto_troca TO authenticated;

DROP POLICY IF EXISTS "Os dois médicos da troca e o admin veem" ON public.ponto_troca;
CREATE POLICY "Os dois médicos da troca e o admin veem"
  ON public.ponto_troca FOR SELECT TO authenticated
  USING (
    cedente_id = (select auth.uid())
    OR substituto_id = (select auth.uid())
    OR public.is_admin_user()
  );

-- ------------------------------------------------------------
-- 3a) Pedro: avisar que passou o plantão e já pagou
-- ------------------------------------------------------------
-- ERRCODE PT400: o app mostra a mensagem como está (utils/errors.ts)
CREATE OR REPLACE FUNCTION public.registrar_troca(
  p_substituto_id uuid,
  p_data_dia date,
  p_turno text,
  p_setor_id bigint
)
RETURNS public.ponto_troca
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_troca public.ponto_troca;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Faça login novamente.' USING ERRCODE = 'PT400';
    END IF;

    IF p_data_dia IS NULL OR p_turno IS NULL OR p_turno NOT IN ('Manhã', 'Tarde', 'Noite')
       OR NOT EXISTS (SELECT 1 FROM public.setor_juju WHERE id = p_setor_id) THEN
        RAISE EXCEPTION 'Preencha a data, o turno e o setor.' USING ERRCODE = 'PT400';
    END IF;

    IF p_substituto_id IS NULL OR p_substituto_id = v_user_id
       OR NOT EXISTS (SELECT 1 FROM public.usuarios WHERE user_id = p_substituto_id) THEN
        RAISE EXCEPTION 'Escolha o colega que vai fazer o plantão.' USING ERRCODE = 'PT400';
    END IF;

    -- Ontem ainda vale: o aviso pode ser feito depois que o colega já bateu o ponto
    IF p_data_dia < v_hoje - 1 OR p_data_dia > v_hoje + 60 THEN
        RAISE EXCEPTION 'A data precisa ser de ontem até 60 dias à frente.' USING ERRCODE = 'PT400';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.ponto_juju2
        WHERE user_id = v_user_id
          AND data_dia = p_data_dia
          AND public.fn_turno_curto(turno) = p_turno
          AND falta IS DISTINCT FROM 'Sim'
    ) THEN
        RAISE EXCEPTION 'Você já bateu o ponto neste turno.' USING ERRCODE = 'PT400';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.ponto_troca
        WHERE status <> 'cancelada' AND data_dia = p_data_dia AND turno = p_turno
          AND (cedente_id = v_user_id OR substituto_id = p_substituto_id)
    ) THEN
        RAISE EXCEPTION 'Já existe uma troca registrada para este turno (sua ou do colega).' USING ERRCODE = 'PT400';
    END IF;

    INSERT INTO public.ponto_troca (cedente_id, substituto_id, data_dia, turno, setor_id)
    VALUES (v_user_id, p_substituto_id, p_data_dia, p_turno, p_setor_id)
    RETURNING * INTO v_troca;

    RETURN v_troca;
END;
$$;

-- ------------------------------------------------------------
-- 3b) Pedro (ou o admin): cancelar um aviso que João ainda não confirmou
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_troca(p_troca_id bigint)
RETURNS public.ponto_troca
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_troca public.ponto_troca;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Faça login novamente.' USING ERRCODE = 'PT400';
    END IF;

    SELECT * INTO v_troca FROM public.ponto_troca WHERE id = p_troca_id FOR UPDATE;

    IF NOT FOUND OR (v_troca.cedente_id <> v_user_id AND NOT public.is_admin_user()) THEN
        RAISE EXCEPTION 'Troca não encontrada.' USING ERRCODE = 'PT400';
    END IF;

    IF v_troca.status <> 'pendente' THEN
        RAISE EXCEPTION 'Esta troca já foi confirmada ou cancelada.' USING ERRCODE = 'PT400';
    END IF;

    UPDATE public.ponto_troca SET status = 'cancelada' WHERE id = p_troca_id
    RETURNING * INTO v_troca;

    RETURN v_troca;
END;
$$;

-- ------------------------------------------------------------
-- 3c) João: confirmar, depois de bater o ponto, que o valor vai para Pedro
-- ------------------------------------------------------------
-- Só quem bateu o ponto confirma: é ele que abre mão do valor.
CREATE OR REPLACE FUNCTION public.confirmar_troca(p_troca_id bigint)
RETURNS public.ponto_troca
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_troca public.ponto_troca;
    v_ponto_id bigint;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Faça login novamente.' USING ERRCODE = 'PT400';
    END IF;

    SELECT * INTO v_troca FROM public.ponto_troca WHERE id = p_troca_id FOR UPDATE;

    IF NOT FOUND OR v_troca.substituto_id <> v_user_id THEN
        RAISE EXCEPTION 'Troca não encontrada.' USING ERRCODE = 'PT400';
    END IF;

    IF v_troca.status <> 'pendente' THEN
        RAISE EXCEPTION 'Esta troca já foi confirmada ou cancelada.' USING ERRCODE = 'PT400';
    END IF;

    SELECT id INTO v_ponto_id
    FROM public.ponto_juju2
    WHERE user_id = v_user_id
      AND data_dia = v_troca.data_dia
      AND public.fn_turno_curto(turno) = v_troca.turno
      AND setor_id = v_troca.setor_id
      AND falta IS DISTINCT FROM 'Sim'
      AND recebedor_id IS NULL
    ORDER BY id
    LIMIT 1;

    IF v_ponto_id IS NULL THEN
        RAISE EXCEPTION 'Bata o ponto deste plantão antes de confirmar a troca.' USING ERRCODE = 'PT400';
    END IF;

    -- Os triggers recalculam o valor; horário e desconto por atraso ficam como estão
    UPDATE public.ponto_juju2 SET recebedor_id = v_troca.cedente_id WHERE id = v_ponto_id;

    UPDATE public.ponto_troca
    SET status = 'confirmada', ponto_id = v_ponto_id, confirmado_em = now()
    WHERE id = p_troca_id
    RETURNING * INTO v_troca;

    RETURN v_troca;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_troca(uuid, date, text, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancelar_troca(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirmar_troca(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_troca(uuid, date, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_troca(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_troca(bigint) TO authenticated;

-- ------------------------------------------------------------
-- 3d) Ponto de troca confirmada: só o admin apaga
-- ------------------------------------------------------------
-- Sem isto, quem confirmou a troca poderia apagar o ponto e bater de novo para ficar com o valor.
CREATE OR REPLACE FUNCTION public.fn_ponto_troca_proteger()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.recebedor_id IS NOT NULL
       AND current_user IN ('anon', 'authenticated')
       AND NOT public.is_admin_user() THEN
        RAISE EXCEPTION 'Este plantão foi trocado. Só o admin pode apagar o ponto.'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ponto_troca_proteger ON public.ponto_juju2;

CREATE TRIGGER trg_ponto_troca_proteger
BEFORE DELETE
ON public.ponto_juju2
FOR EACH ROW
EXECUTE FUNCTION public.fn_ponto_troca_proteger();

-- ------------------------------------------------------------
-- 4) Views: o valor é somado para quem RECEBE o plantão
-- ------------------------------------------------------------
-- Cópia das views em produção (conferidas em 13/11/2026). Única mudança: onde era p.user_id
-- agora é COALESCE(p.recebedor_id, p.user_id). Falta registrada pelo app não tem recebedor,
-- então continua contando para quem faltou.

-- 4a) Financeiro
create or replace view public.nova_total_por_medico_mes as
select
  COALESCE(p.recebedor_id, p.user_id) as user_id,
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
  left join medicos_juju m on COALESCE(p.recebedor_id, p.user_id) = m.user_id
where
  public.is_admin_user()
group by
  COALESCE(p.recebedor_id, p.user_id),
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

-- 4b) Ganhos (base). v_ganhos_mensais_usuario lê desta e não precisa mudar.
create or replace view public.v_ganhos_usuario as
select
  p.id as ponto_id,
  COALESCE(p.recebedor_id, p.user_id) as user_id,
  m.medico as usuario_nome,
  p.data_dia as data,
  case EXTRACT(dow from p.data_dia)
    when 0 then 'Domingo'::text
    when 1 then 'Segunda'::text
    when 2 then 'Terça'::text
    when 3 then 'Quarta'::text
    when 4 then 'Quinta'::text
    when 5 then 'Sexta'::text
    when 6 then 'Sábado'::text
    else null::text
  end as dia_semana,
  p.turno,
  s.nome_setor as setor,
  COALESCE(p.valor_plantao, per.valor_por_plantao, 0::numeric) as valor_plantao,
  EXTRACT(month from p.data_dia) as mes_numero,
  EXTRACT(year from p.data_dia) as ano,
  to_char(p.data_dia::timestamp with time zone, 'TMMonth'::text) as nome_mes
from
  ponto_juju2 p
  left join medicos_juju m on COALESCE(p.recebedor_id, p.user_id) = m.user_id
  left join setor_juju s on p.setor_id = s.id
  left join periodo_juju per on p.periodo_id = per.id
where
  p.falta is null;

COMMIT;

-- ============================================================
-- VER AS TROCAS:
--   SELECT t.id, t.data_dia, t.turno, c.nome AS passou, s.nome AS fez, t.status
--   FROM public.ponto_troca t
--   LEFT JOIN public.usuarios c ON c.user_id = t.cedente_id
--   LEFT JOIN public.usuarios s ON s.user_id = t.substituto_id
--   ORDER BY t.data_dia DESC;
--
-- DESFAZER UMA TROCA JÁ CONFIRMADA (o valor volta para quem bateu o ponto). Rode no SQL Editor,
-- trocando o 123 pelo id da troca:
--   UPDATE public.ponto_juju2 SET recebedor_id = NULL
--     WHERE id = (SELECT ponto_id FROM public.ponto_troca WHERE id = 123);
--   UPDATE public.ponto_troca SET status = 'cancelada', ponto_id = NULL WHERE id = 123;
--
-- PARA DESFAZER TUDO:
--   1. Rode de novo o item 7 de sql/ETAPA_1_seguranca.sql (views do Financeiro) e
--      sql/criar_views_ganhos.sql só a parte de v_ganhos_usuario (views voltam a somar por quem bateu).
--   2. DROP TRIGGER IF EXISTS trg_ponto_troca_proteger ON public.ponto_juju2;
--      DROP FUNCTION IF EXISTS public.fn_ponto_troca_proteger();
--      DROP FUNCTION IF EXISTS public.confirmar_troca(bigint);
--      DROP FUNCTION IF EXISTS public.cancelar_troca(bigint);
--      DROP FUNCTION IF EXISTS public.registrar_troca(uuid, date, text, bigint);
--      DROP TABLE IF EXISTS public.ponto_troca;
--      ALTER TABLE public.ponto_juju2 DROP COLUMN IF EXISTS recebedor_id;
-- ============================================================
