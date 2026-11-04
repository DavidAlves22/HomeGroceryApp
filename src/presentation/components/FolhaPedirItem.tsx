import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import {
  rotuloDaUnidade,
  type Categoria,
  type ItemDaLista,
  type Produto,
} from '../../domain/entities/tipos';
import { normalizar } from '../../domain/services/organizacao';
import { espaco, fonte, raio, usePaleta } from '../theme';
import { Botao, MensagemDeErro, TextoSuave } from './base';
import { Moldura, TituloDaFolha } from './Folhas';
import { Icone } from './Icone';
import { CampoDeBusca } from './ui';

interface Props {
  visivel: boolean;
  /** Itens que já estão na lista: o que já foi pedido aparece como "na lista" e não duplica. */
  itensDaLista: ItemDaLista[];
  categorias: Categoria[];
  sugestoesIniciais: Produto[];
  buscar: (termo: string) => Promise<Produto[]>;
  /** Adiciona 1 unidade do produto na lista. */
  aoPedir: (produto: Produto) => Promise<void>;
  /** O nome digitado não existe no cadastro: abre o formulário completo. */
  aoCriarNovo: (nome: string) => void;
  aoFechar: () => void;
}

/**
 * "Acabou em casa": a pessoa que está em casa pede um item em um toque, e quem está no mercado vê na hora
 * (e recebe o aviso). Mostra os favoritos e recorrentes; digitar filtra todo o cadastro.
 */
export function FolhaPedirItem({
  visivel,
  itensDaLista,
  categorias,
  sugestoesIniciais,
  buscar,
  aoPedir,
  aoCriarNovo,
  aoFechar,
}: Props) {
  const p = usePaleta();
  const [termo, setTermo] = useState('');
  const [achados, setAchados] = useState<Produto[] | null>(null);
  const [pedidos, setPedidos] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Cada abertura começa limpa.
  useEffect(() => {
    if (visivel) {
      setTermo('');
      setAchados(null);
      setPedidos(new Set());
      setErro(null);
    }
  }, [visivel]);

  // Busca no cadastro enquanto digita (com um respiro para não chamar a API a cada tecla).
  useEffect(() => {
    const limpo = termo.trim();
    if (limpo.length < 2) {
      setAchados(null);
      return;
    }
    let ativo = true;
    const temporizador = setTimeout(() => {
      buscar(limpo)
        .then((lista) => ativo && setAchados(lista))
        .catch(() => ativo && setAchados([]));
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(temporizador);
    };
  }, [termo, buscar]);

  const nomesNaLista = new Set(itensDaLista.map((i) => normalizar(i.nome)));
  const naLista = (produto: Produto) =>
    nomesNaLista.has(normalizar(produto.nome)) || pedidos.has(produto.id);
  const lista = achados ?? sugestoesIniciais;
  const nomeDaCategoria = (id: string) => categorias.find((c) => c.id === id)?.nome ?? '';
  const temExato =
    termo.trim().length > 0 &&
    (achados ?? []).some((a) => normalizar(a.nome) === normalizar(termo));

  async function pedir(produto: Produto) {
    setOcupado(produto.id);
    setErro(null);
    try {
      await aoPedir(produto);
      setPedidos((atual) => new Set(atual).add(produto.id));
    } catch (e) {
      setErro(mensagemParaUsuario(e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Moldura visivel={visivel} aoFechar={aoFechar}>
      <TituloDaFolha>Pedir item</TituloDaFolha>
      <TextoSuave>
        Toque no que acabou. O item entra na lista e quem estiver no mercado já vê.
      </TextoSuave>
      <CampoDeBusca valor={termo} aoMudar={setTermo} placeholder="Buscar produto" />
      {erro && <MensagemDeErro mensagem={erro} />}

      {lista.length === 0 && achados !== null && (
        <TextoSuave>Nenhum produto com esse nome no seu cadastro.</TextoSuave>
      )}
      {achados === null && sugestoesIniciais.length > 0 && (
        <Text style={{ color: p.textoSuave, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>
          FAVORITOS E MAIS COMPRADOS
        </Text>
      )}
      <View style={{ gap: espaco.sm }}>
        {lista.map((produto) => {
          const jaNaLista = naLista(produto);
          return (
            <Pressable
              key={produto.id}
              accessibilityRole="button"
              accessibilityLabel={`Pedir ${produto.nome}`}
              accessibilityState={{ disabled: jaNaLista || ocupado !== null }}
              disabled={jaNaLista || ocupado !== null}
              onPress={() => void pedir(produto)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: espaco.md,
                minHeight: 52,
                paddingHorizontal: espaco.md,
                borderRadius: raio.md,
                borderWidth: 1,
                borderColor: p.linha,
                backgroundColor: jaNaLista ? p.superficie2 : p.superficie,
                opacity: ocupado === produto.id ? 0.6 : 1,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.texto, fontSize: fonte.corpo, fontWeight: '600' }}>
                  {produto.nome}
                </Text>
                <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                  {nomeDaCategoria(produto.categoriaId)} · 1{' '}
                  {rotuloDaUnidade(produto.unidadePadrao)}
                </Text>
              </View>
              {jaNaLista ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icone nome="check" cor={p.destaque} tamanho={16} espessura={3} />
                  <Text style={{ color: p.destaque, fontSize: fonte.pequena, fontWeight: '700' }}>
                    Na lista
                  </Text>
                </View>
              ) : (
                <Icone nome="mais_mais" cor={p.destaque} tamanho={20} />
              )}
            </Pressable>
          );
        })}
      </View>

      {termo.trim().length >= 2 && achados !== null && !temExato && (
        <Botao
          titulo={`Pedir “${termo.trim()}” como produto novo`}
          variante="secundario"
          aoPressionar={() => aoCriarNovo(termo.trim())}
        />
      )}
      <Botao titulo="Pronto" variante="texto" aoPressionar={aoFechar} />
    </Moldura>
  );
}
