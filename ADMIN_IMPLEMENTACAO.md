# 🔐 Painel Administrativo - Guia de Implementação

## 📋 O que foi criado

### 1. **Coluna `role` na tabela `usuarios`**
   - Valores: `'medico'` (padrão), `'admin'`, `'gerente'`
   - Permite controlar permissões por usuário

### 2. **Componente `AdminPage.tsx`**
   - Verifica se o usuário é admin
   - Mostra erro 🔒 se não tiver permissão
   - Redireciona para AdminDashboard se autorizado

### 3. **Componente `AdminDashboard.tsx`**
   - Relatório mensal por médico
   - Filtros por mês/ano
   - Exportar CSV
   - Resumo financeiro

## 🚀 Como Implementar

### Passo 1: Executar SQL no Supabase

1. Abra **Supabase Dashboard** → **SQL Editor**
2. Execute: `sql/adicionar_role_usuarios.sql`
3. Descomente e execute esta linha:
```sql
UPDATE public.usuarios 
SET role = 'admin' 
WHERE email IN ('ns.cucacriativa@gmail.com', 'leliamachadobraga@gmail.com');
```

### Passo 2: Atualizar App.tsx

Adicione na navegação:

```typescript
// Em App.tsx, no menu do Sidebar
import AdminPage from './components/AdminPage';

// Dentro do switch case do menu:
case 'Admin': {
    return (
        <AdminPage 
            currentUser={currentUser} 
            onBack={() => setCurrentScreen('Home')} 
        />
    );
}

// E no Sidebar, adicione o botão (APENAS para admins):
{isAdmin && (
    <button
        onClick={() => setCurrentScreen('Admin')}
        className="w-full text-left px-4 py-2 rounded-lg hover:bg-pmp-primary/10 transition-colors"
    >
        👨‍💼 Admin
    </button>
)}
```

### Passo 3: Adicionar verificação de admin no App.tsx

```typescript
const [isAdmin, setIsAdmin] = useState(false);

useEffect(() => {
    checkIfAdmin();
}, [currentUser]);

const checkIfAdmin = async () => {
    if (!currentUser?.id) return;
    
    const { data } = await supabase
        .from('usuarios')
        .select('role')
        .eq('user_id', currentUser.id)
        .single();
    
    setIsAdmin(data?.role === 'admin');
};
```

## 🎯 Fluxo de Autorização

```
1. Usuário acessa "Admin"
   ↓
2. AdminPage verifica role na tabela usuarios
   ↓
3. Se role = 'admin' → mostra AdminDashboard
4. Se role != 'admin' → mostra "Acesso Negado"
```

## 📊 O que o Admin pode fazer

| Ação | Descrição |
|------|-----------|
| **Filtrar por Mês** | Ver dados de qualquer mês |
| **Filtrar por Ano** | Ver dados de qualquer ano |
| **Exportar CSV** | Baixar relatório em CSV |
| **Ver Totais** | Plantões, Faltas, Faturamento |
| **Ver Detalhes** | Nome, CPF, Banco, Conta de cada médico |

## 🔍 Dados do Relatório

Vem da view `nova_total_por_medico_mes`:

```
- Médico (nome)
- CPF
- Banco / Agência / Conta / Variação
- Mês/Ano
- Total Plantões (realizados)
- Total Faltas
- Total Faturamento (faltas zeradas)
```

## ✅ Checklist de Implementação

- [ ] Executar SQL: `adicionar_role_usuarios.sql`
- [ ] Atualizar admins no Supabase (UPDATE com emails)
- [ ] Importar componentes no App.tsx
- [ ] Adicionar botão Admin no Sidebar
- [ ] Adicionar verificação isAdmin no App.tsx
- [ ] Testar acesso negado (com usuário normal)
- [ ] Testar acesso concedido (com admin)

## 🧪 Testar Permissões

**Como Admin:**
1. Login com `ns.cucacriativa@gmail.com`
2. Deve ver botão "👨‍💼 Admin"
3. Clique e veja o relatório

**Como Médico Normal:**
1. Login com outro usuário
2. NÃO deve ver botão "👨‍💼 Admin"
3. Se tentar acessar URL direta, vê "Acesso Negado"

## 🔐 Segurança Adicional (Opcional)

Para ainda mais segurança, adicione RLS na tabela `nova_total_por_medico_mes`:

```sql
-- Apenas admins podem ver a view
CREATE POLICY "Apenas admins podem ver relatório"
  ON public.nova_total_por_medico_mes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

## 📞 Suporte

Se tiver dúvidas na implementação, verifique:
1. Role está setada como 'admin' no Supabase
2. Componentes estão importados corretamente
3. Console do navegador (F12) para ver erros
