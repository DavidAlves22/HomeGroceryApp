import React from 'react';
import { Text, View } from 'react-native';
import { espaco, fonte, usePaleta } from '../theme';
import { Cartao } from './base';
import { ListaComVerMais } from './ListaComVerMais';

interface Props<T> {
  titulo: string;
  texto: string;
  itens: T[];
  chave: (item: T) => string;
  /** Desenha uma linha; é a mesma no cartão e na folha com tudo. */
  renderizar: (item: T) => React.ReactNode;
  /** Quantas linhas ficam no cartão (o resto vai para a folha). */
  limite?: number;
}

/** Cartões de aviso mostram só 2 linhas: a lista cresce no histórico, o cartão não. */
const LIMITE_DE_AVISOS = 2;

/**
 * Cartão de avisos que nunca cresce: título, explicação e as primeiras linhas, com "Ver todos" para o resto.
 * Quem decide a ordem e some com o item tratado é o dono da lista (`itens`): ao tratar uma linha ela sai do
 * array e a próxima ocupa o lugar, mantendo o cartão sempre do mesmo tamanho.
 */
export function CartaoDeLista<T>({
  titulo,
  texto,
  itens,
  chave,
  renderizar,
  limite = LIMITE_DE_AVISOS,
}: Props<T>) {
  const p = usePaleta();
  if (itens.length === 0) return null;

  const linhas = (lista: T[]) =>
    lista.map((item, indice) => (
      <View
        key={chave(item)}
        style={{
          borderTopColor: p.linha,
          borderTopWidth: indice === 0 ? 0 : 1,
          paddingTop: espaco.sm,
        }}
      >
        {renderizar(item)}
      </View>
    ));

  return (
    <Cartao estilo={{ gap: espaco.sm }}>
      <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '800' }}>{titulo}</Text>
      <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>{texto}</Text>
      <ListaComVerMais
        titulo={titulo}
        descricao={texto}
        itens={itens}
        limite={limite}
        renderizar={linhas}
      />
    </Cartao>
  );
}
