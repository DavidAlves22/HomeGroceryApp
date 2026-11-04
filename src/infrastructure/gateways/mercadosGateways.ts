import type {
  MapasCompartilhadosGateway,
  MercadosGateway,
  RotasGateway,
} from '../../application/ports/mercados';
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
import type { ClienteHttp } from '../http/ClienteHttp';

/** Os nomes dos campos da API e do app coincidem (a API fala "loja"; o app fala "mercado"). */
export class MercadosApiGateway implements MercadosGateway {
  constructor(private readonly http: ClienteHttp) {}

  listar() {
    return this.http.get<MercadoResumo[]>('/lojas');
  }

  obter(id: string) {
    return this.http.get<Mercado>(`/lojas/${id}`);
  }

  criar(nome: string, cidade: string, copiarDeMercadoId?: string) {
    return this.http.post<Mercado>('/lojas', {
      corpo: { nome, cidade, copiarDeLojaId: copiarDeMercadoId },
    });
  }

  salvarMapa(id: string, mapa: MapaEmEdicao, versao: number) {
    // As ids das seções são sempre da API e mudam a cada salvamento. A id anterior (só das seções que já
    // vieram do servidor) deixa a API manter os locais que o usuário marcou para produtos.
    const secoes = mapa.secoes.map(({ id, ...resto }) => ({
      ...resto,
      idAnterior: id.startsWith('local-') ? undefined : id,
    }));
    return this.http.put<Mercado>(`/lojas/${id}/mapa`, { corpo: { ...mapa, secoes, versao } });
  }

  async excluir(id: string) {
    await this.http.delete<void>(`/lojas/${id}`);
  }
}

export class MapasCompartilhadosApiGateway implements MapasCompartilhadosGateway {
  constructor(private readonly http: ClienteHttp) {}

  listar(busca: string, cidade: string) {
    const filtros = new URLSearchParams();
    if (busca) filtros.set('busca', busca);
    if (cidade) filtros.set('cidade', cidade);
    const consulta = filtros.toString();
    return this.http.get<MapaCompartilhado[]>(
      `/catalogo/mercados${consulta ? `?${consulta}` : ''}`,
    );
  }

  obter(id: string) {
    return this.http.get<MapaCompartilhadoDetalhe>(`/catalogo/mercados/${id}`);
  }

  copiar(id: string) {
    return this.http.post<Mercado>(`/catalogo/mercados/${id}/copiar`);
  }
}

export class RotasApiGateway implements RotasGateway {
  constructor(private readonly http: ClienteHttp) {}

  planejar(listaId: string, mercadoId: string, posicao: Ponto | null, usuarioId?: string | null) {
    return this.http.post<Rota>(`/listas/${listaId}/rota`, {
      corpo: { lojaId: mercadoId, posicao, usuarioId: usuarioId ?? null },
    });
  }

  marcarSemNoMercado(listaId: string, itemId: string, mercadoId: string, sem: boolean) {
    return this.http.put<ItemDaLista>(`/listas/${listaId}/itens/${itemId}/sem-na-loja`, {
      corpo: { lojaId: mercadoId, sem },
    });
  }

  definirLocalDoItem(
    listaId: string,
    itemId: string,
    mercadoId: string,
    locais: { secaoId: string; lado: LadoDaSecao }[],
  ) {
    return this.http.put<LocalDoItem[]>(`/listas/${listaId}/itens/${itemId}/local`, {
      corpo: { lojaId: mercadoId, locais },
    });
  }
}
