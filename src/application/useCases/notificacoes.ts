import { ErroDeApi } from '../errors';
import type { AvisosDoDispositivo, NotificacoesGateway } from '../ports/notificacoes';

/**
 * indisponivel: este aparelho ou este servidor não fazem avisos; bloqueado: o usuário negou no navegador;
 * desligado: pode ligar; ligado: este aparelho já recebe os avisos.
 */
export type EstadoDosAvisos = 'indisponivel' | 'bloqueado' | 'desligado' | 'ligado';

export class ObterEstadoDosAvisos {
  constructor(
    private readonly dispositivo: AvisosDoDispositivo,
    private readonly gateway: NotificacoesGateway,
  ) {}

  async executar(): Promise<EstadoDosAvisos> {
    if (!this.dispositivo.suportado()) return 'indisponivel';
    if ((await this.gateway.obterChave()) === null) return 'indisponivel';
    if (this.dispositivo.permissao() === 'negada') return 'bloqueado';
    return (await this.dispositivo.assinaturaAtual()) ? 'ligado' : 'desligado';
  }
}

export class LigarAvisos {
  constructor(
    private readonly dispositivo: AvisosDoDispositivo,
    private readonly gateway: NotificacoesGateway,
  ) {}

  /** Pede a permissão, assina neste aparelho e cadastra no servidor. Devolve o novo estado. */
  async executar(): Promise<EstadoDosAvisos> {
    const chave = await this.gateway.obterChave();
    if (!chave) return 'indisponivel';
    const assinatura = await this.dispositivo.assinar(chave);
    if (!assinatura) return 'bloqueado';
    await this.gateway.assinar(assinatura);
    return 'ligado';
  }
}

export class DesligarAvisos {
  constructor(
    private readonly dispositivo: AvisosDoDispositivo,
    private readonly gateway: NotificacoesGateway,
  ) {}

  async executar(): Promise<EstadoDosAvisos> {
    const endpoint = await this.dispositivo.cancelar();
    if (endpoint) {
      try {
        await this.gateway.cancelar(endpoint);
      } catch (e) {
        // O aparelho já parou de receber; se o servidor não ouviu agora, ele descarta a assinatura morta no próximo envio.
        if (!(e instanceof ErroDeApi)) throw e;
      }
    }
    return 'desligado';
  }
}
