/**
 * Erro com mensagem pronta para mostrar ao usuário (a API já devolve em português).
 * `status` 0 significa que nem chegou ao servidor (sem rede, tempo esgotado).
 */
export class ErroDeApi extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly detalhes: string[] = [],
  ) {
    super(mensagem);
    this.name = 'ErroDeApi';
  }

  get semConexao(): boolean {
    return this.status === 0;
  }

  get naoAutenticado(): boolean {
    return this.status === 401;
  }
}

/** Texto seguro para exibir, sem vazar detalhes técnicos. */
export function mensagemParaUsuario(erro: unknown): string {
  if (erro instanceof ErroDeApi) {
    if (erro.semConexao) return 'Não foi possível falar com o servidor. Verifique sua internet.';
    return erro.detalhes.length > 0 ? erro.detalhes.join(' ') : erro.message;
  }
  return 'Algo deu errado. Tente novamente.';
}
