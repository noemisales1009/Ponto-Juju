# 🔐 Implementação de Row Level Security (RLS) - Ponto Juju

## O que é RLS?

Row Level Security (RLS) é um mecanismo de segurança que permite controlar quem pode ver, editar ou deletar cada linha de dados no banco de dados.

## Por que usar RLS?

Sem RLS:
- ❌ Um usuário poderia editar/deletar pontos de outros usuários (INSEGURO!)
- ❌ Seria necessário verificar permissões no código (propenso a erros)

Com RLS:
- ✅ O banco de dados força que cada usuário APENAS edite/delete seus próprios registros
- ✅ Segurança garantida em nível de banco de dados
- ✅ Código mais limpo (sem lógica extra de permissão)

## Como Implementar

### Passo 1: Executar o SQL no Supabase

1. Abra o Supabase Dashboard
2. Vá para: **SQL Editor** > **New Query**
3. Copie todo o conteúdo de `sql/adicionar_rls_ponto_juju2.sql`
4. Execute a query

Ou execute via CLI:
```bash
psql -h seu-host.supabase.co -U postgres -d postgres -f sql/adicionar_rls_ponto_juju2.sql
```

### Passo 2: Verificar se foi criado

Execute esta query no Supabase para confirmar:
```sql
SELECT * FROM pg_policies WHERE tablename = 'ponto_juju2';
```

Você deve ver 4 políticas:
- "Qualquer um pode ver pontos"
- "Usuários autenticados podem criar pontos"
- "Usuários podem editar APENAS seus próprios pontos"
- "Usuários podem deletar APENAS seus próprios pontos"

## O que Muda no Código React?

### ✅ NÃO PRECISA MUDAR NADA!

O código já está correto porque:

1. **handleDeletePonto()**: Já deleta com `.eq('id', pontoId)` 
   - RLS automaticamente verifica se `user_id = auth.uid()`
   - Se não for o dono, devolve erro

2. **handleEditPonto()**: Já atualiza com `.eq('id', pontoId)`
   - RLS automaticamente verifica se `user_id = auth.uid()`
   - Se não for o dono, devolve erro

3. **handleClockIn()**: Já insere com `user_id: currentUser.id`
   - RLS automaticamente verifica se `user_id = auth.uid()`
   - Seguro!

### Exemplo de como funciona:

```typescript
// Usuário (UUID: abc123) tenta deletar ponto id 5 (que pertence a def456)
const { error } = await supabase
    .from('ponto_juju2')
    .delete()
    .eq('id', 5);

// ❌ ERRO! RLS bloqueia porque:
// - O ponto id 5 tem user_id = 'def456'
// - O usuário logado é 'abc123'
// - Política DELETE exige: user_id = auth.uid()
// Resultado: "new row violates row-level security policy"
```

## Teste de Segurança

Para testar se está funcionando:

1. Abra o DevTools (F12)
2. Console > Network > veja a requisição
3. Tente deletar um ponto de outro usuário (fake)
4. Deve receber erro: `"row level security violation"`

## Resumo das Políticas

| Operação | Quem pode? | Condição |
|----------|-----------|----------|
| **SELECT** | Qualquer um autenticado | Sempre (para dashboard) |
| **INSERT** | Qualquer um autenticado | `user_id = auth.uid()` |
| **UPDATE** | Apenas o dono | `user_id = auth.uid()` |
| **DELETE** | Apenas o dono | `user_id = auth.uid()` |

## Caso Especial: Admin ou Médico Chefe

Se em futuro você quiser que um "Admin" possa editar/deletar pontos de OUTROS usuários, adicione esta política:

```sql
-- Política para ADMINs (exemplo)
CREATE POLICY "Admins podem editar qualquer ponto"
  ON public.ponto_juju2
  FOR UPDATE
  USING (
    -- Verifica se o usuário é admin
    (SELECT raw_user_meta_data->'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (true);
```

Mas por enquanto, com as 4 políticas básicas, está 100% seguro! 🔐
