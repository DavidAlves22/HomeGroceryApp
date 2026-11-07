// Atalho "Outras pessoas usam" no navegador (Chrome headless) contra a API real e a PWA compilada.
// Dois grupos usam o mesmo nome de produto; uma pessoa NOVA (sem nenhum produto) digita parte do nome ao adicionar um produto e vê o
// nome como atalho; tocar nele preenche nome, unidade e a categoria do PRÓPRIO grupo e cria um produto novo só dela.
// Com o padrão da API (mínimo de 2 grupos) não precisa de configuração extra.
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const agora = Date.now();
const sufixo = String(agora);
const nomeDoProduto = `Leite caixinha ${sufixo}`;
const emailDoNovo = `e2e_nomes_novo_${agora}@teste.com`;
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

async function cadastrar(email) {
  const sessao = await api('POST', '/autenticacao/cadastro', {
    nome: 'Maria Souza',
    email,
    senha: 'senha1234',
  });
  return sessao.tokenDeAcesso;
}

async function usarProduto(token, nome) {
  const categorias = await api('GET', '/categorias', null, token);
  const d = new Date();
  const competencia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const lista = await api('POST', '/listas', { competencia, origem: 'Zero' }, token);
  await api(
    'POST',
    `/listas/${lista.resumo.id}/itens`,
    {
      nome,
      categoriaId: categorias.find((c) => c.nome === 'Laticínios').id,
      unidade: 'Litro',
      quantidade: 1,
    },
    token,
  );
}

(async () => {
  // Dois grupos diferentes usam o mesmo nome; a pessoa nova só se cadastra.
  await usarProduto(await cadastrar(`e2e_nomes_a_${agora}@teste.com`), nomeDoProduto);
  await usarProduto(await cadastrar(`e2e_nomes_b_${agora}@teste.com`), nomeDoProduto);
  const token = await cadastrar(emailDoNovo);

  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-nomes-' + Date.now(),
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
        `${process.env.DARK ? 'dark-' : ''}nomescomuns-${String(++passo).padStart(2, '0')}-${nome}.png`,
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
    console.log('1) A API devolve o nome para a pessoa nova (2 grupos usam) e não vaza ninguém');
    const achados = await api(
      'GET',
      `/produtos/nomes-comuns?q=${encodeURIComponent('caixinha ' + sufixo)}`,
      null,
      token,
    );
    verificar(achados.length === 1 && achados[0].grupos === 2, 'um nome usado por 2 grupos');
    verificar(
      achados[0].categoria === 'Laticínios' && achados[0].unidadePadrao === 'Litro',
      'vem com a categoria (pelo nome) e a unidade',
    );
    verificar(
      Object.keys(achados[0]).sort().join() === 'categoria,grupos,nome,unidadePadrao',
      'só nome, categoria, unidade e contagem (sem ids)',
    );

    console.log('2) Na tela: digitar parte do nome mostra "Outras pessoas usam"');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', emailDoNovo);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    await clicar('Lista padrão');
    await esperarTexto('Lista padrão vazia');
    await clicar('Adicionar produto');
    await digitar('Nome do produto', 'caixinha ' + sufixo);
    await esperarTexto('Outras pessoas usam');
    verificar((await texto()).includes(nomeDoProduto), 'o nome aparece como atalho');
    await foto('atalho');

    console.log('3) Tocar no atalho preenche nome, unidade e a categoria do próprio grupo');
    await clicar(nomeDoProduto, true);
    verificar(
      (await page.$(`[aria-label="Nome do produto"]`)) !== null &&
        (await page.$eval('[aria-label="Nome do produto"]', (e) => e.value)) === nomeDoProduto,
      'o nome foi preenchido',
    );
    verificar((await page.$('[aria-label="Unidade: litro"]')) !== null, 'unidade litro');
    verificar((await page.$('[aria-label="Categoria: Laticínios"]')) !== null, 'categoria Laticínios');
    verificar(
      !(await texto()).includes('Outras pessoas usam'),
      'depois de tocar, o atalho some',
    );
    await foto('preenchido');

    console.log('4) Salvar cria um produto NOVO só no grupo da pessoa');
    await clicar('Adicionar', true);
    await esperarTexto(nomeDoProduto);
    await pausa(500);
    const meus = await api('GET', `/produtos?q=${encodeURIComponent(sufixo)}`, null, token);
    verificar(meus.length === 1 && meus[0].nome === nomeDoProduto, 'o produto existe no grupo dela');
    const categorias = await api('GET', '/categorias', null, token);
    verificar(
      meus[0].categoriaId === categorias.find((c) => c.nome === 'Laticínios').id,
      'com a categoria do próprio grupo',
    );
    const depois = await api(
      'GET',
      `/produtos/nomes-comuns?q=${encodeURIComponent('caixinha ' + sufixo)}`,
      null,
      token,
    );
    verificar(depois.length === 0, 'agora que ela tem o produto, o atalho some para ela');
    await foto('criado');

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
