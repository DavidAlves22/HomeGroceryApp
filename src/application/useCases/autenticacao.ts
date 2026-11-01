import type { DadosDeCadastro, DadosDeLogin, Sessao } from '../dtos/sessao';
import { ErroDeApi } from '../errors';
import type { ArmazenamentoDeSessao, AutenticacaoGateway } from '../ports/portas';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida no aparelho antes de gastar uma ida ao servidor. A API valida de novo (nunca confiar só no cliente). */
function validarCadastro(dados: DadosDeCadastro): string[] {
  const erros: string[] = [];
  if (dados.nome.trim().length < 2) erros.push('Informe seu nome.');
  if (!EMAIL.test(dados.email.trim())) erros.push('Informe um e-mail válido.');
  if (dados.senha.length < 8) erros.push('A senha precisa ter ao menos 8 caracteres.');
  else if (!/\d/.test(dados.senha)) erros.push('A senha precisa ter ao menos um número.');
  return erros;
}

export class CadastrarUsuario {
  constructor(
    private readonly gateway: AutenticacaoGateway,
    private readonly armazenamento: ArmazenamentoDeSessao,
  ) {}

  async executar(dados: DadosDeCadastro): Promise<Sessao> {
    const erros = validarCadastro(dados);
    if (erros.length > 0) throw new ErroDeApi(erros[0], 400, erros);

    const sessao = await this.gateway.cadastrar({
      nome: dados.nome.trim(),
      email: dados.email.trim().toLowerCase(),
      senha: dados.senha,
    });
    await this.armazenamento.salvar(sessao);
    return sessao;
  }
}

export class EntrarNaConta {
  constructor(
    private readonly gateway: AutenticacaoGateway,
    private readonly armazenamento: ArmazenamentoDeSessao,
  ) {}

  async executar(dados: DadosDeLogin): Promise<Sessao> {
    if (!EMAIL.test(dados.email.trim()) || dados.senha.length === 0) {
      throw new ErroDeApi('Informe e-mail e senha.', 400);
    }
    const sessao = await this.gateway.entrar({
      email: dados.email.trim().toLowerCase(),
      senha: dados.senha,
    });
    await this.armazenamento.salvar(sessao);
    return sessao;
  }
}

/**
 * Ao abrir o app: se há sessão guardada, renova (confirma que ainda vale e já pega tokens novos).
 * Sessão expirada ou revogada apaga o que estava guardado e devolve null (volta para o login).
 * Se o servidor estiver fora do ar, o erro sobe: a tela de conexão trata, e a sessão é preservada.
 */
export class RestaurarSessao {
  constructor(
    private readonly gateway: AutenticacaoGateway,
    private readonly armazenamento: ArmazenamentoDeSessao,
  ) {}

  async executar(): Promise<Sessao | null> {
    const guardada = await this.armazenamento.ler();
    if (!guardada) return null;

    try {
      const nova = await this.gateway.renovar(guardada.tokenDeRenovacao);
      await this.armazenamento.salvar(nova);
      return nova;
    } catch (erro) {
      if (erro instanceof ErroDeApi && erro.naoAutenticado) {
        await this.armazenamento.limpar();
        return null;
      }
      throw erro;
    }
  }
}

export class SairDaConta {
  constructor(private readonly armazenamento: ArmazenamentoDeSessao) {}

  async executar(): Promise<void> {
    await this.armazenamento.limpar();
  }
}

/** Health check de abertura: true se o servidor respondeu. Nunca lança; "fora do ar" é um resultado, não um erro. */
export class VerificarServidor {
  constructor(
    private readonly servidor: { verificarSaude(sinal?: AbortSignal): Promise<boolean> },
  ) {}

  async executar(sinal?: AbortSignal): Promise<boolean> {
    try {
      return await this.servidor.verificarSaude(sinal);
    } catch {
      return false;
    }
  }
}
