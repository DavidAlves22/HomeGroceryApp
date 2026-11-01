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
