import type { SerieDePreco } from '../../src/domain/entities/analises';
import { ordenarProdutos } from '../../src/domain/services/ordemDeProdutos';

const serie = (nome: string, meses: number, variacao: number | null) =>
  ({
    nome,
    unidadeBase: 'Unidade',
    pontos: Array.from({ length: meses }, () => ({})),
    variacaoPercentual: variacao,
  }) as unknown as SerieDePreco;

const SERIES = [
  serie('Café', 3, 8),
  serie('Óleo', 1, null),
  serie('Arroz', 3, -25.5),
  serie('Feijão', 2, 12),
  serie('Açúcar', 2, 0),
];
const nomes = (l: SerieDePreco[]) => l.map((s) => s.nome);

describe('ordenarProdutos', () => {
  it('"mais meses": o histórico mais longo primeiro, desempate por nome', () => {
    expect(nomes(ordenarProdutos(SERIES, 'meses'))).toEqual([
      'Arroz',
      'Café',
      'Açúcar',
      'Feijão',
      'Óleo',
    ]);
  });

  it('"maior variação": conta o módulo (queda de 25,5% vence alta de 12%) e deixa quem não tem variação no fim', () => {
    expect(nomes(ordenarProdutos(SERIES, 'variacao'))).toEqual([
      'Arroz',
      'Feijão',
      'Café',
      'Açúcar',
      'Óleo',
    ]);
  });

  it('"A–Z": ordem alfabética sem se enganar com acento', () => {
    expect(nomes(ordenarProdutos(SERIES, 'nome'))).toEqual([
      'Açúcar',
      'Arroz',
      'Café',
      'Feijão',
      'Óleo',
    ]);
  });

  it('não altera a lista original', () => {
    const copia = nomes(SERIES);
    ordenarProdutos(SERIES, 'variacao');
    expect(nomes(SERIES)).toEqual(copia);
  });
});
