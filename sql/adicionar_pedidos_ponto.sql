-- ============================================================
-- PEDIDOS DE CORREÇÃO DO PONTO: ATRASO JUSTIFICADO E PONTO ESQUECIDO
-- (rode DEPOIS de adicionar_localizacao_ponto.sql e adicionar_atraso_ponto.sql)
-- ============================================================
-- A REGRA (definida pela Noemi, proposta enviada à Dra. Lélia):
--   * ATRASO: o médico com desconto por atraso escreve o motivo. Se o admin aprovar, o desconto
--     sai e o plantão volta ao valor cheio. Se recusar, o desconto fica.
--   * PONTO ESQUECIDO: o médico que não bateu o ponto informa data, turno, setor, horário e motivo.
--     Se o admin aprovar, o ponto entra no pagamento, sem desconto e sem horário gravado.
--     (vale também para GPS que falhou e para quem chegou na Noite depois da meia-noite)
--   * Prazo para pedir: até 2 dias depois do plantão.
--   * Quem decide: o admin (Dra. Lélia). Ninguém decide o próprio pedido.
--   * O GPS não confirma o ponto esquecido: vale a palavra do médico e a decisão do admin.
--   * O motivo pode ser pessoal: só o próprio médico e o admin leem os pedidos.
--
-- O QUE ESTE ARQUIVO FAZ (não apaga nem altera pontos):
--   1. Cria a tabela ponto_pedido, protegida: só leitura, da própria linha ou do admin.
--   2. Cria as funções pedir_abono_atraso e pedir_ponto_esquecido (o médico pede).
--   3. Cria a função decidir_pedido (o admin aprova ou recusa).
--
-- ERRCODE PT400: mensagem escrita para o médico; o app mostra o texto como está (utils/errors.ts).
-- Pode ser rodado mais de uma vez. Roda numa transação (se falhar, nada é aplicado).
-- ============================================================

BEGIN;

-- 0) Turno curto do app ("Manhã Semana (07h - 13h)" -> "Manhã"), mesmo critério de v_distribuicao_faltas
CREATE OR REPLACE FUNCTION public.fn_turno_curto(p_turno text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_turno ILIKE 'Manhã%' OR p_turno ILIKE 'Manha%' THEN 'Manhã'
    WHEN p_turno ILIKE 'Tarde%' THEN 'Tarde'
    WHEN p_turno ILIKE '%noite%' THEN 'Noite'
    ELSE p_turno
  END;
$$;

-- 1) Tabela dos pedidos
CREATE TABLE IF NOT EXISTS public.ponto_pedido (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('atraso', 'esquecido')),
  user_id uuid NOT NULL REFERENCES auth.users (id),
  ponto_id bigint REFERENCES public.ponto_juju2 (id) ON DELETE SET NULL,
  data_dia date NOT NULL,
  turno text NOT NULL CHECK (turno IN ('Manhã', 'Tarde', 'Noite')),
  setor_id bigint NOT NULL REFERENCES public.setor_juju (id),
  horario time,
  motivo text NOT NULL CHECK (char_length(motivo) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  minutos_atraso integer,
  desconto_original numeric,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  decidido_por uuid REFERENCES auth.users (id),
  decidido_em timestamp with time zone,
  observacao text CHECK (observacao IS NULL OR char_length(observacao) <= 1000)
);

-- Um pedido de atraso por ponto; um pedido de ponto esquecido aguardando por turno
CREATE UNIQUE INDEX IF NOT EXISTS uq_ponto_pedido_atraso
  ON public.ponto_pedido (ponto_id) WHERE tipo = 'atraso';
CREATE UNIQUE INDEX IF NOT EXISTS uq_ponto_pedido_esquecido_pendente
  ON public.ponto_pedido (user_id, data_dia, turno) WHERE tipo = 'esquecido' AND status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_ponto_pedido_user_id ON public.ponto_pedido (user_id);
