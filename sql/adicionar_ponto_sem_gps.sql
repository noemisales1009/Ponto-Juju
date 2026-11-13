-- ============================================================
-- PONTO SEM GPS (provisório): aparelho que não entrega a localização
-- (rode DEPOIS de adicionar_localizacao_ponto.sql e adicionar_atraso_ponto.sql)
-- ============================================================
-- POR QUE (13/11/2026): iPhones não estavam entregando a localização ao navegador e os médicos
-- ficaram sem conseguir bater o ponto.
--
-- A REGRA (decidida pela Noemi em 13/11/2026):
--   * Se o aparelho entrega a localização, nada muda: o ponto só vale dentro do hospital.
--   * Se o aparelho NÃO entrega a localização (bloqueada, sem sinal, sem suporte), o ponto é
--     aceito mesmo assim e fica marcado como "sem GPS", com o motivo e o tipo de aparelho.
--   * Data de hoje, início do turno, horário gravado e desconto por atraso continuam valendo.
--   * O admin vê quem bateu sem GPS na tela Localização.
--   Ponto fraco conhecido: quem bloquear a localização de propósito também passa.
--
-- O QUE ESTE ARQUIVO FAZ (não altera nenhum ponto nem as regras já criadas):
--   1. Cria a tabela ponto_sem_gps: uma linha por ponto batido sem localização.
--   2. Cria a função registrar_presenca_sem_gps.
--
-- PARA VOLTAR A EXIGIR GPS DE TODOS (sem publicar o app de novo): veja "PARA DESLIGAR" no final.
-- Pode ser rodado mais de uma vez. Roda numa transação (se falhar, nada é aplicado).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ponto_sem_gps (
  ponto_id bigint PRIMARY KEY REFERENCES public.ponto_juju2 (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id),
  motivo text,
  aparelho text,
  registrado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_sem_gps_user_id ON public.ponto_sem_gps (user_id);

-- O Supabase dá acesso total a tabelas novas por padrão: tirar tudo e liberar só a leitura
ALTER TABLE public.ponto_sem_gps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ponto_sem_gps FROM anon, authenticated;
GRANT SELECT ON public.ponto_sem_gps TO authenticated;

DROP POLICY IF EXISTS "Médico vê os próprios pontos sem GPS; admin vê todos" ON public.ponto_sem_gps;
CREATE POLICY "Médico vê os próprios pontos sem GPS; admin vê todos"
  ON public.ponto_sem_gps FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_admin_user());

-- SECURITY DEFINER: grava o ponto como dono da função, e por isso passa pelo trigger que exige
-- a localização (trg_ponto_validar_localizacao). Os outros triggers rodam normalmente.
CREATE OR REPLACE FUNCTION public.registrar_presenca_sem_gps(
  p_data_dia date,
  p_turno text,
  p_setor_id bigint,
  p_motivo text,
  p_aparelho text
)
RETURNS public.ponto_juju2
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_ponto public.ponto_juju2;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Faça login para bater o ponto.'
        USING ERRCODE = '42501';
    END IF;

    -- O médico só bate o próprio ponto. "data" ao meio-dia UTC, como o app sempre enviou
    -- (o trigger deriva data_dia dela). Data travada, horário e atraso: trigger do atraso.
    INSERT INTO public.ponto_juju2 (user_id, created_by, data, data_dia, turno, setor_id, falta, turno_preenchido)
    VALUES (v_user_id, v_user_id, (p_data_dia + time '12:00') AT TIME ZONE 'UTC', p_data_dia, p_turno, p_setor_id, NULL, true)
    RETURNING * INTO v_ponto;

    INSERT INTO public.ponto_sem_gps (ponto_id, user_id, motivo, aparelho)
    VALUES (v_ponto.id, v_user_id, left(p_motivo, 300), left(p_aparelho, 300));

    RETURN v_ponto;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_presenca_sem_gps(date, text, bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_presenca_sem_gps(date, text, bigint, text, text) TO authenticated;

COMMIT;

-- Confirmação: se aparecer esta linha no resultado, o ponto sem GPS está liberado.
select 'Ponto sem GPS liberado' as resultado, count(*) as pontos_sem_gps from public.ponto_sem_gps;

-- ============================================================
-- VER QUEM BATEU SEM GPS, O MOTIVO E O APARELHO:
--   SELECT p.data_dia, p.turno, COALESCE(m.medico, u.nome) AS medico, s.motivo, s.aparelho,
--          s.registrado_em AT TIME ZONE 'America/Sao_Paulo' AS horario
--   FROM public.ponto_sem_gps s
--   JOIN public.ponto_juju2 p ON p.id = s.ponto_id
--   LEFT JOIN public.medicos_juju m ON m.user_id = s.user_id
--   LEFT JOIN public.usuarios u ON u.user_id = s.user_id
--   ORDER BY s.registrado_em DESC;
--
-- PARA DESLIGAR (volta a exigir GPS de todos na hora; o app mostra o aviso de localização):
--   DROP FUNCTION IF EXISTS public.registrar_presenca_sem_gps(date, text, bigint, text, text);
--   (a tabela ponto_sem_gps fica, com o histórico)
-- ============================================================
