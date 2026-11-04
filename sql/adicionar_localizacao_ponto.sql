-- ============================================================
-- LOCALIZAÇÃO (GPS) NO PONTO (rode DEPOIS das Etapas 1 e 1b)
-- ============================================================
-- A REGRA (definida pela Noemi):
--   * O ponto de presença só vale se o GPS indicar o Hospital Infantil Dr. Juvêncio Mattos.
--   * A posição fica registrada numa tabela separada, ponto_localizacao.
--   * Cada médico só vê a própria localização. O admin vê todas. (LGPD: localização é dado pessoal.)
--   * Falta não exige localização.
--
-- POR QUE UMA TABELA SEPARADA:
--   Todo médico logado lê todos os pontos de ponto_juju2 (a tela de Plantões mostra os colegas).
--   Se a posição ficasse lá, qualquer médico poderia ler onde o colega estava.
--
-- O QUE ESTE ARQUIVO FAZ (não apaga nem altera pontos; os antigos ficam sem localização):
--   1. Cria a tabela ponto_localizacao, protegida: só leitura, da própria linha ou do admin.
--      Ninguém grava nem muda nada nela pelo app. Quem grava é a função do passo 2.
--   2. Cria a função registrar_presenca: confere o GPS e grava o ponto e a posição juntos.
--      O ponto continua passando pelos triggers de sempre (valor, data travada, atraso).
--   3. Recusa a presença de médico comum gravada direto em ponto_juju2, sem passar pela função.
--   4. Recusa médico comum desmarcar a própria falta: viraria presença sem passar pelo GPS.
--      (a Etapa 1b só cobre a falta de colega). O admin continua podendo corrigir.
--
-- ORDEM: rode IMEDIATAMENTE ANTES de publicar o site e o APK novos. A partir daqui, a versão
-- antiga do app não consegue mais bater ponto (ela não usa a função registrar_presenca).
--
-- Pode ser rodado mais de uma vez. Roda numa transação (se falhar, nada é aplicado).
-- ============================================================

BEGIN;

-- 1) Tabela da localização (uma linha por ponto de presença)
CREATE TABLE IF NOT EXISTS public.ponto_localizacao (
  ponto_id bigint PRIMARY KEY REFERENCES public.ponto_juju2 (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  precisao_metros double precision,
  distancia_metros double precision NOT NULL,
  registrado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_localizacao_user_id ON public.ponto_localizacao (user_id);

-- O Supabase dá acesso total a tabelas novas por padrão: tirar tudo e liberar só a leitura
ALTER TABLE public.ponto_localizacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ponto_localizacao FROM anon, authenticated;
GRANT SELECT ON public.ponto_localizacao TO authenticated;

DROP POLICY IF EXISTS "Médico vê a própria localização; admin vê todas" ON public.ponto_localizacao;
CREATE POLICY "Médico vê a própria localização; admin vê todas"
  ON public.ponto_localizacao FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_admin_user());

-- 2) Função: bater o ponto de presença com o GPS
-- Ao mudar o local ou o raio, mudar também LOCAL_PONTO em constants.ts
-- ERRCODE 42501: é o que o app mostra como "sem permissão" (utils/errors.ts)
-- SECURITY DEFINER: grava em ponto_localizacao, que o médico não pode gravar direto.
CREATE OR REPLACE FUNCTION public.registrar_presenca(
  p_data_dia date,
  p_turno text,
  p_setor_id bigint,
  p_latitude double precision,
  p_longitude double precision,
  p_precisao_metros double precision
)
RETURNS public.ponto_juju2
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_latitude CONSTANT double precision := -2.53614;
    c_longitude CONSTANT double precision := -44.297487;
    c_raio_metros CONSTANT double precision := 150;
    v_user_id uuid := auth.uid();
    v_distancia double precision;
    v_ponto public.ponto_juju2;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Faça login para bater o ponto.'
        USING ERRCODE = '42501';
    END IF;

    IF p_latitude IS NULL OR p_longitude IS NULL THEN
        RAISE EXCEPTION 'Ponto sem localização.'
        USING ERRCODE = '42501';
    END IF;

    -- Distância em metros (fórmula de Haversine)
    v_distancia := 2 * 6371000 * asin(sqrt(
        power(sin(radians(p_latitude - c_latitude) / 2), 2) +
        cos(radians(c_latitude)) * cos(radians(p_latitude)) *
        power(sin(radians(p_longitude - c_longitude) / 2), 2)
    ));

    IF v_distancia > c_raio_metros THEN
        RAISE EXCEPTION 'Ponto fora do hospital (% m).', round(v_distancia)
        USING ERRCODE = '42501';
    END IF;

    -- O médico só bate o próprio ponto. "data" ao meio-dia UTC, como o app sempre enviou
    -- (o trigger deriva data_dia dela). Data travada, horário e atraso: trigger do atraso.
    INSERT INTO public.ponto_juju2 (user_id, created_by, data, data_dia, turno, setor_id, falta, turno_preenchido)
    VALUES (v_user_id, v_user_id, (p_data_dia + time '12:00') AT TIME ZONE 'UTC', p_data_dia, p_turno, p_setor_id, NULL, true)
    RETURNING * INTO v_ponto;

    INSERT INTO public.ponto_localizacao (ponto_id, user_id, latitude, longitude, precisao_metros, distancia_metros)
    VALUES (v_ponto.id, v_user_id, p_latitude, p_longitude, p_precisao_metros, v_distancia);

    RETURN v_ponto;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_presenca(date, text, bigint, double precision, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_presenca(date, text, bigint, double precision, double precision, double precision) TO authenticated;

-- 3) Função do trigger: presença só pela função registrar_presenca
CREATE OR REPLACE FUNCTION public.fn_ponto_validar_localizacao()
RETURNS TRIGGER AS $$
BEGIN
    -- Falta não exige localização
    IF NEW.falta = 'Sim' THEN
        RETURN NEW;
    END IF;

    -- Edição de presença existente: só interessa quando uma falta vira presença
    IF TG_OP = 'UPDATE' AND OLD.falta IS DISTINCT FROM 'Sim' THEN
        RETURN NEW;
    END IF;

    -- Correções manuais: SQL Editor do Supabase (sem usuário logado) ou admin
    IF auth.uid() IS NULL OR public.is_admin_user() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Só o admin pode transformar falta em presença.'
        USING ERRCODE = '42501';
    END IF;

    -- Gravação direta pelo app (papel authenticated). Dentro de registrar_presenca o papel
    -- é o dono da função, e o GPS já foi conferido.
    IF current_user IN ('anon', 'authenticated') THEN
        RAISE EXCEPTION 'O ponto de presença precisa da localização. Atualize o app.'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Trigger: executar antes de INSERT ou UPDATE
