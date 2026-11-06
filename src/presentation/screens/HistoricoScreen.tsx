import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import { Dinheiro } from '../../domain/valueObjects/Dinheiro';
import { Botao, Cartao } from '../components/base';
import {
  BarraDeProgresso,
  Cabecalho,
  Carregando,
  EstadoVazio,
  Pagina,
  Pilula,
} from '../components/ui';
import { Icone } from '../components/Icone';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

/** Meses anteriores em ordem cronológica inversa. Abrir um mês mostra a lista como ficou (finalizada = só leitura). */
export function HistoricoScreen() {
  const p = usePaleta();
  const container = useContainer();
  const navegacao = useNavegacao();
  const toast = useToast();
  // Exclusão pede segundo toque (como no resto do app); sem o segundo toque o botão volta ao normal.
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [apagandoId, setApagandoId] = useState<string | null>(null);
  const {
    dados: listas,
    erro,
    carregando,
    recarregar,
  } = useCarregar(() => container.listarListas.executar(), 'historico');

  useEffect(() => {
    if (!confirmandoId) return;
    const espera = setTimeout(() => setConfirmandoId(null), 4000);
    return () => clearTimeout(espera);
  }, [confirmandoId]);

  async function apagar(listaId: string) {
    setApagandoId(listaId);
    try {
      await container.cancelarLista.executar(listaId);
      toast('Lista apagada.');
      await recarregar();
    } catch (e) {
      toast(mensagemParaUsuario(e));
    } finally {
      setApagandoId(null);
      setConfirmandoId(null);
    }
  }

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
                  {/* Só compra em andamento pode ser apagada: a finalizada é histórico (regra da API). */}
                  {lista.status !== 'Finalizada' && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        confirmandoId === lista.id
                          ? `Toque de novo para apagar a lista de ${lista.competenciaNome}`
                          : `Apagar a lista de ${lista.competenciaNome}`
                      }
                      disabled={apagandoId === lista.id}
                      onPress={() =>
                        confirmandoId === lista.id
                          ? void apagar(lista.id)
                          : setConfirmandoId(lista.id)
                      }
                      hitSlop={8}
                      style={[
                        estilos.lixeira,
                        confirmandoId === lista.id && { backgroundColor: p.alerta },
                      ]}
                    >
                      {confirmandoId === lista.id && (
                        <Text style={{ color: p.textoSobreDestaque, fontWeight: '700' }}>
                          Apagar?
                        </Text>
                      )}
                      <Icone
                        nome="lixeira"
                        tamanho={20}
                        cor={confirmandoId === lista.id ? p.textoSobreDestaque : p.alerta}
                      />
                    </Pressable>
                  )}
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
                {lista.comprados >= 1 && (
                  <Botao
                    icone="nota"
                    titulo="Importar nota fiscal"
                    variante="secundario"
                    aoPressionar={() => navegacao.navigate('ImportarNota', { listaId: lista.id })}
                  />
                )}
              </Cartao>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  lixeira: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.xs,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: espaco.sm,
    borderRadius: 18,
  },
  conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: 40 },
  entre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
});
