import type {
  DadosDaNota,
  DadosDeNovaLista,
  DadosDoItem,
  DivisaoDaCategoria,
  ItemDaLista,
} from '../../domain/entities/tipos';
import { escolherListaAtual, existePrincipalNoMes } from '../../domain/services/organizacao';
import { Competencia } from '../../domain/valueObjects/Competencia';
import { ErroDeApi } from '../errors';
import type { ListasGateway } from '../ports/catalogo';
import { validarDadosDoItem } from './catalogo';

/** Já existe a lista principal do mês: a tela pergunta se o usuário quer criar outra mesmo assim. */
export class ListaPrincipalJaExiste extends Error {
  constructor(readonly competenciaNome: string) {
    super(`Já existe uma lista principal para ${competenciaNome}.`);
    this.name = 'ListaPrincipalJaExiste';
  }
}

export class ListarListas {
  constructor(private readonly gateway: ListasGateway) {}
  executar() {
    return this.gateway.listar();
  }
}

export class ObterLista {
  constructor(private readonly gateway: ListasGateway) {}
  executar(id: string) {
    return this.gateway.obter(id);
  }
}

/** Resolve "a lista do momento" (ver `escolherListaAtual`) e já a carrega. Sem nenhuma, devolve null. */
export class ObterListaAtual {
  constructor(private readonly gateway: ListasGateway) {}
  async executar(hoje: Competencia = Competencia.daData(new Date())) {
    const escolhida = escolherListaAtual(await this.gateway.listar(), hoje);
    return escolhida ? this.gateway.obter(escolhida.id) : null;
  }
}

export class CriarLista {
  constructor(private readonly gateway: ListasGateway) {}

  async executar(dados: DadosDeNovaLista) {
    Competencia.deChave(dados.competencia);

    if (!dados.permitirDuplicada) {
      const existentes = await this.gateway.listar();
      if (existePrincipalNoMes(existentes, dados.competencia)) {
        throw new ListaPrincipalJaExiste(Competencia.deChave(dados.competencia).nome);
      }
    }
    if (dados.origem === 'Copiar' && !dados.listaDeOrigemId) {
      throw new ErroDeApi('Escolha a lista que será copiada.', 400);
    }
    if (dados.origem === 'Copiar' && dados.itensDeOrigemIds?.length === 0) {
      throw new ErroDeApi('Selecione ao menos um produto para copiar.', 400);
    }
    if (dados.origem === 'Padrao' && dados.itensDoModeloIds?.length === 0) {
      throw new ErroDeApi('Selecione ao menos um produto, ou crie a lista do zero.', 400);
    }
    return this.gateway.criar(dados);
  }
}

export class AdicionarItemNaLista {
  constructor(private readonly gateway: ListasGateway) {}
  async executar(listaId: string, dados: DadosDoItem) {
    return this.gateway.adicionarItem(listaId, validarDadosDoItem(dados));
  }
}

export class EditarItemDaLista {
  constructor(private readonly gateway: ListasGateway) {}
  async executar(listaId: string, item: ItemDaLista, dados: DadosDoItem) {
    return this.gateway.editarItem(listaId, item.id, validarDadosDoItem(dados), item.versao);
  }
}

export class RemoverItemDaLista {
  constructor(private readonly gateway: ListasGateway) {}
  executar(listaId: string, itemId: string) {
    return this.gateway.removerItem(listaId, itemId);
  }
}

export class MarcarItemComprado {
  constructor(private readonly gateway: ListasGateway) {}
  executar(listaId: string, itemId: string, comprado: boolean, mercadoId?: string | null) {
    return this.gateway.marcarComprado(listaId, itemId, comprado, mercadoId);
  }
}

export class FinalizarLista {
  constructor(private readonly gateway: ListasGateway) {}
  executar(listaId: string) {
    return this.gateway.finalizar(listaId);
  }
}

export class ReabrirLista {
  constructor(private readonly gateway: ListasGateway) {}
  executar(listaId: string) {
    return this.gateway.reabrir(listaId);
  }
}

/** "Quem pega o quê" nesta ida ao mercado, por categoria. Vale só para esta lista. */
export class DividirCompra {
  constructor(private readonly gateway: ListasGateway) {}
  executar(listaId: string, divisao: DivisaoDaCategoria[]) {
    return this.gateway.dividir(listaId, divisao);
  }
}

/** Importa uma nota fiscal já lida: valida antes de chamar a API (a API valida de novo). */
export class ImportarNota {
  constructor(private readonly gateway: ListasGateway) {}
  async executar(listaId: string, dados: DadosDaNota) {
    if (dados.itens.length === 0) throw new ErroDeApi('Escolha pelo menos um item da nota.', 400);
    for (const item of dados.itens) {
      if (!item.itemId && !item.categoriaId) {
        throw new ErroDeApi(`Escolha a categoria de "${item.nome}".`, 400);
      }
      if (!(item.quantidade > 0) || item.precoUnitario < 0) {
        throw new ErroDeApi(`Quantidade ou preço inválido em "${item.nome}".`, 400);
      }
    }
    return this.gateway.importarNota(listaId, dados);
  }
}

/** "Esta nota já foi importada?", logo depois de ler o QR (antes de pedir o texto da nota). */
export class ConsultarNotaImportada {
  constructor(private readonly gateway: ListasGateway) {}
  executar(chave: string) {
    return this.gateway.notaJaImportada(chave);
  }
}

/** O que o grupo já ensinou para o CNPJ da nota (código do mercado = produto). Sem CNPJ, nada. */
export class ObterVinculosDaNota {
  constructor(private readonly gateway: ListasGateway) {}
  async executar(cnpj: string | null) {
    if (!cnpj || cnpj.replace(/\D/g, '').length !== 14) return [];
    return this.gateway.vinculosDaNota(cnpj.replace(/\D/g, ''));
  }
}

/** Cancelar a compra: a lista some da aba Lista e do histórico, como se o mês fosse reiniciado. */
export class CancelarLista {
  constructor(private readonly gateway: ListasGateway) {}
  executar(listaId: string) {
    return this.gateway.cancelar(listaId);
  }
}

export class ReordenarItensDaLista {
  constructor(private readonly gateway: ListasGateway) {}
  executar(listaId: string, ids: string[]) {
    return this.gateway.reordenarItens(listaId, ids);
  }
}
