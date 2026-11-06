import { useRoute, type RouteProp } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type {
  DadosDoItem,
  DivisaoDaCategoria,
  ItemDaLista,
  Lista,
} from '../../domain/entities/tipos';
import { nomesDosMembros } from '../../domain/entities/grupo';
import {
  categoriasDaListaComId,
  divisaoValida,
  responsavelDaCategoria,
  resumoDaDivisao,
} from '../../domain/services/divisao';
import { calcularTotais } from '../../domain/services/financeiro';
import {
  existeNaListaPadrao,
  organizarItens,
  resumirItens,
  type FiltroDeStatus,
  type Ordenacao,
} from '../../domain/services/organizacao';
import { Botao, Cartao, TextoSuave } from '../components/base';
import { FolhaDeDivisao } from '../components/FolhaDeDivisao';
import { FolhaDeItem, Moldura, TituloDaFolha } from '../components/Folhas';
import { LinhaDeItem } from '../components/LinhaDeItem';
import { ResumoFinanceiro } from '../components/ResumoFinanceiro';
import { IndicadorDeSincronizacao } from '../components/Sincronizacao';
import {
  BarraDeProgresso,
  BotaoDeFiltro,
  BotaoFlutuante,
  Cabecalho,
  CampoDeBusca,
  Carregando,
  Chip,
  EstadoVazio,
  GatilhoDeSeletor,
  Pagina,
  PainelDeOpcoes,
  Pilula,
} from '../components/ui';
import { mercadoEmUso } from '../../domain/services/compraDividida';
import { DivisaoDaCompra } from '../components/DivisaoDaCompra';
import { useContainer, useMercadoAtual, useSessao } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao, type RootStackParamList } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

type Folha = { tipo: 'novo' } | { tipo: 'editar'; item: ItemDaLista } | null;

const FILTROS: { valor: FiltroDeStatus; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'pendentes', rotulo: 'Pendentes' },
  { valor: 'comprados', rotulo: 'Comprados' },
];
const ORDENACOES: { valor: Ordenacao; rotulo: string }[] = [
  { valor: 'categoria', rotulo: 'Por categoria' },
  { valor: 'nome', rotulo: 'Por nome' },
  { valor: 'status', rotulo: 'Por status' },
  { valor: 'manual', rotulo: 'Minha ordem' },
];

/** Texto do gatilho do filtro: nada marcado = todas; uma = o nome dela; mais de uma = a contagem. */
function rotuloDasCategorias(selecionadas: string[]) {
  if (selecionadas.length === 0) return 'Todas as categorias';
  return selecionadas.length === 1 ? selecionadas[0] : `${selecionadas.length} categorias`;
}

interface ListaViewProps {
  buscar: () => Promise<Lista | null>;
  chave: string;
  comVoltar: boolean;
}

/**
 * Lista de compras do mês. Serve às duas telas: a aba "Lista" (lista do momento) e o detalhe de
 * qualquer mês do histórico. Lista finalizada abre em modo leitura, sem risco de alteração acidental.
 */
