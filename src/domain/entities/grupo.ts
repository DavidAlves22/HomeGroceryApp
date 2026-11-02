export type PapelNoGrupo = 'Administrador' | 'Membro';

export interface Membro {
  usuarioId: string;
  nome: string;
  papel: PapelNoGrupo;
  /** Este membro é o usuário que está usando o app. */
  voce: boolean;
  entrouEm: string;
}

export interface Grupo {
  id: string;
  nome: string;
  /** Há mais de uma pessoa no grupo (família). Sozinho = grupo pessoal. */
  compartilhado: boolean;
  meuPapel: PapelNoGrupo;
  membros: Membro[];
}

export interface Convite {
  /** Código para digitar, no formato K7M2-XQ9P. */
  codigo: string;
  expiraEm: string;
}

/** Nome de cada pessoa do grupo pelo id, para mostrar "Ana marcou" nos itens. */
export function nomesDosMembros(grupo: Grupo | null): Map<string, string> {
  return new Map((grupo?.membros ?? []).map((m) => [m.usuarioId, m.nome]));
}

/** Tira espaços e hífen e põe em maiúsculas: "k7m2 xq9p" vira "K7M2XQ9P". */
export function normalizarCodigo(texto: string): string {
  return texto.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
