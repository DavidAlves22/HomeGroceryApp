import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rotuloDaUnidade, type ItemDaLista } from '../../domain/entities/tipos';
import { Dinheiro } from '../../domain/valueObjects/Dinheiro';
import { totalEstimadoDoItem, totalRealizadoDoItem } from '../../domain/services/financeiro';
import { formatarQuantidade } from '../../domain/services/organizacao';
import { espaco, fonte, raio, usePaleta } from '../theme';
import { Icone } from './Icone';
import { BotaoDeIcone } from './ui';

interface Props {
  item: ItemDaLista;
  /** Quem marcou foi outra pessoa (não o usuário atual): mostramos para a família saber. */
  marcadoPorOutro: boolean;
  /** Nome de quem marcou (da família), para mostrar "Ana marcou". Sem nome, diz "outra pessoa". */
  nomeDeQuemMarcou?: string;
  /** Mercado onde foi comprado (a compra do mês pode ser dividida entre vários). */
  nomeDoMercado?: string;
  /** Mercado onde o produto costuma ser comprado, quando é outro que o de hoje (só para item pendente). */
  mercadoHabitual?: string;
  /** Na compra dividida: quem vai pegar este item quando não sou eu. O fundo muda para ficar claro que não é meu. */
  comOutraPessoa?: string;
  /** Item que outra pessoa acabou de pedir (aviso em tempo real): ganha o selo "Novo" até ser marcado ou editado. */
  pedidoPor?: string;
  somenteLeitura: boolean;
  aoMarcar: (item: ItemDaLista) => void;
  aoEditar: (item: ItemDaLista) => void;
  /** Ordem manual: quando informado, mostra os botões subir/descer (nulo no limite da lista). */
  aoMover?: { subir: (() => void) | null; descer: (() => void) | null };
}

/** Valor mostrado ao lado da quantidade: o gasto, se comprado com preço; senão a estimativa. */
function textoDeValor(item: ItemDaLista): string {
  if (item.comprado && item.precoUnitario !== null) {
    return ` · ${totalRealizadoDoItem(item).formatar()}`;
  }
  if (item.precoEstimado !== null) return ` · est. ${totalEstimadoDoItem(item).formatar()}`;
  // Preço pago em outro mês: só consulta, nunca entra no total.
  if (item.precoReferencia !== null) {
    return ` · antes ${Dinheiro.deReais(item.precoReferencia).formatar()}`;
  }
  return item.comprado ? ` · sem preço pago` : '';
}

/**
 * Linha de produto da lista do mês. Marcar como comprado é UM toque na área grande da esquerda
 * (48 px, pensada para uma mão só); comprados ficam riscados e esmaecidos.
 */
export function LinhaDeItem({
  item,
  marcadoPorOutro,
  nomeDeQuemMarcou,
  nomeDoMercado,
  mercadoHabitual,
  comOutraPessoa,
  pedidoPor,
  somenteLeitura,
  aoMarcar,
  aoEditar,
  aoMover,
}: Props) {
  const p = usePaleta();
  const feito = item.comprado;

  return (
    <View
      style={[
        estilos.linha,
        {
          backgroundColor: feito ? 'transparent' : comOutraPessoa ? p.superficie2 : p.superficie,
          borderColor: p.linha,
        },
      ]}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`${item.nome}, ${formatarQuantidade(item.quantidade)} ${rotuloDaUnidade(item.unidade)}`}
        accessibilityState={{ checked: feito, disabled: somenteLeitura }}
        disabled={somenteLeitura}
        onPress={() => aoMarcar(item)}
        style={estilos.areaDoCheck}
      >
        <View
          style={[
            estilos.caixa,
            {
              borderColor: feito ? p.destaque : p.textoSuave,
              backgroundColor: feito ? p.destaque : 'transparent',
            },
          ]}
        >
          {feito && <Icone nome="check" tamanho={16} cor={p.textoSobreDestaque} espessura={3} />}
        </View>
      </Pressable>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={2}
          style={{
            color: feito ? p.textoSuave : p.texto,
            fontSize: fonte.corpo,
            fontWeight: '600',
            textDecorationLine: feito ? 'line-through' : 'none',
          }}
        >
          {item.nome}
        </Text>
        <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
          {formatarQuantidade(item.quantidade)} {rotuloDaUnidade(item.unidade)}
          {textoDeValor(item)}
          {!feito && comOutraPessoa ? ` · Com ${comOutraPessoa}` : ''}
          {!feito && mercadoHabitual ? ` · Costuma ser no ${mercadoHabitual}` : ''}
          {feito && nomeDoMercado ? ` · ${nomeDoMercado}` : ''}
          {feito && marcadoPorOutro ? ` · ${nomeDeQuemMarcou ?? 'outra pessoa'} marcou` : ''}
        </Text>
        {pedidoPor && !feito && (
          <Text style={{ color: p.destaque, fontSize: fonte.pequena, fontWeight: '700' }}>
            Novo · pedido por {pedidoPor}
          </Text>
        )}
      </View>

      {!somenteLeitura && aoMover && (
        <>
          <BotaoDeIcone
            icone="cima"
            rotulo={`Subir ${item.nome}`}
            desabilitado={!aoMover.subir}
            aoPressionar={() => aoMover.subir?.()}
          />
          <BotaoDeIcone
            icone="baixo"
            rotulo={`Descer ${item.nome}`}
            desabilitado={!aoMover.descer}
            aoPressionar={() => aoMover.descer?.()}
          />
        </>
      )}
      {!somenteLeitura && !aoMover && (
        <BotaoDeIcone
          icone="mais"
          rotulo={`Editar ${item.nome}`}
          aoPressionar={() => aoEditar(item)}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    borderWidth: 1,
    borderRadius: raio.md,
    paddingRight: espaco.sm,
    minHeight: 56,
  },
  areaDoCheck: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  caixa: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
