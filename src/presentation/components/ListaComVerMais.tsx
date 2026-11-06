import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { espaco, fonte, usePaleta } from '../theme';
import { Botao } from './base';
import { Moldura, TituloDaFolha } from './Folhas';

interface Props<T> {
  /** Título da folha que mostra tudo. */
  titulo: string;
  /** Frase opcional sob o título da folha. */
  descricao?: string;
  itens: T[];
  /** Desenha uma lista de itens; é chamada com os primeiros no cartão e com todos na folha. */
  renderizar: (itens: T[]) => React.ReactNode;
  /** Quantas linhas ficam à vista (o resto vai para a folha). */
  limite?: number;
}

export const LIMITE_DE_LINHAS = 4;

/**
 * Lista que nunca cresce a tela: mostra só as primeiras linhas e, havendo mais, "Ver todos (N)" abre uma folha
 * com a lista inteira. Quem desenha é `renderizar`, então serve para barras, linhas de conta, tabelas etc.
 * Vale tanto para rankings (já ordenados) quanto para avisos, onde tratar um item o tira do array.
 */
export function ListaComVerMais<T>({
  titulo,
  descricao,
  itens,
  renderizar,
  limite = LIMITE_DE_LINHAS,
}: Props<T>) {
  const p = usePaleta();
  const [aberta, setAberta] = useState(false);

  return (
    <>
      {renderizar(itens.slice(0, limite))}
      {itens.length > limite && (
        <Botao
          titulo={`Ver todos (${itens.length})`}
          variante="texto"
          aoPressionar={() => setAberta(true)}
        />
      )}
      <Moldura visivel={aberta && itens.length > 0} aoFechar={() => setAberta(false)}>
        <TituloDaFolha>{titulo}</TituloDaFolha>
        {descricao && (
          <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>{descricao}</Text>
        )}
        <View style={{ gap: espaco.md }}>{renderizar(itens)}</View>
        <Botao titulo="Fechar" variante="secundario" aoPressionar={() => setAberta(false)} />
      </Moldura>
    </>
  );
}
