// Encerrar conta pelo app: o botão fica abaixo de "Sair da conta", só libera com o e-mail digitado, recusa senha errada
// e, com tudo certo, apaga a conta e volta ao login. Prepara a conta pela API; depois usa só a tela. Rode também com DARK=1.
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_conta_${Date.now()}@teste.com`;
let passo = 0;

async function api(metodo, caminho, corpo, token) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
}

async function preparar() {
  const { corpo: sessao } = await api('POST', '/autenticacao/cadastro', { nome: 'Maria Souza', email, senha: 'senha1234' });
  const token = sessao.tokenDeAcesso;
  const { corpo: categorias } = await api('GET', '/categorias', null, token);
  const { corpo: lista } = await api('POST', '/listas', { competencia: '2026-11', origem: 'Zero' }, token);
  await api('POST', `/listas/${lista.resumo.id}/itens`, { nome: 'Arroz', categoriaId: categorias[0].id, unidade: 'Pacote', quantidade: 1 }, token);
  return token;
}

(async () => {
  const token = await preparar();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-conta-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 1300, deviceScaleFactor: 2 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}conta-${String(++passo).padStart(2, '0')}-${nome}.png`) });
  const texto = () => page.evaluate(() => document.body.innerText.replace(/\u00a0/g, ' '));
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  const esperarTexto = async (t, ms = 15000) => {
    const fim = Date.now() + ms;
    while (Date.now() < fim) {
      if ((await texto()).toLowerCase().includes(t.toLowerCase())) return;
      await pausa(250);
    }
    throw new Error(`não apareceu "${t}". Tela:\n${(await texto()).slice(0, 900)}`);
  };
  // Telas anteriores ficam montadas por baixo: vale o ÚLTIMO elemento com o texto exato.
  const clicar = async (t) => {
    await esperarTexto(t);
    const alvos = await page.$$(`xpath/.//*[normalize-space(text())="${t}"]`);
    if (alvos.length === 0) throw new Error(`Sem elemento "${t}"`);
    await alvos[alvos.length - 1].click();
    await pausa(450);
  };
  const digitar = async (rotulo, valor) => {
    await page.waitForSelector(`[aria-label="${rotulo}"]`, { timeout: 10000 });
    await page.click(`[aria-label="${rotulo}"]`, { clickCount: 3 });
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type(`[aria-label="${rotulo}"]`, valor);
  };
  const confere = (cond, msg) => {
    if (!cond) throw new Error('FALHOU: ' + msg);
    console.log('ok -', msg);
  };
  const botaoDesabilitado = (rotulo) =>
    page.evaluate((r) => {
      const botoes = [...document.querySelectorAll('[role=button]')].filter((b) => b.innerText.trim() === r);
      const botao = botoes[botoes.length - 1];
      return botao ? botao.getAttribute('aria-disabled') === 'true' : null;
    }, rotulo);

  try {
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');

    await clicar('Mais');
    await esperarTexto('Sair da conta');
    const mais = await texto();
    await foto('mais');
    confere(mais.indexOf('Encerrar conta') > mais.indexOf('Sair da conta'), '"Encerrar conta" fica abaixo de "Sair da conta"');

    await clicar('Encerrar conta');
    await esperarTexto('Isto apaga tudo e não tem volta.');
    await foto('folha');
    confere((await botaoDesabilitado('Encerrar conta e apagar tudo')) === true, 'o botão começa desabilitado');

    await digitar('Digite seu e-mail para confirmar', 'outro@teste.com');
    confere((await botaoDesabilitado('Encerrar conta e apagar tudo')) === true, 'e-mail diferente mantém o botão desabilitado');

    await digitar('Digite seu e-mail para confirmar', email.toUpperCase());
    confere((await botaoDesabilitado('Encerrar conta e apagar tudo')) === false, 'o e-mail certo (sem diferenciar caixa) libera o botão');

    await digitar('Senha', 'errada123');
    await clicar('Encerrar conta e apagar tudo');
    await esperarTexto('Senha incorreta.');
    await foto('senha-errada');
    const aindaEntra = await api('POST', '/autenticacao/login', { email, senha: 'senha1234' });
    confere(aindaEntra.status === 200, 'com a senha errada a conta continua existindo');

    await digitar('Senha', 'senha1234');
    await clicar('Encerrar conta e apagar tudo');
    await esperarTexto('Criar uma conta');
    await foto('login');
    const login = await api('POST', '/autenticacao/login', { email, senha: 'senha1234' });
    confere(login.status === 401, 'depois de encerrar, o login não existe mais');
    const antigo = await api('GET', '/categorias', null, token);
    confere(antigo.status === 401, 'o token antigo também deixa de valer');
    if (erros.length) throw new Error(erros.join('\n'));
    console.log('CONTA OK');
  } catch (e) {
    await foto('erro').catch(() => {});
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
