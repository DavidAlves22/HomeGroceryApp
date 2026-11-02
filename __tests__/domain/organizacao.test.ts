import type { ItemDaLista, ListaResumo } from '../../src/domain/entities/tipos';
import {
  escolherListaAtual,
  existePrincipalNoMes,
  formatarQuantidade,
  lerQuantidade,
  normalizar,
  organizarItens,
  percentualConcluido,
  resumirItens,
} from '../../src/domain/services/organizacao';
import { Competencia } from '../../src/domain/valueObjects/Competencia';

let proximo = 0;
const item = (nome: string, categoriaNome: string, comprado = false): ItemDaLista => ({
  id: `i${++proximo}`,
  produtoId: null,
  precoReferencia: null,
  nome,
  categoriaId: null,
  categoriaNome,
  unidade: 'Unidade',
  quantidade: 1,
  quantidadeComprada: null,
  precoEstimado: null,
  precoUnitario: null,
  totalEstimado: 0,
  totalRealizado: 0,
  comprado,
  compradoEm: null,
  compradoPorUsuarioId: null,
  adicionadoPorUsuarioId: 'u1',
  ordem: proximo,
  versao: 1,
  compradoNaLojaId: null,
  semNasLojas: [],
});

const itens = [
  item('Café', 'Mercearia', true),
  item('Arroz', 'Mercearia'),
  item('Banana', 'Hortifruti'),
  item('Frango', 'Açougue', true),
];
const ORDEM = ['Mercearia', 'Açougue', 'Hortifruti'];
const padrao = { busca: '', filtro: 'todos', ordenacao: 'categoria' } as const;

describe('organizarItens', () => {
  it('agrupa por categoria na ordem das categorias, com pendentes antes dos comprados', () => {
    const grupos = organizarItens(itens, padrao, ORDEM);

    expect(grupos.map((g) => g.titulo)).toEqual(['Mercearia', 'Açougue', 'Hortifruti']);
    expect(grupos[0].itens.map((i) => i.nome)).toEqual(['Arroz', 'Café']);
    expect(grupos[0].comprados).toBe(1);
  });

  it('busca ignora maiúsculas e acentos', () => {
    const grupos = organizarItens(itens, { ...padrao, busca: 'cafe' }, ORDEM);
    expect(grupos.flatMap((g) => g.itens.map((i) => i.nome))).toEqual(['Café']);
  });

  it('filtra por status', () => {
    const pendentes = organizarItens(itens, { ...padrao, filtro: 'pendentes' }, ORDEM);
    const comprados = organizarItens(itens, { ...padrao, filtro: 'comprados' }, ORDEM);

    expect(pendentes.flatMap((g) => g.itens.map((i) => i.nome))).toEqual(['Arroz', 'Banana']);
    expect(comprados.flatMap((g) => g.itens.map((i) => i.nome))).toEqual(['Café', 'Frango']);
  });

  it('ordena por nome em um grupo só', () => {
    const grupos = organizarItens(itens, { ...padrao, ordenacao: 'nome' }, ORDEM);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].itens.map((i) => i.nome)).toEqual(['Arroz', 'Banana', 'Café', 'Frango']);
  });

  it('ordena por status: pendentes e comprados', () => {
    const grupos = organizarItens(itens, { ...padrao, ordenacao: 'status' }, ORDEM);
    expect(grupos.map((g) => g.titulo)).toEqual(['Pendentes', 'Comprados']);
    expect(grupos[1].itens.map((i) => i.nome)).toEqual(['Café', 'Frango']);
  });

  it('ordem manual: um grupo só, na ordem escolhida, sem separar comprados', () => {
    const grupos = organizarItens(itens, { ...padrao, ordenacao: 'manual' }, ORDEM);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].itens.map((i) => i.nome)).toEqual(['Café', 'Arroz', 'Banana', 'Frango']);
  });

  it('ordem manual respeita a ordem mesmo depois de reordenar', () => {
    const reordenados = [...itens].map((i, indice) => ({ ...i, ordem: 10 - indice }));
    const grupos = organizarItens(reordenados, { ...padrao, ordenacao: 'manual' }, ORDEM);
    expect(grupos[0].itens.map((i) => i.nome)).toEqual(['Frango', 'Banana', 'Arroz', 'Café']);
  });

  it('filtra por categoria e combina com busca e status', () => {
    const soMercearia = organizarItens(itens, { ...padrao, categoria: 'Mercearia' }, ORDEM);
    expect(soMercearia.flatMap((g) => g.itens.map((i) => i.nome))).toEqual(['Arroz', 'Café']);

    const combinado = organizarItens(
      itens,
      { ...padrao, categoria: 'Mercearia', filtro: 'pendentes' },
      ORDEM,
    );
    expect(combinado.flatMap((g) => g.itens.map((i) => i.nome))).toEqual(['Arroz']);
  });

  it('categoria desconhecida vai para o fim e lista vazia não gera grupos', () => {
    const grupos = organizarItens([item('X', 'Nova')], padrao, ORDEM);
    expect(grupos[0].titulo).toBe('Nova');
    expect(organizarItens([], padrao, ORDEM)).toEqual([]);
  });
});

