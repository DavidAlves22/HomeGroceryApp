import { useRoute, type RouteProp } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type { MapaEmEdicao, Secao } from '../../domain/entities/mercados';
import {
  acharAlvo,
  adicionarSecao,
  alternarCategoria,
  areaDoAlvo,
  categoriasSemLocal,
  descreverTamanho,
  dividirSecao,
  girarSecao,
  juntarSecao,
  mapaDoMercado,
  moverAlvo,
  novoIdLocal,
  redimensionarSecao,
  removerSecao,
  renomearSecao,
  textoDoLado,
  type AlvoDoMapa,
  type Toque,
} from '../../domain/services/mapa';
import { Botao, Campo, Cartao, TextoSuave } from '../components/base';
import { MapaSvg } from '../components/MapaSvg';
import { Cabecalho, Carregando, Chip, EstadoVazio, Pagina, Pilula } from '../components/ui';
import { useContainer, useMercadoAtual } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao, type RootStackParamList } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

/** Tamanho de um dedo, em pixels: a bolinha de redimensionar e a entrada têm área de toque maior que o desenho. */
const TOLERANCIA_DO_DEDO_PX = 14;

/** No navegador, o dedo sobre o mapa arrasta a seção em vez de rolar a página. */
const SEM_ROLAGEM = (Platform.OS === 'web' ? { touchAction: 'none' } : {}) as ViewStyle;

interface Arrasto {
  toque: Toque;
  base: MapaEmEdicao;
  inicio: { x: number; y: number; largura: number; altura: number };
}

