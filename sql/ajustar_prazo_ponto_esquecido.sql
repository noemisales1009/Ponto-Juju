-- ============================================================
-- PONTO ESQUECIDO: PRAZO DE TRANSIÇÃO (setembro, outubro e novembro de 2026)
-- (rode DEPOIS de adicionar_pedidos_ponto.sql)
-- ============================================================
-- A REGRA (definida pela Noemi em 13/11/2026):
--   * O prazo normal para pedir um ponto esquecido continua sendo de 2 dias depois do plantão.
--   * Como a regra nova acabou de entrar, até 30/11/2026 o médico também pode pedir plantões
--     de 01/09/2026 em diante que ficaram sem lançar. O admin aprova ou recusa cada um.
--   * A partir de 01/12/2026 o prazo volta sozinho para 2 dias. Não é preciso rodar nada.
--
-- O QUE ESTE ARQUIVO FAZ: substitui só a função pedir_ponto_esquecido (mesma função de
-- sql/adicionar_pedidos_ponto.sql, com o prazo de transição). Não toca em tabelas nem em dados.
-- Para mudar as datas, altere c_transicao_inicio / c_transicao_fim aqui e
-- TRANSICAO_INICIO / TRANSICAO_FIM em src/services/pedidoService.ts.
-- Pode ser rodado mais de uma vez.
-- ============================================================

BEGIN;

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
    c_transicao_inicio CONSTANT date := DATE '2026-09-01';
    c_transicao_fim CONSTANT date := DATE '2026-11-30';
    v_user_id uuid := auth.uid();
    v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_primeiro_dia date;
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

    -- Prazo normal: 2 dias. Durante a transição, vale desde o início dela.
    v_primeiro_dia := v_hoje - 2;
    IF v_hoje <= c_transicao_fim THEN
        v_primeiro_dia := LEAST(v_primeiro_dia, c_transicao_inicio);
    END IF;

    IF p_data_dia > v_hoje OR p_data_dia < v_primeiro_dia THEN
        RAISE EXCEPTION 'O pedido só pode ser feito para plantões de % até hoje.', to_char(v_primeiro_dia, 'DD/MM/YYYY')
        USING ERRCODE = 'PT400';
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

REVOKE ALL ON FUNCTION public.pedir_ponto_esquecido(date, text, bigint, time, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_ponto_esquecido(date, text, bigint, time, text) TO authenticated;

COMMIT;

-- ============================================================
-- PARA DESFAZER (o prazo volta a ser só de 2 dias): rode de novo a parte "2b" de
-- sql/adicionar_pedidos_ponto.sql.
-- ============================================================
