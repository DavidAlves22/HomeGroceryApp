export type TipoDeMensagem = 'Feedback' | 'Solicitacao';

/** Recebida → Em análise → Respondida → Concluída (o administrador escolhe; não é obrigatório passar por todas). */
export type StatusDaMensagem = 'Recebida' | 'EmAnalise' | 'Respondida' | 'Concluida';

/** Uma mensagem como quem a enviou a vê. */
export interface MensagemDeContato {
  id: string;
  tipo: TipoDeMensagem;
  assunto: string;
  texto: string;
  status: StatusDaMensagem;
  criadoEm: string;
  atualizadoEm: string;
  resposta: string | null;
  respondidoEm: string | null;
  /** O administrador respondeu e a pessoa ainda não abriu a resposta. */
  respostaNova: boolean;
}

export interface MinhasMensagens {
  itens: MensagemDeContato[];
  respostasNovas: number;
}

/** Uma mensagem como o administrador a vê: com quem enviou. */
export interface MensagemParaAdmin {
  id: string;
  usuarioId: string;
  nome: string;
  email: string;
  tipo: TipoDeMensagem;
  assunto: string;
  texto: string;
  status: StatusDaMensagem;
  criadoEm: string;
  atualizadoEm: string;
  resposta: string | null;
  respondidoEm: string | null;
}

export interface CaixaDoAdmin {
  informacoes: InformacaoDeContato[];
  /** Recebidas ou em análise, de todas as pessoas. */
  aguardandoResposta: number;
  itens: MensagemParaAdmin[];
}

export interface NovaMensagem {
  tipo: TipoDeMensagem;
  assunto: string;
  texto: string;
}

export interface RespostaDoAdmin {
  resposta: string;
  status: StatusDaMensagem;
}

/** Uma linha do card de contato que o administrador cadastrou (e-mail, chave Pix, link...). */
export interface InformacaoDeContato {
  id: string;
  titulo: string;
  /** Opcional: sem descrição a tela não mostra a linha. */
  descricao: string | null;
  valor: string;
}

export interface DadosDaInformacao {
  titulo: string;
  descricao: string;
  valor: string;
}
