// Contato e feedback: o administrador cadastra informações dinâmicas (título, descrição opcional, valor) e responde mensagens;
// o usuário vê as informações, envia um feedback, acompanha o status e vê a resposta nova até abri-la.
// Precisa da API com Admin__Emails__0=admin@e2e.com. Prepara as contas pela API; depois usa só a tela. Rode também com DARK=1.
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const EMAIL_ADMIN = 'admin@e2e.com';
const emailUsuario = `e2e_contato_${Date.now()}@teste.com`;
let passo = 0;

async function api(metodo, caminho, corpo, token) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
}

/** O administrador é um só: se já existe de outra rodada, só entra. */
async function prepararContas() {
  const entrada = await api('POST', '/autenticacao/login', { email: EMAIL_ADMIN, senha: 'senha1234' });
  let tokenAdmin = entrada.corpo?.tokenDeAcesso;
  if (!tokenAdmin) {
    const cad = await api('POST', '/autenticacao/cadastro', { nome: 'Dono do App', email: EMAIL_ADMIN, senha: 'senha1234' });
    tokenAdmin = cad.corpo.tokenDeAcesso;
  }
  await api('POST', '/autenticacao/cadastro', { nome: 'Maria Souza', email: emailUsuario, senha: 'senha1234' });

  // Começa do zero: apaga as informações que sobraram de rodadas anteriores.
  const caixa = await api('GET', '/admin/mensagens', null, tokenAdmin);
  for (const info of caixa.corpo.informacoes) await api('DELETE', `/admin/contato/informacoes/${info.id}`, null, tokenAdmin);
}

