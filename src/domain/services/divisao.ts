import type { Membro } from '../entities/grupo';
import type { DivisaoDaCategoria, ItemDaLista } from '../entities/tipos';

export interface CategoriaDaLista {
  id: string;
  nome: string;
}

/** Categorias que existem na lista (pelos itens), na ordem em que aparecem. A divisão é por categoria. */
export function categoriasDaListaComId(itens: ItemDaLista[]): CategoriaDaLista[] {
  const vistas = new Map<string, string>();
  for (const i of itens)
    if (i.categoriaId && !vistas.has(i.categoriaId)) vistas.set(i.categoriaId, i.categoriaNome);
  return [...vistas.entries()].map(([id, nome]) => ({ id, nome }));
}

/** Define (ou tira, com `null`) a pessoa de uma categoria, sem alterar as outras. */
export function atribuirCategoria(
  divisao: DivisaoDaCategoria[],
  categoriaId: string,
  usuarioId: string | null,
): DivisaoDaCategoria[] {
  const restantes = divisao.filter((d) => d.categoriaId !== categoriaId);
  return usuarioId ? [...restantes, { categoriaId, usuarioId }] : restantes;
}

/** Quem pega a categoria; null = de todos (o que não foi dividido entra na rota de cada pessoa). */
export function responsavelDaCategoria(divisao: DivisaoDaCategoria[], categoriaId: string | null) {
  return divisao.find((d) => d.categoriaId === categoriaId)?.usuarioId ?? null;
}

/** Só vale responsável que ainda é do grupo; quem saiu deixa a categoria de todos, como na API. */
export function divisaoValida(divisao: DivisaoDaCategoria[], membros: Membro[]) {
  const ids = new Set(membros.map((m) => m.usuarioId));
  return divisao.filter((d) => ids.has(d.usuarioId));
}

/** Uma linha por pessoa que recebeu categorias: "Você: Açougue, Padaria". */
export function resumoDaDivisao(
  divisao: DivisaoDaCategoria[],
  categorias: CategoriaDaLista[],
  membros: Membro[],
): { usuarioId: string; nome: string; categorias: string[] }[] {
  const nomeDaCategoria = new Map(categorias.map((c) => [c.id, c.nome]));
  return membros
    .map((m) => ({
      usuarioId: m.usuarioId,
      nome: m.voce ? 'Você' : m.nome.split(' ')[0],
      categorias: divisao
        .filter((d) => d.usuarioId === m.usuarioId && nomeDaCategoria.has(d.categoriaId))
        .map((d) => nomeDaCategoria.get(d.categoriaId)!),
    }))
    .filter((r) => r.categorias.length > 0);
}

/** Rota que a tela abre: a minha quando há divisão (é o que se espera no mercado); sem divisão, a de todos. */
export function rotaInicial(
  divisao: DivisaoDaCategoria[],
  meuId: string | undefined,
): string | null {
  return divisao.length > 0 && meuId ? meuId : null;
}
