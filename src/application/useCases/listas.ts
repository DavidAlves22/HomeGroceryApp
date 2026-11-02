import type { DadosDeNovaLista, DadosDoItem, ItemDaLista } from '../../domain/entities/tipos';
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
  executar(listaId: string, itemId: string, comprado: boolean) {
    return this.gateway.marcarComprado(listaId, itemId, comprado);
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
