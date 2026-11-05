/** Um ponto da série: o dia (AAAA-MM-DD, horário de Brasília) e quanto aconteceu nele. */
export interface PontoDoDia {
  dia: string;
  valor: number;
}

export interface AdminResumo {
  geradoEm: string;
  usuarios: {
    total: number;
    novos7Dias: number;
    novos30Dias: number;
    ativos24Horas: number;
    ativos7Dias: number;
    ativos30Dias: number;
  };
  grupos: { total: number; familias: number };
  listas: { total: number; emAndamento: number; finalizadas: number; gastoTotalFinalizado: number };
  itens: { total: number; comprados: number };
  mercados: number;
  notasImportadas: number;
  aparelhosComAvisos: number;
}

export interface AdminSeries {
  dias: number;
  cadastros: PontoDoDia[];
  listasCriadas: PontoDoDia[];
  itensComprados: PontoDoDia[];
}

export interface AdminUsuario {
  id: string;
  nome: string;
  email: string;
  criadoEm: string;
  ultimoAcessoEm: string | null;
  grupo: string;
  membrosDoGrupo: number;
  listasCriadas: number;
  itensComprados: number;
  /** Quando o administrador bloqueou a conta; nulo = liberada. */
  bloqueadoEm: string | null;
  /** Administrador (papel da configuração do servidor): o painel não oferece bloqueio. */
  ehAdmin: boolean;
}

export interface AdminUsuarios {
  total: number;
  pagina: number;
  tamanho: number;
  itens: AdminUsuario[];
}

export interface AdminRetencao {
  dias: number;
  /** Contas criadas há pelo menos `dias` dias. */
  elegiveis: number;
  /** Dessas, as que ainda abriam o app `dias` dias depois de criar a conta. */
  voltaram: number;
}

export interface AdminFunil {
  contas: number;
  criaramLista: number;
  compraram: number;
  finalizaram: number;
  semAtividade: number;
}

export interface AdminGastoDoMes {
  competencia: string;
  total: number;
  compras: number;
}

export interface AdminItemDeRanking {
  nome: string;
  quantidade: number;
  /** Segundo número opcional (nos produtos: em quantas casas aparece). */
  detalhe: number | null;
}

export type RecursoDoApp = 'familia' | 'divisao' | 'mercado' | 'nota' | 'avisos';

export interface AdminAdocao {
  recurso: RecursoDoApp;
  quantidade: number;
  de: number;
  base: 'grupos' | 'contas';
}

export interface AdminInsights {
  retencao: AdminRetencao[];
  funil: AdminFunil;
  gasto: { compras: number; medio: number; porMes: AdminGastoDoMes[] };
  produtosMaisComprados: AdminItemDeRanking[];
  categoriasMaisCompradas: AdminItemDeRanking[];
  cidadesComMercados: AdminItemDeRanking[];
  mapasMaisCopiados: AdminItemDeRanking[];
  adocao: AdminAdocao[];
}
