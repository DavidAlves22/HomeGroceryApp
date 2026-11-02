import type { MercadosGateway, RotasGateway } from '../../application/ports/mercados';
import type {
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

  criar(nome: string, copiarDeMercadoId?: string) {
    return this.http.post<Mercado>('/lojas', {
      corpo: { nome, copiarDeLojaId: copiarDeMercadoId },
    });
  }

  salvarMapa(id: string, mapa: MapaEmEdicao, versao: number) {
    // As ids das seções são sempre da API: o que o editor usa antes de salvar é provisório.
    const secoes = mapa.secoes.map(({ id: _id, ...resto }) => resto);
    return this.http.put<Mercado>(`/lojas/${id}/mapa`, { corpo: { ...mapa, secoes, versao } });
  }

  async excluir(id: string) {
    await this.http.delete<void>(`/lojas/${id}`);
  }
}

export class RotasApiGateway implements RotasGateway {
  constructor(private readonly http: ClienteHttp) {}

  planejar(listaId: string, mercadoId: string, posicao: Ponto | null) {
    return this.http.post<Rota>(`/listas/${listaId}/rota`, {
      corpo: { lojaId: mercadoId, posicao },
    });
  }

  marcarSemNoMercado(listaId: string, itemId: string, mercadoId: string, sem: boolean) {
    return this.http.put<ItemDaLista>(`/listas/${listaId}/itens/${itemId}/sem-na-loja`, {
      corpo: { lojaId: mercadoId, sem },
    });
  }
}
