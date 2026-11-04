import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * No navegador (PWA) o botão voltar do celular mexe no histórico da PÁGINA: com uma folha aberta (formulário,
 * teclado, câmera, escolha de par...) ele saía da tela inteira, em vez de só fechar a folha. Aqui cada folha aberta
 * ocupa uma entrada própria do histórico, e o voltar a consome e fecha a folha de cima (as folhas se empilham).
 *
 * A entrada extra repete a URL e o \`state\` da atual (inclusive o \`id\` que a navegação usa para se achar no
 * histórico), então, para ela, a navegação não vê nada de diferente. O \`popstate\` é tratado na fase de captura, antes
 * do ouvinte da navegação, que só é avisado quando não há folha aberta.
 *
 * Fechar a folha por um botão desfaz a entrada extra (um \`history.back()\` cujo \`popstate\` também é engolido).
 */
interface Entrada {
  id: number;
  fechar: () => void;
}

const pilha: Entrada[] = [];
let contador = 0;
let aIgnorar = 0;
/** Quantos voltares já foram engolidos: permite saber se o `history.back()` de uma folha chegou a avisar. */
let engolidos = 0;
let instalado = false;

function instalar() {
  if (instalado) return;
  instalado = true;
  window.addEventListener(
    'popstate',
    (evento) => {
      if (aIgnorar > 0) {
        aIgnorar--;
        engolidos++;
        evento.stopImmediatePropagation();
        return;
      }
      const topo = pilha.pop();
      if (!topo) return; // nenhuma folha aberta: o voltar navega normalmente
      evento.stopImmediatePropagation();
      topo.fechar();
    },
    true,
  );
}

/** Faz o botão voltar do navegador fechar a folha (e não a tela) enquanto `aberto` for verdadeiro. */
export function useVoltarFecha(aberto: boolean, aoFechar: () => void) {
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    if (!aberto || Platform.OS !== 'web' || typeof window === 'undefined') return;
    instalar();

    const id = ++contador;
    window.history.pushState(
      { ...(window.history.state ?? {}), voltarFecha: id },
      '',
      window.location.href,
    );
    pilha.push({ id, fechar: () => fechar.current() });

    return () => {
      const indice = pilha.findIndex((e) => e.id === id);
      if (indice === -1) return; // já foi o voltar quem fechou: a entrada do histórico já foi consumida
      pilha.splice(indice, 1);
      // Só desfaz se a nossa entrada ainda é a atual (a navegação pode ter empilhado outra por cima).
      if (window.history.state?.voltarFecha === id) {
        aIgnorar++;
        const antes = engolidos;
        window.history.back();
        // Se o navegador não avisar (sem entrada para voltar), não deixa o contador engolir um voltar de verdade.
        setTimeout(() => {
          if (engolidos === antes && aIgnorar > 0) aIgnorar--;
        }, 600);
      }
    };
  }, [aberto]);
}

/**
 * Quem fecha uma folha e em seguida navega para outra tela precisa esperar: o `history.back()` que desfaz a entrada da
 * folha é assíncrono e, se a navegação empilhar a tela nova antes dele acontecer, ele a desfaz (a URL volta e a tela
 * nova some). Chame depois de fechar a folha e antes de navegar.
 */
export async function aguardarFolhasFecharem() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  await new Promise((resolver) => setTimeout(resolver, 30));
  const limite = Date.now() + 800;
  while (aIgnorar > 0 && Date.now() < limite) {
    await new Promise((resolver) => setTimeout(resolver, 20));
  }
}
