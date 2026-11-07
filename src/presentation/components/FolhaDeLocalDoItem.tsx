import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import type { LadoDaSecao, Mercado } from '../../domain/entities/mercados';
import { ladoNoPonto, nomeDoLado, secaoNoPonto, textoDoLado } from '../../domain/services/mapa';
import { useSemZoomDaPagina } from '../hooks/useSemZoomDaPagina';
import {
  JANELA_INICIAL,
  celulaNoPonto,
  deslocarJanela,
  zoomEmTorno,
  type Janela,
} from '../../domain/services/zoomDoMapa';
import { espaco, fonte, raio, usePaleta } from '../theme';
import { Botao, TextoSuave } from './base';
import { Moldura, RotuloDaFolha, TituloDaFolha } from './Folhas';
import { MapaSvg } from './MapaSvg';

/** O toque no mapa não pode virar rolagem da folha no navegador. */
const SEM_ROLAGEM = (Platform.OS === 'web' ? { touchAction: 'none' } : {}) as ViewStyle;

export interface LocalEscolhido {
  secaoId: string;
  lado: LadoDaSecao;
}

interface Props {
  visivel: boolean;
  nomeDoItem: string;
  mercado: Mercado;
  /** Locais já marcados para o produto neste mercado (vazio = vale a categoria da seção). */
  locaisAtuais: LocalEscolhido[];
  salvando: boolean;
  aoSalvar: (locais: LocalEscolhido[]) => void;
  aoFechar: () => void;
}

/**
 * "Onde você achou?": o usuário toca no mapa do mercado na seção (e, em gôndola de dois lados, na metade do
 * lado) onde o produto estava. O produto tem um único local por mercado: tocar em outro lugar troca o anterior.
 */