CREATE INDEX IF NOT EXISTS idx_ponto_pedido_pendente ON public.ponto_pedido (criado_em) WHERE status = 'pendente';

-- O Supabase dá acesso total a tabelas novas por padrão: tirar tudo e liberar só a leitura
ALTER TABLE public.ponto_pedido ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ponto_pedido FROM anon, authenticated;
GRANT SELECT ON public.ponto_pedido TO authenticated;

DROP POLICY IF EXISTS "Médico vê os próprios pedidos; admin vê todos" ON public.ponto_pedido;
CREATE POLICY "Médico vê os próprios pedidos; admin vê todos"
  ON public.ponto_pedido FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_admin_user());

-- 2a) Médico: justificar um atraso
CREATE OR REPLACE FUNCTION public.pedir_abono_atraso(p_ponto_id bigint, p_motivo text)
RETURNS public.ponto_pedido
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_motivo text := btrim(COALESCE(p_motivo, ''));
    v_ponto public.ponto_juju2;
    v_pedido public.ponto_pedido;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Faça login novamente.' USING ERRCODE = 'PT400';
    END IF;

    IF char_length(v_motivo) < 10 THEN
        RAISE EXCEPTION 'Escreva o motivo do atraso (pelo menos 10 letras).' USING ERRCODE = 'PT400';
    END IF;

    SELECT * INTO v_ponto FROM public.ponto_juju2 WHERE id = p_ponto_id AND user_id = v_user_id;

    IF NOT FOUND OR v_ponto.falta = 'Sim' OR COALESCE(v_ponto.desconto_atraso, 0) <= 0 THEN
        RAISE EXCEPTION 'Este ponto não tem desconto por atraso.' USING ERRCODE = 'PT400';
    END IF;

    IF v_ponto.data_dia < v_hoje - 2 THEN
        RAISE EXCEPTION 'O prazo para justificar é de até 2 dias depois do plantão.' USING ERRCODE = 'PT400';
    END IF;

    IF EXISTS (SELECT 1 FROM public.ponto_pedido WHERE tipo = 'atraso' AND ponto_id = p_ponto_id) THEN
        RAISE EXCEPTION 'Este atraso já foi justificado.' USING ERRCODE = 'PT400';
    END IF;

    INSERT INTO public.ponto_pedido
        (tipo, user_id, ponto_id, data_dia, turno, setor_id, horario, motivo, minutos_atraso, desconto_original)
    VALUES
        ('atraso', v_user_id, v_ponto.id, v_ponto.data_dia, public.fn_turno_curto(v_ponto.turno), v_ponto.setor_id,
         (v_ponto.batido_em AT TIME ZONE 'America/Sao_Paulo')::time, v_motivo,
         v_ponto.minutos_atraso, v_ponto.desconto_atraso)
    RETURNING * INTO v_pedido;

    RETURN v_pedido;
END;
$$;

