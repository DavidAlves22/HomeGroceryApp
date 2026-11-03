import type {
  LadoDaSecao,
  LocalDoItem,
  MapaEmEdicao,
  Mercado,
  MercadoResumo,
  Ponto,
  Rota,
} from '../../domain/entities/mercados';
import type { ItemDaLista } from '../../domain/entities/tipos';

export interface MercadosGateway {
  listar(): Promise<MercadoResumo[]>;
  obter(id: string): Promise<Mercado>;
  /** Em branco ou copiando o layout de outro mercado. */
  criar(nome: string, copiarDeMercadoId?: string): Promise<Mercado>;
  /** O mapa é salvo por inteiro; a resposta traz as ids definitivas das seções. */
  salvarMapa(id: string, mapa: MapaEmEdicao, versao: number): Promise<Mercado>;
  excluir(id: string): Promise<void>;
}

export interface RotasGateway {
  planejar(listaId: string, mercadoId: string, posicao: Ponto | null): Promise<Rota>;
  marcarSemNoMercado(
    listaId: string,
    itemId: string,
    mercadoId: string,
    sem: boolean,
  ): Promise<ItemDaLista>;
  /** Substitui onde o produto do item fica neste mercado. Lista vazia apaga. */
  definirLocalDoItem(
    listaId: string,
    itemId: string,
    mercadoId: string,
    locais: { secaoId: string; lado: LadoDaSecao }[],
  ): Promise<LocalDoItem[]>;
}