(async () => {
  await prepararContas();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-contato-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const erros = [];
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  const confere = (cond, msg) => {
    if (!cond) throw new Error('FALHOU: ' + msg);
    console.log('ok -', msg);
  };

  /** Uma pessoa = um contexto isolado (sessão própria no navegador). */
  async function abrir(email, nome) {
    const contexto = await browser.createBrowserContext();
    await contexto.overridePermissions(BASE, ['clipboard-read', 'clipboard-write']);
    const page = await contexto.newPage();
    await page.setViewport({ width: 390, height: 1500, deviceScaleFactor: 2 });
    if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
    const foto = (n) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}contato-${String(++passo).padStart(2, '0')}-${nome}-${n}.png`) });
    const texto = () => page.evaluate(() => document.body.innerText.replace(/\u00a0/g, ' '));
    const esperarTexto = async (t, ms = 15000) => {
      const fim = Date.now() + ms;
      while (Date.now() < fim) {
        if ((await texto()).toLowerCase().includes(t.toLowerCase())) return;
        await pausa(250);
      }
      throw new Error(`[${nome}] não apareceu "${t}". Tela:\n${(await texto()).slice(0, 1200)}`);
    };
    const clicar = async (t) => {
      await esperarTexto(t);
      const alvos = await page.$$(`xpath/.//*[normalize-space(text())="${t}"]`);
      if (alvos.length === 0) throw new Error(`Sem elemento "${t}"`);
      await alvos[alvos.length - 1].click();
      await pausa(450);
    };
    const digitar = async (rotulo, valor) => {
      const seletor = `[aria-label="${rotulo}"]`;
      await page.waitForSelector(seletor, { timeout: 10000 });
      await page.click(seletor);
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.type(seletor, valor);
    };
    const voltar = async () => {
      await page.click('[aria-label="Voltar"]');
      await pausa(500);
    };

    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    await clicar('Mais');
    await esperarTexto('Sair da conta');
    return { page, foto, texto, esperarTexto, clicar, digitar, voltar };
  }

  try {
    // 1. Administrador: o card de contato existe para ele também, separado do painel; cadastra as informações.
    const admin = await abrir(EMAIL_ADMIN, 'admin');
    let t = await admin.texto();
    confere(t.includes('Contato e feedback'), 'o card "Contato e feedback" aparece também para o administrador');
    confere(t.includes('Painel do administrador') && t.includes('Mensagens dos usuários'), 'o painel tem o atalho "Mensagens dos usuários"');
    await admin.foto('mais');

    await admin.clicar('Mensagens dos usuários');
    await admin.esperarTexto('Card de contato');
    await admin.esperarTexto('Nenhuma informação ainda');
    await admin.clicar('Adicionar informação');
    await admin.esperarTexto('Nova informação');
    await admin.clicar('Salvar');
    await admin.esperarTexto('Informe o título.');
    await admin.digitar('Título', 'Email para contato');
    await admin.clicar('Salvar');
    await admin.esperarTexto('Informe o valor.');
    await admin.digitar('Descrição (opcional)', 'Caso queira mandar um email');
    await admin.digitar('Valor', 'david.alves@teste.com');
    await admin.foto('nova-informacao');
    await admin.clicar('Salvar');
    await admin.esperarTexto('Informação salva');
    await admin.esperarTexto('david.alves@teste.com');

    await admin.clicar('Adicionar informação');
    await admin.digitar('Título', 'Chave Pix para ajuda');
    await admin.digitar('Valor', 'saudhqgfryu1h3u190u90uq');
    await admin.clicar('Salvar');
    await admin.esperarTexto('saudhqgfryu1h3u190u90uq');
    await admin.foto('informacoes');

    // 2. Usuário: vê só o conteúdo (sem as palavras "Título/Descrição/Valor"), e a descrição só onde existe.
    const maria = await abrir(emailUsuario, 'maria');
    await maria.clicar('Contato e feedback');
    await maria.esperarTexto('Fale com a gente');
    await maria.esperarTexto('saudhqgfryu1h3u190u90uq');
    t = await maria.texto();
    confere(t.includes('Email para contato') && t.includes('Caso queira mandar um email') && t.includes('david.alves@teste.com'), 'o usuário vê título, descrição e valor da primeira informação');
    confere(t.includes('Chave Pix para ajuda'), 'o usuário vê a segunda informação');
    confere(!/caso queira contribuir/i.test(t), 'a segunda não tem descrição e nada dela é inventado');
    confere(!/\bT[ií]tulo\b|\bDescri[cç][aã]o\b|\bValor\b/.test(t), 'as palavras Título, Descrição e Valor não aparecem para o usuário');
    confere(t.includes('Você ainda não enviou nenhuma mensagem'), 'sem mensagens, o estado vazio explica o que fazer');
    confere((await maria.page.$$('xpath/.//*[normalize-space(text())="Copiar"]')).length === 0, 'não há botões de texto Copiar/Abrir, só o ícone');
    await maria.page.click('[aria-label="Copiar Chave Pix para ajuda"]');
    await maria.esperarTexto('Copiado para a área de transferência');
    confere((await maria.page.evaluate(() => navigator.clipboard.readText())) === 'saudhqgfryu1h3u190u90uq', 'o ícone copia o valor para a área de transferência');
    await maria.foto('contato');

    // 3. Usuário envia um feedback; vê "Recebida".
    await maria.clicar('Novo feedback ou solicitação');
    await maria.esperarTexto('O que você quer enviar?');
    await maria.clicar('Enviar');
    await maria.esperarTexto('Escreva um assunto');
    await maria.clicar('Solicitação');
    await maria.digitar('Assunto', 'Rota no Savegnago');
    await maria.digitar('Mensagem', 'A rota não passa pelo açougue, podem ajustar?');
    await maria.foto('formulario');
    await maria.clicar('Enviar');
    await maria.esperarTexto('Mensagem enviada');
    t = await maria.texto();
    confere(t.includes('Rota no Savegnago') && t.includes('Recebida') && t.includes('Solicitação'), 'a mensagem aparece em "Suas mensagens" com tipo e status Recebida');
    await maria.foto('enviada');

    // 4. Administrador vê a mensagem, com quem enviou, e responde.
    await admin.voltar();
    await admin.clicar('Mensagens dos usuários');
    await admin.esperarTexto('Rota no Savegnago');
    t = await admin.texto();
    confere(t.includes('Maria Souza') && t.includes(emailUsuario), 'o administrador vê quem enviou');
    confere(/\d+ aguardando resposta/.test(t), 'o contador de aguardando resposta aparece');
    await admin.foto('caixa');
    await admin.clicar('Responder');
    await admin.esperarTexto('Sua resposta');
    await admin.clicar('Salvar');
    await admin.esperarTexto('Escreva a resposta');
    await admin.digitar('Sua resposta', 'Ajustado! Vai valer na próxima versão.');
    await admin.foto('responder');
    await admin.clicar('Salvar');
    await admin.esperarTexto('Resposta salva');
    await admin.clicar('Respondidas');
    await admin.esperarTexto('Ajustado! Vai valer na próxima versão.');
    await admin.foto('respondida');

    // 5. Usuário: "1 resposta nova" em Mais; abre e some.
    await maria.voltar();
    await maria.page.reload({ waitUntil: 'networkidle2' });
    await maria.clicar('Mais');
    await maria.esperarTexto('1 resposta nova');
    await maria.foto('mais-resposta-nova');
    await maria.clicar('Contato e feedback');
    await maria.esperarTexto('Resposta nova');
    t = await maria.texto();
    confere(t.includes('Respondida'), 'o status mudou para Respondida');
    await maria.clicar('Rota no Savegnago');
    await maria.esperarTexto('Ajustado! Vai valer na próxima versão.');
    await maria.foto('resposta');
    await maria.voltar();
    await maria.page.reload({ waitUntil: 'networkidle2' });
    await maria.clicar('Mais');
    await maria.esperarTexto('Fale com a gente, envie sugestões e pedidos');
    confere(!(await maria.texto()).includes('resposta nova'), 'depois de abrir a resposta, o aviso "resposta nova" some');

    // 6. Usuário comum não vê nada de administrador.
    t = await maria.texto();
    confere(!t.includes('Mensagens dos usuários') && !t.includes('Painel do administrador'), 'usuário comum não tem atalhos de administrador');

    // 7. Administrador remove uma informação; some para o usuário.
    await admin.page.click('[aria-label="Editar Email para contato"]');
    await pausa(450);
    await admin.esperarTexto('Editar informação');
    await admin.clicar('Excluir');
    await admin.esperarTexto('Toque de novo para excluir');
    await admin.clicar('Toque de novo para excluir');
    await admin.esperarTexto('Informação excluída');
    const sessao = await api('POST', '/autenticacao/login', { email: emailUsuario, senha: 'senha1234' });
    const visto = await api('GET', '/contato', null, sessao.corpo.tokenDeAcesso);
    confere(visto.corpo.informacoes.length === 1, 'a informação excluída deixa de aparecer para os usuários');

    if (erros.length) throw new Error(erros.join('\n'));
    console.log('CONTATO OK');
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
