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
  const emailDeBruno = `bruno_${sufixo}@teste.com`;
  const bruno = await sessaoDe('Bruno', emailDeBruno);

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

  async function abrirComo(sessao, caminho, largura = 390, altura = 4600) {
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
  await esperar(pagAdmin, 'Uso dos recursos');
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
    'Retenção',
    'Funil de uso',
    'Criaram uma lista',
    'Gasto nas compras finalizadas',
    'Mais comprados',
    'Arroz',
    'Uso dos recursos',
    'Mapearam um mercado',
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

  // 2b) "Usuário desde" aparece em cada conta; o administrador não tem botão de bloqueio.
  const hoje = new Date(Date.now() - 3 * 3_600_000);
  const dataDeHoje = [
    String(hoje.getUTCDate()).padStart(2, '0'),
    String(hoje.getUTCMonth() + 1).padStart(2, '0'),
    hoje.getUTCFullYear(),
  ].join('/');
  const apos2b = await texto(pagAdmin);
  if (!apos2b.includes(`Usuário desde ${dataDeHoje}`))
    throw new Error(`Faltou "Usuário desde ${dataDeHoje}":\n${apos2b.slice(0, 1500)}`);
  if (!apos2b.includes('Administrador (não pode ser bloqueado)'))
    throw new Error('A conta do administrador deveria avisar que não pode ser bloqueada');

  // 2c) Bloquear Bruno: primeiro toque pede confirmação, segundo bloqueia na hora.
  // Acha o botão da linha cujo e-mail é o de Bruno e o marca para o clique de verdade do mouse.
  async function clicarNoBotaoDaConta(page, email, prefixoDoRotulo) {
    const achou = await page.evaluate(
      (mail, inicio) => {
        document.querySelectorAll('[data-alvo]').forEach((e) => e.removeAttribute('data-alvo'));
        const botoes = [...document.querySelectorAll('[aria-label]')].filter((b) =>
          b.getAttribute('aria-label').startsWith(inicio),
        );
        for (const botao of botoes) {
          let no = botao.parentElement;
          for (let i = 0; i < 5 && no; i++, no = no.parentElement) {
            if (no.innerText && no.innerText.includes(mail)) {
              botao.setAttribute('data-alvo', '1');
              return true;
            }
          }
        }
        return false;
      },
      email,
      prefixoDoRotulo,
    );
    if (!achou) throw new Error(`Sem botão "${prefixoDoRotulo}" para ${email}`);
    await page.click('[data-alvo="1"]');
  }
  const chamar = async (caminho, token) => {
    try {
      await api(caminho, { token });
      return { status: 200, mensagem: '' };
    } catch (e) {
      return { status: Number(/-> (\d+)/.exec(e.message)?.[1]), mensagem: e.message };
    }
  };

  if ((await chamar('/categorias', bruno.tokenDeAcesso)).status !== 200)
    throw new Error('Bruno deveria acessar antes do bloqueio');
  await clicarNoBotaoDaConta(pagAdmin, emailDeBruno, 'Bloquear ');
  await esperar(pagAdmin, 'Confirmar bloqueio');
  await pagAdmin.screenshot({
    path: path.join(PASTA, `${prefixo}admin-03b-confirmar.png`),
    fullPage: true,
  });
  if ((await chamar('/categorias', bruno.tokenDeAcesso)).status !== 200)
    throw new Error('O primeiro toque não pode bloquear (só pede confirmação)');
  await clicarNoBotaoDaConta(pagAdmin, emailDeBruno, 'Bloquear ');
  await esperar(pagAdmin, 'foi bloqueada');
  await esperar(pagAdmin, 'bloqueada em');
  await pagAdmin.screenshot({
    path: path.join(PASTA, `${prefixo}admin-03c-bloqueada.png`),
    fullPage: true,
  });

  // O token que Bruno já tinha cai na hora, a renovação é recusada e o login explica o motivo.
  if ((await chamar('/categorias', bruno.tokenDeAcesso)).status !== 401)
    throw new Error('O token antigo de Bruno deveria dar 401 depois do bloqueio');
  const renovar = await fetch(API + '/autenticacao/renovar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenDeRenovacao: bruno.tokenDeRenovacao }),
  });
  if (renovar.status !== 401) throw new Error(`Renovar deveria dar 401, deu ${renovar.status}`);
  const loginBloqueado = await fetch(API + '/autenticacao/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailDeBruno, senha: 'senha1234' }),
  });
  const corpoDoLogin = await loginBloqueado.text();
  if (loginBloqueado.status !== 401 || !corpoDoLogin.includes('bloqueada'))
    throw new Error(`Login de conta bloqueada: ${loginBloqueado.status} ${corpoDoLogin}`);

  // Desbloquear vale no primeiro toque.
  await clicarNoBotaoDaConta(pagAdmin, emailDeBruno, 'Desbloquear ');
  await esperar(pagAdmin, 'foi liberada');
  const loginLiberado = await fetch(API + '/autenticacao/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailDeBruno, senha: 'senha1234' }),
  });
  if (loginLiberado.status !== 200) throw new Error(`Login liberado deu ${loginLiberado.status}`);

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
