// Formulário de produto: quantidades e preços lado a lado, sem o título "Valores (por unidade...)", listas suspensas
// de unidade e categoria e o teclado numérico do app (digitar, cancelar, calculadora). Prepara a conta pela API.
// Rode também com DARK=1.
const puppeteer = require('puppeteer-core');
const path = require('path');
const { preencherDinheiro, preencherQuantidade } = require('./campos');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_form_${Date.now()}@teste.com`;
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
  const categorias = await api('GET', '/categorias', null, token);
  const agora = new Date();
  const competencia = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const lista = await api('POST', '/listas', { competencia, origem: 'Zero' }, token);
  const feijao = await api('POST', `/listas/${lista.resumo.id}/itens`, { nome: 'Feijão', categoriaId: categorias.find((c) => c.nome === 'Mercearia').id, unidade: 'Kg', quantidade: 2 }, token);
  return { token, listaId: lista.resumo.id, itemId: feijao.id, hortifruti: categorias.find((c) => c.nome === 'Hortifruti').id };
}

(async () => {
  const { token, listaId, itemId, hortifruti } = await preparar();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-form-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}formulario-${String(++passo).padStart(2, '0')}-${nome}.png`) });
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
  const clicar = async (t, indice = 0) => {
    await esperarTexto(t);
    const alvos = await page.$$(`xpath/.//*[normalize-space(text())="${t}"]`);
    const alvo = indice < 0 ? alvos[alvos.length - 1] : alvos[indice];
    await alvo.click();
    await pausa(400);
  };
  const clicarRotulo = async (rotulo) => {
    await page.waitForSelector(`[aria-label="${rotulo}"]`, { timeout: 10000 });
    const el = await page.$$(`[aria-label="${rotulo}"]`);
    await el[el.length - 1].click();
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
  // Posição na tela de um controle pelo começo do aria-label (o último, que é o da folha aberta).
  const caixa = (prefixo) =>
    page.evaluate((x) => {
      const els = [...document.querySelectorAll(`[aria-label^="${x}"]`)];
      const r = els[els.length - 1].getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }, prefixo);
  const rotuloDe = (prefixo) =>
    page.evaluate((x) => {
      const els = [...document.querySelectorAll(`[aria-label^="${x}"]`)];
      return els[els.length - 1].getAttribute('aria-label');
    }, prefixo);
  const teclas = async (...nomes) => {
    for (const n of nomes) await clicarRotulo(n);
  };
  const visor = () => rotuloDe('Valor digitado:');

  try {
    console.log('1) Abrir o formulário de edição do produto');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    await clicar('Lista', -1);
    await esperarTexto('Feijão');
    await clicarRotulo('Editar Feijão');
    await esperarTexto('Editar produto');
    await foto('formulario');

    console.log('2) Layout: quantidades e preços lado a lado, sem o título "Valores (por unidade...)"');
    const t = await texto();
    verificar(!t.includes('Valores (por unidade'), 'o título "Valores (por unidade, em reais)" foi removido');
    const q = await caixa('Quantidade,');
    const qc = await caixa('Qtd. comprada,');
    verificar(Math.abs(q.y - qc.y) < 2 && qc.x > q.x + q.w - 1, 'Quantidade e Qtd. comprada dividem a mesma linha (comprada à direita)');
    const pe = await caixa('Preço estimado,');
    const pp = await caixa('Preço pago,');
    verificar(Math.abs(pe.y - pp.y) < 2 && pp.x > pe.x, 'Preço estimado e Preço pago dividem a mesma linha');
    const un = await caixa('Unidade:');
    const ca = await caixa('Categoria:');
    verificar(Math.abs(un.y - ca.y) < 2 && ca.x > un.x, 'Unidade e Categoria dividem a linha, como listas suspensas');
    verificar((await rotuloDe('Unidade:')) === 'Unidade: kg' && (await rotuloDe('Categoria:')) === 'Categoria: Mercearia', 'as listas começam com o valor do produto (kg, Mercearia)');

    console.log('3) Listas suspensas de unidade e categoria');
    await clicarRotulo('Unidade: kg');
    await esperarTexto('pacote');
    await foto('combo-unidade');
    verificar((await texto()).includes('litro') && (await texto()).includes('caixa'), 'a lista mostra todas as unidades');
    await clicar('pacote', -1);
    verificar((await rotuloDe('Unidade:')) === 'Unidade: pacote', 'escolher fecha a lista e mostra a unidade escolhida');
    verificar((await rotuloDe('Quantidade,')) === 'Quantidade, 2 pacote', 'a quantidade passa a mostrar a unidade nova');
    await clicarRotulo('Categoria: Mercearia');
    await esperarTexto('Hortifruti');
    await foto('combo-categoria');
    await clicar('Hortifruti', -1);
    verificar((await rotuloDe('Categoria:')) === 'Categoria: Hortifruti', 'a categoria foi escolhida pela lista');

    console.log('4) Teclado numérico: quantidade com vírgula e calculadora');
    await clicarRotulo('Quantidade, 2 pacote');
    await esperarTexto('Concluído');
    await foto('teclado-quantidade');
    verificar((await visor()).includes('2 pacote'), 'o teclado abre com a quantidade atual no visor');
    await teclas('Tecla 1', 'Tecla vírgula', 'Tecla 5');
    verificar((await visor()).includes('1,5 pacote'), 'digitar 1 , 5 mostra "1,5"');
    await teclas('Operação +', 'Tecla 2');
    await clicar('Concluído', -1);
    verificar((await rotuloDe('Quantidade,')) === 'Quantidade, 3,5 pacote', 'a conta 1,5 + 2 vira 3,5 ao concluir');

    console.log('5) Teclado de preço: da direita para a esquerda, cancelar e véu não gravam');
    await clicarRotulo('Preço pago, vazio');
    await teclas('Tecla 1', 'Tecla 2', 'Tecla 3', 'Tecla 4');
    verificar((await visor()).includes('12,34'), 'digitar 1-2-3-4 mostra R$ 12,34');
    await clicar('Cancelar', -1);
    verificar((await rotuloDe('Preço pago,')) === 'Preço pago, vazio', 'Cancelar não grava o valor');
    await clicarRotulo('Preço pago, vazio');
    await teclas('Tecla 7');
    await clicarRotulo('Fechar o teclado');
    verificar((await rotuloDe('Preço pago,')) === 'Preço pago, vazio', 'tocar fora do teclado também não grava');
    await preencherDinheiro(page, 'Preço pago', '0,50');
    verificar((await rotuloDe('Preço pago,')).replace(/\u00a0/g, ' ') === 'Preço pago, R$ 0,50', 'digitar 5-0 vale R$ 0,50');
    await clicarRotulo('Preço estimado, vazio');
    await teclas('Tecla 1', 'Tecla 0', 'Tecla 0', 'Tecla 0', 'Operação ×', 'Tecla 3', 'Igual');
    verificar((await visor()).includes('30,00'), '10,00 × 3 = 30,00 no visor');
    await foto('teclado-preco');
    await clicar('Concluído', -1);
    verificar((await rotuloDe('Preço estimado,')).replace(/\u00a0/g, ' ') === 'Preço estimado, R$ 30,00', 'o resultado da conta vai para o campo');
    await preencherQuantidade(page, 'Qtd. comprada', '3');
    await foto('formulario-preenchido');

    console.log('6) Salvar grava tudo');
    await clicar('Salvar', -1);
    await pausa(1200);
    const lista = await api('GET', `/listas/${listaId}`, null, token);
    const item = lista.itens.find((i) => i.id === itemId);
    verificar(item.quantidade === 3.5 && item.unidade === 'Pacote', `quantidade 3,5 e unidade pacote (${item.quantidade} ${item.unidade})`);
    verificar(item.categoriaId === hortifruti, 'categoria Hortifruti');
    verificar(item.precoUnitario === 0.5 && item.precoEstimado === 30 && item.quantidadeComprada === 3, 'preço pago 0,50, estimado 30,00 e comprada 3');

    console.log('7) O voltar do navegador fecha só a folha de cima');
    const abrir = async (prefixo) => {
      const els = await page.$$(`[aria-label^="${prefixo}"]`);
      await els[els.length - 1].click();
      await pausa(400);
    };
    const voltar = async () => {
      await page.evaluate(() => history.back());
      await pausa(600);
    };
    await clicarRotulo('Editar Feijão');
    await esperarTexto('Editar produto');
    await abrir('Preço pago,');
    await esperarTexto('Concluído');
    await voltar();
    let tv = await texto();
    verificar(!tv.includes('Concluído') && tv.includes('Editar produto'), 'voltar com o teclado aberto fecha só o teclado (o formulário continua)');
    await abrir('Preço pago,');
    await clicar('Cancelar', -1);
    await voltar();
    tv = await texto();
    verificar(!tv.includes('Editar produto') && tv.includes('Novembro de 2026'), 'depois de fechar o teclado pelo botão, um voltar fecha o formulário e fica na Lista (sem entrada sobrando)');
    await foto('voltar-fecha-folha');

    console.log(erros.length ? '\nErros:\n' + erros.join('\n') : '\nSem erros no navegador.');
    console.log('Formulário OK.');
  } catch (e) {
    await foto('ERRO').catch(() => {});
    console.error('\nERRO:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
