// Duas pessoas, dois navegadores isolados, uma família: convite, tempo real, nomes e remoção.
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const PASTA = path.join(__dirname, 'capturas');
fs.mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const sufixo = Date.now();
let passo = 0;

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ferramentas de interação ligadas a UMA página (cada pessoa tem a sua). */
function ferramentas(page, quem) {
  const texto = () => page.evaluate(() => document.body.innerText.replace(/\u00a0/g, ' '));
  const foto = (nome) =>
    page.screenshot({
      path: path.join(PASTA, `familia-${String(++passo).padStart(2, '0')}-${quem}-${nome}.png`),
    });
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
      await foto('FALHA');
      throw new Error(`[${quem}] não apareceu "${t}". Tela:\n${(await texto()).slice(0, 700)}`);
    }
  };
  const clicar = async (t, indice = 0) => {
    await esperarTexto(t);
    const alvos = await page.$$(`xpath/.//*[normalize-space(text())="${t}"]`);
    // indice -1 = o último (telas já montadas por baixo repetem títulos como "Mais"; o botão da aba vem depois).
    const alvo = indice < 0 ? alvos[alvos.length - 1] : alvos[indice];
    if (!alvo) throw new Error(`[${quem}] sem elemento "${t}". Tela: ${(await texto()).slice(0, 400)}`);
    await alvo.click();
    await pausa(350);
  };
  const clicarRotulo = async (rotulo) => {
    await page.waitForSelector(`[aria-label="${rotulo}"]`, { timeout: 10000 });
    await page.click(`[aria-label="${rotulo}"]`);
    await pausa(350);
  };
  const digitar = async (rotulo, valor) => {
    await page.waitForSelector(`[aria-label="${rotulo}"]`, { timeout: 10000 });
    await page.click(`[aria-label="${rotulo}"]`, { clickCount: 3 });
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type(`[aria-label="${rotulo}"]`, valor);
  };
  return { texto, foto, esperarTexto, clicar, clicarRotulo, digitar };
}

