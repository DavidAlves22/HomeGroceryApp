export interface Usuario {
  id: string;
  nome: string;
  email: string;
}

/** Sessão devolvida pela API ao entrar, cadastrar ou renovar. */
export interface Sessao {
  tokenDeAcesso: string;
  expiraEm: string;
  tokenDeRenovacao: string;
  usuario: Usuario;
  grupoId: string;
  /** Só mostra o atalho do painel; quem protege as rotas é a API. Sessões guardadas antes do painel não têm o campo. */
  ehAdmin?: boolean;
}

export interface DadosDeCadastro {
  nome: string;
  email: string;
  senha: string;
}

export interface DadosDeLogin {
  email: string;
  senha: string;
}

export interface DadosDeRedefinicaoDeSenha {
  email: string;
  /** Os 6 dígitos que chegaram por e-mail. */
  codigo: string;
  novaSenha: string;
}
