import type { ContatoGateway } from '../../application/ports/contato';
import type {
  CaixaDoAdmin,
  DadosDaInformacao,
  InformacaoDeContato,
  MensagemDeContato,
  MensagemParaAdmin,
  MinhasMensagens,
  NovaMensagem,
  RespostaDoAdmin,
} from '../../domain/entities/contato';
import type { ClienteHttp } from '../http/ClienteHttp';

/** `/contato` (qualquer pessoa logada) e as rotas de moderação em `/admin` (só o administrador). */
export class ContatoApiGateway implements ContatoGateway {
  constructor(private readonly http: ClienteHttp) {}

  async informacoes() {
    const resposta = await this.http.get<{ informacoes: InformacaoDeContato[] }>('/contato');
    return resposta.informacoes;
  }

  minhasMensagens() {
    return this.http.get<MinhasMensagens>('/contato/mensagens');
  }

  enviar(dados: NovaMensagem) {
    return this.http.post<MensagemDeContato>('/contato/mensagens', { corpo: dados });
  }

  async marcarRespostaComoVista(id: string) {
    await this.http.put<void>(`/contato/mensagens/${id}/vista`);
  }

  caixaDoAdmin() {
    return this.http.get<CaixaDoAdmin>('/admin/mensagens');
  }

  responder(id: string, dados: RespostaDoAdmin) {
    return this.http.put<MensagemParaAdmin>(`/admin/mensagens/${id}`, { corpo: dados });
  }

  adicionarInformacao(dados: DadosDaInformacao) {
    return this.http.post<InformacaoDeContato>('/admin/contato/informacoes', { corpo: dados });
  }

  alterarInformacao(id: string, dados: DadosDaInformacao) {
    return this.http.put<InformacaoDeContato>(`/admin/contato/informacoes/${id}`, { corpo: dados });
  }

  async removerInformacao(id: string) {
    await this.http.delete<void>(`/admin/contato/informacoes/${id}`);
  }
}
