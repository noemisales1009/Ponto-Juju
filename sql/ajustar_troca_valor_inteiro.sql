-- ============================================================
-- TROCA DE PLANTÃO: VALOR INTEIRO PARA QUEM PASSOU (SEM DESCONTO POR ATRASO)
-- ============================================================
-- PEDIDO DA NOEMI (17/11/2026): na troca, o valor do plantão vai inteiro para quem passou o
-- plantão e já pagou (Pedro). O atraso de quem veio (João) não desconta nada.
--
-- O QUE NÃO MUDA: a confirmação. João continua tendo que confirmar a troca no app (antes ou
-- depois de bater o ponto). Sem a confirmação de João, o valor continua sendo de João.
--
-- ANTES: o desconto por atraso de João saía do valor que Pedro recebia.
-- AGORA: ponto de troca confirmada não tem desconto. O horário e os minutos de atraso
--        continuam gravados no ponto; só o desconto fica zerado.
--
-- O QUE ESTE ARQUIVO FAZ (não apaga nem altera dados; trocas e pontos antigos ficam iguais):
--   1. Troca a função do gatilho trg_ponto_troca_aplicar (ponto batido DEPOIS da confirmação).
--   2. Troca a função confirmar_troca (confirmação DEPOIS do ponto batido).
--
-- ORDEM: rodar DEPOIS de ajustar_troca_confirmar_antes.sql. Pode ser rodado mais de uma vez.
-- Roda numa transação (se falhar, nada é aplicado).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Ponto novo de uma troca já confirmada: o valor vai inteiro para quem pagou
-- ------------------------------------------------------------
-- Roda depois de trg_ponto_desconto_atraso (ordem alfabética dos gatilhos), que já tirou o
-- desconto de valor_plantao: aqui o desconto é devolvido e zerado. Zerado, ele não volta em
-- edições futuras do ponto.
CREATE OR REPLACE FUNCTION public.fn_ponto_troca_aplicar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cedente_id uuid;
BEGIN
    IF NEW.recebedor_id IS NULL AND NEW.user_id IS NOT NULL AND NEW.falta IS DISTINCT FROM 'Sim' THEN
        SELECT t.cedente_id INTO v_cedente_id
        FROM public.ponto_troca t
        WHERE t.status = 'confirmada'
          AND t.ponto_id IS NULL
          AND t.substituto_id = NEW.user_id
          AND t.data_dia = NEW.data_dia
          AND t.turno = public.fn_turno_curto(NEW.turno)
          AND t.setor_id = NEW.setor_id
        ORDER BY t.id
        LIMIT 1;

        IF v_cedente_id IS NOT NULL THEN
            NEW.recebedor_id := v_cedente_id;

            IF COALESCE(NEW.desconto_atraso, 0) > 0 THEN
                NEW.valor_plantao := NEW.valor_plantao + NEW.desconto_atraso;
                NEW.desconto_atraso := 0;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ponto_troca_aplicar() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 2) João: confirmar a troca (antes ou depois de bater o ponto)
-- ------------------------------------------------------------
-- Igual a antes, mais uma coisa: se o ponto já foi batido, o desconto por atraso é zerado.
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

    -- Ponto já batido: o valor passa inteiro para quem pagou agora (os gatilhos recalculam o
    -- valor cheio; com o desconto zerado, nada é tirado).
    -- Ponto ainda não batido: o gatilho do item 1 faz isso quando o ponto entrar.
    IF v_ponto_id IS NOT NULL THEN
        UPDATE public.ponto_juju2
        SET recebedor_id = v_troca.cedente_id, desconto_atraso = 0
        WHERE id = v_ponto_id;
    END IF;

    UPDATE public.ponto_troca
    SET status = 'confirmada', ponto_id = v_ponto_id, confirmado_em = now()
    WHERE id = p_troca_id
    RETURNING * INTO v_troca;

    RETURN v_troca;
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_troca(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_troca(bigint) TO authenticated;

COMMIT;

-- Conferência: tem que aparecer a frase. "trocas_com_desconto" são pontos de troca antigos que
-- já tinham desconto por atraso: este arquivo NÃO mexe neles (ver abaixo como tirar).
SELECT 'Troca: valor inteiro, sem desconto por atraso' AS resultado,
       (SELECT count(*) FROM public.ponto_juju2) AS pontos,
       (SELECT count(*) FROM public.ponto_troca WHERE status <> 'cancelada') AS trocas,
       (SELECT count(*) FROM public.ponto_juju2
         WHERE recebedor_id IS NOT NULL AND COALESCE(desconto_atraso, 0) > 0) AS trocas_com_desconto;

-- ============================================================
-- TIRAR O DESCONTO DE TROCAS ANTIGAS (só se "trocas_com_desconto" for maior que zero e a Noemi
-- quiser). O valor do plantão volta ao cheio:
--   UPDATE public.ponto_juju2 SET desconto_atraso = 0
--    WHERE recebedor_id IS NOT NULL AND COALESCE(desconto_atraso, 0) > 0;
--
-- PARA DESFAZER (o atraso volta a descontar de quem recebe):
--   rodar de novo sql/ajustar_troca_confirmar_antes.sql.
-- ============================================================
