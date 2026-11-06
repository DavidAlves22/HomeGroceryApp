import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Categoria } from '../../domain/entities/tipos';
import { useContainer } from './AppProviders';
import { useToast } from './Toast';

/**
 * Cria uma categoria no servidor e a acrescenta à lista da tela (o aviso em tempo real ignora o próprio autor, então
 * sem isso a lista da tela não veria a categoria nova). Devolve a categoria criada; erros sobem para a folha mostrar.
 */
export function useCriarCategoria(definirCategorias: Dispatch<SetStateAction<Categoria[] | null>>) {
  const container = useContainer();
  const toast = useToast();
  return useCallback(
    async (nome: string) => {
      const criada = await container.criarCategoria.executar(nome);
      definirCategorias((atual) => [...(atual ?? []), criada]);
      toast('Categoria criada');
      return criada;
    },
    [container, definirCategorias, toast],
  );
}
