// Depois de "cap add android": ajusta o projeto Android gerado.
//  1) Versão: o versionCode sobe a cada compilação (10 + número da execução no GitHub),
//     então o APK novo atualiza o antigo sem desinstalar.
//  2) MainActivity: limpa o cache do WebView quando o app é atualizado e reserva, direto no
//     Android, o espaço da barra de status/navegação e do entalhe (o Android 15+ desenha o
//     app por baixo delas, sem opção de sair disso).
// A assinatura é feita depois, com apksigner (veja .github/workflows/apk.yml).
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', 'android');
const gradle = path.join(raiz, 'app', 'build.gradle');
const activity = path.join(raiz, 'app', 'src', 'main', 'java', 'br', 'com', 'noemisales', 'pontokids', 'MainActivity.java');

for (const arq of [gradle, activity]) {
  if (!fs.existsSync(arq)) {
    console.error(`${arq} não existe. Rode "npx cap add android" antes.`);
    process.exit(1);
  }
}

// 1) versão
let g = fs.readFileSync(gradle, 'utf8');
const numero = parseInt(process.env.NUMERO || '1', 10) || 1;
const codigo = 10 + numero;
function troca(re, novo, nome) {
  if (!re.test(g)) { console.error(`personalizar-android: não achei ${nome} no build.gradle`); process.exit(1); }
  g = g.replace(re, novo);
}
troca(/versionCode\s+\d+/, `versionCode ${codigo}`, 'versionCode');
troca(/versionName\s+"[^"]*"/, `versionName "1.0.${numero}"`, 'versionName');

// O MainActivity usa androidx.core; declara direto para não depender de ele vir de carona.
const linha = '    implementation "androidx.core:core:$androidxCoreVersion"\n';
if (!g.includes(linha.trim())) {
  g = g.replace(
    '    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"\n',
    '    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"\n' + linha
  );
  if (!g.includes(linha.trim())) { console.error('personalizar-android: não achei a linha do appcompat no build.gradle'); process.exit(1); }
}
fs.writeFileSync(gradle, g, 'utf8');

// 2) MainActivity
const conteudo = `package br.com.noemisales.pontokids;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    limparCacheSeAtualizou();
    empurraConteudoParaForaDasBarras();
  }

  // Limpa o cache do WebView quando o app sobe numa versão diferente da última vez que rodou,
  // para uma atualização do APK nunca deixar uma tela antiga em cache no lugar da nova.
  // O login e os dados ficam no Supabase/localStorage, não no cache de rede.
  private void limparCacheSeAtualizou() {
    try {
      int versaoAtual = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
      SharedPreferences prefs = getSharedPreferences("ponto_kids_app", MODE_PRIVATE);
      int versaoAnterior = prefs.getInt("versionCode", -1);
      if (versaoAnterior != versaoAtual) {
        if (bridge != null && bridge.getWebView() != null) {
          bridge.getWebView().clearCache(true);
        }
        prefs.edit().putInt("versionCode", versaoAtual).apply();
      }
    } catch (Exception e) {
      // Nunca trava o app por causa disso.
    }
  }

  // Reserva o espaço da barra de status, da barra de navegação e do entalhe direto na tela do
  // app, sem depender do CSS da página.
  private void empurraConteudoParaForaDasBarras() {
    try {
      View raiz = getWindow().getDecorView();
      ViewCompat.setOnApplyWindowInsetsListener(raiz, (v, insets) -> {
        Insets barras = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
        v.setPadding(barras.left, barras.top, barras.right, barras.bottom);
        return new WindowInsetsCompat.Builder(insets)
          .setInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(), Insets.of(0, 0, 0, 0))
          .build();
      });
      ViewCompat.requestApplyInsets(raiz);
    } catch (Exception e) {
      // Nunca trava o app por causa disso.
    }
  }
}
`;
fs.writeFileSync(activity, conteudo, 'utf8');

console.log(`personalizar-android: versionCode ${codigo}, versionName 1.0.${numero}; MainActivity atualizado.`);
