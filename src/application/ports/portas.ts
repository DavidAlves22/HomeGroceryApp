import type { DadosDeCadastro, DadosDeLogin, Sessao } from '../dtos/sessao';

/** Fala com o servidor sobre contas. A implementação HTTP fica na infraestrutura. */
export interface AutenticacaoGateway {
  cadastrar(dados: DadosDeCadastro): Promise<Sessao>;
  entrar(dados: DadosDeLogin): Promise<Sessao>;
  renovar(tokenDeRenovacao: string): Promise<Sessao>;
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
