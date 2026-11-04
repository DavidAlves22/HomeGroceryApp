import React, { useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { usePaleta } from '../theme';
import { useLayoutLargo } from './useLayoutLargo';

/**
 * Medidas do layout de computador que a pessoa pode ajustar no editor de mapa. Ficam guardadas neste navegador
 * (`localStorage`); sem ele (janela privada, bloqueio) valem os padrões e nada quebra.
 */
export interface AjusteDoLayout {
  /** Largura do painel de edição à direita (editor de mapa e rota). */
  painel: number;
  /** Largura máxima da página no editor de mapa e na rota. */
  larguraMaxima: number;
}

export const AJUSTE_PADRAO: AjusteDoLayout = { painel: 500, larguraMaxima: 1740 };

const CHAVE_DO_ARMAZENAMENTO = 'hg-ajuste-do-layout';

function lerGuardado(): AjusteDoLayout {
  try {
    const texto = globalThis.localStorage?.getItem(CHAVE_DO_ARMAZENAMENTO);
    if (!texto) return { ...AJUSTE_PADRAO };
    const lido = JSON.parse(texto) as Partial<AjusteDoLayout>;
    return {
      painel: Number.isFinite(lido.painel) ? Number(lido.painel) : AJUSTE_PADRAO.painel,
      larguraMaxima: Number.isFinite(lido.larguraMaxima)
        ? Number(lido.larguraMaxima)
        : AJUSTE_PADRAO.larguraMaxima,
    };
  } catch {
    return { ...AJUSTE_PADRAO };
  }
}

let atual: AjusteDoLayout = Platform.OS === 'web' ? lerGuardado() : { ...AJUSTE_PADRAO };
const ouvintes = new Set<() => void>();

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function definir(parcial: Partial<AjusteDoLayout>) {
  atual = { ...atual, ...parcial };
  try {
    globalThis.localStorage?.setItem(CHAVE_DO_ARMAZENAMENTO, JSON.stringify(atual));
  } catch {
    // Sem armazenamento: o ajuste vale só até recarregar.
  }
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
];

/**
 * Caixinha flutuante com um controle deslizante por medida. Quem a coloca na tela é o editor de mapa, então ela
 * some ao sair dele. Só na web e em janela larga: no celular (instalado ou não) o layout é outro e não aparece.
 */
export function PainelDeAjuste() {
  const p = usePaleta();
  const largo = useLayoutLargo();
  const valores = useAjusteDoLayout();
  const [aberto, setAberto] = useState(true);
  if (Platform.OS !== 'web' || !largo) return null;

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
