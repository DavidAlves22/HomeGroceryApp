import type { Sessao } from '../../application/dtos/sessao';
import type { GrupoGateway } from '../../application/ports/grupo';
import type { Convite, Grupo } from '../../domain/entities/grupo';
import type { ClienteHttp } from '../http/ClienteHttp';

export class GrupoApiGateway implements GrupoGateway {
  constructor(private readonly http: ClienteHttp) {}

  obter() {
    return this.http.get<Grupo>('/grupo');
  }

  async renomear(nome: string) {
    await this.http.put<void>('/grupo', { corpo: { nome } });
  }

  criarConvite() {
    return this.http.post<Convite>('/grupo/convites');
  }

  entrar(codigo: string) {
    return this.http.post<Sessao>('/grupo/entrar', { corpo: { codigo } });
  }

  sair() {
    return this.http.post<Sessao>('/grupo/sair');
  }

  async removerMembro(usuarioId: string) {
    await this.http.delete<void>(`/grupo/membros/${usuarioId}`);
  }
}
