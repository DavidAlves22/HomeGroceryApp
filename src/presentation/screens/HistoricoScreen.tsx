import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Dinheiro } from '../../domain/valueObjects/Dinheiro';
import { Cartao } from '../components/base';
import {
  BarraDeProgresso,
  Cabecalho,
  Carregando,
  EstadoVazio,
  Pagina,
  Pilula,
} from '../components/ui';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

/** Meses anteriores em ordem cronológica inversa. Abrir um mês mostra a lista como ficou (finalizada = só leitura). */
export function HistoricoScreen() {
  const p = usePaleta();
  const container = useContainer();
  const navegacao = useNavegacao();
  const {
    dados: listas,
    erro,
    carregando,
    recarregar,
  } = useCarregar(() => container.listarListas.executar(), 'historico');

  if (carregando && !listas)
    return (
      <Pagina>
        <Carregando />
      </Pagina>
    );

  return (
    <Pagina>
      <Cabecalho titulo="Histórico" />
      {erro && !listas ? (
        <EstadoVazio
          titulo="Não foi possível carregar"
          texto={erro}
          acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void recarregar() }}
        />
      ) : !listas || listas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma compra ainda"
          texto="Quando você criar listas mensais, elas aparecem aqui, mês a mês, para consulta."
          acao={{
            rotulo: 'Criar a primeira lista',
            aoPressionar: () => navegacao.navigate('NovaLista'),
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={estilos.conteudo}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => void recarregar()}
              tintColor={p.destaque}
            />
          }
        >
          {listas.map((lista) => (
            <Pressable
              key={lista.id}
              accessibilityRole="button"
              onPress={() => navegacao.navigate('DetalheDaLista', { listaId: lista.id })}
            >
              <Cartao estilo={{ gap: espaco.sm }}>
                <View style={estilos.entre}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '800' }}>
                      {lista.competenciaNome}
                    </Text>
                    {!lista.principal && (
                      <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                        {lista.nome}
                      </Text>
                    )}
                  </View>
                  <Pilula
                    texto={lista.status === 'Finalizada' ? 'Finalizada' : 'Em andamento'}
                    tom={lista.status === 'Finalizada' ? 'neutro' : 'destaque'}
                  />
                </View>
                <BarraDeProgresso percentual={lista.percentual} />
                <View style={estilos.entre}>
                  <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                    {lista.totalDeItens} {lista.totalDeItens === 1 ? 'produto' : 'produtos'} ·{' '}
                    {lista.percentual}% comprado
                  </Text>
                  <Text
                    style={{
                      color: p.texto,
                      fontSize: fonte.titulo,
                      fontWeight: '800',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {Dinheiro.deReais(lista.totalRealizado).formatar()}
                  </Text>
                </View>
                <Text
                  style={{
                    color: p.textoSuave,
                    fontSize: fonte.pequena,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {lista.finalizadaEm
                    ? `Finalizada em ${new Date(lista.finalizadaEm).toLocaleDateString('pt-BR')}`
                    : 'Em andamento: o total muda conforme você compra'}
                </Text>
              </Cartao>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: 40 },
  entre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
});
