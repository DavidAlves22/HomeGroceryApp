/**
 * Leitor de QR code pela câmera do aparelho (só existe na PWA, no navegador). O `video` é o elemento de vídeo
 * onde a imagem aparece: fica opaco aqui porque a camada de aplicação não conhece a tela.
 */
export interface LeitorDeQr {
  suportado(): boolean;
  /**
   * Liga a câmera traseira no `video` e procura QR codes. Cada texto lido vai para `aoLer`; se devolver `true` a
   * leitura termina. Devolve a função que desliga a câmera. Falhas (permissão negada, sem câmera) vão para `aoFalhar`.
   */
  iniciar(
    video: unknown,
    aoLer: (texto: string) => boolean,
    aoFalhar: (mensagem: string) => void,
  ): Promise<() => void>;
}
