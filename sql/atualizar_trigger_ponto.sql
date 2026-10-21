-- EQUIVALE À VERSÃO EM PRODUÇÃO (conferido contra o banco). Referência: sql/criar_funcao_trigger_ponto.sql

-- ============================================
-- APAGAR FUNÇÃO E TRIGGER ANTERIOR
-- ============================================

-- Apagar o trigger primeiro
DROP TRIGGER IF EXISTS trg_ponto_completo_juju ON public.ponto_juju2;

-- Apagar a função anterior
DROP FUNCTION IF EXISTS fn_ponto_total_automatizado();


-- ============================================
-- CRIAR NOVA FUNÇÃO CORRIGIDA
-- ============================================

CREATE OR REPLACE FUNCTION fn_ponto_total_automatizado()
RETURNS TRIGGER AS $$
DECLARE
    v_dia_semana TEXT;
    v_eh_noturno BOOLEAN;
    v_dia_num INT;
    v_periodo_id BIGINT;
    v_valor_periodo NUMERIC;
    v_turno_normalizado TEXT;
    v_count_turno_dia INT;
BEGIN
    -- Data base
    NEW.data_dia := DATE(NEW.data);

    -- ✅ Detecta noturno (CORRETO)
    v_eh_noturno := (
        NEW.turno ILIKE '%noite%' OR
        NEW.turno ILIKE '%19h - 07h%' OR
        NEW.turno ILIKE '%19:00 - 07:00%' OR
        NEW.turno ILIKE '%21h%'
    );

    -- Dia da semana (prioridade texto)
    v_dia_semana := CASE
        WHEN NEW.turno ILIKE '%segunda%' THEN 'Segunda'
        WHEN NEW.turno ILIKE '%terça%' OR NEW.turno ILIKE '%terca%' THEN 'Terça'
        WHEN NEW.turno ILIKE '%quarta%' THEN 'Quarta'
        WHEN NEW.turno ILIKE '%quinta%' THEN 'Quinta'
        WHEN NEW.turno ILIKE '%sexta%' THEN 'Sexta'
        WHEN NEW.turno ILIKE '%sábado%' OR NEW.turno ILIKE '%sabado%' THEN 'Sábado'
        WHEN NEW.turno ILIKE '%domingo%' THEN 'Domingo'
        ELSE NULL
    END;

    -- Fallback pela data
    IF v_dia_semana IS NULL THEN
        v_dia_num := EXTRACT(ISODOW FROM NEW.data_dia);
        v_dia_semana := CASE v_dia_num
            WHEN 1 THEN 'Segunda'
            WHEN 2 THEN 'Terça'
            WHEN 3 THEN 'Quarta'
            WHEN 4 THEN 'Quinta'
            WHEN 5 THEN 'Sexta'
            WHEN 6 THEN 'Sábado'
            WHEN 7 THEN 'Domingo'
        END;
    END IF;

    NEW.dia_semana_calculado := v_dia_semana;

    -- Número do dia
    v_dia_num := CASE v_dia_semana
        WHEN 'Segunda' THEN 1
        WHEN 'Terça' THEN 2
        WHEN 'Quarta' THEN 3
        WHEN 'Quinta' THEN 4
        WHEN 'Sexta' THEN 5
        WHEN 'Sábado' THEN 6
        WHEN 'Domingo' THEN 7
    END;

    -- 🔁 NORMALIZA TURNO
    IF v_eh_noturno THEN
        IF v_dia_semana = 'Sexta' THEN
            v_turno_normalizado := 'Sexta noite (19h - 07h)';
        ELSIF v_dia_semana IN ('Sábado','Domingo') THEN
            v_turno_normalizado := 'Noite Final de Semana (19h - 07h)';
        ELSE
            v_turno_normalizado := 'Noite Semana (19h - 07h)';
        END IF;

    ELSIF NEW.turno ILIKE '%manhã%' OR NEW.turno ILIKE '%manha%' OR NEW.turno ILIKE '%07h%' THEN
        IF v_dia_semana IN ('Sábado','Domingo') THEN
            v_turno_normalizado := 'Manhã Final de Semana (07h - 13h)';
        ELSE
            v_turno_normalizado := 'Manhã Semana (07h - 13h)';
        END IF;

    ELSIF NEW.turno ILIKE '%tarde%' OR NEW.turno ILIKE '%13h%' OR NEW.turno ILIKE '%13:00%' THEN
        IF v_dia_semana IN ('Sábado','Domingo') THEN
            v_turno_normalizado := 'Tarde Final de Semana (13h - 19h)';
        ELSE
            v_turno_normalizado := 'Tarde Semana (13h - 19h)';
        END IF;

    ELSE
        v_turno_normalizado := NEW.turno;
    END IF;

    NEW.turno := v_turno_normalizado;

    -- ⚠️ VALIDAÇÃO: Verificar se médico já bateu ponto no MESMO TURNO HOJE
    -- ✅ PERMITE múltiplos turnos no mesmo dia (Manhã + Tarde + Noite)
    -- ❌ MAS bloqueia duplicata do MESMO turno
    SELECT COUNT(*)
    INTO v_count_turno_dia
    FROM public.ponto_juju2
    WHERE user_id = NEW.user_id
      AND data_dia = DATE(NEW.data)
      AND turno = v_turno_normalizado
      AND id != COALESCE(NEW.id, -1);  -- Exclude o próprio registro em UPDATE

    IF v_count_turno_dia > 0 THEN
        RAISE EXCEPTION 'Médico já bateu ponto no turno % em %! Proibido duplicar o mesmo turno.', 
            v_turno_normalizado, DATE(NEW.data)
        USING ERRCODE = 'unique_violation';
    END IF;

    -- 🔍 BUSCA ROBUSTA EM periodo_juju
    SELECT p.id, p.valor_por_plantao
    INTO v_periodo_id, v_valor_periodo
    FROM periodo_juju p
    WHERE p.setor_id = NEW.setor_id
      AND REGEXP_REPLACE(UPPER(p.periodo), '[^A-Z0-9]', '', 'g')
          = REGEXP_REPLACE(UPPER(NEW.turno), '[^A-Z0-9]', '', 'g')
    LIMIT 1;

    IF v_periodo_id IS NOT NULL THEN
        NEW.periodo_id := v_periodo_id;
        NEW.valor_plantao := v_valor_periodo;
        RETURN NEW;
    END IF;

    -- ⚠️ FALLBACK (caso não encontre período)
    IF NEW.setor_id = 3 THEN
        IF v_eh_noturno THEN
            NEW.valor_plantao := CASE 
                WHEN v_dia_num = 5 THEN 2000
                WHEN v_dia_num IN (6,7) THEN 2400
                ELSE 1900
            END;
        ELSE
            NEW.valor_plantao := CASE 
                WHEN v_dia_num IN (6,7) THEN 950
                ELSE 875
            END;
        END IF;
    END IF;

    IF NEW.setor_id = 2 THEN
        IF v_eh_noturno THEN
            NEW.valor_plantao := CASE 
                WHEN v_dia_num IN (5,6,7) THEN 1900
                ELSE 1800
            END;
        ELSE
            NEW.valor_plantao := CASE 
                WHEN v_dia_num IN (6,7) THEN 925
                ELSE 825
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- CRIAR NOVO TRIGGER
-- ============================================

CREATE TRIGGER trg_ponto_completo_juju 
BEFORE INSERT OR UPDATE 
ON ponto_juju2 
FOR EACH ROW
EXECUTE FUNCTION fn_ponto_total_automatizado();
