import {
  celulaNoPonto,
  deslocarJanela,
  ESCALA_MAXIMA,
  JANELA_INICIAL,
  limitarJanela,
  zoomEmTorno,
} from '../../src/domain/services/zoomDoMapa';

// Mapa de 34 x 40 células exibido com 10 px por célula.
const L = 34;
const A = 40;
const PX = 10;

describe('zoom do mapa', () => {
  it('sem zoom, o ponto da tela é a própria célula', () => {
    expect(celulaNoPonto(JANELA_INICIAL, PX, 50, 120)).toEqual({ x: 5, y: 12 });
  });

  it('com zoom, o mesmo toque cai numa célula mais perto do canto da janela', () => {
    const janela = { x: 10, y: 20, escala: 2 };
    expect(celulaNoPonto(janela, PX, 50, 100)).toEqual({ x: 12.5, y: 25 });
  });

  it('aproximar em torno de um ponto mantém a célula sob os dedos', () => {
    const focal = { x: 17, y: 20 };
    const naTela = { x: 170, y: 200 };
    const janela = zoomEmTorno(JANELA_INICIAL, 2, focal, naTela, PX, L, A);
    const depois = celulaNoPonto(janela, PX, naTela.x, naTela.y);
    expect(depois.x).toBeCloseTo(17);
    expect(depois.y).toBeCloseTo(20);
    expect(janela.escala).toBe(2);
  });

  it('respeita a escala máxima e a mínima', () => {
    const grande = zoomEmTorno(JANELA_INICIAL, 99, { x: 0, y: 0 }, { x: 0, y: 0 }, PX, L, A);
    expect(grande.escala).toBe(ESCALA_MAXIMA);
    const pequena = zoomEmTorno(
      { x: 5, y: 5, escala: 2 },
      0.2,
      { x: 6, y: 6 },
      { x: 10, y: 10 },
      PX,
      L,
      A,
    );
    expect(pequena).toEqual(JANELA_INICIAL);
  });

  it('a janela nunca sai do mapa', () => {
    expect(limitarJanela({ x: -5, y: -5, escala: 2 }, L, A)).toEqual({ x: 0, y: 0, escala: 2 });
    expect(limitarJanela({ x: 99, y: 99, escala: 2 }, L, A)).toEqual({ x: 17, y: 20, escala: 2 });
  });

  it('arrastar para a direita mostra o que está à esquerda e para no limite', () => {
    const janela = { x: 10, y: 10, escala: 2 };
    const movida = deslocarJanela(janela, 100, 0, PX, L, A);
    expect(movida.x).toBe(5);
    expect(movida.y).toBe(10);
    expect(deslocarJanela(janela, 9999, 9999, PX, L, A)).toEqual({ x: 0, y: 0, escala: 2 });
  });
});
