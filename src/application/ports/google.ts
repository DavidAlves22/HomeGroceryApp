/**
 * Botão "Entrar com Google" (Google Identity Services, só no navegador). O `elemento` é onde o botão oficial do
 * Google é desenhado: fica opaco aqui porque a camada de aplicação não conhece a tela.
 */
export interface BotaoDeLoginGoogle {
  suportado(): boolean;
  /**
   * Desenha o botão no `elemento`. Quando a pessoa escolhe a conta, o ID token vai para `aoReceber`; falhas ao
   * carregar o Google vão para `aoFalhar`. Devolve a função que remove o botão.
   */
  montar(
    elemento: unknown,
    clienteId: string,
    largura: number,
    aoReceber: (idToken: string) => void,
    aoFalhar: (mensagem: string) => void,
  ): Promise<() => void>;
}
