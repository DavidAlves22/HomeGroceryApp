import type {
  DadosDeCadastro,
  DadosDeLogin,
  DadosDeRedefinicaoDeSenha,
  Sessao,
  Usuario,
} from '../dtos/sessao';

/** Fala com o servidor sobre contas. A implementação HTTP fica na infraestrutura. */
export interface AutenticacaoGateway {
  cadastrar(dados: DadosDeCadastro): Promise<Sessao>;
  entrar(dados: DadosDeLogin): Promise<Sessao>;
  renovar(tokenDeRenovacao: string): Promise<Sessao>;
  /** O servidor consegue enviar e-mail? Sem isso o app nem mostra "Esqueci minha senha". */
  recuperacaoDisponivel(): Promise<boolean>;
  /** Pede o código por e-mail. A resposta é a mesma exista ou não a conta (ninguém descobre e-mails cadastrados). */
  pedirCodigoDeRecuperacao(email: string): Promise<void>;
  redefinirSenha(dados: DadosDeRedefinicaoDeSenha): Promise<void>;
  /** Client ID público do login com Google; null = o servidor não tem o login com Google ligado. */
  googleClienteId(): Promise<string | null>;
  /** Entra (ou cria a conta) com o ID token que o botão do Google entregou. */
  entrarComGoogle(idToken: string): Promise<Sessao>;
  /** Troca o nome de quem está logado. */
  alterarNome(nome: string): Promise<Usuario>;
  /** Apaga a conta e os dados dela no servidor. `senha` vazia vale só para conta do Google sem senha própria. */
  encerrarConta(dados: { confirmacaoEmail: string; senha?: string }): Promise<void>;
}

/** Pergunta ao servidor se ele está de pé (health check feito ao abrir o app). */
export interface ServidorGateway {
  verificarSaude(sinal?: AbortSignal): Promise<boolean>;
}

/** Guarda a sessão no aparelho para o usuário não precisar entrar toda vez. */
export interface ArmazenamentoDeSessao {
  ler(): Promise<Sessao | null>;
  salvar(sessao: Sessao): Promise<void>;
  limpar(): Promise<void>;
}
