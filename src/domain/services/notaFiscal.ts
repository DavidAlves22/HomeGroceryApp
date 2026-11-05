import type { ItemDaLista, Unidade } from '../entities/tipos';
import { normalizar } from './organizacao';

/** Um item como está na nota fiscal (NFC-e). */
export interface ItemDaNota {
  nome: string;
  /** Código do produto no mercado ("AR075346"): não muda de uma compra para outra. */
  codigo: string;
  quantidade: number;
  /** Unidade escrita na nota ("UND9", "KG9"). */
  unidadeNaNota: string;
  valorUnitario: number;
  valorTotal: number;
}

export interface NotaLida {
  mercado: { nome: string | null; cnpj: string | null };
  itens: ItemDaNota[];
  /** "Valor a pagar" da nota, quando aparece. */
  totalDaNota: number | null;
  avisos: string[];
}

/** "1.234,56" → 1234.56; "69,9" → 69.9. Sem vírgula, o ponto é o decimal ("0.48"). */
export function lerNumero(texto: string): number {
  const limpo = texto.trim();
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  return Number(normal);
}

const arredondar2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Lê o texto copiado da página da NFC-e (o que abre pelo QR da nota). O formato que o navegador entrega é:
 *
 *   NOME DO PRODUTO (Código: AR002452 )
 *   Qtde.:1   UN: UND9   Vl. Unit.:   9,5 \tVl. Total
 *   9,50
 *
 * O leitor é tolerante à ordem e a quebras de linha: acha cada "(Código: ...)" e procura quantidade, unidade,
 * valor unitário e total no trecho até o próximo produto.
 *
 * Minas Gerais usa outro desenho, uma linha por produto e sem valor unitário:
 *
 *   LEITE SERRANIA 1LT (Código: 182333)<TAB>Qtde total de ítens: 1.0000<TAB>UN: UN<TAB>Valor total R$: R$ 5,89
 *
 * Nele o unitário sai de total ÷ quantidade, e o mesmo produto bipado várias vezes (mesmo código) vira um item só.
 */
export function lerNotaFiscal(texto: string): NotaLida {
  const bruto = texto.replace(/\r/g, '').replace(/ /g, ' ');
  const avisos: string[] = [];

  const cnpjAchado = /CNPJ:?\s*([\d./-]{14,18})/i.exec(bruto)?.[1] ?? null;
  const primeiraLinha = bruto
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !/^cnpj/i.test(l));

  // Cada produto tem um "(Código: X )". O nome é o texto antes dele; começa depois do "Vl. Total <valor>" do produto
  // anterior ou, no primeiro (ou se o texto vier sem esse trecho), na linha do próprio código.
  const ancoras = [...bruto.matchAll(/\(\s*C[óo]digo:\s*([^)\s]+)\s*\)/gi)];
  const inicioDoNome = (de: number, ate: number) => {
    const espaco = bruto.slice(de, ate);
    const totalAntes = [...espaco.matchAll(/Vl\.?\s*Total:?\s*[\d.,]+/gi)].pop();
    if (totalAntes) return de + (totalAntes.index ?? 0) + totalAntes[0].length;
    const quebra = espaco.lastIndexOf('\n');
    return quebra === -1 ? de : de + quebra + 1;
  };
  const comecos = ancoras.map((a, i) =>
    inicioDoNome(
      i === 0 ? 0 : (ancoras[i - 1].index ?? 0) + ancoras[i - 1][0].length,
      a.index ?? 0,
    ),
  );

  const itens: ItemDaNota[] = [];
  ancoras.forEach((ancora, i) => {
    const nome = bruto.slice(comecos[i], ancora.index ?? 0).trim();
    const fimDoCabecalho = (ancora.index ?? 0) + ancora[0].length;
    const trecho = bruto.slice(
      fimDoCabecalho,
      i + 1 < ancoras.length ? comecos[i + 1] : bruto.length,
    );

    const quantidade =
      /Qtde\.?:?\s*([\d.,]+)/i.exec(trecho)?.[1] ??
      /Qtde\s+total\s+de\s+[íi]tens:?\s*([\d.,]+)/i.exec(trecho)?.[1];
    const unidade = /\bUN:?\s*([A-Za-z0-9]+)/i.exec(trecho)?.[1];
    const unitario = /Vl\.?\s*Unit\.?:?\s*([\d.,]+)/i.exec(trecho)?.[1];
    const total =
      /Vl\.?\s*Total:?\s*([\d.,]+)/i.exec(trecho)?.[1] ??
      /Valor\s+total\s*R?\$?:?\s*R?\$?\s*([\d.,]+)/i.exec(trecho)?.[1];
    if (!quantidade || (!unitario && !total)) {
      avisos.push(`Não consegui ler a quantidade ou o valor de "${nome}".`);
      return;
    }

    const q = lerNumero(quantidade);
    const u = unitario ? lerNumero(unitario) : arredondar2(lerNumero(total ?? '0') / q);
    itens.push({
      nome,
      codigo: ancora[1].trim(),
      quantidade: q,
      unidadeNaNota: unidade ?? 'UND',
      valorUnitario: u,
      // Sem o "Vl. Total" no texto, usa quantidade x unitário (como a nota calcula).
      valorTotal: total ? lerNumero(total) : arredondar2(q * u),
    });
  });

  // No rodapé de Minas o total vem em "Valor total R$" e a contagem em "Qtde total de ítens", cada um com o número
  // na linha de baixo (as linhas dos produtos têm esses mesmos rótulos, mas com o valor na mesma linha).
  const totalDaNota =
    /Valor\s+a\s+pagar\s*R?\$?:?\s*([\d.,]+)/i.exec(bruto)?.[1] ??
    // "Valor pago" já desconta promoções; "Valor total" é a soma dos itens (63,91 contra 63,63 na nota de teste).
    /Valor\s+pago\s*R\$\s*\n\s*([\d.,]+)/i.exec(bruto)?.[1] ??
    /Valor\s+total\s*R\$\s*\n\s*([\d.,]+)/i.exec(bruto)?.[1];
  const quantosDizAhNota =
    /Qtd\.?\s*total\s*de\s*itens:?\s*(\d+)/i.exec(bruto)?.[1] ??
    /Qtde\s+total\s+de\s+[íi]tens\s*\n\s*(\d+)/i.exec(bruto)?.[1];
  const linhasLidas = itens.length;
  if (linhasLidas === 0) avisos.push('Não encontrei nenhum item. Cole o texto da nota inteira.');
  else if (quantosDizAhNota && Number(quantosDizAhNota) !== linhasLidas) {
    avisos.push(`A nota diz ${quantosDizAhNota} itens e consegui ler ${linhasLidas}. Confira.`);
  }

  return {
    mercado: { nome: primeiraLinha ?? null, cnpj: cnpjAchado },
    itens: /Vl\.?\s*Unit/i.test(bruto) ? itens : juntarMesmoCodigo(itens),
    totalDaNota: totalDaNota ? lerNumero(totalDaNota) : null,
    avisos,
  };
}

