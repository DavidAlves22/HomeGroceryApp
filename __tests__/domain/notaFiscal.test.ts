import type { ItemDaLista } from '../../src/domain/entities/tipos';
import {
  lerNotaFiscal,
  lerNumero,
  nomeLegivel,
  precoParaOApp,
  semelhanca,
  sugerirPares,
  unidadeDaNota,
} from '../../src/domain/services/notaFiscal';

// O texto como o navegador entrega ao copiar a página da NFC-e (colado pelo usuário).
const NOTA = `WMS SUPERMERCADOS DO BRASIL LTDA
CNPJ: 93.209.765/0509-98
DONA RENATA , 3215 , , VL PASTORELLO , ARARAS , SP
M.PIZZA M.LEVE FRIG. (Código: AR002452 )
Qtde.:1   UN: UND9   Vl. Unit.:   9,5 \tVl. Total
9,50
MIST.BOLO FLEISCHMAN (Código: AR075346 )
Qtde.:1   UN: UND9   Vl. Unit.:   7,98 \tVl. Total
7,98
BISC.GAROTO CHOCO (Código: AR095566 )
Qtde.:1   UN: UND9   Vl. Unit.:   3,99 \tVl. Total
3,99
BISC.PASSATEMPO (Código: AR089183 )
Qtde.:3   UN: UND9   Vl. Unit.:   1,3 \tVl. Total
3,90
BISC.BAUDUCCO COOKIE (Código: AR083168 )
Qtde.:1   UN: UND9   Vl. Unit.:   3,49 \tVl. Total
3,49
BISC.BAUDUCCO WAFER (Código: AR039393 )
Qtde.:1   UN: UND9   Vl. Unit.:   4,39 \tVl. Total
4,39
REQUEIJAO TIROLEZ (Código: AR064480 )
Qtde.:2   UN: UND9   Vl. Unit.:   6,79 \tVl. Total
13,58
QJO.M.PADR.TIROLEZ (Código: AR032886 )
Qtde.:0,48   UN: KG9   Vl. Unit.:   69,9 \tVl. Total
33,55
Qtd. total de itens:8
Valor a pagar R$:80,38`;

const itemDaLista = (id: string, nome: string, produtoId: string | null = null) =>
  ({ id, nome, produtoId, comprado: false }) as ItemDaLista;

describe('lerNumero', () => {
  it('lê o formato brasileiro', () => {
    expect(lerNumero('69,9')).toBe(69.9);
    expect(lerNumero('1.234,56')).toBe(1234.56);
    expect(lerNumero('0,48')).toBe(0.48);
    expect(lerNumero('0.48')).toBe(0.48);
  });
});

describe('lerNotaFiscal', () => {
  const nota = lerNotaFiscal(NOTA);

  it('lê o mercado, o CNPJ e o total', () => {
    expect(nota.mercado).toEqual({
      nome: 'WMS SUPERMERCADOS DO BRASIL LTDA',
      cnpj: '93.209.765/0509-98',
    });
    expect(nota.totalDaNota).toBe(80.38);
    expect(nota.avisos).toEqual([]);
  });

  it('lê os 8 itens com código, quantidade, unidade e valores', () => {
    expect(nota.itens).toHaveLength(8);
    expect(nota.itens[0]).toEqual({
      nome: 'M.PIZZA M.LEVE FRIG.',
      codigo: 'AR002452',
      quantidade: 1,
      unidadeNaNota: 'UND9',
      valorUnitario: 9.5,
      valorTotal: 9.5,
    });
    expect(nota.itens[3]).toMatchObject({
      nome: 'BISC.PASSATEMPO',
      quantidade: 3,
      valorUnitario: 1.3,
      valorTotal: 3.9,
    });
    expect(nota.itens[7]).toMatchObject({
      codigo: 'AR032886',
      quantidade: 0.48,
      unidadeNaNota: 'KG9',
      valorUnitario: 69.9,
      valorTotal: 33.55,
    });
  });

  it('a soma dos itens fecha com o valor a pagar', () => {
    const soma = nota.itens.reduce((t, i) => t + i.valorTotal, 0);
    expect(Math.round(soma * 100) / 100).toBe(80.38);
  });

  it('aceita o texto numa linha só e com quebras diferentes (Windows)', () => {
    const emUmaLinha = lerNotaFiscal(NOTA.replace(/\n/g, ' '));
    expect(emUmaLinha.itens.map((i) => i.codigo)).toEqual(nota.itens.map((i) => i.codigo));
    expect(emUmaLinha.itens[4].nome).toBe('BISC.BAUDUCCO COOKIE');
    const windows = lerNotaFiscal(NOTA.replace(/\n/g, '\r\n'));
    expect(windows.itens).toHaveLength(8);
  });

  it('avisa quando não acha itens ou quando a contagem não bate', () => {
    expect(lerNotaFiscal('qualquer coisa').avisos[0]).toContain('nenhum item');
    const faltando = lerNotaFiscal(NOTA.replace('Qtd. total de itens:8', 'Qtd. total de itens:9'));
    expect(faltando.avisos[0]).toContain('A nota diz 9 itens');
  });
});

