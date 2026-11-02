import type { ItemDaLista } from '../entities/tipos';
import { Dinheiro } from '../valueObjects/Dinheiro';

export interface TotaisPorCategoria {
  categoria: string;
  estimado: Dinheiro;
  realizado: Dinheiro;
}

export interface Totais {
  estimado: Dinheiro;
  realizado: Dinheiro;
  /** Estimado menos realizado. Negativo = passou da estimativa. */
  restante: Dinheiro;
  compradosSemPreco: number;
  porCategoria: TotaisPorCategoria[];
}

/** Quantidade planejada x preço estimado. Sem preço estimado, o item não entra na estimativa. */
export function totalEstimadoDoItem(item: ItemDaLista): Dinheiro {
  return item.precoEstimado === null
    ? Dinheiro.ZERO
    : Dinheiro.deReais(item.precoEstimado).vezes(item.quantidade);
}

/**
 * Quantidade comprada (ou a planejada) x preço pago. Só conta item COMPRADO e com preço pago:
 * um preço de referência nunca vira gasto automaticamente. Espelha `CalculoDeTotais` da API, e é
 * recalculado aqui para a tela atualizar na hora ao marcar um item, sem esperar o servidor.
 */
export function totalRealizadoDoItem(item: ItemDaLista): Dinheiro {
  if (!item.comprado || item.precoUnitario === null) return Dinheiro.ZERO;
  return Dinheiro.deReais(item.precoUnitario).vezes(item.quantidadeComprada ?? item.quantidade);
}

const somar = (valores: Dinheiro[]) => valores.reduce((acc, v) => acc.mais(v), Dinheiro.ZERO);

export function calcularTotais(itens: ItemDaLista[]): Totais {
  const estimado = somar(itens.map(totalEstimadoDoItem));
  const realizado = somar(itens.map(totalRealizadoDoItem));

  const grupos = new Map<string, ItemDaLista[]>();
  for (const item of itens) {
    grupos.set(item.categoriaNome, [...(grupos.get(item.categoriaNome) ?? []), item]);
  }

  return {
    estimado,
    realizado,
    restante: estimado.menos(realizado),
    compradosSemPreco: itens.filter((i) => i.comprado && i.precoUnitario === null).length,
    porCategoria: [...grupos.entries()].map(([categoria, lista]) => ({
      categoria,
      estimado: somar(lista.map(totalEstimadoDoItem)),
      realizado: somar(lista.map(totalRealizadoDoItem)),
    })),
  };
}

/** "+12,5%" / "-3,0%" / "0%". Nulo (sem mês anterior para comparar) vira "-". */
export function formatarVariacao(percentual: number | null): string {
  if (percentual === null) return '-';
  if (percentual === 0) return '0%';
  const texto = Math.abs(percentual).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${percentual > 0 ? '+' : '-'}${texto}%`;
}

/** Lê um campo de preço digitado ("5,50"). Vazio vira null (sem preço); texto inválido, undefined. */
export function lerPreco(texto: string): number | null | undefined {
  if (texto.trim() === '') return null;
  const dinheiro = Dinheiro.deTexto(texto);
  return dinheiro === null || dinheiro.centavos < 0 ? undefined : dinheiro.reais;
}

/** Texto de um preço para preencher o campo de edição ("5,5" vira "5,50"). */
export function precoParaCampo(preco: number | null | undefined): string {
  return preco === null || preco === undefined
    ? ''
    : preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
