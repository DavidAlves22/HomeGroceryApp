import { ErroDeApi } from '../errors';
import type { AdminGateway } from '../ports/admin';

export const JANELAS_DO_PAINEL = [7, 30, 90] as const;

/** A API responde 403 sem corpo a quem não é admin; aqui vira uma frase que a tela pode mostrar. */
async function comAvisoDeAcessoNegado<T>(chamada: () => Promise<T>): Promise<T> {
  try {
    return await chamada();
  } catch (erro) {
    if (erro instanceof ErroDeApi && erro.status === 403) {
      throw new ErroDeApi('Esta conta não tem acesso ao painel do administrador.', 403);
    }
    throw erro;
  }
}

export class ObterResumoDoPainel {
  constructor(private readonly gateway: AdminGateway) {}
  executar() {
    return comAvisoDeAcessoNegado(() => this.gateway.resumo());
  }
}

export class ObterSeriesDoPainel {
  constructor(private readonly gateway: AdminGateway) {}

  /** A API também ajusta, mas pedir fora da lista já seria erro de tela: cai no padrão de 30 dias. */
  executar(dias = 30) {
    const valida = (JANELAS_DO_PAINEL as readonly number[]).includes(dias) ? dias : 30;
    return comAvisoDeAcessoNegado(() => this.gateway.series(valida));
  }
}

export class ListarUsuariosDoPainel {
  constructor(private readonly gateway: AdminGateway) {}
  executar(pagina = 1) {
    return comAvisoDeAcessoNegado(() => this.gateway.usuarios(Math.max(1, Math.floor(pagina))));
  }
}
