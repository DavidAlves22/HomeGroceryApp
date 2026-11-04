import { Platform } from 'react-native';
import type { AssinaturaDeAvisos, AvisosDoDispositivo } from '../../application/ports/notificacoes';

/** A chave do servidor chega em base64 de URL; o navegador quer os bytes. */
function bytesDaChave(base64Url: string): Uint8Array {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const texto = atob(base64);
  return Uint8Array.from(texto, (c) => c.charCodeAt(0));
}

function paraAssinatura(inscricao: PushSubscription): AssinaturaDeAvisos | null {
  const json = inscricao.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

/**
 * Avisos pelo navegador (Web Push). Só existe na PWA: o service worker (`public/service-worker.js`) recebe o
 * aviso e mostra a notificação mesmo com o app fechado. No Android funciona direto no Chrome; no iPhone só
 * com o app adicionado à tela de início.
 */
export class AvisosDoNavegador implements AvisosDoDispositivo {
  suportado() {
    return (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof window !== 'undefined' &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  permissao() {
    const atual = Notification.permission;
    return atual === 'granted' ? 'concedida' : atual === 'denied' ? 'negada' : 'padrao';
  }

  private async inscricao() {
    const registro = await navigator.serviceWorker.ready;
    return registro.pushManager.getSubscription();
  }

  async assinaturaAtual() {
    const inscricao = await this.inscricao();
    return inscricao ? paraAssinatura(inscricao) : null;
  }

  async assinar(chavePublica: string) {
    if (this.permissao() !== 'concedida') {
      if ((await Notification.requestPermission()) !== 'granted') return null;
    }
    const registro = await navigator.serviceWorker.ready;
    const inscricao =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytesDaChave(chavePublica) as BufferSource,
      }));
    return paraAssinatura(inscricao);
  }

  async cancelar() {
    const inscricao = await this.inscricao();
    if (!inscricao) return null;
    const endpoint = inscricao.endpoint;
    await inscricao.unsubscribe();
    return endpoint;
  }
}
