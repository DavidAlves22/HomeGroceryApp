import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { espaco, fonte, usePaleta } from '../theme';

/**
 * Gráficos desenhados à mão (sem biblioteca), em um só tom de destaque: a série é uma só, então
 * cor não precisa distinguir nada. O mês/produto selecionado fica no tom cheio e os demais no tom suave.
 * Só o valor importante recebe rótulo direto; o resto fica na tabela de valores abaixo de cada gráfico.
 */

export interface BarraDoGrafico {
  rotulo: string;
  valor: number;
  /** Texto do valor já formatado (ex.: "R$ 921"). */
  texto: string;
}

interface GraficoDeBarrasProps {
  barras: BarraDoGrafico[];
  selecionada: number;
  aoSelecionar: (indice: number) => void;
  descricao: string;
  altura?: number;
}

export function GraficoDeBarras({
  barras,
  selecionada,
  aoSelecionar,
  descricao,
  altura = 150,
}: GraficoDeBarrasProps) {
  const p = usePaleta();
  const maximo = Math.max(...barras.map((b) => b.valor), 1);

  return (
    <View accessibilityLabel={descricao} style={{ gap: espaco.xs }}>
      <View style={{ height: altura }}>
        {/* Grade discreta: topo, meio e base */}
        {[0, 0.5, 1].map((posicao) => (
          <View
            key={posicao}
            style={[estilos.grade, { top: posicao * altura, backgroundColor: p.linha }]}
          />
        ))}
        <View style={estilos.colunas}>
          {barras.map((barra, indice) => {
            const ativa = indice === selecionada;
            const proporcao = barra.valor / maximo;
            return (
              <Pressable
                key={barra.rotulo}
                accessibilityRole="button"
                accessibilityLabel={`${barra.rotulo}: ${barra.texto}`}
                accessibilityState={{ selected: ativa }}
                onPress={() => aoSelecionar(indice)}
                style={estilos.coluna}
              >
                {ativa && (
                  <Text style={[estilos.valorNaBarra, { color: p.texto }]} numberOfLines={1}>
                    {barra.texto}
                  </Text>
                )}
                <View
                  style={{
                    width: '70%',
                    maxWidth: 36,
                    height: Math.max(proporcao * (altura - 22), barra.valor > 0 ? 3 : 0),
                    backgroundColor: ativa ? p.destaque : p.destaqueSuave,
                    borderTopLeftRadius: 5,
                    borderTopRightRadius: 5,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={estilos.rotulos}>
        {barras.map((barra, indice) => (
          <Text
            key={barra.rotulo}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: indice === selecionada ? '700' : '500',
              color: indice === selecionada ? p.texto : p.textoSuave,
            }}
          >
            {barra.rotulo}
          </Text>
        ))}
      </View>
    </View>
  );
}

interface BarrasHorizontaisProps {
  itens: { rotulo: string; valor: number; texto: string; detalhe?: string }[];
}

/** Ranking com o rótulo à esquerda, a barra no meio e o valor à direita (rótulos sempre visíveis). */
export function BarrasHorizontais({ itens }: BarrasHorizontaisProps) {
  const p = usePaleta();
  const maximo = Math.max(...itens.map((i) => i.valor), 1);

  return (
    <View style={{ gap: espaco.md }}>
      {itens.map((item) => (
        <View key={item.rotulo} style={{ gap: 4 }}>
          <View style={estilos.entre}>
            <Text
              style={{ color: p.texto, fontSize: fonte.corpo, fontWeight: '600', flex: 1 }}
              numberOfLines={1}
            >
              {item.rotulo}
            </Text>
            <Text
              style={{
                color: p.texto,
                fontSize: fonte.corpo,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              }}
            >
              {item.texto}
            </Text>
          </View>
          <View style={[estilos.trilho, { backgroundColor: p.superficie2 }]}>
            <View
              style={{
                width: `${Math.max((item.valor / maximo) * 100, 2)}%`,
                height: '100%',
                backgroundColor: p.destaque,
                borderRadius: 4,
              }}
            />
          </View>
          {item.detalhe && (
            <Text style={{ color: p.textoSuave, fontSize: 11 }}>{item.detalhe}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

interface GraficoDeLinhaProps {
  pontos: { rotulo: string; valor: number }[];
  textoDoValor: (valor: number) => string;
  descricao: string;
  altura?: number;
}

/** Evolução de um preço ao longo dos meses: linha de 2 px, marcadores de 8 px e o último ponto em destaque. */
export function GraficoDeLinha({
  pontos,
  textoDoValor,
  descricao,
  altura = 150,
}: GraficoDeLinhaProps) {
  const p = usePaleta();
  const [largura, setLargura] = useState(0);
  const margemEsquerda = 8;
  const margemDireita = 8;
  const margemTopo = 22;
  const margemBase = 10;

  const valores = pontos.map((pt) => pt.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  // Com preço constante a linha ficaria colada na base; abre uma folga para ela ficar no meio.
  const folga = maximo === minimo ? Math.max(maximo * 0.1, 1) : (maximo - minimo) * 0.15;
  const baixo = minimo - folga;
  const alto = maximo + folga;

  const utilX = Math.max(largura - margemEsquerda - margemDireita, 1);
  const utilY = altura - margemTopo - margemBase;
  const x = (i: number) =>
    margemEsquerda + (pontos.length === 1 ? utilX / 2 : (i / (pontos.length - 1)) * utilX);
  const y = (v: number) => margemTopo + (1 - (v - baixo) / (alto - baixo)) * utilY;
  const ultimo = pontos.length - 1;

  return (
    <View
      accessibilityLabel={descricao}
      onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}
      style={{ gap: espaco.xs }}
    >
      {largura > 0 && (
        <Svg width={largura} height={altura}>
          {[0, 0.5, 1].map((posicao) => (
            <Line
              key={posicao}
              x1={0}
              x2={largura}
              y1={margemTopo + posicao * utilY}
              y2={margemTopo + posicao * utilY}
              stroke={p.linha}
              strokeWidth={1}
            />
          ))}
          {pontos.length > 1 && (
            <Polyline
              points={pontos.map((pt, i) => `${x(i)},${y(pt.valor)}`).join(' ')}
              fill="none"
              stroke={p.destaque}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {pontos.map((pt, i) => (
            <Circle
              key={pt.rotulo}
              cx={x(i)}
              cy={y(pt.valor)}
              r={i === ultimo ? 5 : 4}
              fill={i === ultimo ? p.destaque : p.superficie}
              stroke={i === ultimo ? p.superficie : p.destaque}
              strokeWidth={2}
            />
          ))}
        </Svg>
      )}
      {largura > 0 && (
        <Text
          style={{
            position: 'absolute',
            top: 0,
            right: margemDireita,
            color: p.texto,
            fontSize: fonte.pequena,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
          }}
        >
          {textoDoValor(pontos[ultimo].valor)}
        </Text>
      )}
      <View style={estilos.rotulos}>
        <Text style={{ color: p.textoSuave, fontSize: 11 }}>{pontos[0].rotulo}</Text>
        {pontos.length > 1 && (
          <Text style={{ color: p.textoSuave, fontSize: 11 }}>{pontos[ultimo].rotulo}</Text>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  grade: { position: 'absolute', left: 0, right: 0, height: 1 },
  colunas: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  coluna: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  valorNaBarra: { fontSize: 11, fontWeight: '700', marginBottom: 3, fontVariant: ['tabular-nums'] },
  rotulos: { flexDirection: 'row', justifyContent: 'space-between' },
  entre: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  trilho: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
