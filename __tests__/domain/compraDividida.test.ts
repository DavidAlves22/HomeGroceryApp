import type { MercadoResumo } from '../../src/domain/entities/mercados';
import type { ItemDaLista } from '../../src/domain/entities/tipos';
import { dividirCompra, pendentesNoMercado } from '../../src/domain/services/compraDividida';

const mercado = (id: string, nome: string): MercadoResumo => ({
  id,
  nome,
  largura: 30,
  altura: 20,
  secoes: 0,
  versao: 1,
});

let contador = 0;
const item = (parcial: Partial<ItemDaLista>): ItemDaLista => ({
  id: `i${++contador}`,
  produtoId: null,
  nome: 'Item',
  categoriaId: null,
  categoriaNome: 'Mercearia',
  unidade: 'Unidade',
  quantidade: 1,
  quantidadeComprada: null,
  precoEstimado: null,
  precoUnitario: null,
  precoReferencia: null,
  totalEstimado: 0,
  totalRealizado: 0,
  comprado: false,
  compradoEm: null,
  compradoPorUsuarioId: null,
  adicionadoPorUsuarioId: 'u1',
  ordem: contador,
  versao: 1,
  compradoNaLojaId: null,
  semNasLojas: [],
  ...parcial,
});

describe('dividirCompra', () => {
  const mercados = [mercado('a', 'Central'), mercado('b', 'Atacadão'), mercado('c', 'Empório')];

  it('conta os comprados por mercado e o que ainda falta, sem listar mercado vazio', () => {
    const itens = [
      item({ comprado: true, compradoNaLojaId: 'a' }),
      item({ comprado: true, compradoNaLojaId: 'a' }),
      item({ comprado: true, compradoNaLojaId: 'b' }),
      item({}),
      item({}),
    ];

    const { fatias, faltam } = dividirCompra(itens, mercados);

    expect(fatias).toEqual([
      { lojaId: 'a', nome: 'Central', quantidade: 2 },
      { lojaId: 'b', nome: 'Atacadão', quantidade: 1 },
    ]);
    expect(faltam).toBe(2);
  });

  it('compra num mercado excluído vira "Outro mercado"; sem mercado informado tem fatia própria', () => {
    const itens = [
      item({ comprado: true, compradoNaLojaId: 'apagado' }),
      item({ comprado: true, compradoNaLojaId: null }),
    ];

    const { fatias } = dividirCompra(itens, mercados);

    expect(fatias.map((f) => f.nome)).toEqual(['Outro mercado', 'Sem mercado informado']);
  });
});

describe('pendentesNoMercado', () => {
  it('tira o que já foi comprado e o que foi marcado como "não encontrei" neste mercado', () => {
    const itens = [
      item({ nome: 'Comprado', comprado: true, compradoNaLojaId: 'a' }),
      item({ nome: 'Falta' }),
      item({ nome: 'Não tem em A', semNasLojas: ['a'] }),
      item({ nome: 'Não tem em B', semNasLojas: ['b'] }),
    ];

    expect(pendentesNoMercado(itens, 'a').map((i) => i.nome)).toEqual(['Falta', 'Não tem em B']);
  });
});
