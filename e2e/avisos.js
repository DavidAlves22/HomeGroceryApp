// Avisos por push (Web Push) de verdade no Chrome: liga os avisos em Mais, confere que o servidor guardou a
// assinatura e que o aviso chega como notificação quando o app NÃO está à vista. Precisa de internet (o Chrome fala
// com o serviço de push do Google) e da API com Push__ChavePublica / Push__ChavePrivada (ver e2e/README.md).
const puppeteer = require('puppeteer-core');
const path = require('path');
const { execSync } = require('child_process');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_avisos_${Date.now()}@teste.com`;
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

const linhasNoBanco = (usuarioId) =>
  Number(
    execSync(
      `docker exec homegroceryapi-banco-1 psql -U homegrocery -d homegrocery -t -A -c "select count(*) from assinaturas_de_push where \\"UsuarioId\\" = '${usuarioId}'"`,
    )
      .toString()
      .trim(),
  );

(async () => {
  const sessao = await api('POST', '/autenticacao/cadastro', { nome: 'David Alves', email, senha: 'senha1234' });
  const token = sessao.tokenDeAcesso;
  const esposa = await api('POST', '/autenticacao/cadastro', { nome: 'Ana Souza', email: `ana_${email}`, senha: 'senha1234' });
  const convite = await api('POST', '/grupo/convites', null, token);
  const entrou = await api('POST', '/grupo/entrar', { codigo: convite.codigo }, esposa.tokenDeAcesso);
  const categorias = await api('GET', '/categorias', null, token);
  const agora = new Date();
  const competencia = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const lista = await api('POST', '/listas', { competencia, origem: 'Zero' }, token);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-avisos-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const contexto = browser.defaultBrowserContext();
  await contexto.overridePermissions(BASE, ['notifications']);
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `avisos-${String(++passo).padStart(2, '0')}-${nome}.png`) });
  const texto = () => page.evaluate(() => document.body.innerText.replace(/\u00a0/g, ' '));
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  const esperarTexto = async (t, ms = 20000) => {
    try {
      await page.waitForFunction((x) => document.body.innerText.replace(/\u00a0/g, ' ').toLowerCase().includes(x.toLowerCase()), { timeout: ms }, t);
    } catch {
      await foto('FALHA-' + t.replace(/\W+/g, '_').slice(0, 30));
      throw new Error(`Não apareceu "${t}". Tela:\n${(await texto()).slice(0, 700)}`);
    }
  };
  const clicar = async (t, ultimo = false) => {
    await esperarTexto(t);
    const alvos = await page.$$(`xpath/.//*[normalize-space(text())="${t}"]`);
    await alvos[ultimo ? alvos.length - 1 : 0].click();
    await pausa(500);
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

  try {
    console.log('1) Entrar e abrir Mais');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    // O service worker precisa estar ativo para assinar.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await clicar('Mais', true);
    await esperarTexto('Avisos neste aparelho');
    await foto('mais-avisos');

    console.log('2) Ligar os avisos neste aparelho');
    await clicar('Ligar avisos');
    await esperarTexto('Desligar avisos', 30000);
    verificar(linhasNoBanco(sessao.usuario.id) === 1, 'o servidor guardou a assinatura deste aparelho');
    await foto('avisos-ligados');

    // O Chrome leva alguns segundos para o serviço de push reconhecer a assinatura nova.
    await pausa(Number(process.env.ESPERA_PUSH_MS || 10000));
    console.log('3) A Ana pede um item com o app fora de vista: chega a notificação');
    const outra = await browser.newPage();
    await outra.goto('about:blank');
    await outra.bringToFront();
    await pausa(500);
    await api('POST', `/listas/${lista.resumo.id}/itens`, { nome: 'Café', categoriaId: categorias.find((c) => c.nome === 'Mercearia').id, unidade: 'Unidade', quantidade: 1 }, entrou.tokenDeAcesso);
    let notificacoes = [];
    for (let i = 0; i < 20 && notificacoes.length === 0; i++) {
      await pausa(1000);
      notificacoes = await page.evaluate(async () => {
        const r = await navigator.serviceWorker.ready;
        return (await r.getNotifications()).map((n) => ({ titulo: n.title, corpo: n.body }));
      });
    }
    console.log('   notificações:', JSON.stringify(notificacoes));
    verificar(notificacoes.some((n) => n.titulo === 'Ana pediu um item' && n.corpo === 'Café'), 'a notificação "Ana pediu um item: Café" chegou pelo push');

    console.log('4) Desligar os avisos');
    await page.bringToFront();
    await clicar('Desligar avisos');
    await esperarTexto('Ligar avisos');
    await pausa(500);
    verificar(linhasNoBanco(sessao.usuario.id) === 0, 'o servidor esqueceu a assinatura');

    console.log(erros.length ? '\nErros:\n' + erros.join('\n') : '\nSem erros no navegador.');
    console.log('Avisos OK.');
  } catch (e) {
    await foto('ERRO').catch(() => {});
    console.error('\nERRO:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
