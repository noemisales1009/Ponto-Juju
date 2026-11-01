-- ============================================================
-- HORÁRIO EXATO DO PONTO, DATA TRAVADA E DESCONTO POR ATRASO
-- ============================================================
-- A REGRA (definida pela Noemi):
--   * O médico só bate o ponto na data de hoje, e o horário exato do clique fica gravado.
--   * O ponto abre no início do turno. Antes disso, não é aceito.
--   * O médico tem 1 hora de tolerância a partir do início do turno. Até lá não existe atraso.
--   * Depois disso, o atraso começa a contar e é descontado do valor do plantão.
--     Exemplo: turno às 07:00, ponto às 08:30 -> 30 minutos de atraso, desconta 30 minutos.
--
-- COMO É CALCULADO:
--   * Início do turno: Manhã 07:00, Tarde 13:00, Noite 19:00.
--   * Valor do minuto = valor do plantão / duração do turno (Manhã e Tarde 6h, Noite 12h).
--   * O desconto nunca passa do valor do plantão.
--   * A hora é a do servidor, no momento em que o ponto é criado. Mudar a data ou o relógio do
--     celular não adianta.
--   * O desconto sai de valor_plantao. Por isso Financeiro e Ganhos já mostram o valor certo.
--
-- O QUE ESTE ARQUIVO FAZ (não apaga nem altera dados; pontos antigos não têm horário nem desconto):
--   1. Cria as colunas batido_em, minutos_atraso e desconto_atraso em ponto_juju2.
--   2. Recusa o ponto de presença fora da data de hoje ou antes do início do turno.
--   3. Grava o horário exato e calcula o desconto em todo ponto novo. Falta não tem atraso.
--   4. Recusa médico comum mudar a data ou o turno de uma presença. O admin pode.
--
-- Não precisa de permissão por coluna: quem grava é o trigger, nunca o app.
-- Pode ser rodado mais de uma vez. Roda numa transação (se falhar, nada é aplicado).
-- ============================================================

BEGIN;

-- 1) Colunas
ALTER TABLE public.ponto_juju2
  ADD COLUMN IF NOT EXISTS batido_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS minutos_atraso integer,
  ADD COLUMN IF NOT EXISTS desconto_atraso numeric;

-- 2) Função: validar a data, gravar o horário e aplicar o desconto
-- Precisa rodar DEPOIS de fn_ponto_total_automatizado, que normaliza o turno e recalcula
-- valor_plantao em todo INSERT/UPDATE. Triggers BEFORE rodam em ordem alfabética:
-- trg_ponto_completo_juju vem antes.
-- Ao mudar os horários, mudar também SHIFT_START_HOUR em constants.ts
-- ERRCODE 42501: é o que o app mostra como "sem permissão" (utils/errors.ts)
CREATE OR REPLACE FUNCTION public.fn_ponto_desconto_atraso()
RETURNS TRIGGER AS $$
DECLARE
    c_tolerancia_minutos CONSTANT integer := 60;
    v_hora_inicio integer;
    v_duracao_minutos integer;
    v_inicio_turno timestamp with time zone;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Editar não muda o horário nem o atraso. Só o SQL Editor (sem usuário logado) pode corrigir.
        IF auth.uid() IS NOT NULL THEN
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

    ELSIF auth.uid() IS NOT NULL THEN
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

        -- Falta não tem horário nem atraso
        IF NEW.falta IS DISTINCT FROM 'Sim' AND v_hora_inicio IS NOT NULL THEN
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

-- 3) Trigger: executar antes de INSERT ou UPDATE
DROP TRIGGER IF EXISTS trg_ponto_desconto_atraso ON public.ponto_juju2;

CREATE TRIGGER trg_ponto_desconto_atraso
BEFORE INSERT OR UPDATE
ON public.ponto_juju2
FOR EACH ROW
EXECUTE FUNCTION public.fn_ponto_desconto_atraso();

COMMIT;

-- ============================================================
-- VER OS HORÁRIOS E QUEM TEVE DESCONTO:
--   SELECT id, data_dia, turno, user_id,
--          batido_em AT TIME ZONE 'America/Sao_Paulo' AS horario,
--          minutos_atraso, desconto_atraso, valor_plantao
--   FROM public.ponto_juju2
--   WHERE batido_em IS NOT NULL
--   ORDER BY batido_em DESC;
--
-- RETIRAR O DESCONTO DE UM PONTO (ex.: atraso justificado). Rode no SQL Editor, trocando o 123
-- pelo id do ponto. O valor do plantão volta ao normal:
--   UPDATE public.ponto_juju2 SET minutos_atraso = 0, desconto_atraso = 0 WHERE id = 123;
--
-- PARA DESFAZER (a regra sai; os valores já descontados voltam ao cheio só se o ponto for editado):
--   DROP TRIGGER IF EXISTS trg_ponto_desconto_atraso ON public.ponto_juju2;
--   DROP FUNCTION IF EXISTS public.fn_ponto_desconto_atraso();
-- ============================================================
