import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

const CAMINHOS = {
  inicio: ['M3 11l9-8 9 8', 'M5 10v10h14V10'],
  lista: ['M8 6h13M8 12h13M8 18h13'],
  historico: ['M12 7v5l3 2'],
  grafico: ['M4 20V10M10 20V4M16 20v-7M22 20H2'],
  pessoas: ['M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5'],
  alta: ['M12 19V5M5 12l7-7 7 7'],
  baixa: ['M12 5v14M19 12l-7 7-7-7'],
  mais: [],
  mais_mais: ['M12 5v14M5 12h14'],
  busca: ['M20 20l-4-4'],
  filtro: ['M3 5h18l-7 8v6l-4-2v-4z'],
  check: ['M4 12l5 5L20 6'],
  voltar: ['M15 6l-6 6 6 6'],
  seta: ['M9 6l6 6-6 6'],
  cima: ['M6 15l6-6 6 6'],
  baixo: ['M6 9l6 6 6-6'],
  editar: ['M4 20h4L19 9l-4-4L4 16z'],
  estrela: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
  categoria: ['M3 12V3h9l9 9-9 9z'],
  sair: ['M9 4H5v16h4', 'M16 8l4 4-4 4', 'M20 12H9'],
  fechar: ['M6 6l12 12M18 6L6 18'],
  mapa: ['M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z', 'M9 4v14M15 6v14'],
  rota: ['M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5'],
  cadeado: ['M6 11h12v9H6z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  cadeado_aberto: ['M6 11h12v9H6z', 'M8 11V8a4 4 0 0 1 7.4-2'],
} as const;

export type NomeDoIcone = keyof typeof CAMINHOS;

interface Props {
  nome: NomeDoIcone;
  tamanho?: number;
  cor: string;
  espessura?: number;
  /** Preenche o desenho com a cor (ex.: estrela de favorito marcada). */
  preenchido?: boolean;
}

/** Ícones desenhados em SVG (sem biblioteca de ícones), no mesmo traço fino do protótipo. */
export function Icone({ nome, tamanho = 22, cor, espessura = 2, preenchido = false }: Props) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
      {nome === 'historico' && (
        <Circle cx="12" cy="12" r="9" stroke={cor} strokeWidth={espessura} />
      )}
      {nome === 'pessoas' && <Circle cx="9" cy="8" r="3.5" stroke={cor} strokeWidth={espessura} />}
      {nome === 'busca' && <Circle cx="11" cy="11" r="7" stroke={cor} strokeWidth={espessura} />}
      {nome === 'mais' && (
        <>
          <Circle cx="5" cy="12" r="1.6" fill={cor} />
          <Circle cx="12" cy="12" r="1.6" fill={cor} />
          <Circle cx="19" cy="12" r="1.6" fill={cor} />
        </>
      )}
      {CAMINHOS[nome].map((d) => (
        <Path
          key={d}
          d={d}
          fill={preenchido ? cor : 'none'}
          stroke={cor}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
