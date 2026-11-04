// Mapas compartilhados: uma pessoa cria um mapa pela API; outra entra pela tela, busca em "Carregar mapas existentes",
// vê a prévia, copia e cai no editor com o mapa dela. Confere que o original não muda e que "Parar de compartilhar"
// esconde o mapa do catálogo. Rode também com DARK=1.
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const sufixo = Date.now();
const emailAutor = `e2e_catalogo_autor_${sufixo}@teste.com`;
const emailCopista = `e2e_catalogo_copista_${sufixo}@teste.com`;
const nomeDoMapa = `Favetta E2E ${sufixo}`;
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

async function preparar() {
  const autor = await api('POST', '/autenticacao/cadastro', {
    nome: 'Autor Do Mapa',
    email: emailAutor,
    senha: 'senha1234',
  });
  await api('POST', '/autenticacao/cadastro', {
    nome: 'Maria Copista',
    email: emailCopista,
    senha: 'senha1234',
  });
  const token = autor.tokenDeAcesso;
  const categorias = await api('GET', '/categorias', null, token);
  const cat = (nome) => categorias.find((c) => c.nome === nome).id;
  const area = (x, y, largura, altura) => ({ x, y, largura, altura });
  const loja = await api('POST', '/lojas', { nome: nomeDoMapa, cidade: 'São Carlos' }, token);
  const salvo = await api(
    'PUT',
    `/lojas/${loja.id}/mapa`,
    {
      nome: nomeDoMapa,
      largura: 34,
      altura: 40,
      entrada: { x: 16, y: 37 },
      caixas: area(24, 34, 7, 2),
      versao: loja.versao,
      secoes: [
        {
          nome: 'Cervejas',
          nomeLadoB: 'Refrigerantes',
          dividida: true,
          area: area(3, 8, 2, 8),
          categoriasLadoA: [cat('Cervejas')],
          categoriasLadoB: [cat('Refrigerantes')],
        },
        {
          nome: 'Açougue',
          dividida: false,
          area: area(3, 3, 10, 3),
          categoriasLadoA: [cat('Açougue')],
          categoriasLadoB: [],
        },
      ],
    },
    token,
  );
  return { token, lojaId: salvo.id };
}

(async () => {
  const { token, lojaId } = await preparar();
  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-catalogo-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: 390,
    height: 900,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  if (process.env.DARK)
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const foto = (nome) =>
    page.screenshot({
      path: path.join(
        PASTA,
        `${process.env.DARK ? 'dark-' : ''}catalogo-${String(++passo).padStart(2, '0')}-${nome}.png`,
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

  try {
    console.log('1) A segunda pessoa entra e abre "Carregar mapas existentes"');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', emailCopista);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    await clicar('Mais', true);
    await clicar('Mercados');
    await esperarTexto('Carregar mapas existentes');
    await foto('mercados');
    await clicar('Carregar mapas existentes');
    await esperarTexto('Mapas existentes');

    console.log('2) Busca o mapa pelo nome e vê a prévia');
    await digitar('Buscar mercado', nomeDoMapa);
    await digitar('Filtrar por cidade', 'sao paulo');
    await esperarTexto('Nenhum mapa encontrado com esse filtro');
    verificar(!(await texto()).includes(nomeDoMapa), 'filtrar por outra cidade esconde o mapa');
    await digitar('Filtrar por cidade', 'sao car');
    await esperarTexto(nomeDoMapa);
    verificar(
      (await texto()).includes('São Carlos'),
      'o filtro de cidade ignora acento e maiúscula e o cartão mostra a cidade',
    );
    verificar((await texto()).includes('2 seções'), 'a lista mostra o mapa com 2 seções');
    verificar((await texto()).includes('ainda ninguém copiou'), 'ninguém copiou ainda');
    await pausa(1200);
    await clicar('Ver mapa');
    await pausa(1500);
    await foto('apos-ver-mapa');
    const desenhos = await page.evaluate(
      () =>
        [...document.querySelectorAll('svg[viewBox]')].filter(
          (s) => s.getBoundingClientRect().width > 200,
        ).length,
    );
    verificar(desenhos >= 1, 'a prévia do mapa aparece desenhada');
    await foto('previa');

    console.log('3) Copia: cai no editor com o mapa dela');
    await clicar('Copiar');
    await esperarTexto('Mapa travado');
    verificar((await texto()).includes(nomeDoMapa), 'o editor abre com o nome do mapa copiado');
    await foto('editor-da-copia');
    const copista = await api('POST', '/autenticacao/login', {
      email: emailCopista,
      senha: 'senha1234',
    });
    const lojasDela = await api('GET', '/lojas', null, copista.tokenDeAcesso);
    verificar(
      lojasDela.length === 1 &&
        lojasDela[0].nome === nomeDoMapa &&
        lojasDela[0].secoes === 2 &&
        lojasDela[0].cidade === 'São Carlos',
      'o servidor guardou a cópia (com a cidade) no grupo dela',
    );
    const original = await api('GET', `/lojas/${lojaId}`, null, token);
    verificar(
      original.secoes.length === 2 && original.versao === 2,
      'o mapa original continua intacto',
    );

    console.log('4) "Parar de compartilhar" tira o mapa do catálogo');
    await api('PUT', `/lojas/${lojaId}/compartilhamento`, { compartilhada: false }, token);
    const terceiro = await api('POST', '/autenticacao/cadastro', {
      nome: 'Terceiro',
      email: `e2e_catalogo_t_${sufixo}@teste.com`,
      senha: 'senha1234',
    });
    const visto = await api(
      'GET',
      `/catalogo/mercados?busca=${encodeURIComponent(nomeDoMapa)}`,
      null,
      terceiro.tokenDeAcesso,
    );
    verificar(visto.length === 0, 'sem compartilhar, outro grupo não vê mais o mapa');

    console.log('5) Novo mercado pela tela exige nome e cidade');
    await page.goto(BASE + '/mercados', { waitUntil: 'networkidle2' });
    await clicar('Novo mercado');
    await digitar('Nome', 'Mercado Sem Cidade');
    await clicar('Criar e abrir o editor');
    await esperarTexto('Informe a cidade do mercado.');
    verificar(true, 'sem cidade o app recusa e mostra o aviso');
    await digitar('Cidade', 'Araras');
    await clicar('Criar e abrir o editor');
    await esperarTexto('Arraste uma seção para mover');
    const cidadeNoEditor = await page.evaluate(() => document.querySelector('[aria-label="Cidade"]')?.value);
    verificar(cidadeNoEditor === 'Araras', 'com a cidade, cria o mercado e abre o editor com ela preenchida');
    await foto('novo-mercado');

    console.log(erros.length ? '\nErros:\n' + erros.join('\n') : '\nSem erros no navegador.');
    console.log('Catálogo OK.');
  } catch (e) {
    await foto('ERRO').catch(() => {});
    console.error('\nERRO:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
