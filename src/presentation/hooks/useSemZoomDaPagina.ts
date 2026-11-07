import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Enquanto `ativo`, a pinça de dedos não dá zoom na PÁGINA (só o mapa trata o gesto, por conta própria).
 * Vale só para as telas com mapa; nas demais o zoom do navegador continua livre. Só na web.
 *
 * Android/Chrome: o `viewport` ganha `user-scalable=no`. iOS ignora isso, então o `gesturestart` também é barrado.
 * Tudo volta ao que era quando a tela fecha.
 */
export function useSemZoomDaPagina(ativo: boolean) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !ativo || typeof document === 'undefined') return;
    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute('content') ?? null;
    if (meta && original) {
      meta.setAttribute('content', `${original}, maximum-scale=1, user-scalable=no`);
    }
    const barrar = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', barrar);
    return () => {
      document.removeEventListener('gesturestart', barrar);
      if (meta && original) meta.setAttribute('content', original);
    };
  }, [ativo]);
}
