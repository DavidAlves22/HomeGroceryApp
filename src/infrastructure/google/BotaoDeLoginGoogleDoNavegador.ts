import type { BotaoDeLoginGoogle } from '../../application/ports/google';

const URL_DO_SCRIPT = 'https://accounts.google.com/gsi/client';

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(opcoes: {
        client_id: string;
        callback: (r: { credential?: string }) => void;
      }): void;
      renderButton(elemento: HTMLElement, opcoes: Record<string, unknown>): void;
    };
  };
}

let carregando: Promise<GoogleIdentity> | null = null;

/** Carrega o script do Google uma vez só (o service worker ignora outras origens, então nada fica em cache). */
function carregarScript(): Promise<GoogleIdentity> {
  const pronto = (window as unknown as { google?: GoogleIdentity }).google;
  if (pronto?.accounts?.id) return Promise.resolve(pronto);
  carregando ??= new Promise<GoogleIdentity>((resolver, rejeitar) => {
    const script = document.createElement('script');
    script.src = URL_DO_SCRIPT;
    script.async = true;
    script.onload = () => resolver((window as unknown as { google: GoogleIdentity }).google);
    script.onerror = () => {
      carregando = null;
      rejeitar(new Error('script'));
    };
    document.head.appendChild(script);
  });
  return carregando;
}

export class BotaoDeLoginGoogleDoNavegador implements BotaoDeLoginGoogle {
  suportado() {
    return typeof document !== 'undefined';
  }

  async montar(
    elemento: unknown,
    clienteId: string,
    largura: number,
    aoReceber: (idToken: string) => void,
    aoFalhar: (mensagem: string) => void,
  ) {
    const alvo = elemento as HTMLElement;
    try {
      const google = await carregarScript();
      google.accounts.id.initialize({
        client_id: clienteId,
        callback: (resposta) => {
          if (resposta.credential) aoReceber(resposta.credential);
          else aoFalhar('Não foi possível entrar com o Google. Tente de novo.');
        },
      });
      google.accounts.id.renderButton(alvo, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        locale: 'pt-BR',
        width: largura,
      });
    } catch {
      aoFalhar('Não foi possível carregar o login do Google. Verifique a conexão.');
    }
    return () => {
      alvo.innerHTML = '';
    };
  }
}
