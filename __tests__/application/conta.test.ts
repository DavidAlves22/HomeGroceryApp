import { ErroDeApi } from '../../src/application/errors';
import type { Sessao } from '../../src/application/dtos/sessao';
import type {
  ArmazenamentoDeSessao,
  AutenticacaoGateway,
} from '../../src/application/ports/portas';
import {
  AlterarNomeDoUsuario,
  ConsultarLoginComGoogle,
  EntrarComGoogle,
  ConsultarRecuperacaoDeSenha,
  PedirCodigoDeRecuperacao,
  RedefinirSenha,
} from '../../src/application/useCases/autenticacao';

const sessao: Sessao = {
  tokenDeAcesso: 'a',
  expiraEm: '2099-01-01',
  tokenDeRenovacao: 'r',
  usuario: { id: 'u1', nome: 'Maria', email: 'maria@teste.com' },
  grupoId: 'g1',
};

const gateway = (sobrescritas: Partial<AutenticacaoGateway> = {}) =>
  ({
    recuperacaoDisponivel: jest.fn().mockResolvedValue(true),
    pedirCodigoDeRecuperacao: jest.fn().mockResolvedValue(undefined),
    redefinirSenha: jest.fn().mockResolvedValue(undefined),
    googleClienteId: jest.fn().mockResolvedValue('cliente.apps.googleusercontent.com'),
    entrarComGoogle: jest.fn().mockResolvedValue(sessao),
    alterarNome: jest
      .fn()
      .mockImplementation(async (nome: string) => ({ ...sessao.usuario, nome })),
    ...sobrescritas,
  }) as unknown as AutenticacaoGateway & Record<string, jest.Mock>;

describe('ConsultarRecuperacaoDeSenha', () => {
  it('devolve o que o servidor diz e, se não conseguir perguntar, esconde (nunca lança)', async () => {
    expect(await new ConsultarRecuperacaoDeSenha(gateway()).executar()).toBe(true);
    const fora = gateway({
      recuperacaoDisponivel: jest.fn().mockRejectedValue(new ErroDeApi('x', 0)),
    });
    expect(await new ConsultarRecuperacaoDeSenha(fora).executar()).toBe(false);
  });
});

describe('PedirCodigoDeRecuperacao', () => {
  it('manda o e-mail normalizado e recusa e-mail inválido sem chamar o servidor', async () => {
    const g = gateway();
    await new PedirCodigoDeRecuperacao(g).executar('  Maria@Teste.com ');
    expect(g.pedirCodigoDeRecuperacao).toHaveBeenCalledWith('maria@teste.com');

    const g2 = gateway();
    await expect(new PedirCodigoDeRecuperacao(g2).executar('sem-arroba')).rejects.toThrow(
      'e-mail válido',
    );
    expect(g2.pedirCodigoDeRecuperacao).not.toHaveBeenCalled();
  });
});

describe('RedefinirSenha', () => {
  const dados = { email: 'Maria@Teste.com', codigo: '123 456', novaSenha: 'novasenha99' };

  it('limpa o código (espaços), normaliza o e-mail e envia', async () => {
    const g = gateway();
    await new RedefinirSenha(g).executar(dados);
    expect(g.redefinirSenha).toHaveBeenCalledWith({
      email: 'maria@teste.com',
      codigo: '123456',
      novaSenha: 'novasenha99',
    });
  });

  it('valida o código de 6 dígitos e a regra da senha antes de ir ao servidor', async () => {
    const g = gateway();
    await expect(new RedefinirSenha(g).executar({ ...dados, codigo: '123' })).rejects.toThrow(
      '6 dígitos',
    );
    await expect(new RedefinirSenha(g).executar({ ...dados, novaSenha: 'curta1' })).rejects.toThrow(
      '8 caracteres',
    );
    await expect(
      new RedefinirSenha(g).executar({ ...dados, novaSenha: 'semnumeroaqui' }),
    ).rejects.toThrow('um número');
    expect(g.redefinirSenha).not.toHaveBeenCalled();
  });
});

describe('AlterarNomeDoUsuario', () => {
  const armazenamento = () =>
    ({
      ler: jest.fn().mockResolvedValue(sessao),
      salvar: jest.fn().mockResolvedValue(undefined),
      limpar: jest.fn(),
    }) as unknown as ArmazenamentoDeSessao & Record<string, jest.Mock>;

  it('troca o nome no servidor e na sessão guardada no aparelho', async () => {
    const g = gateway();
    const a = armazenamento();
    const nova = await new AlterarNomeDoUsuario(g, a).executar('  Maria Souza ');

    expect(g.alterarNome).toHaveBeenCalledWith('Maria Souza');
    expect(nova.usuario.nome).toBe('Maria Souza');
    expect(nova.tokenDeAcesso).toBe('a');
    expect(a.salvar).toHaveBeenCalledWith(nova);
  });

  it('recusa nome curto ou longo demais sem chamar o servidor', async () => {
    const g = gateway();
    const a = armazenamento();
    await expect(new AlterarNomeDoUsuario(g, a).executar('M')).rejects.toThrow('entre 2 e 80');
    await expect(new AlterarNomeDoUsuario(g, a).executar('x'.repeat(81))).rejects.toThrow(
      'entre 2 e 80',
    );
    expect(g.alterarNome).not.toHaveBeenCalled();
  });
});

describe('ConsultarLoginComGoogle', () => {
  it('devolve o Client ID do servidor e, se não conseguir perguntar, esconde (null, nunca lança)', async () => {
    expect(await new ConsultarLoginComGoogle(gateway()).executar()).toBe(
      'cliente.apps.googleusercontent.com',
    );
    const fora = gateway({ googleClienteId: jest.fn().mockRejectedValue(new ErroDeApi('x', 0)) });
    expect(await new ConsultarLoginComGoogle(fora).executar()).toBeNull();
  });
});

describe('EntrarComGoogle', () => {
  it('manda o ID token ao servidor e guarda a sessão', async () => {
    const g = gateway();
    const a = {
      ler: jest.fn(),
      salvar: jest.fn().mockResolvedValue(undefined),
      limpar: jest.fn(),
    } as unknown as ArmazenamentoDeSessao & Record<string, jest.Mock>;

    const nova = await new EntrarComGoogle(g, a).executar('token-do-google');

    expect(g.entrarComGoogle).toHaveBeenCalledWith('token-do-google');
    expect(a.salvar).toHaveBeenCalledWith(nova);
  });

  it('recusa token vazio sem chamar o servidor', async () => {
    const g = gateway();
    const a = { salvar: jest.fn() } as unknown as ArmazenamentoDeSessao;
    await expect(new EntrarComGoogle(g, a).executar('')).rejects.toThrow('Google');
    expect(g.entrarComGoogle).not.toHaveBeenCalled();
  });
});
