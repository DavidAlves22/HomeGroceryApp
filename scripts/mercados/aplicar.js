// Aplica o mapa do Favetta na SUA conta: `node scripts/mercados/aplicar.js`.
// Pede e-mail e senha no seu terminal (a senha não aparece e não é guardada em lugar nenhum), entra na API, cria as
// categorias que faltam no seu grupo, cria o mercado "Favetta" (ou reaproveita) e salva o mapa.
// Variável opcional: API_URL (padrão: a API publicada no Render).
const readline = require('readline');
// Uso: node scripts/mercados/aplicar.js <mercado>   (mercado = nome do arquivo, ex.: savegnago; padrão favetta)
const { mapa } = require('./' + (process.argv[2] || 'favetta'));

const API = (process.env.API_URL || 'https://homegrocery-api.onrender.com').replace(/\/$/, '');

function perguntar(texto, oculto) {
  return new Promise((resolver) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    if (oculto) {
      rl._writeToOutput = (s) => {
        if (s.startsWith(texto)) rl.output.write(texto);
      };
    }
    rl.question(texto, (resposta) => {
      rl.close();
      if (oculto) process.stdout.write('\n');
      resolver(resposta.trim());
    });
  });
}

async function chamar(metodo, caminho, corpo, token) {
  const resposta = await fetch(API + caminho, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(90000),
  });
  const texto = await resposta.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!resposta.ok) {
    const detalhe = dados?.erros?.join?.(' ') || dados?.mensagem || dados?.title || texto;
    throw new Error(`${metodo} ${caminho} -> ${resposta.status}: ${detalhe}`);
  }
  return dados;
}

(async () => {
  console.log(`API: ${API} (a primeira chamada pode demorar se o servidor estiver dormindo)`);
  const email = process.env.MERCADO_EMAIL || (await perguntar('E-mail da sua conta: '));
  const senha = process.env.MERCADO_SENHA || (await perguntar('Senha: ', true));

  const cidade =
    process.env.MERCADO_CIDADE || mapa.cidade || (await perguntar('Cidade do mercado (ex.: Araras): '));
  if (!cidade) throw new Error('A cidade é obrigatória.');

  const sessao = await chamar('POST', '/autenticacao/login', { email, senha });
  const token = sessao.tokenDeAcesso;
  console.log(`Entrou como ${sessao.usuario.nome}.`);

  // 1) Categorias: cria só as que faltam (compara sem diferenciar maiúsculas).
  const existentes = await chamar('GET', '/categorias', null, token);
  const idPorNome = new Map(existentes.map((c) => [c.nome.toLowerCase(), c.id]));
  const nomesUsados = new Set();
  mapa.secoes.forEach((s) =>
    [...s.categoriasA, ...s.categoriasB].forEach((n) => nomesUsados.add(n)),
  );
  let criadas = 0;
  for (const nome of nomesUsados) {
    if (idPorNome.has(nome.toLowerCase())) continue;
    const nova = await chamar('POST', '/categorias', { nome }, token);
    idPorNome.set(nome.toLowerCase(), nova.id);
    criadas++;
  }
  console.log(`Categorias: ${criadas} criadas, ${nomesUsados.size - criadas} já existiam.`);

  // 2) Mercado: reaproveita um chamado Favetta ou cria.
  const lojas = await chamar('GET', '/lojas', null, token);
  let loja = lojas.find((l) => l.nome.toLowerCase() === mapa.nome.toLowerCase());
  if (loja) console.log(`O mercado "${mapa.nome}" já existe: o mapa será substituído por inteiro.`);
  else loja = await chamar('POST', '/lojas', { nome: mapa.nome, cidade }, token);
  const atual = await chamar('GET', `/lojas/${loja.id}`, null, token);

  // 3) Mapa inteiro (a API troca todas as seções).
  const ids = (nomes) => nomes.map((n) => idPorNome.get(n.toLowerCase()));
  const corpo = {
    nome: mapa.nome,
    cidade,
    largura: mapa.largura,
    altura: mapa.altura,
    entrada: mapa.entrada,
    caixas: mapa.caixas,
    versao: atual.versao,
    secoes: mapa.secoes.map((s) => ({
      nome: s.nome,
      nomeLadoB: s.nomeLadoB,
      dividida: s.dividida,
      area: s.area,
      categoriasLadoA: ids(s.categoriasA),
      categoriasLadoB: ids(s.categoriasB),
    })),
  };
  const salvo = await chamar('PUT', `/lojas/${loja.id}/mapa`, corpo, token);
  console.log(
    `Pronto: "${salvo.nome}" salvo com ${salvo.secoes.length} seções. Abra Mais > Mercados no app.`,
  );
})().catch((e) => {
  console.error('Falhou:', e.message);
  process.exit(1);
});
