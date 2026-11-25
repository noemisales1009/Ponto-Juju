-- ============================================================
-- PEDIDOS: UM SÓ POR PLANTÃO (não pode "ponto esquecido" + "justificativa" no mesmo turno)
-- (rode DEPOIS de adicionar_pedidos_ponto.sql e ajustar_prazo_ponto_esquecido.sql)
-- ============================================================
-- O PROBLEMA (visto pela Noemi em 25/11/2026): o mesmo plantão (20/11 Manhã) apareceu com dois
-- pedidos do mesmo médico: um "ponto esquecido" aguardando e uma justificativa de atraso aprovada.
-- Como aconteceu: o médico pediu o ponto esquecido, DEPOIS bateu o ponto (atrasado) e justificou
-- o atraso. O pedido de ponto esquecido ficou sobrando, aguardando aprovação.
--
-- A REGRA AGORA:
--   * Bateu o ponto de um plantão que tinha pedido de "ponto esquecido" aguardando: o pedido é
--     encerrado sozinho (fica como recusado, com a observação "Encerrado automaticamente...").
--   * Quem já justificou um atraso num plantão não pode pedir "ponto esquecido" do mesmo plantão
--     (fecha o caminho de apagar o ponto atrasado e pedir de novo como esquecido).
--   * Continua valendo: uma justificativa por atraso, e um pedido de ponto esquecido aguardando
--     por plantão.
--
-- O QUE ESTE ARQUIVO FAZ:
--   1. Cria um gatilho em ponto_juju2, só para INSERT de presença. Ele NÃO muda o ponto: só
--      encerra o pedido de ponto esquecido que estiver aguardando para aquele plantão.
--   2. Troca a função pedir_ponto_esquecido (a mesma de ajustar_prazo_ponto_esquecido.sql, com
--      uma checagem a mais).
--   3. ALTERA DADOS: encerra os pedidos de "ponto esquecido" que hoje estão aguardando para
--      plantões que já têm ponto batido (o de 20/11 Manhã e outros iguais, se houver).
--      Não mexe em nenhum ponto nem em nenhum valor.
--
-- Pode ser rodado mais de uma vez. Roda numa transação (se falhar, nada é aplicado).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Ponto batido: encerra o pedido de "ponto esquecido" que estava aguardando
-- ------------------------------------------------------------
-- SECURITY DEFINER: o app não tem permissão de escrita em ponto_pedido.
-- Não age quando o ponto está sendo criado pela aprovação do próprio pedido (decidir_pedido
-- liga 'ponto.pedido_aprovado' só durante essa gravação).
CREATE OR REPLACE FUNCTION public.fn_ponto_pedido_encerrar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.user_id IS NOT NULL
       AND NEW.falta IS DISTINCT FROM 'Sim'
       AND current_setting('ponto.pedido_aprovado', true) IS DISTINCT FROM 'sim' THEN
        UPDATE public.ponto_pedido d
        SET status = 'recusado',
            decidido_em = now(),
            observacao = 'Encerrado automaticamente: o ponto deste plantão foi batido depois do pedido.'
        WHERE d.tipo = 'esquecido'
          AND d.status = 'pendente'
          AND d.user_id = NEW.user_id
          AND d.data_dia = NEW.data_dia
          AND d.turno = public.fn_turno_curto(NEW.turno);
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ponto_pedido_encerrar() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ponto_pedido_encerrar ON public.ponto_juju2;
CREATE TRIGGER trg_ponto_pedido_encerrar
AFTER INSERT
ON public.ponto_juju2
FOR EACH ROW
EXECUTE FUNCTION public.fn_ponto_pedido_encerrar();

-- ------------------------------------------------------------
-- 2) Pedir ponto esquecido: recusa se o plantão já teve justificativa de atraso
-- ------------------------------------------------------------
-- Igual a ajustar_prazo_ponto_esquecido.sql (mesmo prazo de transição), com a checagem nova.
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

    -- NOVO: um pedido por plantão. Vale para justificativa aguardando, aprovada ou recusada.
    IF EXISTS (
        SELECT 1 FROM public.ponto_pedido
        WHERE tipo = 'atraso'
          AND user_id = v_user_id AND data_dia = p_data_dia AND turno = p_turno
    ) THEN
        RAISE EXCEPTION 'Você já justificou um atraso neste plantão. Fale com a administração.' USING ERRCODE = 'PT400';
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

-- ------------------------------------------------------------
-- 3) Limpeza: pedidos de "ponto esquecido" aguardando para plantões que já têm ponto
-- ------------------------------------------------------------
UPDATE public.ponto_pedido d
SET status = 'recusado',
    decidido_em = now(),
    observacao = 'Encerrado automaticamente: o ponto deste plantão foi batido depois do pedido.'
WHERE d.tipo = 'esquecido'
  AND d.status = 'pendente'
  AND EXISTS (
      SELECT 1 FROM public.ponto_juju2 p
      WHERE p.user_id = d.user_id
        AND p.data_dia = d.data_dia
        AND public.fn_turno_curto(p.turno) = d.turno
        AND p.falta IS DISTINCT FROM 'Sim'
  );

COMMIT;

-- Conferência: tem que aparecer a frase.
--   pedidos_encerrados  = pedidos de ponto esquecido encerrados sozinhos (o de 20/11 Manhã entra aqui)
--   ainda_duplicados    = tem que ser 0: pedido de ponto esquecido aguardando com ponto já batido
SELECT 'Pedidos: um só por plantão' AS resultado,
       (SELECT count(*) FROM public.ponto_juju2) AS pontos,
       (SELECT count(*) FROM public.ponto_pedido
         WHERE observacao LIKE 'Encerrado automaticamente:%') AS pedidos_encerrados,
       (SELECT count(*) FROM public.ponto_pedido d
         WHERE d.tipo = 'esquecido' AND d.status = 'pendente'
           AND EXISTS (SELECT 1 FROM public.ponto_juju2 p
                        WHERE p.user_id = d.user_id AND p.data_dia = d.data_dia
                          AND public.fn_turno_curto(p.turno) = d.turno
                          AND p.falta IS DISTINCT FROM 'Sim')) AS ainda_duplicados;

-- ============================================================
-- VER OS PEDIDOS ENCERRADOS SOZINHOS:
--   SELECT u.nome, d.data_dia, d.turno, d.motivo, d.decidido_em
--   FROM public.ponto_pedido d
--   LEFT JOIN public.usuarios u ON u.user_id = d.user_id
--   WHERE d.observacao LIKE 'Encerrado automaticamente:%'
--   ORDER BY d.decidido_em DESC;
--
-- PARA DESFAZER:
--   DROP TRIGGER IF EXISTS trg_ponto_pedido_encerrar ON public.ponto_juju2;
--   DROP FUNCTION IF EXISTS public.fn_ponto_pedido_encerrar();
--   e rodar de novo sql/ajustar_prazo_ponto_esquecido.sql.
--   (os pedidos já encerrados continuam encerrados)
-- ============================================================