/** Junta as linhas de um mesmo produto (mesmo código): soma quantidade e total; o unitário vira total ÷ quantidade. */
function juntarMesmoCodigo(itens: ItemDaNota[]): ItemDaNota[] {
  const porCodigo = new Map<string, ItemDaNota>();
  for (const item of itens) {
    const existente = porCodigo.get(item.codigo);
    if (!existente) {
      porCodigo.set(item.codigo, { ...item });
      continue;
    }
    existente.quantidade = Math.round((existente.quantidade + item.quantidade) * 1000) / 1000;
    existente.valorTotal = arredondar2(existente.valorTotal + item.valorTotal);
    existente.valorUnitario = arredondar2(existente.valorTotal / existente.quantidade);
  }
  return [...porCodigo.values()];
}

/** O preço unitário que vai para o app (2 casas). Se a nota usa mais casas, usa total ÷ quantidade para o total fechar. */
export function precoParaOApp(item: ItemDaNota): number {
  const casas = (item.valorUnitario.toString().split('.')[1] ?? '').length;
  return casas <= 2 ? item.valorUnitario : arredondar2(item.valorTotal / item.quantidade);
}

export function unidadeDaNota(unidadeNaNota: string): Unidade {
  const un = unidadeNaNota.toUpperCase();
  if (un.startsWith('KG')) return 'Kg';
  if (un === 'G' || un.startsWith('GR')) return 'G';
  if (un === 'L' || un.startsWith('LT')) return 'Litro';
  if (un.startsWith('ML')) return 'Ml';
  if (un.startsWith('PC')) return 'Pacote';
  if (un.startsWith('CX')) return 'Caixa';
  return 'Unidade';
}

// --- Sugestão de pares entre a nota e a lista -------------------------------------------------------------

/** Abreviações comuns de nota fiscal que o casamento por prefixo não pega. */
const ABREVIACOES: Record<string, string> = {
  qjo: 'queijo',
  mist: 'mistura',
  refri: 'refrigerante',
  achoc: 'achocolatado',
  detg: 'detergente',
  sab: 'sabao',
  papel: 'papel',
  hig: 'higienico',
  mus: 'mussarela',
  mucar: 'mucarela',
};

