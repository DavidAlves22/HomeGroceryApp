import {
  apagar,
  calculoInicial,
  digitar,
  operar,
  resolver,
  textoDoVisor,
  textoPendente,
  valorDoCalculo,
  virgula,
  type EstadoCalculo,
  type ModoNumerico,
  type Operacao,
} from '../../src/domain/services/calculadora';

/** Aperta as teclas na ordem: dígitos, "," e operadores ("+", "-", "*", "/"), "=" e "<" (apagar). */
function teclas(modo: ModoNumerico, inicial: number | null, sequencia: string): EstadoCalculo {
  let e = calculoInicial(modo, inicial);
  for (const t of sequencia) {
    if (t >= '0' && t <= '9') e = digitar(e, Number(t));
    else if (t === ',') e = virgula(e);
    else if (t === '<') e = apagar(e);
    else if (t === '=') e = resolver(e);
    else e = operar(e, t as Operacao);
  }
  return e;
}
const valor = (modo: ModoNumerico, sequencia: string, inicial: number | null = null) =>
  valorDoCalculo(teclas(modo, inicial, sequencia));

describe('modo dinheiro (da direita para a esquerda, em centavos)', () => {
  it('digita como teclado de banco: 5 vira R$ 0,05 e 2400 vira R$ 24,00', () => {
    expect(valor('dinheiro', '5')).toBe(0.05);
    expect(valor('dinheiro', '2400')).toBe(24);
    expect(textoDoVisor(teclas('dinheiro', null, '2550'))).toMatch(/25,50/);
  });

  it('o primeiro dígito troca o valor que o campo já tinha', () => {
    expect(valor('dinheiro', '5', 43.49)).toBe(0.05);
    expect(valor('dinheiro', '', 43.49)).toBe(43.49); // Concluir sem digitar mantém
  });

  it('apagar come o último dígito; o dígito que estoura o teto é ignorado', () => {
    expect(valor('dinheiro', '1234<')).toBe(1.23);
    expect(valor('dinheiro', '999999999')).toBe(999999.99); // o 9º dígito passa do teto e é ignorado
    expect(valor('dinheiro', '99999999')).toBe(999999.99);
  });

  it('soma, subtrai, multiplica e divide, encadeado e sem precedência', () => {
    expect(valor('dinheiro', '1200+850=')).toBe(20.5);
    expect(valor('dinheiro', '1000-250')).toBe(7.5); // Concluir resolve o pendente
    expect(valor('dinheiro', '1200*3')).toBe(36);
    expect(valor('dinheiro', '9000/4')).toBe(22.5);
    expect(valor('dinheiro', '200+300*2')).toBe(10); // (2 + 3) × 2, não 2 + 6
  });

  it('dividir por zero deixa o valor que havia; subtração nunca fica negativa', () => {
    expect(valor('dinheiro', '1000/0')).toBe(10);
    expect(valor('dinheiro', '500-800')).toBe(0);
  });

  it('operador desistido vale o número; trocar de operador troca a conta', () => {
    expect(valor('dinheiro', '4590*')).toBe(45.9);
    expect(valor('dinheiro', '1000+*2')).toBe(20);
  });
});

describe('modo quantidade (da esquerda para a direita, com vírgula, em milésimos)', () => {
  it('digita número inteiro e decimal', () => {
    expect(valor('quantidade', '12')).toBe(12);
    expect(valor('quantidade', '1,5')).toBe(1.5);
    expect(valor('quantidade', '0,48')).toBe(0.48);
    expect(valor('quantidade', ',5')).toBe(0.5);
  });

  it('aceita no máximo 3 casas e uma só vírgula', () => {
    expect(valor('quantidade', '1,2345')).toBe(1.234);
    expect(valor('quantidade', '1,,5')).toBe(1.5);
    expect(valor('quantidade', '1,5,2')).toBe(1.52);
  });

  it('o visor mostra a vírgula como foi digitada', () => {
    expect(textoDoVisor(teclas('quantidade', null, '2'))).toBe('2');
    expect(textoDoVisor(teclas('quantidade', null, '2,'))).toBe('2,');
    expect(textoDoVisor(teclas('quantidade', null, '2,50'))).toBe('2,50');
    expect(textoDoVisor(teclas('quantidade', 1.5, ''))).toBe('1,5');
  });

  it('apagar tira o último dígito, depois a vírgula, depois a parte inteira', () => {
    expect(textoDoVisor(teclas('quantidade', null, '12,34<'))).toBe('12,3');
    expect(textoDoVisor(teclas('quantidade', null, '12,3<'))).toBe('12,');
    expect(textoDoVisor(teclas('quantidade', null, '12,3<<'))).toBe('12');
    expect(valor('quantidade', '12,3<<<')).toBe(1);
    expect(valor('quantidade', '12,3<<<<')).toBe(0);
  });

  it('o primeiro dígito troca a quantidade que o campo já tinha', () => {
    expect(valor('quantidade', '3', 1.5)).toBe(3);
    expect(valor('quantidade', ',2', 1.5)).toBe(0.2);
  });

  it('soma e multiplica quantidades', () => {
    expect(valor('quantidade', '1,5+2,5=')).toBe(4);
    expect(valor('quantidade', '0,5*3')).toBe(1.5);
    expect(valor('quantidade', '3/2')).toBe(1.5);
  });

  it('mostra a conta pendente acima do visor', () => {
    expect(textoPendente(teclas('quantidade', null, '1,5+'))).toBe('1,5 +');
    expect(textoPendente(teclas('quantidade', null, '1,5'))).toBe(' ');
  });
});

describe('vírgula no dinheiro', () => {
  it('não existe: o dinheiro já tem a vírgula fixa', () => {
    expect(valor('dinheiro', '5,5')).toBe(0.55);
  });
});
