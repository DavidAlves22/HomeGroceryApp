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

export interface ContatoGateway {
  /** As informações do card de contato, na ordem em que o administrador as cadastrou. */
  informacoes(): Promise<InformacaoDeContato[]>;
  minhasMensagens(): Promise<MinhasMensagens>;
  enviar(dados: NovaMensagem): Promise<MensagemDeContato>;
  marcarRespostaComoVista(id: string): Promise<void>;

  // Só o administrador (a API devolve 403 aos demais).
  caixaDoAdmin(): Promise<CaixaDoAdmin>;
  responder(id: string, dados: RespostaDoAdmin): Promise<MensagemParaAdmin>;
  adicionarInformacao(dados: DadosDaInformacao): Promise<InformacaoDeContato>;
  alterarInformacao(id: string, dados: DadosDaInformacao): Promise<InformacaoDeContato>;
  removerInformacao(id: string): Promise<void>;
}
