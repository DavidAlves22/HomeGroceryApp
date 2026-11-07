import type { AnalisesGateway } from '../../application/ports/analises';
import type { CatalogoGateway, ListasGateway } from '../../application/ports/catalogo';
import type {
  AnaliseDeGastos,
  AnaliseDePrecos,
  AvisosDeRitmo,
  HabitosDeCompra,
  PadroesDeCompra,
} from '../../domain/entities/analises';
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
  NomeComum,
  Produto,
  SugestaoDeLista,
  VinculoDaNota,
} from '../../domain/entities/tipos';
import type { ClienteHttp } from '../http/ClienteHttp';

/** Os nomes dos campos da API e do app coincidem, então só falta ajustar a tela de "quantidade". */
export class CatalogoApiGateway implements CatalogoGateway {
  constructor(private readonly http: ClienteHttp) {}

  listarCategorias() {
    return this.http.get<Categoria[]>('/categorias');
  }

  criarCategoria(nome: string) {
    return this.http.post<Categoria>('/categorias', { corpo: { nome } });
  }

  renomearCategoria(id: string, nome: string) {
    return this.http.put<Categoria>(`/categorias/${id}`, { corpo: { nome } });
  }

  async excluirCategoria(id: string) {
    await this.http.delete<void>(`/categorias/${id}`);
  }

  reordenarCategorias(ids: string[]) {
    return this.http.put<Categoria[]>('/categorias/ordem', { corpo: { ids } });
  }

  buscarProdutos(termo: string) {
    return this.http.get<Produto[]>(`/produtos?q=${encodeURIComponent(termo)}`);
  }

  buscarNomesComuns(termo: string) {
    return this.http.get<NomeComum[]>(`/produtos/nomes-comuns?q=${encodeURIComponent(termo)}`);
  }

  listarProdutos() {
    return this.http.get<Produto[]>('/produtos');
  }

  sugestoesDeProdutos() {
    return this.http.get<Produto[]>('/produtos/sugestoes');
  }

  alternarFavorito(id: string, favorito: boolean) {
    return this.http.put<Produto>(`/produtos/${id}/favorito`, { corpo: { favorito } });
  }

  renomearProduto(produto: Produto, nome: string) {
    return this.http.put<Produto>(`/produtos/${produto.id}`, {
      corpo: {
        nome,
        categoriaId: produto.categoriaId,
        unidadePadrao: produto.unidadePadrao,
        descricao: produto.descricao,
      },
    });
  }

  async excluirProduto(id: string) {
    await this.http.delete<void>(`/produtos/${id}`);
  }

  listarItensDoModelo(termo?: string) {
    return this.http.get<ItemDoModelo[]>(
      termo ? `/modelo/itens?q=${encodeURIComponent(termo)}` : '/modelo/itens',
    );
  }

  adicionarItemAoModelo(dados: DadosDoItem) {
    return this.http.post<ItemDoModelo>('/modelo/itens', { corpo: dados });
  }

  editarItemDoModelo(id: string, dados: DadosDoItem) {
    return this.http.put<ItemDoModelo>(`/modelo/itens/${id}`, { corpo: dados });
  }

  async removerItemDoModelo(id: string) {
    await this.http.delete<void>(`/modelo/itens/${id}`);
  }

  async reordenarItensDoModelo(ids: string[]) {
    await this.http.put<void>('/modelo/itens/ordem', { corpo: { ids } });
  }
}

export class ListasApiGateway implements ListasGateway {
  constructor(private readonly http: ClienteHttp) {}

  listar() {
    return this.http.get<ListaResumo[]>('/listas');
  }

  obter(id: string) {
    return this.http.get<Lista>(`/listas/${id}`);
  }

  criar(dados: DadosDeNovaLista) {
    return this.http.post<Lista>('/listas', { corpo: dados });
  }

  sugerir(competencia: string) {
    return this.http.get<SugestaoDeLista>(`/listas/sugestao?competencia=${competencia}`);
  }

  adicionarItem(listaId: string, dados: DadosDoItem) {
    return this.http.post<ItemDaLista>(`/listas/${listaId}/itens`, { corpo: dados });
  }

  editarItem(listaId: string, itemId: string, dados: DadosDoItem, versao: number) {
    return this.http.put<ItemDaLista>(`/listas/${listaId}/itens/${itemId}`, {
      corpo: { ...dados, versao },
    });
  }

  async removerItem(listaId: string, itemId: string) {
    await this.http.delete<void>(`/listas/${listaId}/itens/${itemId}`);
  }

  async reordenarItens(listaId: string, ids: string[]) {
    await this.http.put<void>(`/listas/${listaId}/itens/ordem`, { corpo: { ids } });
  }

  marcarComprado(listaId: string, itemId: string, comprado: boolean, mercadoId?: string | null) {
    return this.http.put<ItemDaLista>(`/listas/${listaId}/itens/${itemId}/comprado`, {
      corpo: { comprado, lojaId: comprado ? (mercadoId ?? null) : null },
    });
  }

  finalizar(listaId: string) {
    return this.http.post<ListaResumo>(`/listas/${listaId}/finalizar`);
  }

  reabrir(listaId: string) {
    return this.http.post<ListaResumo>(`/listas/${listaId}/reabrir`);
  }

  dividir(listaId: string, divisao: DivisaoDaCategoria[]) {
    return this.http.put<DivisaoDaCategoria[]>(`/listas/${listaId}/divisao`, {
      corpo: { atribuicoes: divisao },
    });
  }

  importarNota(listaId: string, dados: DadosDaNota) {
    return this.http.post<Lista>(`/listas/${listaId}/nota`, {
      corpo: {
        cnpj: dados.cnpj,
        lojaId: dados.mercadoId,
        chaveDeAcesso: dados.chaveDeAcesso ?? null,
        itens: dados.itens,
      },
    });
  }

  vinculosDaNota(cnpj: string) {
    return this.http.get<VinculoDaNota[]>(`/notas/vinculos?cnpj=${encodeURIComponent(cnpj)}`);
  }

  async notaJaImportada(chave: string) {
    const resposta = await this.http.get<{ importada: boolean }>(
      `/notas/importada?chave=${encodeURIComponent(chave)}`,
    );
    return resposta.importada;
  }

  async cancelar(listaId: string) {
    await this.http.delete<void>(`/listas/${listaId}`);
  }
}

export class AnalisesApiGateway implements AnalisesGateway {
  constructor(private readonly http: ClienteHttp) {}

  gastos(meses: number, competencia?: string) {
    const consulta = `meses=${meses}${competencia ? `&competencia=${competencia}` : ''}`;
    return this.http.get<AnaliseDeGastos>(`/analises/gastos?${consulta}`);
  }

  precos() {
    return this.http.get<AnaliseDePrecos>('/analises/precos');
  }

  avisos() {
    return this.http.get<AvisosDeRitmo>('/analises/avisos');
  }

  padroes() {
    return this.http.get<PadroesDeCompra>('/analises/padroes');
  }

  habitos() {
    return this.http.get<HabitosDeCompra>('/analises/habitos');
  }
}