/** Unidades escritas soltas na nota ("PAD BISNAGUINHA kg"): não dizem qual é o produto. */
const UNIDADES = new Set([
  'kg',
  'kgs',
  'quilo',
  'quilos',
  'kilo',
  'kilos',
  'g',
  'gr',
  'grs',
  'grama',
  'gramas',
  'l',
  'lt',
  'lts',
  'litro',
  'litros',
  'ml',
  'mililitro',
  'mililitros',
  'un',
  'und',
  'unid',
  'unidade',
  'unidades',
  'pct',
  'cx',
]);

function palavras(nome: string): string[] {
  return (
    normalizar(nome)
      .split(/[^a-z0-9]+/)
      // Fora o que é medida ("100G", "1LT", "kg"): a nota põe tamanho no nome e a lista normalmente não.
      .filter((t) => t.length >= 2 && !/\d/.test(t) && !UNIDADES.has(t))
      .map((t) => ABREVIACOES[t] ?? t)
  );
}

const casam = (a: string, b: string) =>
  a === b || (a.length >= 3 && b.startsWith(a)) || (b.length >= 3 && a.startsWith(b));

/** 0 a 1: quantas palavras casam (igual ou abreviada por prefixo) dividido pelo maior dos dois nomes. */
export function semelhanca(nomeDaNota: string, nomeDoItem: string): number {
  const a = palavras(nomeDaNota);
  const b = palavras(nomeDoItem);
  if (a.length === 0 || b.length === 0) return 0;
  const usadas = new Set<number>();
  let iguais = 0;
  for (const palavra of a) {
    const j = b.findIndex((outra, k) => !usadas.has(k) && casam(palavra, outra));
    if (j !== -1) {
      usadas.add(j);
      iguais++;
    }
  }
  const base = iguais / Math.max(a.length, b.length);
  // Item da lista com duas palavras ou mais inteiro dentro do nome da nota ("Batata Palha" em "BATATA PALHA CROQUES
  // CEBOLA E SALSA"): a nota só acrescenta marca e sabor. Uma palavra só ("Biscoito") continua exigindo mais.
  if (b.length >= 2 && iguais === b.length) return 0.5 + base / 2;
  return base;
}

export const SEMELHANCA_MINIMA = 0.5;

export type OrigemDoPar = 'vinculo' | 'nome';

export interface ParSugerido {
  itemId: string;
  origem: OrigemDoPar;
}

/**
 * Para cada item da nota, sugere o item da lista:
 * 1) pelo código do mercado já ensinado antes (`vinculos`: código → produto) — é o mais confiável;
 * 2) senão, pelo nome parecido, sem repetir o mesmo item da lista (do melhor par para o pior).
 * Quem não casa fica fora do resultado: o app propõe "item novo".
 */
export function sugerirPares(
  itensDaNota: ItemDaNota[],
  itensDaLista: ItemDaLista[],
  vinculos: Map<string, string>,
): Map<number, ParSugerido> {
  const pares = new Map<number, ParSugerido>();
  const usados = new Set<string>();

  itensDaNota.forEach((nota, indice) => {
    const produtoId = vinculos.get(nota.codigo);
    const item = produtoId ? itensDaLista.find((i) => i.produtoId === produtoId) : undefined;
    if (item) pares.set(indice, { itemId: item.id, origem: 'vinculo' });
  });

  const candidatos: { indice: number; itemId: string; nota: number }[] = [];
  itensDaNota.forEach((nota, indice) => {
    if (pares.has(indice)) return;
    for (const item of itensDaLista) {
      const nota2 = semelhanca(nota.nome, item.nome);
      if (nota2 >= SEMELHANCA_MINIMA) candidatos.push({ indice, itemId: item.id, nota: nota2 });
    }
  });
  candidatos.sort((x, y) => y.nota - x.nota);
  for (const c of candidatos) {
    if (pares.has(c.indice) || usados.has(c.itemId)) continue;
    pares.set(c.indice, { itemId: c.itemId, origem: 'nome' });
    usados.add(c.itemId);
  }
  return pares;
}

/** "M.PIZZA M.LEVE FRIG." → "M.pizza M.leve Frig." : letras minúsculas com inicial maiúscula por palavra. */
export function nomeLegivel(nomeDaNota: string): string {
  return nomeDaNota
    .toLowerCase()
    .replace(
      /(^|[\s.])(\p{L})/gu,
      (_t, antes: string, letra: string) => antes + letra.toUpperCase(),
    )
    .replace(/\s+/g, ' ')
    .trim();
}
