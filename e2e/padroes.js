// Cartões de padrões em Análises (preço bom, itens que vão juntos, produtos de época), cada um com 2 linhas e
// "Ver todos". Monta o histórico pela API e recua as datas de compra direto no banco. Rode também com DARK=1.
// Precisa do contêiner `homegroceryapi-banco-1` no ar.
const puppeteer = require('puppeteer-core');
const { execFileSync } = require('child_process');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_padroes_${Date.now()}@teste.com`;
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

function sql(comando) {
  execFileSync('docker', ['exec', 'homegroceryapi-banco-1', 'psql', '-U', 'homegrocery', '-d', 'homegrocery', '-c', comando], { stdio: 'pipe' });
}

const competenciaDe = (diasAtras) => {
  const d = new Date(Date.now() - diasAtras * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

async function preparar() {
  const sessao = await api('POST', '/autenticacao/cadastro', { nome: 'Maria Souza', email, senha: 'senha1234' });
  const token = sessao.tokenDeAcesso;
  const categorias = await api('GET', '/categorias', null, token);
  const cat = (nome) => categorias.find((c) => c.nome === nome).id;
  const item = (nome, preco) => ({ nome, categoriaId: cat('Mercearia'), unidade: 'Pacote', quantidade: 1, preco });

  // Cada "ida ao mercado" é uma lista com a data de compra recuada. Dias todos diferentes.
  const idas = [
    // Azeite: 4 meses seguidos, o último bem mais barato (R$ 22 contra média de R$ 28,75).
    { dias: 95, itens: [item('Azeite', 30)] },
    { dias: 64, itens: [item('Azeite', 32)] },
    { dias: 33, itens: [item('Azeite', 31)] },
    { dias: 3, itens: [item('Azeite', 22)] },
    // Café e açúcar vão sempre juntos (3 idas); sabão aparece nas outras 3; arroz em todas.
    { dias: 50, itens: [item('Arroz'), item('Café'), item('Açúcar')] },
    { dias: 43, itens: [item('Arroz'), item('Café'), item('Açúcar')] },
    { dias: 36, itens: [item('Arroz'), item('Café'), item('Açúcar')] },
    { dias: 29, itens: [item('Arroz'), item('Sabão')] },
    { dias: 22, itens: [item('Arroz'), item('Sabão')] },
    { dias: 15, itens: [item('Arroz'), item('Sabão')] },
    // Produtos de época: comprados neste mesmo mês, um ano atrás.
    { dias: 365, itens: [item('Peru'), item('Panetone'), item('Nozes')] },
  ];
  for (const ida of idas) {
    const lista = await api('POST', '/listas', { competencia: competenciaDe(ida.dias), origem: 'Zero', permitirDuplicada: true }, token);
    for (const i of ida.itens) {
      const { preco, ...dados } = i;
      const criado = await api('POST', `/listas/${lista.resumo.id}/itens`, dados, token);
      if (preco) await api('PUT', `/listas/${lista.resumo.id}/itens/${criado.id}`, { ...dados, versao: criado.versao, precoUnitario: preco }, token);
      await api('PUT', `/listas/${lista.resumo.id}/itens/${criado.id}/comprado`, { comprado: true }, token);
    }
    sql(`update itens_da_lista set "CompradoEm" = now() - interval '${ida.dias} days' where "ListaId" = '${lista.resumo.id}';`);
  }
}

(async () => {
  await preparar();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-padroes-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 2600, deviceScaleFactor: 1 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}padroes-${String(++passo).padStart(2, '0')}-${nome}.png`) });
  const texto = () => page.evaluate(() => document.body.innerText.replace(/\u00a0/g, ' '));
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  const esperarTexto = async (t, ms = 15000) => {
    const fim = Date.now() + ms;
    while (Date.now() < fim) {
      if ((await texto()).includes(t)) return;
      await pausa(250);
    }
    throw new Error(`não apareceu "${t}". Tela:\n${await texto()}`);
  };
  // Telas anteriores ficam montadas no DOM: para tocar numa aba ou botão, vale o ÚLTIMO elemento com o texto.
  const tocar = async (rotulo) => {
    const ok = await page.evaluate((r) => {
      const todos = [...document.querySelectorAll('[role=button],[role=tab],[role=link],a,button,div[tabindex]')].filter((e) => (e.getAttribute('aria-label') || e.innerText || '').trim().startsWith(r));
      const alvo = todos[todos.length - 1];
      if (alvo) alvo.click();
      return !!alvo;
    }, rotulo);
    if (!ok) throw new Error(`não achei para tocar: ${rotulo}`);
    await pausa(400);
  };
  const confere = (cond, msg) => {
    if (!cond) throw new Error('FALHOU: ' + msg);
    console.log('ok -', msg);
  };
  // Trecho de um cartão: do título até o próximo título de cartão conhecido.
  const cartao = (t, titulo, proximos) => {
    const ini = t.indexOf(titulo);
    if (ini < 0) return '';
    const fins = proximos.map((n) => t.indexOf(n, ini + 1)).filter((i) => i > 0);
    return t.slice(ini, fins.length ? Math.min(...fins) : undefined);
  };

  try {
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Entrar');
    await page.type('input[type=email], input[placeholder*="mail"]', email);
    await page.type('input[type=password]', 'senha1234');
    await tocar('Entrar');
    await esperarTexto('Início');
    await tocar('Análises');
    await esperarTexto('Preço bom na última compra');
    await pausa(800);
    const t = await texto();
    await foto('analises');

    const maisComprados = cartao(t, 'Produtos mais comprados', ['Evolução de preços']);
    confere(maisComprados.includes('Ver todos (8)'), 'Produtos mais comprados: 4 à vista e Ver todos (8)');
    confere(['Arroz', 'Azeite', 'Açúcar', 'Café', 'Sabão', 'Nozes', 'Panetone', 'Peru'].filter((n) => maisComprados.includes(n)).length === 4, 'o cartão de mais comprados mostra só 4 produtos');

    const preco = cartao(t, 'Preço bom na última compra', ['Costumam ir juntos', 'Deste mês']);
    confere(preco.includes('Azeite') && preco.includes('23% abaixo da média'), 'azeite aparece com 23% abaixo da média');
    confere(!preco.includes('Ver todos'), 'um só preço bom: sem Ver todos');

    const juntos = cartao(t, 'Costumam ir juntos', ['Deste mês', 'Atualizar']);
    confere(/Café \+ Açúcar|Açúcar \+ Café/.test(juntos), 'café e açúcar aparecem como par');
    confere(/Ver todos \(\d+\)/.test(juntos), 'os pares passam de 2: Ver todos aparece');
    confere((juntos.match(/ \+ /g) || []).length === 2, 'o cartão mostra só 2 pares');

    const epoca = cartao(t, 'Deste mês, em outros anos', ['Atualizar']);
    confere(epoca.includes('Ver todos (3)'), 'produtos de época: 2 no cartão e Ver todos (3)');
    confere(['Peru', 'Panetone', 'Nozes'].filter((n) => epoca.includes(n)).length === 2, 'o cartão de época mostra só 2 produtos');

    await tocar('Ver todos (3)');
    await pausa(500);
    await foto('folha-epoca');
    const folha = await texto();
    confere(['Peru', 'Panetone', 'Nozes'].every((n) => folha.includes(n)), 'a folha mostra os 3 produtos de época');
    if (erros.length) throw new Error(erros.join('\n'));
    console.log('PADROES OK');
  } catch (e) {
    await foto('erro').catch(() => {});
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
