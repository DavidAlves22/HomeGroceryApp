import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { mensagemParaUsuario } from '../../application/errors';
import type { EventoDeAlteracao } from '../../application/ports/grupo';
import { useAoReceberEvento } from './TempoReal';

const ID_DE_LISTA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Quais avisos em tempo real tornam um dado velho, deduzido da chave do que a tela carrega:
 * listas/histórico/análises mudam com eventos de lista; cadastros (lista padrão, categorias, produtos)
 * com eventos de catálogo; o grupo com eventos de membros. Uma lista específica só reage à própria lista.
 */
function eventosDa(chave: string): EventoDeAlteracao['tipo'][] {
  if (chave === 'grupo') return ['membros'];
  if (['categorias', 'modelo', 'produtos', 'sugestoes'].includes(chave)) return ['catalogo'];
  // Mercados e seus mapas; a rota depende tanto da lista (o que falta) quanto do mapa do mercado.
  if (chave === 'mercados' || chave.startsWith('mercado:')) return ['lojas'];
  if (chave.startsWith('rota:')) return ['lista', 'lojas'];
  return ['lista'];
}

function dizRespeitoA(chave: string, evento: EventoDeAlteracao): boolean {
  if (evento.tipo !== 'lista' || !ID_DE_LISTA.test(chave)) return true;
  return !evento.listaId || evento.listaId === chave;
}

/**
 * Carrega dados do servidor e os mantém atualizados: recarrega quando a tela volta ao foco e quando
 * chega um aviso em tempo real de que outra pessoa do grupo mudou algo. O spinner só aparece na
 * primeira carga; as seguintes atualizam em silêncio.
 * `chave` identifica o que está sendo carregado: ao mudar (ex.: outro id de lista), busca de novo.
 */
export function useCarregar<T>(buscar: () => Promise<T>, chave: string) {
  const [dados, definirDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;
  const jaCarregou = useRef(false);

  const recarregar = useCallback(async () => {
    if (!jaCarregou.current) setCarregando(true);
    try {
      definirDados(await buscarRef.current());
      setErro(null);
      jaCarregou.current = true;
    } catch (e) {
      setErro(mensagemParaUsuario(e));
    } finally {
      setCarregando(false);
    }
    // `chave` entra de propósito: é ela que faz a função mudar e a busca repetir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  useFocusEffect(
    useCallback(() => {
      void recarregar();
    }, [recarregar]),
  );

  useAoReceberEvento(eventosDa(chave), (evento) => {
    if (dizRespeitoA(chave, evento)) void recarregar();
  });

  return { dados, definirDados, erro, carregando, recarregar };
}
