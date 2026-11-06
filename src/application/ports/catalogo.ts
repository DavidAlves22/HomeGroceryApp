import type {
  Categoria,
  DadosDeNovaLista,
  DadosDaNota,
  DadosDoItem,
  DivisaoDaCategoria,
  ItemDaLista,
  ItemDoModelo,
  Lista,
  ListaResumo,
  SugestaoDeLista,
  Produto,
  VinculoDaNota,
} from '../../domain/entities/tipos';

export interface CatalogoGateway {
  listarCategorias(): Promise<Categoria[]>;
  criarCategoria(nome: string): Promise<Categoria>;
  renomearCategoria(id: string, nome: string): Promise<Categoria>;
  excluirCategoria(id: string): Promise<void>;
  reordenarCategorias(ids: string[]): Promise<Categoria[]>;
  buscarProdutos(termo: string): Promise<Produto[]>;
  listarProdutos(): Promise<Produto[]>;
  sugestoesDeProdutos(): Promise<Produto[]>;
  alternarFavorito(id: string, favorito: boolean): Promise<Produto>;
  renomearProduto(produto: Produto, nome: string): Promise<Produto>;
  excluirProduto(id: string): Promise<void>;
  listarItensDoModelo(termo?: string): Promise<ItemDoModelo[]>;
  adicionarItemAoModelo(dados: DadosDoItem): Promise<ItemDoModelo>;
  editarItemDoModelo(id: string, dados: DadosDoItem): Promise<ItemDoModelo>;
  removerItemDoModelo(id: string): Promise<void>;
  reordenarItensDoModelo(ids: string[]): Promise<void>;
}

export interface ListasGateway {
  listar(): Promise<ListaResumo[]>;
  obter(id: string): Promise<Lista>;
  criar(dados: DadosDeNovaLista): Promise<Lista>;
  sugerir(competencia: string): Promise<SugestaoDeLista>;
  adicionarItem(listaId: string, dados: DadosDoItem): Promise<ItemDaLista>;
  editarItem(
    listaId: string,
    itemId: string,
    dados: DadosDoItem,
    versao: number,
  ): Promise<ItemDaLista>;
  removerItem(listaId: string, itemId: string): Promise<void>;
  reordenarItens(listaId: string, ids: string[]): Promise<void>;
  /** `mercadoId`: onde foi comprado (a compra do mês pode ser dividida entre mercados). */
  marcarComprado(
    listaId: string,
    itemId: string,
    comprado: boolean,
    mercadoId?: string | null,
  ): Promise<ItemDaLista>;
  finalizar(listaId: string): Promise<ListaResumo>;
  reabrir(listaId: string): Promise<ListaResumo>;
  /** Quem pega cada categoria nesta ida ao mercado; troca a divisão inteira (vazio desfaz). */
  dividir(listaId: string, divisao: DivisaoDaCategoria[]): Promise<DivisaoDaCategoria[]>;
  /** Importa uma nota fiscal já lida: preços e quantidades pagos, itens comprados. Vale também para lista finalizada. */
  importarNota(listaId: string, dados: DadosDaNota): Promise<Lista>;
  vinculosDaNota(cnpj: string): Promise<VinculoDaNota[]>;
  /** A nota (pela chave de acesso do QR) já foi importada neste grupo? */
  notaJaImportada(chave: string): Promise<boolean>;
  /** Apaga a lista em andamento (e os itens) de vez: não fica no histórico. */
  cancelar(listaId: string): Promise<void>;
}
