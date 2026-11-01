import { Competencia } from '../../src/domain/valueObjects/Competencia';
import { Dinheiro } from '../../src/domain/valueObjects/Dinheiro';

describe('Dinheiro', () => {
  it('multiplica preço por quantidade sem erro de ponto flutuante', () => {
    expect(Dinheiro.deReais(5.5).vezes(6).centavos).toBe(3300);
    expect(Dinheiro.deReais(0.1).mais(Dinheiro.deReais(0.2)).centavos).toBe(30);
  });

  it('soma o exemplo do enunciado: arroz + leite + café = R$ 101,00', () => {
    const total = Dinheiro.deReais(25)
      .vezes(2)
      .mais(Dinheiro.deReais(5.5).vezes(6))
      .mais(Dinheiro.deReais(18).vezes(1));
    expect(total.centavos).toBe(10100);
  });

  it('arredonda quantidade fracionada ao centavo', () => {
    expect(Dinheiro.deReais(38).vezes(1.5).centavos).toBe(5700);
    expect(Dinheiro.deReais(9.99).vezes(0.333).centavos).toBe(333);
  });

  it.each([
    ['5,50', 550],
    ['1.234,56', 123456],
    ['R$ 18', 1800],
    ['7.5', 750],
  ])('lê "%s" como %i centavos', (texto, centavos) => {
    expect(Dinheiro.deTexto(texto)?.centavos).toBe(centavos);
  });

  it('texto vazio ou sem número vira null', () => {
    expect(Dinheiro.deTexto('')).toBeNull();
    expect(Dinheiro.deTexto('abc')).toBeNull();
  });

  it('rejeita valores não finitos', () => {
    expect(() => Dinheiro.deCentavos(NaN)).toThrow();
  });
});

describe('Competencia', () => {
  it('aceita o formato AAAA-MM e expõe ano, mês e nome', () => {
    const c = Competencia.deChave('2026-11');
    expect(c.ano).toBe(2026);
    expect(c.mes).toBe(11);
    expect(c.nome).toBe('Novembro de 2026');
  });

  it.each(['2026-13', '2026-00', '26-11', '2026/11', ''])('rejeita "%s"', (chave) => {
    expect(() => Competencia.deChave(chave)).toThrow();
  });

  it('vira o ano ao avançar de dezembro e ao voltar de janeiro', () => {
    expect(Competencia.deChave('2026-12').proxima().chave).toBe('2027-01');
    expect(Competencia.deChave('2027-01').anterior().chave).toBe('2026-12');
  });

  it('nasce de uma data', () => {
    expect(Competencia.daData(new Date(2026, 10, 15)).chave).toBe('2026-11');
  });
});
