#!/usr/bin/env node
// Gera o build web de produção (dist/) e corrige um problema específico de
// hospedagem: a Vercel lê o .gitignore da raiz do projeto como se fossem
// regras dela (mesmo publicando só a pasta dist/), e não existe .vercelignore
// que sobreponha isso — testado com arquivo vazio, com negação simples e com
// negação em todos os níveis do caminho, sempre ignorado. Como o .gitignore
// tem `node_modules/`, qualquer asset que o Metro nomeia com esse trecho no
// caminho (bibliotecas como @react-navigation, o worker do expo-sqlite) some
// silenciosamente do deploy — o navegador recebe a página 404 da Vercel no
// lugar do arquivo real e falha ao interpretar aquilo como PNG/WASM.
// A saída é mover esses arquivos para fora de qualquer pasta "node_modules"
// e corrigir as referências no bundle, depois do export.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

console.log('Gerando build web (expo export --platform web)...');
execSync('npx expo export --platform web', { stdio: 'inherit' });

const nodeModulesDir = path.join(DIST, 'assets', 'node_modules');
const vendorDir = path.join(DIST, 'assets', 'vendor');

if (fs.existsSync(nodeModulesDir)) {
  fs.renameSync(nodeModulesDir, vendorDir);

  const jsDir = path.join(DIST, '_expo', 'static', 'js', 'web');
  for (const arquivo of fs.readdirSync(jsDir)) {
    if (!arquivo.endsWith('.js')) continue;
    const caminho = path.join(jsDir, arquivo);
    const conteudo = fs.readFileSync(caminho, 'utf8');
    const corrigido = conteudo.split('/assets/node_modules/').join('/assets/vendor/');
    if (corrigido !== conteudo) {
      fs.writeFileSync(caminho, corrigido);
      console.log(`Referência corrigida em ${arquivo}`);
    }
  }
  console.log('assets/node_modules -> assets/vendor (Vercel não esconde mais esses arquivos).');
} else {
  console.log('Nenhum asset em node_modules desta vez — nada para corrigir.');
}

console.log('\nBuild pronto em dist/. Para publicar: npx vercel dist --prod --yes');
