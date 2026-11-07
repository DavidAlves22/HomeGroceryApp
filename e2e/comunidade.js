// "Onde achou" da comunidade no navegador (Chrome headless) contra a API real e a PWA compilada.
// Uma pessoa (autor) mapeia um mercado e marca onde achou o Detergente; outra pessoa copia o mapa do catálogo e,
// na PRIMEIRA rota, o produto já vai ao lugar que o autor marcou (e não pela categoria). "Achei aqui" confirma.
// A API precisa estar com Locais__LimiteDeGrupos alto (ex.: 1000000): assim basta 1 grupo ter marcado.
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const agora = Date.now();
const emailDoNovo = `e2e_comunidade_novo_${agora}@teste.com`;
const nomeDoMercado = `Mercado Comunidade ${agora}`.slice(0, 40);
let passo = 0;

async function api(metodo, caminho, corpo, token) {
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

const area = (x, y, largura, altura) => ({ x, y, largura, altura });
const competencia = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

async function cadastrar(email) {
  const sessao = await api('POST', '/autenticacao/cadastro', {
    nome: 'Maria Souza',
    email,
    senha: 'senha1234',
  });
  return sessao.tokenDeAcesso;
}

async function preparar() {
  // Autor: mercado com 8 corredores (entra no catálogo) e o Detergente marcado no Corredor 5.
  const tokenDoAutor = await cadastrar(`e2e_comunidade_autor_${agora}@teste.com`);
  const categorias = await api('GET', '/categorias', null, tokenDoAutor);
  const cat = (nome) => categorias.find((c) => c.nome === nome).id;
  const loja = await api('POST', '/lojas', { nome: nomeDoMercado, cidade: 'Araras' }, tokenDoAutor);
  const secoes = Array.from({ length: 8 }, (_, i) =>
    i === 0
      ? {
          nome: 'Corredor 1',
          nomeLadoB: 'Limpeza',
          dividida: true,
          area: area(1, 8, 2, 6),
          categoriasLadoA: [cat('Mercearia')],
          categoriasLadoB: [cat('Limpeza')],
        }
      : {
          nome: `Corredor ${i + 1}`,
          dividida: false,
          area: area(1 + 3 * i, 8, 2, 6),
          categoriasLadoA: [cat('Mercearia')],
          categoriasLadoB: [],
        },
  );
  const mapa = await api(
    'PUT',
    `/lojas/${loja.id}/mapa`,
    {
      nome: nomeDoMercado,
      largura: 34,
      altura: 40,
      entrada: { x: 16, y: 37 },
      caixas: area(24, 34, 7, 2),
      secoes,
      versao: loja.versao,
    },
    tokenDoAutor,
  );
  const lista = await api(
    'POST',
    '/listas',
    { competencia: competencia(), origem: 'Zero' },
    tokenDoAutor,
  );
  const item = await api(
    'POST',
    `/listas/${lista.resumo.id}/itens`,
    { nome: 'Detergente', categoriaId: cat('Limpeza'), unidade: 'Unidade', quantidade: 1 },
    tokenDoAutor,
  );
  const corredor5 = mapa.secoes.find((s) => s.nome === 'Corredor 5').id;
  await api(
    'PUT',
    `/listas/${lista.resumo.id}/itens/${item.id}/local`,
    { lojaId: loja.id, locais: [{ secaoId: corredor5, lado: 'A' }] },
    tokenDoAutor,
  );

  // Pessoa nova: copia o mapa do catálogo e cria a lista com o mesmo produto (ainda sem marcar nada).
  const token = await cadastrar(emailDoNovo);
  const copia = await api('POST', `/catalogo/mercados/${loja.id}/copiar`, null, token);
  const categoriasDoNovo = await api('GET', '/categorias', null, token);
  const listaDoNovo = await api(
    'POST',
    '/listas',
    { competencia: competencia(), origem: 'Zero' },
    token,
  );
  await api(
    'POST',
    `/listas/${listaDoNovo.resumo.id}/itens`,
    {
      nome: 'detergente',
      categoriaId: categoriasDoNovo.find((c) => c.nome === 'Limpeza').id,
      unidade: 'Unidade',
      quantidade: 1,
    },
    token,
  );
  return { token, copia, listaId: listaDoNovo.resumo.id };
}

(async () => {
  const { token, copia, listaId } = await preparar();
  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-comunidade-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
  if (process.env.DARK)
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && erros.push('console: ' + m.text()));

  const foto = (nome) =>
    page.screenshot({
      path: path.join(
        PASTA,
        `${process.env.DARK ? 'dark-' : ''}comunidade-${String(++passo).padStart(2, '0')}-${nome}.png`,
      ),
    });
  const texto = () => page.evaluate(() => document.body.innerText.replace(/\u00a0/g, ' '));
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  const esperarTexto = async (t, ms = 15000) => {
    try {
      await page.waitForFunction(
        (x) =>
          document.body.innerText
            .replace(/\u00a0/g, ' ')
            .toLowerCase()
            .includes(x.toLowerCase()),
        { timeout: ms },
        t,
      );
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
    console.log('1) A API já sugere o local à pessoa nova (primeira rota, sem ter marcado nada)');
    const rotaDaApi = await api('POST', `/listas/${listaId}/rota`, { lojaId: copia.id }, token);
    verificar(rotaDaApi.locaisSugeridos.length === 1, 'a API devolve uma sugestão');
    verificar(
      rotaDaApi.paradas[0].nome === 'Corredor 5',
      'a rota vai ao Corredor 5 (e não ao lado de Limpeza pela categoria)',
    );
    verificar(rotaDaApi.locaisProprios.length === 0, 'a pessoa nova ainda não marcou nada');

    console.log('2) Na tela: sugestão com contagem e botão "Achei aqui"');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', emailDoNovo);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    await clicar('Lista', true);
    await esperarTexto(`Rota em ${copia.nome}`);
    await clicar(`Rota em ${copia.nome}`);
    await esperarTexto('Próxima parada');
    const t = await texto();
    verificar(t.includes('Corredor 5'), 'a primeira parada é o Corredor 5');
    verificar(
      t.includes('Outra pessoa achou aqui'),
      'aparece "Outra pessoa achou aqui" (sem dizer quem)',
    );
    verificar(
      (await page.$('[aria-label="Achei aqui: detergente"]')) !== null,
      'botão "Achei aqui" do item',
    );
    verificar(t.includes('Estava em outro lugar?'), 'continua dando para marcar outro lugar');
    await page.$eval('[aria-label="Achei aqui: detergente"]', (e) =>
      e.scrollIntoView({ block: 'center' }),
    );
    await pausa(300);
    await foto('sugestao');

    console.log('3) "Achei aqui" grava o local do próprio grupo');
    await page.click('[aria-label="Achei aqui: detergente"]');
    await esperarTexto('Local marcado por você');
    verificar(
      !(await texto()).includes('Outra pessoa achou aqui'),
      'depois de confirmar, a sugestão some (vale o local próprio)',
    );
    const depois = await api('POST', `/listas/${listaId}/rota`, { lojaId: copia.id }, token);
    verificar(depois.locaisProprios.length === 1, 'a API guardou o local próprio');
    verificar(depois.locaisSugeridos.length === 0, 'a API não sugere mais para quem já marcou');
    verificar(depois.paradas[0].nome === 'Corredor 5', 'a rota continua no Corredor 5');
    await foto('confirmado');

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
