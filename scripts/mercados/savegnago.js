// Layout do mercado Savegnago (Araras), grade 53 x 26, cada célula ~1,5 m. RASCUNHO 2 para o David validar na prévia
// (posições lidas do esboço que o David ajustou, arredondadas para a grade).
// Saída: o mapa (seções com os NOMES das categorias) que `aplicar.js` envia à API e `previa.js` desenha.
//
// Como a descrição foi lida:
// - Gôndolas 1 a 10 contam da DIREITA para a ESQUERDA (a 1 fica ao lado do hortifruti e a 10 ao lado das geladeiras).
// - "A | B" = lado esquerdo | lado direito da gôndola vertical. Fundo = fileira de cima; Frente = fileira de baixo.

const LARGURA = 53;
const ALTURA = 26;

const secoes = [];
const secao = (nome, x, y, largura, altura, categoriasA, nomeLadoB = null, categoriasB = []) => {
  secoes.push({ nome, nomeLadoB, dividida: nomeLadoB !== null, area: { x, y, largura, altura }, categoriasA, categoriasB });
};

// 1) Parede do fundo, da esquerda para a direita.
secao('Bebidas geladas', 0, 0, 12, 2, ['Bebidas geladas']);
secao('Açougue', 12, 0, 12, 2, ['Açougue']);
secao('Carnes congeladas (parede)', 24, 0, 12, 2, ['Carnes congeladas']);
secao('Laticínios', 36, 0, 12, 2, ['Laticínios']);

// 2) Parede da esquerda, de cima para baixo.
secao('Sorvetes', 0, 2, 2, 6, ['Sorvetes']);
secao('Geladeira de congelados', 0, 8, 2, 6, ['Congelados']); // o "1" do esboço
secao('Matinais gelados', 0, 14, 2, 6, ['Matinais gelados']);
secao('Padaria', 0, 20, 2, 6, ['Padaria']);

// 3) Parede da direita, de cima para baixo.
secao('Frios', 51, 2, 2, 6, ['Frios']);
secao('Hortifruti prontos', 51, 8, 2, 6, ['Hortifruti prontos']);
secao('Ovos', 51, 14, 2, 6, ['Ovos']);

// 4) Na frente do Frios: Queijos (vertical) e o Hortifruti grande.
secao('Queijos', 45, 3, 2, 5, ['Queijos']);
secao('Hortifruti', 43, 9, 8, 10, ['Hortifruti']);

// 5) Geladeiras 2 a 5 (esboço), com dois lados cada (esquerda | direita).
secao('Carnes congeladas', 3, 3, 2, 7, ['Carnes congeladas'], 'Carnes congeladas', ['Carnes congeladas']); // 2
secao('Carnes congeladas', 7, 3, 2, 7, ['Carnes congeladas'], 'Espetinhos congelados', ['Espetinhos congelados']); // 3
secao('Processados', 3, 12, 2, 7, ['Processados'], 'Peixes', ['Peixes']); // 4
secao('Peixes', 6, 12, 2, 7, ['Peixes'], 'Peixes', ['Peixes']); // 5

// 6) Seções soltas na frente: marmitas (6), salgadinhos (7), floricultura (8) e gôndola de pães (9).
secao('Marmitas', 3, 20, 6, 1, ['Marmitas']);
secao('Salgadinhos', 3, 22, 6, 2, ['Salgadinhos']);
secao('Floricultura', 42, 21, 8, 2, ['Floricultura']);
secao('Pães', 9, 12, 2, 7, ['Padaria'], 'Pães', ['Padaria']); // 9

// 7) Gôndolas verticais 1..10: [frente A, frente B, fundo A, fundo B].
const gondolas = [
  ['Utilidades', 'Copos', 'Cervejas', 'Vinhos'], // 1
  ['Brinquedos', 'Utilidades', 'Sucos', 'Águas'], // 2
  ['Utilidades', 'Pet', 'Leites', 'Refrigerantes'], // 3
  ['Limpeza', 'Limpeza carro', 'Limpeza', 'Papéis'], // 4
  ['Infantil', 'Limpeza', 'Limpeza', 'Limpeza'], // 5
  ['Perfumaria', 'Fraldas', 'Shampoos', 'Higiene pessoal'], // 6
  ['Farinhas', 'Absorventes', 'Mercearia', 'Higiene pessoal'], // 7
  ['Condimentos', 'Macarrão', 'Óleos', 'Mercearia'], // 8
  ['Bolos', 'Conservas', 'Cafés', 'Temperos'], // 9
  ['Petiscos', 'Petiscos', 'Carnes congeladas', 'Matinais'], // 10
];

const Y_FUNDO = 3;
const Y_FRENTE = 12;
const ALTURA_GONDOLA = 7;

gondolas.forEach(([frenteA, frenteB, fundoA, fundoB], indice) => {
  const numero = indice + 1;
  const x = 12 + 3 * (10 - numero); // 10 fica à esquerda (x = 12) e 1 à direita (x = 39)
  const par = (a, b, y) => secao(a, x, y, 2, ALTURA_GONDOLA, [a], b, [b]);
  par(fundoA, fundoB, Y_FUNDO);
  par(frenteA, frenteB, Y_FRENTE);
});

const mapa = {
  nome: 'Savegnago',
  cidade: 'Araras',
  largura: LARGURA,
  altura: ALTURA,
  entrada: { x: 39, y: ALTURA - 1 }, // triângulo do esboço
  caixas: { x: 12, y: 22, largura: 20, altura: 2 },
  secoes,
};

module.exports = { mapa };

if (require.main === module) {
  const nomes = new Set();
  secoes.forEach((s) => [...s.categoriasA, ...s.categoriasB].forEach((c) => nomes.add(c)));
  console.log(`${secoes.length} seções, ${nomes.size} categorias:`, [...nomes].join(', '));
}
