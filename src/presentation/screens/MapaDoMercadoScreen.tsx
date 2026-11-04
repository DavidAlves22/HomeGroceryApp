import { useRoute, type RouteProp } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
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
  duplicarSecao,
  girarSecao,
  juntarSecao,
  ladosSemCategoria,
  MINIMO_DE_SECOES_PARA_O_CATALOGO,
  mapaDoMercado,
  moverAlvo,
  novoIdLocal,
  redimensionarMapa,
  redimensionarSecao,
  removerSecao,
  secoesComNomeProprio,
  renomearSecao,
  TAMANHO_MAXIMO_DO_MAPA,
  TAMANHO_MINIMO_DO_MAPA,
  textoDoLado,
  type AlvoDoMapa,
  type Toque,
} from '../../domain/services/mapa';
import {
  celulaNoPonto,
  deslocarJanela,
  JANELA_INICIAL,
  zoomEmTorno,
  type Janela,
} from '../../domain/services/zoomDoMapa';
import { Botao, Campo, Cartao, TextoSuave } from '../components/base';
import { Icone } from '../components/Icone';
import { MapaSvg } from '../components/MapaSvg';
import { SeletorDeCategorias } from '../components/SeletorDeCategorias';
import {
  Cabecalho,
  Carregando,
  Chip,
  EstadoVazio,
  GatilhoDeSeletor,
  Pagina,
  Pilula,
} from '../components/ui';
import { useContainer, useMercadoAtual } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useLayoutLargo } from '../hooks/useLayoutLargo';
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
  const largo = useLayoutLargo();
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
  // Colunas e linhas são digitadas como texto (não dá para validar a cada tecla) e só valem ao tocar em "Aplicar".
  const [colunas, setColunas] = useState('');
  const [linhas, setLinhas] = useState('');
  // Lado da seção cuja lista de categorias está aberta em tela cheia.
  const [escolhendoCategorias, setEscolhendoCategorias] = useState<'A' | 'B' | null>(null);

  // Mostra o tamanho atual da grade nos campos sempre que o mapa muda de tamanho (inclusive ao carregar).
  const larguraDoMapa = mapa?.largura;
  const alturaDoMapa = mapa?.altura;
  useEffect(() => {
    if (larguraDoMapa === undefined || alturaDoMapa === undefined) return;
    setColunas(String(larguraDoMapa));
    setLinhas(String(alturaDoMapa));
  }, [larguraDoMapa, alturaDoMapa]);
  // Zoom: o pedaço do mapa que aparece. Dois dedos aproximam e movem; um dedo no vazio também move quando há zoom.
  const [janela, setJanela] = useState<Janela>(JANELA_INICIAL);
  // Cadeado: travado (padrão) só deixa dar zoom e andar pelo mapa; destravado habilita toda a edição.
  const [travado, setTravado] = useState(true);
  const travadoRef = useRef(true);
  travadoRef.current = travado;

  const sujo = !!mapa && JSON.stringify(mapa) !== original;
  // O voltar do celular/navegador também passa por aqui: com alterações não salvas, pede confirmação como a seta.
  useEffect(
    () =>
      navegacao.addListener('beforeRemove', (e) => {
        if (!sujo || confirmandoSaida) return;
        e.preventDefault();
        setConfirmandoSaida(true);
      }),
    [navegacao, sujo, confirmandoSaida],
  );
  const desatualizado = !!mercado && !!mapa && sujo && mercado.versao !== versaoBase;

  // Carrega o mapa no editor. Se outra pessoa salvar enquanto há edição minha, não sobrescreve: avisa.
  useEffect(() => {
    if (!mercado || mercado.id !== params.mercadoId) return;
    if (mapa !== null && (sujo || mercado.versao === versaoBase)) return;
    const carregado = mapaDoMercado(mercado);
    // Mercado novo (sem seções) ou antigo (sem cidade) já abre destravado: falta montar o mapa ou preencher a cidade.
    if (mapa === null && (carregado.secoes.length === 0 || !carregado.cidade.trim())) {
      setTravado(false);
    }
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
  const janelaRef = useRef<Janela>(JANELA_INICIAL);
  // O que o gesto em curso está fazendo: arrastar uma seção, mover a visão com um dedo ou o pinça de dois dedos.
  const modo = useRef<'nenhum' | 'arrastar' | 'mover' | 'pinca'>('nenhum');
  const pinca = useRef<{ d0: number; escala0: number; focal: { x: number; y: number } } | null>(
    null,
  );
  const visaoAoComecar = useRef<Janela>(JANELA_INICIAL);
  mapaRef.current = mapa;
  selecionadoRef.current = selecionado;
  janelaRef.current = janela;

  const gestos = useMemo(() => {
    const medidas = (e: GestureResponderEvent) => {
      const [a, b] = e.nativeEvent.touches;
      return {
        d: Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY),
        meio: { x: (a.locationX + b.locationX) / 2, y: (a.locationY + b.locationY) / 2 },
      };
    };

    // Segundo dedo na tela: vira pinça. Se um dedo já arrastava uma seção, o arrasto é desfeito (volta ao início).
    const comecarPinca = (e: GestureResponderEvent) => {
      const m = mapaRef.current;
      if (!m || larguraPx.current === 0) return;
      if (arrasto.current) {
        setMapa(arrasto.current.base);
        arrasto.current = null;
      }
      const { d, meio } = medidas(e);
      pinca.current = {
        d0: Math.max(d, 1),
        escala0: janelaRef.current.escala,
        focal: celulaNoPonto(janelaRef.current, larguraPx.current / m.largura, meio.x, meio.y),
      };
      modo.current = 'pinca';
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: (e) => {
        const m = mapaRef.current;
        if (!m || larguraPx.current === 0) return false;
        if (e.nativeEvent.touches.length >= 2) return true;
        const pxBase = larguraPx.current / m.largura;
        const celula = celulaNoPonto(
          janelaRef.current,
          pxBase,
          e.nativeEvent.locationX,
          e.nativeEvent.locationY,
        );
        // Travado: nenhum toque pega seção, entrada ou caixas; só a visão (zoom e deslocamento) responde.
        candidato.current = travadoRef.current
          ? null
          : acharAlvo(
              m,
              celula.x,
              celula.y,
              TOLERANCIA_DO_DEDO_PX / (pxBase * janelaRef.current.escala),
              selecionadoRef.current,
            );
        // Sem zoom, o vazio do mapa não faz nada; com zoom, um dedo no vazio move a visão.
        return candidato.current !== null || janelaRef.current.escala > 1;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        if (e.nativeEvent.touches.length >= 2) {
          comecarPinca(e);
          return;
        }
        const m = mapaRef.current;
        const toque = candidato.current;
        const area = m && toque ? areaDoAlvo(m, toque.alvo) : undefined;
        if (!m || !toque || !area) {
          modo.current = 'mover';
          visaoAoComecar.current = janelaRef.current;
          return;
        }
        modo.current = 'arrastar';
        arrasto.current = { toque, base: m, inicio: { ...area } };
        setSelecionado(toque.alvo);
        setConfirmandoExclusao(false);
      },
      onPanResponderMove: (e, g) => {
        const m = mapaRef.current;
        if (!m || larguraPx.current === 0) return;
        const pxBase = larguraPx.current / m.largura;

        if (e.nativeEvent.touches.length >= 2) {
          if (modo.current !== 'pinca') comecarPinca(e);
          const inicio = pinca.current;
          if (!inicio) return;
          const { d, meio } = medidas(e);
          // O ponto entre os dedos fica sobre a mesma célula: aproximar e mover a visão acontecem juntos.
          setJanela(
            zoomEmTorno(
              janelaRef.current,
              (inicio.escala0 * d) / inicio.d0,
              inicio.focal,
              meio,
              pxBase,
              m.largura,
              m.altura,
            ),
          );
          return;
        }
        // Depois do pinça, o dedo que ficou não mexe em nada até soltar.
        if (modo.current === 'pinca') return;

        if (modo.current === 'mover') {
          setJanela(
            deslocarJanela(visaoAoComecar.current, g.dx, g.dy, pxBase, m.largura, m.altura),
          );
          return;
        }

        const a = arrasto.current;
        if (!a) return;
        const px = (larguraPx.current / a.base.largura) * janelaRef.current.escala;
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
        pinca.current = null;
        modo.current = 'nenhum';
      },
      onPanResponderTerminate: () => {
        arrasto.current = null;
        pinca.current = null;
        modo.current = 'nenhum';
      },
    });
  }, []);

  // Botões de zoom (para quem não tem dois dedos): aproximam ou afastam em torno do centro da tela.
  const zoomPelosBotoes = (fator: number) => {
    const m = mapaRef.current;
    if (!m || larguraPx.current === 0) return;
    const pxBase = larguraPx.current / m.largura;
    const centro = { x: larguraPx.current / 2, y: (larguraPx.current * m.altura) / m.largura / 2 };
    const focal = celulaNoPonto(janela, pxBase, centro.x, centro.y);
    setJanela(
      zoomEmTorno(janela, janela.escala * fator, focal, centro, pxBase, m.largura, m.altura),
    );
  };

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
  const semCategoria = ladosSemCategoria(mapa);

  // Do aviso "Seções sem categorias": seleciona a seção e abre a lista do lado que falta (só com o mapa destravado).
  function preencherCategorias(secaoId: string, lado: 'A' | 'B') {
    if (travado) {
      toast('Toque no cadeado para destravar a edição e escolher as categorias.');
      return;
    }
    setSelecionado({ tipo: 'secao', id: secaoId });
    setEscolhendoCategorias(lado);
  }
  const nomeDaCategoria = (id: string) => categorias?.find((c) => c.id === id)?.nome ?? id;

  function aplicarTamanho() {
    if (!mapa) return;
    const resultado = redimensionarMapa(mapa, Number(colunas), Number(linhas));
    if (!resultado.ok) {
      toast(resultado.erro);
      return;
    }
    setMapa(resultado.mapa);
    setJanela(JANELA_INICIAL);
    toast('Tamanho atualizado. Salve o mapa para guardar.');
  }

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

  function duplicar() {
    if (!secao) return;
    const id = novoIdLocal();
    const novo = duplicarSecao(mapa!, secao.id, id);
    aplicar(novo, 'Sem espaço livre para duplicar');
    if (novo) {
      setSelecionado({ tipo: 'secao', id });
      toast('Seção duplicada com o mesmo tamanho. Dê um nome e arraste para o lugar.');
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

  // Resumo do que está marcado, no lugar das pílulas: os nomes (ou a quantidade quando não cabem).
  const resumoDasCategorias = (ligadas: string[]) => {
    if (ligadas.length === 0) return 'Escolher categorias';
    const nomes = ligadas.map(nomeDaCategoria);
    return nomes.length <= 2 ? nomes.join(', ') : `${nomes.length} categorias: ${nomes.join(', ')}`;
  };

  const gatilhoDeCategorias = (lado: 'A' | 'B', ligadas: string[]) => (
    <GatilhoDeSeletor
      rotulo="Categorias"
      valor={resumoDasCategorias(ligadas)}
      aberto={escolhendoCategorias === lado}
      aoPressionar={() => setEscolhendoCategorias(lado)}
    />
  );

  const cartaoDoMapa = (
    <Cartao estilo={{ padding: espaco.md }}>
      <View style={SEM_ROLAGEM} {...gestos.panHandlers}>
        <MapaSvg
          mapa={mapa}
          modo="editar"
          selecionado={travado ? null : selecionado}
          janela={janela}
          aoMedir={(largura) => {
            larguraPx.current = largura;
          }}
        />
      </View>
      <View style={estilos.zoom}>
        <Chip rotulo="Afastar" ativo={false} aoPressionar={() => zoomPelosBotoes(1 / 1.5)} />
        <Chip rotulo="Aproximar" ativo={false} aoPressionar={() => zoomPelosBotoes(1.5)} />
        <Chip
          rotulo={
            janela.escala > 1
              ? `Ver tudo · ${janela.escala.toFixed(1).replace('.', ',')}×`
              : 'Ver tudo'
          }
          ativo={janela.escala > 1}
          aoPressionar={() => setJanela(JANELA_INICIAL)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={travado ? 'Destravar a edição do mapa' : 'Travar a edição do mapa'}
          accessibilityState={{ selected: !travado }}
          onPress={() => {
            // Ao travar, solta o que estiver em confirmação para não ficar um "Confirmar" pendurado.
            setConfirmandoExclusao(false);
            setTravado(!travado);
          }}
          style={[
            estilos.cadeado,
            {
              backgroundColor: travado ? p.superficie : p.destaque,
              borderColor: travado ? p.linha : p.destaque,
            },
          ]}
        >
          <Icone
            nome={travado ? 'cadeado' : 'cadeado_aberto'}
            cor={travado ? p.texto : p.textoSobreDestaque}
            tamanho={20}
          />
        </Pressable>
      </View>
    </Cartao>
  );

  return (
    <Pagina larga="total">
      <Cabecalho titulo={mapa.nome || 'Mapa do mercado'} aoVoltar={voltar} />
      <View style={largo ? estilos.duasColunas : estilos.umaColuna}>
        {largo && (
          <ScrollView style={estilos.colunaDoMapa} contentContainerStyle={estilos.conteudo}>
            {cartaoDoMapa}
          </ScrollView>
        )}
        <ScrollView
          style={largo ? estilos.colunaDoPainel : undefined}
          contentContainerStyle={estilos.conteudo}
          keyboardShouldPersistTaps="handled"
        >
          {confirmandoSaida && (
            <Cartao
              estilo={{
                backgroundColor: p.alertaSuave,
                borderColor: p.alertaSuave,
                gap: espaco.sm,
              }}
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
            editable={!travado}
          />
          <Campo
            rotulo="Cidade"
            value={mapa.cidade}
            onChangeText={(cidade) => setMapa({ ...mapa, cidade })}
            placeholder="Ex.: Araras"
            autoCapitalize="words"
            maxLength={80}
            editable={!travado}
          />
          {secoesComNomeProprio(mapa) < MINIMO_DE_SECOES_PARA_O_CATALOGO && (
            <TextoSuave estilo={{ fontSize: fonte.pequena }}>
              {`Para este mapa aparecer em Mapas existentes, ele precisa de pelo menos ${MINIMO_DE_SECOES_PARA_O_CATALOGO} seções com nome próprio (agora: ${secoesComNomeProprio(mapa)}). "Nova seção" não conta.`}
            </TextoSuave>
          )}
          {!mapa.cidade.trim() && (
            <TextoSuave>
              Informe a cidade para salvar o mapa. Ela ajuda outras pessoas a encontrá-lo em Mapas
              existentes.
            </TextoSuave>
          )}
          <TextoSuave>
            {travado
              ? 'Mapa travado: você só aproxima e anda pelo mapa (dois dedos, ou um dedo com zoom). Toque no cadeado para editar.'
              : 'Arraste uma seção para mover. A bolinha do canto muda o tamanho. A entrada e os caixas também se arrastam. Com dois dedos você aproxima e move o mapa. Cada quadradinho vale cerca de 1,5 m.'}
          </TextoSuave>

          {!largo && cartaoDoMapa}

          {!travado && (
            <>
              <Cartao estilo={{ gap: espaco.sm }}>
                <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '700' }}>
                  Tamanho do mapa
                </Text>
                <View style={estilos.acoes}>
                  <View style={{ flex: 1 }}>
                    <Campo
                      rotulo="Colunas"
                      value={colunas}
                      onChangeText={(t) => setColunas(t.replace(/\D/g, ''))}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Campo
                      rotulo="Linhas"
                      value={linhas}
                      onChangeText={(t) => setLinhas(t.replace(/\D/g, ''))}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                  </View>
                </View>
                <TextoSuave estilo={{ fontSize: fonte.pequena }}>
                  {descreverTamanho({ x: 0, y: 0, largura: mapa.largura, altura: mapa.altura })}. De{' '}
                  {TAMANHO_MINIMO_DO_MAPA} a {TAMANHO_MAXIMO_DO_MAPA} em cada lado. Para diminuir,
                  as seções precisam caber no tamanho novo.
                </TextoSuave>
                <Botao
                  titulo="Aplicar tamanho"
                  variante="secundario"
                  desabilitado={Number(colunas) === mapa.largura && Number(linhas) === mapa.altura}
                  aoPressionar={aplicarTamanho}
                  estilo={{ minHeight: 44 }}
                />
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
                <Botao
                  titulo="Duplicar"
                  variante="secundario"
                  desabilitado={!secao}
                  aoPressionar={duplicar}
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
                  {gatilhoDeCategorias('A', secao.categoriasLadoA)}
                  {secao.dividida && (
                    <>
                      <Campo
                        rotulo={`Lado ${textoDoLado(secao, 'B')?.replace('lado ', '')}`}
                        value={secao.nomeLadoB ?? ''}
                        onChangeText={(t) => setMapa(renomearSecao(mapa, secao.id, 'B', t))}
                        maxLength={40}
                      />
                      {gatilhoDeCategorias('B', secao.categoriasLadoB)}
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
            </>
          )}

          {semCategoria.length > 0 && (
            <Cartao estilo={{ gap: espaco.sm }}>
              <Pilula texto={`Seções sem categorias: ${semCategoria.length}`} tom="alerta" />
              <TextoSuave>
                A rota não passa por elas até você escolher as categorias. Toque para preencher.
              </TextoSuave>
              <View style={estilos.chips}>
                {semCategoria.map((l) => (
                  <Chip
                    key={`${l.secaoId}-${l.lado}`}
                    rotulo={l.rotulo}
                    ativo={selecionado?.tipo === 'secao' && selecionado.id === l.secaoId}
                    aoPressionar={() => preencherCategorias(l.secaoId, l.lado)}
                  />
                ))}
              </View>
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
          {!travado &&
            secao &&
            (secao.categoriasLadoA.length > 0 || secao.categoriasLadoB.length > 0) && (
              <TextoSuave estilo={{ fontSize: fonte.pequena }}>
                Nesta seção:{' '}
                {[...secao.categoriasLadoA, ...secao.categoriasLadoB]
                  .map(nomeDaCategoria)
                  .join(', ')}
                .
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
      </View>
      {secao && (
        <SeletorDeCategorias
          visivel={escolhendoCategorias !== null}
          titulo={
            escolhendoCategorias === 'B'
              ? `Categorias · ${secao.nomeLadoB ?? 'lado B'}`
              : `Categorias · ${secao.nome}`
          }
          categorias={categorias ?? []}
          selecionadas={
            escolhendoCategorias === 'B' ? secao.categoriasLadoB : secao.categoriasLadoA
          }
          aoAlternar={(id) => {
            if (escolhendoCategorias) {
              setMapa(alternarCategoria(mapa, secao.id, escolhendoCategorias, id));
            }
          }}
          aoFechar={() => setEscolhendoCategorias(null)}
        />
      )}
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  umaColuna: { flex: 1 },
  duasColunas: { flex: 1, flexDirection: 'row' },
  colunaDoMapa: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  colunaDoPainel: { flexGrow: 0, flexShrink: 0, flexBasis: 400, width: 400 },
  conteudo: { padding: espaco.lg, paddingBottom: 48, gap: espaco.md },
  acoes: { flexDirection: 'row', gap: espaco.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  zoom: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, marginTop: espaco.md },
  cadeado: {
    width: 44,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
