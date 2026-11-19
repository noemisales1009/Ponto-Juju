-- ============================================================
-- JUSTIFICATIVA DE ATRASO: SEM PRAZO ATÉ 30/11/2026
-- (rode DEPOIS de adicionar_pedidos_ponto.sql)
-- ============================================================
-- A REGRA (definida pela Noemi em 19/11/2026):
--   * Em novembro de 2026 o médico pode justificar qualquer atraso, sem o prazo de 2 dias
--     (os médicos ainda estão se acostumando com a regra nova).
--   * A partir de 01/12/2026 o prazo volta sozinho para 2 dias depois do plantão. Não é preciso
--     rodar nada.
--   * O resto não muda: o admin aprova ou recusa cada justificativa, e cada atraso só pode ser
--     justificado uma vez.
--
-- O QUE ESTE ARQUIVO FAZ: substitui só a função pedir_abono_atraso (mesma função de
-- sql/adicionar_pedidos_ponto.sql, com o prazo de transição). Não toca em tabelas nem em dados.
-- Para mudar a data, altere c_transicao_fim aqui e TRANSICAO_FIM em src/services/pedidoService.ts.
-- Pode ser rodado mais de uma vez. Roda numa transação (se falhar, nada é aplicado).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.pedir_abono_atraso(p_ponto_id bigint, p_motivo text)
RETURNS public.ponto_pedido
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_transicao_fim CONSTANT date := DATE '2026-11-30';
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

    -- Prazo normal: 2 dias. Até o fim da transição, não tem prazo.
    IF v_hoje > c_transicao_fim AND v_ponto.data_dia < v_hoje - 2 THEN
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

REVOKE ALL ON FUNCTION public.pedir_abono_atraso(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_abono_atraso(bigint, text) TO authenticated;

COMMIT;

-- Conferência: tem que aparecer a frase. "atrasos_sem_justificativa" são os pontos com desconto
-- que ainda não têm pedido: são os que os médicos passam a poder justificar.
SELECT 'Justificativa de atraso: sem prazo até 30/11' AS resultado,
       (SELECT count(*) FROM public.ponto_juju2 p
         WHERE p.falta IS DISTINCT FROM 'Sim' AND COALESCE(p.desconto_atraso, 0) > 0
           AND NOT EXISTS (SELECT 1 FROM public.ponto_pedido d
                            WHERE d.tipo = 'atraso' AND d.ponto_id = p.id)) AS atrasos_sem_justificativa;

-- ============================================================
-- PARA DESFAZER (o prazo volta a ser de 2 dias já): rode de novo a parte "2a" de
-- sql/adicionar_pedidos_ponto.sql.
-- ============================================================
