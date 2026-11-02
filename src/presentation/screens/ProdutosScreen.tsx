import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import { rotuloDaUnidade, type Produto } from '../../domain/entities/tipos';
import { normalizar } from '../../domain/services/organizacao';
import { Cartao, TextoSuave } from '../components/base';
import { FolhaDeTexto } from '../components/Folhas';
import { Icone } from '../components/Icone';
import {
  BotaoDeIcone,
  Cabecalho,
  CampoDeBusca,
  Carregando,
  EstadoVazio,
  Pagina,
} from '../components/ui';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

/**
 * Cadastro central de produtos. Os produtos nascem sozinhos ao adicionar itens nas listas; aqui o
 * usuário marca os favoritos (sugeridos ao montar listas), corrige nomes e remove o que não usa mais.
 * Excluir ou renomear um produto NÃO altera listas antigas: elas guardam o próprio nome.
 */
export function ProdutosScreen() {
  const p = usePaleta();
  const container = useContainer();
  const navegacao = useNavegacao();
  const toast = useToast();
  const {
    dados: produtos,
    definirDados,
    erro,
    carregando,
    recarregar,
  } = useCarregar(() => container.listarProdutos.executar(), 'produtos');
  const { dados: categorias } = useCarregar(
    () => container.listarCategorias.executar(),
    'categorias',
  );
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Produto | null>(null);

  if (carregando && !produtos)
    return (
      <Pagina>
        <Carregando />
      </Pagina>
    );
  if (erro && !produtos) {
    return (
      <Pagina>
        <Cabecalho titulo="Produtos" aoVoltar={() => navegacao.goBack()} />
        <EstadoVazio
          titulo="Não foi possível carregar"
          texto={erro}
          acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void recarregar() }}
        />
      </Pagina>
    );
  }

  const todos = produtos ?? [];
  const nomeDaCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nome]));
  const termo = normalizar(busca);
  const visiveis = (termo ? todos.filter((x) => normalizar(x.nome).includes(termo)) : todos).sort(
    (a, b) => Number(b.favorito) - Number(a.favorito) || a.nome.localeCompare(b.nome, 'pt-BR'),
  );

  async function alternarFavorito(produto: Produto) {
    const anterior = todos;
    definirDados((atual) =>
      (atual ?? []).map((x) => (x.id === produto.id ? { ...x, favorito: !x.favorito } : x)),
    );
    try {
      await container.alternarFavoritoDoProduto.executar(produto.id, !produto.favorito);
      toast(produto.favorito ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
    } catch (e) {
      definirDados(anterior);
      toast(mensagemParaUsuario(e));
    }
  }

  async function renomear(texto: string) {
    if (!editando) return;
    const atualizado = await container.renomearProduto.executar(editando, texto);
    definirDados((atual) => (atual ?? []).map((x) => (x.id === atualizado.id ? atualizado : x)));
    setEditando(null);
    toast('Produto renomeado');
  }

  async function excluir() {
    if (!editando) return;
    await container.excluirProduto.executar(editando.id);
    definirDados((atual) => (atual ?? []).filter((x) => x.id !== editando.id));
    setEditando(null);
    toast('Produto excluído. Listas antigas não mudam.');
  }

  return (
    <Pagina>
      <Cabecalho titulo="Produtos" aoVoltar={() => navegacao.goBack()} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <TextoSuave>
          Marque com estrela os produtos que você compra sempre: eles são sugeridos ao adicionar
          itens a uma lista.
        </TextoSuave>
        {todos.length > 0 && (
          <CampoDeBusca valor={busca} aoMudar={setBusca} placeholder="Buscar produto" />
        )}

        {todos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum produto ainda"
            texto="Os produtos aparecem aqui conforme você os adiciona às listas."
          />
        ) : visiveis.length === 0 ? (
          <EstadoVazio titulo="Nenhum produto encontrado" texto="Tente outro nome." />
        ) : (
          <Cartao estilo={{ paddingVertical: 4 }}>
            {visiveis.map((produto, indice) => (
              <View
                key={produto.id}
                style={[
                  estilos.linha,
                  { borderTopColor: p.linha, borderTopWidth: indice === 0 ? 0 : 1 },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${produto.favorito ? 'Desfavoritar' : 'Favoritar'} ${produto.nome}`}
                  accessibilityState={{ selected: produto.favorito }}
                  onPress={() => void alternarFavorito(produto)}
                  style={estilos.estrela}
                >
                  <Icone
                    nome="estrela"
                    cor={produto.favorito ? p.destaque : p.textoSuave}
                    preenchido={produto.favorito}
                  />
                </Pressable>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={2}
                    style={{ color: p.texto, fontWeight: '600', fontSize: fonte.corpo }}
                  >
                    {produto.nome}
                  </Text>
                  <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                    {nomeDaCategoria.get(produto.categoriaId) ?? 'Outros'} ·{' '}
                    {rotuloDaUnidade(produto.unidadePadrao)}
                  </Text>
                </View>
                <BotaoDeIcone
                  icone="editar"
                  rotulo={`Editar ${produto.nome}`}
                  aoPressionar={() => setEditando(produto)}
                />
              </View>
            ))}
          </Cartao>
        )}
      </ScrollView>

      <FolhaDeTexto
        visivel={editando !== null}
        titulo="Editar produto"
        rotulo="Nome do produto"
        valorInicial={editando?.nome ?? ''}
        rotuloDoBotao="Salvar"
        aoSalvar={renomear}
        aoExcluir={excluir}
        aoFechar={() => setEditando(null)}
      />
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: 60 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: espaco.sm,
    minHeight: 60,
  },
  estrela: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
