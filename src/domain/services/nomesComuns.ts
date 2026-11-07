import type { Categoria, NomeComum, Produto } from '../entities/tipos';
import { normalizar } from './organizacao';

export const LIMITE_DE_NOMES_COMUNS = 4;

/**
 * Nomes que outras pessoas usam, para mostrar sob o que o próprio grupo já tem. Tira o que já foi digitado por inteiro e o que o grupo
 * já mostra (mesmo escrito com outra caixa ou sem acento), para o atalho nunca repetir uma sugestão.
 */
export function nomesComunsParaMostrar(
  comuns: NomeComum[],
  digitado: string,
  produtosDoGrupo: Produto[],
  limite = LIMITE_DE_NOMES_COMUNS,
): NomeComum[] {
  const jaTem = new Set([digitado, ...produtosDoGrupo.map((p) => p.nome)].map(normalizar));
  const vistos = new Set<string>();
  const resultado: NomeComum[] = [];
  for (const comum of comuns) {
    const chave = normalizar(comum.nome);
    if (jaTem.has(chave) || vistos.has(chave)) continue;
    vistos.add(chave);
    resultado.push(comum);
  }
  return resultado.slice(0, limite);
}

/** A categoria do grupo com o mesmo nome da que os outros usam; sem ela, null (o formulário mantém a categoria que já estava). */
export function categoriaDoNomeComum(comum: NomeComum, categorias: Categoria[]): string | null {
  const alvo = normalizar(comum.categoria);
  return categorias.find((c) => normalizar(c.nome) === alvo)?.id ?? null;
}
