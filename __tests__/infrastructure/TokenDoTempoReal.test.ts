import type { Sessao } from '../../src/application/dtos/sessao';
import type { ArmazenamentoDeSessao } from '../../src/application/ports/portas';
import { ClienteHttp } from '../../src/infrastructure/http/ClienteHttp';

const sessao = (n: number, expiraEmMs: number): Sessao => ({
  tokenDeAcesso: `acesso-${n}`,
  expiraEm: new Date(Date.now() + expiraEmMs).toISOString(),
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

describe('ClienteHttp.obterTokenDeAcesso (usado pela conexão em tempo real)', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('devolve o token atual sem renovar quando ainda vale', async () => {
    const fetchFalso = jest.fn();
    global.fetch = fetchFalso;

    const token = await new ClienteHttp(
      'http://api',
      armazenamento(sessao(1, 20 * 60_000)),
    ).obterTokenDeAcesso();

    expect(token).toBe('acesso-1');
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('renova antes de entregar o token quando falta menos de 1 minuto', async () => {
    const arm = armazenamento(sessao(1, 20_000));
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => sessao(2, 30 * 60_000) });

    const token = await new ClienteHttp('http://api', arm).obterTokenDeAcesso();

    expect(token).toBe('acesso-2');
    expect(arm.atual?.tokenDeRenovacao).toBe('renovacao-2');
  });

  it('sem sessão devolve vazio, e se a renovação falha usa o token que tem', async () => {
    expect(await new ClienteHttp('http://api', armazenamento(null)).obterTokenDeAcesso()).toBe('');

    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const token = await new ClienteHttp(
      'http://api',
      armazenamento(sessao(1, 10_000)),
    ).obterTokenDeAcesso();
    expect(token).toBe('acesso-1');
  });
});
