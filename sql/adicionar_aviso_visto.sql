-- ============================================================
-- AVISO DE NOVIDADES: GUARDAR QUEM JÁ VIU
-- ============================================================
-- O app mostra um tutorial com as regras novas no primeiro acesso de cada médico.
-- Esta tabela guarda quem já tocou em "Entendi", para o aviso não voltar a aparecer
-- em outro celular, computador ou navegador.
--
-- O QUE ESTE ARQUIVO FAZ (não toca em nenhuma tabela existente):
--   * Cria a tabela ponto_aviso_visto: uma linha por médico e por versão do aviso.
--   * Cada médico só lê e só grava a própria linha. O admin lê as de todos, para saber quem
--     já viu. Ninguém altera nem apaga pelo app.
--
-- Pode ser rodado antes ou depois de publicar o app: sem a tabela, o app só usa a marca
-- guardada no navegador. Pode ser rodado mais de uma vez.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ponto_aviso_visto (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  versao text NOT NULL CHECK (char_length(versao) BETWEEN 1 AND 40),
  visto_em timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, versao)
);

-- O Supabase dá acesso total a tabelas novas por padrão: tirar tudo e liberar só ler e incluir
ALTER TABLE public.ponto_aviso_visto ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ponto_aviso_visto FROM anon, authenticated;
GRANT SELECT ON public.ponto_aviso_visto TO authenticated;
GRANT INSERT (user_id, versao) ON public.ponto_aviso_visto TO authenticated;

DROP POLICY IF EXISTS "Médico vê o próprio aviso visto" ON public.ponto_aviso_visto;
DROP POLICY IF EXISTS "Médico vê o próprio aviso visto; admin vê todos" ON public.ponto_aviso_visto;
CREATE POLICY "Médico vê o próprio aviso visto; admin vê todos"
  ON public.ponto_aviso_visto FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_admin_user());

DROP POLICY IF EXISTS "Médico marca o próprio aviso como visto" ON public.ponto_aviso_visto;
CREATE POLICY "Médico marca o próprio aviso como visto"
  ON public.ponto_aviso_visto FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

COMMIT;

-- Confirmação: se aparecer esta linha no resultado, a tabela foi criada.
select 'Tabela do aviso criada' as resultado, count(*) as ja_viram from public.ponto_aviso_visto;

-- ============================================================
-- VER QUEM JÁ VIU O AVISO:
--   SELECT u.nome, a.versao, a.visto_em AT TIME ZONE 'America/Sao_Paulo' AS visto_em
--   FROM public.ponto_aviso_visto a
--   LEFT JOIN public.usuarios u ON u.user_id = a.user_id
--   ORDER BY a.visto_em DESC;
--
-- FAZER O AVISO APARECER DE NOVO PARA TODOS: não apague linhas. Troque NOVIDADES_VERSAO em
-- components/WhatsNewModal.tsx e publique o app.
--
-- PARA DESFAZER:
--   DROP TABLE IF EXISTS public.ponto_aviso_visto;
-- ============================================================
