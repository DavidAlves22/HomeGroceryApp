import type { LocalDoItem, LocalSugerido } from '../entities/mercados';

/**
 * Texto da sugestão de local: quantos grupos DIFERENTES (famílias) acharam o produto naquele lugar. Nunca diz quem.
 * Fica como sugestão, não como fato: quem marca o próprio local passa a valer só o dele.
 */
export function textoDaSugestao(grupos: number): string {
  if (grupos <= 1) return 'Outra pessoa achou aqui';
  return `${grupos} pessoas acharam aqui`;
}

/** O que "Achei aqui" grava: o lugar sugerido vira o local do próprio grupo (e conta como confirmação). */
export function localDaSugestao(sugestao: LocalSugerido): {
  secaoId: string;
  lado: LocalDoItem['lado'];
} {
  return { secaoId: sugestao.secaoId, lado: sugestao.lado };
}

/** Sugestão de um item, só enquanto o grupo ainda não marcou o próprio local do produto. */
export function sugestaoDoItem(
  itemId: string,
  sugeridos: LocalSugerido[] | undefined,
  proprios: LocalDoItem[] | undefined,
): LocalSugerido | null {
  if ((proprios ?? []).some((l) => l.itemId === itemId)) return null;
  return (sugeridos ?? []).find((l) => l.itemId === itemId) ?? null;
}
