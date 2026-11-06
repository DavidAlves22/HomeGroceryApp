import type {
  DadosDeCadastro,
  DadosDeLogin,
  DadosDeRedefinicaoDeSenha,
  Sessao,
  Usuario,
} from '../../application/dtos/sessao';
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

  async recuperacaoDisponivel() {
    const resposta = await this.http.get<{ disponivel: boolean }>('/autenticacao/recuperacao', {
      autenticado: false,
    });
    return resposta.disponivel;
  }

  async pedirCodigoDeRecuperacao(email: string) {
    await this.http.post<void>('/autenticacao/esqueci-senha', {
      corpo: { email },
      autenticado: false,
    });
  }

  async redefinirSenha(dados: DadosDeRedefinicaoDeSenha) {
    await this.http.post<void>('/autenticacao/redefinir-senha', {
      corpo: dados,
      autenticado: false,
    });
  }

  async googleClienteId() {
    const resposta = await this.http.get<{ clienteId: string | null }>('/autenticacao/google', {
      autenticado: false,
    });
    return resposta.clienteId;
  }

  entrarComGoogle(idToken: string) {
    return this.http.post<Sessao>('/autenticacao/login-google', {
      corpo: { idToken },
      autenticado: false,
    });
  }

  alterarNome(nome: string) {
    return this.http.put<Usuario>('/conta/nome', { corpo: { nome } });
  }

  async encerrarConta(dados: { confirmacaoEmail: string; senha?: string }) {
    await this.http.post<void>('/conta/encerrar', { corpo: dados });
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
