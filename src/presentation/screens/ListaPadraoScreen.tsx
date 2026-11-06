import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import { rotuloDaUnidade, type DadosDoItem, type ItemDoModelo } from '../../domain/entities/tipos';
import { formatarQuantidade, normalizar } from '../../domain/services/organizacao';
import { Cartao, TextoSuave } from '../components/base';
import { FolhaDeItem } from '../components/Folhas';
import {
  BotaoDeIcone,
  BotaoFlutuante,
  Cabecalho,
  CampoDeBusca,
  Carregando,
  EstadoVazio,
  Pagina,
} from '../components/ui';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useCriarCategoria } from '../hooks/useCriarCategoria';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

type Folha = { tipo: 'novo' } | { tipo: 'editar'; item: ItemDoModelo } | null;

/**
 * Lista padrão: os produtos recorrentes que servem de modelo para cada mês.
 * Mexer aqui NUNCA altera listas já criadas, porque elas guardam uma cópia independente.
 */
export function ListaPadraoScreen() {
  const p = usePaleta();
  const container = useContainer();
  const navegacao = useNavegacao();
  const toast = useToast();
  const {
    dados: itens,
    definirDados,
    erro,
    carregando,
    recarregar,
  } = useCarregar(() => container.listarItensDoModelo.executar(), 'modelo');
  const { dados: categorias, definirDados: definirCategorias } = useCarregar(
    () => container.listarCategorias.executar(),
    'categorias',
  );
  const criarCategoria = useCriarCategoria(definirCategorias);
  const [busca, setBusca] = useState('');
  const [folha, setFolha] = useState<Folha>(null);

  if (carregando && !itens)
    return (
      <Pagina>
        <Carregando />
      </Pagina>
    );
  if (erro && !itens) {
    return (
      <Pagina>
        <Cabecalho titulo="Lista padrão" aoVoltar={() => navegacao.goBack()} />
        <EstadoVazio
          titulo="Não foi possível carregar"
          texto={erro}
          acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void recarregar() }}
        />
      </Pagina>
    );
  }

  const todos = itens ?? [];
  const termo = normalizar(busca);
  const visiveis = termo ? todos.filter((i) => normalizar(i.nome).includes(termo)) : todos;
  // Reordenar só faz sentido com a lista inteira na tela.
  const podeReordenar = termo === '';

  async function salvar(dados: DadosDoItem) {
    if (folha?.tipo === 'editar') {
      const editado = await container.editarItemDoModelo.executar(folha.item.id, dados);
      definirDados((atual) => (atual ?? []).map((i) => (i.id === editado.id ? editado : i)));
      toast('Produto atualizado na lista padrão');
    } else {
      const novo = await container.adicionarItemAoModelo.executar(dados);
      definirDados((atual) => [...(atual ?? []), novo]);
      toast('Produto adicionado à lista padrão');
    }
    setFolha(null);
  }

  async function excluir(item: ItemDoModelo) {
    await container.removerItemDoModelo.executar(item.id);
    definirDados((atual) => (atual ?? []).filter((i) => i.id !== item.id));
    setFolha(null);
    toast('Removido da lista padrão. Listas já criadas não mudam.');
  }

  async function mover(indice: number, direcao: -1 | 1) {
    const anterior = todos;
    const novo = [...todos];
    [novo[indice], novo[indice + direcao]] = [novo[indice + direcao], novo[indice]];
    definirDados(novo.map((item, ordem) => ({ ...item, ordem })));
    try {
      await container.reordenarItensDoModelo.executar(novo.map((i) => i.id));
    } catch (e) {
      definirDados(anterior);
      toast(mensagemParaUsuario(e));
    }
  }

  return (
    <Pagina>
      <Cabecalho titulo="Lista padrão" aoVoltar={() => navegacao.goBack()} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <TextoSuave>
          Seus produtos recorrentes. Servem de ponto de partida para cada mês, e mudar aqui não
          altera listas que você já criou.
        </TextoSuave>
        {todos.length > 0 && (
          <CampoDeBusca valor={busca} aoMudar={setBusca} placeholder="Buscar na lista padrão" />
        )}

        {todos.length === 0 ? (
          <EstadoVazio
            titulo="Lista padrão vazia"
            texto="Adicione os produtos que você compra todo mês. Na hora de criar a lista do mês, é só escolher quais entram."
            acao={{ rotulo: 'Adicionar produto', aoPressionar: () => setFolha({ tipo: 'novo' }) }}
          />
        ) : visiveis.length === 0 ? (
          <EstadoVazio titulo="Nenhum produto encontrado" texto="Tente outro nome." />
        ) : (
          <Cartao estilo={{ paddingVertical: 4 }}>
            {visiveis.map((item, indice) => (
              <View
                key={item.id}
                style={[
                  estilos.linha,
                  { borderTopColor: p.linha, borderTopWidth: indice === 0 ? 0 : 1 },
                ]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={2}
                    style={{ color: p.texto, fontWeight: '600', fontSize: fonte.corpo }}
                  >
                    {item.nome}
                  </Text>
                  <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                    {item.categoriaNome} · {formatarQuantidade(item.quantidade)}{' '}
                    {rotuloDaUnidade(item.unidade)}
                  </Text>
                </View>
                {podeReordenar && (
                  <>
                    <BotaoDeIcone
                      icone="cima"
                      rotulo={`Subir ${item.nome}`}
                      desabilitado={indice === 0}
                      aoPressionar={() => void mover(indice, -1)}
                    />
                    <BotaoDeIcone
                      icone="baixo"
                      rotulo={`Descer ${item.nome}`}
                      desabilitado={indice === visiveis.length - 1}
                      aoPressionar={() => void mover(indice, 1)}
                    />
                  </>
                )}
                <BotaoDeIcone
                  icone="editar"
                  rotulo={`Editar ${item.nome}`}
                  aoPressionar={() => setFolha({ tipo: 'editar', item })}
                />
              </View>
            ))}
          </Cartao>
        )}
      </ScrollView>

      {todos.length > 0 && (
        <BotaoFlutuante
          rotulo="Adicionar produto à lista padrão"
          aoPressionar={() => setFolha({ tipo: 'novo' })}
        />
      )}

      <FolhaDeItem
        visivel={folha !== null}
        titulo={folha?.tipo === 'editar' ? 'Editar produto' : 'Novo produto da lista padrão'}
        categorias={categorias ?? []}
        aoCriarCategoria={criarCategoria}
        inicial={
          folha?.tipo === 'editar'
            ? {
                nome: folha.item.nome,
                categoriaId: folha.item.categoriaId,
                unidade: folha.item.unidade,
                quantidade: folha.item.quantidade,
              }
            : undefined
        }
        rotuloDoBotao={folha?.tipo === 'editar' ? 'Salvar' : 'Adicionar'}
        buscarSugestoes={(termo) => container.buscarProdutos.executar(termo)}
        aoSalvar={salvar}
        aoExcluir={folha?.tipo === 'editar' ? () => excluir(folha.item) : undefined}
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
    paddingVertical: espaco.sm,
    minHeight: 56,
  },
});
