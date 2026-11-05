import {
  dataDoDia,
  melhorDia,
  percentual,
  rotuloDeDias,
  rotuloDoDia,
  rotuloDoRecurso,
  somarPontos,
  totalDePaginas,
  vistoPorUltimo,
} from '../../src/domain/services/painelAdmin';

const agora = new Date('2026-11-04T15:00:00Z');

describe('painelAdmin', () => {
  it('soma os valores da série', () => {
    expect(somarPontos([])).toBe(0);
    expect(
      somarPontos([
        { dia: '2026-11-03', valor: 2 },
        { dia: '2026-11-04', valor: 5 },
      ]),
    ).toBe(7);
  });

  it('escreve o dia como dia/mês e preserva o que não é data', () => {
    expect(rotuloDoDia('2026-11-04')).toBe('04/11');
    expect(rotuloDoDia('hoje')).toBe('hoje');
  });

  it('acha o dia de pico, o mais recente no empate, e nada se não houve atividade', () => {
    expect(melhorDia([{ dia: '2026-11-03', valor: 0 }])).toBeNull();
    expect(
      melhorDia([
        { dia: '2026-11-01', valor: 4 },
        { dia: '2026-11-02', valor: 1 },
        { dia: '2026-11-03', valor: 4 },
      ])?.dia,
    ).toBe('2026-11-03');
  });

  describe('vistoPorUltimo', () => {
    it.each([
      ['2026-11-04T14:59:30Z', 'agora'],
      ['2026-11-04T14:55:00Z', 'há 5 min'],
      ['2026-11-04T12:00:00Z', 'há 3 h'],
      ['2026-11-03T14:00:00Z', 'há 1 dia'],
      ['2026-11-01T15:00:00Z', 'há 3 dias'],
    ])('%s vira "%s"', (iso, esperado) => {
      expect(vistoPorUltimo(iso, agora)).toBe(esperado);
    });

    it('sem data ou com data inválida diz que não há registro', () => {
      expect(vistoPorUltimo(null, agora)).toBe('sem registro');
      expect(vistoPorUltimo('ontem', agora)).toBe('sem registro');
    });
  });

  describe('dataDoDia', () => {
    it('escreve dia/mês/ano no horário de Brasília', () => {
      expect(dataDoDia('2026-11-04T15:00:00Z')).toBe('04/11/2026');
      // 01:00 UTC ainda é a noite do dia anterior em Brasília.
      expect(dataDoDia('2026-11-05T01:00:00Z')).toBe('04/11/2026');
      expect(dataDoDia('2027-01-01T02:59:00Z')).toBe('31/12/2026');
    });

    it('sem data ou com data inválida diz que não há registro', () => {
      expect(dataDoDia(null)).toBe('sem registro');
      expect(dataDoDia('ontem')).toBe('sem registro');
    });
  });

  it('calcula as páginas da lista de contas (mínimo 1)', () => {
    expect(totalDePaginas({ total: 0, tamanho: 50 })).toBe(1);
    expect(totalDePaginas({ total: 50, tamanho: 50 })).toBe(1);
    expect(totalDePaginas({ total: 51, tamanho: 50 })).toBe(2);
  });

  it('calcula porcentagem inteira e trata total zero', () => {
    expect(percentual(1, 3)).toBe(33);
    expect(percentual(2, 3)).toBe(67);
    expect(percentual(5, 5)).toBe(100);
    expect(percentual(0, 0)).toBe(0);
  });

  it('escreve os rótulos de dias e de recursos', () => {
    expect(rotuloDeDias(1)).toBe('1 dia');
    expect(rotuloDeDias(30)).toBe('30 dias');
    expect(rotuloDoRecurso('divisao')).toBe('Já dividiram uma compra');
  });
});
