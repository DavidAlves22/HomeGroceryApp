import type { DadosDoItem } from '../../domain/entities/tipos';
import { ErroDeApi } from '../errors';
import type { CatalogoGateway } from '../ports/catalogo';

/** Valida no aparelho antes de gastar uma ida ao servidor; a API valida de novo. */
export function validarDadosDoItem(dados: DadosDoItem): DadosDoItem {
  const nome = dados.nome.trim();
  if (nome.length === 0) throw new ErroDeApi('Informe o nome do produto.', 400);
  if (nome.length > 120) throw new ErroDeApi('O nome pode ter no máximo 120 caracteres.', 400);
  if (!dados.categoriaId) throw new ErroDeApi('Escolha uma categoria.', 400);
  if (!(dados.quantidade > 0)) throw new ErroDeApi('Informe uma quantidade maior que zero.', 400);
  if (dados.quantidadeComprada != null && !(dados.quantidadeComprada > 0)) {
    throw new ErroDeApi('A quantidade comprada precisa ser maior que zero.', 400);
  }
  for (const preco of [dados.precoEstimado, dados.precoUnitario]) {
    if (preco != null && (preco < 0 || preco > 999999.99)) {
      throw new ErroDeApi('O preço deve estar entre R$ 0,00 e R$ 999.999,99.', 400);
    }
  }
  return { ...dados, nome };
}

function validarNomeDeCategoria(nome: string): string {
  const limpo = nome.trim();
  if (limpo.length === 0) throw new ErroDeApi('Informe o nome da categoria.', 400);
  if (limpo.length > 120) throw new ErroDeApi('O nome pode ter no máximo 120 caracteres.', 400);
  return limpo;
}

export class ListarCategorias {
  constructor(private readonly gateway: CatalogoGateway) {}
  executar() {
    return this.gateway.listarCategorias();
  }
}

export class CriarCategoria {
  constructor(private readonly gateway: CatalogoGateway) {}
  async executar(nome: string) {
    return this.gateway.criarCategoria(validarNomeDeCategoria(nome));
  }
}

export class RenomearCategoria {
  constructor(private readonly gateway: CatalogoGateway) {}
  async executar(id: string, nome: string) {
    return this.gateway.renomearCategoria(id, validarNomeDeCategoria(nome));
  }
}

export class ExcluirCategoria {
  constructor(private readonly gateway: CatalogoGateway) {}
  executar(id: string) {
    return this.gateway.excluirCategoria(id);
  }
}

export class ReordenarCategorias {
  constructor(private readonly gateway: CatalogoGateway) {}
  executar(ids: string[]) {
    return this.gateway.reordenarCategorias(ids);
  }
}

/** Sugestões de produtos já cadastrados enquanto o usuário digita (evita "Arroz" e "arroz" duplicados). */
export class BuscarProdutos {
  constructor(private readonly gateway: CatalogoGateway) {}
  async executar(termo: string) {
    return termo.trim().length < 2 ? [] : this.gateway.buscarProdutos(termo.trim());
  }
}

export class ListarItensDoModelo {
  constructor(private readonly gateway: CatalogoGateway) {}
  executar(termo?: string) {
    return this.gateway.listarItensDoModelo(termo?.trim() || undefined);
  }
}

export class AdicionarItemAoModelo {
  constructor(private readonly gateway: CatalogoGateway) {}
  async executar(dados: DadosDoItem) {
    return this.gateway.adicionarItemAoModelo(validarDadosDoItem(dados));
  }
}

export class EditarItemDoModelo {
  constructor(private readonly gateway: CatalogoGateway) {}
  async executar(id: string, dados: DadosDoItem) {
    return this.gateway.editarItemDoModelo(id, validarDadosDoItem(dados));
  }
}

export class RemoverItemDoModelo {
  constructor(private readonly gateway: CatalogoGateway) {}
  executar(id: string) {
    return this.gateway.removerItemDoModelo(id);
  }
}

export class ReordenarItensDoModelo {
  constructor(private readonly gateway: CatalogoGateway) {}
  executar(ids: string[]) {
    return this.gateway.reordenarItensDoModelo(ids);
  }
}
