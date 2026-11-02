import { normalizarCodigo } from '../../domain/entities/grupo';
import type { Sessao } from '../dtos/sessao';
import { ErroDeApi } from '../errors';
import type { ArmazenamentoDeSessao } from '../ports/portas';
import type { GrupoGateway } from '../ports/grupo';

export class ObterGrupo {
  constructor(private readonly gateway: GrupoGateway) {}
  executar() {
    return this.gateway.obter();
  }
}

export class RenomearGrupo {
  constructor(private readonly gateway: GrupoGateway) {}
  async executar(nome: string) {
    const limpo = nome.trim();
    if (limpo.length === 0) throw new ErroDeApi('Informe o nome do grupo.', 400);
    if (limpo.length > 120) throw new ErroDeApi('O nome pode ter no máximo 120 caracteres.', 400);
    return this.gateway.renomear(limpo);
  }
}

export class CriarConvite {
  constructor(private readonly gateway: GrupoGateway) {}
  executar() {
    return this.gateway.criarConvite();
  }
}

/**
 * Entrar na família com um código. A API devolve uma sessão NOVA (já apontando para o grupo novo), que é
 * guardada aqui para o app inteiro passar a usar o grupo certo.
 */
export class EntrarEmGrupo {
  constructor(
    private readonly gateway: GrupoGateway,
    private readonly armazenamento: ArmazenamentoDeSessao,
  ) {}

  async executar(codigo: string): Promise<Sessao> {
    const normalizado = normalizarCodigo(codigo);
    if (normalizado.length !== 8) {
      throw new ErroDeApi('O código tem 8 letras e números, como K7M2-XQ9P.', 400);
    }
    const sessao = await this.gateway.entrar(normalizado);
    await this.armazenamento.salvar(sessao);
    return sessao;
  }
}

export class SairDoGrupo {
  constructor(
    private readonly gateway: GrupoGateway,
    private readonly armazenamento: ArmazenamentoDeSessao,
  ) {}

  async executar(): Promise<Sessao> {
    const sessao = await this.gateway.sair();
    await this.armazenamento.salvar(sessao);
    return sessao;
  }
}

export class RemoverMembroDoGrupo {
  constructor(private readonly gateway: GrupoGateway) {}
  executar(usuarioId: string) {
    return this.gateway.removerMembro(usuarioId);
  }
}