const verificar = (cond, msg) => {
  if (!cond) throw new Error('FALHOU: ' + msg);
  console.log('  ok -', msg);
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-familia-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });

  // Contextos separados = localStorage separado = duas pessoas de verdade.
  const ctxAna = await browser.createBrowserContext();
  const ctxBruno = await browser.createBrowserContext();
  const paginaAna = await ctxAna.newPage();
  const paginaBruno = await ctxBruno.newPage();
  for (const p of [paginaAna, paginaBruno])
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const ana = ferramentas(paginaAna, 'ana');
  const bruno = ferramentas(paginaBruno, 'bruno');

  const cadastrar = async (pagina, f, nome) => {
    await pagina.goto(BASE, { waitUntil: 'networkidle2' });
    await f.clicar('Criar uma conta');
    await f.digitar('Nome', nome);
    await f.digitar('E-mail', `${nome.toLowerCase()}_${sufixo}@teste.com`);
    await f.digitar('Senha', 'senha1234');
    await f.clicar('Criar conta');
    await f.esperarTexto('Sem lista para');
  };

  try {
    console.log('1) Ana se cadastra e cria uma lista com dois produtos');
    await cadastrar(paginaAna, ana, 'Ana');
    const sessaoAna = JSON.parse(
      await paginaAna.evaluate(() => localStorage.getItem('homegrocery.sessao')),
    );
    const api = async (metodo, caminho, corpo) => {
      const r = await fetch(API + caminho, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + sessaoAna.tokenDeAcesso,
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${await r.text()}`);
      return r.status === 204 ? null : r.json();
    };
    const hoje = new Date();
    const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const cats = await api('GET', '/categorias');
    const lista = (await api('POST', '/listas', { competencia, origem: 'Zero' })).resumo.id;
    for (const [nome, cat, un, qtd] of [
      ['Arroz', 'Mercearia', 'Pacote', 2],
      ['Leite', 'Laticínios', 'Litro', 6],
    ]) {
      await api('POST', `/listas/${lista}/itens`, {
        nome,
        categoriaId: cats.find((c) => c.nome === cat).id,
        unidade: un,
        quantidade: qtd,
      });
    }

    console.log('2) Ana gera um código de convite pelo app');
    await paginaAna.reload({ waitUntil: 'networkidle2' });
    await ana.clicar('Mais');
    await ana.clicar('Grupo familiar');
    await ana.esperarTexto('Só você está neste grupo');
    await ana.clicar('Gerar código de convite');
    await ana.esperarTexto('Vale até');
    const codigo = ((await ana.texto()).match(/[A-Z2-9]{4}-[A-Z2-9]{4}/) || [])[0];
    verificar(!!codigo, `código de convite exibido (${codigo})`);
    await ana.foto('convite');

    console.log('3) Bruno se cadastra e entra na família com o código');
    await cadastrar(paginaBruno, bruno, 'Bruno');
    await bruno.clicar('Mais');
    await bruno.clicar('Grupo familiar');
    await bruno.digitar('Código de convite', codigo.toLowerCase());
    await bruno.foto('digitando-codigo');
    await bruno.clicar('Entrar na família');
    await bruno.esperarTexto('Você entrou no grupo');
    await bruno.clicar('Lista'); // aba Lista: agora é a lista da Ana
    await bruno.esperarTexto('Arroz');
    verificar((await bruno.texto()).includes('Leite'), 'Bruno vê a lista que a Ana criou');
    await bruno.esperarTexto('Ao vivo');
    verificar(true, 'indicador "Ao vivo" aparece (tempo real conectado)');
    await bruno.foto('lista-da-familia');

    console.log('4) Ana marca o Arroz; Bruno vê na hora, sem recarregar');
    await ana.clicarRotulo('Voltar'); // sai da tela do grupo para as abas
    await ana.clicar('Lista');
    await ana.esperarTexto('Arroz');
    await ana.clicarRotulo('Arroz, 2 pacote');
    await bruno.esperarTexto('1 de 2 comprados', 12000);
    await bruno.esperarTexto('Ana marcou', 12000);
    verificar(true, 'Bruno vê o Arroz marcado, com "Ana marcou", sem recarregar a página');
    await bruno.foto('viu-marcacao-da-ana');

    console.log('5) Bruno marca o Leite; Ana vê na hora');
    await bruno.clicarRotulo('Leite, 6 litro');
    await ana.esperarTexto('2 de 2 comprados', 12000);
    await ana.esperarTexto('Bruno marcou', 12000);
    verificar(true, 'Ana vê o Leite marcado, com "Bruno marcou"');
    await ana.foto('viu-marcacao-do-bruno');

    console.log('6) O grupo mostra os dois membros; Ana remove o Bruno');
    await ana.clicar('Mais', -1);
    await ana.clicar('Grupo familiar');
    await ana.esperarTexto('Convidar alguém'); // só existe na tela do grupo (abas ficam montadas por baixo)
    await ana.foto('membros');
    const tGrupo = await ana.texto();
    verificar(
      tGrupo.includes('Administrador') && tGrupo.includes('Membro'),
      'papéis de Administrador e Membro exibidos',
    );
    await ana.clicarRotulo('Remover Bruno');
    await ana.clicar('Confirmar');

    console.log('7) Bruno perde o acesso à família e volta às próprias listas');
    // O aviso em tempo real faz o app renovar a sessão e recomeçar no grupo pessoal do Bruno (vazio).
    await bruno.esperarTexto('Sem lista para', 15000);
    const tRemovido = await bruno.texto();
    verificar(
      !tRemovido.includes('Arroz') && !tRemovido.includes('Leite'),
      'Bruno não vê mais os dados da família, sem recarregar a página',
    );
    await bruno.foto('removido');

    console.log('\nFamília OK.');
  } catch (e) {
    console.error('\nERRO NO FLUXO:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
