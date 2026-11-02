import type { Sessao } from '../../application/dtos/sessao';
import { ErroDeApi } from '../../application/errors';
import type { ArmazenamentoDeSessao } from '../../application/ports/portas';

const TEMPO_LIMITE_MS = 15000;

interface OpcoesDeRequisicao {
  corpo?: unknown;
  /** false nas rotas públicas (login, cadastro, saúde). */
  autenticado?: boolean;
  sinal?: AbortSignal;
  /** Padrão 15 s. O health check usa mais, porque hospedagem gratuita leva até ~1 min para acordar. */
  tempoLimiteMs?: number;
}

interface ProblemaDaApi {
  title?: string;
  detail?: string;
  erros?: string[];
}

/**
 * Único ponto que fala HTTP com a API. Cuida de:
 * - anexar o token de acesso;
 * - renovar a sessão uma vez se a API responder 401 e repetir o pedido (várias chamadas
 *   simultâneas com 401 compartilham UMA renovação, senão a rotação do token de renovação
 *   invalidaria as demais);
 * - transformar falhas em `ErroDeApi` com mensagem amigável (status 0 = sem conexão/tempo esgotado).
 */
export class ClienteHttp {
  private renovacaoEmAndamento: Promise<Sessao | null> | null = null;

  constructor(
    private readonly urlBase: string,
    private readonly armazenamento: ArmazenamentoDeSessao,
    private readonly aoExpirarSessao: () => void = () => {},
  ) {}

  /**
   * Token de acesso válido para quem precisa dele fora do HTTP comum (a conexão em tempo real).
   * Se estiver perto de expirar, renova antes, para a conexão nunca nascer com token vencido.
   */
  async obterTokenDeAcesso(): Promise<string> {
    let sessao = await this.armazenamento.ler();
    if (sessao && new Date(sessao.expiraEm).getTime() - Date.now() < 60_000) {
      sessao = (await this.renovarUmaVez()) ?? sessao;
    }
    return sessao?.tokenDeAcesso ?? '';
  }

  get<T>(caminho: string, opcoes: OpcoesDeRequisicao = {}): Promise<T> {
    return this.requisitar<T>('GET', caminho, opcoes);
  }

  post<T>(caminho: string, opcoes: OpcoesDeRequisicao = {}): Promise<T> {
    return this.requisitar<T>('POST', caminho, opcoes);
  }

  put<T>(caminho: string, opcoes: OpcoesDeRequisicao = {}): Promise<T> {
    return this.requisitar<T>('PUT', caminho, opcoes);
  }

  delete<T>(caminho: string, opcoes: OpcoesDeRequisicao = {}): Promise<T> {
    return this.requisitar<T>('DELETE', caminho, opcoes);
  }

  private async requisitar<T>(
    metodo: string,
    caminho: string,
    opcoes: OpcoesDeRequisicao,
  ): Promise<T> {
    const autenticado = opcoes.autenticado ?? true;
    let sessao = autenticado ? await this.armazenamento.ler() : null;

    let resposta = await this.enviar(metodo, caminho, opcoes, sessao?.tokenDeAcesso);

    if (resposta.status === 401 && autenticado && sessao) {
      sessao = await this.renovarUmaVez();
      if (!sessao) {
        this.aoExpirarSessao();
        throw new ErroDeApi('Sua sessão expirou. Entre novamente.', 401);
      }
      resposta = await this.enviar(metodo, caminho, opcoes, sessao.tokenDeAcesso);
    }

    return this.ler<T>(resposta);
  }

  private renovarUmaVez(): Promise<Sessao | null> {
    this.renovacaoEmAndamento ??= this.renovar().finally(() => {
      this.renovacaoEmAndamento = null;
    });
    return this.renovacaoEmAndamento;
  }

  private async renovar(): Promise<Sessao | null> {
    const atual = await this.armazenamento.ler();
    if (!atual) return null;

    try {
      const resposta = await this.enviar('POST', '/autenticacao/renovar', {
        corpo: { tokenDeRenovacao: atual.tokenDeRenovacao },
        autenticado: false,
      });
      if (!resposta.ok) {
        // Só descarta a sessão se o servidor a recusou; erro de rede/servidor não deve deslogar ninguém.
        if (resposta.status === 401) await this.armazenamento.limpar();
        return null;
      }
      const nova = (await resposta.json()) as Sessao;
      await this.armazenamento.salvar(nova);
      return nova;
    } catch {
      return null;
    }
  }

  private async enviar(
    metodo: string,
    caminho: string,
    opcoes: OpcoesDeRequisicao,
    token?: string,
  ): Promise<Response> {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), opcoes.tempoLimiteMs ?? TEMPO_LIMITE_MS);
    opcoes.sinal?.addEventListener('abort', () => controle.abort());

    try {
      return await fetch(`${this.urlBase}${caminho}`, {
        method: metodo,
        headers: {
          Accept: 'application/json',
          ...(opcoes.corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
        signal: controle.signal,
      });
    } catch {
      throw new ErroDeApi('Sem conexão com o servidor.', 0);
    } finally {
      clearTimeout(limite);
    }
  }

  private async ler<T>(resposta: Response): Promise<T> {
    if (resposta.ok) {
      return (resposta.status === 204 ? undefined : await resposta.json()) as T;
    }

    let problema: ProblemaDaApi = {};
    try {
      problema = ((await resposta.json()) ?? {}) as ProblemaDaApi;
    } catch {
      // Corpo vazio ou não-JSON: cai na mensagem padrão abaixo.
    }

    const mensagem =
      problema.detail ??
      (resposta.status === 429
        ? 'Muitas tentativas. Aguarde um minuto e tente de novo.'
        : resposta.status >= 500
          ? 'O servidor teve um problema. Tente novamente em instantes.'
          : 'Não foi possível concluir a operação.');
    throw new ErroDeApi(mensagem, resposta.status, problema.erros ?? []);
  }
}
