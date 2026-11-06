import { ErroDeApi } from '../../src/application/errors';
import type { ContatoGateway } from '../../src/application/ports/contato';
import {
  AdicionarInformacaoDeContato,
  AlterarInformacaoDeContato,
  EnviarMensagemDeContato,
  ListarMensagensDoPainel,
  MarcarRespostaComoVista,
  ResponderMensagemDoPainel,
} from '../../src/application/useCases/contato';

function gateway(parcial: Partial<ContatoGateway> = {}): ContatoGateway {
  return {
    informacoes: jest.fn().mockResolvedValue([]),
    minhasMensagens: jest.fn().mockResolvedValue({ itens: [], respostasNovas: 0 }),
    enviar: jest.fn().mockResolvedValue({}),
    marcarRespostaComoVista: jest.fn().mockResolvedValue(undefined),
    caixaDoAdmin: jest
      .fn()
      .mockResolvedValue({ informacoes: [], aguardandoResposta: 0, itens: [] }),
    responder: jest.fn().mockResolvedValue({}),
    adicionarInformacao: jest.fn().mockResolvedValue({}),
    alterarInformacao: jest.fn().mockResolvedValue({}),
    removerInformacao: jest.fn().mockResolvedValue(undefined),
    ...parcial,
  };
}

describe('mensagens de contato', () => {
  it('valida antes de enviar e limpa os espaços das pontas', async () => {
    const g = gateway();
    const caso = new EnviarMensagemDeContato(g);

    await expect(
      caso.executar({ tipo: 'Feedback', assunto: 'ab', texto: 'Texto ok' }),
    ).rejects.toBeInstanceOf(ErroDeApi);
    expect(g.enviar).not.toHaveBeenCalled();

    await caso.executar({ tipo: 'Solicitacao', assunto: '  Rota  ', texto: '  Falta o açougue  ' });
    expect(g.enviar).toHaveBeenCalledWith({
      tipo: 'Solicitacao',
      assunto: 'Rota',
      texto: 'Falta o açougue',
    });
  });

  it('marcar a resposta como vista nunca estoura erro', async () => {
    const g = gateway({ marcarRespostaComoVista: jest.fn().mockRejectedValue(new Error('rede')) });

    await expect(new MarcarRespostaComoVista(g).executar('id')).resolves.toBeUndefined();
  });
});

describe('painel de contato do administrador', () => {
  it('não marca como respondida sem texto, mas aceita mudar só o status', async () => {
    const g = gateway();
    const caso = new ResponderMensagemDoPainel(g);

    await expect(
      caso.executar('1', { resposta: '  ', status: 'Respondida' }),
    ).rejects.toBeInstanceOf(ErroDeApi);
    await caso.executar('1', { resposta: '', status: 'EmAnalise' });
    await caso.executar('1', { resposta: '  Feito.  ', status: 'Respondida' });

    expect((g.responder as jest.Mock).mock.calls).toEqual([
      ['1', { resposta: '', status: 'EmAnalise' }],
      ['1', { resposta: 'Feito.', status: 'Respondida' }],
    ]);
  });

  it('cadastra e altera informação com título e valor, sem exigir descrição', async () => {
    const g = gateway();

    await new AdicionarInformacaoDeContato(g).executar({
      titulo: ' Email para contato ',
      descricao: '',
      valor: ' david.alves@teste.com ',
    });
    await new AlterarInformacaoDeContato(g).executar('1', {
      titulo: 'Chave Pix',
      descricao: 'Caso queira contribuir',
      valor: 'abc',
    });

    expect(g.adicionarInformacao).toHaveBeenCalledWith({
      titulo: 'Email para contato',
      descricao: '',
      valor: 'david.alves@teste.com',
    });
    expect(g.alterarInformacao).toHaveBeenCalledWith('1', {
      titulo: 'Chave Pix',
      descricao: 'Caso queira contribuir',
      valor: 'abc',
    });
  });

  it('recusa informação sem título ou sem valor sem chamar a API', async () => {
    const g = gateway();
    const caso = new AdicionarInformacaoDeContato(g);

    await expect(caso.executar({ titulo: '', descricao: '', valor: 'x' })).rejects.toThrow(
      'título',
    );
    await expect(caso.executar({ titulo: 'x', descricao: '', valor: '' })).rejects.toThrow('valor');
    expect(g.adicionarInformacao).not.toHaveBeenCalled();
  });

  it('troca o 403 por uma frase clara', async () => {
    const g = gateway({ caixaDoAdmin: jest.fn().mockRejectedValue(new ErroDeApi('', 403)) });

    await expect(new ListarMensagensDoPainel(g).executar()).rejects.toThrow(/não tem acesso/);
  });
});
