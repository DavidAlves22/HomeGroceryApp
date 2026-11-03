// Divisão da compra em família: quem pega cada categoria e a rota só de cada pessoa.
// Prepara duas contas na mesma família e um mercado pela API; depois usa só a tela. Rode também com DARK=1.
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_divisao_${Date.now()}@teste.com`;
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
  const esposa = await api('POST', '/autenticacao/cadastro', { nome: 'Ana Souza', email: `ana_${email}`, senha: 'senha1234' });
  const convite = await api('POST', '/grupo/convites', null, token);
  await api('POST', '/grupo/entrar', { codigo: convite.codigo }, esposa.tokenDeAcesso);

  const categorias = await api('GET', '/categorias', null, token);
  const cat = (nome) => categorias.find((c) => c.nome === nome).id;
  const agora = new Date();
  const competencia = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const lista = await api('POST', '/listas', { competencia, origem: 'Zero' }, token);
  for (const [nome, categoria] of [['Arroz', 'Mercearia'], ['Frango', 'Açougue'], ['Pão francês', 'Padaria']]) {
    await api('POST', `/listas/${lista.resumo.id}/itens`, { nome, categoriaId: cat(categoria), unidade: 'Unidade', quantidade: 1 }, token);
  }
  const area = (x, y, largura, altura) => ({ x, y, largura, altura });
  const loja = await api('POST', '/lojas', { nome: 'Mercado A' }, token);
  await api('PUT', `/lojas/${loja.id}/mapa`, {
    nome: 'Mercado A', largura: 34, altura: 40, entrada: { x: 16, y: 37 }, caixas: area(24, 34, 7, 2), versao: loja.versao,
    secoes: [
      { nome: 'Açougue', dividida: false, area: area(3, 3, 10, 3), categoriasLadoA: [cat('Açougue')], categoriasLadoB: [] },
      { nome: 'Padaria', dividida: false, area: area(16, 3, 10, 3), categoriasLadoA: [cat('Padaria')], categoriasLadoB: [] },
      { nome: 'Mercearia', dividida: false, area: area(8, 22, 14, 3), categoriasLadoA: [cat('Mercearia')], categoriasLadoB: [] },
    ],
  }, token);
  return { token, esposaId: esposa.usuario.id, listaId: lista.resumo.id };
}

(async () => {
  const { token, esposaId, listaId } = await preparar();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-divisao-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}divisao-${String(++passo).padStart(2, '0')}-${nome}.png`) });
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
    await pausa(450);
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
  // Itens que aparecem como parada da rota (o mapa e os cartões repetem nomes; olhamos o texto da página).
  const paradas = async () => {
    const t = await texto();
    return { arroz: t.includes('Arroz'), frango: t.includes('Frango'), pao: t.includes('Pão francês') };
  };

  try {
    console.log('1) Entrar e abrir a lista da família');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    await clicar('Lista', -1);
    await esperarTexto('Dividir a compra');
    await foto('lista-sem-divisao');

    console.log('2) Dividir: Açougue com a Ana, Padaria comigo, Mercearia de todos');
    await clicar('Dividir a compra', -1);
    await esperarTexto('Escolha quem pega cada categoria');
    // Cada categoria tem os chips Todos / Eu / Ana, nessa ordem: Mercearia, Açougue, Padaria.
    const chipsDe = async (categoria, rotulo) => {
      const ok = await page.evaluate(
        (cat, rot) => {
          const titulos = [...document.querySelectorAll('div,span')].filter((e) => e.children.length === 0 && e.textContent.trim() === cat);
          const titulo = titulos[titulos.length - 1];
          if (!titulo) return false;
          const bloco = titulo.parentElement;
          const chip = [...bloco.querySelectorAll('[role=button]')].find((c) => c.textContent.trim() === rot);
          if (!chip) return false;
          chip.click();
          return true;
        },
        categoria,
        rotulo,
      );
      if (!ok) throw new Error(`chip ${rotulo} de ${categoria} não encontrado`);
      await pausa(300);
    };
    await chipsDe('Açougue', 'Ana');
    await chipsDe('Padaria', 'Eu');
    await foto('folha-divisao');
    await clicar('Salvar divisão', -1);
    await esperarTexto('Compra dividida');
    await esperarTexto('Mudar a divisão');
    let t = await texto();
    verificar(t.includes('Ana: Açougue') || /Ana:\s*Açougue/.test(t), 'resumo mostra "Ana: Açougue"');
    verificar(/Você:\s*Padaria/.test(t), 'resumo mostra "Você: Padaria"');
    const lista = await api('GET', `/listas/${listaId}`, null, token);
    verificar(lista.divisao.length === 2 && lista.divisao.some((d) => d.usuarioId === esposaId), 'a API guardou a divisão');
    const fundo = (rotulo) => page.evaluate((r) => { const el = [...document.querySelectorAll('[aria-label="' + r + '"]')].pop(); return getComputedStyle(el.parentElement).backgroundColor; }, rotulo);
    const fundoFrango = await fundo('Frango, 1 unidade');
    const fundoArroz = await fundo('Arroz, 1 unidade');
    verificar(fundoFrango !== fundoArroz, 'o item da Ana tem outra cor de fundo (' + fundoFrango + ' x ' + fundoArroz + ')');
    verificar(t.includes('Com Ana'), 'o item da Ana diz "Com Ana"');
    verificar((await fundo('Pão francês, 1 unidade')) === fundoArroz, 'os meus itens e os de todos mantêm a cor normal');
    await foto('lista-dividida');

    console.log('3) Minha rota: sem o frango da Ana, com "Com Ana"');
    await clicar('Rota em Mercado A');
    await esperarTexto('ROTA DE');
    await esperarTexto('Com Ana');
    t = await texto();
    verificar(t.includes('Com Ana') && t.includes('Frango'), 'o frango aparece só como "Com Ana"');
    let p = await paradas();
    verificar(p.arroz && p.pao, 'o arroz (de todos) e o pão (meu) estão na minha rota');
    await foto('minha-rota');

    console.log('4) Rota de "Todos" e rota da Ana');
    await clicar('Todos', -1);
    await pausa(800);
    t = await texto();
    verificar(!t.includes('Com Ana'), 'em "Todos" ninguém fica de fora');
    await clicar('Ana', -1);
    await pausa(800);
    t = await texto();
    verificar(t.includes('Com David') && t.includes('Pão francês'), 'na rota da Ana, o pão fica "Com David"');
    await foto('rota-da-ana');

    console.log('5) Desfazer a divisão');
    await page.click('[aria-label="Voltar"]');
    await esperarTexto('Mudar a divisão');
    await clicar('Mudar a divisão', -1);
    await clicar('Desfazer divisão', -1);
    await esperarTexto('Divisão desfeita');
    verificar((await api('GET', `/listas/${listaId}`, null, token)).divisao.length === 0, 'a divisão foi desfeita na API');

    console.log(erros.length ? '\nErros:\n' + erros.join('\n') : '\nSem erros no navegador.');
    console.log('Divisão OK.');
  } catch (e) {
    await foto('ERRO').catch(() => {});
    console.error('\nERRO:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
