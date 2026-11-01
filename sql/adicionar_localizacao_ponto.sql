-- ============================================================
-- LOCALIZAÇÃO (GPS) NO PONTO (rode DEPOIS das Etapas 1, 1b e 2)
-- ============================================================
-- A REGRA (definida pela Noemi):
--   * O ponto de presença só vale se o GPS indicar o Hospital Infantil Dr. Juvêncio Mattos.
--   * A posição fica registrada no ponto.
--   * Falta não exige localização.
--
-- O QUE ESTE ARQUIVO FAZ (não apaga nem altera dados; pontos antigos ficam sem localização):
--   1. Cria as colunas latitude, longitude e precisao_metros em ponto_juju2.
--   2. Libera gravar essas colunas ao CRIAR o ponto. Editar não: ninguém muda a posição depois.
--   3. Recusa no banco o ponto sem localização ou fora do hospital.
--   4. Recusa médico comum desmarcar a própria falta: viraria presença sem passar pelo GPS.
--      (a Etapa 1b só cobre a falta de colega). O admin continua podendo corrigir.
--
-- ORDEM: rode IMEDIATAMENTE ANTES de publicar o site e o APK novos. A partir daqui, a versão
-- antiga do app não consegue mais bater ponto (ela não envia a localização).
--
-- Se a Etapa 1 for rodada de novo depois deste arquivo, rode este também: ela refaz as
-- permissões por coluna. Este arquivo pode ser rodado mais de uma vez.
-- Roda numa transação (se falhar, nada é aplicado).
-- ============================================================

BEGIN;

-- 1) Colunas
ALTER TABLE public.ponto_juju2
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS precisao_metros double precision;

-- 2) Permissão por coluna (veja a Etapa 1)
GRANT INSERT (latitude, longitude, precisao_metros) ON public.ponto_juju2 TO authenticated;

-- 3) Função: validar a localização
-- Ao mudar o local ou o raio, mudar também LOCAL_PONTO em constants.ts
-- ERRCODE 42501: é o que o app mostra como "sem permissão" (utils/errors.ts)
CREATE OR REPLACE FUNCTION public.fn_ponto_validar_localizacao()
RETURNS TRIGGER AS $$
DECLARE
    c_latitude CONSTANT double precision := -2.53614;
    c_longitude CONSTANT double precision := -44.297487;
    c_raio_metros CONSTANT double precision := 150;
    v_distancia double precision;
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
    IF auth.uid() IS NULL OR EXISTS (
        SELECT 1
        FROM public.usuarios
        WHERE usuarios.user_id = auth.uid()
        AND usuarios.role = 'admin'
    ) THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Só o admin pode transformar falta em presença.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
        RAISE EXCEPTION 'Ponto sem localização.'
        USING ERRCODE = '42501';
    END IF;

    -- Distância em metros (fórmula de Haversine)
    v_distancia := 2 * 6371000 * asin(sqrt(
        power(sin(radians(NEW.latitude - c_latitude) / 2), 2) +
        cos(radians(c_latitude)) * cos(radians(NEW.latitude)) *
        power(sin(radians(NEW.longitude - c_longitude) / 2), 2)
    ));

    IF v_distancia > c_raio_metros THEN
        RAISE EXCEPTION 'Ponto fora do hospital (% m).', round(v_distancia)
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
-- CONFERIR ONDE OS PONTOS FORAM BATIDOS:
--   SELECT data_dia, turno, user_id, latitude, longitude, precisao_metros
--   FROM public.ponto_juju2
--   WHERE latitude IS NOT NULL
--   ORDER BY data_dia DESC;
--
-- PARA DESFAZER (a regra sai; as posições já gravadas ficam):
--   DROP TRIGGER IF EXISTS trg_ponto_validar_localizacao ON public.ponto_juju2;
--   DROP FUNCTION IF EXISTS public.fn_ponto_validar_localizacao();
-- ============================================================
