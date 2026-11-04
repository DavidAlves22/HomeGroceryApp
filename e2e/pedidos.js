// Pedido de itens em família: "Pedir item (acabou em casa)" no Início e o aviso em tempo real na Lista quando
// outra pessoa adiciona um item ou finaliza a compra. Prepara duas contas na mesma família pela API.
// Rode também com DARK=1.
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_pedidos_${Date.now()}@teste.com`;
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
  const sessao = await api('POST', '/autenticacao/cadastro', { nome: 'David Alves', email, senha: 'senha1234' });
  const token = sessao.tokenDeAcesso;
  const esposa = await api('POST', '/autenticacao/cadastro', { nome: 'Ana Souza', email: `ana_${email}`, senha: 'senha1234' });
  const convite = await api('POST', '/grupo/convites', null, token);
  const entrou = await api('POST', '/grupo/entrar', { codigo: convite.codigo }, esposa.tokenDeAcesso);

  const categorias = await api('GET', '/categorias', null, token);
  const cat = (nome) => categorias.find((c) => c.nome === nome).id;
  const base = (nome, categoria) => ({ nome, categoriaId: cat(categoria), unidade: 'Unidade', quantidade: 1 });
  // "Leite" existe no cadastro (veio da lista padrão), mas não está na lista do mês.
  await api('POST', '/modelo/itens', base('Leite', 'Laticínios'), token);
  const agora = new Date();
  const competencia = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const lista = await api('POST', '/listas', { competencia, origem: 'Zero' }, token);
  await api('POST', `/listas/${lista.resumo.id}/itens`, base('Arroz', 'Mercearia'), token);
  return { token, tokenDela: entrou.tokenDeAcesso, listaId: lista.resumo.id, cat };
}

(async () => {
  const { token, tokenDela, listaId, cat } = await preparar();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-pedidos-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}pedidos-${String(++passo).padStart(2, '0')}-${nome}.png`) });
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
  // indice -1 = o último (telas anteriores continuam montadas por baixo e repetem textos).
  const clicar = async (t, indice = 0) => {
    await esperarTexto(t);
    const alvos = await page.$$(`xpath/.//*[normalize-space(text())="${t}"]`);
    const alvo = indice < 0 ? alvos[alvos.length - 1] : alvos[indice];
    if (!alvo) throw new Error(`Sem elemento "${t}"`);
    await alvo.click();
    await pausa(400);
  };
  const clicarRotulo = async (rotulo) => {
    await page.waitForSelector(`[aria-label="${rotulo}"]`, { timeout: 10000 });
    await page.click(`[aria-label="${rotulo}"]`);
    await pausa(400);
  };
  const digitar = async (rotulo, valor, ultimo = false) => {
    await page.waitForSelector(`[aria-label="${rotulo}"]`, { timeout: 10000 });
    const campos = await page.$$(`[aria-label="${rotulo}"]`);
    const campo = ultimo ? campos[campos.length - 1] : campos[0];
    await campo.click({ clickCount: 3 });
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await campo.type(valor);
  };
  const verificar = (cond, msg) => {
    if (!cond) throw new Error('FALHOU: ' + msg);
    console.log('  ok -', msg);
  };
  const itens = async () => (await api('GET', `/listas/${listaId}`, null, token)).itens.map((i) => i.nome);

  try {
    console.log('1) Entrar e abrir a lista');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    await esperarTexto('Pedir item (acabou em casa)');
    await foto('inicio-com-botao');

    console.log('2) Pedir item pelo Início: um toque no que acabou');
    await clicar('Pedir item (acabou em casa)');
    await esperarTexto('Toque no que acabou');
    await digitar('Buscar produto', 'leit', true);
    await esperarTexto('Leite');
    await foto('pedir-busca');
    await clicarRotulo('Pedir Leite');
    await esperarTexto('Na lista');
    verificar((await itens()).includes('Leite'), 'o Leite entrou na lista com um toque');

    console.log('3) Produto que não existe abre o formulário completo');
    await digitar('Buscar produto', 'Biscoito', true);
    await esperarTexto('Pedir “Biscoito” como produto novo');
    await foto('pedir-novo');
    await clicar('Pedir “Biscoito” como produto novo');
    await esperarTexto('Pedir produto novo');
    await clicar('Mercearia', -1);
    await clicar('Pedir', -1);
    await pausa(800);
    verificar((await itens()).includes('Biscoito'), 'o produto novo entrou na lista com a categoria escolhida');

    console.log('4) A Ana adiciona um item: aviso em tempo real e selo "Novo" na Lista');
    await clicar('Lista', -1);
    await esperarTexto('Arroz');
    await pausa(1500);
    await api('POST', `/listas/${listaId}/itens`, { nome: 'Café', categoriaId: cat('Mercearia'), unidade: 'Unidade', quantidade: 1 }, tokenDela);
    await esperarTexto('Ana pediu: Café', 15000);
    await esperarTexto('Novo · pedido por Ana');
    await foto('aviso-pedido');
    verificar(true, 'aviso "Ana pediu: Café" e selo "Novo · pedido por Ana"');
    // Marcar o item tira o selo.
    await clicarRotulo('Café, 1 unidade');
    await pausa(500);
    verificar(!(await texto()).includes('Novo · pedido por Ana'), 'ao marcar o item, o selo "Novo" some');

    console.log('5) A Ana finaliza a compra: aviso para quem está na lista');
    await api('POST', `/listas/${listaId}/finalizar`, null, tokenDela);
    await esperarTexto('finalizada por outra pessoa', 15000);
    verificar(true, 'aviso de compra finalizada por outra pessoa');
    await foto('aviso-finalizada');

    console.log(erros.length ? '\nErros:\n' + erros.join('\n') : '\nSem erros no navegador.');
    console.log('Pedidos OK.');
  } catch (e) {
    await foto('ERRO').catch(() => {});
    console.error('\nERRO:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
