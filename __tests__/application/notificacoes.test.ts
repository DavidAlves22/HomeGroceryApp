import { ErroDeApi } from '../../src/application/errors';
import type {
  AssinaturaDeAvisos,
  AvisosDoDispositivo,
  NotificacoesGateway,
} from '../../src/application/ports/notificacoes';
import {
  DesligarAvisos,
  LigarAvisos,
  ObterEstadoDosAvisos,
} from '../../src/application/useCases/notificacoes';

const assinatura: AssinaturaDeAvisos = { endpoint: 'https://push/x', p256dh: 'p', auth: 'a' };

function montar(
  dispositivo: Partial<AvisosDoDispositivo> = {},
  gateway: Partial<NotificacoesGateway> = {},
) {
  const d = {
    suportado: jest.fn().mockReturnValue(true),
    permissao: jest.fn().mockReturnValue('padrao'),
    assinaturaAtual: jest.fn().mockResolvedValue(null),
    assinar: jest.fn().mockResolvedValue(assinatura),
    cancelar: jest.fn().mockResolvedValue(assinatura.endpoint),
    ...dispositivo,
  } as unknown as AvisosDoDispositivo & Record<string, jest.Mock>;
  const g = {
    obterChave: jest.fn().mockResolvedValue('chave'),
    assinar: jest.fn().mockResolvedValue(undefined),
    cancelar: jest.fn().mockResolvedValue(undefined),
    ...gateway,
  } as unknown as NotificacoesGateway & Record<string, jest.Mock>;
  return { d, g };
}

describe('ObterEstadoDosAvisos', () => {
  it('é indisponível sem suporte do aparelho ou sem os avisos ligados no servidor', async () => {
    const semSuporte = montar({ suportado: jest.fn().mockReturnValue(false) });
    expect(await new ObterEstadoDosAvisos(semSuporte.d, semSuporte.g).executar()).toBe(
      'indisponivel',
    );
    expect(semSuporte.g.obterChave).not.toHaveBeenCalled();

    const semServidor = montar({}, { obterChave: jest.fn().mockResolvedValue(null) });
    expect(await new ObterEstadoDosAvisos(semServidor.d, semServidor.g).executar()).toBe(
      'indisponivel',
    );
  });

  it('distingue bloqueado, desligado e ligado', async () => {
    const bloqueado = montar({ permissao: jest.fn().mockReturnValue('negada') });
    expect(await new ObterEstadoDosAvisos(bloqueado.d, bloqueado.g).executar()).toBe('bloqueado');

    const desligado = montar();
    expect(await new ObterEstadoDosAvisos(desligado.d, desligado.g).executar()).toBe('desligado');

    const ligado = montar({ assinaturaAtual: jest.fn().mockResolvedValue(assinatura) });
    expect(await new ObterEstadoDosAvisos(ligado.d, ligado.g).executar()).toBe('ligado');
  });
});

describe('LigarAvisos', () => {
  it('assina no aparelho com a chave do servidor e cadastra no servidor', async () => {
    const { d, g } = montar();
    expect(await new LigarAvisos(d, g).executar()).toBe('ligado');
    expect(d.assinar).toHaveBeenCalledWith('chave');
    expect(g.assinar).toHaveBeenCalledWith(assinatura);
  });

  it('se o usuário nega a permissão, nada é cadastrado', async () => {
    const { d, g } = montar({ assinar: jest.fn().mockResolvedValue(null) });
    expect(await new LigarAvisos(d, g).executar()).toBe('bloqueado');
    expect(g.assinar).not.toHaveBeenCalled();
  });

  it('sem os avisos ligados no servidor, nem tenta assinar', async () => {
    const { d, g } = montar({}, { obterChave: jest.fn().mockResolvedValue(null) });
    expect(await new LigarAvisos(d, g).executar()).toBe('indisponivel');
    expect(d.assinar).not.toHaveBeenCalled();
  });
});

describe('DesligarAvisos', () => {
  it('cancela no aparelho e avisa o servidor', async () => {
    const { d, g } = montar();
    expect(await new DesligarAvisos(d, g).executar()).toBe('desligado');
    expect(g.cancelar).toHaveBeenCalledWith(assinatura.endpoint);
  });

  it('se o servidor não ouvir, o aparelho já está desligado', async () => {
    const { d, g } = montar(
      {},
      { cancelar: jest.fn().mockRejectedValue(new ErroDeApi('fora', 0)) },
    );
    expect(await new DesligarAvisos(d, g).executar()).toBe('desligado');
  });
});
