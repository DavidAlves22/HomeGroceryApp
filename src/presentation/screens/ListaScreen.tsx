import { useRoute, type RouteProp } from '@react-navigation/native';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type { DadosDoItem, ItemDaLista, Lista } from '../../domain/entities/tipos';
import { nomesDosMembros } from '../../domain/entities/grupo';
import { calcularTotais } from '../../domain/services/financeiro';
import {
  organizarItens,
  resumirItens,
  type FiltroDeStatus,
  type Ordenacao,
} from '../../domain/services/organizacao';
import { Botao, Cartao, TextoSuave } from '../components/base';
import { FolhaDeItem } from '../components/Folhas';
import { LinhaDeItem } from '../components/LinhaDeItem';
import { ResumoFinanceiro } from '../components/ResumoFinanceiro';
import { IndicadorDeSincronizacao } from '../components/Sincronizacao';
import {
  BarraDeProgresso,
  BotaoFlutuante,
  Cabecalho,
  CampoDeBusca,
  Carregando,
  Chip,
  EstadoVazio,
  Pagina,
  Pilula,
} from '../components/ui';
import { useContainer, useSessao } from '../hooks/AppProviders';
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

  // Favoritos e recorrentes: sugeridos no formulário de novo produto, mesmo fora da lista padrão.
  const { dados: sugestoes } = useCarregar(
    () => container.obterSugestoesDeProdutos.executar(),
    'sugestoes',
  );

  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDeStatus>('todos');
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('categoria');
  const [folha, setFolha] = useState<Folha>(null);
  const [confirmandoFim, setConfirmandoFim] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

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
  const totais = calcularTotais(lista.itens);
  const gastoDaCategoria = new Map(totais.porCategoria.map((c) => [c.categoria, c.realizado]));
  const grupos = organizarItens(
    lista.itens,
    { busca, filtro, ordenacao, categoria: categoriaFiltro },
    (categorias ?? []).map((c) => c.nome),
  );

  // Categorias que existem nesta lista, na ordem das categorias do grupo (para o filtro).
  const ordemDasCategorias = (categorias ?? []).map((c) => c.nome);
  const categoriasDaLista = [...new Set(lista.itens.map((i) => i.categoriaNome))].sort(
    (a, b) =>
      (ordemDasCategorias.indexOf(a) === -1 ? 999 : ordemDasCategorias.indexOf(a)) -
      (ordemDasCategorias.indexOf(b) === -1 ? 999 : ordemDasCategorias.indexOf(b)),
  );
  // Reordenar só faz sentido com a lista inteira na tela (sem busca nem filtros).
  const podeMover =
    ordenacao === 'manual' &&
    !somenteLeitura &&
    busca === '' &&
    filtro === 'todos' &&
    !categoriaFiltro;

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
    const listaId = lista!.resumo.id;
    // Atualização otimista: a tela responde ao toque na hora e desfaz se o servidor recusar.
    trocarItem({ ...item, comprado: !item.comprado });
    try {
      trocarItem(await container.marcarItemComprado.executar(listaId, item.id, !item.comprado));
    } catch (e) {
      trocarItem(item);
      toast(mensagemParaUsuario(e));
      void recarregar();
    }
  }

  async function salvar(dados: DadosDoItem) {
    const listaId = lista!.resumo.id;
    if (folha?.tipo === 'editar') {
      trocarItem(await container.editarItemDaLista.executar(listaId, folha.item, dados));
      toast('Produto atualizado');
    } else {
      const criado = await container.adicionarItemNaLista.executar(listaId, dados);
      atualizarItens((itens) => [...itens, criado]);
      toast('Produto adicionado');
    }
    setFolha(null);
  }

  async function excluir(item: ItemDaLista) {
    await container.removerItemDaLista.executar(lista!.resumo.id, item.id);
    atualizarItens((itens) => itens.filter((i) => i.id !== item.id));
    setFolha(null);
    toast('Produto removido só deste mês');
  }

  async function executarNaLista(acao: () => Promise<unknown>, aviso: string) {
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

        <Cartao>
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
        </Cartao>

        <CampoDeBusca valor={busca} aoMudar={setBusca} placeholder="Buscar produto" />
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
        {categoriasDaLista.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={estilos.chipsEmLinha}
          >
            <Chip
              rotulo="Todas as categorias"
              ativo={categoriaFiltro === null}
              aoPressionar={() => setCategoriaFiltro(null)}
            />
            {categoriasDaLista.map((nome) => (
              <Chip
                key={nome}
                rotulo={nome}
                ativo={categoriaFiltro === nome}
                aoPressionar={() => setCategoriaFiltro(categoriaFiltro === nome ? null : nome)}
              />
            ))}
          </ScrollView>
        )}
        <View style={estilos.chips}>
          {ORDENACOES.map((o) => (
            <Chip
              key={o.valor}
              rotulo={o.rotulo}
              ativo={ordenacao === o.valor}
              aoPressionar={() => setOrdenacao(o.valor)}
            />
          ))}
        </View>

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
                  aoMarcar={(i) => void marcar(i)}
                  aoEditar={(i) => setFolha({ tipo: 'editar', item: i })}
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
        aoSalvar={salvar}
        aoExcluir={folha?.tipo === 'editar' ? () => excluir(folha.item) : undefined}
        aoFechar={() => setFolha(null)}
      />
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
  chipsEmLinha: { flexDirection: 'row', gap: espaco.sm, paddingRight: espaco.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
});
