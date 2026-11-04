import type { LadoDaSecao, MapaEmEdicao, Ponto } from '../../domain/entities/mercados';
import { validarMapa } from '../../domain/services/mapa';
import { ErroDeApi } from '../errors';
import type { MapasCompartilhadosGateway, MercadosGateway, RotasGateway } from '../ports/mercados';

export class ListarMercados {
  constructor(private readonly gateway: MercadosGateway) {}
  executar() {
    return this.gateway.listar();
  }
}

export class ObterMercado {
  constructor(private readonly gateway: MercadosGateway) {}
  executar(id: string) {
    return this.gateway.obter(id);
  }
}

export class CriarMercado {
  constructor(private readonly gateway: MercadosGateway) {}

  async executar(nome: string, cidade: string, copiarDeMercadoId?: string) {
    const limpo = nome.trim();
    if (!limpo) throw new ErroDeApi('Informe o nome do mercado.', 400);
    if (limpo.length > 120) throw new ErroDeApi('O nome pode ter no máximo 120 caracteres.', 400);
    const cidadeLimpa = cidade.trim();
    if (!cidadeLimpa) throw new ErroDeApi('Informe a cidade do mercado.', 400);
    if (cidadeLimpa.length > 80) {
      throw new ErroDeApi('A cidade pode ter no máximo 80 caracteres.', 400);
    }
    return this.gateway.criar(limpo, cidadeLimpa, copiarDeMercadoId);
  }
}

/** Confere o mapa no aparelho (resposta rápida) antes de enviar; a API confere de novo. */
export class SalvarMapaDoMercado {
  constructor(private readonly gateway: MercadosGateway) {}

  async executar(id: string, mapa: MapaEmEdicao, versao: number) {
    const problema = validarMapa(mapa);
    if (problema) throw new ErroDeApi(problema, 400);
    return this.gateway.salvarMapa(
      id,
      { ...mapa, nome: mapa.nome.trim(), cidade: mapa.cidade.trim() },
      versao,
    );
  }
}

export class ExcluirMercado {
  constructor(private readonly gateway: MercadosGateway) {}
  executar(id: string) {
    return this.gateway.excluir(id);
  }
}

/** Rota dentro de um mercado, só com o que ainda falta. Sem posição, sai da entrada. */
export class PlanejarRota {
  constructor(private readonly gateway: RotasGateway) {}
  executar(listaId: string, mercadoId: string, posicao: Ponto | null, usuarioId?: string | null) {
    return this.gateway.planejar(listaId, mercadoId, posicao, usuarioId);
  }
}

/** "Não tem aqui": o item continua pendente, mas sai da rota deste mercado e entra na do próximo. */
export class MarcarItemSemNoMercado {
  constructor(private readonly gateway: RotasGateway) {}
  executar(listaId: string, itemId: string, mercadoId: string, sem: boolean) {
    return this.gateway.marcarSemNoMercado(listaId, itemId, mercadoId, sem);
  }
}

/** "Achei em outro lugar": grava onde o produto fica neste mercado, para a rota e as próximas listas. */
export class DefinirLocalDoItem {
  constructor(private readonly gateway: RotasGateway) {}

  async executar(
    listaId: string,
    itemId: string,
    mercadoId: string,
    locais: { secaoId: string; lado: LadoDaSecao }[],
  ) {
    if (locais.length > 5)
      throw new ErroDeApi('Um produto pode ter até 5 locais por mercado.', 400);
    return this.gateway.definirLocalDoItem(listaId, itemId, mercadoId, locais);
  }
}

export class CompartilharMercado {
  constructor(private readonly gateway: MercadosGateway) {}
  executar(id: string, compartilhada: boolean) {
    return this.gateway.compartilhar(id, compartilhada);
  }
}

export class ListarMapasCompartilhados {
  constructor(private readonly gateway: MapasCompartilhadosGateway) {}
  executar(busca: string, cidade: string) {
    return this.gateway.listar(busca.trim(), cidade.trim());
  }
}

export class ObterMapaCompartilhado {
  constructor(private readonly gateway: MapasCompartilhadosGateway) {}
  executar(id: string) {
    return this.gateway.obter(id);
  }
}

/** Cria no grupo um mercado novo com o desenho do mapa escolhido; o original nunca muda. */
export class CopiarMapaCompartilhado {
  constructor(private readonly gateway: MapasCompartilhadosGateway) {}
  executar(id: string) {
    return this.gateway.copiar(id);
  }
}
