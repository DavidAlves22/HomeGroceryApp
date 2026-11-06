// Sugestão inteligente em Nova lista. Monta o histórico pela API, recua as datas de compra direto no banco
// (o servidor grava a data real, e a sugestão depende de intervalos de dias) e dirige só a tela.
// Precisa do contêiner `homegroceryapi-banco-1` no ar. Rode também com DARK=1.
const puppeteer = require('puppeteer-core');
const { execFileSync } = require('child_process');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_sugestao_${Date.now()}@teste.com`;
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
  const item = (nome, categoria, unidade, quantidade) => ({ nome, categoriaId: cat(categoria), unidade, quantidade });

  // Três compras em listas de meses diferentes (as listas só existem para guardar as datas).
  // Arroz: 62 e 31 dias atrás (ciclo ~1 mês, previsto para hoje). Carne: 25 e 14 dias atrás, 2 kg (ciclo 11, previsto há 3 dias: atrasada).
  // Leite: comprado só uma vez (sem ritmo, não deve aparecer).
  const compras = [
    { dias: 62, itens: [item('Arroz', 'Mercearia', 'Pacote', 1), item('Feijão', 'Mercearia', 'Pacote', 1), item('Café', 'Mercearia', 'Pacote', 1)] },
    { dias: 31, itens: [item('Arroz', 'Mercearia', 'Pacote', 1), item('Feijão', 'Mercearia', 'Pacote', 1), item('Café', 'Mercearia', 'Pacote', 1)] },
    { dias: 25, itens: [item('Carne moída', 'Açougue', 'Kg', 2)] },
    { dias: 14, itens: [item('Carne moída', 'Açougue', 'Kg', 2), item('Leite', 'Laticínios', 'Litro', 6)] },
    // Sal: comprado uma vez, há 120 dias, e está na lista padrão (parado).
    { dias: 120, itens: [item('Sal', 'Mercearia', 'Pacote', 1), item('Açúcar', 'Mercearia', 'Pacote', 1), item('Farinha', 'Mercearia', 'Pacote', 1)] },
  ];
  for (const nome of ['Sal', 'Açúcar', 'Farinha']) await api('POST', '/modelo/itens', item(nome, 'Mercearia', 'Pacote', 1), token);
  for (const compra of compras) {
    // Uma lista por compra; o mês de cada uma é só para não bater na regra de uma principal por mês.
    const lista = await api('POST', '/listas', { competencia: competenciaDe(compra.dias), origem: 'Zero', permitirDuplicada: true }, token);
    for (const i of compra.itens) {
      const criado = await api('POST', `/listas/${lista.resumo.id}/itens`, i, token);
      await api('PUT', `/listas/${lista.resumo.id}/itens/${criado.id}/comprado`, { comprado: true }, token);
    }
    sql(`update itens_da_lista set "CompradoEm" = now() - interval '${compra.dias} days' where "ListaId" = '${lista.resumo.id}';`);
  }
}

(async () => {
  await preparar();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-sugestao-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}sugestao-${String(++passo).padStart(2, '0')}-${nome}.png`) });
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
  const tocar = async (rotulo) => {
    const ok = await page.evaluate((r) => {
      const alvo = [...document.querySelectorAll('[role=button],[role=radio],[role=checkbox],[role=tab],[role=link],a,button,div[tabindex]')].find((e) => (e.getAttribute('aria-label') || e.innerText || '').trim().startsWith(r));
      if (alvo) alvo.click();
      return !!alvo;
    }, rotulo);
    if (!ok) throw new Error(`não achei para tocar: ${rotulo}`);
    await pausa(300);
  };
  const confere = (cond, msg) => {
    if (!cond) throw new Error('FALHOU: ' + msg);
    console.log('ok -', msg);
  };

  try {
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Entrar');
    await page.type('input[type=email], input[placeholder*="mail"]', email);
    await page.type('input[type=password]', 'senha1234');
    await tocar('Entrar');
    await esperarTexto('Início');

    await page.goto(BASE + '/nova-lista', { waitUntil: 'networkidle2' }).catch(() => {});
    if (!(await texto()).includes('Nova lista')) {
      await tocar('Criar lista');
    }
    await esperarTexto('Sugestão inteligente');
    await foto('opcoes');

    await tocar('Sugestão inteligente');
    await tocar('Continuar');
    await esperarTexto('Escolha os produtos');
    const t = await texto();
    await foto('sugestao');
    confere(t.includes('Carne moída · atrasado'), 'carne aparece como atrasada');
    confere(t.includes('Arroz'), 'arroz aparece no ciclo');
    confere(!t.includes('Leite'), 'leite (uma compra só) não aparece');
    confere(t.includes('2 kg') || t.includes('2 Kg'), 'quantidade típica da carne é 2 kg');
    confere(t.includes('Criar lista com 4 produtos'), 'os 4 vêm marcados');

    // Desmarca arroz, feijão e café e cria: só a carne entra.
    for (const nome of ['Arroz', 'Feijão', 'Café']) await tocar(nome);
    await esperarTexto('Criar lista com 1 produto');
    await tocar('Criar lista com 1 produto');
    await esperarTexto('Carne moída');
    const lista = await texto();
    await foto('lista-criada');
    confere(!lista.includes('Arroz'), 'arroz desmarcado ficou de fora da lista criada');
    if (erros.length) throw new Error(erros.join('\n'));
    // Início: o arroz está no ciclo e não está pendente em nenhuma lista do mês; a carne já foi para a lista criada acima.
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Hora de repor');
    const inicio = await texto();
    await foto('inicio-repor');
    const cartao = inicio.slice(inicio.indexOf('Hora de repor'), inicio.indexOf('Pedir item'));
    confere((cartao.match(/Adicionar/g) || []).length === 2, 'o cartão mostra só 2 sugestões');
    confere(cartao.includes('Ver todos (3)'), 'o botão Ver todos mostra o total (3)');
    confere(!/Hora de repor[sS]*Carne moída/.test(inicio), 'a carne (já pendente na lista do mês) não é sugerida de novo');
    await tocar('Adicionar');
    await esperarTexto('entrou na lista');
    await pausa(1200);
    const depois = await texto();
    const cartao2 = depois.slice(depois.indexOf('Hora de repor'), depois.indexOf('Pedir item'));
    confere((cartao2.match(/Adicionar/g) || []).length === 2, 'adicionou um e o cartão continua com 2 (a próxima ocupou o lugar)');
    confere(!cartao2.includes('Ver todos'), 'com só 2 restantes o Ver todos some');
    await foto('inicio-repor-depois');

    // Lista padrão: o sal parado há 120 dias aparece e pode ser tirado (segundo toque confirma).
    await tocar('Lista padrão');
    await esperarTexto('Parados há muito tempo');
    await foto('lista-padrao-parados');
    const parados = await texto();
    confere(parados.includes('Ver todos (3)'), 'parados: 2 no cartão e Ver todos (3)');
    await tocar('Ver todos (3)');
    await pausa(500);
    await foto('lista-padrao-folha');
    const folha = await texto();
    confere(folha.includes('Farinha') && folha.includes('Açúcar') && folha.includes('Sal'), 'a folha lista os 3 parados');
    await tocar('Fechar');
    await pausa(600);
    await tocar('Tirar');
    await tocar('Confirmar');
    await esperarTexto('Removido da lista padrão');
    await pausa(1200);
    const apos = await texto();
    confere(!apos.includes('Ver todos'), 'tirou um: restam 2 e o Ver todos some');
    console.log('SUGESTAO OK');
  } catch (e) {
    await foto('erro').catch(() => {});
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
