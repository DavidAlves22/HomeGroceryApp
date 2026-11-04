import jsQR from 'jsqr';
import { Platform } from 'react-native';
import type { LeitorDeQr } from '../../application/ports/camera';

/** Quantas vezes por segundo procurar o QR (mais que isso só gasta bateria). */
const INTERVALO_MS = 150;

/** O que o `BarcodeDetector` do Chrome devolve (a API ainda não está nos tipos do TypeScript). */
interface DetectorDeCodigos {
  detect(origem: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

async function criarDetectorNativo(): Promise<DetectorDeCodigos | null> {
  const Construtor = (
    globalThis as unknown as {
      BarcodeDetector?: {
        new (opcoes: { formats: string[] }): DetectorDeCodigos;
        getSupportedFormats?: () => Promise<string[]>;
      };
    }
  ).BarcodeDetector;
  if (!Construtor) return null;
  try {
    const formatos = (await Construtor.getSupportedFormats?.()) ?? ['qr_code'];
    return formatos.includes('qr_code') ? new Construtor({ formats: ['qr_code'] }) : null;
  } catch {
    return null;
  }
}

/**
 * Lê QR code pela câmera no navegador. Usa o leitor nativo do Chrome (BarcodeDetector) quando existe e o jsQR
 * (biblioteca em JavaScript, grátis) nos demais navegadores, como o Safari do iPhone.
 */
export class LeitorDeQrDoNavegador implements LeitorDeQr {
  suportado() {
    return (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  async iniciar(
    elemento: unknown,
    aoLer: (texto: string) => boolean,
    aoFalhar: (mensagem: string) => void,
  ) {
    const video = elemento as HTMLVideoElement;
    let fluxo: MediaStream | null = null;
    let parado = false;
    let temporizador: ReturnType<typeof setTimeout> | null = null;

    const parar = () => {
      parado = true;
      if (temporizador) clearTimeout(temporizador);
      fluxo?.getTracks().forEach((faixa) => faixa.stop());
      video.srcObject = null;
    };

    try {
      fluxo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (e) {
      const negada = e instanceof Error && /NotAllowed|Permission/i.test(e.name + e.message);
      aoFalhar(
        negada
          ? 'Permita o acesso à câmera para ler o QR da nota.'
          : 'Não foi possível abrir a câmera deste aparelho.',
      );
      return parar;
    }
    if (parado) {
      fluxo.getTracks().forEach((faixa) => faixa.stop());
      return parar;
    }

    video.srcObject = fluxo;
    video.setAttribute('playsinline', 'true');
    try {
      await video.play();
    } catch {
      aoFalhar('Não foi possível mostrar a imagem da câmera.');
      parar();
      return parar;
    }

    const detector = await criarDetectorNativo();
    const tela = document.createElement('canvas');
    const contexto = tela.getContext('2d', { willReadFrequently: true });

    const lerQuadro = async () => {
      if (parado) return;
      try {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          let texto: string | null = null;
          if (detector) {
            texto = (await detector.detect(video))[0]?.rawValue ?? null;
          } else if (contexto) {
            tela.width = video.videoWidth;
            tela.height = video.videoHeight;
            contexto.drawImage(video, 0, 0, tela.width, tela.height);
            const imagem = contexto.getImageData(0, 0, tela.width, tela.height);
            texto = jsQR(imagem.data, imagem.width, imagem.height)?.data ?? null;
          }
          if (texto && aoLer(texto)) {
            parar();
            return;
          }
        }
      } catch {
        // Um quadro que falha na leitura não derruba a câmera: tenta o próximo.
      }
      if (!parado) temporizador = setTimeout(() => void lerQuadro(), INTERVALO_MS);
    };
    void lerQuadro();

    return parar;
  }
}
