import type { SerieDePreco } from '../entities/analises';

export type OrdemDeProdutos = 'meses' | 'variacao' | 'nome';

export const ORDENS_DE_PRODUTOS: { valor: OrdemDeProdutos; rotulo: string }[] = [
  { valor: 'meses', rotulo: 'Mais meses' },
  { valor: 'variacao', rotulo: 'Maior variação' },
  { valor: 'nome', rotulo: 'A–Z' },
];

const porNome = (a: SerieDePreco, b: SerieDePreco) => a.nome.localeCompare(b.nome, 'pt-BR');

/**
 * Ordena os produtos da análise de preços.
 * - `meses`: mais meses de histórico primeiro (é onde o gráfico diz alguma coisa);
 * - `variacao`: maior mudança de preço primeiro, SUBINDO ou DESCENDO (por isso o módulo), comparando as duas últimas
 *   compras; produto com uma compra só (sem variação) vai para o fim;
 * - `nome`: ordem alfabética.
 * Empates sempre se desfazem pelo nome, para a lista não pular de lugar.
 */
export function ordenarProdutos(series: SerieDePreco[], ordem: OrdemDeProdutos): SerieDePreco[] {
  const copia = [...series];
  if (ordem === 'nome') return copia.sort(porNome);
  if (ordem === 'variacao') {
    const forca = (s: SerieDePreco) =>
      s.variacaoPercentual === null ? -1 : Math.abs(s.variacaoPercentual);
    return copia.sort((a, b) => forca(b) - forca(a) || porNome(a, b));
  }
  return copia.sort((a, b) => b.pontos.length - a.pontos.length || porNome(a, b));
}
