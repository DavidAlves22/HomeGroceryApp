import React, { useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { usePaleta } from '../theme';
import { useLayoutLargo } from './useLayoutLargo';

/**
 * Medidas do layout de computador que dá para mexer ao vivo (só para afinar o visual). Ficam só na memória:
 * recarregar a página volta aos valores padrão, então nada fica "preso" no navegador.
 */
export interface AjusteDoLayout {
  /** Largura do painel de edição à direita (mapa e rota). */
  painel: number;
  /** Largura máxima da página no editor de mapa e na rota. */
  larguraMaxima: number;
  /** Largura do menu lateral. */
  menu: number;
}

export const AJUSTE_PADRAO: AjusteDoLayout = { painel: 400, larguraMaxima: 2400, menu: 220 };

let atual: AjusteDoLayout = { ...AJUSTE_PADRAO };
const ouvintes = new Set<() => void>();

/** O painel de ajuste só aparece se o endereço trouxe `?ajuste` (ex.: .../mapa?ajuste=1). Lido uma vez ao abrir. */
const ajusteAtivo =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('ajuste');

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function definir(parcial: Partial<AjusteDoLayout>) {
  atual = { ...atual, ...parcial };
  ouvintes.forEach((o) => o());
}

export function useAjusteDoLayout(): AjusteDoLayout {
  return useSyncExternalStore(
    assinar,
    () => atual,
    () => AJUSTE_PADRAO,
  );
}

const CONTROLES: {
  chave: keyof AjusteDoLayout;
  rotulo: string;
  min: number;
  max: number;
  passo: number;
}[] = [
  { chave: 'painel', rotulo: 'Painel da direita', min: 240, max: 800, passo: 10 },
  { chave: 'larguraMaxima', rotulo: 'Largura máxima da página', min: 1000, max: 2600, passo: 20 },
  { chave: 'menu', rotulo: 'Menu lateral', min: 120, max: 360, passo: 10 },
];

/** Caixinha flutuante com um controle deslizante por medida e os valores à vista. Só no computador, só com ?ajuste. */
export function PainelDeAjuste() {
  const p = usePaleta();
  const largo = useLayoutLargo();
  const valores = useAjusteDoLayout();
  const [aberto, setAberto] = useState(true);
  if (!ajusteAtivo || !largo) return null;

  return (
    <View
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        zIndex: 1000,
        width: 280,
        padding: 12,
        gap: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: p.linha,
        backgroundColor: p.superficie,
        boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
      }}
    >
      <Pressable accessibilityRole="button" onPress={() => setAberto(!aberto)}>
        <Text style={{ color: p.texto, fontWeight: '800' }}>
          {aberto ? '▾' : '▸'} Ajustar tamanhos
        </Text>
      </Pressable>
      {aberto && (
        <>
          {CONTROLES.map((c) => (
            <View key={c.chave}>
              <Text style={{ color: p.textoSuave, fontSize: 12, fontWeight: '700' }}>
                {c.rotulo}: {valores[c.chave]} px
              </Text>
              {React.createElement('input', {
                type: 'range',
                min: c.min,
                max: c.max,
                step: c.passo,
                value: valores[c.chave],
                'aria-label': c.rotulo,
                style: { width: '100%' },
                onChange: (e: { target: { value: string } }) =>
                  definir({ [c.chave]: Number(e.target.value) }),
              })}
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => definir({ ...AJUSTE_PADRAO })}>
            <Text style={{ color: p.destaque, fontWeight: '700', fontSize: 13 }}>
              Restaurar padrão
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
