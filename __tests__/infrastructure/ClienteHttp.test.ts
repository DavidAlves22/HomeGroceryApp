import type { Sessao } from '../../src/application/dtos/sessao';
import { ErroDeApi } from '../../src/application/errors';
import type { ArmazenamentoDeSessao } from '../../src/application/ports/portas';
import { ClienteHttp } from '../../src/infrastructure/http/ClienteHttp';

const sessao = (n: number): Sessao => ({
  tokenDeAcesso: `acesso-${n}`,
  expiraEm: '2026-11-01T12:30:00Z',
  tokenDeRenovacao: `renovacao-${n}`,
  usuario: { id: 'u1', nome: 'Maria', email: 'maria@exemplo.com' },
  grupoId: 'g1',
});

function armazenamento(inicial: Sessao | null): ArmazenamentoDeSessao & { atual: Sessao | null } {
  const arm = {
    atual: inicial,
    ler: async () => arm.atual,
    salvar: async (s: Sessao) => {
      arm.atual = s;
    },
    limpar: async () => {
      arm.atual = null;
    },
  };
  return arm;
}

const resposta = (status: number, corpo?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as Response;

/** Espera a promessa falhar e devolve o erro já tipado. */
async function capturar(promessa: Promise<unknown>): Promise<ErroDeApi> {
  try {
    await promessa;
  } catch (e) {
    return e as ErroDeApi;
  }
  throw new Error('Era esperado que a chamada falhasse.');
}

describe('ClienteHttp', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('anexa o token de acesso nas rotas autenticadas', async () => {
    const fetchFalso = jest.fn().mockResolvedValue(resposta(200, { ok: true }));
    global.fetch = fetchFalso;

    await new ClienteHttp('http://api', armazenamento(sessao(1))).get('/algo');

    expect(fetchFalso.mock.calls[0][1].headers.Authorization).toBe('Bearer acesso-1');
  });

  it('não anexa token em rota pública', async () => {
    const fetchFalso = jest.fn().mockResolvedValue(resposta(200, {}));
    global.fetch = fetchFalso;

    await new ClienteHttp('http://api', armazenamento(sessao(1))).get('/saude', {
      autenticado: false,
    });

    expect(fetchFalso.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('em 401 renova a sessão uma vez e repete o pedido com o token novo', async () => {
    const arm = armazenamento(sessao(1));
    const fetchFalso = jest
      .fn()
      .mockResolvedValueOnce(resposta(401))
      .mockResolvedValueOnce(resposta(200, sessao(2)))
      .mockResolvedValueOnce(resposta(200, { dado: 42 }));
    global.fetch = fetchFalso;

    const resultado = await new ClienteHttp('http://api', arm).get<{ dado: number }>('/algo');

    expect(resultado.dado).toBe(42);
    expect(fetchFalso.mock.calls[1][0]).toBe('http://api/autenticacao/renovar');
    expect(fetchFalso.mock.calls[2][1].headers.Authorization).toBe('Bearer acesso-2');
    expect(arm.atual?.tokenDeRenovacao).toBe('renovacao-2');
  });

  it('chamadas simultâneas com 401 compartilham UMA renovação', async () => {
    const arm = armazenamento(sessao(1));
    let renovacoes = 0;
    global.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/autenticacao/renovar')) {
        renovacoes++;
        return resposta(200, sessao(2));
      }
      const token = (init?.headers as Record<string, string>).Authorization;
      return token === 'Bearer acesso-1' ? resposta(401) : resposta(200, { ok: true });
    }) as unknown as typeof fetch;

    const http = new ClienteHttp('http://api', arm);
    await Promise.all([http.get('/a'), http.get('/b'), http.get('/c')]);

    expect(renovacoes).toBe(1);
  });

  it('se a renovação é recusada, apaga a sessão, avisa e lança 401', async () => {
    const arm = armazenamento(sessao(1));
    const aoExpirar = jest.fn();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(resposta(401))
      .mockResolvedValueOnce(resposta(401));

    await expect(new ClienteHttp('http://api', arm, aoExpirar).get('/algo')).rejects.toMatchObject({
      status: 401,
    });

    expect(arm.atual).toBeNull();
    expect(aoExpirar).toHaveBeenCalledTimes(1);
  });

  it('falha de rede vira ErroDeApi com status 0 e não desloga', async () => {
    const arm = armazenamento(sessao(1));
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const erro = await capturar(new ClienteHttp('http://api', arm).get('/algo'));

    expect(erro).toBeInstanceOf(ErroDeApi);
    expect(erro.semConexao).toBe(true);
    expect(arm.atual).not.toBeNull();
  });

  it('usa a mensagem e os erros do problem+json da API', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        resposta(400, { detail: 'Dados inválidos.', erros: ['Informe seu nome.'] }),
      );

    const erro = await capturar(
      new ClienteHttp('http://api', armazenamento(null)).post('/x', { autenticado: false }),
    );

    expect(erro.message).toBe('Dados inválidos.');
    expect(erro.detalhes).toEqual(['Informe seu nome.']);
  });

  it('esconde detalhes técnicos de erro 500', async () => {
    global.fetch = jest.fn().mockResolvedValue(resposta(500, undefined));

    const erro = await capturar(
      new ClienteHttp('http://api', armazenamento(null)).get('/x', { autenticado: false }),
    );

    expect(erro.message).toBe('O servidor teve um problema. Tente novamente em instantes.');
  });
});
