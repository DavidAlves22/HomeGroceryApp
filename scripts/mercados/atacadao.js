// Layout do mercado Atacadão (Araras), grade 53 x 26, cada célula ~1,5 m. RASCUNHO 2 para o David validar na prévia.
// Saída: o mapa (seções com os NOMES das categorias) que `aplicar.js` envia à API e `previa.js` desenha.
//
// Como a descrição foi lida (mesma lógica do Savegnago):
// - Gôndolas 1 a 11 contam da DIREITA para a ESQUERDA (a 1 fica perto do Refrigerantes/Cervejas, a 11 ao lado das geladeiras).
//   O David escreveu duas vezes "10": a última linha foi tratada como a 11.
// - "A | B" = lado esquerdo | lado direito. Fundo = fileira de cima; Frente = fileira de baixo.
// - A parede do fundo foi escrita da direita para a esquerda (Mercearia fica acima da parede da direita e Laticínios
//   acima da parede da esquerda), então aqui ela aparece, da esquerda para a direita: Laticínios, Matinais, Farinhas, Mercearia.
// - SUPOSIÇÕES (não foram ditas): entrada, caixas, lados das geladeiras e categoria da gôndola de pães.

const LARGURA = 53;
const ALTURA = 26;

const secoes = [];
const secao = (nome, x, y, largura, altura, categoriasA, nomeLadoB = null, categoriasB = []) => {
  secoes.push({ nome, nomeLadoB, dividida: nomeLadoB !== null, area: { x, y, largura, altura }, categoriasA, categoriasB });
};

// 1) Parede do fundo, da esquerda para a direita, por toda a extensão.
secao('Laticínios', 0, 0, 13, 2, ['Laticínios']);
secao('Matinais', 13, 0, 13, 2, ['Matinais']);
secao('Farinhas', 26, 0, 13, 2, ['Farinhas']);
secao('Mercearia', 39, 0, 14, 2, ['Mercearia']);

// 2) Parede da esquerda, de cima para baixo (a cafeteria fecha embaixo, na parede da frente).
secao('Laticínios', 0, 2, 2, 7, ['Laticínios']);
secao('Açougue', 0, 9, 2, 7, ['Açougue']);
secao('Sucos', 0, 16, 2, 7, ['Sucos']);
secao('Cafeteria', 0, 24, 12, 2, ['Cafeteria']);

// 3) Parede da direita, de cima para baixo.
secao('Refrigerantes', 51, 2, 2, 11, ['Refrigerantes']);
secao('Cervejas', 51, 13, 2, 10, ['Cervejas']);

// 4) Na frente da parede da direita: de novo Refrigerantes e Cervejas.
secao('Refrigerantes', 48, 4, 2, 6, ['Refrigerantes']);
secao('Cervejas', 48, 13, 2, 6, ['Cervejas']);

// 5) Três geladeiras na vertical, lado a lado, entre a parede da esquerda e a gôndola 11 (como no Savegnago).
//    Lados (esquerda | direita), da esquerda para a direita. "Massas" virou Macarrão para não criar categoria nova.
secao('Carnes congeladas', 3, 3, 2, 7, ['Carnes congeladas'], 'Carnes congeladas', ['Carnes congeladas']); // 1
secao('Carnes congeladas', 6, 3, 2, 7, ['Carnes congeladas'], 'Macarrão', ['Macarrão']); // 2
secao('Congelados', 9, 3, 2, 7, ['Congelados'], 'Processados', ['Processados']); // 3

// 6) Embaixo das geladeiras: o Hortifruti e, à direita dele, uma gôndola de pães.
secao('Hortifruti', 3, 12, 5, 7, ['Hortifruti']);
secao('Pães', 12, 12, 2, 7, ['Padaria'], 'Pães', ['Padaria']); // SUPOSIÇÃO: dois lados, como no Savegnago
secao('Ovos', 9, 12, 2, 7, ['Ovos'], 'Pães', ['Padaria']); // gôndola entre o Hortifruti e a gôndola de pães
secao('Embutidos', 12, 3, 2, 7, ['Embutidos']); // gôndola de um lado só, ao lado das geladeiras

// 7) Gôndolas verticais 1..11: [frente A, frente B, fundo A, fundo B].
const gondolas = [
  ['Sucos', 'Vinhos', 'Águas', 'Destilados'], // 1
  ['Higiene pessoal', 'Sucos', 'Embalagens', 'Águas'], // 2
  ['Perfumaria', 'Infantil', 'Higiene pessoal', 'Papéis'], // 3
  ['Limpeza', 'Shampoos', 'Limpeza', 'Higiene pessoal'], // 4
  ['Limpeza', 'Limpeza', 'Utilidades', 'Limpeza'], // 5
  ['Utilidades', 'Limpeza', 'Limpeza carro', 'Papelaria'], // 6
  ['Condimentos', 'Utilidades', 'Temperos', 'Pet'], // 7
  ['Macarrão', 'Farinhas', 'Matinais', 'Enlatados'], // 8
  ['Petiscos', 'Macarrão', 'Cafés', 'Laticínios'], // 9
  ['Petiscos', 'Petiscos', 'Bolos', 'Petiscos'], // 10
  ['Leites', 'Chocolates', 'Conservas', 'Salgadinhos'], // 11
];

// O rótulo no mapa é o do mercado; a categoria é uma que já existe (evita criar categoria nova).
const categoriaDe = (rotulo) => ({ Destilados: 'Bebidas alcoólicas' })[rotulo] || rotulo;

const Y_FUNDO = 3;
const Y_FRENTE = 12;
const ALTURA_GONDOLA = 7;

gondolas.forEach(([frenteA, frenteB, fundoA, fundoB], indice) => {
  const numero = indice + 1;
  const x = 15 + 3 * (11 - numero); // 11 fica à esquerda (x = 15) e 1 à direita (x = 45)
  const par = (a, b, y) => secao(a, x, y, 2, ALTURA_GONDOLA, [categoriaDe(a)], b, [categoriaDe(b)]);
  par(fundoA, fundoB, Y_FUNDO);
  par(frenteA, frenteB, Y_FRENTE);
});

const mapa = {
  nome: 'Atacadão',
  cidade: 'Araras',
  largura: LARGURA,
  altura: ALTURA,
  entrada: { x: 39, y: ALTURA - 1 }, // SUPOSIÇÃO: frente, lado direito
  caixas: { x: 14, y: 22, largura: 20, altura: 2 }, // SUPOSIÇÃO: frente, centro-esquerda
  secoes,
};

module.exports = { mapa };

if (require.main === module) {
  const nomes = new Set();
  secoes.forEach((s) => [...s.categoriasA, ...s.categoriasB].forEach((c) => nomes.add(c)));
  console.log(`${secoes.length} seções, ${nomes.size} categorias:`, [...nomes].join(', '));
}
