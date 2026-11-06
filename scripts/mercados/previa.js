// Desenha o mapa do Favetta em PNG para conferir antes de aplicar: `node scripts/mercados/previa.js saida.png`.
const fs = require('fs');
const path = require('path');
// Uso: node scripts/mercados/previa.js <mercado> [saida.png]   (mercado = nome do arquivo, ex.: savegnago; padrão favetta)
const { mapa } = require('./' + (process.argv[2] || 'favetta'));

const CELULA = 22;
const cores = ['#d9ecdf', '#dfe4f5', '#f6e0dc'];

function svg() {
  const w = mapa.largura * CELULA;
  const h = mapa.altura * CELULA;
  const partes = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" font-family="Segoe UI, Arial" >`];
  partes.push(`<rect width="${w}" height="${h}" fill="#faf6f2" stroke="#999"/>`);
  const caixas = mapa.caixas;
  partes.push(`<rect x="${caixas.x * CELULA}" y="${caixas.y * CELULA}" width="${caixas.largura * CELULA}" height="${caixas.altura * CELULA}" fill="#cfcfcf" stroke="#777"/>`);
  partes.push(`<text x="${(caixas.x + caixas.largura / 2) * CELULA}" y="${(caixas.y + 1.3) * CELULA}" font-size="13" text-anchor="middle">Caixas</text>`);
  partes.push(`<polygon points="${(mapa.entrada.x + 0.5) * CELULA},${mapa.entrada.y * CELULA + 4} ${mapa.entrada.x * CELULA + 4},${(mapa.entrada.y + 1) * CELULA - 2} ${(mapa.entrada.x + 1) * CELULA - 4},${(mapa.entrada.y + 1) * CELULA - 2}" fill="#c2540a"/>`);
  mapa.secoes.forEach((s, i) => {
    const { x, y, largura, altura } = s.area;
    const px = x * CELULA;
    const py = y * CELULA;
    const pw = largura * CELULA;
    const ph = altura * CELULA;
    const cor = s.dividida ? '#e3ebe6' : cores[0];
    partes.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${cor}" stroke="#4a8a63" stroke-width="1.5"/>`);
    const vertical = altura > largura;
    const texto = (t, cx, cy) =>
      vertical
        ? `<text transform="translate(${cx} ${cy}) rotate(-90)" font-size="11" text-anchor="middle" dominant-baseline="middle">${t}</text>`
        : `<text x="${cx}" y="${cy}" font-size="11" text-anchor="middle" dominant-baseline="middle">${t}</text>`;
    if (s.dividida) {
      if (vertical) {
        partes.push(`<line x1="${px + pw / 2}" y1="${py}" x2="${px + pw / 2}" y2="${py + ph}" stroke="#4a8a63"/>`);
        partes.push(texto(s.nome, px + pw / 4, py + ph / 2));
        partes.push(texto(s.nomeLadoB, px + (3 * pw) / 4, py + ph / 2));
      } else {
        partes.push(`<line x1="${px}" y1="${py + ph / 2}" x2="${px + pw}" y2="${py + ph / 2}" stroke="#4a8a63"/>`);
        partes.push(texto(s.nome, px + pw / 2, py + ph / 4));
        partes.push(texto(s.nomeLadoB, px + pw / 2, py + (3 * ph) / 4));
      }
    } else {
      partes.push(texto(s.nome, px + pw / 2, py + ph / 2));
    }
  });
  partes.push('</svg>');
  return partes.join('\n');
}

(async () => {
  const saida = process.argv[3] || path.join(__dirname, (process.argv[2] || 'favetta') + '.png');
  const puppeteer = require('puppeteer-core');
  const chrome = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ].find(fs.existsSync);
  const navegador = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || chrome, headless: 'new' });
  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: mapa.largura * CELULA, height: mapa.altura * CELULA });
  await pagina.setContent(`<body style="margin:0">${svg()}</body>`);
  await pagina.screenshot({ path: saida });
  await navegador.close();
  console.log('Prévia salva em', saida);
})();
