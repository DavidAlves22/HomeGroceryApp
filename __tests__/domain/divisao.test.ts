import type { Membro } from '../../src/domain/entities/grupo';
import type { ItemDaLista } from '../../src/domain/entities/tipos';
import {
  atribuirCategoria,
  categoriasDaListaComId,
  divisaoValida,
  responsavelDaCategoria,
  resumoDaDivisao,
  rotaInicial,
} from '../../src/domain/services/divisao';

const membro = (usuarioId: string, nome: string, voce = false): Membro => ({
  usuarioId,
  nome,
  papel: 'Membro',
  voce,
  entrouEm: '2026-11-01',
});
const eu = membro('u1', 'David Alves', true);
const ana = membro('u2', 'Ana Souza');
const item = (nome: string, categoriaId: string | null, categoriaNome: string) =>
  ({ nome, categoriaId, categoriaNome }) as ItemDaLista;

describe('divisão da compra por categoria', () => {
  it('lista as categorias da lista uma vez cada, ignorando item sem categoria', () => {
    const itens = [
      item('A', 'c1', 'Açougue'),
      item('B', 'c1', 'Açougue'),
      item('C', 'c2', 'Padaria'),
      item('D', null, 'Outros'),
    ];
    expect(categoriasDaListaComId(itens)).toEqual([
      { id: 'c1', nome: 'Açougue' },
      { id: 'c2', nome: 'Padaria' },
    ]);
  });

  it('atribui, troca e tira a pessoa de uma categoria sem mexer nas outras', () => {
    let d = atribuirCategoria([], 'c1', 'u1');
    d = atribuirCategoria(d, 'c2', 'u2');
    d = atribuirCategoria(d, 'c1', 'u2');
    expect(responsavelDaCategoria(d, 'c1')).toBe('u2');
    expect(responsavelDaCategoria(d, 'c2')).toBe('u2');
    d = atribuirCategoria(d, 'c1', null);
    expect(responsavelDaCategoria(d, 'c1')).toBeNull();
    expect(d).toHaveLength(1);
  });

  it('categoria fora da divisão (ou item sem categoria) é de todos', () => {
    expect(responsavelDaCategoria([], 'c1')).toBeNull();
    expect(responsavelDaCategoria([{ categoriaId: 'c1', usuarioId: 'u1' }], null)).toBeNull();
  });

  it('ignora responsável que saiu do grupo', () => {
    const d = [
      { categoriaId: 'c1', usuarioId: 'u1' },
      { categoriaId: 'c2', usuarioId: 'fora' },
    ];
    expect(divisaoValida(d, [eu, ana])).toEqual([{ categoriaId: 'c1', usuarioId: 'u1' }]);
  });

  it('resume por pessoa, chamando o próprio usuário de "Você"', () => {
    const categorias = [
      { id: 'c1', nome: 'Açougue' },
      { id: 'c2', nome: 'Padaria' },
      { id: 'c3', nome: 'Limpeza' },
    ];
    const d = [
      { categoriaId: 'c1', usuarioId: 'u1' },
      { categoriaId: 'c2', usuarioId: 'u2' },
    ];
    expect(resumoDaDivisao(d, categorias, [eu, ana])).toEqual([
      { usuarioId: 'u1', nome: 'Você', categorias: ['Açougue'] },
      { usuarioId: 'u2', nome: 'Ana', categorias: ['Padaria'] },
    ]);
  });

  it('a rota abre na minha quando há divisão e na de todos quando não há', () => {
    expect(rotaInicial([{ categoriaId: 'c1', usuarioId: 'u2' }], 'u1')).toBe('u1');
    expect(rotaInicial([], 'u1')).toBeNull();
  });
});
