// Zoom do editor de mapa: pinça de dois dedos (toque simulado), mover a visão, arrastar seção com zoom
// e os botões. Prepara a conta e um mercado pela API e usa só a tela. Rode também com DARK=1.
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_zoom_${Date.now()}@teste.com`;
let passo = 0;

async function api(metodo, caminho, corpo, token) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

async function preparar() {
  const sessao = await api('POST', '/autenticacao/cadastro', { nome: 'Maria Souza', email, senha: 'senha1234' });
  const token = sessao.tokenDeAcesso;
  const categorias = await api('GET', '/categorias', null, token);
  const cat = (nome) => categorias.find((c) => c.nome === nome).id;
  const area = (x, y, largura, altura) => ({ x, y, largura, altura });
  const loja = await api('POST', '/lojas', { nome: 'Mercado A', cidade: 'Araras' }, token);
  const salvo = await api('PUT', `/lojas/${loja.id}/mapa`, {
    nome: 'Mercado A', largura: 34, altura: 40, entrada: { x: 16, y: 37 }, caixas: area(24, 34, 7, 2), versao: loja.versao,
    secoes: [
      { nome: 'Açougue', dividida: false, area: area(3, 3, 10, 3), categoriasLadoA: [cat('Açougue')], categoriasLadoB: [] },
      { nome: 'Padaria', dividida: false, area: area(16, 3, 10, 3), categoriasLadoA: [cat('Padaria')], categoriasLadoB: [] },
    ],
  }, token);
  return { token, lojaId: salvo.id };
}

(async () => {
  const { token, lojaId } = await preparar();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-zoom-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}zoom-${String(++passo).padStart(2, '0')}-${nome}.png`) });
  const texto = () => page.evaluate(() => document.body.innerText.replace(/\u00a0/g, ' '));
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  const esperarTexto = async (t, ms = 15000) => {
    try {
      await page.waitForFunction((x) => document.body.innerText.replace(/\u00a0/g, ' ').toLowerCase().includes(x.toLowerCase()), { timeout: ms }, t);
    } catch {
      await foto('FALHA-' + t.replace(/\W+/g, '_').slice(0, 30));
      throw new Error(`Não apareceu "${t}". Tela:\n${(await texto()).slice(0, 900)}`);
    }
  };
  const clicar = async (t, ultimo = false) => {
    await esperarTexto(t);
    const alvos = await page.$$(`xpath/.//*[normalize-space(text())="${t}"]`);
    if (!alvos.length) throw new Error(`Sem elemento "${t}"`);
    await alvos[ultimo ? alvos.length - 1 : 0].click();
    await pausa(400);
  };
  // Com zoom o botão vira "Ver tudo · 4,0×": procura pelo começo do texto.
  const clicarComeco = async (t) => {
    await esperarTexto(t);
    const alvos = await page.$$(`xpath/.//*[starts-with(normalize-space(text()), "${t}")]`);
    await alvos[alvos.length - 1].click();
    await pausa(400);
  };
  const digitar = async (rotulo, valor) => {
    await page.waitForSelector(`[aria-label="${rotulo}"]`, { timeout: 10000 });
    await page.click(`[aria-label="${rotulo}"]`, { clickCount: 3 });
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type(`[aria-label="${rotulo}"]`, valor);
  };
  const verificar = (cond, msg) => {
    if (!cond) throw new Error('FALHOU: ' + msg);
    console.log('  ok -', msg);
  };

  // O mapa do editor é o último svg com a viewBox "x y w h" (o zoom muda a viewBox, o tamanho na tela não).
  const janela = () =>
    page.evaluate(() => {
      const svgs = [...document.querySelectorAll('svg[viewBox]')].filter((s) => s.getBoundingClientRect().width > 200);
      const svg = svgs[svgs.length - 1];
      const [x, y, w] = svg.getAttribute('viewBox').split(' ').map(Number);
      const r = svg.getBoundingClientRect();
      return { x: x / 10, y: y / 10, larguraVisivel: w / 10, escala: 34 / (w / 10), tela: { x: r.x, y: r.y, w: r.width, h: r.height } };
    });
  // Dois dedos: cada ponto é { x, y } na página. Move de 'de' para 'para' em passos, como um pinça de verdade.
  const dedos = async (de, para, passos = 8) => {
    const cdp = await page.createCDPSession();
    const enviar = (tipo, pts) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })) });
    await enviar('touchStart', de);
    for (let i = 1; i <= passos; i++) {
      const f = i / passos;
      await enviar('touchMove', de.map((p, k) => ({ x: p.x + (para[k].x - p.x) * f, y: p.y + (para[k].y - p.y) * f })));
      await pausa(16);
    }
    await enviar('touchEnd', []);
    await pausa(300);
    await cdp.detach();
  };
  const umDedo = async (de, para, passos = 8) => {
    const cdp = await page.createCDPSession();
    const enviar = (tipo, pts) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: 1 })) });
    await enviar('touchStart', [de]);
    for (let i = 1; i <= passos; i++) {
      await enviar('touchMove', [{ x: de.x + (para.x - de.x) * (i / passos), y: de.y + (para.y - de.y) * (i / passos) }]);
      await pausa(16);
    }
    await enviar('touchEnd', []);
    await pausa(300);
    await cdp.detach();
  };

  try {
    console.log('1) Entrar e abrir o editor do mapa');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    await clicar('Mais', true);
    await clicar('Mercados');
    await esperarTexto('Cada mercado tem o seu próprio mapa');
    await clicar('Editar mapa', true);
    await esperarTexto('Mapa travado');
    await page.evaluate(() => window.scrollTo(0, 0));
    let j = await janela();
    verificar(j.escala === 1, 'abre com o mapa inteiro (sem zoom)');
    await foto('editor-sem-zoom');

    console.log('2) Pinça de dois dedos aproxima o mapa');
    const meio = { x: j.tela.x + j.tela.w * 0.5, y: j.tela.y + j.tela.h * 0.15 };
    await page.evaluate((y) => window.scrollTo(0, 0), 0);
    await dedos(
      [{ x: meio.x - 20, y: meio.y }, { x: meio.x + 20, y: meio.y }],
      [{ x: meio.x - 80, y: meio.y }, { x: meio.x + 80, y: meio.y }],
    );
    j = await janela();
    verificar(j.escala > 2.5 && j.escala <= 4, `o pinça aproximou (escala ${j.escala.toFixed(2)}x)`);
    verificar((await texto()).includes('Ver tudo ·'), 'o botão "Ver tudo" mostra o zoom atual');
    await foto('editor-com-zoom');
    const aposPinca = j;

    console.log('3) Dois dedos movem a visão');
    const centro = { x: j.tela.x + j.tela.w / 2, y: j.tela.y + j.tela.h / 2 };
    await dedos(
      [{ x: centro.x - 20, y: centro.y }, { x: centro.x + 20, y: centro.y }],
      [{ x: centro.x + 40, y: centro.y + 60 }, { x: centro.x + 80, y: centro.y + 60 }],
    );
    j = await janela();
    verificar(j.x < aposPinca.x && j.y < aposPinca.y, `arrastar com dois dedos mostrou outra parte do mapa (x ${aposPinca.x.toFixed(1)} → ${j.x.toFixed(1)})`);
    verificar(Math.abs(j.escala - aposPinca.escala) < 0.05, 'mover não mudou o zoom');

    console.log('4) Um dedo no vazio também move a visão quando há zoom');
    const antes = j;
    await umDedo({ x: centro.x + 40, y: centro.y + 40 }, { x: centro.x - 20, y: centro.y - 20 });
    j = await janela();
    verificar(j.x > antes.x || j.y > antes.y, 'um dedo no vazio moveu a visão');

    console.log('5) Arrastar uma seção com zoom funciona e acerta a célula (depois de destravar)');
    await page.evaluate(() => document.querySelector('[aria-label="Destravar a edição do mapa"]').click());
    await esperarTexto('Arraste uma seção para mover');
    await clicarComeco('Ver tudo');
    for (let i = 0; i < 3; i++) await clicar('Aproximar', true);
    j = await janela();
    verificar(j.escala > 2.5, `os botões aproximam (${j.escala.toFixed(2)}x)`);
    await foto('editor-botoes');
    await clicarComeco('Ver tudo');
    j = await janela();
    verificar(j.escala === 1 && j.x === 0 && j.y === 0, '"Ver tudo" volta ao mapa inteiro');
    // Com zoom ~2x perto do canto superior esquerdo, a Padaria (x 16..25) ainda cabe; arrasta 2 células para baixo.
    await clicar('Aproximar', true);
    await clicar('Aproximar', true);
    // O zoom dos botões é no centro do mapa (vazio): um dedo no vazio leva a visão para o topo, onde está a Padaria.
    j = await janela();
    await umDedo({ x: j.tela.x + j.tela.w / 2, y: j.tela.y + 40 }, { x: j.tela.x + j.tela.w / 2, y: j.tela.y + j.tela.h - 10 }, 12);
    j = await janela();
    verificar(j.y < 1.5, `a visão foi para o topo do mapa (y=${j.y.toFixed(1)})`);
    const px = (j.tela.w / 34) * j.escala;
    const padaria = { x: j.tela.x + (20.5 - j.x) * px, y: j.tela.y + (4 - j.y) * px };
    verificar(padaria.x > j.tela.x && padaria.x < j.tela.x + j.tela.w && padaria.y > j.tela.y && padaria.y < j.tela.y + j.tela.h, 'a Padaria está visível no zoom');
    await umDedo(padaria, { x: padaria.x, y: padaria.y + 2 * px });
    await esperarTexto('Salvar mapa');
    await clicar('Salvar mapa');
    await esperarTexto('Mapa salvo');
    const salvo = await api('GET', `/lojas/${lojaId}`, null, token);
    const p = salvo.secoes.find((s) => s.nome === 'Padaria');
    verificar(p.area.y === 5 && p.area.x === 16, `com zoom, a Padaria foi 2 células para baixo (y=${p.area.y}, esperado 5)`);

    console.log(erros.length ? '\nErros:\n' + erros.join('\n') : '\nSem erros no navegador.');
    console.log('Zoom OK.');
  } catch (e) {
    await foto('ERRO').catch(() => {});
    console.error('\nERRO:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
