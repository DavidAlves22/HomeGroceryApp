import { useColorScheme } from 'react-native';

/** Tokens do protótipo aprovado (laranja). Claro e escuro com a mesma estrutura. */
export const paletaClara = {
  fundo: '#F8F4F1',
  superficie: '#FFFFFF',
  superficie2: '#EFE7E1',
  texto: '#231810',
  textoSuave: '#7A6657',
  linha: '#E8DDD4',
  destaque: '#C2540A',
  textoSobreDestaque: '#FFFFFF',
  destaqueSuave: '#FBE3D1',
  alerta: '#B3261E',
  alertaSuave: '#F9DEDC',
};

export const paletaEscura: typeof paletaClara = {
  fundo: '#17110D',
  superficie: '#211813',
  superficie2: '#2D221B',
  texto: '#F5ECE5',
  textoSuave: '#B09F92',
  linha: '#3A2D24',
  destaque: '#FF9248',
  textoSobreDestaque: '#1F0E02',
  destaqueSuave: '#3F2412',
  alerta: '#FF8A80',
  alertaSuave: '#3F1B18',
};

export type Paleta = typeof paletaClara;

export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const raio = { sm: 12, md: 16, lg: 20, pilula: 999 };
export const fonte = { pequena: 12, corpo: 15, titulo: 17, grande: 26 };

/** Segue o tema do sistema (claro/escuro). */
export function usePaleta(): Paleta {
  return useColorScheme() === 'dark' ? paletaEscura : paletaClara;
}
