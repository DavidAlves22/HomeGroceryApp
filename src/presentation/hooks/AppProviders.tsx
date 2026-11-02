import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import type { Sessao } from '../../application/dtos/sessao';
import type { Container } from '../../di/container';

const ContainerContexto = createContext<Container | null>(null);

export function useContainer(): Container {
  const container = useContext(ContainerContexto);
  if (!container) throw new Error('useContainer fora do ContainerProvider.');
  return container;
}

export function ContainerProvider({
  container,
  children,
}: {
  container: Container;
  children: React.ReactNode;
}) {
  return <ContainerContexto.Provider value={container}>{children}</ContainerContexto.Provider>;
}

interface SessaoContextoValor {
  sessao: Sessao | null;
  definirSessao: (sessao: Sessao | null) => void;
}

const SessaoContexto = createContext<SessaoContextoValor | null>(null);

export function useSessao(): SessaoContextoValor {
  const valor = useContext(SessaoContexto);
  if (!valor) throw new Error('useSessao fora do SessaoProvider.');
  return valor;
}

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const valor = useMemo(() => ({ sessao, definirSessao: setSessao }), [sessao]);
  return <SessaoContexto.Provider value={valor}>{children}</SessaoContexto.Provider>;
}

interface MercadoAtualValor {
  /** Mercado escolhido para a compra de hoje (a lista usa para dizer onde cada item foi comprado). */
  mercadoId: string | null;
  definirMercado: (id: string | null) => void;
}

const MercadoAtualContexto = createContext<MercadoAtualValor | null>(null);

export function useMercadoAtual(): MercadoAtualValor {
  const valor = useContext(MercadoAtualContexto);
  if (!valor) throw new Error('useMercadoAtual fora do MercadoAtualProvider.');
  return valor;
}

export function MercadoAtualProvider({ children }: { children: React.ReactNode }) {
  const [mercadoId, definirMercado] = useState<string | null>(null);
  const valor = useMemo(() => ({ mercadoId, definirMercado }), [mercadoId]);
  return <MercadoAtualContexto.Provider value={valor}>{children}</MercadoAtualContexto.Provider>;
}

export type EstadoDoServidor = 'verificando' | 'acordando' | 'online' | 'offline';

const INTERVALO_DE_NOVA_TENTATIVA_MS = 5000;
const ESPERA_ATE_DIZER_QUE_ESTA_ACORDANDO_MS = 4000;

/**
 * Health check do servidor: roda ao abrir, ao voltar para o primeiro plano e a cada 5 s enquanto
 * estiver fora do ar. Hospedagem gratuita "dorme", então a primeira resposta pode demorar:
 * depois de 4 s sem resposta o estado vira "acordando" para a tela explicar o motivo.
 */
export function useSaudeDoServidor(verificar: (sinal?: AbortSignal) => Promise<boolean>) {
  const [estado, setEstado] = useState<EstadoDoServidor>('verificando');
  const emVoo = useRef(false);

  const checar = useCallback(async () => {
    if (emVoo.current) return;
    emVoo.current = true;
    const aviso = setTimeout(
      () => setEstado((e) => (e === 'online' ? e : 'acordando')),
      ESPERA_ATE_DIZER_QUE_ESTA_ACORDANDO_MS,
    );
    try {
      const ok = await verificar();
      setEstado(ok ? 'online' : 'offline');
    } finally {
      clearTimeout(aviso);
      emVoo.current = false;
    }
  }, [verificar]);

  useEffect(() => {
    void checar();
  }, [checar]);

  useEffect(() => {
    if (estado !== 'offline') return;
    const id = setInterval(() => void checar(), INTERVALO_DE_NOVA_TENTATIVA_MS);
    return () => clearInterval(id);
  }, [estado, checar]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const aoVoltar = () => {
        if (document.visibilityState === 'visible') void checar();
      };
      document.addEventListener('visibilitychange', aoVoltar);
      window.addEventListener('online', aoVoltar);
      return () => {
        document.removeEventListener('visibilitychange', aoVoltar);
        window.removeEventListener('online', aoVoltar);
      };
    }
    const assinatura = AppState.addEventListener('change', (s) => {
      if (s === 'active') void checar();
    });
    return () => assinatura.remove();
  }, [checar]);

  return { estado, tentarAgora: checar };
}
