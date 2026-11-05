import { ErroDeApi } from '../../src/application/errors';
import type { AdminGateway } from '../../src/application/ports/admin';
import {
  DefinirBloqueioDeConta,
  ListarUsuariosDoPainel,
  ObterInsightsDoPainel,
  ObterResumoDoPainel,
  ObterSeriesDoPainel,
} from '../../src/application/useCases/admin';

function gateway(parcial: Partial<AdminGateway> = {}): AdminGateway {
  return {
    resumo: jest.fn(),
    series: jest.fn().mockResolvedValue({ dias: 30 }),
    insights: jest.fn().mockResolvedValue({}),
    usuarios: jest.fn().mockResolvedValue({ itens: [] }),
    definirBloqueio: jest.fn().mockResolvedValue(undefined),
    ...parcial,
  };
}

describe('casos de uso do painel', () => {
  it('pede ao servidor só janelas conhecidas (7, 30 ou 90 dias)', async () => {
    const g = gateway();
    const caso = new ObterSeriesDoPainel(g);

    await caso.executar(7);
    await caso.executar(90);
    await caso.executar(12);
    await caso.executar();

    expect((g.series as jest.Mock).mock.calls.map((c) => c[0])).toEqual([7, 90, 30, 30]);
  });

  it('nunca pede página menor que 1', async () => {
    const g = gateway();
    const caso = new ListarUsuariosDoPainel(g);

    await caso.executar(0);
    await caso.executar(3.7);

    expect((g.usuarios as jest.Mock).mock.calls.map((c) => c[0])).toEqual([1, 3]);
  });

  it('troca o 403 sem corpo por uma frase clara de acesso negado', async () => {
    const g = gateway({
      resumo: jest.fn().mockRejectedValue(new ErroDeApi('Não foi possível.', 403)),
    });

    await expect(new ObterResumoDoPainel(g).executar()).rejects.toMatchObject({
      status: 403,
      message: 'Esta conta não tem acesso ao painel do administrador.',
    });
  });

  it('deixa passar os outros erros como vieram', async () => {
    const g = gateway({ resumo: jest.fn().mockRejectedValue(new ErroDeApi('Sem conexão.', 0)) });

    await expect(new ObterResumoDoPainel(g).executar()).rejects.toMatchObject({ status: 0 });
  });

  it('bloqueia e libera uma conta pelo servidor', async () => {
    const g = gateway();
    const caso = new DefinirBloqueioDeConta(g);

    await caso.executar('u1', true);
    await caso.executar('u1', false);

    expect((g.definirBloqueio as jest.Mock).mock.calls).toEqual([
      ['u1', true],
      ['u1', false],
    ]);
  });

  it('mostra a recusa do servidor ao bloquear (ex.: administrador)', async () => {
    const g = gateway({
      definirBloqueio: jest
        .fn()
        .mockRejectedValue(new ErroDeApi('Contas de administrador não podem ser bloqueadas.', 400)),
    });

    await expect(new DefinirBloqueioDeConta(g).executar('u1', true)).rejects.toMatchObject({
      status: 400,
      message: 'Contas de administrador não podem ser bloqueadas.',
    });
  });

  it('o 403 também vira acesso negado nos insights', async () => {
    const g = gateway({ insights: jest.fn().mockRejectedValue(new ErroDeApi('x', 403)) });

    await expect(new ObterInsightsDoPainel(g).executar()).rejects.toMatchObject({ status: 403 });
  });
});
