import type { AssinaturaDeAvisos, NotificacoesGateway } from '../../application/ports/notificacoes';
import { ErroDeApi } from '../../application/errors';
import type { ClienteHttp } from '../http/ClienteHttp';

export class NotificacoesApiGateway implements NotificacoesGateway {
  constructor(private readonly http: ClienteHttp) {}

  async obterChave() {
    try {
      const resposta = await this.http.get<{ chavePublica: string }>('/notificacoes/chave');
      return resposta.chavePublica;
    } catch (e) {
      // 404 = o servidor não tem os avisos ligados (sem chaves configuradas).
      if (e instanceof ErroDeApi && e.status === 404) return null;
      throw e;
    }
  }

  async assinar(assinatura: AssinaturaDeAvisos) {
    await this.http.put<void>('/notificacoes/assinatura', { corpo: assinatura });
  }

  async cancelar(endpoint: string) {
    await this.http.post<void>('/notificacoes/assinatura/cancelar', { corpo: { endpoint } });
  }
}
