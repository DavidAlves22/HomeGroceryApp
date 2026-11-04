import type { Sessao } from '../../src/application/dtos/sessao';
import { ErroDeApi, mensagemParaUsuario } from '../../src/application/errors';
import type {
  ArmazenamentoDeSessao,
  AutenticacaoGateway,
} from '../../src/application/ports/portas';
import {
  CadastrarUsuario,
  EntrarNaConta,
  RestaurarSessao,
  VerificarServidor,
} from '../../src/application/useCases/autenticacao';

const sessaoExemplo: Sessao = {
  tokenDeAcesso: 'acesso',
  expiraEm: '2026-11-01T12:30:00Z',
  tokenDeRenovacao: 'renovacao-1',
  usuario: { id: 'u1', nome: 'Maria', email: 'maria@exemplo.com' },
  grupoId: 'g1',
};

function armazenamentoEmMemoria(
  inicial: Sessao | null = null,
): ArmazenamentoDeSessao & { atual: Sessao | null } {
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

function gatewayFalso(sobrescritas: Partial<AutenticacaoGateway> = {}): AutenticacaoGateway {
  return {
    cadastrar: jest.fn().mockResolvedValue(sessaoExemplo),
    entrar: jest.fn().mockResolvedValue(sessaoExemplo),
    renovar: jest.fn().mockResolvedValue({ ...sessaoExemplo, tokenDeRenovacao: 'renovacao-2' }),
    recuperacaoDisponivel: jest.fn().mockResolvedValue(true),
    pedirCodigoDeRecuperacao: jest.fn().mockResolvedValue(undefined),
    redefinirSenha: jest.fn().mockResolvedValue(undefined),
    alterarNome: jest.fn(),
    googleClienteId: jest.fn().mockResolvedValue(null),
    entrarComGoogle: jest.fn().mockResolvedValue(sessaoExemplo),
    ...sobrescritas,
  };
}

describe('CadastrarUsuario', () => {
  it('normaliza os dados, chama a API e guarda a sessão', async () => {
    const gateway = gatewayFalso();
    const arm = armazenamentoEmMemoria();

    await new CadastrarUsuario(gateway, arm).executar({
      nome: ' Maria ',
      email: ' Maria@Exemplo.com ',
      senha: 'senha1234',
    });

    expect(gateway.cadastrar).toHaveBeenCalledWith({
      nome: 'Maria',
      email: 'maria@exemplo.com',
      senha: 'senha1234',
    });
    expect(arm.atual).toEqual(sessaoExemplo);
  });

  it.each([
    [{ nome: '', email: 'a@b.com', senha: 'senha1234' }, 'Informe seu nome.'],
    [{ nome: 'Maria', email: 'invalido', senha: 'senha1234' }, 'Informe um e-mail válido.'],
    [
      { nome: 'Maria', email: 'a@b.com', senha: 'curta1' },
      'A senha precisa ter ao menos 8 caracteres.',
    ],
    [
      { nome: 'Maria', email: 'a@b.com', senha: 'semnumeros' },
      'A senha precisa ter ao menos um número.',
    ],
  ])('recusa dados inválidos sem chamar a API', async (dados, mensagem) => {
    const gateway = gatewayFalso();
    await expect(
      new CadastrarUsuario(gateway, armazenamentoEmMemoria()).executar(dados),
    ).rejects.toThrow(mensagem);
    expect(gateway.cadastrar).not.toHaveBeenCalled();
  });
});

describe('EntrarNaConta', () => {
  it('guarda a sessão quando o login funciona', async () => {
    const arm = armazenamentoEmMemoria();
    await new EntrarNaConta(gatewayFalso(), arm).executar({
      email: 'maria@exemplo.com',
      senha: 'x',
    });
    expect(arm.atual).toEqual(sessaoExemplo);
  });

  it('não guarda nada quando a API recusa', async () => {
    const arm = armazenamentoEmMemoria();
    const gateway = gatewayFalso({
      entrar: jest.fn().mockRejectedValue(new ErroDeApi('E-mail ou senha incorretos.', 401)),
    });

    await expect(
      new EntrarNaConta(gateway, arm).executar({ email: 'maria@exemplo.com', senha: 'x' }),
    ).rejects.toThrow('E-mail ou senha incorretos.');
    expect(arm.atual).toBeNull();
  });
});

describe('RestaurarSessao', () => {
  it('sem sessão guardada devolve null e não chama a API', async () => {
    const gateway = gatewayFalso();
    expect(await new RestaurarSessao(gateway, armazenamentoEmMemoria()).executar()).toBeNull();
    expect(gateway.renovar).not.toHaveBeenCalled();
  });

  it('renova e guarda o novo token de renovação', async () => {
    const arm = armazenamentoEmMemoria(sessaoExemplo);
    const sessao = await new RestaurarSessao(gatewayFalso(), arm).executar();
    expect(sessao?.tokenDeRenovacao).toBe('renovacao-2');
    expect(arm.atual?.tokenDeRenovacao).toBe('renovacao-2');
  });

  it('sessão recusada pelo servidor (401) é apagada e volta ao login', async () => {
    const arm = armazenamentoEmMemoria(sessaoExemplo);
    const gateway = gatewayFalso({
      renovar: jest.fn().mockRejectedValue(new ErroDeApi('Sessão expirada.', 401)),
    });

    expect(await new RestaurarSessao(gateway, arm).executar()).toBeNull();
    expect(arm.atual).toBeNull();
  });

  it('servidor fora do ar NÃO apaga a sessão: o erro sobe e a sessão é preservada', async () => {
    const arm = armazenamentoEmMemoria(sessaoExemplo);
    const gateway = gatewayFalso({
      renovar: jest.fn().mockRejectedValue(new ErroDeApi('Sem conexão.', 0)),
    });

    await expect(new RestaurarSessao(gateway, arm).executar()).rejects.toBeInstanceOf(ErroDeApi);
    expect(arm.atual).toEqual(sessaoExemplo);
  });
});

describe('VerificarServidor', () => {
  it('devolve true quando o servidor responde ok', async () => {
    expect(await new VerificarServidor({ verificarSaude: async () => true }).executar()).toBe(true);
  });

  it('transforma qualquer falha em false, sem lançar', async () => {
    expect(
      await new VerificarServidor({
        verificarSaude: async () => {
          throw new ErroDeApi('x', 0);
        },
      }).executar(),
    ).toBe(false);
  });
});

describe('mensagemParaUsuario', () => {
  it('traduz falta de conexão e esconde erros desconhecidos', () => {
    expect(mensagemParaUsuario(new ErroDeApi('x', 0))).toContain('internet');
    expect(mensagemParaUsuario(new Error('stack interna'))).toBe(
      'Algo deu errado. Tente novamente.',
    );
  });

  it('junta os detalhes de validação enviados pela API', () => {
    expect(mensagemParaUsuario(new ErroDeApi('a', 400, ['Um.', 'Dois.']))).toBe('Um. Dois.');
  });
});
