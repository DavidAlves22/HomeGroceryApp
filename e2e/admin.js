// Painel do administrador no navegador: admin vê números, atividade e contas; conta comum não vê o atalho e,
// se digitar /admin, recebe o aviso de acesso negado.
// Suba a API com Admin__Emails__0=admin@e2e.com (e Seguranca__TentativasDeAutenticacaoPorMinuto=100000).
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const EMAIL_ADMIN = process.env.ADMIN_EMAIL || 'admin@e2e.com';
const prefixo = process.env.DARK ? 'dark-' : '';

async function api(caminho, { metodo = 'GET', corpo, token } = {}) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

/** Cadastra (ou entra, se já existe) e devolve a sessão no formato que o app guarda. */
async function sessaoDe(nome, email) {
  try {
    return await api('/autenticacao/cadastro', {
      metodo: 'POST',
      corpo: { nome, email, senha: 'senha1234' },
    });
  } catch {
    return await api('/autenticacao/login', {
      metodo: 'POST',
      corpo: { email, senha: 'senha1234' },
    });
  }
}

(async () => {
  const sufixo = Date.now();
  const admin = await sessaoDe('Dono do App', EMAIL_ADMIN);
  const ana = await sessaoDe('Ana', `ana_${sufixo}@teste.com`);
  const bruno = await sessaoDe('Bruno', `bruno_${sufixo}@teste.com`);

  // Ana cria uma lista e compra um item, para o painel ter o que contar.
  const categorias = await api('/categorias', { token: ana.tokenDeAcesso });
  const lista = await api('/listas', {
    metodo: 'POST',
    token: ana.tokenDeAcesso,
    corpo: { competencia: '2026-11', origem: 'Zero', permitirDuplicada: true },
  });
  const item = await api(`/listas/${lista.resumo.id}/itens`, {
    metodo: 'POST',
    token: ana.tokenDeAcesso,
    corpo: { nome: 'Arroz', categoriaId: categorias[0].id, unidade: 'Pacote', quantidade: 1 },
  });
  await api(`/listas/${lista.resumo.id}/itens/${item.id}/comprado`, {
    metodo: 'PUT',
    token: ana.tokenDeAcesso,
    corpo: { comprado: true },
  });

  if (!admin.ehAdmin) throw new Error('A sessão do admin não veio com ehAdmin=true');
  if (ana.ehAdmin) throw new Error('Conta comum veio como admin');

  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-perfil-admin-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const erros = [];

  async function abrirComo(sessao, caminho, largura = 390, altura = 1500) {
    const page = await browser.newPage();
    await page.setViewport({ width: largura, height: altura, deviceScaleFactor: 2 });
    if (process.env.DARK)
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
    page.on('console', (m) => m.type() === 'error' && erros.push('console: ' + m.text()));
    await page.evaluateOnNewDocument(
      (s) => localStorage.setItem('homegrocery.sessao', JSON.stringify(s)),
      sessao,
    );
    await page.goto(BASE + caminho, { waitUntil: 'networkidle2' });
    return page;
  }
  const texto = (page) => page.evaluate(() => document.body.innerText.replace(/ /g, ' '));
  const esperar = async (page, t) => {
    try {
      await page.waitForFunction(
        (x) => document.body.innerText.replace(/ /g, ' ').includes(x),
        { timeout: 15000 },
        t,
      );
    } catch {
      await page.screenshot({
        path: path.join(PASTA, `${prefixo}admin-FALHA.png`),
        fullPage: true,
      });
      throw new Error(`Não apareceu "${t}". Tela atual:\n${(await texto(page)).slice(0, 800)}`);
    }
  };

  // 1) Admin: atalho em Mais, abre o painel.
  const pagAdmin = await abrirComo(admin, '/mais');
  await esperar(pagAdmin, 'Painel do administrador');
  await pagAdmin.screenshot({ path: path.join(PASTA, `${prefixo}admin-01-mais.png`) });
  await (
    await pagAdmin.$$('xpath/.//*[normalize-space(text())="Painel do administrador"]')
  )[0].click();
  await esperar(pagAdmin, 'contas no total');
  await esperar(pagAdmin, 'Atividade por dia');
  await esperar(pagAdmin, 'Bruno');
  const t = await texto(pagAdmin);
  for (const esperado of [
    'Usuários',
    'ativas nas últimas 24 h',
    'Uso do app',
    'itens comprados de',
    'Contas',
    'Ana',
    'Dono do App',
    'Sozinho(a)',
  ])
    if (!t.includes(esperado)) throw new Error(`Painel sem "${esperado}":\n${t.slice(0, 1500)}`);
  await pagAdmin.screenshot({
    path: path.join(PASTA, `${prefixo}admin-02-painel.png`),
    fullPage: true,
  });

  // 2) Troca de série e de janela mexe no gráfico (legenda do último dia).
  await (await pagAdmin.$$('xpath/.//*[normalize-space(text())="Itens comprados"]'))[0].click();
  await (await pagAdmin.$$('xpath/.//*[normalize-space(text())="7 dias"]'))[0].click();
  await esperar(pagAdmin, 'em 7 dias');
  await pagAdmin.screenshot({
    path: path.join(PASTA, `${prefixo}admin-03-7dias.png`),
    fullPage: true,
  });

  // 3) Conta comum: sem atalho; /admin mostra acesso negado.
  const pagAna = await abrirComo(ana, '/mais', 390, 900);
  await esperar(pagAna, 'Alterar nome');
  if ((await texto(pagAna)).includes('Painel do administrador'))
    throw new Error('Conta comum viu o atalho do painel');
  await pagAna.close();
  // Sessão nova: a primeira já foi trocada pelo app (o token de renovação só vale uma vez).
  const anaDeNovo = await api('/autenticacao/login', {
    metodo: 'POST',
    corpo: { email: ana.usuario.email, senha: 'senha1234' },
  });
  const pagNegado = await abrirComo(anaDeNovo, '/admin', 390, 900);
  await esperar(pagNegado, 'não tem acesso ao painel');
  await pagNegado.screenshot({ path: path.join(PASTA, `${prefixo}admin-04-negado.png`) });

  // 4) Tela larga (computador).
  const adminDeNovo = await api('/autenticacao/login', {
    metodo: 'POST',
    corpo: { email: EMAIL_ADMIN, senha: 'senha1234' },
  });
  const pagLarga = await abrirComo(adminDeNovo, '/admin', 1280, 900);
  await esperar(pagLarga, 'contas no total');
  await pagLarga.screenshot({
    path: path.join(PASTA, `${prefixo}admin-05-larga.png`),
    fullPage: true,
  });

  await browser.close();
  const relevantes = erros.filter((e) => !/403|favicon|Failed to load resource/i.test(e));
  if (relevantes.length) throw new Error('Erros no navegador:\n' + relevantes.join('\n'));
  console.log('OK: painel do administrador');
})().catch((e) => {
  console.error('FALHOU:', e.message);
  process.exit(1);
});
