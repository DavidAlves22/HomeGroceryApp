import type { MercadoResumo } from '../entities/mercados';
import type { ItemDaLista } from '../entities/tipos';

export interface FatiaDaCompra {
  /** Vazio para "outro mercado" e "sem mercado informado". */
  lojaId: string | null;
  nome: string;
  quantidade: number;
}

export interface DivisaoDaCompra {
  fatias: FatiaDaCompra[];
  faltam: number;
}

/**
 * Quantos itens já foram comprados em cada mercado e quantos ainda faltam. Mercados sem nenhuma compra
 * não aparecem. Item comprado num mercado que foi excluído cai em "Outro mercado".
 */
export function dividirCompra(itens: ItemDaLista[], mercados: MercadoResumo[]): DivisaoDaCompra {
  const fatias: FatiaDaCompra[] = [];
  for (const m of mercados) {
    const quantidade = itens.filter((i) => i.comprado && i.compradoNaLojaId === m.id).length;
    if (quantidade > 0) fatias.push({ lojaId: m.id, nome: m.nome, quantidade });
  }

  const conhecidos = new Set(mercados.map((m) => m.id));
  const comprados = itens.filter((i) => i.comprado);
  const semMercado = comprados.filter((i) => !i.compradoNaLojaId).length;
  const outro = comprados.filter(
    (i) => i.compradoNaLojaId && !conhecidos.has(i.compradoNaLojaId),
  ).length;
  if (outro > 0) fatias.push({ lojaId: null, nome: 'Outro mercado', quantidade: outro });
  if (semMercado > 0)
    fatias.push({ lojaId: null, nome: 'Sem mercado informado', quantidade: semMercado });

  return { fatias, faltam: itens.filter((i) => !i.comprado).length };
}

/** O mercado em uso: o escolhido ou, se nada foi escolhido (ou ele foi excluído), o primeiro da lista. */
export function mercadoEmUso(
  mercados: MercadoResumo[] | null,
  escolhidoId: string | null,
): MercadoResumo | null {
  if (!mercados || mercados.length === 0) return null;
  return mercados.find((m) => m.id === escolhidoId) ?? mercados[0];
}

/** Itens que ainda faltam e que este mercado ainda não recusou ("Não tem aqui"). */
export function pendentesNoMercado(itens: ItemDaLista[], mercadoId: string): ItemDaLista[] {
  return itens.filter((i) => !i.comprado && !i.semNasLojas.includes(mercadoId));
}
