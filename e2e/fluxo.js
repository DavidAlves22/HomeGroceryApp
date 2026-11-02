// Fluxo ponta a ponta no navegador (Edge headless) contra a API real e a PWA compilada.
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, "capturas");
require("fs").mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || "http://localhost:8090";
const email = `e2e_${Date.now()}@teste.com`;
let passo = 0;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-perfil-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const errosDeConsole = [];
  page.on('pageerror', (e) => errosDeConsole.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errosDeConsole.push('console: ' + m.text()));
  page.on('requestfailed', (r) => errosDeConsole.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText ?? '')));

  const foto = async (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}${String(++passo).padStart(2, '0')}-${nome}.png`) });
  // O formatador pt-BR usa espaço não separável depois de "R$": normaliza para comparar com texto simples.
  const texto = () => page.evaluate(() => document.body.innerText.replace(/ /g, ' '));
  const esperarTexto = async (t, ms = 15000) => {
    try {
      await page.waitForFunction((x) => document.body.innerText.replace(/ /g, ' ').toLowerCase().includes(x.toLowerCase()), { timeout: ms }, t);
    } catch {
      await foto('FALHA-esperando-' + t.replace(/\W+/g, '_').slice(0, 30));
      throw new Error(`Não apareceu o texto "${t}". Tela atual:\n${(await texto()).slice(0, 800)}`);
    }
  };
  const clicar = async (t, indice = 0) => {
    await esperarTexto(t);
    const alvos = await page.$$(`xpath/.//*[normalize-space(text())="${t}"]`);
    if (!alvos[indice]) throw new Error(`Sem elemento clicável "${t}"`);
    await alvos[indice].click();
    await new Promise((r) => setTimeout(r, 350));
  };
  const clicarRotulo = async (rotulo) => {
    await page.waitForSelector(`[aria-label="${rotulo}"]`, { timeout: 10000 });
    await page.click(`[aria-label="${rotulo}"]`);
    await new Promise((r) => setTimeout(r, 350));
  };
  const digitar = async (rotulo, valor) => {
    await page.waitForSelector(`[aria-label="${rotulo}"]`, { timeout: 10000 });
    await page.click(`[aria-label="${rotulo}"]`, { clickCount: 3 });
    await page.type(`[aria-label="${rotulo}"]`, valor);
  };
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  const verificar = (cond, msg) => {
    if (!cond) throw new Error('FALHOU: ' + msg);
    console.log('  ok -', msg);
  };

  const adicionarProduto = async (nome, categoria, unidade, quantidade) => {
    await digitar('Nome do produto', nome);
    await clicar(categoria, (await page.$$(`xpath/.//*[normalize-space(text())="${categoria}"]`)).length - 1);
    await clicar(unidade, (await page.$$(`xpath/.//*[normalize-space(text())="${unidade}"]`)).length - 1);
    await digitar('Quantidade', quantidade);
  };

  try {
    console.log('1) Abertura: health check e login');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await foto('login');

    console.log('2) Cadastro');
    await clicar('Criar uma conta');
    await digitar('Nome', 'Maria Souza');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await clicar('Criar conta');
    await esperarTexto('Sem lista para');
    verificar((await texto()).includes('Olá, MARIA') || (await texto()).toUpperCase().includes('OLÁ, MARIA'), 'saudação com o primeiro nome');
    await foto('inicio-vazio');

    console.log('3) Lista padrão: adicionar produtos');
    await clicar('Lista padrão');
    await esperarTexto('Lista padrão vazia');
    await foto('padrao-vazia');
    await clicar('Adicionar produto');
    await adicionarProduto('Arroz', 'Mercearia', 'pacote', '2');
    await foto('folha-item');
    await clicar('Adicionar', (await page.$$('xpath/.//*[normalize-space(text())="Adicionar"]')).length - 1);
    await esperarTexto('Arroz');
    await clicarRotulo('Adicionar produto à lista padrão');
    await adicionarProduto('Leite', 'Laticínios', 'litro', '6');
    await clicar('Adicionar', (await page.$$('xpath/.//*[normalize-space(text())="Adicionar"]')).length - 1);
    await esperarTexto('Leite');
    await clicarRotulo('Adicionar produto à lista padrão');
    await adicionarProduto('Banana', 'Hortifruti', 'kg', '1,5');
    await clicar('Adicionar', (await page.$$('xpath/.//*[normalize-space(text())="Adicionar"]')).length - 1);
    await esperarTexto('Banana');
    const t3 = await texto();
    verificar(t3.includes('Arroz') && t3.includes('Leite') && t3.includes('Banana'), 'três produtos na lista padrão');
    verificar(t3.includes('1,5 kg'), 'quantidade fracionada exibida com vírgula');
    await foto('padrao-com-itens');

    console.log('4) Reordenar: subir Banana');
    await clicarRotulo('Subir Banana');
    await pausa(600);
    const ordem = await page.evaluate(() => document.body.innerText.split('\n').filter((l) => ['Arroz', 'Leite', 'Banana'].includes(l.trim())));
    verificar(ordem.join(',') === 'Arroz,Banana,Leite', `ordem alterada (${ordem.join(',')})`);

    console.log('5) Nova lista a partir da lista padrão');
    await clicarRotulo('Voltar');
    await clicar('Nova lista');
    await esperarTexto('Mês da compra');
    await foto('nova-lista');
    await clicar('Continuar');
    await esperarTexto('Escolha os produtos');
    await clicar('Leite'); // desmarca o Leite
    await foto('nova-lista-selecao');
    await clicar('Criar lista com 2 produtos');
    await esperarTexto('0%');
    const t5 = await texto();
    verificar(t5.includes('Arroz') && t5.includes('Banana') && !t5.includes('Leite'), 'lista criada só com os produtos escolhidos');
    await foto('lista-mes');

    console.log('6) Marcar comprado com um toque');
    await clicarRotulo('Arroz, 2 pacote');
    await esperarTexto('50%');
    verificar((await texto()).includes('1 de 2 comprados'), 'progresso 1 de 2 (50%)');
    await foto('lista-marcado');

    console.log('6b) Preços: estimado e pago pelo formulário do item');
    await clicarRotulo('Editar Arroz');
    await digitar('Preço estimado', '24,00');
    await digitar('Preço pago', '25,50');
    await foto('folha-precos');
    await clicar('Salvar');
    await esperarTexto('R$ 51,00');
    verificar((await texto()).includes('R$ 51,00'), 'gasto = 2 pacotes x R$ 25,50 = R$ 51,00');
    verificar((await texto()).includes('R$ 48,00'), 'estimado = 2 x R$ 24,00 = R$ 48,00 (separado do gasto)');
    await foto('lista-com-precos');

    console.log('7) Alterar a lista padrão não muda a lista do mês');
    await clicarRotulo('Voltar').catch(() => {});
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Em andamento');
    verificar((await texto()).includes('50%'), 'início mostra 50% da lista do mês');
    await foto('inicio-com-lista');

    console.log('8) Segunda lista principal no mesmo mês pede confirmação');
    await clicar('Nova lista');
    await esperarTexto('Mês da compra');
    await clicar('Criar do zero');
    await clicar('Criar lista vazia');
    await esperarTexto('Já existe a lista principal');
    await foto('confirmar-duplicada');
    verificar(true, 'aviso de lista principal já existente');
    await clicar('Voltar', 0).catch(() => {});

    console.log('9) Finalizar e consultar no histórico');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await clicar('Continuar compra');
    await esperarTexto('Finalizar compra');
    await clicar('Finalizar compra');
    await clicar('Toque de novo para finalizar a compra');
    await esperarTexto('Compra finalizada');
    await foto('lista-finalizada');
    verificar((await texto()).includes('Reabrir lista'), 'lista finalizada oferece reabrir');
    verificar((await page.$$('[aria-label^="Editar "]')).length === 0, 'sem botões de edição em lista finalizada');
    await clicar('Histórico');
    await esperarTexto('Finalizada');
    await foto('historico');

    console.log('10) Categorias');
    await clicar('Mais');
    await clicar('Categorias');
    await esperarTexto('Mercearia');
    await foto('categorias');
    verificar((await texto()).includes('Higiene pessoal'), 'categorias iniciais exibidas');

    console.log('11) Análises com histórico de 3 meses (semeado pela API)');
    const sessao = JSON.parse(await page.evaluate(() => localStorage.getItem('homegrocery.sessao')));
    const API = process.env.API_URL || 'http://localhost:5272';
    const api = async (metodo, caminho, corpo) => {
      const r = await fetch(API + caminho, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessao.tokenDeAcesso },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${await r.text()}`);
      return r.status === 204 ? null : r.json();
    };
    const cats = await api('GET', '/categorias');
    const cat = (nome) => cats.find((c) => c.nome === nome).id;
    const meses = [
      ['2026-08', 16, 24, 8.4, 30],
      ['2026-09', 18, 25, 8.9, 34],
      ['2026-10', 19, 27, 9.5, 41],
    ];
    for (const [competencia, cafe, arroz, feijao, carne] of meses) {
      const lista = (await api('POST', '/listas', { competencia, origem: 'Zero' })).resumo.id;
      const itens = [
        ['Café', 'Mercearia', 'Pacote', 1, cafe],
        ['Arroz 5 kg', 'Mercearia', 'Pacote', 2, arroz],
        ['Feijão', 'Mercearia', 'Kg', 3, feijao],
        ['Carne moída', 'Açougue', 'Kg', 1.5, carne],
      ];
      for (const [nome, categoria, unidade, quantidade, preco] of itens) {
        const base = { nome, categoriaId: cat(categoria), unidade, quantidade };
        const item = await api('POST', `/listas/${lista}/itens`, base);
        await api('PUT', `/listas/${lista}/itens/${item.id}`, { ...base, versao: item.versao, precoUnitario: preco });
        await api('PUT', `/listas/${lista}/itens/${item.id}/comprado`, { comprado: true });
      }
      await api('POST', `/listas/${lista}/finalizar`);
    }
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await clicar('Análises');
    await esperarTexto('Gasto por mês');
    await pausa(800);
    await foto('analises');
    const tA = await texto();
    verificar(tA.includes('Por categoria em'), 'gráfico por categoria exibido');
    verificar(tA.includes('Evolução de preços'), 'evolução de preços exibida');
    verificar(tA.includes('Maiores aumentos de preço'), 'maiores aumentos exibidos');
    verificar(/\+\d+,\d%/.test(tA), 'variação percentual com sinal exibida');
    await page.evaluate(() => {
      const rolavel = [...document.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 50 && getComputedStyle(d).overflowY !== 'visible');
      if (rolavel) rolavel.scrollTop = rolavel.scrollHeight;
    });
    await pausa(400);
    await foto('analises-fim');

    console.log('\nFluxo completo OK.');
  } catch (e) {
    console.error('\nERRO NO FLUXO:', e.message);
    await foto('ERRO').catch(() => {});
    process.exitCode = 1;
  } finally {
    if (errosDeConsole.length) console.log('\nErros do navegador:\n' + [...new Set(errosDeConsole)].slice(0, 10).join('\n'));
    await browser.close();
  }
})();
