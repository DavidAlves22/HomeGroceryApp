// Hábitos do grupo na Lista: "Costuma ser no <mercado>" e "Sugerir pelo histórico" na divisão da compra.
// Prepara a família (David e Ana), dois mercados e um histórico pela API; depois usa só a tela. Rode também com DARK=1.
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_habitos_${Date.now()}@teste.com`;
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

const competenciaDe = (mesesAtras) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - mesesAtras);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

async function preparar() {
  const sessao = await api('POST', '/autenticacao/cadastro', { nome: 'David Alves', email, senha: 'senha1234' });
  const token = sessao.tokenDeAcesso;
  const ana = await api('POST', '/autenticacao/cadastro', { nome: 'Ana Souza', email: `ana_${email}`, senha: 'senha1234' });
  const convite = await api('POST', '/grupo/convites', null, token);
  const entrou = await api('POST', '/grupo/entrar', { codigo: convite.codigo }, ana.tokenDeAcesso);
  const tokenDela = entrou.tokenDeAcesso;

  const categorias = await api('GET', '/categorias', null, token);
  const cat = (nome) => categorias.find((c) => c.nome === nome).id;
  const mercadoA = await api('POST', '/lojas', { nome: 'Mercado A', cidade: 'Araras' }, token);
  const mercadoB = await api('POST', '/lojas', { nome: 'Mercado B', cidade: 'Araras' }, token);

  // Histórico: o arroz sempre no Mercado B; o açougue sempre pela Ana; a padaria sempre pelo David.
  const compras = [
    { quem: tokenDela, categoria: 'Açougue', nomes: ['Frango', 'Carne', 'Linguiça'] },
    { quem: token, categoria: 'Padaria', nomes: ['Pão francês', 'Bolo', 'Rosca'] },
    { quem: token, categoria: 'Mercearia', nomes: ['Arroz', 'Arroz'], loja: mercadoB.id },
  ];
  let mes = 1;
  for (const compra of compras) {
    const lista = await api('POST', '/listas', { competencia: competenciaDe(mes++), origem: 'Zero', permitirDuplicada: true }, token);
    for (const nome of compra.nomes) {
      const criado = await api('POST', `/listas/${lista.resumo.id}/itens`, { nome, categoriaId: cat(compra.categoria), unidade: 'Unidade', quantidade: 1 }, token);
      await api('PUT', `/listas/${lista.resumo.id}/itens/${criado.id}/comprado`, { comprado: true, lojaId: compra.loja }, compra.quem);
    }
  }

  // Lista do mês atual, com um item de cada categoria ainda pendente.
  const hoje = await api('POST', '/listas', { competencia: competenciaDe(0), origem: 'Zero' }, token);
  for (const [nome, categoria] of [['Arroz', 'Mercearia'], ['Frango', 'Açougue'], ['Pão francês', 'Padaria']]) {
    await api('POST', `/listas/${hoje.resumo.id}/itens`, { nome, categoriaId: cat(categoria), unidade: 'Unidade', quantidade: 1 }, token);
  }
  return { anaId: ana.usuario.id, listaId: hoje.resumo.id };
}

(async () => {
  const { anaId, listaId } = await preparar();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-habitos-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 1100, deviceScaleFactor: 2 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}habitos-${String(++passo).padStart(2, '0')}-${nome}.png`) });
  const texto = () => page.evaluate(() => document.body.innerText.replace(/\u00a0/g, ' '));
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  const esperarTexto = async (t, ms = 15000) => {
    const fim = Date.now() + ms;
    while (Date.now() < fim) {
      if ((await texto()).toLowerCase().includes(t.toLowerCase())) return;
      await pausa(250);
    }
    throw new Error(`não apareceu "${t}". Tela:\n${(await texto()).slice(0, 900)}`);
  };
  // Telas anteriores ficam montadas por baixo: vale o ÚLTIMO elemento com o texto.
  const tocar = async (rotulo) => {
    const ok = await page.evaluate((r) => {
      const rotulo = (e) => (e.getAttribute('aria-label') || e.innerText || '').trim();
      const candidatos = [...document.querySelectorAll('[role=button],[role=tab],[role=link],a,button,div[tabindex]')];
      // Texto exato primeiro ("Lista" não pode pegar "Lista padrão"); sem exato, começa com.
      const exatos = candidatos.filter((e) => rotulo(e) === r);
      const todos = exatos.length ? exatos : candidatos.filter((e) => rotulo(e).startsWith(r));
      const alvo = todos[todos.length - 1];
      if (alvo) alvo.click();
      return !!alvo;
    }, rotulo);
    if (!ok) throw new Error(`não achei para tocar: ${rotulo}`);
    await pausa(450);
  };
  const confere = (cond, msg) => {
    if (!cond) throw new Error('FALHOU: ' + msg);
    console.log('ok -', msg);
  };
  const digitar = async (rotulo, valor) => {
    await page.waitForSelector(`[aria-label="${rotulo}"]`, { timeout: 10000 });
    await page.type(`[aria-label="${rotulo}"]`, valor);
  };

  try {
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await tocar('Entrar');
    await esperarTexto('Olá');
    // A aba é um texto dentro de um botão: o clique no texto é o que o app entende (como em divisao.js).
    const abas = await page.$$('xpath/.//*[normalize-space(text())="Lista"]');
    await abas[abas.length - 1].click();
    await pausa(450);
    await esperarTexto('Dividir a compra');
    await pausa(800);

    const t = await texto();
    await foto('lista');
    const linha = (nome) => t.split('\n').filter((l, i, a) => a[i - 1] === nome || l.startsWith(nome)).join(' | ');
    confere(t.includes('Costuma ser no Mercado B'), 'o arroz mostra "Costuma ser no Mercado B" (hoje o mercado é o A)');
    confere((t.match(/Costuma ser no/g) || []).length === 1, 'só o arroz tem hábito de mercado (frango e pão nunca tiveram mercado)');

    await tocar('Dividir a compra');
    await esperarTexto('Sugerir pelo histórico');
    await foto('divisao-antes');
    let folha = await texto();
    confere(folha.includes('Costuma ser de Ana') && folha.includes('Costuma ser de você'), 'a folha diz quem costuma pegar cada categoria');

    await tocar('Sugerir pelo histórico');
    await pausa(400);
    await foto('divisao-sugerida');
    await tocar('Salvar divisão');
    await esperarTexto('Compra dividida');
    await esperarTexto('Mudar a divisão');
    const lista = await api('GET', `/listas/${listaId}`, null, (await api('POST', '/autenticacao/login', { email, senha: 'senha1234' })).tokenDeAcesso);
    confere(lista.divisao.length === 2, 'a divisão salva tem 2 categorias (Açougue e Padaria; Mercearia ficou de todos)');
    confere(lista.divisao.some((d) => d.usuarioId === anaId), 'o Açougue ficou com a Ana, como no histórico');
    if (erros.length) throw new Error(erros.join('\n'));
    console.log('HABITOS OK');
  } catch (e) {
    await foto('erro').catch(() => {});
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
