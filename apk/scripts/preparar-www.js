// Monta apk/www com o app já compilado (npm run build, na pasta principal, gera ../dist).
// O aplicativo leva tudo dentro dele; só os scripts de CDN (Tailwind, jsPDF) e o Supabase
// precisam de internet.
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', '..', 'dist');
const destino = path.join(__dirname, '..', 'www');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html não encontrado: rode "npm run build" na pasta principal antes.');
  process.exit(1);
}

fs.rmSync(destino, { recursive: true, force: true });
fs.cpSync(dist, destino, { recursive: true });

let total = 0;
(function soma(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) soma(p); else total += fs.statSync(p).size;
  });
})(destino);
console.log(`preparar-www: ${(total / 1048576).toFixed(1)} MB em apk/www`);
