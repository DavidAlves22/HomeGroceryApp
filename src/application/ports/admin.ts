import type { AdminResumo, AdminSeries, AdminUsuarios } from '../../domain/entities/admin';

export interface AdminGateway {
  resumo(): Promise<AdminResumo>;
  series(dias: number): Promise<AdminSeries>;
  usuarios(pagina: number): Promise<AdminUsuarios>;
}
