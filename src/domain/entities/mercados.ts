import type { ItemDaLista } from './tipos';

/** A = cima (gôndola horizontal) ou esquerda (vertical); B = baixo ou direita. */
export type LadoDaSecao = 'A' | 'B';

/** Uma célula da grade do mercado (cada célula vale cerca de 1,5 m). */
export interface Ponto {
  x: number;
  y: number;
}

/** Retângulo na grade, em células. x e y são o canto de cima à esquerda. */
export interface Area {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/**
 * Prateleira ou gôndola. Gôndola "dividida" tem dois lados (ex.: Molhos de um e Copos descartáveis do
 * outro): cada lado tem nome e categorias próprios, e a rota para no corredor do lado certo.
 * Uma categoria pode estar em vários lugares do mesmo mercado.
 */
export interface Secao {
  id: string;
  nome: string;
  nomeLadoB: string | null;
  dividida: boolean;
  area: Area;
  categoriasLadoA: string[];
  categoriasLadoB: string[];
}

export interface Mercado {
  id: string;
  nome: string;
  largura: number;
  altura: number;
  entrada: Ponto;
  caixas: Area;
  secoes: Secao[];
  versao: number;
}

export interface MercadoResumo {
  id: string;
  nome: string;
  largura: number;
  altura: number;
  secoes: number;
  versao: number;
}

/** O desenho do mercado como o editor o manipula (sem id nem versão do servidor). */
export interface MapaEmEdicao {
  nome: string;
  largura: number;
  altura: number;
  entrada: Ponto;
  caixas: Area;
  secoes: Secao[];
}

export interface ParadaDaRota {
  secaoId: string;
  nome: string;
  lado: LadoDaSecao | null;
  ladoTexto: string | null;
  posicao: Ponto;
  distanciaEmMetros: number;
  itens: ItemDaLista[];
}

/** SemSecao: o mercado não tem lugar para a categoria. NaoTemNaLoja: marcado como "Não tem aqui". */
export type MotivoForaDaRota = 'SemSecao' | 'NaoTemNaLoja';

export interface ItemForaDaRota {
  item: ItemDaLista;
  motivo: MotivoForaDaRota;
}

/** Item pendente que ficou fora da rota porque outra pessoa do grupo vai pegar. */
export interface ItemDeOutraPessoa {
  item: ItemDaLista;
  usuarioId: string;
}

/** Lugar que o usuário marcou para o produto de um item neste mercado (vale mais que a categoria). */
export interface LocalDoItem {
  itemId: string;
  secaoId: string;
  lado: LadoDaSecao;
}

/** Onde outra pessoa da divisão está e o trajeto que ainda falta para ela (aparece em cinza no mapa de quem acompanha). */
export interface RotaDeOutraPessoa {
  usuarioId: string;
  posicao: Ponto;
  trilha: Ponto[];
  itensRestantes: number;
}

export interface Rota {
  lojaId: string;
  posicao: Ponto;
  paradas: ParadaDaRota[];
  trilha: Ponto[];
  distanciaEmMetros: number;
  economiaEmMetros: number;
  tempoEstimadoEmMinutos: number;
  foraDaRota: ItemForaDaRota[];
  jaCompradosEmOutrosMercados: number;
  locaisProprios: LocalDoItem[];
  comOutrasPessoas: ItemDeOutraPessoa[];
  rotasDeOutrasPessoas: RotaDeOutraPessoa[];
}
