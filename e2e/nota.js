// Importar nota fiscal (NFC-e) depois de finalizar a compra: Histórico > Importar nota fiscal > colar o texto >
// conferir os pares > importar. Duas notas de mercados diferentes, nota repetida e aprendizado por código.
// Prepara a conta pela API. Rode também com DARK=1.
const puppeteer = require('puppeteer-core');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_nota_${Date.now()}@teste.com`;
let passo = 0;

// Texto como o navegador entrega ao copiar a página da NFC-e (o formato real de uma nota do WMS, em SP).
const NOTA_WMS = `WMS SUPERMERCADOS DO BRASIL LTDA
CNPJ: 93.209.765/0509-98
DONA RENATA , 3215 , , VL PASTORELLO , ARARAS , SP
M.PIZZA M.LEVE FRIG. (Código: AR002452 )
Qtde.:1   UN: UND9   Vl. Unit.:   9,5 \tVl. Total
9,50
MIST.BOLO FLEISCHMAN (Código: AR075346 )
Qtde.:1   UN: UND9   Vl. Unit.:   7,98 \tVl. Total
7,98
BISC.GAROTO CHOCO (Código: AR095566 )
Qtde.:1   UN: UND9   Vl. Unit.:   3,99 \tVl. Total
3,99
BISC.PASSATEMPO (Código: AR089183 )
Qtde.:3   UN: UND9   Vl. Unit.:   1,3 \tVl. Total
3,90
BISC.BAUDUCCO COOKIE (Código: AR083168 )
Qtde.:1   UN: UND9   Vl. Unit.:   3,49 \tVl. Total
3,49
BISC.BAUDUCCO WAFER (Código: AR039393 )
Qtde.:1   UN: UND9   Vl. Unit.:   4,39 \tVl. Total
4,39
REQUEIJAO TIROLEZ (Código: AR064480 )
Qtde.:2   UN: UND9   Vl. Unit.:   6,79 \tVl. Total
13,58
QJO.M.PADR.TIROLEZ (Código: AR032886 )
Qtde.:0,48   UN: KG9   Vl. Unit.:   69,9 \tVl. Total
33,55
Qtd. total de itens:8
Valor a pagar R$:80,38`;

// Segunda nota, de outro mercado (outro CNPJ).
const NOTA_OUTRO = `SUPER ECONOMICO LTDA
CNPJ: 11.222.333/0001-81
RUA A , 10 , ARARAS , SP
LEITE INTEGRAL 1L (Código: 7891)
Qtde.:6   UN: UND   Vl. Unit.:   4,99 \tVl. Total
29,94
Qtd. total de itens:1
Valor a pagar R$:29,94`;

// Outra compra no WMS: o nome do produto mudou na nota, mas o CÓDIGO é o mesmo que o app já aprendeu.
const NOTA_WMS_2 = `WMS SUPERMERCADOS DO BRASIL LTDA
CNPJ: 93.209.765/0509-98
WAFER CHOC BAUDUCCO 140G (Código: AR039393 )
Qtde.:2   UN: UND9   Vl. Unit.:   4,59 \tVl. Total
9,18
Qtd. total de itens:1
Valor a pagar R$:9,18`;

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
  const categorias = await api('GET', '/categorias', null, token);
  const cat = (nome) => categorias.find((c) => c.nome === nome).id;
  const agora = new Date();
  const competencia = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const lista = await api('POST', '/listas', { competencia, origem: 'Zero' }, token);
  const ids = {};
  for (const [nome, categoria] of [['Biscoito Passatempo', 'Mercearia'], ['Biscoito Bauducco Wafer', 'Mercearia'], ['Requeijão', 'Laticínios'], ['Queijo Tirolez', 'Laticínios'], ['Arroz', 'Mercearia']]) {
    const item = await api('POST', `/listas/${lista.resumo.id}/itens`, { nome, categoriaId: cat(categoria), unidade: nome.startsWith('Queijo') ? 'Kg' : 'Unidade', quantidade: 1 }, token);
    ids[nome] = item.id;
  }
  // Compra feita no mercado: marca o arroz e finaliza (a nota só é importada depois, em casa).
  await api('PUT', `/listas/${lista.resumo.id}/itens/${ids.Arroz}/comprado`, { comprado: true }, token);
  await api('POST', `/listas/${lista.resumo.id}/finalizar`, null, token);
  const lojaWms = await api('POST', '/lojas', { nome: 'WMS Araras' }, token);
  await api('POST', '/lojas', { nome: 'Super Econômico' }, token);
  return { token, listaId: lista.resumo.id, lojaWms: lojaWms.id };
}

(async () => {
  const { token, listaId, lojaWms } = await preparar();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-nota-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}nota-${String(++passo).padStart(2, '0')}-${nome}.png`), fullPage: false });
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
    await pausa(400);
  };
  const clicarRotulo = async (rotulo) => {
    await page.waitForSelector(`[aria-label="${rotulo}"]`, { timeout: 10000 });
    const el = await page.$$(`[aria-label="${rotulo}"]`);
    await el[el.length - 1].click();
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
  // Cola o texto de uma vez (como o "colar" do celular), sem digitar tecla a tecla.
  const colar = async (conteudo) => {
    const campos = await page.$$('[aria-label="Texto da nota"]');
    const campo = campos[campos.length - 1];
    await campo.click();
    await page.keyboard.sendCharacter(conteudo);
    await pausa(300);
  };
  const verificar = (cond, msg) => {
    if (!cond) throw new Error('FALHOU: ' + msg);
    console.log('  ok -', msg);
  };
  const lista = () => api('GET', `/listas/${listaId}`, null, token);

  try {
    console.log('1) Histórico: o botão aparece porque já há item comprado');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    await clicar('Histórico', -1);
    await esperarTexto('Finalizada');
    await esperarTexto('Importar nota fiscal');
    await foto('historico-com-botao');
    verificar(true, 'Histórico mostra "Importar nota fiscal" na lista com item comprado');

    console.log('2) Colar a primeira nota (WMS) e conferir os pares');
    await clicar('Importar nota fiscal');
    await esperarTexto('Cole o texto da nota fiscal');
    await colar(NOTA_WMS);
    await foto('colada');
    await clicar('Ler nota');
    await esperarTexto('WMS SUPERMERCADOS DO BRASIL LTDA');
    await esperarTexto('total da nota R$ 80,38');
    let t = await texto();
    verificar(t.includes('8 itens'), 'a nota foi lida com 8 itens');
    verificar(t.includes('→ Biscoito Passatempo') && t.includes('→ Biscoito Bauducco Wafer') && t.includes('→ Requeijão'), 'os pares por nome foram sugeridos');
    verificar(t.includes('+ Novo item: M.Pizza M.Leve Frig.'), 'o que não está na lista vira item novo');
    await clicar('WMS Araras');
    await foto('conferir-pares');

    console.log('3) Trocar um par: o queijo da nota é o "Queijo Tirolez" da lista');
    await clicarRotulo('Trocar o par de QJO.M.PADR.TIROLEZ');
    await esperarTexto('É UM ITEM DA SUA LISTA');
    await foto('trocar-par');
    await clicarRotulo('Usar Queijo Tirolez');
    await esperarTexto('→ Queijo Tirolez');
    verificar(true, 'o queijo agora aponta para o item da lista');

    console.log('4) Importar: lista finalizada recebe preços e itens comprados');
    await clicar('Importar 8 itens');
    await esperarTexto('Nota importada');
    await foto('importada');
    let l = await lista();
    const por = (nome) => l.itens.find((i) => i.nome === nome);
    verificar(por('Biscoito Passatempo').comprado && por('Biscoito Passatempo').precoUnitario === 1.3, 'Passatempo: comprado a R$ 1,30');
    verificar(por('Queijo Tirolez').quantidadeComprada === 0.48 && por('Queijo Tirolez').precoUnitario === 69.9, 'Queijo: 0,48 kg a R$ 69,90');
    verificar(l.itens.some((i) => i.nome === 'M.Pizza M.Leve Frig.' && i.comprado), 'o item que não estava na lista entrou comprado');
    verificar(l.resumo.status === 'Finalizada', 'a lista continua finalizada');
    verificar(l.resumo.totalRealizado === 80.38, `o total gasto fechou com a nota (R$ ${l.resumo.totalRealizado})`);
    const lojas = await api('GET', '/lojas', null, token);
    verificar(lojas.find((x) => x.id === lojaWms).cnpj === '93209765050998', 'o mercado WMS aprendeu o CNPJ da nota');
    verificar(por('Biscoito Passatempo').compradoNaLojaId === lojaWms, 'a compra ficou registrada no mercado escolhido');

    console.log('5) Segunda nota, de outro mercado, na mesma tela');
    await clicar('Importar outra nota');
    await esperarTexto('Cole o texto da nota fiscal');
    await colar(NOTA_OUTRO);
    await clicar('Ler nota');
    await esperarTexto('SUPER ECONOMICO LTDA');
    await clicar('Super Econômico');
    await clicar('Importar 1 item');
    await esperarTexto('Nota importada');
    l = await lista();
    verificar(l.itens.some((i) => i.nome === 'M.Pizza M.Leve Frig.') && Math.abs(l.resumo.totalRealizado - 110.32) < 0.001, `o total acumulou as duas notas (R$ ${l.resumo.totalRealizado})`);

    console.log('6) A mesma nota de novo não conta duas vezes');
    await clicar('Importar outra nota');
    await colar(NOTA_WMS);
    await clicar('Ler nota');
    await esperarTexto('WMS SUPERMERCADOS DO BRASIL LTDA');
    // Os pares agora vêm pelo código aprendido.
    t = await texto();
    verificar((t.match(/pelo código/g) ?? []).length >= 6, 'os itens já ensinados vêm "pelo código"');
    await clicar('Importar 8 itens');
    await esperarTexto('já foi importada');
    verificar(true, 'a nota repetida é recusada: "Esta nota já foi importada"');
    verificar((await lista()).resumo.totalRealizado === 110.32 + 0, 'o total não mudou');
    await foto('nota-repetida');

    console.log('7) Outra compra no WMS: o nome muda na nota, mas o código ensinado leva ao mesmo item');
    await clicar('Voltar para colar');
    await colar(NOTA_WMS_2);
    await clicar('Ler nota');
    await esperarTexto('WAFER CHOC BAUDUCCO 140G');
    await esperarTexto('→ Biscoito Bauducco Wafer');
    verificar((await texto()).includes('pelo código'), 'o par veio pelo código, não pelo nome');
    await foto('par-pelo-codigo');

    console.log(erros.length ? '\nErros:\n' + erros.join('\n') : '\nSem erros no navegador.');
    console.log('Nota OK.');
  } catch (e) {
    await foto('ERRO').catch(() => {});
    console.error('\nERRO:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
