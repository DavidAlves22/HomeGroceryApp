import type {
  DadosDaInformacao,
  MensagemParaAdmin,
  NovaMensagem,
  StatusDaMensagem,
  TipoDeMensagem,
} from '../entities/contato';

/** Os mesmos limites da API (`MensagemDeContato`); a API confere de novo. */
export const ASSUNTO_MINIMO = 3;
export const ASSUNTO_MAXIMO = 100;
export const TEXTO_MINIMO = 5;
export const TEXTO_MAXIMO = 2000;
export const RESPOSTA_MAXIMA = 2000;
export const TITULO_MAXIMO = 60;
export const DESCRICAO_MAXIMA = 200;
export const VALOR_MAXIMO = 300;

export const TIPOS_DE_MENSAGEM: TipoDeMensagem[] = ['Feedback', 'Solicitacao'];
export const STATUS_DE_MENSAGEM: StatusDaMensagem[] = [
  'Recebida',
  'EmAnalise',
  'Respondida',
  'Concluida',
];

const ROTULOS_DE_TIPO: Record<TipoDeMensagem, string> = {
  Feedback: 'Feedback',
  Solicitacao: 'Solicitação',
};

const ROTULOS_DE_STATUS: Record<StatusDaMensagem, string> = {
  Recebida: 'Recebida',
  EmAnalise: 'Em análise',
  Respondida: 'Respondida',
  Concluida: 'Concluída',
};

export function rotuloDoTipo(tipo: TipoDeMensagem): string {
  return ROTULOS_DE_TIPO[tipo] ?? tipo;
}

export function rotuloDoStatus(status: StatusDaMensagem): string {
  return ROTULOS_DE_STATUS[status] ?? status;
}

/** Mensagem de erro para a tela, ou nulo se pode enviar. Mede o texto já sem espaços nas pontas, como a API. */
export function validarNovaMensagem(dados: NovaMensagem): string | null {
  const assunto = dados.assunto.trim();
  const texto = dados.texto.trim();
  if (assunto.length < ASSUNTO_MINIMO)
    return `Escreva um assunto com pelo menos ${ASSUNTO_MINIMO} letras.`;
  if (assunto.length > ASSUNTO_MAXIMO)
    return `O assunto pode ter no máximo ${ASSUNTO_MAXIMO} caracteres.`;
  if (texto.length < TEXTO_MINIMO)
    return `Escreva a mensagem com pelo menos ${TEXTO_MINIMO} letras.`;
  if (texto.length > TEXTO_MAXIMO)
    return `A mensagem pode ter no máximo ${TEXTO_MAXIMO} caracteres.`;
  return null;
}

/** Título e valor são obrigatórios; a descrição é opcional. Mesmos limites da API (`InformacaoDeContato`). */
export function validarInformacao(dados: DadosDaInformacao): string | null {
  const titulo = dados.titulo.trim();
  const descricao = dados.descricao.trim();
  const valor = dados.valor.trim();
  if (titulo === '') return 'Informe o título.';
  if (titulo.length > TITULO_MAXIMO)
    return `O título pode ter no máximo ${TITULO_MAXIMO} caracteres.`;
  if (descricao.length > DESCRICAO_MAXIMA)
    return `A descrição pode ter no máximo ${DESCRICAO_MAXIMA} caracteres.`;
  if (valor === '') return 'Informe o valor.';
  if (valor.length > VALOR_MAXIMO) return `O valor pode ter no máximo ${VALOR_MAXIMO} caracteres.`;
  return null;
}

/** A mensagem já tem resposta escrita ou foi marcada como respondida/concluída: não está mais esperando. */
export function aguardandoResposta(status: StatusDaMensagem): boolean {
  return status === 'Recebida' || status === 'EmAnalise';
}

export type FiltroDeMensagens = 'aguardando' | 'respondidas' | 'todas';

export const FILTROS_DE_MENSAGENS: { chave: FiltroDeMensagens; rotulo: string }[] = [
  { chave: 'aguardando', rotulo: 'Aguardando' },
  { chave: 'respondidas', rotulo: 'Respondidas' },
  { chave: 'todas', rotulo: 'Todas' },
];

export function filtrarMensagens(
  itens: MensagemParaAdmin[],
  filtro: FiltroDeMensagens,
): MensagemParaAdmin[] {
  if (filtro === 'todas') return itens;
  return itens.filter((m) => aguardandoResposta(m.status) === (filtro === 'aguardando'));
}
