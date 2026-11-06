import type { ItemSugerido } from './tipos';

export interface GastoDoMes {
  competencia: string;
  competenciaNome: string;
  estimado: number;
  realizado: number;
  itens: number;
  comprados: number;
  /** Variação do gasto em relação ao mês anterior da série (nulo no primeiro mês). */
  variacaoPercentual: number | null;
}

export interface GastoDaCategoria {
  categoria: string;
  total: number;
  percentual: number;
}

export interface ProdutoFrequente {
  nome: string;
  compras: number;
}

export interface AnaliseDeGastos {
  meses: GastoDoMes[];
  competenciaDasCategorias: string | null;
  categorias: GastoDaCategoria[];
  frequentes: ProdutoFrequente[];
}

export interface PontoDePreco {
  competencia: string;
  competenciaNome: string;
  preco: number;
}

export interface SerieDePreco {
  nome: string;
  /** Unidade em que os preços foram normalizados (g vira Kg, ml vira Litro). */
  unidadeBase: string;
  pontos: PontoDePreco[];
  ultimoPreco: number;
  menorPreco: number;
  maiorPreco: number;
  precoMedio: number;
  variacaoPercentual: number | null;
}

export interface AnaliseDePrecos {
  produtos: SerieDePreco[];
  maioresAumentos: SerieDePreco[];
}

/** Item do modelo (lista padrão) sem compra há muito tempo (GET /analises/avisos). */
export interface ModeloParado {
  itemId: string;
  nome: string;
  ultimaCompra: string;
  diasSemComprar: number;
  descricao: string;
}

export interface AvisosDeRitmo {
  /** O que já está na hora (ou nos próximos 7 dias) pelo ritmo de compra. */
  repor: ItemSugerido[];
  listaPadraoParada: ModeloParado[];
}

export interface PrecoBom {
  nome: string;
  unidadeBase: string;
  ultimoPreco: number;
  precoMedio: number;
  percentualAbaixo: number;
  meses: number;
  descricao: string;
}

export interface ProdutoSazonal {
  chave: string;
  nome: string;
  categoriaNome: string;
  anos: number[];
  descricao: string;
}

export interface ParCasado {
  primeiro: string;
  segundo: string;
  juntos: number;
  descricao: string;
}

/** Padrões do histórico inteiro (GET /analises/padroes). */
export interface PadroesDeCompra {
  precosBons: PrecoBom[];
  sazonais: ProdutoSazonal[];
  casados: ParCasado[];
}

/** Mercado onde o produto costuma ser comprado (chave = nome sem acento e em minúsculas). */
export interface MercadoHabitual {
  chave: string;
  nome: string;
  lojaId: string;
  compras: number;
  total: number;
}

/** Quem costuma comprar a categoria. */
export interface ResponsavelHabitual {
  categoriaId: string;
  categoria: string;
  usuarioId: string;
  compras: number;
  total: number;
}

/** Hábitos do grupo (GET /analises/habitos). */
export interface HabitosDeCompra {
  mercados: MercadoHabitual[];
  responsaveis: ResponsavelHabitual[];
}
