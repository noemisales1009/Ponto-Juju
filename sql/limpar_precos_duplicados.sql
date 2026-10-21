-- ============================================================
-- LIMPAR PREÇOS DUPLICADOS EM periodo_juju (e impedir que voltem)
-- ============================================================
-- Hoje há duas linhas repetidas na tabela de preços (mesmo setor, mesmo período, mesmo valor):
--   id 22 repete o id 5   (Semi 2 / Tarde Semana (13h - 19h) / 825,00)
--   id 21 repete o id 11  (UTI Ped / Tarde Semana (13h - 19h) / 875,00)
-- Hoje não muda nenhum valor. O risco é futuro: o trigger de ponto escolhe UMA linha com LIMIT 1 e
-- sem ordem; se um dia você mudar o preço de só uma das duas, os pontos podem sair com valores diferentes.
--
-- ESTE ARQUIVO ALTERA DADOS (apaga 2 linhas da tabela de PREÇOS, não de pontos):
--   * Só apaga a linha mais NOVA (21 e 22) e SOMENTE se existir uma mais antiga idêntica
--     (mesmo setor, mesmo período e mesmo valor). Se algo estiver diferente do esperado, não apaga nada.
--   * Os pontos que apontavam para a linha apagada ficam com periodo_id vazio (chave estrangeira
--     ON DELETE SET NULL), MAS o valor_plantao deles continua gravado: dinheiro e relatórios não mudam.
--   * Depois cria uma trava para não repetir (setor + período, ignorando maiúsculas, acentos e símbolos,
--     do mesmo jeito que o trigger compara).
--
-- ANTES DE RODAR: faça um backup.
-- PASSO 1 — rode SÓ esta consulta (apenas leitura) e confira o resultado: deve listar 2 linhas.
--   "pontos_ligados" é quantos pontos apontam para a linha que vai sair (pode ser zero).
--
--   SELECT d.id AS vai_apagar, k.id AS fica, d.setor_id, d.periodo, d.valor_por_plantao,
--          (SELECT count(*) FROM public.ponto_juju2 po WHERE po.periodo_id = d.id) AS pontos_ligados
--   FROM public.periodo_juju d
--   JOIN public.periodo_juju k
--     ON k.id < d.id
--    AND k.setor_id = d.setor_id
--    AND regexp_replace(upper(k.periodo), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(d.periodo), '[^A-Z0-9]', '', 'g')
--    AND k.valor_por_plantao = d.valor_por_plantao
--   WHERE d.id IN (21, 22)
--   ORDER BY d.id;
--
-- PASSO 2 — se o passo 1 mostrou exatamente as 2 linhas esperadas, rode o resto deste arquivo.
-- É uma transação: se a trava final falhar (ainda houver duplicadas), NADA é aplicado.
-- ============================================================

BEGIN;

DELETE FROM public.periodo_juju d
USING public.periodo_juju k
WHERE d.id IN (21, 22)
  AND k.id < d.id
  AND k.setor_id = d.setor_id
  AND regexp_replace(upper(k.periodo), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(d.periodo), '[^A-Z0-9]', '', 'g')
  AND k.valor_por_plantao = d.valor_por_plantao;

-- Trava: não pode haver dois preços para o mesmo setor + período (mesma chave que o trigger usa).
-- Se ainda existir duplicata, a criação falha e a transação inteira é desfeita.
CREATE UNIQUE INDEX IF NOT EXISTS uq_periodo_juju_setor_periodo_norm
  ON public.periodo_juju (setor_id, (regexp_replace(upper(periodo), '[^A-Z0-9]', '', 'g')));

COMMIT;

-- ============================================================
-- OPCIONAL (só um rótulo, o trigger não usa a coluna "dias"): corrigir o texto da linha 15,
-- que está como "Segunda - Quinta" mas é o preço de fim de semana (2400):
--   UPDATE public.periodo_juju SET dias = 'Sábado - Domingo' WHERE id = 15;
--
-- PARA DESFAZER A TRAVA (as linhas apagadas só voltam pelo backup):
--   DROP INDEX IF EXISTS public.uq_periodo_juju_setor_periodo_norm;
-- ============================================================
