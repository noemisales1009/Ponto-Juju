-- ============================================================
-- PONTO DE SETEMBRO E OUTUBRO DE 2026 SEM JUSTIFICATIVA (provisório)
-- (rode DEPOIS de adicionar_atraso_ponto.sql e adicionar_ponto_sem_gps.sql)
-- ============================================================
-- PEDIDO DA NOEMI (17/11/2026): a regra nova (ponto só na data de hoje) pegou médicos com
-- plantões de setembro e outubro ainda não lançados, e eles estavam reclamando de ter que
-- pedir "Esqueci de bater" e esperar aprovação.
--
-- A REGRA:
--   * Até 30/11/2026, o médico bate direto o ponto de qualquer dia de 01/09/2026 a 31/10/2026,
--     sem pedido e sem aprovação. O ponto entra sem horário, sem atraso e sem desconto
--     (valor cheio), igual a um "Esqueci de bater" aprovado.
--   * Novembro e todos os outros dias: nada muda (só hoje, a partir do início do turno; dias
--     passados só por "Esqueci de bater").
--   * Depois de 30/11/2026 a liberação acaba sozinha, sem precisar rodar nada.
--
-- O QUE ESTE ARQUIVO FAZ (não apaga nem altera nenhum ponto):
--   Troca a função fn_ponto_desconto_atraso por uma cópia igual à de produção, com um único
--   acréscimo: a exceção das datas acima (marcada com "LIBERAÇÃO SET/OUT").
--
-- Pode ser rodado mais de uma vez. Roda numa transação (se falhar, nada é aplicado).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_ponto_desconto_atraso()
RETURNS TRIGGER AS $$
DECLARE
    c_tolerancia_minutos CONSTANT integer := 60;
    -- LIBERAÇÃO SET/OUT: plantões deste período entram sem pedido até c_livre_prazo
    c_livre_inicio CONSTANT date := DATE '2026-09-01';
    c_livre_fim CONSTANT date := DATE '2026-10-31';
    c_livre_prazo CONSTANT date := DATE '2026-11-30';
    v_hora_inicio integer;
    v_duracao_minutos integer;
    v_inicio_turno timestamp with time zone;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Editar pelo app não muda o horário nem o atraso. Podem corrigir: o SQL Editor e as
        -- funções do banco (ex.: decidir_pedido, ao aprovar uma justificativa de atraso).
        IF current_user IN ('anon', 'authenticated') THEN
            NEW.batido_em := OLD.batido_em;
            NEW.minutos_atraso := OLD.minutos_atraso;
            NEW.desconto_atraso := OLD.desconto_atraso;

            -- Mudar uma presença de data ou turno seria bater em outra data sem passar pela regra
            IF OLD.falta IS DISTINCT FROM 'Sim'
               AND NEW.falta IS DISTINCT FROM 'Sim'
               AND (NEW.data_dia IS DISTINCT FROM OLD.data_dia OR NEW.turno IS DISTINCT FROM OLD.turno)
               AND NOT EXISTS (
                   SELECT 1
                   FROM public.usuarios
                   WHERE usuarios.user_id = auth.uid()
                   AND usuarios.role = 'admin'
               ) THEN
                RAISE EXCEPTION 'Só o admin pode mudar a data ou o turno de um ponto.'
                USING ERRCODE = '42501';
            END IF;
        END IF;

    -- Ponto esquecido aprovado pelo admin (função decidir_pedido): entra sem horário e sem desconto
    ELSIF auth.uid() IS NOT NULL
          AND current_setting('ponto.pedido_aprovado', true) IS DISTINCT FROM 'sim' THEN
        NEW.batido_em := NULL;
        NEW.minutos_atraso := NULL;
        NEW.desconto_atraso := NULL;

        IF NEW.turno ILIKE '%noite%' THEN
            v_hora_inicio := 19;
            v_duracao_minutos := 720;
        ELSIF NEW.turno ILIKE '%manhã%' OR NEW.turno ILIKE '%manha%' THEN
            v_hora_inicio := 7;
            v_duracao_minutos := 360;
        ELSIF NEW.turno ILIKE '%tarde%' THEN
            v_hora_inicio := 13;
            v_duracao_minutos := 360;
        END IF;

        -- LIBERAÇÃO SET/OUT: entra sem horário, sem atraso e sem desconto
        IF NEW.falta IS DISTINCT FROM 'Sim'
           AND NEW.data_dia BETWEEN c_livre_inicio AND c_livre_fim
           AND (now() AT TIME ZONE 'America/Sao_Paulo')::date <= c_livre_prazo THEN
            NULL;

        -- Falta não tem horário nem atraso
        ELSIF NEW.falta IS DISTINCT FROM 'Sim' AND v_hora_inicio IS NOT NULL THEN
            v_inicio_turno := (NEW.data_dia + make_time(v_hora_inicio, 0, 0)) AT TIME ZONE 'America/Sao_Paulo';

            IF NEW.data_dia IS DISTINCT FROM (now() AT TIME ZONE 'America/Sao_Paulo')::date
               OR now() < v_inicio_turno THEN
                RAISE EXCEPTION 'O ponto só pode ser batido na data de hoje, a partir do início do turno.'
                USING ERRCODE = '42501';
            END IF;

            NEW.batido_em := now();

            -- O atraso só começa a contar depois da tolerância (na Manhã, depois das 08:00)
            NEW.minutos_atraso := GREATEST(
                floor(extract(epoch FROM now() - v_inicio_turno) / 60)::integer - c_tolerancia_minutos,
                0
            );

            NEW.desconto_atraso := round(
                COALESCE(NEW.valor_plantao, 0) * LEAST(NEW.minutos_atraso, v_duracao_minutos) / v_duracao_minutos,
                2
            );
        END IF;
    END IF;

    -- valor_plantao acabou de ser recalculado cheio: o desconto entra em todo INSERT/UPDATE.
    -- Falta fica com o valor cheio: v_distribuicao_faltas divide esse valor entre os presentes.
    IF NEW.falta IS DISTINCT FROM 'Sim' AND COALESCE(NEW.desconto_atraso, 0) > 0 THEN
        NEW.valor_plantao := GREATEST(NEW.valor_plantao - NEW.desconto_atraso, 0);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Conferência: tem que aparecer a frase, e "funcao_sem_gps" tem que estar preenchida
-- (é por ela que o app grava esses pontos). Se vier vazia, me avise antes de publicar o app.
SELECT 'Ponto de set/out liberado sem justificativa ate 30/11' AS resultado,
       (SELECT count(*) FROM public.ponto_juju2) AS pontos,
       to_regprocedure('public.registrar_presenca_sem_gps(date, text, bigint, text, text)') AS funcao_sem_gps;

-- ============================================================
-- VER OS PONTOS DE SET/OUT LANÇADOS DEPOIS DESTA LIBERAÇÃO (troque a data se rodar outro dia):
--   SELECT u.nome, p.data_dia, p.turno, p.valor_plantao,
--          p.created_at AT TIME ZONE 'America/Sao_Paulo' AS lancado_em
--   FROM public.ponto_juju2 p
--   JOIN public.usuarios u ON u.user_id = p.user_id
--   WHERE p.data_dia BETWEEN '2026-09-01' AND '2026-10-31'
--     AND p.created_at >= '2026-11-17'
--   ORDER BY p.created_at DESC;
--
-- PARA DESLIGAR ANTES DE 30/11: rode de novo o item 2 de sql/adicionar_atraso_ponto.sql
-- (a função sem a exceção). O app passa a mostrar a mensagem "só na data de hoje".
-- ============================================================
