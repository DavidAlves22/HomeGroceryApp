import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import type { LadoDaSecao, Mercado } from '../../domain/entities/mercados';
import { ladoNoPonto, nomeDoLado, secaoNoPonto, textoDoLado } from '../../domain/services/mapa';
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

const MAXIMO_DE_LOCAIS = 5;

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
 * lado) onde o produto estava. Tocar de novo desfaz. O produto pode ter mais de um lugar; a rota vai ao mais perto.
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
  const [aviso, setAviso] = useState<string | null>(null);
  const larguraPx = useRef(0);

  // Cada vez que a folha abre, parte do que já está salvo.
  useEffect(() => {
    if (visivel) {
      setEscolhidos(locaisAtuais);
      setAviso(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);

  function tocar(x: number, y: number) {
    if (larguraPx.current === 0) return;
    const px = larguraPx.current / mercado.largura;
    const fx = x / px;
    const fy = y / px;
    const secao = secaoNoPonto(mercado, fx, fy);
    if (!secao) return;

    const lado = ladoNoPonto(secao, fx, fy);
    const jaTem = escolhidos.some((e) => e.secaoId === secao.id && e.lado === lado);
    if (jaTem) {
      setEscolhidos(escolhidos.filter((e) => !(e.secaoId === secao.id && e.lado === lado)));
      setAviso(null);
    } else if (escolhidos.length >= MAXIMO_DE_LOCAIS) {
      setAviso(`Escolha no máximo ${MAXIMO_DE_LOCAIS} lugares.`);
    } else {
      setEscolhidos([...escolhidos, { secaoId: secao.id, lado }]);
      setAviso(null);
    }
  }

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
        toque na metade do lado certo. A rota deste e dos próximos meses passa a ir para lá.
      </TextoSuave>

      <View
        style={SEM_ROLAGEM}
        onStartShouldSetResponder={() => true}
        onResponderRelease={(e) => tocar(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      >
        <MapaSvg
          mapa={mercado}
          modo="mini"
          destacadas={escolhidos.map((e) => e.secaoId)}
          aoMedir={(largura) => {
            larguraPx.current = largura;
          }}
        />
      </View>

      <RotuloDaFolha>
        {escolhidos.length === 0 ? 'NENHUM LUGAR MARCADO' : 'LUGARES MARCADOS'}
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
      {aviso && <Text style={{ color: p.alerta, fontWeight: '600' }}>{aviso}</Text>}

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
