import type { AdminGateway } from '../../application/ports/admin';
import type {
  AdminInsights,
  AdminResumo,
  AdminSeries,
  AdminUsuarios,
} from '../../domain/entities/admin';
import type { ClienteHttp } from '../http/ClienteHttp';

/** Rotas do painel (`/admin`): a API só responde a quem tem o papel Admin; os demais recebem 403. */
export class AdminApiGateway implements AdminGateway {
  constructor(private readonly http: ClienteHttp) {}

  resumo() {
    return this.http.get<AdminResumo>('/admin/resumo');
  }

  series(dias: number) {
    return this.http.get<AdminSeries>(`/admin/series?dias=${dias}`);
  }

  insights() {
    return this.http.get<AdminInsights>('/admin/insights');
  }

  usuarios(pagina: number) {
    return this.http.get<AdminUsuarios>(`/admin/usuarios?pagina=${pagina}`);
  }

  async definirBloqueio(usuarioId: string, bloqueado: boolean) {
    await this.http.put<void>(`/admin/usuarios/${usuarioId}/bloqueio`, { corpo: { bloqueado } });
  }
}
