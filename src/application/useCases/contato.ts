import {
  RESPOSTA_MAXIMA,
  validarInformacao,
  validarNovaMensagem,
} from '../../domain/services/contato';
import type {
  DadosDaInformacao,
  NovaMensagem,
  RespostaDoAdmin,
} from '../../domain/entities/contato';
import { ErroDeApi } from '../errors';
import type { ContatoGateway } from '../ports/contato';

/** As informações do card de contato (lista vazia se o administrador ainda não cadastrou nenhuma). */
export class ObterInformacoesDeContato {
  constructor(private readonly gateway: ContatoGateway) {}
  executar() {
    return this.gateway.informacoes();
  }
}

export class ListarMinhasMensagens {
  constructor(private readonly gateway: ContatoGateway) {}
  executar() {
    return this.gateway.minhasMensagens();
  }
}

/** Valida antes de chamar a API (resposta rápida); a API valida de novo. Sempre devolve Promise rejeitada, nunca lança. */
export class EnviarMensagemDeContato {
  constructor(private readonly gateway: ContatoGateway) {}

  async executar(dados: NovaMensagem) {
    const erro = validarNovaMensagem(dados);
    if (erro) throw new ErroDeApi(erro, 400);
    return this.gateway.enviar({
      tipo: dados.tipo,
      assunto: dados.assunto.trim(),
      texto: dados.texto.trim(),
    });
  }
}

/** Falha em silêncio: marcar como vista é só conveniência e não pode atrapalhar a leitura da resposta. */
export class MarcarRespostaComoVista {
  constructor(private readonly gateway: ContatoGateway) {}

  async executar(id: string) {
    try {
      await this.gateway.marcarRespostaComoVista(id);
    } catch {
      // A próxima abertura tenta de novo.
    }
  }
}

/** A API responde 403 sem corpo a quem não é admin; aqui vira uma frase que a tela pode mostrar. */
async function comAvisoDeAcessoNegado<T>(chamada: () => Promise<T>): Promise<T> {
  try {
    return await chamada();
  } catch (erro) {
    if (erro instanceof ErroDeApi && erro.status === 403) {
      throw new ErroDeApi('Esta conta não tem acesso ao painel do administrador.', 403);
    }
    throw erro;
  }
}

export class ListarMensagensDoPainel {
  constructor(private readonly gateway: ContatoGateway) {}
  executar() {
    return comAvisoDeAcessoNegado(() => this.gateway.caixaDoAdmin());
  }
}

export class ResponderMensagemDoPainel {
  constructor(private readonly gateway: ContatoGateway) {}

  async executar(id: string, dados: RespostaDoAdmin) {
    const resposta = dados.resposta.trim();
    if (resposta.length > RESPOSTA_MAXIMA) {
      throw new ErroDeApi(`A resposta pode ter no máximo ${RESPOSTA_MAXIMA} caracteres.`, 400);
    }
    if (resposta === '' && dados.status === 'Respondida') {
      throw new ErroDeApi('Escreva a resposta antes de marcar como respondida.', 400);
    }
    return comAvisoDeAcessoNegado(() =>
      this.gateway.responder(id, { resposta, status: dados.status }),
    );
  }
}

/** Título e valor são obrigatórios; a descrição é opcional. Valida antes de chamar a API, que valida de novo. */
function conferir(dados: DadosDaInformacao): DadosDaInformacao {
  const erro = validarInformacao(dados);
  if (erro) throw new ErroDeApi(erro, 400);
  return {
    titulo: dados.titulo.trim(),
    descricao: dados.descricao.trim(),
    valor: dados.valor.trim(),
  };
}

export class AdicionarInformacaoDeContato {
  constructor(private readonly gateway: ContatoGateway) {}

  async executar(dados: DadosDaInformacao) {
    const limpos = conferir(dados);
    return comAvisoDeAcessoNegado(() => this.gateway.adicionarInformacao(limpos));
  }
}

export class AlterarInformacaoDeContato {
  constructor(private readonly gateway: ContatoGateway) {}

  async executar(id: string, dados: DadosDaInformacao) {
    const limpos = conferir(dados);
    return comAvisoDeAcessoNegado(() => this.gateway.alterarInformacao(id, limpos));
  }
}

export class RemoverInformacaoDeContato {
  constructor(private readonly gateway: ContatoGateway) {}
  executar(id: string) {
    return comAvisoDeAcessoNegado(() => this.gateway.removerInformacao(id));
  }
}
