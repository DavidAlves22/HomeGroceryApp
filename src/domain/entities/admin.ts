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
}

export interface AdminUsuarios {
  total: number;
  pagina: number;
  tamanho: number;
  itens: AdminUsuario[];
}
