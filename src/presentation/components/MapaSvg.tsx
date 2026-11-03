import React from 'react';
import { Platform, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Pattern,
  Polyline,
  Rect,
  Text as TextoSvg,
} from 'react-native-svg';
import type { MapaEmEdicao, ParadaDaRota, Ponto, Secao } from '../../domain/entities/mercados';
import { mesmoAlvo, type AlvoDoMapa } from '../../domain/services/mapa';
import { usePaleta } from '../theme';

/** O SVG não herda a fonte do app: no navegador usa a fonte do sistema, como o resto das telas. */
const FONTE =
  Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", sans-serif' : undefined;

/** Cada célula da grade vale 10 unidades do desenho. */
export const CELULA = 10;

const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

interface RotuloDoMapa {
  texto: string;
  x: number;
  y: number;
  vertical: boolean;
  tamanho: number;
}

/** Nomes dentro da seção. Gôndola de dois lados mostra um nome em cada metade, separados por uma linha. */
function rotulosDaSecao(s: Secao): {
  rotulos: RotuloDoMapa[];
  divisoria: [number, number, number, number] | null;
} {
  const w = s.area.largura * CELULA;
  const h = s.area.altura * CELULA;
  const rotulo = (
    texto: string,
    x: number,
    y: number,
    vertical: boolean,
    comprimento: number,
    teto: number,
  ) => ({
    texto,
    x,
    y,
    vertical,
    tamanho: limitar(Math.min((comprimento - 8) / (Math.max(texto.length, 1) * 0.62), teto), 4, 9),
  });

  if (!s.dividida) {
    const vertical = h > w * 1.4;
    return {
      rotulos: [rotulo(s.nome, w / 2, h / 2, vertical, vertical ? h : w, 9)],
      divisoria: null,
    };
  }
  const nomeB = s.nomeLadoB ?? 'Lado B';
  if (w >= h) {
    return {
      rotulos: [
        rotulo(s.nome, w / 2, h / 4, false, w, h / 2 - 3),
        rotulo(nomeB, w / 2, (3 * h) / 4, false, w, h / 2 - 3),
      ],
      divisoria: [0, h / 2, w, h / 2],
    };
  }
  return {
    rotulos: [
      rotulo(s.nome, w / 4, h / 2, true, h, w / 2 - 3),
      rotulo(nomeB, (3 * w) / 4, h / 2, true, h, w / 2 - 3),
    ],
    divisoria: [w / 2, 0, w / 2, h],
  };
}

interface Props {
  mapa: Pick<MapaEmEdicao, 'largura' | 'altura' | 'entrada' | 'caixas' | 'secoes'>;
  /** 'editar' mostra a grade de pontos e a bolinha de redimensionar; 'rota' realça só as seções da rota. */
  modo: 'mini' | 'rota' | 'editar';
  selecionado?: AlvoDoMapa | null;
  rota?: { trilha: Ponto[]; paradas: ParadaDaRota[]; posicao: Ponto } | null;
  /** Seções realçadas à força (ex.: onde o usuário marcou o produto). Sobrepõe o realce padrão. */
  destacadas?: string[];
  aoMedir?: (largura: number) => void;
}

/**
 * Desenho do mercado: seções, entrada, caixas e (na rota) a trilha, as paradas numeradas e a posição
 * de quem está comprando. Só desenha: no editor, os toques são tratados pela tela que envolve o mapa.
 */