DROP TRIGGER IF EXISTS trg_ponto_validar_localizacao ON public.ponto_juju2;

CREATE TRIGGER trg_ponto_validar_localizacao
BEFORE INSERT OR UPDATE
ON public.ponto_juju2
FOR EACH ROW
EXECUTE FUNCTION public.fn_ponto_validar_localizacao();

COMMIT;

-- ============================================================
-- TESTE DEPOIS DE RODAR (pelo app, no celular):
--   No hospital:
--     [ ] bater ponto                                      -> funciona
--     [ ] negar a permissão de localização e bater ponto   -> recusado, pede para ativar
--   Fora do hospital:
--     [ ] bater ponto                                      -> recusado, mostra a distância
--     [ ] registrar falta                                  -> funciona
--     [ ] desmarcar a própria falta (médico comum)         -> recusado ("sem permissão")
--
-- CONFERIR ONDE OS PONTOS FORAM BATIDOS (SQL Editor):
--   SELECT p.data_dia, p.turno, COALESCE(m.medico, u.nome) AS medico,
--          l.latitude, l.longitude, l.precisao_metros, round(l.distancia_metros) AS distancia_m
--   FROM public.ponto_localizacao l
--   JOIN public.ponto_juju2 p ON p.id = l.ponto_id
--   LEFT JOIN public.medicos_juju m ON m.user_id = l.user_id
--   LEFT JOIN public.usuarios u ON u.user_id = l.user_id
--   ORDER BY l.registrado_em DESC;
--
-- PARA DESFAZER (a regra sai; as posições já gravadas ficam na tabela):
--   DROP TRIGGER IF EXISTS trg_ponto_validar_localizacao ON public.ponto_juju2;
--   DROP FUNCTION IF EXISTS public.fn_ponto_validar_localizacao();
--   DROP FUNCTION IF EXISTS public.registrar_presenca(date, text, bigint, double precision, double precision, double precision);
--   (o app novo deixa de bater ponto sem a função: só desfaça junto com a volta do app antigo)
-- ============================================================
