import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { EstadoDeConexao, EventoDeAlteracao } from '../../application/ports/grupo';
import { useContainer, useSessao } from './AppProviders';

type Assinante = (evento: EventoDeAlteracao) => void;

interface TempoRealContextoValor {
  estado: EstadoDeConexao;
  assinar: (assinante: Assinante) => () => void;
}

const TempoRealContexto = createContext<TempoRealContextoValor>({
  estado: 'desconectado',
  assinar: () => () => {},
});

export function useTempoReal() {
  return useContext(TempoRealContexto);
}

/**
 * Mantém a conexão em tempo real enquanto há sessão e entrega os eventos às telas interessadas.
 * Cada grupo tem a própria conexão: ao trocar de grupo (entrar/sair da família) a conexão é refeita.
 * Se a conexão cair, o app segue funcionando (online normal) e recarrega tudo ao reconectar.
 */
export function TempoRealProvider({ children }: { children: React.ReactNode }) {
  const { tempoReal, restaurarSessao } = useContainer();
  const { sessao, definirSessao } = useSessao();
  const [estado, setEstado] = useState<EstadoDeConexao>('desconectado');
  const assinantes = useRef(new Set<Assinante>());
  const sessaoAtual = useRef(sessao);
  sessaoAtual.current = sessao;

  const grupoId = sessao?.grupoId;
  useEffect(() => {
    if (!grupoId) return;
    let ativo = true;

    const aoGrupoAlterado = async () => {
      // Fui removido (ou entrei/saí em outro aparelho): renova a sessão para descobrir o grupo certo.
      try {
        const nova = await restaurarSessao.executar();
        if (!ativo || !nova) return;
        if (nova.grupoId !== sessaoAtual.current?.grupoId) definirSessao(nova);
        else assinantes.current.forEach((a) => a({ tipo: 'membros' }));
      } catch {
        // Sem conexão agora: a próxima requisição (401) ou reconexão resolve.
      }
    };

    void tempoReal.conectar(
      (evento) => {
        if (!ativo) return;
        if (evento.tipo === 'grupoAlterado') void aoGrupoAlterado();
        else assinantes.current.forEach((a) => a(evento));
      },
      (novo) => ativo && setEstado(novo),
    );

    return () => {
      ativo = false;
      setEstado('desconectado');
      void tempoReal.desconectar();
    };
  }, [grupoId, tempoReal, restaurarSessao, definirSessao]);

  const valor = useMemo<TempoRealContextoValor>(
    () => ({
      estado,
      assinar: (assinante) => {
        assinantes.current.add(assinante);
        return () => assinantes.current.delete(assinante);
      },
    }),
    [estado],
  );

  return <TempoRealContexto.Provider value={valor}>{children}</TempoRealContexto.Provider>;
}

const ATRASO_PARA_JUNTAR_RAJADAS_MS = 250;

/**
 * Chama `aoReceber` quando chega um evento dos `tipos` pedidos (ou a reconexão). Eventos do próprio
 * usuário são ignorados: a tela dele já mostrou a mudança. Vários eventos seguidos viram uma chamada só.
 */
export function useAoReceberEvento(
  tipos: EventoDeAlteracao['tipo'][],
  aoReceber: (evento: EventoDeAlteracao) => void,
) {
  const { assinar } = useTempoReal();
  const { sessao } = useSessao();
  const euMesmo = sessao?.usuario.id;
  const ultima = useRef(aoReceber);
  ultima.current = aoReceber;
  const chaveDosTipos = tipos.join(',');

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    const desassinar = assinar((evento) => {
      const interessa =
        evento.tipo === 'reconectado' || chaveDosTipos.split(',').includes(evento.tipo);
      const meu = evento.tipo !== 'reconectado' && !!euMesmo && evento.porUsuarioId === euMesmo;
      if (!interessa || meu) return;

      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => ultima.current(evento), ATRASO_PARA_JUNTAR_RAJADAS_MS);
    });
    return () => {
      desassinar();
      if (temporizador) clearTimeout(temporizador);
    };
  }, [assinar, chaveDosTipos, euMesmo]);
}