describe('resumo e quantidades', () => {
  it('calcula progresso arredondado', () => {
    expect(percentualConcluido(0, 0)).toBe(0);
    expect(percentualConcluido(3, 2)).toBe(67);
    expect(resumirItens(itens)).toEqual({ total: 4, comprados: 2, pendentes: 2, percentual: 50 });
  });

  it('formata e lê quantidades com vírgula', () => {
    expect(formatarQuantidade(2)).toBe('2');
    expect(formatarQuantidade(0.5)).toBe('0,5');
    expect(formatarQuantidade(0.333)).toBe('0,333');
    expect(lerQuantidade('1,5')).toBe(1.5);
    expect(lerQuantidade('0')).toBeNull();
    expect(lerQuantidade('abc')).toBeNull();
  });

  it('normaliza texto', () => {
    expect(normalizar('  Açúcar ')).toBe('acucar');
  });
});

const resumo = (sobrescritas: Partial<ListaResumo>): ListaResumo => ({
  id: 'l',
  competencia: '2026-11',
  competenciaNome: 'Novembro de 2026',
  nome: 'Novembro',
  principal: true,
  status: 'EmAndamento',
  finalizadaEm: null,
  totalDeItens: 0,
  comprados: 0,
  percentual: 0,
  totalEstimado: 0,
  totalRealizado: 0,
  ...sobrescritas,
});

describe('escolherListaAtual', () => {
  const hoje = Competencia.deChave('2026-11');

  it('prefere a principal do mês atual', () => {
    const lista = escolherListaAtual(
      [
        resumo({ id: 'extra', principal: false }),
        resumo({ id: 'principal' }),
        resumo({ id: 'antiga', competencia: '2026-10' }),
      ],
      hoje,
    );
    expect(lista?.id).toBe('principal');
  });

  it('sem lista no mês, usa a em andamento mais recente', () => {
    const lista = escolherListaAtual(
      [
        resumo({ id: 'a', competencia: '2026-08', status: 'Finalizada' }),
        resumo({ id: 'b', competencia: '2026-09' }),
        resumo({ id: 'c', competencia: '2026-10' }),
      ],
      hoje,
    );
    expect(lista?.id).toBe('c');
  });

  it('sem nada em andamento devolve null', () => {
    expect(
      escolherListaAtual([resumo({ status: 'Finalizada', competencia: '2026-09' })], hoje),
    ).toBeNull();
    expect(escolherListaAtual([], hoje)).toBeNull();
  });

  it('detecta lista principal já existente no mês', () => {
    expect(existePrincipalNoMes([resumo({})], '2026-11')).toBe(true);
    expect(existePrincipalNoMes([resumo({ principal: false })], '2026-11')).toBe(false);
    expect(existePrincipalNoMes([resumo({})], '2026-12')).toBe(false);
  });
});
