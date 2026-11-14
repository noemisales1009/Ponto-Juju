-- ============================================================
-- TROCA DE PLANTÃO: CONFIRMAR NA HORA QUE RECEBE O AVISO
-- ============================================================
-- PEDIDO DA NOEMI (14/11/2026): quem vai fazer o plantão (substituto) tem que confirmar a
-- passagem assim que recebe o aviso, sem esperar o dia do plantão. O app mostra o aviso no
-- meio da tela toda vez que ele abre, até confirmar.
--
-- ANTES: só dava para confirmar depois de bater o ponto.
-- AGORA:
--   * João confirma a qualquer momento. Se o ponto já foi batido, o valor passa para Pedro
--     na hora (igual a antes). Se ainda não foi, a troca fica confirmada esperando o ponto.
--   * Quando João bater o ponto daquele dia, turno e setor, o valor vai sozinho para Pedro.
--   * Pedro (ou o admin) pode cancelar uma troca confirmada enquanto o ponto não foi batido.
--     Depois do ponto batido, só pelo SQL Editor (ver o fim de adicionar_troca_ponto.sql).
--
-- O QUE ESTE ARQUIVO FAZ (não apaga nem altera dados):
--   1. Troca as funções confirmar_troca e cancelar_troca.
--   2. Cria dois gatilhos em ponto_juju2, só para INSERT, que só agem quando existe uma
--      troca confirmada esperando aquele ponto. Sem troca, o ponto entra igual a hoje.
--
-- ORDEM: rodar DEPOIS de adicionar_troca_ponto.sql. Pode ser rodado mais de uma vez.
-- Roda numa transação (se falhar, nada é aplicado).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) João: confirmar a troca (antes ou depois de bater o ponto)
-- ------------------------------------------------------------
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

    -- Ponto já batido: o valor passa para quem pagou agora.
    -- Ponto ainda não batido: o gatilho do item 3 faz isso quando o ponto entrar.
    IF v_ponto_id IS NOT NULL THEN
        -- Os triggers recalculam o valor; horário e desconto por atraso ficam como estão
        UPDATE public.ponto_juju2 SET recebedor_id = v_troca.cedente_id WHERE id = v_ponto_id;
    END IF;

    UPDATE public.ponto_troca
    SET status = 'confirmada', ponto_id = v_ponto_id, confirmado_em = now()
    WHERE id = p_troca_id
    RETURNING * INTO v_troca;

    RETURN v_troca;
END;
$$;

-- ------------------------------------------------------------
-- 2) Pedro (ou o admin): cancelar enquanto o ponto não foi batido
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

    IF v_troca.status = 'cancelada' THEN
        RAISE EXCEPTION 'Esta troca já foi cancelada.' USING ERRCODE = 'PT400';
    END IF;

    IF v_troca.status = 'confirmada' AND v_troca.ponto_id IS NOT NULL THEN
        RAISE EXCEPTION 'O ponto deste plantão já foi batido. Fale com a administração para desfazer a troca.' USING ERRCODE = 'PT400';
    END IF;

    UPDATE public.ponto_troca SET status = 'cancelada' WHERE id = p_troca_id
    RETURNING * INTO v_troca;

    RETURN v_troca;
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_troca(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirmar_troca(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_troca(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_troca(bigint) TO authenticated;

-- ------------------------------------------------------------
-- 3) Ponto novo de uma troca já confirmada: o valor vai para quem pagou
-- ------------------------------------------------------------
-- SECURITY DEFINER: quem insere o ponto pode ser o admin (pedido de ponto esquecido aprovado),
-- que não é parte da troca. Falta nunca entra: continua contando para quem faltou.
CREATE OR REPLACE FUNCTION public.fn_ponto_troca_aplicar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.recebedor_id IS NULL AND NEW.user_id IS NOT NULL AND NEW.falta IS DISTINCT FROM 'Sim' THEN
        SELECT t.cedente_id INTO NEW.recebedor_id
        FROM public.ponto_troca t
        WHERE t.status = 'confirmada'
          AND t.ponto_id IS NULL
          AND t.substituto_id = NEW.user_id
          AND t.data_dia = NEW.data_dia
          AND t.turno = public.fn_turno_curto(NEW.turno)
          AND t.setor_id = NEW.setor_id
        ORDER BY t.id
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$;

-- Depois de gravado, o ponto fica ligado à troca (é o que marca "ponto já batido")
CREATE OR REPLACE FUNCTION public.fn_ponto_troca_ligar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.recebedor_id IS NOT NULL AND NEW.falta IS DISTINCT FROM 'Sim' THEN
        UPDATE public.ponto_troca t
        SET ponto_id = NEW.id
        WHERE t.id = (
            SELECT t2.id
            FROM public.ponto_troca t2
            WHERE t2.status = 'confirmada'
              AND t2.ponto_id IS NULL
              AND t2.substituto_id = NEW.user_id
              AND t2.cedente_id = NEW.recebedor_id
              AND t2.data_dia = NEW.data_dia
              AND t2.turno = public.fn_turno_curto(NEW.turno)
              AND t2.setor_id = NEW.setor_id
            ORDER BY t2.id
            LIMIT 1
        );
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ponto_troca_aplicar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ponto_troca_ligar() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ponto_troca_aplicar ON public.ponto_juju2;
CREATE TRIGGER trg_ponto_troca_aplicar
BEFORE INSERT
ON public.ponto_juju2
FOR EACH ROW
EXECUTE FUNCTION public.fn_ponto_troca_aplicar();

DROP TRIGGER IF EXISTS trg_ponto_troca_ligar ON public.ponto_juju2;
CREATE TRIGGER trg_ponto_troca_ligar
AFTER INSERT
ON public.ponto_juju2
FOR EACH ROW
EXECUTE FUNCTION public.fn_ponto_troca_ligar();

COMMIT;

-- Conferência: tem que aparecer a frase e os gatilhos de ponto_juju2 (os 4 de antes + 2 novos)
SELECT 'Troca: confirmar antes do ponto liberado' AS resultado,
       (SELECT count(*) FROM public.ponto_juju2) AS pontos,
       (SELECT string_agg(tgname, ', ' ORDER BY tgname)
          FROM pg_trigger
         WHERE tgrelid = 'public.ponto_juju2'::regclass AND NOT tgisinternal) AS gatilhos;

-- ============================================================
-- PARA DESFAZER (volta a confirmar só depois do ponto):
--   DROP TRIGGER IF EXISTS trg_ponto_troca_aplicar ON public.ponto_juju2;
--   DROP TRIGGER IF EXISTS trg_ponto_troca_ligar ON public.ponto_juju2;
--   DROP FUNCTION IF EXISTS public.fn_ponto_troca_aplicar();
--   DROP FUNCTION IF EXISTS public.fn_ponto_troca_ligar();
--   e rodar de novo os itens 3b e 3c de sql/adicionar_troca_ponto.sql.
-- ============================================================
