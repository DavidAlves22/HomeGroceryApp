import type { Categoria, NomeComum, Produto } from '../../src/domain/entities/tipos';
import {
  categoriaDoNomeComum,
  nomesComunsParaMostrar,
} from '../../src/domain/services/nomesComuns';

const comum = (nome: string, categoria = 'Laticínios'): NomeComum => ({
  nome,
  categoria,
  unidadePadrao: 'Unidade',
  grupos: 2,
});
const produto = (nome: string): Produto => ({
  id: nome,
  nome,
  categoriaId: 'c',
  unidadePadrao: 'Unidade',
  descricao: null,
  favorito: false,
});
const categoria = (id: string, nome: string): Categoria => ({ id, nome }) as Categoria;

describe('nomesComunsParaMostrar', () => {
  it('não repete o que o grupo já mostra, mesmo com outra caixa ou sem acento', () => {
    const resultado = nomesComunsParaMostrar(
      [comum('Café torrado'), comum('Leite caixinha')],
      'ca',
      [produto('CAFE TORRADO')],
    );

    expect(resultado.map((n) => n.nome)).toEqual(['Leite caixinha']);
  });

  it('tira o nome que a pessoa já digitou por inteiro', () => {
    expect(nomesComunsParaMostrar([comum('Leite')], ' leite ', [])).toEqual([]);
  });

  it('junta nomes iguais com grafias diferentes e respeita o limite', () => {
    const lista = [comum('Arroz'), comum('arroz'), comum('Feijão'), comum('Café'), comum('Sal')];

    expect(nomesComunsParaMostrar(lista, 'a', [], 3).map((n) => n.nome)).toEqual([
      'Arroz',
      'Feijão',
      'Café',
    ]);
  });
});

describe('categoriaDoNomeComum', () => {
  const minhas = [categoria('1', 'Mercearia'), categoria('2', 'Laticínios')];

  it('acha a categoria do grupo pelo nome, sem diferenciar caixa nem acento', () => {
    expect(categoriaDoNomeComum(comum('Leite', 'LATICINIOS'), minhas)).toBe('2');
  });

  it('sem categoria com esse nome devolve null (o formulário mantém a que estava)', () => {
    expect(categoriaDoNomeComum(comum('Leite', 'Frios'), minhas)).toBeNull();
  });
});
