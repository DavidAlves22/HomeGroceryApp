/**
 * Zoom do editor de mapa. A "janela" é o pedaço do mapa que aparece na tela: canto superior esquerdo
 * (x, y) em células e a escala (1 = mapa inteiro). Tudo em células do mapa, não em pixels, para o desenho
 * e a conversão dos toques concordarem.
 */
export interface Janela {
  x: number;
  y: number;
  escala: number;
}

export const ESCALA_MINIMA = 1;
export const ESCALA_MAXIMA = 4;
export const JANELA_INICIAL: Janela = { x: 0, y: 0, escala: 1 };

const entre = (valor: number, minimo: number, maximo: number) =>
  Math.min(maximo, Math.max(minimo, valor));

/** Mantém a escala nos limites e a janela inteira dentro do mapa (sem mostrar borda vazia). */
export function limitarJanela(janela: Janela, largura: number, altura: number): Janela {
  const escala = entre(janela.escala, ESCALA_MINIMA, ESCALA_MAXIMA);
  return {
    escala,
    x: entre(janela.x, 0, largura - largura / escala),
    y: entre(janela.y, 0, altura - altura / escala),
  };
}

/** Célula (fracionada) do mapa que está sob um ponto da tela, em pixels dentro da área do mapa. */
export function celulaNoPonto(janela: Janela, pxPorCelulaBase: number, xPx: number, yPx: number) {
  const px = pxPorCelulaBase * janela.escala;
  return { x: janela.x + xPx / px, y: janela.y + yPx / px };
}

/**
 * Muda a escala mantendo a célula `focal` debaixo do mesmo ponto da tela (`pontoNaTela`, em pixels).
 * Serve ao pinça (o ponto é o meio dos dois dedos, que também anda e por isso já move a visão) e aos botões.
 */
export function zoomEmTorno(
  janela: Janela,
  novaEscala: number,
  focal: { x: number; y: number },
  pontoNaTela: { x: number; y: number },
  pxPorCelulaBase: number,
  largura: number,
  altura: number,
): Janela {
  const escala = entre(novaEscala, ESCALA_MINIMA, ESCALA_MAXIMA);
  const px = pxPorCelulaBase * escala;
  return limitarJanela(
    { escala, x: focal.x - pontoNaTela.x / px, y: focal.y - pontoNaTela.y / px },
    largura,
    altura,
  );
}

/** Arrasta a visão: o mapa acompanha o dedo (dedo para a direita mostra o que está à esquerda). */
export function deslocarJanela(
  janela: Janela,
  dxPx: number,
  dyPx: number,
  pxPorCelulaBase: number,
  largura: number,
  altura: number,
): Janela {
  const px = pxPorCelulaBase * janela.escala;
  return limitarJanela(
    { ...janela, x: janela.x - dxPx / px, y: janela.y - dyPx / px },
    largura,
    altura,
  );
}
