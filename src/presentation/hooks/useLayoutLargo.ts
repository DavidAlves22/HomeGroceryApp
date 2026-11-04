import { useWindowDimensions } from 'react-native';

/** A partir daqui (px) o app deixa o formato de celular: menu lateral e telas em duas colunas. */
export const LARGURA_DO_DESKTOP = 960;

/** Largura máxima do conteúdo nas telas que aproveitam o espaço do computador. */
export const LARGURA_MAXIMA_LARGA = 1240;

/** Verdadeiro quando a janela é larga o bastante (computador, tablet deitado). Reage ao redimensionar. */
export function useLayoutLargo(): boolean {
  const { width } = useWindowDimensions();
  return width >= LARGURA_DO_DESKTOP;
}
