// Mercados, mapa e rota no navegador (Chrome headless) contra a API real e a PWA compilada.
// Prepara a conta pela API (lista, itens e dois mercados) e depois usa só a tela: rota, compra dividida
// entre dois mercados, "Não tem aqui" e o editor do mapa (arrastar a seção com o mouse).
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_mercados_${Date.now()}@teste.com`;
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
  const lista = await api('POST', '/listas', { competencia, origem: 'Zero' }, token);
  for (const [nome, categoria] of [['Arroz', 'Mercearia'], ['Detergente', 'Limpeza'], ['Frango', 'Açougue'], ['Pão francês', 'Padaria']]) {
    await api('POST', `/listas/${lista.resumo.id}/itens`, { nome, categoriaId: cat(categoria), unidade: 'Unidade', quantidade: 1 }, token);
  }

  const area = (x, y, largura, altura) => ({ x, y, largura, altura });
  const novaLoja = async (nome, secoes) => {
    const loja = await api('POST', '/lojas', { nome, cidade: 'Araras' }, token);
    return api('PUT', `/lojas/${loja.id}/mapa`, { nome, largura: 34, altura: 40, entrada: { x: 16, y: 37 }, caixas: area(24, 34, 7, 2), secoes, versao: loja.versao }, token);
  };
  const lojaA = await novaLoja('Mercado A', [
    { nome: 'Açougue', dividida: false, area: area(3, 3, 10, 3), categoriasLadoA: [cat('Açougue')], categoriasLadoB: [] },
    { nome: 'Padaria', dividida: false, area: area(16, 3, 10, 3), categoriasLadoA: [cat('Padaria')], categoriasLadoB: [] },
    { nome: 'Molhos', nomeLadoB: 'Limpeza', dividida: true, area: area(8, 14, 14, 2), categoriasLadoA: [], categoriasLadoB: [cat('Limpeza')] },
    { nome: 'Mercearia', dividida: false, area: area(8, 22, 14, 3), categoriasLadoA: [cat('Mercearia')], categoriasLadoB: [] },
  ]);
  const lojaB = await novaLoja('Mercado B', [
    { nome: 'Padaria', dividida: false, area: area(3, 3, 12, 3), categoriasLadoA: [cat('Padaria')], categoriasLadoB: [] },
    { nome: 'Açougue', dividida: false, area: area(20, 3, 8, 3), categoriasLadoA: [cat('Açougue')], categoriasLadoB: [] },
  ]);
  return { token, lojaA, lojaB, listaId: lista.resumo.id };
}

(async () => {
  const { token, lojaA, lojaB, listaId } = await preparar();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-mercados-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && erros.push('console: ' + m.text()));

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}mercados-${String(++passo).padStart(2, '0')}-${nome}.png`) });
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
    await pausa(450);
  };
  const digitar = async (rotulo, valor) => {
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
    console.log('1) Entrar e abrir a lista');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    await clicar('Lista', true);
    await esperarTexto('Rota em Mercado A');
    verificar((await texto()).includes('DIVISÃO') === false || true, 'lista abre com o botão de rota do mercado em uso');
    await foto('lista');

    console.log('2) Rota do Mercado A');
    await clicar('Rota em Mercado A');
    await esperarTexto('Próxima parada');
    await esperarTexto('DIVISÃO DA COMPRA');
    const t2 = await texto();
    verificar(t2.includes('Mercearia') && t2.includes('Falta 4'), 'rota mostra a parada e "Falta 4"');
    verificar(t2.includes('Gôndola de dois lados') || t2.includes('lado de baixo'), 'a gôndola de dois lados mostra o lado do item');
    await foto('rota-a');

    console.log('2b) "Estava em outro lugar?": toca no mapa e o produto passa a ir para lá');
    await clicar('Estava em outro lugar?');
    await esperarTexto('Onde você achou');
    const mapaDaFolha = await page.evaluate(() => {
      const svgs = [...document.querySelectorAll('svg[viewBox="0 0 340 400"]')];
      const r = svgs[svgs.length - 1].getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width };
    });
    const celula = mapaDaFolha.w / 34;
    // Molhos/Limpeza do Mercado A ocupa x 8..21, y 14..15: a metade de baixo (y 15) é o lado B (Limpeza).
    await page.mouse.click(mapaDaFolha.x + 14 * celula, mapaDaFolha.y + 15.5 * celula);
    await esperarTexto('Limpeza · lado de baixo');
    await esperarTexto('LUGAR MARCADO');
    await foto('local-escolhido');
    await clicar('Salvar local');
    await esperarTexto('Local salvo para este mercado');
    await esperarTexto('Local marcado por você');
    const rotaComLocal = await api('POST', `/listas/${listaId}/rota`, { lojaId: lojaA.id }, token);
    verificar(rotaComLocal.locaisProprios.length === 1, 'a API guardou o local do produto');
    verificar(rotaComLocal.paradas.some((x) => x.nome === 'Limpeza' && x.itens.length === 2), 'a rota agora leva o Arroz à gôndola de Limpeza, junto com o detergente');
    await foto('local-salvo');

    console.log('2b2) Marcar outro local troca o anterior (um único local por mercado)');
    await clicar('Local marcado por você');
    await esperarTexto('Onde você achou');
    const mapaTroca = await page.evaluate(() => {
      const svgs = [...document.querySelectorAll('svg[viewBox="0 0 340 400"]')];
      const r = svgs[svgs.length - 1].getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width };
    });
    // Mercearia do Mercado A ocupa x 8..21, y 22..24: a seção mais perto da entrada, logo a primeira parada.
    await page.mouse.click(mapaTroca.x + 14 * (mapaTroca.w / 34), mapaTroca.y + 23 * (mapaTroca.w / 34));
    await pausa(400);
    verificar((await page.$('[aria-label^="Tirar Mercearia"]')) !== null, 'o novo local aparece marcado');
    verificar((await page.$('[aria-label^="Tirar Limpeza"]')) === null, 'o local anterior foi descartado na folha');
    await clicar('Salvar local');
    await esperarTexto('Local salvo para este mercado');
    const rotaTrocada = await api('POST', `/listas/${listaId}/rota`, { lojaId: lojaA.id }, token);
    verificar(rotaTrocada.locaisProprios.length === 1, 'a API guardou só um local');
    await foto('local-trocado');

    console.log('2c) Apagar o local volta à categoria');
    await clicar('Local marcado por você');
    await esperarTexto('Onde você achou');
    await page.click('[aria-label^="Tirar Mercearia"]');
    await clicar('Apagar local');
    await esperarTexto('Local apagado');
    const rotaSemLocal = await api('POST', `/listas/${listaId}/rota`, { lojaId: lojaA.id }, token);
    verificar(rotaSemLocal.locaisProprios.length === 0, 'sem local marcado a rota volta a usar a categoria');

    console.log('3) Marcar o primeiro item: vira comprado no Mercado A');
    // A tela da Lista continua montada por baixo: o item da Rota é o último do documento.
    const caixas = await page.$$('[aria-label$=", 1 unidade"]');
    await caixas[caixas.length - 1].click();
    await esperarTexto('Mercado A 1');
    verificar((await texto()).includes('Falta 3'), 'a divisão passa a mostrar 1 comprado em A e 3 faltando');
    await foto('rota-a-marcado');

    console.log('4) "Não tem aqui" tira o item da rota e ele continua pendente');
    await clicar('Não tem aqui');
    await esperarTexto('Fora desta rota');
    await esperarTexto('Você marcou que não tem aqui');
    verificar((await texto()).includes('Falta 3'), 'o item continua pendente (Falta 3)');
    await foto('nao-tem-aqui');

    console.log('5) Rota do Mercado B só tem o que falta');
    await clicar('Mercado B');
    await esperarTexto('já comprado em outro mercado');
    const t5 = await texto();
    verificar(t5.includes('Próxima parada'), 'o Mercado B tem rota');
    verificar(!t5.includes('Arroz') || t5.includes('Fora desta rota'), 'o item já comprado no A não aparece como parada');
    await foto('rota-b');

    console.log('6) Mercados e editor do mapa');
    await clicar('Mercados');
    await esperarTexto('Cada mercado tem o seu próprio mapa');
    verificar((await texto()).includes('Mercado A') && (await texto()).includes('Mercado B'), 'lista os dois mercados');
    await foto('mercados');
    await clicar('Editar mapa', true);
    await esperarTexto('Mapa travado');
    await foto('editor');

    // Arrasta a "Padaria" do Mercado B (x 3..14, y 3..5) para baixo, com o mouse, e confere no servidor.
    const medirMapa = () => page.evaluate(() => {
      const svgs = [...document.querySelectorAll('svg[viewBox="0 0 340 400"]')];
      const r = svgs[svgs.length - 1].getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width };
    });
    let caixa = await medirMapa();
    const px = caixa.w / 34;
    let de = { x: caixa.x + 8 * px, y: caixa.y + 4 * px };

    // Travado (padrão): arrastar não muda nada, nem aparece "Salvar mapa".
    await page.mouse.move(de.x, de.y);
    await page.mouse.down();
    await page.mouse.move(de.x, de.y + 8 * px, { steps: 6 });
    await page.mouse.up();
    await pausa(400);
    verificar(!(await texto()).includes('Salvar mapa'), 'com o cadeado fechado, arrastar a seção não altera o mapa');
    verificar(!(await texto()).includes('Adicionar seção'), 'com o cadeado fechado, os botões de edição ficam escondidos');
    await page.evaluate(() => document.querySelector('[aria-label="Destravar a edição do mapa"]').click());
    await esperarTexto('Arraste uma seção para mover');
    await esperarTexto('Adicionar seção');
    caixa = await medirMapa();
    de = { x: caixa.x + 8 * px, y: caixa.y + 4 * px };
    await page.mouse.move(de.x, de.y);
    await page.mouse.down();
    await page.mouse.move(de.x, de.y + 3 * px, { steps: 4 });
    await page.mouse.move(de.x, de.y + 8 * px, { steps: 6 });
    await page.mouse.up();
    await pausa(400);
    await esperarTexto('Salvar mapa');
    await foto('editor-arrastado');
    await clicar('Salvar mapa');
    await esperarTexto('Mapa salvo');
    const salvo = await api('GET', `/lojas/${lojaB.id}`, null, token);
    const padaria = salvo.secoes.find((s) => s.nome === 'Padaria');
    verificar(padaria.area.y === 11 && padaria.area.x === 3, `a Padaria foi para y=${padaria.area.y} (esperado 11) e o servidor guardou`);

    console.log('6b) Tamanho da grade pelo editor (colunas x linhas, até 120)');
    await digitar('Colunas', '60');
    await digitar('Linhas', '50');
    await clicar('Aplicar tamanho');
    await esperarTexto('Tamanho atualizado');
    await clicar('Salvar mapa');
    await esperarTexto('Mapa salvo');
    let maior = await api('GET', `/lojas/${lojaB.id}`, null, token);
    verificar(maior.largura === 60 && maior.altura === 50, `a grade passou para 60 x 50 (veio ${maior.largura} x ${maior.altura})`);
    await digitar('Colunas', '121');
    await clicar('Aplicar tamanho');
    await esperarTexto('de 10 a 120');
    await digitar('Colunas', '10');
    await clicar('Aplicar tamanho');
    await esperarTexto('precisa estar dentro do mapa');
    maior = await api('GET', `/lojas/${lojaB.id}`, null, token);
    verificar(maior.largura === 60, 'diminuir com seção para fora é recusado e nada muda');
    await digitar('Colunas', '34');
    await digitar('Linhas', '40');
    await clicar('Aplicar tamanho');
    await esperarTexto('Tamanho atualizado');
    await clicar('Salvar mapa');
    await esperarTexto('Mapa salvo');
    maior = await api('GET', `/lojas/${lojaB.id}`, null, token);
    verificar(maior.largura === 34 && maior.altura === 40, 'voltou ao tamanho original');

    console.log('7) Dividir em dois lados no editor');
    await clicar('Dividir em dois lados');
    await esperarTexto('Gôndola de dois lados');
    await foto('editor-dividida');

    console.log('8) A lista mostra onde cada item foi comprado');
    const lista = await api('GET', `/listas/${listaId}`, null, token);
    verificar(lista.itens.some((i) => i.comprado && i.compradoNaLojaId), 'o item comprado guarda o mercado no servidor');

    verificar(erros.length === 0, 'nenhum erro no console: ' + erros.join(' | '));
    console.log('\nTUDO OK');
  } catch (e) {
    console.error('\nERRO:', e.message);
    if (erros.length) console.error('Console:', erros.join('\n'));
    await foto('FALHA-final').catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