describe('preço e unidade para o app', () => {
  it('mantém o unitário com até 2 casas e usa total ÷ quantidade quando a nota tem mais casas', () => {
    expect(
      precoParaOApp({ valorUnitario: 69.9, valorTotal: 33.55, quantidade: 0.48 } as never),
    ).toBe(69.9);
    expect(precoParaOApp({ valorUnitario: 1.299, valorTotal: 3.9, quantidade: 3 } as never)).toBe(
      1.3,
    );
  });

  it('traduz a unidade da nota', () => {
    expect(unidadeDaNota('UND9')).toBe('Unidade');
    expect(unidadeDaNota('KG9')).toBe('Kg');
    expect(unidadeDaNota('LT')).toBe('Litro');
    expect(unidadeDaNota('PCT')).toBe('Pacote');
  });
});

describe('semelhança e pares', () => {
  it('casa abreviações por prefixo e ignora diferenças de caixa e acento', () => {
    expect(semelhanca('BISC.PASSATEMPO', 'Biscoito Passatempo')).toBe(1);
    expect(semelhanca('REQUEIJAO TIROLEZ', 'Requeijão')).toBe(0.5);
    expect(semelhanca('QJO.M.PADR.TIROLEZ', 'Queijo Tirolez')).toBeGreaterThan(0.3);
    expect(semelhanca('BISC.GAROTO CHOCO', 'Biscoito')).toBeLessThan(0.5);
  });

  it('sugere por código já ensinado primeiro e por nome depois, sem repetir o item da lista', () => {
    const itens = [
      itemDaLista('i1', 'Biscoito Passatempo'),
      itemDaLista('i2', 'Biscoito Bauducco Wafer'),
      itemDaLista('i3', 'Queijo muçarela', 'prod-queijo'),
      itemDaLista('i4', 'Requeijão'),
    ];
    const nota = lerNotaFiscal(NOTA).itens;
    const pares = sugerirPares(nota, itens, new Map([['AR032886', 'prod-queijo']]));

    expect(pares.get(7)).toEqual({ itemId: 'i3', origem: 'vinculo' }); // queijo, pelo código
    expect(pares.get(3)).toEqual({ itemId: 'i1', origem: 'nome' }); // Passatempo
    expect(pares.get(5)).toEqual({ itemId: 'i2', origem: 'nome' }); // Bauducco Wafer
    expect(pares.get(6)).toEqual({ itemId: 'i4', origem: 'nome' }); // Requeijão
    expect(pares.has(0)).toBe(false); // pizza não está na lista
    expect(pares.has(4)).toBe(false); // Bauducco Cookie: só 1 de 3 palavras, abaixo do mínimo
  });

  it('o nome legível deixa o item novo apresentável', () => {
    expect(nomeLegivel('M.PIZZA M.LEVE FRIG.')).toBe('M.Pizza M.Leve Frig.');
    expect(nomeLegivel('BISC.GAROTO CHOCO')).toBe('Bisc.Garoto Choco');
  });
});

