import type { ItemDaLista } from '../../src/domain/entities/tipos';
import {
  calcularTotais,
  formatarVariacao,
  lerPreco,
  precoParaCampo,
  totalRealizadoDoItem,
} from '../../src/domain/services/financeiro';
import { Dinheiro } from '../../src/domain/valueObjects/Dinheiro';

let contador = 0;
function item(parcial: Partial<ItemDaLista> & { nome: string }): ItemDaLista {
  return {
    id: `i${++contador}`,
    produtoId: null,
    precoReferencia: null,
    categoriaId: null,
    categoriaNome: 'Mercearia',
    unidade: 'Unidade',
    quantidade: 1,
    quantidadeComprada: null,
    precoEstimado: null,
    precoUnitario: null,
    totalEstimado: 0,
    totalRealizado: 0,
    comprado: false,
    compradoEm: null,
    compradoPorUsuarioId: null,
    adicionadoPorUsuarioId: 'u1',
    ordem: contador,
    versao: 1,
    ...parcial,
  };
}

describe('calcularTotais', () => {
  it('exemplo da especificação: arroz + leite + café = R$ 101,00', () => {
    const totais = calcularTotais([
      item({ nome: 'Arroz', quantidade: 2, precoEstimado: 25, precoUnitario: 25, comprado: true }),
      item({
        nome: 'Leite',
        quantidade: 6,
        precoEstimado: 5.5,
        precoUnitario: 5.5,
        comprado: true,
      }),
      item({ nome: 'Café', quantidade: 1, precoEstimado: 18, precoUnitario: 18, comprado: true }),
    ]);

    expect(totais.realizado.centavos).toBe(10100);
    expect(totais.estimado.centavos).toBe(10100);
    expect(totais.restante.centavos).toBe(0);
  });

  it('estimado e realizado são independentes; restante é a diferença', () => {
    const totais = calcularTotais([
      item({ nome: 'Arroz', quantidade: 2, precoEstimado: 25, precoUnitario: 24, comprado: true }),
      item({ nome: 'Leite', quantidade: 6, precoEstimado: 5 }),
    ]);

    expect(totais.estimado.reais).toBe(80);
    expect(totais.realizado.reais).toBe(48);
    expect(totais.restante.reais).toBe(32);
  });

  it('passar da estimativa deixa o restante negativo', () => {
    const totais = calcularTotais([
      item({ nome: 'Arroz', quantidade: 1, precoEstimado: 10, precoUnitario: 15, comprado: true }),
    ]);
    expect(totais.restante.centavos).toBe(-500);
  });

  it('preço estimado nunca vira gasto e item comprado sem preço é sinalizado', () => {
    const totais = calcularTotais([
      item({ nome: 'Arroz', quantidade: 2, precoEstimado: 25, comprado: true }),
    ]);
    expect(totais.realizado.centavos).toBe(0);
    expect(totais.compradosSemPreco).toBe(1);
  });

  it('item pendente com preço pago não conta no gasto', () => {
    expect(
      totalRealizadoDoItem(item({ nome: 'Arroz', precoUnitario: 25, comprado: false })).centavos,
    ).toBe(0);
  });

  it('quantidade comprada substitui a planejada', () => {
    const carne = item({
      nome: 'Carne',
      quantidade: 1.5,
      precoUnitario: 40,
      quantidadeComprada: 1.2,
      comprado: true,
    });
    expect(totalRealizadoDoItem(carne).reais).toBe(48);
  });

  it.each([
    [0.333, 9.99, 333],
    [0.5, 0.01, 1],
    [3, 0.33, 99],
    [6, 5.5, 3300],
    [0.001, 0.5, 0],
    [1.5, 0.99, 149],
  ])('arredonda %d x R$ %d ao centavo como a API (%d centavos)', (quantidade, preco, centavos) => {
    const linha = item({ nome: 'X', quantidade, precoUnitario: preco, comprado: true });
    expect(totalRealizadoDoItem(linha).centavos).toBe(centavos);
  });

  it('cem itens de R$ 0,10 somam exatamente R$ 10,00 (sem erro de ponto flutuante)', () => {
    const itens = Array.from({ length: 100 }, () =>
      item({ nome: 'Bala', precoUnitario: 0.1, comprado: true }),
    );
    expect(calcularTotais(itens).realizado.centavos).toBe(1000);
  });

  it('agrupa o gasto por categoria', () => {
    const totais = calcularTotais([
      item({ nome: 'Arroz', categoriaNome: 'Mercearia', precoUnitario: 10, comprado: true }),
      item({ nome: 'Carne', categoriaNome: 'Açougue', precoUnitario: 50, comprado: true }),
      item({ nome: 'Café', categoriaNome: 'Mercearia', precoUnitario: 15, comprado: true }),
    ]);
    const mercearia = totais.porCategoria.find((c) => c.categoria === 'Mercearia');
    expect(mercearia?.realizado.reais).toBe(25);
  });
});

describe('formatação e leitura de preços', () => {
  it('formata variação com sinal e vírgula', () => {
    expect(formatarVariacao(12.5)).toBe('+12,5%');
    expect(formatarVariacao(-3)).toBe('-3,0%');
    expect(formatarVariacao(0)).toBe('0%');
    expect(formatarVariacao(null)).toBe('-');
  });

  it('lê preço digitado: vazio = sem preço, inválido = undefined', () => {
    expect(lerPreco('5,50')).toBe(5.5);
    expect(lerPreco('1.234,56')).toBe(1234.56);
    expect(lerPreco('  ')).toBeNull();
    expect(lerPreco('abc')).toBeUndefined();
    expect(lerPreco('-3')).toBeUndefined();
  });

  it('preenche o campo de preço com duas casas', () => {
    expect(precoParaCampo(5.5)).toBe('5,50');
    expect(precoParaCampo(null)).toBe('');
  });

  it('Dinheiro.formatar usa o padrão brasileiro', () => {
    expect(Dinheiro.deCentavos(10100).formatar().replace(/\s/g, ' ')).toBe('R$ 101,00');
  });
});
