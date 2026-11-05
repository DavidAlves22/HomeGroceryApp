import type {
  AdminInsights,
  AdminResumo,
  AdminSeries,
  AdminUsuarios,
} from '../../domain/entities/admin';

export interface AdminGateway {
  resumo(): Promise<AdminResumo>;
  series(dias: number): Promise<AdminSeries>;
  insights(): Promise<AdminInsights>;
  usuarios(pagina: number): Promise<AdminUsuarios>;
  definirBloqueio(usuarioId: string, bloqueado: boolean): Promise<void>;
}