/** Editor gráfico do mapa: arrasta seções, entrada e caixas; a bolinha do canto muda o tamanho. */
export function MapaDoMercadoScreen() {
  const p = usePaleta();
  const container = useContainer();
  const navegacao = useNavegacao();
  const toast = useToast();
  const { definirMercado } = useMercadoAtual();
  const { params } = useRoute<RouteProp<RootStackParamList, 'MapaDoMercado'>>();
  const {
    dados: mercado,
    definirDados,
    erro,
    carregando,
    recarregar,
  } = useCarregar(
    () => container.obterMercado.executar(params.mercadoId),
    `mercado:${params.mercadoId}`,
  );
  const { dados: categorias } = useCarregar(
    () => container.listarCategorias.executar(),
    'categorias',
  );

  const [mapa, setMapa] = useState<MapaEmEdicao | null>(null);
  const [original, setOriginal] = useState('');
  const [versaoBase, setVersaoBase] = useState(0);
  const [selecionado, setSelecionado] = useState<AlvoDoMapa | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const sujo = !!mapa && JSON.stringify(mapa) !== original;
  const desatualizado = !!mercado && !!mapa && sujo && mercado.versao !== versaoBase;

  // Carrega o mapa no editor. Se outra pessoa salvar enquanto há edição minha, não sobrescreve: avisa.
  useEffect(() => {
    if (!mercado || mercado.id !== params.mercadoId) return;
    if (mapa !== null && (sujo || mercado.versao === versaoBase)) return;
    const carregado = mapaDoMercado(mercado);
    setMapa(carregado);
    setOriginal(JSON.stringify(carregado));
    setVersaoBase(mercado.versao);
    setSelecionado(
      (atual) =>
        atual ?? (carregado.secoes[0] ? { tipo: 'secao', id: carregado.secoes[0].id } : null),
    );
  }, [mercado, mapa, sujo, versaoBase, params.mercadoId]);

  // Os toques chegam por referências: o PanResponder é criado uma vez e sempre lê o estado atual.
  const mapaRef = useRef<MapaEmEdicao | null>(null);
  const selecionadoRef = useRef<AlvoDoMapa | null>(null);
  const larguraPx = useRef(0);
  const arrasto = useRef<Arrasto | null>(null);
  const candidato = useRef<Toque | null>(null);
  mapaRef.current = mapa;
  selecionadoRef.current = selecionado;

  const gestos = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => {
          const m = mapaRef.current;
          if (!m || larguraPx.current === 0) return false;
          const px = larguraPx.current / m.largura;
          candidato.current = acharAlvo(
            m,
            e.nativeEvent.locationX / px,
            e.nativeEvent.locationY / px,
            TOLERANCIA_DO_DEDO_PX / px,
            selecionadoRef.current,
          );
          return candidato.current !== null;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const m = mapaRef.current;
          const toque = candidato.current;
          const area = m && toque ? areaDoAlvo(m, toque.alvo) : undefined;
          if (!m || !toque || !area) return;
          arrasto.current = { toque, base: m, inicio: { ...area } };
          setSelecionado(toque.alvo);
          setConfirmandoExclusao(false);
        },
        onPanResponderMove: (_e, g) => {
          const a = arrasto.current;
          if (!a || larguraPx.current === 0) return;
          const px = larguraPx.current / a.base.largura;
          const dx = Math.round(g.dx / px);
          const dy = Math.round(g.dy / px);
          const { toque, base, inicio } = a;
          let novo: MapaEmEdicao | null;
          if (dx === 0 && dy === 0) novo = base;
          else if (toque.alca && toque.alvo.tipo === 'secao') {
            novo = redimensionarSecao(base, toque.alvo.id, inicio.largura + dx, inicio.altura + dy);
          } else novo = moverAlvo(base, toque.alvo, inicio.x + dx, inicio.y + dy);
          // Destino ocupado: a seção fica na última posição válida, sem pular.
          if (novo) setMapa(novo);
        },
        onPanResponderRelease: () => {
          arrasto.current = null;
        },
        onPanResponderTerminate: () => {
          arrasto.current = null;
        },
      }),
    [],
  );

  if (carregando && !mercado) {
    return (
      <Pagina>
        <Carregando />
      </Pagina>
    );
  }
  if ((erro && !mercado) || !mapa) {
    return (
      <Pagina>
        <Cabecalho titulo="Mapa do mercado" aoVoltar={() => navegacao.goBack()} />
        <EstadoVazio
          titulo="Não foi possível abrir o mapa"
          texto={erro ?? 'Este mercado não está mais disponível.'}
          acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void recarregar() }}
        />
      </Pagina>
    );
  }

  const secao: Secao | undefined =
    selecionado?.tipo === 'secao' ? mapa.secoes.find((s) => s.id === selecionado.id) : undefined;
  const semLocal = categoriasSemLocal(mapa, categorias ?? []);
  const nomeDaCategoria = (id: string) => categorias?.find((c) => c.id === id)?.nome ?? id;

  const aplicar = (novo: MapaEmEdicao | null, aviso?: string) => {
    if (novo) setMapa(novo);
    else if (aviso) toast(aviso);
  };

  function adicionar() {
    const id = novoIdLocal();
    const novo = adicionarSecao(mapa!, id);
    aplicar(novo, 'Sem espaço livre no mapa');
    if (novo) {
      setSelecionado({ tipo: 'secao', id });
      toast('Seção adicionada. Arraste para o lugar certo.');
    }
  }

  function excluirSecao() {
    if (!secao) return;
    if (!confirmandoExclusao) {
      setConfirmandoExclusao(true);
      return;
    }
    setMapa(removerSecao(mapa!, secao.id));
    setSelecionado(null);
    setConfirmandoExclusao(false);
    toast('Seção removida. As categorias dela ficam sem local.');
  }

  async function salvar() {
    setSalvando(true);
    try {
      const salvo = await container.salvarMapaDoMercado.executar(
        params.mercadoId,
        mapa!,
        versaoBase,
      );
      // As ids das seções mudam ao salvar: acha a seção selecionada de novo pela posição (não há sobreposição).
      const area = secao?.area;
      const novoMapa = mapaDoMercado(salvo);
      const igual =
        area && novoMapa.secoes.find((s) => JSON.stringify(s.area) === JSON.stringify(area));
      setMapa(novoMapa);
      setOriginal(JSON.stringify(novoMapa));
      setVersaoBase(salvo.versao);
      // O aviso em tempo real do meu próprio salvamento é ignorado: atualizo o mercado carregado à mão.
      definirDados(salvo);
      setSelecionado(
        igual
          ? { tipo: 'secao', id: igual.id }
          : selecionado?.tipo === 'secao'
            ? null
            : selecionado,
      );
      setConfirmandoSaida(false);
      toast('Mapa salvo');
    } catch (e) {
      toast(mensagemParaUsuario(e));
    } finally {
      setSalvando(false);
    }
  }

  function voltar() {
    if (sujo && !confirmandoSaida) {
      setConfirmandoSaida(true);
      return;
    }
    navegacao.goBack();
  }

  const chipsDeCategorias = (lado: 'A' | 'B', ligadas: string[]) => (
    <View style={estilos.chips}>
      {(categorias ?? []).map((c) => (
        <Chip
          key={c.id}
          rotulo={c.nome}
          ativo={ligadas.includes(c.id)}
          aoPressionar={() => setMapa(alternarCategoria(mapa!, secao!.id, lado, c.id))}
        />
      ))}
    </View>
  );

  return (
    <Pagina>
      <Cabecalho titulo={mapa.nome || 'Mapa do mercado'} aoVoltar={voltar} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        {confirmandoSaida && (
          <Cartao
            estilo={{ backgroundColor: p.alertaSuave, borderColor: p.alertaSuave, gap: espaco.sm }}
          >
            <Text style={{ color: p.alerta, fontWeight: '700' }}>
              Há alterações que não foram salvas.
            </Text>
            <View style={estilos.acoes}>
              <Botao
                titulo="Salvar"
                carregando={salvando}
                aoPressionar={() => void salvar()}
                estilo={{ flex: 1 }}
              />
              <Botao
                titulo="Descartar e sair"
                variante="secundario"
                aoPressionar={() => navegacao.goBack()}
                estilo={{ flex: 1 }}
              />
            </View>
          </Cartao>
        )}
        {desatualizado && (
          <Cartao
            estilo={{
              backgroundColor: p.destaqueSuave,
              borderColor: p.destaqueSuave,
              gap: espaco.sm,
            }}
          >
            <Text style={{ color: p.destaque, fontWeight: '700' }}>
              Outra pessoa alterou o mapa deste mercado.
            </Text>
            <TextoSuave>
              Se você salvar agora, o app vai pedir para atualizar. Recarregar descarta o que você
              mudou.
            </TextoSuave>
            <Botao
              titulo="Recarregar o mapa"
              variante="secundario"
              aoPressionar={() => {
                setMapa(null);
                void recarregar();
              }}
            />
          </Cartao>
        )}

        <Campo
          rotulo="Nome do mercado"
          value={mapa.nome}
          onChangeText={(nome) => setMapa({ ...mapa, nome })}
          maxLength={120}
        />
        <TextoSuave>
          Arraste uma seção para mover. A bolinha do canto muda o tamanho. A entrada e os caixas
          também se arrastam. Cada quadradinho vale cerca de 1,5 m.
        </TextoSuave>

        <Cartao estilo={{ padding: espaco.md }}>
          <View style={SEM_ROLAGEM} {...gestos.panHandlers}>
            <MapaSvg
              mapa={mapa}
              modo="editar"
              selecionado={selecionado}
              aoMedir={(largura) => {
                larguraPx.current = largura;
              }}
            />
          </View>
        </Cartao>

        <View style={estilos.acoes}>
          <Botao
            titulo="Adicionar seção"
            aoPressionar={adicionar}
            estilo={{ flex: 1, minHeight: 44 }}
          />
          <Botao
            titulo="Girar"
            variante="secundario"
            desabilitado={!secao}
            aoPressionar={() =>
              secao && aplicar(girarSecao(mapa, secao.id), 'Sem espaço para girar aqui')
            }
            estilo={{ minHeight: 44, paddingHorizontal: espaco.lg }}
          />
        </View>
        <View style={estilos.acoes}>
          <Botao
            titulo={secao?.dividida ? 'Juntar lados' : 'Dividir em dois lados'}
            variante="secundario"
            desabilitado={!secao}
            aoPressionar={() => {
              if (!secao) return;
              aplicar(
                secao.dividida ? juntarSecao(mapa, secao.id) : dividirSecao(mapa, secao.id),
                'Sem espaço para a gôndola de dois lados',
              );
            }}
            estilo={{ flex: 1, minHeight: 44 }}
          />
          <Botao
            titulo={confirmandoExclusao ? 'Confirmar' : 'Excluir seção'}
            variante={confirmandoExclusao ? 'principal' : 'secundario'}
            desabilitado={!secao}
            aoPressionar={excluirSecao}
            estilo={{ flex: 1, minHeight: 44 }}
          />
        </View>

        {secao ? (
          <Cartao estilo={{ gap: espaco.md }}>
            <View style={estilos.entre}>
              <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '700' }}>
                {secao.dividida ? 'Gôndola de dois lados' : 'Seção'}
              </Text>
              <Pilula texto={`${secao.area.largura} × ${secao.area.altura}`} tom="neutro" />
            </View>
            <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
              {descreverTamanho(secao.area)}
            </Text>
            <Campo
              rotulo={
                secao.dividida
                  ? `Lado ${textoDoLado(secao, 'A')?.replace('lado ', '')}`
                  : 'Nome da seção'
              }
              value={secao.nome}
              onChangeText={(t) => setMapa(renomearSecao(mapa, secao.id, 'A', t))}
              maxLength={40}
            />
            {chipsDeCategorias('A', secao.categoriasLadoA)}
            {secao.dividida && (
              <>
                <Campo
                  rotulo={`Lado ${textoDoLado(secao, 'B')?.replace('lado ', '')}`}
                  value={secao.nomeLadoB ?? ''}
                  onChangeText={(t) => setMapa(renomearSecao(mapa, secao.id, 'B', t))}
                  maxLength={40}
                />
                {chipsDeCategorias('B', secao.categoriasLadoB)}
              </>
            )}
            <TextoSuave estilo={{ fontSize: fonte.pequena }}>
              Uma categoria pode estar em vários lugares do mercado, como Mercearia em várias
              gôndolas. A rota vai ao mais próximo.
              {secao.dividida
                ? ' Em gôndola de dois lados, a rota para no corredor do lado do item.'
                : ''}
            </TextoSuave>
          </Cartao>
        ) : selecionado?.tipo === 'entrada' ? (
          <Cartao>
            <Text style={{ color: p.texto, fontWeight: '700' }}>Entrada</Text>
            <TextoSuave>
              É de onde a rota sai quando você chega ao mercado. Arraste para a porta real.
            </TextoSuave>
          </Cartao>
        ) : selecionado?.tipo === 'caixas' ? (
          <Cartao>
            <Text style={{ color: p.texto, fontWeight: '700' }}>Caixas</Text>
            <TextoSuave>A rota termina aqui. Arraste para onde ficam os caixas.</TextoSuave>
          </Cartao>
        ) : (
          <Cartao>
            <Text style={{ color: p.texto, fontWeight: '700' }}>Nada selecionado</Text>
            <TextoSuave>Toque numa seção do mapa ou em Adicionar seção.</TextoSuave>
          </Cartao>
        )}

        {semLocal.length > 0 ? (
          <Cartao estilo={{ gap: espaco.sm }}>
            <Pilula texto={`Sem local neste mercado: ${semLocal.length}`} tom="alerta" />
            <TextoSuave>{semLocal.map((c) => c.nome).join(', ')}</TextoSuave>
          </Cartao>
        ) : (
          <Pilula texto="Todas as categorias têm local" />
        )}
        {secao && (secao.categoriasLadoA.length > 0 || secao.categoriasLadoB.length > 0) && (
          <TextoSuave estilo={{ fontSize: fonte.pequena }}>
            Nesta seção:{' '}
            {[...secao.categoriasLadoA, ...secao.categoriasLadoB].map(nomeDaCategoria).join(', ')}.
          </TextoSuave>
        )}

        <Botao
          titulo={sujo ? 'Salvar mapa' : 'Mapa salvo'}
          desabilitado={!sujo}
          carregando={salvando}
          aoPressionar={() => void salvar()}
        />
        <Botao
          titulo="Comprar neste mercado"
          variante="secundario"
          aoPressionar={() => {
            definirMercado(params.mercadoId);
            navegacao.navigate('Rota');
          }}
        />
      </ScrollView>
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, paddingBottom: 48, gap: espaco.md },
  acoes: { flexDirection: 'row', gap: espaco.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
