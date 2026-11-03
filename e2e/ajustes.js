// Ajustes de uso da lista: filtros em listas suspensas, aviso "incluir na lista padrão" e cancelar compra.
// Prepara a conta pela API e usa só a tela. Rode também com DARK=1.
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_ajustes_${Date.now()}@teste.com`;
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
  const agora = new Date();
  const competencia = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const base = (nome, categoria) => ({ nome, categoriaId: cat(categoria), unidade: 'Unidade', quantidade: 1 });
  // Arroz está na lista padrão; os outros só na lista do mês.
  await api('POST', '/modelo/itens', base('Arroz', 'Mercearia'), token);
  const lista = await api('POST', '/listas', { competencia, origem: 'Padrao' }, token);
  for (const [nome, categoria] of [['Frango', 'Açougue'], ['Pão francês', 'Padaria']]) {
    await api('POST', `/listas/${lista.resumo.id}/itens`, base(nome, categoria), token);
  }
  return { token };
}

(async () => {
  const { token } = await preparar();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-ajustes-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}ajustes-${String(++passo).padStart(2, '0')}-${nome}.png`) });
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
  const adicionarProduto = async (nome) => {
    await clicarRotulo('Adicionar produto');
    await digitar('Nome do produto', nome);
    await clicar('Mercearia', -1);
    await clicar('Adicionar', -1);
  };

  try {
    console.log('1) Entrar e abrir a lista');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    await clicar('Lista', -1);
    await esperarTexto('Frango');

    console.log('2) Filtro de categorias em lista suspensa (várias ao mesmo tempo)');
    let t = await texto();
    verificar(t.includes('Todas as categorias') && t.includes('Por categoria'), 'padrão: "Todas as categorias" e "Por categoria"');
    verificar(!t.includes('Minha ordem'), 'ordenações ficam recolhidas até abrir a lista');
    await clicarRotulo('Categorias: Todas as categorias');
    await foto('categorias-aberto');
    await clicar('Açougue');
    await clicar('Padaria');
    t = await texto();
    verificar(t.includes('2 categorias'), 'gatilho resume "2 categorias"');
    verificar(t.includes('Frango') && t.includes('Pão francês') && !t.includes('Arroz'), 'só as categorias marcadas aparecem');
    await foto('categorias-duas');
    await clicar('Todas as categorias');
    verificar((await texto()).includes('Arroz'), 'a primeira opção limpa o filtro');
    await clicarRotulo('Categorias: Todas as categorias'); // fecha

    console.log('3) Ordenação em lista suspensa');
    await clicarRotulo('Ordenar: Por categoria');
    await foto('ordem-aberta');
    await clicar('Por nome');
    t = await texto();
    verificar(t.includes('Todos os produtos'), 'ordenar por nome agrupa tudo num bloco');
    verificar(!t.includes('Minha ordem'), 'a lista fecha ao escolher a ordenação');
    await clicarRotulo('Ordenar: Por nome');
    await clicar('Por categoria');

    console.log('4) Produto novo pergunta se entra na lista padrão');
    await adicionarProduto('Biscoito');
    await esperarTexto('Incluir na lista padrão?');
    await foto('pergunta-padrao');
    await clicar('Não');
    await pausa(500);
    let modelo = await api('GET', '/modelo/itens', null, token);
    verificar(!modelo.some((i) => i.nome === 'Biscoito'), 'responder "Não" não inclui na lista padrão');
    await adicionarProduto('Macarrão');
    await esperarTexto('Incluir na lista padrão?');
    await clicar('Sim, incluir');
    await esperarTexto('incluído na lista padrão');
    modelo = await api('GET', '/modelo/itens', null, token);
    verificar(modelo.some((i) => i.nome === 'Macarrão' && i.categoriaNome === 'Mercearia'), 'responder "Sim" inclui na lista padrão');
    await adicionarProduto('arroz');
    await pausa(1200);
    verificar(!(await texto()).includes('Incluir na lista padrão?'), 'produto que já está na lista padrão (mesmo com maiúscula diferente) não pergunta');

    console.log('5) Cancelar compra pelo Início');
    await clicar('Início', -1);
    await esperarTexto('Continuar compra');
    await clicar('Cancelar compra');
    await esperarTexto('Toque de novo para apagar esta lista');
    await foto('cancelar-confirma');
    await clicar('Toque de novo para apagar esta lista');
    await esperarTexto('Criar lista do mês');
    verificar((await texto()).includes('Sem lista para'), 'Início volta para "Sem lista" (mês reiniciado)');
    verificar((await api('GET', '/listas', null, token)).length === 0, 'a lista saiu do histórico (API vazia)');
    await clicar('Lista', -1);
    await esperarTexto('Nenhuma lista em andamento');
    verificar(true, 'a aba Lista também ficou sem lista');
    await foto('apos-cancelar');

    console.log(erros.length ? '\nErros:\n' + erros.join('\n') : '\nSem erros no navegador.');
    console.log('Ajustes OK.');
  } catch (e) {
    await foto('ERRO').catch(() => {});
    console.error('\nERRO:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
