# 🚀 Deploy na Vercel - Ponto Juju

## Passos para Deploy

### 1️⃣ Configurar Variáveis de Ambiente na Vercel

Antes de fazer o deploy, você precisa configurar as variáveis de ambiente no painel da Vercel:

1. Acesse: https://vercel.com/
2. Vá no seu projeto
3. Clique em **Settings** → **Environment Variables**
4. Adicione as seguintes variáveis:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
```

### 2️⃣ Obter as Credenciais do Supabase

1. Acesse: https://supabase.com/dashboard
2. Abra seu projeto
3. Vá em **Settings** → **API**
4. Copie:
   - **Project URL** → VITE_SUPABASE_URL
   - **anon/public key** → VITE_SUPABASE_ANON_KEY

### 3️⃣ Deploy

Depois de configurar as variáveis:

1. Faça commit e push do código:
```bash
git add .
git commit -m "Adicionar configuração Vercel"
git push
```

2. Na Vercel, clique em **Redeploy** ou importe o repositório do GitHub

### 4️⃣ Verificar Deploy

Após o deploy, verifique se:
- ✅ O site carrega
- ✅ O login funciona
- ✅ Os dados do Supabase aparecem

## ⚠️ Problemas Comuns

### Erro: "Cannot read property of undefined"
**Solução:** Verifique se as variáveis de ambiente estão configuradas corretamente na Vercel.

### Erro 404 nas rotas
**Solução:** Já configurado no `vercel.json` - as rotas são redirecionadas para index.html.

### Supabase não conecta
**Solução:** Verifique se as credenciais do Supabase estão corretas e se o RLS está configurado.