function ListaView({ buscar, chave, comVoltar }: ListaViewProps) {
  const p = usePaleta();
  const container = useContainer();
  const { sessao } = useSessao();
  const toast = useToast();
  const navegacao = useNavegacao();
  const { dados: lista, definirDados, erro, carregando, recarregar } = useCarregar(buscar, chave);
  const { dados: categorias } = useCarregar(
    () => container.listarCategorias.executar(),
    'categorias',
  );

  // Membros do grupo: para mostrar quem marcou cada item ("Ana marcou").
  const { dados: grupo } = useCarregar(() => container.obterGrupo.executar(), 'grupo');
  const nomes = nomesDosMembros(grupo);

  // Mercados: a compra do mês pode ser dividida entre vários. Cada item marcado guarda onde foi comprado.
  const { dados: mercados } = useCarregar(() => container.listarMercados.executar(), 'mercados');
  const { mercadoId } = useMercadoAtual();
  const mercadoDeHoje = mercadoEmUso(mercados, mercadoId);
  const nomeDoMercado = (id: string | null) =>
    id ? (mercados?.find((m) => m.id === id)?.nome ?? 'outro mercado') : undefined;

  // Favoritos e recorrentes: sugeridos no formulário de novo produto, mesmo fora da lista padrão.
  const { dados: sugestoes } = useCarregar(
    () => container.obterSugestoesDeProdutos.executar(),
    'sugestoes',
  );

  const [busca, setBusca] = useState('');
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>([]);
  const [painel, setPainel] = useState<'categorias' | 'ordem' | null>(null);
  // Filtros e ordenação ficam recolhidos até o toque no ícone de filtro, ao lado da busca.
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [filtro, setFiltro] = useState<FiltroDeStatus>('todos');
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('categoria');
  const [folha, setFolha] = useState<Folha>(null);
  const [dividindo, setDividindo] = useState(false);
  // Produto novo da lista que ainda não está na lista padrão: pergunta se deve entrar nela.
  const [sugerirNoPadrao, setSugerirNoPadrao] = useState<DadosDoItem | null>(null);
  const [incluindoNoPadrao, setIncluindoNoPadrao] = useState(false);
  const [confirmandoFim, setConfirmandoFim] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  // Itens que OUTRA pessoa acabou de pedir (chegam por tempo real): avisa e marca com "Novo" até a pessoa mexer neles.
  // Na primeira carga (ou ao trocar de lista) só memoriza o que já existe, sem avisar.
  const [pedidosDeOutros, setPedidosDeOutros] = useState<Map<string, string>>(new Map());
  const itensVistos = useRef<{ listaId: string; ids: Set<string>; status: string } | null>(null);
  const euFinalizei = useRef(false);
  const nomesRef = useRef(nomes);
  nomesRef.current = nomes;
  useEffect(() => {
    if (!lista) return;
    const vistos = itensVistos.current;
    const status = lista.resumo.status;
    if (!vistos || vistos.listaId !== lista.resumo.id) {
      itensVistos.current = {
        listaId: lista.resumo.id,
        ids: new Set(lista.itens.map((i) => i.id)),
        status,
      };
      setPedidosDeOutros(new Map());
      return;
    }

    const meuId = sessao?.usuario.id;
    const novos = lista.itens.filter(
      (i) => !vistos.ids.has(i.id) && i.adicionadoPorUsuarioId !== meuId,
    );
    if (novos.length > 0) {
      const quem = (id: string) => nomesRef.current.get(id)?.split(' ')[0] ?? 'Alguém';
      setPedidosDeOutros((atual) => {
        const proximo = new Map(atual);
        for (const i of novos) proximo.set(i.id, quem(i.adicionadoPorUsuarioId));
        return proximo;
      });
      toast(
        novos.length === 1
          ? `${quem(novos[0].adicionadoPorUsuarioId)} pediu: ${novos[0].nome}`
          : `${quem(novos[0].adicionadoPorUsuarioId)} adicionou ${novos.length} itens`,
      );
    }
    if (vistos.status === 'EmAndamento' && status === 'Finalizada' && !euFinalizei.current) {
      toast('A compra foi finalizada por outra pessoa');
    }
    euFinalizei.current = false;
    itensVistos.current = {
      listaId: lista.resumo.id,
      ids: new Set(lista.itens.map((i) => i.id)),
      status,
    };
  }, [lista, sessao?.usuario.id, toast]);
  const esquecerPedido = (itemId: string) =>
    setPedidosDeOutros((atual) => {
      if (!atual.has(itemId)) return atual;
      const proximo = new Map(atual);
      proximo.delete(itemId);
      return proximo;
    });

  if (carregando && !lista)
    return (
      <Pagina>
        <Carregando />
      </Pagina>
    );
  if (erro && !lista) {
    return (
      <Pagina>
        <EstadoVazio
          titulo="Não foi possível carregar"
          texto={erro}
          acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void recarregar() }}
        />
      </Pagina>
    );
  }
  if (!lista) {
    return (
      <Pagina>
        <Cabecalho titulo="Lista" />
        <EstadoVazio
          titulo="Nenhuma lista em andamento"
          texto="Crie a lista do mês a partir da sua lista padrão, de uma lista vazia, e marque os produtos durante a compra."
          acao={{ rotulo: 'Criar lista', aoPressionar: () => navegacao.navigate('NovaLista') }}
        />
      </Pagina>
    );
  }

  const somenteLeitura = lista.resumo.status === 'Finalizada';
  const resumo = resumirItens(lista.itens);
  const categoriasComId = categoriasDaListaComId(lista.itens);
  const divisaoDaCompra = divisaoValida(lista.divisao, grupo?.membros ?? []);
  const totais = calcularTotais(lista.itens);
  const gastoDaCategoria = new Map(totais.porCategoria.map((c) => [c.categoria, c.realizado]));
  // Categorias que existem nesta lista, na ordem das categorias do grupo (para o filtro).
  const ordemDasCategorias = (categorias ?? []).map((c) => c.nome);
  const categoriasDaLista = [...new Set(lista.itens.map((i) => i.categoriaNome))].sort(
    (a, b) =>
      (ordemDasCategorias.indexOf(a) === -1 ? 999 : ordemDasCategorias.indexOf(a)) -
      (ordemDasCategorias.indexOf(b) === -1 ? 999 : ordemDasCategorias.indexOf(b)),
  );
  // Categoria escolhida que já não existe na lista (último item removido) deixa de filtrar.
  const categoriasSelecionadas = categoriasFiltro.filter((c) => categoriasDaLista.includes(c));
  const filtroAtivo =
    filtro !== 'todos' || categoriasSelecionadas.length > 0 || ordenacao !== 'categoria';
  const grupos = organizarItens(
    lista.itens,
    { busca, filtro, ordenacao, categorias: categoriasSelecionadas },
    (categorias ?? []).map((c) => c.nome),
  );

  // Reordenar só faz sentido com a lista inteira na tela (sem busca nem filtros).
  const podeMover =
    ordenacao === 'manual' &&
    !somenteLeitura &&
    busca === '' &&
    filtro === 'todos' &&
    categoriasSelecionadas.length === 0;

  // Compra dividida: o item é de outra pessoa quando a categoria dele foi dada a alguém que não sou eu.
  const comQuemEsta = (item: ItemDaLista) => {
    const dono = responsavelDaCategoria(divisaoDaCompra, item.categoriaId);
    return dono && dono !== sessao?.usuario.id ? nomes.get(dono)?.split(' ')[0] : undefined;
  };

  const atualizarItens = (alterar: (itens: ItemDaLista[]) => ItemDaLista[]) =>
    definirDados((atual) => (atual ? { ...atual, itens: alterar(atual.itens) } : atual));
  const trocarItem = (novo: ItemDaLista) =>
    atualizarItens((itens) => itens.map((i) => (i.id === novo.id ? novo : i)));

  async function mover(indice: number, direcao: -1 | 1) {
    const anterior = lista!.itens;
    const ordenados = [...anterior].sort((a, b) => a.ordem - b.ordem);
    [ordenados[indice], ordenados[indice + direcao]] = [
      ordenados[indice + direcao],
      ordenados[indice],
    ];
    // Otimista: a tela já mostra a nova ordem; se o servidor recusar, volta como estava.
    atualizarItens(() => ordenados.map((item, ordem) => ({ ...item, ordem })));
    try {
      await container.reordenarItensDaLista.executar(
        lista!.resumo.id,
        ordenados.map((i) => i.id),
      );
    } catch (e) {
      atualizarItens(() => anterior);
      toast(mensagemParaUsuario(e));
    }
  }

  async function marcar(item: ItemDaLista) {
    esquecerPedido(item.id);
    const listaId = lista!.resumo.id;
    // Atualização otimista: a tela responde ao toque na hora e desfaz se o servidor recusar.
    const lojaId = !item.comprado ? (mercadoDeHoje?.id ?? null) : null;
    trocarItem({ ...item, comprado: !item.comprado, compradoNaLojaId: lojaId });
    try {
      trocarItem(
        await container.marcarItemComprado.executar(listaId, item.id, !item.comprado, lojaId),
      );
    } catch (e) {
      trocarItem(item);
      toast(mensagemParaUsuario(e));
      void recarregar();
    }
  }

  async function salvar(dados: DadosDoItem, compradoNaLojaId?: string | null) {
    const listaId = lista!.resumo.id;
    if (folha?.tipo === 'editar') {
      let atualizado = await container.editarItemDaLista.executar(listaId, folha.item, dados);
      // Corrigir o mercado de um item já comprado: o servidor aceita marcar de novo com outro mercado.
      if (
        folha.item.comprado &&
        compradoNaLojaId &&
        compradoNaLojaId !== folha.item.compradoNaLojaId
      ) {
        atualizado = await container.marcarItemComprado.executar(
          listaId,
          folha.item.id,
          true,
          compradoNaLojaId,
        );
      }
      trocarItem(atualizado);
      toast('Produto atualizado');
    } else {
      const criado = await container.adicionarItemNaLista.executar(listaId, dados);
      atualizarItens((itens) => [...itens, criado]);
      toast('Produto adicionado');
      await sugerirListaPadraoSeNovo(dados);
    }
    setFolha(null);
  }

  async function salvarDivisao(divisao: DivisaoDaCategoria[]) {
    try {
      const salva = await container.dividirCompra.executar(lista!.resumo.id, divisao);
      definirDados((atual) => (atual ? { ...atual, divisao: salva } : atual));
      toast(salva.length > 0 ? 'Compra dividida' : 'Divisão desfeita');
      setDividindo(false);
    } catch (e) {
      toast(mensagemParaUsuario(e));
    }
  }

  async function sugerirListaPadraoSeNovo(dados: DadosDoItem) {
    try {
      const modelo = await container.listarItensDoModelo.executar();
      if (!existeNaListaPadrao(modelo, dados.nome)) setSugerirNoPadrao(dados);
    } catch {
      // A pergunta é um extra: se não deu para consultar a lista padrão, o produto já foi adicionado e segue.
    }
  }

  async function incluirNoPadrao() {
    if (!sugerirNoPadrao) return;
    setIncluindoNoPadrao(true);
    try {
      const { nome, categoriaId, unidade, quantidade } = sugerirNoPadrao;
      await container.adicionarItemAoModelo.executar({ nome, categoriaId, unidade, quantidade });
      toast('Produto incluído na lista padrão');
    } catch (e) {
      toast(mensagemParaUsuario(e));
    } finally {
      setIncluindoNoPadrao(false);
      setSugerirNoPadrao(null);
    }
  }

  async function excluir(item: ItemDaLista) {
    await container.removerItemDaLista.executar(lista!.resumo.id, item.id);
    atualizarItens((itens) => itens.filter((i) => i.id !== item.id));
    setFolha(null);
    toast('Produto removido só deste mês');
  }

  async function executarNaLista(acao: () => Promise<unknown>, aviso: string) {
    // Quem finaliza aqui não precisa do aviso "finalizada por outra pessoa" que o recarregamento geraria.
    euFinalizei.current = true;
    try {
      await acao();
      toast(aviso);
      await recarregar();
    } catch (e) {
      toast(mensagemParaUsuario(e));
    } finally {
      setConfirmandoFim(false);
    }
  }

  const titulo = lista.resumo.principal ? lista.resumo.competenciaNome : lista.resumo.nome;

  return (
    <Pagina>
      <Cabecalho
        titulo={titulo}
        aoVoltar={comVoltar ? () => navegacao.goBack() : undefined}
        direita={<IndicadorDeSincronizacao />}
      />
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={async () => {
              setAtualizando(true);
              await recarregar();
              setAtualizando(false);
            }}
            tintColor={p.destaque}
          />
        }
      >
        {somenteLeitura && (
          <Cartao
            estilo={{
              backgroundColor: p.destaqueSuave,
              borderColor: p.destaqueSuave,
              gap: espaco.sm,
            }}
          >
            <Pilula texto="Compra finalizada" />
            <TextoSuave>
              Finalizada em{' '}
              {lista.resumo.finalizadaEm
                ? new Date(lista.resumo.finalizadaEm).toLocaleDateString('pt-BR')
                : '-'}
              . Esta lista está só para consulta.
            </TextoSuave>
            <Botao
              titulo="Reabrir lista"
              variante="secundario"
              aoPressionar={() =>
                void executarNaLista(
                  () => container.reabrirLista.executar(lista.resumo.id),
                  'Lista reaberta',
                )
              }
            />
          </Cartao>
        )}

        <Cartao heroi>
          <View style={estilos.entre}>
            <Text
              style={{
                color: p.texto,
                fontSize: 30,
                fontWeight: '800',
                fontVariant: ['tabular-nums'],
              }}
            >
              {resumo.percentual}%
            </Text>
            <Text style={{ color: p.textoSuave, fontSize: fonte.corpo }}>
              {resumo.comprados} de {resumo.total} comprados
            </Text>
          </View>
          <View style={{ height: espaco.sm }} />
          <BarraDeProgresso percentual={resumo.percentual} />
          <Text style={{ color: p.textoSuave, fontSize: fonte.pequena, marginTop: espaco.sm }}>
            {resumo.pendentes} {resumo.pendentes === 1 ? 'pendente' : 'pendentes'}
          </Text>
          <View style={{ height: espaco.md }} />
          <ResumoFinanceiro
            estimado={totais.estimado}
            realizado={totais.realizado}
            compradosSemPreco={totais.compradosSemPreco}
          />
          {mercados && mercados.length > 1 && (
            <>
              <View style={{ height: espaco.md }} />
              <DivisaoDaCompra itens={lista.itens} mercados={mercados} />
            </>
          )}
        </Cartao>

        {resumo.comprados >= 1 && (
          <Botao
            icone="nota"
            titulo="Importar nota fiscal"
            variante="secundario"
            aoPressionar={() => navegacao.navigate('ImportarNota', { listaId: lista.resumo.id })}
          />
        )}

        {!somenteLeitura && (
          <Botao
            icone={mercadoDeHoje ? 'rota' : 'mapa'}
            titulo={mercadoDeHoje ? `Rota em ${mercadoDeHoje.nome}` : 'Mapear meu mercado'}
            aoPressionar={() => navegacao.navigate(mercadoDeHoje ? 'Rota' : 'Mercados')}
          />
        )}

        {!somenteLeitura && grupo?.compartilhado && (
          <Cartao estilo={{ gap: espaco.sm }}>
            {resumoDaDivisao(divisaoDaCompra, categoriasComId, grupo.membros).map((r) => (
              <Text key={r.usuarioId} style={{ color: p.texto, fontSize: fonte.corpo }}>
                <Text style={{ fontWeight: '700' }}>{r.nome}:</Text> {r.categorias.join(', ')}
              </Text>
            ))}
            <Botao
              icone="pessoas"
              titulo={divisaoDaCompra.length > 0 ? 'Mudar a divisão' : 'Dividir a compra'}
              variante="secundario"
              aoPressionar={() => setDividindo(true)}
            />
          </Cartao>
        )}

        <View style={estilos.linhaDeBusca}>
          <View style={{ flex: 1 }}>
            <CampoDeBusca valor={busca} aoMudar={setBusca} placeholder="Buscar produto" />
          </View>
          <BotaoDeFiltro
            aberto={filtrosAbertos}
            comFiltroAtivo={filtroAtivo}
            aoPressionar={() => {
              setFiltrosAbertos(!filtrosAbertos);
              setPainel(null);
            }}
          />
        </View>
        {filtrosAbertos && (
          <>
            <View style={estilos.chips}>
              {FILTROS.map((f) => (
                <Chip
                  key={f.valor}
                  rotulo={f.rotulo}
                  ativo={filtro === f.valor}
                  aoPressionar={() => setFiltro(f.valor)}
                />
              ))}
            </View>
            <View style={estilos.seletores}>
              {categoriasDaLista.length > 1 && (
                <GatilhoDeSeletor
                  rotulo="Categorias"
                  valor={rotuloDasCategorias(categoriasSelecionadas)}
                  aberto={painel === 'categorias'}
                  aoPressionar={() => setPainel(painel === 'categorias' ? null : 'categorias')}
                />
              )}
              <GatilhoDeSeletor
                rotulo="Ordenar"
                valor={ORDENACOES.find((o) => o.valor === ordenacao)?.rotulo ?? ''}
                aberto={painel === 'ordem'}
                aoPressionar={() => setPainel(painel === 'ordem' ? null : 'ordem')}
              />
            </View>
            {painel === 'categorias' && (
              <PainelDeOpcoes
                titulo="Filtrar por categorias"
                opcoes={[
                  {
                    chave: 'todas',
                    rotulo: 'Todas as categorias',
                    marcada: categoriasSelecionadas.length === 0,
                    aoPressionar: () => setCategoriasFiltro([]),
                  },
                  ...categoriasDaLista.map((nome) => ({
                    chave: nome,
                    rotulo: nome,
                    marcada: categoriasSelecionadas.includes(nome),
                    aoPressionar: () =>
                      setCategoriasFiltro(
                        categoriasSelecionadas.includes(nome)
                          ? categoriasSelecionadas.filter((c) => c !== nome)
                          : [...categoriasSelecionadas, nome],
                      ),
                  })),
                ]}
              />
            )}
            {painel === 'ordem' && (
              <PainelDeOpcoes
                titulo="Ordenar a lista"
                opcoes={ORDENACOES.map((o) => ({
                  chave: o.valor,
                  rotulo: o.rotulo,
                  marcada: ordenacao === o.valor,
                  aoPressionar: () => {
                    setOrdenacao(o.valor);
                    setPainel(null);
                  },
                }))}
              />
            )}
          </>
        )}

        {lista.itens.length === 0 ? (
          <EstadoVazio
            titulo="Lista vazia"
            texto="Toque no botão + para adicionar o primeiro produto desta lista."
          />
        ) : grupos.length === 0 ? (
          <EstadoVazio
            titulo="Nada por aqui"
            texto="Nenhum produto corresponde à busca ou ao filtro escolhido."
          />
        ) : (
          grupos.map((grupo) => (
            <View key={grupo.titulo} style={{ gap: espaco.sm }}>
              <View style={estilos.entre}>
                <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '700' }}>
                  {grupo.titulo}
                </Text>
                <Text
                  style={{
                    color: p.textoSuave,
                    fontSize: fonte.pequena,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {grupo.comprados}/{grupo.itens.length}
                  {ordenacao === 'categoria' &&
                  (gastoDaCategoria.get(grupo.titulo)?.centavos ?? 0) > 0
                    ? ` · ${gastoDaCategoria.get(grupo.titulo)?.formatar()}`
                    : ''}
                </Text>
              </View>
              {grupo.itens.map((item, indice) => (
                <LinhaDeItem
                  key={item.id}
                  item={item}
                  somenteLeitura={somenteLeitura}
                  marcadoPorOutro={
                    !!item.compradoPorUsuarioId && item.compradoPorUsuarioId !== sessao?.usuario.id
                  }
                  nomeDeQuemMarcou={nomes.get(item.compradoPorUsuarioId ?? '')}
                  nomeDoMercado={item.comprado ? nomeDoMercado(item.compradoNaLojaId) : undefined}
                  comOutraPessoa={comQuemEsta(item)}
                  pedidoPor={pedidosDeOutros.get(item.id)}
                  aoMarcar={(i) => void marcar(i)}
                  aoEditar={(i) => {
                    esquecerPedido(i.id);
                    setFolha({ tipo: 'editar', item: i });
                  }}
                  aoMover={
                    podeMover
                      ? {
                          subir: indice > 0 ? () => void mover(indice, -1) : null,
                          descer:
                            indice < grupo.itens.length - 1 ? () => void mover(indice, 1) : null,
                        }
                      : undefined
                  }
                />
              ))}
            </View>
          ))
        )}

        {!somenteLeitura && lista.itens.length > 0 && (
          <Botao
            titulo={confirmandoFim ? 'Toque de novo para finalizar a compra' : 'Finalizar compra'}
            variante={confirmandoFim ? 'principal' : 'secundario'}
            aoPressionar={() =>
              confirmandoFim
                ? void executarNaLista(
                    () => container.finalizarLista.executar(lista.resumo.id),
                    'Compra finalizada',
                  )
                : setConfirmandoFim(true)
            }
          />
        )}
      </ScrollView>

      {!somenteLeitura && (
        <BotaoFlutuante
          rotulo="Adicionar produto"
          aoPressionar={() => setFolha({ tipo: 'novo' })}
        />
      )}

      <FolhaDeItem
        visivel={folha !== null}
        titulo={folha?.tipo === 'editar' ? 'Editar produto' : 'Adicionar produto'}
        categorias={categorias ?? []}
        inicial={
          folha?.tipo === 'editar'
            ? {
                nome: folha.item.nome,
                categoriaId: folha.item.categoriaId ?? undefined,
                unidade: folha.item.unidade,
                quantidade: folha.item.quantidade,
                quantidadeComprada: folha.item.quantidadeComprada,
                precoEstimado: folha.item.precoEstimado,
                precoUnitario: folha.item.precoUnitario,
              }
            : undefined
        }
        comPrecos
        rotuloDoBotao={folha?.tipo === 'editar' ? 'Salvar' : 'Adicionar'}
        buscarSugestoes={(termo) => container.buscarProdutos.executar(termo)}
        sugestoesIniciais={sugestoes ?? []}
        compra={
          folha?.tipo === 'editar' && folha.item.comprado
            ? {
                mercados: (mercados ?? []).map((m) => ({ id: m.id, nome: m.nome })),
                mercadoId: folha.item.compradoNaLojaId,
              }
            : undefined
        }
        aoSalvar={salvar}
        aoExcluir={folha?.tipo === 'editar' ? () => excluir(folha.item) : undefined}
        aoFechar={() => setFolha(null)}
      />
      {grupo && (
        <FolhaDeDivisao
          visivel={dividindo}
          categorias={categoriasComId}
          membros={grupo.membros}
          inicial={divisaoDaCompra}
          aoSalvar={salvarDivisao}
          aoFechar={() => setDividindo(false)}
        />
      )}

      <Moldura visivel={sugerirNoPadrao !== null} aoFechar={() => setSugerirNoPadrao(null)}>
        <TituloDaFolha>Incluir na lista padrão?</TituloDaFolha>
        <TextoSuave>
          “{sugerirNoPadrao?.nome}” não está na sua lista padrão. Incluir para que apareça nas
          próximas listas?
        </TextoSuave>
        <Botao
          titulo="Sim, incluir"
          carregando={incluindoNoPadrao}
          aoPressionar={() => void incluirNoPadrao()}
        />
        <Botao
          titulo="Não"
          variante="secundario"
          desabilitado={incluindoNoPadrao}
          aoPressionar={() => setSugerirNoPadrao(null)}
        />
      </Moldura>
    </Pagina>
  );
}

/** Aba "Lista": a lista do momento. */
export function ListaScreen() {
  const { obterListaAtual } = useContainer();
  return <ListaView buscar={() => obterListaAtual.executar()} chave="atual" comVoltar={false} />;
}

/** Detalhe de uma lista específica (vindo do Histórico ou logo após criar). */
export function DetalheDaListaScreen() {
  const { obterLista } = useContainer();
  const { params } = useRoute<RouteProp<RootStackParamList, 'DetalheDaLista'>>();
  return (
    <ListaView
      buscar={() => obterLista.executar(params.listaId)}
      chave={params.listaId}
      comVoltar
    />
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, paddingBottom: 120, gap: espaco.md },
  entre: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  linhaDeBusca: { flexDirection: 'row', alignItems: 'stretch', gap: espaco.sm },
  seletores: { flexDirection: 'row', gap: espaco.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
});
