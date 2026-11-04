import type {
  DadosDeCadastro,
  DadosDeLogin,
  DadosDeRedefinicaoDeSenha,
  Sessao,
} from '../dtos/sessao';
import { ErroDeApi } from '../errors';
import type { ArmazenamentoDeSessao, AutenticacaoGateway } from '../ports/portas';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida no aparelho antes de gastar uma ida ao servidor. A API valida de novo (nunca confiar só no cliente). */
function validarCadastro(dados: DadosDeCadastro): string[] {
  const erros: string[] = [];
  if (dados.nome.trim().length < 2) erros.push('Informe seu nome.');
  if (!EMAIL.test(dados.email.trim())) erros.push('Informe um e-mail válido.');
  const erroDeSenha = erroDaSenha(dados.senha);
  if (erroDeSenha) erros.push(erroDeSenha);
  return erros;
}

/** A regra de senha (a API valida de novo): ao menos 8 caracteres e um número. */
function erroDaSenha(senha: string): string | null {
  if (senha.length < 8) return 'A senha precisa ter ao menos 8 caracteres.';
  if (!/\d/.test(senha)) return 'A senha precisa ter ao menos um número.';
  return null;
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

/** Mostra "Esqueci minha senha" só quando o servidor consegue enviar e-mail. Nunca lança: na dúvida, esconde. */
export class ConsultarRecuperacaoDeSenha {
  constructor(private readonly gateway: AutenticacaoGateway) {}

  async executar(): Promise<boolean> {
    try {
      return await this.gateway.recuperacaoDisponivel();
    } catch {
      return false;
    }
  }
}

export class PedirCodigoDeRecuperacao {
  constructor(private readonly gateway: AutenticacaoGateway) {}

  async executar(email: string): Promise<void> {
    if (!EMAIL.test(email.trim())) throw new ErroDeApi('Informe um e-mail válido.', 400);
    await this.gateway.pedirCodigoDeRecuperacao(email.trim().toLowerCase());
  }
}

export class RedefinirSenha {
  constructor(private readonly gateway: AutenticacaoGateway) {}

  async executar(dados: DadosDeRedefinicaoDeSenha): Promise<void> {
    const codigo = dados.codigo.replace(/\D/g, '');
    if (codigo.length !== 6)
      throw new ErroDeApi('Digite o código de 6 dígitos que chegou por e-mail.', 400);
    const erroDeSenha = erroDaSenha(dados.novaSenha);
    if (erroDeSenha) throw new ErroDeApi(erroDeSenha, 400);
    await this.gateway.redefinirSenha({
      email: dados.email.trim().toLowerCase(),
      codigo,
      novaSenha: dados.novaSenha,
    });
  }
}

/** Troca o nome de quem está logado e já atualiza a sessão guardada no aparelho (devolve a sessão com o nome novo). */
export class AlterarNomeDoUsuario {
  constructor(
    private readonly gateway: AutenticacaoGateway,
    private readonly armazenamento: ArmazenamentoDeSessao,
  ) {}

  async executar(nome: string): Promise<Sessao> {
    const limpo = nome.trim();
    if (limpo.length < 2 || limpo.length > 80) {
      throw new ErroDeApi('Informe um nome entre 2 e 80 caracteres.', 400);
    }
    const sessao = await this.armazenamento.ler();
    if (!sessao) throw new ErroDeApi('Sessão expirada. Entre novamente.', 401);

    const usuario = await this.gateway.alterarNome(limpo);
    const atualizada: Sessao = { ...sessao, usuario: { ...sessao.usuario, nome: usuario.nome } };
    await this.armazenamento.salvar(atualizada);
    return atualizada;
  }
}

/** Mostra "Entrar com Google" só quando o servidor tem o Client ID. Nunca lança: na dúvida, esconde. */
export class ConsultarLoginComGoogle {
  constructor(private readonly gateway: AutenticacaoGateway) {}

  async executar(): Promise<string | null> {
    try {
      return await this.gateway.googleClienteId();
    } catch {
      return null;
    }
  }
}

export class EntrarComGoogle {
  constructor(
    private readonly gateway: AutenticacaoGateway,
    private readonly armazenamento: ArmazenamentoDeSessao,
  ) {}

  async executar(idToken: string): Promise<Sessao> {
    if (!idToken) throw new ErroDeApi('Não foi possível entrar com o Google. Tente de novo.', 400);
    const sessao = await this.gateway.entrarComGoogle(idToken);
    await this.armazenamento.salvar(sessao);
    return sessao;
  }
}
