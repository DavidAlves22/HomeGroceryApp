/** Assinatura que o navegador devolve ao aceitar os avisos (endereço do serviço de push e chaves de cifragem). */
export interface AssinaturaDeAvisos {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Cadastro dos avisos no servidor. A chave é nula quando o servidor não tem avisos ligados. */
export interface NotificacoesGateway {
  obterChave(): Promise<string | null>;
  assinar(assinatura: AssinaturaDeAvisos): Promise<void>;
  cancelar(endpoint: string): Promise<void>;
}

/** O que o aparelho sabe fazer: pedir permissão e assinar os avisos (só existe no navegador/PWA). */
export interface AvisosDoDispositivo {
  suportado(): boolean;
  /** 'padrao' = ainda não perguntamos; 'negada' = o usuário bloqueou nas configurações do navegador. */
  permissao(): 'concedida' | 'negada' | 'padrao';
  assinaturaAtual(): Promise<AssinaturaDeAvisos | null>;
  /** Pede a permissão (se preciso) e assina. Devolve null se o usuário negar. */
  assinar(chavePublica: string): Promise<AssinaturaDeAvisos | null>;
  /** Cancela a assinatura deste aparelho e devolve o endereço dela (para o servidor esquecer). */
  cancelar(): Promise<string | null>;
}
