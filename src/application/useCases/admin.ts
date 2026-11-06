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

export class ObterInsightsDoPainel {
  constructor(private readonly gateway: AdminGateway) {}
  executar() {
    return comAvisoDeAcessoNegado(() => this.gateway.insights());
  }
}

/** Bloqueia (a conta é desconectada na hora e não entra mais) ou libera uma conta. O servidor recusa bloquear administradores. */
export class DefinirBloqueioDeConta {
  constructor(private readonly gateway: AdminGateway) {}
  executar(usuarioId: string, bloqueado: boolean) {
    return comAvisoDeAcessoNegado(() => this.gateway.definirBloqueio(usuarioId, bloqueado));
  }
}

export class ListarUsuariosDoPainel {
  constructor(private readonly gateway: AdminGateway) {}
  executar(pagina = 1) {
    return comAvisoDeAcessoNegado(() => this.gateway.usuarios(Math.max(1, Math.floor(pagina))));
  }
}

/** Apaga a conta de outra pessoa e os dados dela, de vez. O servidor recusa contas de administrador. */
export class ExcluirContaDoPainel {
  constructor(private readonly gateway: AdminGateway) {}
  executar(usuarioId: string) {
    return comAvisoDeAcessoNegado(() => this.gateway.excluirConta(usuarioId));
  }
}

export class ListarMapasDoPainel {
  constructor(private readonly gateway: AdminGateway) {}
  executar() {
    return comAvisoDeAcessoNegado(() => this.gateway.mapas());
  }
}

/** O desenho de um mapa de qualquer grupo, para o administrador decidir se aprova. */
export class ObterMapaDoPainel {
  constructor(private readonly gateway: AdminGateway) {}
  executar(id: string) {
    return comAvisoDeAcessoNegado(() => this.gateway.mapa(id));
  }
}

/** Apaga o mapa de vez (sai do catálogo e do grupo do dono). Cópias que outros já fizeram ficam. */
export class ExcluirMapaDoPainel {
  constructor(private readonly gateway: AdminGateway) {}
  executar(id: string) {
    return comAvisoDeAcessoNegado(() => this.gateway.excluirMapa(id));
  }
}