-- 2b) Médico: pedir um ponto esquecido
-- Ao mudar os horários dos turnos, mudar também SHIFT_START_HOUR em constants.ts
CREATE OR REPLACE FUNCTION public.pedir_ponto_esquecido(
  p_data_dia date,
  p_turno text,
  p_setor_id bigint,
  p_horario time,
  p_motivo text
)
RETURNS public.ponto_pedido
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_motivo text := btrim(COALESCE(p_motivo, ''));
    v_hora_inicio integer;
    v_pedido public.ponto_pedido;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Faça login novamente.' USING ERRCODE = 'PT400';
    END IF;

    v_hora_inicio := CASE p_turno WHEN 'Manhã' THEN 7 WHEN 'Tarde' THEN 13 WHEN 'Noite' THEN 19 END;

    IF v_hora_inicio IS NULL OR p_data_dia IS NULL OR p_horario IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.setor_juju WHERE id = p_setor_id) THEN
        RAISE EXCEPTION 'Preencha a data, o turno, o setor e o horário.' USING ERRCODE = 'PT400';
    END IF;

    IF char_length(v_motivo) < 10 THEN
        RAISE EXCEPTION 'Escreva o motivo (pelo menos 10 letras).' USING ERRCODE = 'PT400';
    END IF;

    IF p_data_dia > v_hoje OR p_data_dia < v_hoje - 2 THEN
        RAISE EXCEPTION 'O pedido só pode ser feito até 2 dias depois do plantão.' USING ERRCODE = 'PT400';
    END IF;

    IF now() < (p_data_dia + make_time(v_hora_inicio, 0, 0)) AT TIME ZONE 'America/Sao_Paulo' THEN
        RAISE EXCEPTION 'Esse turno ainda não começou.' USING ERRCODE = 'PT400';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.ponto_juju2
        WHERE user_id = v_user_id
          AND data_dia = p_data_dia
          AND public.fn_turno_curto(turno) = p_turno
          AND falta IS DISTINCT FROM 'Sim'
    ) THEN
        RAISE EXCEPTION 'Você já tem ponto neste turno.' USING ERRCODE = 'PT400';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.ponto_pedido
        WHERE tipo = 'esquecido' AND status = 'pendente'
          AND user_id = v_user_id AND data_dia = p_data_dia AND turno = p_turno
    ) THEN
        RAISE EXCEPTION 'Já existe um pedido para este turno aguardando aprovação.' USING ERRCODE = 'PT400';
    END IF;

    INSERT INTO public.ponto_pedido (tipo, user_id, data_dia, turno, setor_id, horario, motivo)
    VALUES ('esquecido', v_user_id, p_data_dia, p_turno, p_setor_id, p_horario, v_motivo)
    RETURNING * INTO v_pedido;

    RETURN v_pedido;
END;
$$;

-- 3) Admin: aprovar ou recusar
CREATE OR REPLACE FUNCTION public.decidir_pedido(p_pedido_id bigint, p_aprovar boolean, p_observacao text)
RETURNS public.ponto_pedido
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_pedido public.ponto_pedido;
    v_ponto_id bigint;
