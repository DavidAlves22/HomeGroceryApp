import type { MapaCompartilhadoDetalhe } from '../../domain/entities/mercados';
import type {
  AdminInsights,
  AdminMapas,
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
  excluirConta(usuarioId: string): Promise<void>;
  mapas(): Promise<AdminMapas>;
  mapa(id: string): Promise<MapaCompartilhadoDetalhe>;
  excluirMapa(id: string): Promise<void>;
}
