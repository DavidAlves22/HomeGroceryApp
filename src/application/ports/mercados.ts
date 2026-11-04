import type {
  LadoDaSecao,
  LocalDoItem,
  MapaCompartilhado,
  MapaCompartilhadoDetalhe,
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
  /** Em branco ou copiando o layout de outro mercado. A cidade é obrigatória. */
  criar(nome: string, cidade: string, copiarDeMercadoId?: string): Promise<Mercado>;
  /** O mapa é salvo por inteiro; a resposta traz as ids definitivas das seções. */
  salvarMapa(id: string, mapa: MapaEmEdicao, versao: number): Promise<Mercado>;
  excluir(id: string): Promise<void>;
  /** Liga/desliga a presença do mapa no catálogo de mapas compartilhados. */
  compartilhar(id: string, compartilhada: boolean): Promise<MercadoResumo>;
}

/** Mapas de mercado de todos os grupos: só se vê e se copia (a cópia vira um mercado do grupo, editável). */
export interface MapasCompartilhadosGateway {
  /** `busca` filtra pelo nome do mercado e `cidade` pela cidade (sem acento nem maiúscula). */
  listar(busca: string, cidade: string): Promise<MapaCompartilhado[]>;
  obter(id: string): Promise<MapaCompartilhadoDetalhe>;
  copiar(id: string): Promise<Mercado>;
}

export interface RotasGateway {
  /** `usuarioId`: rota só dessa pessoa (o que outra pessoa vai pegar sai). Ausente = rota de todos. */
  planejar(
    listaId: string,
    mercadoId: string,
    posicao: Ponto | null,
    usuarioId?: string | null,
  ): Promise<Rota>;
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
