import React, { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type { ParadaDaRota, Ponto } from '../../domain/entities/mercados';
import { rotuloDaUnidade, type ItemDaLista } from '../../domain/entities/tipos';
import { mercadoEmUso } from '../../domain/services/compraDividida';
import { formatarQuantidade } from '../../domain/services/organizacao';
import { Botao, Cartao, TextoSuave } from '../components/base';
import { DivisaoDaCompra } from '../components/DivisaoDaCompra';
import { MapaSvg } from '../components/MapaSvg';
import { Cabecalho, Carregando, Chip, EstadoVazio, Pagina, Pilula } from '../components/ui';
import { useContainer, useMercadoAtual } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, raio, usePaleta } from '../theme';

function Estatistica({ rotulo, valor }: { rotulo: string; valor: string }) {
  const p = usePaleta();
  return (
    <View style={[estilos.estatistica, { backgroundColor: p.superficie2 }]}>
      <Text style={{ color: p.textoSuave, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>
        {rotulo.toUpperCase()}
      </Text>
      <Text
        style={{ color: p.texto, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] }}
      >
        {valor}
      </Text>
    </View>
  );
}

function LinhaDaRota({
  item,
  aoMarcar,
  aoNaoTemAqui,
}: {
  item: ItemDaLista;
  aoMarcar: () => void;
  aoNaoTemAqui?: () => void;
}) {
  const p = usePaleta();
  return (
    <View style={[estilos.linhaItem, { borderColor: p.linha, backgroundColor: p.superficie }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`${item.nome}, ${formatarQuantidade(item.quantidade)} ${rotuloDaUnidade(item.unidade)}`}
        accessibilityState={{ checked: item.comprado }}
        onPress={aoMarcar}
        style={estilos.areaDoCheck}
      >
        <View style={[estilos.caixa, { borderColor: p.textoSuave }]} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={2}
          style={{ color: p.texto, fontSize: fonte.corpo, fontWeight: '600' }}
        >
          {item.nome}
        </Text>
        <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
          {formatarQuantidade(item.quantidade)} {rotuloDaUnidade(item.unidade)}
        </Text>
      </View>
      {aoNaoTemAqui && (
        <Pressable
          accessibilityRole="button"
          onPress={aoNaoTemAqui}
          style={[estilos.botaoPequeno, { borderColor: p.linha, backgroundColor: p.superficie }]}
        >
          <Text style={{ color: p.textoSuave, fontSize: 12, fontWeight: '700' }}>Não tem aqui</Text>
        </Pressable>
      )}
    </View>
  );
}

const metros = (m: number) => `${m} m`;

/**
 * Rota dentro do mercado escolhido, só com o que ainda falta: o que já foi comprado em outro mercado
 * não entra. Sem GPS: sua posição é o lugar do último item marcado (ou a entrada).
 */
export function RotaScreen() {
  const p = usePaleta();
  const container = useContainer();
  const navegacao = useNavegacao();
  const toast = useToast();
  const { mercadoId, definirMercado } = useMercadoAtual();

  const {
    dados: lista,
    carregando: carregandoLista,
    recarregar: recarregarLista,
  } = useCarregar(() => container.obterListaAtual.executar(), 'atual');
  const { dados: mercados, carregando: carregandoMercados } = useCarregar(
    () => container.listarMercados.executar(),
    'mercados',
  );
  const atual = mercadoEmUso(mercados, mercadoId);

  const posicao = useRef<Ponto | null>(null);
  const listaId = lista?.resumo.id;
  const {
    dados: rota,
    erro: erroDaRota,
    recarregar: recarregarRota,
  } = useCarregar(
    async () =>
      listaId && atual ? container.planejarRota.executar(listaId, atual.id, posicao.current) : null,
    `rota:${listaId}:${atual?.id}`,
  );
  const { dados: mercado } = useCarregar(
    async () => (atual ? container.obterMercado.executar(atual.id) : null),
    `mercado:${atual?.id}`,
  );

  const escolher = (id: string) => {
    posicao.current = null;
    definirMercado(id);
  };

  async function marcar(item: ItemDaLista, parada: ParadaDaRota) {
    try {
      await container.marcarItemComprado.executar(listaId!, item.id, true, atual!.id);
      // Sem GPS: a posição passa a ser a parada onde o item foi marcado.
      posicao.current = parada.posicao;
      await Promise.all([recarregarRota(), recarregarLista()]);
    } catch (e) {
      toast(mensagemParaUsuario(e));
    }
  }

  async function semNoMercado(item: ItemDaLista, sem: boolean) {
    try {
      await container.marcarItemSemNoMercado.executar(listaId!, item.id, atual!.id, sem);
      if (sem) toast('Fica pendente para o próximo mercado');
      await Promise.all([recarregarRota(), recarregarLista()]);
    } catch (e) {
      toast(mensagemParaUsuario(e));
    }
  }

  if ((carregandoMercados && !mercados) || (carregandoLista && !lista)) {
    return (
      <Pagina>
        <Carregando />
      </Pagina>
    );
  }

  const voltar = () => navegacao.goBack();
  if (!atual) {
    return (
      <Pagina>
        <Cabecalho titulo="Rota da compra" aoVoltar={voltar} />
        <EstadoVazio
          titulo="Cadastre seu primeiro mercado"
          texto="Desenhe o layout do mercado e a rota mostra a ordem das prateleiras só com o que falta comprar."
          acao={{ rotulo: 'Cadastrar mercado', aoPressionar: () => navegacao.navigate('Mercados') }}
        />
      </Pagina>
    );
  }
  if (lista === null) {
    return (
      <Pagina>
        <Cabecalho titulo="Rota da compra" aoVoltar={voltar} />
        <EstadoVazio
          titulo="Nenhuma lista em andamento"
          texto="Crie a lista do mês para ver a rota."
          acao={{ rotulo: 'Criar lista', aoPressionar: () => navegacao.navigate('NovaLista') }}
        />
      </Pagina>
    );
  }

  const rotaAtual = rota && rota.lojaId === atual.id ? rota : null;
  const mapa = mercado && mercado.id === atual.id ? mercado : null;
  const naEntrada =
    !!mapa &&
    !!rotaAtual &&
    rotaAtual.posicao.x === mapa.entrada.x &&
    rotaAtual.posicao.y === mapa.entrada.y;
  const faltam = (lista?.itens ?? []).filter((i) => !i.comprado).length;

  const cabecalho = (
    <>
      <Cabecalho titulo={atual.nome} aoVoltar={voltar} />
      <View style={estilos.chipsLinha}>
        {(mercados ?? []).map((m) => (
          <Chip
            key={m.id}
            rotulo={m.nome}
            ativo={m.id === atual.id}
            aoPressionar={() => escolher(m.id)}
          />
        ))}
        <Chip rotulo="Mercados" ativo={false} aoPressionar={() => navegacao.navigate('Mercados')} />
      </View>
    </>
  );

  return (
    <Pagina>
      {cabecalho}
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Cartao estilo={{ gap: espaco.sm }}>
          <Text
            style={{ color: p.textoSuave, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}
          >
            DIVISÃO DA COMPRA
          </Text>
          <DivisaoDaCompra itens={lista?.itens ?? []} mercados={mercados ?? []} />
          {!!rotaAtual && rotaAtual.jaCompradosEmOutrosMercados > 0 && (
            <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
              {rotaAtual.jaCompradosEmOutrosMercados === 1
                ? '1 item já comprado em outro mercado não entra'
                : `${rotaAtual.jaCompradosEmOutrosMercados} itens já comprados em outros mercados não entram`}{' '}
              nesta rota.
            </Text>
          )}
        </Cartao>

        {!rotaAtual || !mapa ? (
          erroDaRota ? (
            <EstadoVazio
              titulo="Não foi possível montar a rota"
              texto={erroDaRota}
              acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void recarregarRota() }}
            />
          ) : (
            <Carregando />
          )
        ) : (
          <>
            <Cartao estilo={{ padding: espaco.md, gap: espaco.sm }}>
              <MapaSvg mapa={mapa} modo="rota" rota={rotaAtual} />
              <View style={estilos.entre}>
                <Text style={{ color: p.textoSuave, fontSize: fonte.pequena, flex: 1 }}>
                  {naEntrada ? 'Você está na entrada' : 'Você está onde marcou o último item'}
                </Text>
                {!naEntrada && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      posicao.current = null;
                      void recarregarRota();
                    }}
                    style={[
                      estilos.botaoPequeno,
                      { borderColor: p.linha, backgroundColor: p.superficie },
                    ]}
                  >
                    <Text style={{ color: p.textoSuave, fontSize: 12, fontWeight: '700' }}>
                      Voltar à entrada
                    </Text>
                  </Pressable>
                )}
              </View>
            </Cartao>

            {rotaAtual.paradas.length === 0 ? (
              <Cartao estilo={{ gap: espaco.md, alignItems: 'center' }}>
                <Text
                  style={{
                    color: p.texto,
                    fontSize: fonte.titulo,
                    fontWeight: '700',
                    textAlign: 'center',
                  }}
                >
                  {faltam === 0 ? 'Tudo no carrinho' : 'Este mercado não tem o que falta'}
                </Text>
                <TextoSuave estilo={{ textAlign: 'center' }}>
                  {faltam === 0
                    ? 'Siga para os caixas e finalize a compra.'
                    : `Faltam ${faltam} ${faltam === 1 ? 'item' : 'itens'}. Escolha outro mercado acima para ver a rota só do que falta.`}
                </TextoSuave>
                <Botao
                  titulo="Voltar à lista"
                  aoPressionar={voltar}
                  estilo={{ alignSelf: 'stretch' }}
                />
              </Cartao>
            ) : (
              <>
                <View style={estilos.estatisticas}>
                  <Estatistica rotulo="Paradas" valor={String(rotaAtual.paradas.length)} />
                  <Estatistica rotulo="Caminhada" valor={metros(rotaAtual.distanciaEmMetros)} />
                  <Estatistica rotulo="Tempo" valor={`~${rotaAtual.tempoEstimadoEmMinutos} min`} />
                </View>
                {rotaAtual.economiaEmMetros > 0 && (
                  <Pilula
                    texto={`${rotaAtual.economiaEmMetros} m a menos que seguir a ordem da lista`}
                  />
                )}

                <Cartao estilo={{ gap: espaco.sm }}>
                  <View style={estilos.entre}>
                    <Pilula texto="Próxima parada" />
                    <Text
                      style={{
                        color: p.textoSuave,
                        fontSize: fonte.pequena,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      a {metros(rotaAtual.paradas[0].distanciaEmMetros)}
                    </Text>
                  </View>
                  <Text
                    style={{ color: p.texto, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }}
                  >
                    {rotaAtual.paradas[0].nome}
                  </Text>
                  {rotaAtual.paradas[0].ladoTexto && (
                    <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                      Gôndola de dois lados · {rotaAtual.paradas[0].ladoTexto}
                    </Text>
                  )}
                  {rotaAtual.paradas[0].itens.map((item) => (
                    <LinhaDaRota
                      key={item.id}
                      item={item}
                      aoMarcar={() => void marcar(item, rotaAtual.paradas[0])}
                      aoNaoTemAqui={() => void semNoMercado(item, true)}
                    />
                  ))}
                </Cartao>

                {rotaAtual.paradas.length > 1 && (
                  <Cartao estilo={{ paddingVertical: espaco.xs }}>
                    {rotaAtual.paradas.slice(1).map((parada, i) => (
                      <View
                        key={`${parada.secaoId}-${parada.lado ?? ''}`}
                        style={[
                          estilos.parada,
                          i > 0 && { borderTopWidth: 1, borderTopColor: p.linha },
                        ]}
                      >
                        <View style={[estilos.numero, { backgroundColor: p.destaqueSuave }]}>
                          <Text style={{ color: p.destaque, fontWeight: '800' }}>{i + 2}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: p.texto, fontWeight: '700' }}>
                            {parada.nome}
                            {parada.ladoTexto ? (
                              <Text
                                style={{
                                  color: p.textoSuave,
                                  fontWeight: '400',
                                  fontSize: fonte.pequena,
                                }}
                              >
                                {' '}
                                · {parada.ladoTexto}
                              </Text>
                            ) : null}
                          </Text>
                          <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                            {parada.itens.map((x) => x.nome).join(', ')}
                          </Text>
                        </View>
                        <Pilula texto={String(parada.itens.length)} tom="neutro" />
                      </View>
                    ))}
                  </Cartao>
                )}
              </>
            )}

            {rotaAtual.foraDaRota.length > 0 && (
              <Cartao estilo={{ gap: espaco.sm }}>
                <Pilula texto={`Fora desta rota · ${rotaAtual.foraDaRota.length}`} tom="alerta" />
                {rotaAtual.foraDaRota.map(({ item, motivo }) => (
                  <View key={item.id} style={estilos.parada}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: p.texto, fontWeight: '700' }}>{item.nome}</Text>
                      <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                        {motivo === 'SemSecao'
                          ? `Este mercado não tem seção para ${item.categoriaNome}`
                          : 'Você marcou que não tem aqui'}
                      </Text>
                    </View>
                    {motivo === 'NaoTemNaLoja' && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void semNoMercado(item, false)}
                        style={[
                          estilos.botaoPequeno,
                          { borderColor: p.linha, backgroundColor: p.superficie },
                        ]}
                      >
                        <Text style={{ color: p.textoSuave, fontSize: 12, fontWeight: '700' }}>
                          Desfazer
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))}
                <TextoSuave estilo={{ fontSize: fonte.pequena }}>
                  Continuam pendentes e entram na rota do próximo mercado.
                </TextoSuave>
              </Cartao>
            )}
          </>
        )}

        <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
          Sua posição é estimada pelo último item marcado. O app não usa GPS dentro do mercado.
        </Text>
        <Botao
          titulo="Editar mapa deste mercado"
          variante="secundario"
          aoPressionar={() => navegacao.navigate('MapaDoMercado', { mercadoId: atual.id })}
        />
      </ScrollView>
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, paddingBottom: 48, gap: espaco.md },
  chipsLinha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espaco.sm,
    paddingHorizontal: espaco.lg,
  },
  entre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  estatisticas: { flexDirection: 'row', gap: espaco.sm },
  estatistica: { flex: 1, borderRadius: raio.sm, padding: espaco.md, gap: 2 },
  linhaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    borderWidth: 1,
    borderRadius: raio.md,
    paddingRight: espaco.sm,
    minHeight: 56,
  },
  areaDoCheck: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  caixa: { width: 26, height: 26, borderRadius: 9, borderWidth: 2 },
  botaoPequeno: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: raio.pilula,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    paddingVertical: espaco.md,
  },
  numero: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