// Nota real de Minas Gerais: uma linha por produto, sem valor unitário, e o mesmo produto repetido (bipado várias vezes).
const LEITE =
  'LEITE SERRANIA 1LT INTEGRAL HOMOGE (Código: 182333)\tQtde total de ítens: 1.0000\tUN: UN\tValor total R$: R$ 5,89';
const NOTA_MG = `FULIARO SUPERMERCADOS LTDA
CNPJ: 13827783000123 -, Inscrição Estadual: 0017911870071
AVENIDA DOUTOR DOMINGOS CONDE, 314, PARQUE DOS PINHEIROS, 3147204 - PARAGUACU, MG

Filtar ítens...

${LEITE}
${LEITE}
${LEITE}
PAD BISNAGUINHA kg (Código: 208869)\tQtde total de ítens: 0.1500\tUN: KG\tValor total R$: R$ 3,30
PAD BISNAGUINHA kg (Código: 208869)\tQtde total de ítens: 0.1520\tUN: KG\tValor total R$: R$ 3,34
${LEITE}
${LEITE}
MAIONESE HEINZ 390G (Código: 172893)\tQtde total de ítens: 1.0000\tUN: UN\tValor total R$: R$ 14,95
BATATA PALHA CROQUES 100G CEBOLA E SALSA (Código: 227617)\tQtde total de ítens: 1.0000\tUN: UN\tValor total R$: R$ 6,98
${LEITE}

Qtde total de ítens
10
Valor total R$
63.91
`;

describe('lerNotaFiscal (Minas Gerais)', () => {
  it('com "Valor pago" no rodapé, o total da nota é o que foi pago (já com desconto)', () => {
    const completa = lerNotaFiscal(
      `${NOTA_MG}Valor pago R$\n63.63\nForma de Pagamento\n03 - Cartão de Crédito\n`,
    );
    expect(completa.totalDaNota).toBe(63.63);
    expect(completa.itens).toHaveLength(4);
  });

  const nota = lerNotaFiscal(NOTA_MG);

  it('lê o mercado e o CNPJ', () => {
    expect(nota.mercado.nome).toBe('FULIARO SUPERMERCADOS LTDA');
    expect(nota.mercado.cnpj).toBe('13827783000123');
  });

  it('lê sem avisos e junta o mesmo produto (mesmo código) num item só', () => {
    expect(nota.avisos).toEqual([]);
    expect(nota.itens.map((i) => i.nome)).toEqual([
      'LEITE SERRANIA 1LT INTEGRAL HOMOGE',
      'PAD BISNAGUINHA kg',
      'MAIONESE HEINZ 390G',
      'BATATA PALHA CROQUES 100G CEBOLA E SALSA',
    ]);
  });

  it('soma quantidade e total, e o unitário vira total ÷ quantidade', () => {
    const leite = nota.itens[0];
    expect(leite).toMatchObject({
      codigo: '182333',
      quantidade: 6,
      unidadeNaNota: 'UN',
      valorTotal: 35.34,
    });
    expect(leite.valorUnitario).toBe(5.89);
    const pao = nota.itens[1];
    expect(pao).toMatchObject({
      codigo: '208869',
      quantidade: 0.302,
      unidadeNaNota: 'KG',
      valorTotal: 6.64,
    });
    expect(unidadeDaNota(pao.unidadeNaNota)).toBe('Kg');
    expect(nota.itens[2]).toMatchObject({ quantidade: 1, valorUnitario: 14.95, valorTotal: 14.95 });
  });

  it('o total do rodapé fecha com a soma dos itens', () => {
    expect(nota.totalDaNota).toBe(63.91);
    const soma = nota.itens.reduce((s, i) => s + i.valorTotal, 0);
    expect(Math.round(soma * 100) / 100).toBe(63.91);
  });
});
