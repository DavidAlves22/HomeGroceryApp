import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { mensagemParaUsuario } from '../../application/errors';

/**
 * Carrega dados do servidor e recarrega sempre que a tela volta ao foco (ex.: depois de criar uma
 * lista em outra tela). O spinner só aparece na primeira carga; as seguintes atualizam em silêncio.
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

  return { dados, definirDados, erro, carregando, recarregar };
}
