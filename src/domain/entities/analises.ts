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
