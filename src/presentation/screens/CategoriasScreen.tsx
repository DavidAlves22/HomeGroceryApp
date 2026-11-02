import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type { Categoria } from '../../domain/entities/tipos';
import { Cartao, TextoSuave } from '../components/base';
import { FolhaDeTexto } from '../components/Folhas';
import {
  BotaoDeIcone,
  BotaoFlutuante,
  Cabecalho,
  Carregando,
  EstadoVazio,
  Pagina,
} from '../components/ui';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

type Folha = { tipo: 'nova' } | { tipo: 'editar'; categoria: Categoria } | null;

/**
 * Categorias do grupo. Renomear ou excluir não muda listas antigas: cada item delas guarda o
 * nome que a categoria tinha na época. Os produtos de uma categoria excluída passam para "Outros".
 */
export function CategoriasScreen() {
  const p = usePaleta();
  const container = useContainer();
  const navegacao = useNavegacao();
  const toast = useToast();
  const {
    dados: categorias,
    definirDados,
    erro,
    carregando,
    recarregar,
  } = useCarregar(() => container.listarCategorias.executar(), 'categorias');
  const [folha, setFolha] = useState<Folha>(null);

  if (carregando && !categorias)
    return (
      <Pagina>
        <Carregando />
      </Pagina>
    );
  if (erro && !categorias) {
    return (
      <Pagina>
        <Cabecalho titulo="Categorias" aoVoltar={() => navegacao.goBack()} />
        <EstadoVazio
          titulo="Não foi possível carregar"
          texto={erro}
          acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void recarregar() }}
        />
      </Pagina>
    );
  }

  const lista = categorias ?? [];

  async function salvar(texto: string) {
    if (folha?.tipo === 'editar') {
      const renomeada = await container.renomearCategoria.executar(folha.categoria.id, texto);
      definirDados((atual) => (atual ?? []).map((c) => (c.id === renomeada.id ? renomeada : c)));
      toast('Categoria renomeada');
    } else {
      const criada = await container.criarCategoria.executar(texto);
      definirDados((atual) => [...(atual ?? []), criada]);
      toast('Categoria criada');
    }
    setFolha(null);
  }

  async function excluir(categoria: Categoria) {
    await container.excluirCategoria.executar(categoria.id);
    definirDados((atual) => (atual ?? []).filter((c) => c.id !== categoria.id));
    setFolha(null);
    toast('Categoria excluída. Os produtos dela foram para "Outros".');
  }

  async function mover(indice: number, direcao: -1 | 1) {
    const anterior = lista;
    const nova = [...lista];
    [nova[indice], nova[indice + direcao]] = [nova[indice + direcao], nova[indice]];
    definirDados(nova.map((c, ordem) => ({ ...c, ordem })));
    try {
      definirDados(await container.reordenarCategorias.executar(nova.map((c) => c.id)));
    } catch (e) {
      definirDados(anterior);
      toast(mensagemParaUsuario(e));
    }
  }

  return (
    <Pagina>
      <Cabecalho titulo="Categorias" aoVoltar={() => navegacao.goBack()} />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <TextoSuave>
          A ordem das categorias define como os produtos aparecem na lista de compras. Coloque
          primeiro as seções que você visita primeiro no mercado.
        </TextoSuave>
        <Cartao estilo={{ paddingVertical: 4 }}>
          {lista.map((categoria, indice) => (
            <View
              key={categoria.id}
              style={[
                estilos.linha,
                { borderTopColor: p.linha, borderTopWidth: indice === 0 ? 0 : 1 },
              ]}
            >
              <Text style={{ flex: 1, color: p.texto, fontWeight: '600', fontSize: fonte.corpo }}>
                {categoria.nome}
              </Text>
              <BotaoDeIcone
                icone="cima"
                rotulo={`Subir ${categoria.nome}`}
                desabilitado={indice === 0}
                aoPressionar={() => void mover(indice, -1)}
              />
              <BotaoDeIcone
                icone="baixo"
                rotulo={`Descer ${categoria.nome}`}
                desabilitado={indice === lista.length - 1}
                aoPressionar={() => void mover(indice, 1)}
              />
              <BotaoDeIcone
                icone="editar"
                rotulo={`Editar ${categoria.nome}`}
                aoPressionar={() => setFolha({ tipo: 'editar', categoria })}
              />
            </View>
          ))}
        </Cartao>
      </ScrollView>

      <BotaoFlutuante rotulo="Nova categoria" aoPressionar={() => setFolha({ tipo: 'nova' })} />

      <FolhaDeTexto
        visivel={folha !== null}
        titulo={folha?.tipo === 'editar' ? 'Editar categoria' : 'Nova categoria'}
        rotulo="Nome da categoria"
        valorInicial={folha?.tipo === 'editar' ? folha.categoria.nome : ''}
        rotuloDoBotao={folha?.tipo === 'editar' ? 'Salvar' : 'Criar'}
        aoSalvar={salvar}
        aoExcluir={folha?.tipo === 'editar' ? () => excluir(folha.categoria) : undefined}
        aoFechar={() => setFolha(null)}
      />
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: 120 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: espaco.xs,
    minHeight: 56,
  },
});
