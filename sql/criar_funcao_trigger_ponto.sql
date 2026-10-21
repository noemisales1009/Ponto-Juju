-- ============================================================
-- FUNÇÃO DO TRIGGER: public.fn_ponto_total_automatizado()
-- DEFINIÇÃO REAL, copiada do banco em produção (referência; não precisa executar).
-- Trigger: trg_ponto_completo_juju (BEFORE INSERT OR UPDATE em ponto_juju2).
--
-- O que ela faz a cada INSERT/UPDATE:
--   1. data_dia = DATE(data)  (por isso o app sempre envia "data")
--   2. descobre o dia da semana (pelo texto do turno; se não houver, pela data)
--   3. normaliza o turno: "Manhã Semana (07h - 13h)", "Tarde Final de Semana (13h - 19h)",
--      "Sexta noite (19h - 07h)", "Noite Final de Semana (19h - 07h)", "Noite Semana (19h - 07h)"
--   4. bloqueia o mesmo turno duplicado para o mesmo médico no mesmo dia (erro 23505)
--   5. busca o valor em periodo_juju (setor + nome do período) e grava periodo_id e valor_plantao
--   6. se não achar o período, usa VALORES FIXOS DE RESERVA: só para os setores 2 e 3.
--      Para o setor 1 (e qualquer setor novo) valor_plantao NÃO é calculado.
--
-- Pontos de atenção (confirmados lendo a função real):
--   * NÃO é SECURITY DEFINER: roda com as permissões de quem grava. O usuário precisa conseguir
--     LER periodo_juju e ponto_juju2 (a checagem de duplicidade lê ponto_juju2).
--   * Setor 1: sem período correspondente, o valor_plantao enviado pelo cliente ficaria gravado.
--     (a permissão por coluna de sql/ETAPA_1_seguranca.sql impede isso)
--   * Qualquer UPDATE em um ponto antigo (editar data, turno ou falta) RECALCULA o valor com a
--     tabela de preços ATUAL: se o preço mudou depois, o plantão antigo é reprecificado.
--   * Não existe ramo "Quinta noite": quinta à noite é "Noite Semana (19h - 07h)".
--     O arquivo atualizar_trigger_quinta_noite.sql NÃO está aplicado em produção.
--   * Comentário e código divergem no setor 2: o comentário diz "Quinta-Domingo noite = 1900",
--     mas o código só dá 1900 para sexta, sábado e domingo (quinta = 1800). Só vale se não houver
--     linha correspondente em periodo_juju.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_ponto_total_automatizado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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

    -- Fallback pela data (ISODOW: 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab, 7=Dom)
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

    -- Número do dia (para cálculos)
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
    -- Setor 3 (UTI Ped)
    IF NEW.setor_id = 3 THEN
        IF v_eh_noturno THEN
            NEW.valor_plantao := CASE
                WHEN v_dia_num = 5 THEN 2000  -- Sexta noite
                WHEN v_dia_num IN (6,7) THEN 2400  -- Sábado-Domingo noite
                ELSE 1900  -- Segunda a Quinta noite
            END;
        ELSE
            NEW.valor_plantao := CASE
                WHEN v_dia_num IN (6,7) THEN 950  -- Fim de semana (diurno)
                ELSE 875  -- Semana (diurno)
            END;
        END IF;
    END IF;

    -- Setor 2 (Semi 2)
    IF NEW.setor_id = 2 THEN
        IF v_eh_noturno THEN
            NEW.valor_plantao := CASE
                WHEN v_dia_num IN (5,6,7) THEN 1900  -- Quinta-Domingo noite
                ELSE 1800  -- Segunda a Quarta noite
            END;
        ELSE
            NEW.valor_plantao := CASE
                WHEN v_dia_num IN (6,7) THEN 925  -- Fim de semana (diurno)
                ELSE 825  -- Semana (diurno)
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
