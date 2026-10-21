# APK do Ponto Kids

Empacota o app como aplicativo Android com o Capacitor. O código do app vai **dentro** do APK: toda mudança no app pede um APK novo.
O APK é montado pelo GitHub (`.github/workflows/apk.yml`) e **não fica guardado no repositório**: sai como arquivo temporário (1 dia), é baixado para o PC e apagado.

## Segredos necessários (Settings > Secrets and variables > Actions)

| Segredo | O que é |
|---|---|
| `APK_KEYSTORE_B64` | a chave de assinatura (`.p12`) em base64 |
| `APK_KEYSTORE_SENHA` | a senha dessa chave |
| `VITE_SUPABASE_URL` | a Project URL do Supabase (a mesma do `.env.local`) |
| `VITE_SUPABASE_ANON_KEY` | a chave **anon** do Supabase (nunca a `service_role`) |

A chave de assinatura nunca vai para o Git. Guarde uma cópia dela fora do PC: com outra chave, o Android não deixa instalar a atualização por cima do app antigo.

## Gerar um APK novo

1. No GitHub: aba **Actions** > **Gerar APK** > **Run workflow**.
2. Ao terminar, baixe o arquivo `ponto-kids-apk` (aparece no fim da execução) e apague-o em seguida.

## Instalar no celular

1. Passe o `ponto-kids.apk` para o celular (USB, WhatsApp, e-mail).
2. Abra o arquivo e permita "instalar apps desconhecidos" quando o Android pedir.
3. Para atualizar, instale o APK novo por cima (precisa ser assinado com a mesma chave).

## Pastas

- `assets/`: ícone e tela de abertura (PNG). O Android é gerado a partir deles na hora do build.
- `scripts/`: preparam a pasta `www` e ajustam o projeto Android.
- `android/`, `www/` e `node_modules/` são gerados na hora e ficam fora do Git.