export function FolhaDeLocalDoItem({
  visivel,
  nomeDoItem,
  mercado,
  locaisAtuais,
  salvando,
  aoSalvar,
  aoFechar,
}: Props) {
  const p = usePaleta();
  const [escolhidos, setEscolhidos] = useState<LocalEscolhido[]>(locaisAtuais);
  const larguraPx = useRef(0);
  const [janela, setJanela] = useState<Janela>(JANELA_INICIAL);
  const janelaRef = useRef<Janela>(JANELA_INICIAL);
  janelaRef.current = janela;

  useSemZoomDaPagina(visivel);

  // Cada vez que a folha abre, parte do que já está salvo.
  useEffect(() => {
    if (visivel) {
      setEscolhidos(locaisAtuais.slice(0, 1));
      setJanela(JANELA_INICIAL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);

  function tocar(x: number, y: number) {
    if (larguraPx.current === 0) return;
    const { x: fx, y: fy } = celulaNoPonto(
      janelaRef.current,
      larguraPx.current / mercado.largura,
      x,
      y,
    );
    const secao = secaoNoPonto(mercado, fx, fy);
    if (!secao) return;

    const lado = ladoNoPonto(secao, fx, fy);
    // Um local só: tocar no que já está marcado desfaz; tocar em outro troca.
    const jaTem = escolhidos.some((e) => e.secaoId === secao.id && e.lado === lado);
    setEscolhidos(jaTem ? [] : [{ secaoId: secao.id, lado }]);
  }

  // Toque curto escolhe a seção; um dedo move a visão (com zoom); dois dedos aproximam e afastam.
  const tocarRef = useRef(tocar);
  tocarRef.current = tocar;
  const gestos = useMemo(() => {
    const m = mercado;
    let modo: 'nenhum' | 'mover' | 'pinca' = 'nenhum';
    let inicio = { x: 0, y: 0 };
    let visao: Janela = JANELA_INICIAL;
    let pinca: { d0: number; escala0: number; focal: { x: number; y: number } } | null = null;
    let moveu = false;

    const medidas = (e: GestureResponderEvent) => {
      const [a, b] = e.nativeEvent.touches;
      return {
        d: Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY),
        meio: { x: (a.locationX + b.locationX) / 2, y: (a.locationY + b.locationY) / 2 },
      };
    };
    const comecarPinca = (e: GestureResponderEvent) => {
      const { d, meio } = medidas(e);
      pinca = {
        d0: Math.max(d, 1),
        escala0: janelaRef.current.escala,
        focal: celulaNoPonto(janelaRef.current, larguraPx.current / m.largura, meio.x, meio.y),
      };
      modo = 'pinca';
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => larguraPx.current > 0,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        moveu = false;
        inicio = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
        visao = janelaRef.current;
        if (e.nativeEvent.touches.length >= 2) comecarPinca(e);
        else modo = 'mover';
      },
      onPanResponderMove: (e, g) => {
        const pxBase = larguraPx.current / m.largura;
        if (e.nativeEvent.touches.length >= 2) {
          if (modo !== 'pinca') comecarPinca(e);
          if (!pinca) return;
          moveu = true;
          const { d, meio } = medidas(e);
          setJanela(
            zoomEmTorno(
              janelaRef.current,
              (pinca.escala0 * d) / pinca.d0,
              pinca.focal,
              meio,
              pxBase,
              m.largura,
              m.altura,
            ),
          );
          return;
        }
        if (modo !== 'mover') return;
        if (Math.hypot(g.dx, g.dy) > 8) moveu = true;
        if (moveu) setJanela(deslocarJanela(visao, g.dx, g.dy, pxBase, m.largura, m.altura));
      },
      onPanResponderRelease: () => {
        if (!moveu && modo === 'mover') tocarRef.current(inicio.x, inicio.y);
        modo = 'nenhum';
        pinca = null;
      },
      onPanResponderTerminate: () => {
        modo = 'nenhum';
        pinca = null;
      },
    });
  }, [mercado]);

  const rotuloDe = (e: LocalEscolhido) => {
    const secao = mercado.secoes.find((s) => s.id === e.secaoId);
    if (!secao) return 'Seção removida';
    const texto = textoDoLado(secao, e.lado);
    return texto ? `${nomeDoLado(secao, e.lado)} · ${texto}` : secao.nome;
  };

  const igual =
    escolhidos.length === locaisAtuais.length &&
    escolhidos.every((e) => locaisAtuais.some((l) => l.secaoId === e.secaoId && l.lado === e.lado));

  return (
    <Moldura visivel={visivel} aoFechar={aoFechar}>
      <TituloDaFolha>Onde você achou {nomeDoItem}?</TituloDaFolha>
      <TextoSuave>
        Toque no mapa de {mercado.nome} na prateleira onde ele estava. Em gôndola de dois lados,
        toque na metade do lado certo.
      </TextoSuave>

      <View style={SEM_ROLAGEM} {...gestos.panHandlers}>
        <MapaSvg
          mapa={mercado}
          modo="mini"
          destacadas={escolhidos.map((e) => e.secaoId)}
          janela={janela}
          aoMedir={(largura) => {
            larguraPx.current = largura;
          }}
        />
      </View>

      <RotuloDaFolha>
        {escolhidos.length === 0 ? 'NENHUM LUGAR MARCADO' : 'LUGAR MARCADO'}
      </RotuloDaFolha>
      {escolhidos.length === 0 && (
        <TextoSuave>
          {locaisAtuais.length > 0
            ? 'Salvar sem lugar apaga o que você marcou: a rota volta a usar a categoria.'
            : 'Sem lugar marcado, a rota usa a seção da categoria do item.'}
        </TextoSuave>
      )}
      {escolhidos.map((e) => (
        <View
          key={`${e.secaoId}-${e.lado}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espaco.sm,
            borderRadius: raio.md,
            borderWidth: 1,
            borderColor: p.linha,
            backgroundColor: p.superficie2,
            paddingLeft: espaco.md,
          }}
        >
          <Text style={{ flex: 1, color: p.texto, fontSize: fonte.corpo, fontWeight: '600' }}>
            {rotuloDe(e)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Tirar ${rotuloDe(e)}`}
            onPress={() => setEscolhidos(escolhidos.filter((x) => x !== e))}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: p.textoSuave, fontSize: 18, fontWeight: '700' }}>×</Text>
          </Pressable>
        </View>
      ))}

      <Botao
        titulo={
          escolhidos.length === 0 && locaisAtuais.length > 0 ? 'Apagar local' : 'Salvar local'
        }
        carregando={salvando}
        desabilitado={igual}
        aoPressionar={() => aoSalvar(escolhidos)}
      />
      <Botao titulo="Cancelar" variante="texto" aoPressionar={aoFechar} />
    </Moldura>
  );
}
