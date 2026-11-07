export type Unidade = 'Unidade' | 'Kg' | 'G' | 'Litro' | 'Ml' | 'Pacote' | 'Caixa';

export const UNIDADES: { valor: Unidade; rotulo: string }[] = [
  { valor: 'Unidade', rotulo: 'unidade' },
  { valor: 'Kg', rotulo: 'kg' },
  { valor: 'G', rotulo: 'g' },
  { valor: 'Litro', rotulo: 'litro' },
  { valor: 'Ml', rotulo: 'ml' },
  { valor: 'Pacote', rotulo: 'pacote' },
  { valor: 'Caixa', rotulo: 'caixa' },
];

export function rotuloDaUnidade(unidade: Unidade): string {
  return UNIDADES.find((u) => u.valor === unidade)?.rotulo ?? unidade.toLowerCase();
}

export interface Categoria {
  id: string;
  nome: string;
  ordem: number;
  padrao: boolean;
}

export interface Produto {
  id: string;
  nome: string;
  categoriaId: string;
  unidadePadrao: Unidade;
  descricao: string | null;
  favorito: boolean;
}

/** Item da lista padrão (o modelo reutilizável). */
export interface ItemDoModelo {
  id: string;
  nome: string;
  categoriaId: string;
  categoriaNome: string;
  unidade: Unidade;
  quantidade: number;
  ordem: number;
}

export type StatusDaLista = 'EmAndamento' | 'Finalizada';

/**
 * Item de uma lista mensal. Nome, categoria e unidade são um "retrato" do momento em que o item
 * entrou na lista: mudanças posteriores no cadastro não alteram o que foi comprado em meses passados.
 */
export interface ItemDaLista {
  id: string;
  produtoId: string | null;
  nome: string;
  categoriaId: string | null;
  categoriaNome: string;
  unidade: Unidade;
  quantidade: number;
  /** Quanto foi para o carrinho (vazio = igual ao planejado). */
  quantidadeComprada: number | null;
  /** Preço unitário esperado, só referência. */
  precoEstimado: number | null;
  /** Preço unitário efetivamente pago: só ele entra no total gasto. */
  precoUnitario: number | null;
  /** Preço pago em outro mês (ao copiar uma lista). Só consulta: nunca entra no total. */
  precoReferencia: number | null;
  totalEstimado: number;
  totalRealizado: number;
  comprado: boolean;
  compradoEm: string | null;
  compradoPorUsuarioId: string | null;
  adicionadoPorUsuarioId: string;
  ordem: number;
  versao: number;
  /** Mercado onde foi comprado: a compra do mês pode ser dividida entre vários mercados. */
  compradoNaLojaId: string | null;
  /** Mercados que não têm este item ("Não encontrei"). Continua pendente para o próximo mercado. */
  semNasLojas: string[];
}

export interface ListaResumo {
  id: string;
  competencia: string;
  competenciaNome: string;
  nome: string;
  principal: boolean;
  status: StatusDaLista;
  finalizadaEm: string | null;
  totalDeItens: number;
  comprados: number;
  percentual: number;
  totalEstimado: number;
  totalRealizado: number;
}

/** Um item da nota fiscal pronto para importar: casado com um item da lista (itemId) ou novo (categoriaId). */
export interface ItemParaImportar {
  codigo: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  itemId: string | null;
  categoriaId: string | null;
  unidade: Unidade | null;
}

export interface DadosDaNota {
  /** CNPJ do mercado da nota (com ou sem pontuação). */
  cnpj: string | null;
  mercadoId: string | null;
  /** Chave de acesso (44 dígitos) quando a nota foi lida pelo QR: reconhece a mesma nota importada antes. */
  chaveDeAcesso?: string | null;
  itens: ItemParaImportar[];
}

/** "O código X deste mercado é este produto": o que o app já aprendeu das notas anteriores. */
export interface VinculoDaNota {
  codigo: string;
  produtoId: string;
}

/** Quem pega esta categoria nesta ida ao mercado. Categoria fora da divisão é de todos. */
export interface DivisaoDaCategoria {
  categoriaId: string;
  usuarioId: string;
}

export interface Lista {
  resumo: ListaResumo;
  itens: ItemDaLista[];
  divisao: DivisaoDaCategoria[];
}

/** O que o usuário preenche ao criar ou editar um item (da lista padrão ou de uma lista mensal). */
export interface DadosDoItem {
  nome: string;
  categoriaId: string;
  unidade: Unidade;
  quantidade: number;
  /** Só para itens de lista mensal. Valores em reais; null/ausente = sem valor. */
  quantidadeComprada?: number | null;
  precoEstimado?: number | null;
  precoUnitario?: number | null;
}

export type OrigemDaLista = 'Padrao' | 'Zero' | 'Copiar' | 'Sugestao';

/** Produto que o histórico de compras indica para a lista do mês (GET /listas/sugestao). */
export interface ItemSugerido {
  chave: string;
  nome: string;
  categoriaNome: string;
  unidade: Unidade;
  quantidade: number;
  cicloEmDias: number;
  compras: number;
  ultimaCompra: string;
  proximaPrevista: string;
  motivo: 'NoCiclo' | 'Atrasado';
  /** Frase pronta da API explicando a sugestão. */
  descricao: string;
  precoReferencia: number | null;
  categoriaId: string | null;
}

export interface SugestaoDeLista {
  competencia: string;
  itens: ItemSugerido[];
}

export interface DadosDeNovaLista {
  competencia: string;
  nome?: string;
  origem: OrigemDaLista;
  /** Só para origem "Padrao": ids dos itens do modelo escolhidos (ausente = todos). */
  itensDoModeloIds?: string[];
  /** Só para origem "Copiar": a lista que será copiada e (opcional) quais itens dela. */
  listaDeOrigemId?: string;
  itensDeOrigemIds?: string[];
  /** Só para origem "Sugestao": chaves escolhidas (quantidade ausente = a sugerida). */
  itensSugeridos?: { chave: string; quantidade?: number }[];
  permitirDuplicada?: boolean;
}
