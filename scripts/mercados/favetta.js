// Layout do mercado Favetta (grade 49 x 29, cada célula ~1,5 m): a planta que o David desenhou, convertida em seções.
// Saída: o mapa (seções com os NOMES das categorias) que `aplicar.js` envia à API e `previa.js` desenha.

const LARGURA = 49;
const ALTURA = 29;

const secoes = [];
const secao = (nome, x, y, largura, altura, categoriasA, nomeLadoB = null, categoriasB = []) => {
  secoes.push({ nome, nomeLadoB, dividida: nomeLadoB !== null, area: { x, y, largura, altura }, categoriasA, categoriasB });
};

// 1) Balcões do fundo (parede de cima), da esquerda para a direita.
secao('Padaria', 0, 0, 10, 2, ['Padaria']);
secao('Frios', 10, 0, 9, 2, ['Frios']);
secao('Rotisseria', 19, 0, 9, 2, ['Rotisseria']);
secao('Açougue', 28, 0, 9, 2, ['Açougue']);
secao('Mercearia (fundo)', 37, 0, 12, 2, ['Mercearia']);

// 2) Fileira do fundo, abaixo dos balcões.
secao('Pães', 1, 4, 5, 2, ['Padaria']);
secao('Artesanais', 8, 4, 6, 2, ['Padaria']);
secao('Embutidos', 16, 4, 6, 2, ['Embutidos']);
secao('Carnes congeladas', 25, 4, 8, 2, ['Carnes congeladas', 'Açougue']);
secao('Mercearia (H5)', 38, 3, 2, 4, ['Mercearia']);
secao('Mercearia (H6)', 44, 3, 2, 4, ['Mercearia']);

// 3) Gôndolas verticais: [fundo A, fundo B, frente A, frente B]; B vazio = gôndola de um lado só.
// A coluna n ocupa x = 1 + 3*(n-1), com 2 células; o corredor entre as gôndolas é de 1 célula.
const colunas = [
  ['Refrigerantes', null, 'Bebidas alcoólicas', null],
  ['Refrigerantes', 'Cervejas', 'Bebidas alcoólicas', 'Águas'],
  ['Cervejas', 'Conservas', 'Sucos', 'Macarrão'],
  ['Conservas', 'Enlatados', 'Macarrão', 'Temperos'],
  ['Enlatados', 'Leites', 'Condimentos', 'Sobremesas'],
  ['Leites', 'Matinais', 'Farinhas', 'Bolachas'],
  ['Matinais', 'Laticínios', 'Bolachas', 'Chocolates'],
  ['Laticínios', 'Congelados', 'Salgadinhos', 'Perfumaria'],
  ['Congelados', 'Congelados', 'Shampoos', 'Absorventes'],
  ['Congelados', 'Congelados', 'Higiene pessoal', 'Higiene pessoal'],
  ['Congelados', 'Congelados', 'Papéis', 'Utilidades'],
  ['Congelados', 'Congelados', 'Utilidades', 'Brinquedos'],
  ['Congelados', 'Iogurtes', 'Utilidades', 'Utilidades'],
  [null, null, 'Pet', 'Limpeza'], // 14: o fundo é o bloco único de Hortifruti (14-15)
  [null, null, 'Limpeza', 'Limpeza'],
  ['Ovos', null, 'Limpeza carro', null],
];

const Y_FUNDO = 8;
const Y_FRENTE = 17;
const ALTURA_GONDOLA = 7;

colunas.forEach(([fundoA, fundoB, frenteA, frenteB], indice) => {
  const x = 1 + 3 * indice;
  const par = (a, b, y) => {
    if (!a) return;
    if (b) secao(a, x, y, 2, ALTURA_GONDOLA, [a], b, [b]);
    else secao(a, x, y, 2, ALTURA_GONDOLA, [a]);
  };
  par(fundoA, fundoB, Y_FUNDO);
  par(frenteA, frenteB, Y_FRENTE);
});

// 14-15 no fundo: um bloco só de Hortifruti (ocupa as duas colunas e o corredor entre elas).
secao('Hortifruti', 40, Y_FUNDO, 5, ALTURA_GONDOLA, ['Hortifruti']);

const mapa = {
  nome: 'Favetta',
  largura: LARGURA,
  altura: ALTURA,
  entrada: { x: 23, y: ALTURA - 1 },
  caixas: { x: 1, y: 26, largura: 10, altura: 2 },
  secoes,
};

module.exports = { mapa };

if (require.main === module) {
  const nomes = new Set();
  secoes.forEach((s) => [...s.categoriasA, ...s.categoriasB].forEach((c) => nomes.add(c)));
  console.log(`${secoes.length} seções, ${nomes.size} categorias:`, [...nomes].join(', '));
}
