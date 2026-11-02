import type { Sessao } from '../../src/application/dtos/sessao';
import { ErroDeApi } from '../../src/application/errors';
import type { GrupoGateway } from '../../src/application/ports/grupo';
import type { ArmazenamentoDeSessao } from '../../src/application/ports/portas';
import { EntrarEmGrupo, RenomearGrupo, SairDoGrupo } from '../../src/application/useCases/grupo';
import { nomesDosMembros, normalizarCodigo, type Grupo } from '../../src/domain/entities/grupo';

const sessaoDaFamilia: Sessao = {
  tokenDeAcesso: 'acesso-familia',
  expiraEm: '2026-11-01T12:30:00Z',
  tokenDeRenovacao: 'renovacao-familia',
  usuario: { id: 'u2', nome: 'Ana', email: 'ana@exemplo.com' },
  grupoId: 'g-familia',
};

function armazenamento(): ArmazenamentoDeSessao & { atual: Sessao | null } {
  const arm = {
    atual: null as Sessao | null,
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

function gateway(sobrescritas: Partial<GrupoGateway> = {}): GrupoGateway {
  return {
    obter: jest.fn(),
    renomear: jest.fn().mockResolvedValue(undefined),
    criarConvite: jest.fn(),
    entrar: jest.fn().mockResolvedValue(sessaoDaFamilia),
    sair: jest.fn().mockResolvedValue({ ...sessaoDaFamilia, grupoId: 'g-pessoal' }),
    removerMembro: jest.fn(),
    ...sobrescritas,
  };
}

describe('EntrarEmGrupo', () => {
  it('normaliza o código, chama a API e guarda a sessão nova (já no grupo da família)', async () => {
    const g = gateway();
    const arm = armazenamento();

    const sessao = await new EntrarEmGrupo(g, arm).executar(' k7m2-xq9p ');

    expect(g.entrar).toHaveBeenCalledWith('K7M2XQ9P');
    expect(sessao.grupoId).toBe('g-familia');
    expect(arm.atual?.grupoId).toBe('g-familia');
  });

  it.each(['', '123', 'ABCD', 'K7M2-XQ9P-Z'])(
    'recusa código fora do formato sem chamar a API: "%s"',
    async (codigo) => {
      const g = gateway();
      await expect(new EntrarEmGrupo(g, armazenamento()).executar(codigo)).rejects.toBeInstanceOf(
        ErroDeApi,
      );
      expect(g.entrar).not.toHaveBeenCalled();
    },
  );

  it('se a API recusa (convite inválido), a sessão guardada não muda', async () => {
    const arm = armazenamento();
    const g = gateway({
      entrar: jest.fn().mockRejectedValue(new ErroDeApi('Convite inválido ou expirado.', 404)),
    });

    await expect(new EntrarEmGrupo(g, arm).executar('K7M2XQ9P')).rejects.toThrow(
      'Convite inválido',
    );
    expect(arm.atual).toBeNull();
  });
});

describe('SairDoGrupo', () => {
  it('guarda a sessão do grupo pessoal devolvida pela API', async () => {
    const arm = armazenamento();
    const sessao = await new SairDoGrupo(gateway(), arm).executar();
    expect(sessao.grupoId).toBe('g-pessoal');
    expect(arm.atual?.grupoId).toBe('g-pessoal');
  });
});

describe('RenomearGrupo', () => {
  it('apara o nome e recusa vazio ou muito longo', async () => {
    const g = gateway();
    await new RenomearGrupo(g).executar('  Família Silva ');
    expect(g.renomear).toHaveBeenCalledWith('Família Silva');

    await expect(new RenomearGrupo(g).executar('   ')).rejects.toThrow('Informe o nome');
    await expect(new RenomearGrupo(g).executar('x'.repeat(121))).rejects.toThrow('120 caracteres');
  });
});

describe('domínio do grupo', () => {
  it('normaliza códigos digitados de várias formas', () => {
    expect(normalizarCodigo('k7m2-xq9p')).toBe('K7M2XQ9P');
    expect(normalizarCodigo(' K7M2 XQ9P ')).toBe('K7M2XQ9P');
  });

  it('mapeia o id de cada pessoa ao nome para mostrar "Ana marcou"', () => {
    const grupo: Grupo = {
      id: 'g',
      nome: 'Família',
      compartilhado: true,
      meuPapel: 'Administrador',
      membros: [
        {
          usuarioId: 'u1',
          nome: 'David',
          papel: 'Administrador',
          voce: true,
          entrouEm: '2026-11-01',
        },
        { usuarioId: 'u2', nome: 'Ana', papel: 'Membro', voce: false, entrouEm: '2026-11-02' },
      ],
    };
    expect(nomesDosMembros(grupo).get('u2')).toBe('Ana');
    expect(nomesDosMembros(null).size).toBe(0);
  });
});
