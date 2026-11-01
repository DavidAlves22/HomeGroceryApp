import type { DadosDeCadastro, DadosDeLogin, Sessao } from '../../application/dtos/sessao';
import type { AutenticacaoGateway, ServidorGateway } from '../../application/ports/portas';
import type { ClienteHttp } from '../http/ClienteHttp';

export class AutenticacaoApiGateway implements AutenticacaoGateway {
  constructor(private readonly http: ClienteHttp) {}

  cadastrar(dados: DadosDeCadastro): Promise<Sessao> {
    return this.http.post<Sessao>('/autenticacao/cadastro', { corpo: dados, autenticado: false });
  }

  entrar(dados: DadosDeLogin): Promise<Sessao> {
    return this.http.post<Sessao>('/autenticacao/login', { corpo: dados, autenticado: false });
  }

  renovar(tokenDeRenovacao: string): Promise<Sessao> {
    return this.http.post<Sessao>('/autenticacao/renovar', {
      corpo: { tokenDeRenovacao },
      autenticado: false,
    });
  }
}

export class ServidorApiGateway implements ServidorGateway {
  constructor(private readonly http: ClienteHttp) {}

  async verificarSaude(sinal?: AbortSignal): Promise<boolean> {
    const resposta = await this.http.get<{ status: string }>('/saude', {
      autenticado: false,
      sinal,
      tempoLimiteMs: 70000,
    });
    return resposta.status === 'ok';
  }
}
