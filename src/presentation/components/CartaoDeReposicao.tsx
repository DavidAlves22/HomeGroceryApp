import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import { rotuloDaUnidade, type ItemSugerido } from '../../domain/entities/tipos';
import { formatarQuantidade } from '../../domain/services/organizacao';
import {
  dataCurta,
  descreverCiclo,
  situacaoDaReposicao,
} from '../../domain/services/ritmoDeCompra';
import { espaco, fonte, usePaleta } from '../theme';
import { CartaoDeLista } from './CartaoDeLista';
import { Icone } from './Icone';
import { Pilula } from './ui';

interface Props {
  itens: ItemSugerido[];
  /** Só há onde adicionar quando existe uma lista em andamento. */
  podeAdicionar: boolean;
  aoAdicionar: (item: ItemSugerido) => Promise<void>;
  aoFalhar: (mensagem: string) => void;
}

/**
 * "Hora de repor": produtos que, pelo ritmo de compra do grupo, já estão na hora ou chegam nos próximos dias.
 * Cada linha separa o que é decisão do que é contexto: nome e botão no topo, quantidade e situação (atrasado ou
 * previsto) no meio, e o ritmo em letra miúda embaixo. O cartão mostra 2 por vez e a folha, todos.
 */
export function CartaoDeReposicao({ itens, podeAdicionar, aoAdicionar, aoFalhar }: Props) {
  const p = usePaleta();
  const [adicionando, setAdicionando] = useState<string | null>(null);

  async function adicionar(item: ItemSugerido) {
    setAdicionando(item.chave);
    try {
      await aoAdicionar(item);
    } catch (e) {
      aoFalhar(mensagemParaUsuario(e));
    } finally {
      setAdicionando(null);
    }
  }

  return (
    <CartaoDeLista
      titulo="Hora de repor"
      texto="Pelo ritmo das suas compras. Se algum já está em casa, é só ignorar."
      itens={itens}
      chave={(item) => item.chave}
      renderizar={(item) => {
        const situacao = situacaoDaReposicao(item.proximaPrevista, new Date());
        return (
          <View style={estilos.linha}>
            <View style={estilos.topo}>
              <Text
                numberOfLines={1}
                style={{ flex: 1, color: p.texto, fontWeight: '800', fontSize: fonte.titulo }}
              >
                {item.nome}
              </Text>
              {podeAdicionar && item.categoriaId && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Adicionar ${item.nome} à lista`}
                  disabled={adicionando === item.chave}
                  onPress={() => void adicionar(item)}
                  style={({ pressed }) => [
                    estilos.adicionar,
                    { borderColor: p.destaque, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  {adicionando === item.chave ? (
                    <ActivityIndicator size="small" color={p.destaque} />
                  ) : (
                    <>
                      <Icone nome="mais_mais" tamanho={16} cor={p.destaque} espessura={2.5} />
                      <Text
                        style={{ color: p.destaque, fontWeight: '700', fontSize: fonte.pequena }}
                      >
                        Adicionar
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
            <View style={estilos.meio}>
              <Text style={{ color: p.texto, fontSize: fonte.corpo }}>
                {formatarQuantidade(item.quantidade)} {rotuloDaUnidade(item.unidade)}
              </Text>
              <Pilula texto={situacao.texto} tom={situacao.atrasado ? 'alerta' : 'neutro'} />
            </View>
            <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
              Compra {descreverCiclo(item.cicloEmDias)} · última em {dataCurta(item.ultimaCompra)}
            </Text>
          </View>
        );
      }}
    />
  );
}

const estilos = StyleSheet.create({
  linha: { gap: espaco.xs },
  topo: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
  meio: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm, flexWrap: 'wrap' },
  adicionar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.xs,
    minHeight: 40,
    minWidth: 40,
    paddingHorizontal: espaco.md,
    borderRadius: 20,
    borderWidth: 1.5,
  },
});
