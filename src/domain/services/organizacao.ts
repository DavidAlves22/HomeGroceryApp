import { Competencia } from '../valueObjects/Competencia';
import type { ItemDaLista, ListaResumo } from '../entities/tipos';

export type FiltroDeStatus = 'todos' | 'pendentes' | 'comprados';
export type Ordenacao = 'categoria' | 'nome' | 'status';

export interface OpcoesDeVisualizacao {
  busca: string;
  filtro: FiltroDeStatus;
  ordenacao: Ordenacao;
}

export interface GrupoDeItens {
  titulo: string;
  itens: ItemDaLista[];
  comprados: number;
}

/** Minúsculas e sem acento, para "cafe" achar "Café". */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function percentualConcluido(total: number, comprados: number): number {
  return total === 0 ? 0 : Math.round((100 * comprados) / total);
}

export function resumirItens(itens: ItemDaLista[]) {
  const comprados = itens.filter((i) => i.comprado).length;
  return {
    total: itens.length,
    comprados,
    pendentes: itens.length - comprados,
    percentual: percentualConcluido(itens.length, comprados),
  };
}

/** "2" ou "0,5" ou "1,25": até 3 casas, sem zeros sobrando, com vírgula. */
export function formatarQuantidade(quantidade: number): string {
  return quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

/** Lê o que foi digitado ("1,5", "2"). Devolve null se não for um número maior que zero. */
export function lerQuantidade(texto: string): number | null {
  const numero = Number(texto.trim().replace(',', '.'));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/**
 * Aplica busca, filtro e ordenação e devolve os itens já agrupados para a tela.
 * Dentro de cada grupo os pendentes vêm antes dos comprados, para o que falta ficar sempre no alto.
 */
export function organizarItens(
  itens: ItemDaLista[],
  opcoes: OpcoesDeVisualizacao,
  ordemDasCategorias: string[],
): GrupoDeItens[] {
  const busca = normalizar(opcoes.busca);
  const visiveis = itens.filter((i) => {
    if (busca && !normalizar(i.nome).includes(busca)) return false;
    if (opcoes.filtro === 'pendentes') return !i.comprado;
    if (opcoes.filtro === 'comprados') return i.comprado;
    return true;
  });

  const posicaoDaCategoria = (nome: string) => {
    const posicao = ordemDasCategorias.indexOf(nome);
    return posicao === -1 ? Number.MAX_SAFE_INTEGER : posicao;
  };
  const porNome = (a: ItemDaLista, b: ItemDaLista) => a.nome.localeCompare(b.nome, 'pt-BR');
  const pendentesPrimeiro = (a: ItemDaLista, b: ItemDaLista) =>
    Number(a.comprado) - Number(b.comprado) || a.ordem - b.ordem;
  const montar = (titulo: string, lista: ItemDaLista[]): GrupoDeItens => ({
    titulo,
    itens: lista,
    comprados: lista.filter((i) => i.comprado).length,
  });

  if (opcoes.ordenacao === 'nome') {
    return visiveis.length === 0 ? [] : [montar('Todos os produtos', [...visiveis].sort(porNome))];
  }

  if (opcoes.ordenacao === 'status') {
    const ordenar = (a: ItemDaLista, b: ItemDaLista) =>
      posicaoDaCategoria(a.categoriaNome) - posicaoDaCategoria(b.categoriaNome) || porNome(a, b);
    const grupos = [
      montar('Pendentes', visiveis.filter((i) => !i.comprado).sort(ordenar)),
      montar('Comprados', visiveis.filter((i) => i.comprado).sort(ordenar)),
    ];
    return grupos.filter((g) => g.itens.length > 0);
  }

  const porCategoria = new Map<string, ItemDaLista[]>();
  for (const item of visiveis) {
    porCategoria.set(item.categoriaNome, [...(porCategoria.get(item.categoriaNome) ?? []), item]);
  }
  return [...porCategoria.entries()]
    .sort(
      ([a], [b]) => posicaoDaCategoria(a) - posicaoDaCategoria(b) || a.localeCompare(b, 'pt-BR'),
    )
    .map(([titulo, lista]) => montar(titulo, [...lista].sort(pendentesPrimeiro)));
}

/**
 * Qual lista mostrar como "a do momento": a principal do mês atual; senão qualquer lista do mês atual;
 * senão a lista em andamento mais recente. Sem nenhuma, devolve null (o app convida a criar uma).
 */
export function escolherListaAtual(resumos: ListaResumo[], hoje: Competencia): ListaResumo | null {
  const doMes = resumos.filter((r) => r.competencia === hoje.chave);
  const principal = doMes.find((r) => r.principal);
  if (principal) return principal;
  if (doMes.length > 0) return doMes[0];

  const emAndamento = resumos
    .filter((r) => r.status === 'EmAndamento')
    .sort((a, b) => b.competencia.localeCompare(a.competencia));
  return emAndamento[0] ?? null;
}

export function existePrincipalNoMes(resumos: ListaResumo[], competencia: string): boolean {
  return resumos.some((r) => r.competencia === competencia && r.principal);
}
