// Botão voltar do navegador/celular: cada tela entra no histórico e o voltar retrocede para a tela anterior.
// Também confere que o voltar com mapa não salvo pede confirmação (como a seta do topo) e que abrir
// um endereço direto (recarregar a página) funciona.
const puppeteer = require('puppeteer-core');

const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_voltar_${Date.now()}@teste.com`;

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

(async () => {
  const sessao = await api('POST', '/autenticacao/cadastro', { nome: 'Maria Souza', email, senha: 'senha1234' });
  const token = sessao.tokenDeAcesso;
  const agora = new Date();
  await api('POST', '/listas', { competencia: `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`, origem: 'Zero' }, token);
  const loja = await api('POST', '/lojas', { nome: 'Mercado A', cidade: 'Araras' }, token);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-voltar-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const texto = () => page.evaluate(() => document.body.innerText.replace(/\u00a0/g, ' '));
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  const esperarTexto = (t, ms = 15000) =>
    page.waitForFunction((x) => document.body.innerText.replace(/\u00a0/g, ' ').toLowerCase().includes(x.toLowerCase()), { timeout: ms }, t);
  const clicar = async (t, ultimo = false) => {
    await esperarTexto(t);
    const alvos = await page.$$(`xpath/.//*[normalize-space(text())="${t}"]`);
    await alvos[ultimo ? alvos.length - 1 : 0].click();
    await pausa(500);
  };
  const caminho = () => new URL(page.url()).pathname;
  const verificar = (cond, msg) => {
    if (!cond) throw new Error('FALHOU: ' + msg);
    console.log('  ok -', msg);
  };
  const voltar = async () => {
    await page.goBack();
    await pausa(600);
  };

  try {
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await page.type('[aria-label="E-mail"]', email);
    await page.type('[aria-label="Senha"]', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');

    console.log('1) Trocar de aba e voltar');
    await clicar('Mais', true);
    await esperarTexto('Grupo familiar');
    verificar(caminho() === '/mais', `a aba Mais tem endereço próprio (${caminho()})`);
    await voltar();
    await esperarTexto('Olá');
    verificar(caminho() === '/', `o voltar retorna ao Início (${caminho()})`);

    console.log('2) Abrir telas por cima e voltar uma a uma');
    await clicar('Mais', true);
    await clicar('Mercados');
    await esperarTexto('Cada mercado tem o seu próprio mapa');
    verificar(caminho() === '/mercados', `Mercados abre em /mercados (${caminho()})`);
    await clicar('Editar mapa', true);
    await esperarTexto('Arraste uma seção para mover');
    verificar(caminho() === `/mercados/${loja.id}/mapa`, `o editor abre em /mercados/{id}/mapa (${caminho()})`);

    console.log('3) Voltar com mapa não salvo pede confirmação');
    await clicar('Adicionar seção');
    await voltar();
    await esperarTexto('Há alterações que não foram salvas');
    verificar(caminho().endsWith('/mapa'), 'continua no editor e mostra o aviso');
    await clicar('Descartar e sair');
    await esperarTexto('Cada mercado tem o seu próprio mapa');
    verificar(caminho() === '/mercados', `descartar leva à lista de mercados (${caminho()})`);

    console.log('4) Voltar das telas até a aba de origem');
    await voltar();
    await esperarTexto('Grupo familiar');
    verificar(caminho() === '/mais', `volta para Mais (${caminho()})`);

    console.log('5) Abrir um endereço direto (recarregar a página)');
    await page.goto(`${BASE}/mercados`, { waitUntil: 'networkidle2' });
    await esperarTexto('Cada mercado tem o seu próprio mapa');
    verificar(true, 'abrir /mercados direto carrega a tela certa');

    verificar(erros.length === 0, 'nenhum erro no console: ' + erros.join(' | '));
    console.log('\nTUDO OK');
  } catch (e) {
    console.error('\nERRO:', e.message);
    console.error('Tela:', (await texto()).slice(0, 500), '\nURL:', page.url());
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
