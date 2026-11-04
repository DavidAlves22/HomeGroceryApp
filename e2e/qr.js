// Ler o QR da nota pela câmera (simulada) dentro do app: reconhece o mercado pelo CNPJ, avisa nota já importada,
// ignora QR que não é de NFC-e e envia a chave de acesso ao importar. A câmera é um canvas que desenha um QR de
// verdade; o app o lê com o mesmo leitor (jsQR) que usa no navegador. Rode também com DARK=1.
// Precisa do pacote de teste: npm i --no-save qrcode puppeteer-core
const puppeteer = require('puppeteer-core');
const QRCode = require('qrcode');
const path = require('path');

const PASTA = path.join(__dirname, 'capturas');
require('fs').mkdirSync(PASTA, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const API = process.env.API_URL || 'http://localhost:5272';
const email = `e2e_qr_${Date.now()}@teste.com`;
let passo = 0;

// QR de uma nota real do WMS (SP): a chave tem CNPJ 93209765050998. O link não é aberto no teste (não há rede para o portal).
const CHAVE = '35261093209765050998655340000029561048579171';
const LINK = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${CHAVE}|2|1|1|7542552EB9442466883AA1E443481D0B2F0A8BFD`;

const NOTA_WMS = `WMS SUPERMERCADOS DO BRASIL LTDA
CNPJ: 93.209.765/0509-98
BISC.PASSATEMPO (Código: AR089183 )
Qtde.:3   UN: UND9   Vl. Unit.:   1,3 \tVl. Total
3,90
Qtd. total de itens:1
Valor a pagar R$:3,90`;

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
  const passatempo = await api('POST', `/listas/${lista.resumo.id}/itens`, { nome: 'Biscoito Passatempo', categoriaId: cat('Mercearia'), unidade: 'Unidade', quantidade: 3 }, token);
  const arroz = await api('POST', `/listas/${lista.resumo.id}/itens`, { nome: 'Arroz', categoriaId: cat('Mercearia'), unidade: 'Unidade', quantidade: 1 }, token);
  await api('PUT', `/listas/${lista.resumo.id}/itens/${arroz.id}/comprado`, { comprado: true }, token);
  await api('POST', `/listas/${lista.resumo.id}/finalizar`, null, token);
  const loja = await api('POST', '/lojas', { nome: 'WMS Araras', cidade: 'Araras' }, token);
  // Uma nota anterior (outra chave) ensina o CNPJ ao mercado: é assim que o app o reconhece depois.
  await api('POST', `/listas/${lista.resumo.id}/nota`, { cnpj: '93.209.765/0509-98', lojaId: loja.id, itens: [{ codigo: 'AR000001', nome: 'Item de uma nota anterior', quantidade: 1, precoUnitario: 2, itemId: null, categoriaId: cat('Mercearia'), unidade: 'Unidade' }] }, token);
  return { token, listaId: lista.resumo.id, passatempo: passatempo.id };
}

(async () => {
  const { token, listaId, passatempo } = await preparar();
  const qrNota = await QRCode.toDataURL(LINK, { margin: 4, width: 420 });
  const qrOutro = await QRCode.toDataURL('https://exemplo.com/promocao', { margin: 4, width: 420 });

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: require('os').tmpdir() + '/e2e-qr-' + Date.now(),
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
  if (process.env.DARK) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  // Câmera de mentira: um canvas que desenha o QR escolhido (window.__qr) e vira o fluxo de vídeo do getUserMedia.
  await page.evaluateOnNewDocument(() => {
    window.__camerasPedidas = 0;
    window.__camerasEncerradas = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      window.__camerasPedidas++;
      const tela = document.createElement('canvas');
      tela.width = 640;
      tela.height = 480;
      const ctx = tela.getContext('2d');
      let desenhando = true;
      const imagem = new Image();
      let atual = null;
      const desenhar = () => {
        if (!desenhando) return;
        ctx.fillStyle = '#888';
        ctx.fillRect(0, 0, 640, 480);
        if (window.__qr && atual !== window.__qr) {
          atual = window.__qr;
          imagem.src = atual;
        }
        if (imagem.complete && imagem.naturalWidth) ctx.drawImage(imagem, 110, 30, 420, 420);
        requestAnimationFrame(desenhar);
      };
      desenhar();
      const fluxo = tela.captureStream(20);
      fluxo.getTracks().forEach((faixa) => {
        const parar = faixa.stop.bind(faixa);
        faixa.stop = () => {
          desenhando = false;
          window.__camerasEncerradas++;
          parar();
        };
      });
      return fluxo;
    };
  });

  const foto = (nome) => page.screenshot({ path: path.join(PASTA, `${process.env.DARK ? 'dark-' : ''}qr-${String(++passo).padStart(2, '0')}-${nome}.png`) });
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
  const clicar = async (t, indice = 0) => {
    await esperarTexto(t);
    const alvos = await page.$$(`xpath/.//*[normalize-space(text())="${t}"]`);
    const alvo = indice < 0 ? alvos[alvos.length - 1] : alvos[indice];
    if (!alvo) throw new Error(`Sem elemento "${t}"`);
    await alvo.click();
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
  const colar = async (conteudo) => {
    const campos = await page.$$('[aria-label="Texto da nota"]');
    await campos[campos.length - 1].click();
    await page.keyboard.sendCharacter(conteudo);
    await pausa(300);
  };
  const verificar = (cond, msg) => {
    if (!cond) throw new Error('FALHOU: ' + msg);
    console.log('  ok -', msg);
  };

  try {
    console.log('1) Abrir "Importar nota fiscal" pelo Histórico');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await esperarTexto('Criar uma conta');
    await digitar('E-mail', email);
    await digitar('Senha', 'senha1234');
    await clicar('Entrar');
    await esperarTexto('Olá');
    await clicar('Histórico', -1);
    await esperarTexto('Importar nota fiscal');
    await clicar('Importar nota fiscal');
    await esperarTexto('Comece pelo QR da nota');
    await foto('tela-com-camera');
    verificar(true, 'a tela oferece "Ler QR da nota com a câmera"');

    console.log('2) Um QR que não é de nota fiscal é ignorado');
    await page.evaluate((u) => (window.__qr = u), qrOutro);
    await clicar('Ler QR da nota com a câmera');
    await esperarTexto('Aponte para o QR da nota');
    await esperarTexto('Este QR não é de uma nota fiscal');
    await foto('qr-invalido');
    verificar(true, 'aviso "Este QR não é de uma nota fiscal (NFC-e)" e a câmera continua procurando');

    console.log('3) O QR da nota é lido: mercado reconhecido pelo CNPJ');
    await page.evaluate((u) => (window.__qr = u), qrNota);
    await esperarTexto('QR lido');
    await esperarTexto('WMS Araras');
    let t = await texto();
    verificar(t.includes('outubro de 2026') && t.includes('SP'), 'mostra o mês e o estado da nota (outubro de 2026 · SP)');
    verificar(t.includes('mercado reconhecido pelo CNPJ'), 'o mercado WMS Araras foi reconhecido pelo CNPJ do QR');
    verificar(t.includes('Abrir a nota'), 'oferece "Abrir a nota" para copiar o texto');
    await foto('qr-lido');
    await pausa(500);
    const cameras = await page.evaluate(() => ({ pedidas: window.__camerasPedidas, encerradas: window.__camerasEncerradas }));
    verificar(cameras.pedidas === 1 && cameras.encerradas >= 1, 'a câmera é desligada assim que o QR é lido');

    console.log('4) Colar o texto e importar: a chave do QR vai junto');
    await colar(NOTA_WMS);
    await clicar('Ler nota');
    await esperarTexto('Reconheci este mercado pelo CNPJ da nota');
    await clicar('Importar 1 item');
    await esperarTexto('Nota importada');
    const apos = await api('GET', `/notas/importada?chave=${CHAVE}`, null, token);
    verificar(apos.importada === true, 'a API guardou a chave de acesso da nota');
    const lista = await api('GET', `/listas/${listaId}`, null, token);
    verificar(lista.itens.find((i) => i.id === passatempo).comprado === true, 'o item foi preenchido e marcado como comprado');

    console.log('5) Ler o mesmo QR de novo: avisa que já foi importada, sem pedir o texto');
    await clicar('Importar outra nota');
    await clicar('Ler QR da nota com a câmera');
    await esperarTexto('Já importada');
    t = await texto();
    verificar(t.includes('Esta nota já foi importada neste grupo'), 'avisa "Esta nota já foi importada neste grupo"');
    verificar(!t.includes('Texto da nota'), 'o campo para colar o texto nem aparece');
    await foto('qr-ja-importado');

    console.log(erros.length ? '\nErros:\n' + erros.join('\n') : '\nSem erros no navegador.');
    console.log('QR OK.');
  } catch (e) {
    await foto('ERRO').catch(() => {});
    console.error('\nERRO:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
