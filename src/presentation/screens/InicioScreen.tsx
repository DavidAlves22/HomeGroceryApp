import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import { calcularTotais } from '../../domain/services/financeiro';
import { Competencia } from '../../domain/valueObjects/Competencia';
import { Botao, Cartao, TextoSuave } from '../components/base';
import { ResumoFinanceiro } from '../components/ResumoFinanceiro';
import { BarraDeProgresso, Carregando, EstadoVazio, Pagina, Pilula } from '../components/ui';
import { useContainer, useSessao } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

/** Resumo do mês atual com atalhos para o que se faz mais: continuar a compra, nova lista, lista padrão. */
export function InicioScreen() {
  const p = usePaleta();
  const container = useContainer();
  const { sessao } = useSessao();
  const navegacao = useNavegacao();
  const {
    dados: lista,
    carregando,
    erro,
    recarregar,
  } = useCarregar(() => container.obterListaAtual.executar(), 'atual');
  const toast = useToast();
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const mesAtual = Competencia.daData(new Date());

  async function cancelarCompra(listaId: string) {
    setCancelando(true);
    try {
      await container.cancelarLista.executar(listaId);
      toast('Compra cancelada. A lista foi apagada.');
      await recarregar();
    } catch (e) {
      toast(mensagemParaUsuario(e));
    } finally {
      setCancelando(false);
      setConfirmandoCancelar(false);
    }
  }

  if (carregando && !lista)
    return (
      <Pagina>
        <Carregando />
      </Pagina>
    );

  const primeiroNome = sessao?.usuario.nome.split(' ')[0] ?? '';
  const resumo = lista?.resumo;
  const comprados = lista?.itens.filter((i) => i.comprado).length ?? 0;
  const total = lista?.itens.length ?? 0;
  const totais = lista ? calcularTotais(lista.itens) : null;

  return (
    <Pagina>
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
        <View>
          <Text
            style={{
              color: p.textoSuave,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Olá, {primeiroNome}
          </Text>
          <Text style={{ color: p.texto, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>
            {mesAtual.nome}
          </Text>
        </View>

        {erro && !lista ? (
          <EstadoVazio
            titulo="Não foi possível carregar"
            texto={erro}
            acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void recarregar() }}
          />
        ) : resumo ? (
          <Cartao estilo={{ gap: espaco.sm }}>
            <View style={estilos.entre}>
              <Pilula
                texto={resumo.status === 'Finalizada' ? 'Finalizada' : 'Em andamento'}
                tom={resumo.status === 'Finalizada' ? 'neutro' : 'destaque'}
              />
              <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                {resumo.competenciaNome}
              </Text>
            </View>
            <Text
              style={{
                color: p.texto,
                fontSize: 44,
                fontWeight: '800',
                letterSpacing: -1,
                fontVariant: ['tabular-nums'],
              }}
            >
              {total === 0 ? 0 : Math.round((100 * comprados) / total)}%
            </Text>
            <BarraDeProgresso
              percentual={total === 0 ? 0 : Math.round((100 * comprados) / total)}
            />
            <View style={estilos.estatisticas}>
              <View style={[estilos.estatistica, { backgroundColor: p.fundo }]}>
                <Text style={estilos.rotulo}>Comprados</Text>
                <Text style={[estilos.valor, { color: p.texto }]}>{comprados}</Text>
              </View>
              <View style={[estilos.estatistica, { backgroundColor: p.fundo }]}>
                <Text style={estilos.rotulo}>Pendentes</Text>
                <Text style={[estilos.valor, { color: p.texto }]}>{total - comprados}</Text>
              </View>
            </View>
            {totais && (
              <ResumoFinanceiro
                estimado={totais.estimado}
                realizado={totais.realizado}
                compradosSemPreco={totais.compradosSemPreco}
              />
            )}
            <Botao
              titulo={resumo.status === 'Finalizada' ? 'Ver lista' : 'Continuar compra'}
              aoPressionar={() => navegacao.navigate('Lista')}
            />
            {resumo.status !== 'Finalizada' && (
              <Botao
                titulo={
                  confirmandoCancelar ? 'Toque de novo para apagar esta lista' : 'Cancelar compra'
                }
                variante={confirmandoCancelar ? 'principal' : 'texto'}
                carregando={cancelando}
                aoPressionar={() =>
                  confirmandoCancelar
                    ? void cancelarCompra(resumo.id)
                    : setConfirmandoCancelar(true)
                }
              />
            )}
          </Cartao>
        ) : (
          <Cartao estilo={{ gap: espaco.md }}>
            <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '700' }}>
              Sem lista para {mesAtual.nome}
            </Text>
            <TextoSuave>
              Crie a lista do mês a partir da sua lista padrão ou comece uma do zero.
            </TextoSuave>
            <Botao
              titulo="Criar lista do mês"
              aoPressionar={() => navegacao.navigate('NovaLista')}
            />
          </Cartao>
        )}

        <View style={estilos.atalhos}>
          <Botao
            titulo="Nova lista"
            variante="secundario"
            estilo={{ flex: 1 }}
            aoPressionar={() => navegacao.navigate('NovaLista')}
          />
          <Botao
            titulo="Lista padrão"
            variante="secundario"
            estilo={{ flex: 1 }}
            aoPressionar={() => navegacao.navigate('ListaPadrao')}
          />
        </View>
        <Botao
          titulo="Ver histórico de compras"
          variante="texto"
          aoPressionar={() => navegacao.navigate('Historico')}
        />
      </ScrollView>
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, gap: espaco.lg, paddingBottom: 40 },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  estatisticas: { flexDirection: 'row', gap: espaco.sm, marginVertical: espaco.sm },
  estatistica: { flex: 1, borderRadius: 14, padding: espaco.md },
  rotulo: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  valor: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  atalhos: { flexDirection: 'row', gap: espaco.sm },
});
