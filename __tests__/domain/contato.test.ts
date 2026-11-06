import type { MensagemParaAdmin } from '../../src/domain/entities/contato';
import {
  filtrarMensagens,
  rotuloDoStatus,
  rotuloDoTipo,
  validarInformacao,
  validarNovaMensagem,
} from '../../src/domain/services/contato';

function mensagem(status: MensagemParaAdmin['status']): MensagemParaAdmin {
  return {
    id: status,
    usuarioId: 'u',
    nome: 'Ana',
    email: 'ana@teste.com',
    tipo: 'Feedback',
    assunto: 'Assunto',
    texto: 'Texto',
    status,
    criadoEm: '2026-11-06T12:00:00Z',
    atualizadoEm: '2026-11-06T12:00:00Z',
    resposta: null,
    respondidoEm: null,
  };
}

describe('mensagem de contato', () => {
  it('aceita assunto e texto dentro dos limites, medindo sem espaços nas pontas', () => {
    expect(
      validarNovaMensagem({ tipo: 'Feedback', assunto: ' Modo escuro ', texto: ' Seria bom. ' }),
    ).toBeNull();
  });

  it('recusa assunto curto, texto curto e excessos', () => {
    expect(validarNovaMensagem({ tipo: 'Feedback', assunto: ' ab ', texto: 'Texto ok' })).toMatch(
      /assunto/,
    );
    expect(validarNovaMensagem({ tipo: 'Feedback', assunto: 'Assunto', texto: 'oi' })).toMatch(
      /mensagem/,
    );
    expect(
      validarNovaMensagem({ tipo: 'Feedback', assunto: 'a'.repeat(101), texto: 'Texto ok' }),
    ).toMatch(/100/);
    expect(
      validarNovaMensagem({ tipo: 'Feedback', assunto: 'Assunto', texto: 'a'.repeat(2001) }),
    ).toMatch(/2000/);
  });

  it('tem rótulos em português para tipo e status', () => {
    expect(rotuloDoTipo('Solicitacao')).toBe('Solicitação');
    expect(rotuloDoStatus('EmAnalise')).toBe('Em análise');
    expect(rotuloDoStatus('Concluida')).toBe('Concluída');
  });

  it('filtra por aguardando (recebida/em análise), respondidas (respondida/concluída) e todas', () => {
    const todas = [
      mensagem('Recebida'),
      mensagem('EmAnalise'),
      mensagem('Respondida'),
      mensagem('Concluida'),
    ];

    expect(filtrarMensagens(todas, 'aguardando').map((m) => m.status)).toEqual([
      'Recebida',
      'EmAnalise',
    ]);
    expect(filtrarMensagens(todas, 'respondidas').map((m) => m.status)).toEqual([
      'Respondida',
      'Concluida',
    ]);
    expect(filtrarMensagens(todas, 'todas')).toHaveLength(4);
  });
});

describe('informações do card de contato', () => {
  it('exige título e valor; a descrição é opcional', () => {
    expect(validarInformacao({ titulo: 'Email', descricao: '', valor: 'a@b.com' })).toBeNull();
    expect(validarInformacao({ titulo: ' ', descricao: '', valor: 'a@b.com' })).toBe(
      'Informe o título.',
    );
    expect(validarInformacao({ titulo: 'Email', descricao: '', valor: '  ' })).toBe(
      'Informe o valor.',
    );
  });

  it('respeita os limites de tamanho', () => {
    expect(validarInformacao({ titulo: 'a'.repeat(61), descricao: '', valor: 'x' })).toMatch(/60/);
    expect(validarInformacao({ titulo: 'a', descricao: 'a'.repeat(201), valor: 'x' })).toMatch(
      /200/,
    );
    expect(validarInformacao({ titulo: 'a', descricao: '', valor: 'a'.repeat(301) })).toMatch(
      /300/,
    );
  });
});
