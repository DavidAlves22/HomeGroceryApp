import {
  dataCurta,
  descreverCiclo,
  situacaoDaReposicao,
} from '../../src/domain/services/ritmoDeCompra';

describe('ritmoDeCompra', () => {
  it.each([
    [1, 'a cada ~1 dia'],
    [11, 'a cada ~11 dias'],
    [45, 'a cada ~45 dias'],
    [62, 'a cada ~2 meses'],
    [31 + 30 + 30 + 30, 'a cada ~4 meses'],
  ])('%i dias vira "%s"', (ciclo, esperado) => {
    expect(descreverCiclo(ciclo)).toBe(esperado);
  });

  it('mostra a data curta sem o ano', () => {
    expect(dataCurta('2026-10-06')).toBe('06/10');
  });

  describe('situacaoDaReposicao', () => {
    const hoje = new Date(2026, 10, 6, 21, 30); // 06/11/2026, noite: a hora não pode mudar o dia

    it('passou do previsto: atrasado, com os dias', () => {
      expect(situacaoDaReposicao('2026-11-03', hoje)).toEqual({
        texto: 'Atrasado há 3 dias',
        atrasado: true,
      });
      expect(situacaoDaReposicao('2026-11-05', hoje)).toEqual({
        texto: 'Atrasado há 1 dia',
        atrasado: true,
      });
    });

    it('no dia previsto e nos próximos: não é atraso', () => {
      expect(situacaoDaReposicao('2026-11-06', hoje)).toEqual({
        texto: 'Previsto para hoje',
        atrasado: false,
      });
      expect(situacaoDaReposicao('2026-11-07', hoje)).toEqual({
        texto: 'Previsto em 1 dia',
        atrasado: false,
      });
      expect(situacaoDaReposicao('2026-11-13', hoje)).toEqual({
        texto: 'Previsto em 7 dias',
        atrasado: false,
      });
    });
  });
});