export function MapaSvg({
  mapa,
  modo,
  selecionado = null,
  rota = null,
  destacadas,
  aoMedir,
}: Props) {
  const p = usePaleta();
  const editar = modo === 'editar';
  const ativas = new Set(rota?.paradas.map((x) => x.secaoId));
  const centro = (c: Ponto) => ({ x: c.x * CELULA + CELULA / 2, y: c.y * CELULA + CELULA / 2 });
  const pontos = rota?.trilha.map((t) => `${centro(t).x},${centro(t).y}`).join(' ') ?? '';
  const largura = mapa.largura * CELULA;
  const altura = mapa.altura * CELULA;
  const e = centro(mapa.entrada);
  const selecionadoSecao = selecionado?.tipo === 'secao' ? selecionado.id : null;

  return (
    <View
      pointerEvents="none"
      style={{ width: '100%', aspectRatio: mapa.largura / mapa.altura }}
      onLayout={(ev) => aoMedir?.(ev.nativeEvent.layout.width)}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${largura} ${altura}`}>
        <Rect width={largura} height={altura} rx={16} fill={p.superficie2} />
        {editar && (
          <>
            <Defs>
              <Pattern id="grade" width={CELULA} height={CELULA} patternUnits="userSpaceOnUse">
                <Circle
                  cx={CELULA / 2}
                  cy={CELULA / 2}
                  r={0.8}
                  fill={p.textoSuave}
                  opacity={0.45}
                />
              </Pattern>
            </Defs>
            <Rect width={largura} height={altura} rx={16} fill="url(#grade)" />
          </>
        )}

        {mapa.secoes.map((s) => {
          const tem = s.categoriasLadoA.length + s.categoriasLadoB.length > 0;
          const marcada = destacadas
            ? destacadas.includes(s.id)
            : editar
              ? s.id === selecionadoSecao
              : rota
                ? ativas.has(s.id)
                : tem;
          const realce = marcada || (editar && tem);
          const { rotulos, divisoria } = rotulosDaSecao(s);
          const w = s.area.largura * CELULA;
          const h = s.area.altura * CELULA;
          return (
            <G key={s.id} x={s.area.x * CELULA} y={s.area.y * CELULA}>
              <Rect
                width={w}
                height={h}
                rx={5}
                fill={realce ? p.destaqueSuave : p.superficie}
                stroke={realce ? p.destaque : p.linha}
                strokeWidth={editar && s.id === selecionadoSecao ? 3 : 1.5}
              />
              {rotulos.map((r) => {
                const texto = (
                  <TextoSvg
                    fontFamily={FONTE}
                    x={r.x}
                    y={r.y + r.tamanho / 3}
                    fontSize={r.tamanho}
                    fontWeight="700"
                    textAnchor="middle"
                    fill={realce ? p.destaque : p.textoSuave}
                  >
                    {r.texto}
                  </TextoSvg>
                );
                return r.vertical ? (
                  <G key={r.texto + r.x} rotation={-90} origin={`${r.x}, ${r.y}`}>
                    {texto}
                  </G>
                ) : (
                  <G key={r.texto + r.x}>{texto}</G>
                );
              })}
              {divisoria && (
                <Line
                  x1={divisoria[0]}
                  y1={divisoria[1]}
                  x2={divisoria[2]}
                  y2={divisoria[3]}
                  stroke={realce ? p.destaque : p.linha}
                  strokeWidth={1.5}
                  opacity={0.55}
                />
              )}
              {editar && s.id === selecionadoSecao && (
                <Circle
                  cx={w}
                  cy={h}
                  r={6}
                  fill={p.destaque}
                  stroke={p.superficie}
                  strokeWidth={2}
                />
              )}
            </G>
          );
        })}

        <G x={mapa.caixas.x * CELULA} y={mapa.caixas.y * CELULA}>
          <Rect
            width={mapa.caixas.largura * CELULA}
            height={mapa.caixas.altura * CELULA}
            rx={5}
            fill={p.texto}
            opacity={0.88}
            stroke={editar && mesmoAlvo(selecionado, { tipo: 'caixas' }) ? p.destaque : 'none'}
            strokeWidth={3}
          />
          <TextoSvg
            fontFamily={FONTE}
            x={(mapa.caixas.largura * CELULA) / 2}
            y={(mapa.caixas.altura * CELULA) / 2 + 3}
            fontSize={8}
            fontWeight="700"
            textAnchor="middle"
            fill={p.fundo}
          >
            CAIXAS
          </TextoSvg>
        </G>

        <Circle
          cx={e.x}
          cy={e.y}
          r={6}
          fill={p.texto}
          stroke={editar && mesmoAlvo(selecionado, { tipo: 'entrada' }) ? p.destaque : 'none'}
          strokeWidth={3}
        />
        <TextoSvg
          fontFamily={FONTE}
          x={e.x}
          y={e.y - 11}
          fontSize={8}
          fontWeight="700"
          textAnchor="middle"
          fill={p.textoSuave}
        >
          ENTRADA
        </TextoSvg>

        {rota && pontos.length > 0 && (
          <>
            <Polyline
              points={pontos}
              fill="none"
              stroke={p.destaque}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.55}
            />
            <Polyline
              points={pontos}
              fill="none"
              stroke={p.destaque}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1 7"
            />
          </>
        )}
        {rota?.paradas.map((parada, i) => {
          const c = centro(parada.posicao);
          return (
            <G key={`${parada.secaoId}-${parada.lado ?? ''}-${i}`}>
              <Circle
                cx={c.x}
                cy={c.y}
                r={i === 0 ? 11 : 9}
                fill={i === 0 ? p.destaque : p.superficie}
                stroke={p.destaque}
                strokeWidth={2}
              />
              <TextoSvg
                fontFamily={FONTE}
                x={c.x}
                y={c.y + 3.5}
                fontSize={10}
                fontWeight="800"
                textAnchor="middle"
                fill={i === 0 ? p.textoSobreDestaque : p.destaque}
              >
                {String(i + 1)}
              </TextoSvg>
            </G>
          );
        })}
        {rota && (
          <>
            <Circle
              cx={centro(rota.posicao).x}
              cy={centro(rota.posicao).y}
              r={14}
              fill={p.destaque}
              opacity={0.22}
            />
            <Circle
              cx={centro(rota.posicao).x}
              cy={centro(rota.posicao).y}
              r={5}
              fill={p.texto}
              stroke={p.superficie}
              strokeWidth={2}
            />
          </>
        )}
      </Svg>
    </View>
  );
}
