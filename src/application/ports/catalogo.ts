import type {
  Categoria,
  DadosDeNovaLista,
  DadosDoItem,
  ItemDaLista,
  ItemDoModelo,
  Lista,
  ListaResumo,
  Produto,
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
  adicionarItem(listaId: string, dados: DadosDoItem): Promise<ItemDaLista>;
  editarItem(
    listaId: string,
    itemId: string,
    dados: DadosDoItem,
    versao: number,
  ): Promise<ItemDaLista>;
  removerItem(listaId: string, itemId: string): Promise<void>;
  reordenarItens(listaId: string, ids: string[]): Promise<void>;
  marcarComprado(listaId: string, itemId: string, comprado: boolean): Promise<ItemDaLista>;
  finalizar(listaId: string): Promise<ListaResumo>;
  reabrir(listaId: string): Promise<ListaResumo>;
}