BEGIN
    IF v_user_id IS NULL OR NOT public.is_admin_user() THEN
        RAISE EXCEPTION 'Só o administrador pode decidir os pedidos.' USING ERRCODE = 'PT400';
    END IF;

    IF p_aprovar IS NULL THEN
        RAISE EXCEPTION 'Escolha aprovar ou recusar.' USING ERRCODE = 'PT400';
    END IF;

    SELECT * INTO v_pedido FROM public.ponto_pedido WHERE id = p_pedido_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'PT400';
    END IF;

    IF v_pedido.status <> 'pendente' THEN
        RAISE EXCEPTION 'Este pedido já foi decidido.' USING ERRCODE = 'PT400';
    END IF;

    IF v_pedido.user_id = v_user_id THEN
        RAISE EXCEPTION 'Ninguém pode decidir o próprio pedido.' USING ERRCODE = 'PT400';
    END IF;

    IF p_aprovar AND v_pedido.tipo = 'atraso' THEN
        IF v_pedido.ponto_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.ponto_juju2 WHERE id = v_pedido.ponto_id) THEN
            RAISE EXCEPTION 'O ponto deste pedido foi apagado.' USING ERRCODE = 'PT400';
        END IF;

        -- Os triggers recalculam o valor cheio e não descontam nada
        UPDATE public.ponto_juju2 SET desconto_atraso = 0 WHERE id = v_pedido.ponto_id;
        v_ponto_id := v_pedido.ponto_id;

    ELSIF p_aprovar THEN
        IF EXISTS (
            SELECT 1 FROM public.ponto_juju2
            WHERE user_id = v_pedido.user_id
              AND data_dia = v_pedido.data_dia
              AND public.fn_turno_curto(turno) = v_pedido.turno
              AND falta IS DISTINCT FROM 'Sim'
        ) THEN
            RAISE EXCEPTION 'O médico já tem ponto neste turno. Recuse o pedido.' USING ERRCODE = 'PT400';
        END IF;

        -- Avisa o trigger do atraso: entra sem horário e sem desconto (só nesta transação)
        PERFORM set_config('ponto.pedido_aprovado', 'sim', true);

        -- Se um colega registrou falta para o médico, a falta vira presença.
        -- created_by passa a ser o médico: o colega não pode mais apagar o ponto.
        SELECT id INTO v_ponto_id
        FROM public.ponto_juju2
        WHERE user_id = v_pedido.user_id
          AND data_dia = v_pedido.data_dia
          AND public.fn_turno_curto(turno) = v_pedido.turno
          AND falta = 'Sim'
        ORDER BY id
        LIMIT 1;

        IF v_ponto_id IS NOT NULL THEN
            UPDATE public.ponto_juju2
            SET falta = NULL, turno_preenchido = true, created_by = v_pedido.user_id
            WHERE id = v_ponto_id;
        ELSE
            -- "data" ao meio-dia UTC, como o app sempre enviou (o trigger deriva data_dia dela)
            INSERT INTO public.ponto_juju2 (user_id, created_by, data, data_dia, turno, setor_id, falta, turno_preenchido)
            VALUES (v_pedido.user_id, v_pedido.user_id, (v_pedido.data_dia + time '12:00') AT TIME ZONE 'UTC',
                    v_pedido.data_dia, v_pedido.turno, v_pedido.setor_id, NULL, true)
            RETURNING id INTO v_ponto_id;
        END IF;

        PERFORM set_config('ponto.pedido_aprovado', '', true);
    END IF;

    UPDATE public.ponto_pedido
    SET status = CASE WHEN p_aprovar THEN 'aprovado' ELSE 'recusado' END,
        decidido_por = v_user_id,
        decidido_em = now(),
        observacao = NULLIF(btrim(COALESCE(p_observacao, '')), ''),
        ponto_id = COALESCE(v_ponto_id, ponto_id)
    WHERE id = p_pedido_id
    RETURNING * INTO v_pedido;

    RETURN v_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.pedir_abono_atraso(bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pedir_ponto_esquecido(date, text, bigint, time, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decidir_pedido(bigint, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_abono_atraso(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pedir_ponto_esquecido(date, text, bigint, time, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decidir_pedido(bigint, boolean, text) TO authenticated;

COMMIT;

-- ============================================================
-- TESTE DEPOIS DE RODAR (pelo app):
--   Médico:
--     [ ] Meus Pontos > atraso > Justificar             -> aparece "Aguardando aprovação"
--     [ ] Meus Pontos > Esqueci de bater o ponto         -> aparece "Aguardando aprovação"
--     [ ] pedir para um plantão de 3 dias atrás          -> recusado (prazo)
--   Admin (Dra. Lélia):
--     [ ] Pedidos > Aprovar atraso                       -> desconto some; Financeiro volta ao valor cheio
--     [ ] Pedidos > Aprovar ponto esquecido              -> ponto aparece em Plantões e no Financeiro
--     [ ] Pedidos > Recusar                              -> médico vê "Recusado" e a observação
--
-- VER OS PEDIDOS (SQL Editor):
--   SELECT id, tipo, status, data_dia, turno, motivo, criado_em, decidido_em, observacao
--   FROM public.ponto_pedido ORDER BY criado_em DESC;
--
-- PARA DESFAZER (os pedidos e as decisões já tomadas ficam na tabela):
--   DROP FUNCTION IF EXISTS public.decidir_pedido(bigint, boolean, text);
--   DROP FUNCTION IF EXISTS public.pedir_ponto_esquecido(date, text, bigint, time, text);
--   DROP FUNCTION IF EXISTS public.pedir_abono_atraso(bigint, text);
-- ============================================================
