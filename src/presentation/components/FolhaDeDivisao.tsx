import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { Membro } from '../../domain/entities/grupo';
import type { DivisaoDaCategoria } from '../../domain/entities/tipos';
import {
  atribuirCategoria,
  responsavelDaCategoria,
  type CategoriaDaLista,
} from '../../domain/services/divisao';
import { espaco, fonte, usePaleta } from '../theme';
import { Botao, TextoSuave } from './base';
import { Moldura, TituloDaFolha } from './Folhas';
import { Chip } from './ui';

interface Props {
  visivel: boolean;
  categorias: CategoriaDaLista[];
  membros: Membro[];
  inicial: DivisaoDaCategoria[];
  /** Quem costuma comprar cada categoria, pelo histórico do grupo (só categorias com hábito claro). */
  habitual?: DivisaoDaCategoria[];
  aoSalvar: (divisao: DivisaoDaCategoria[]) => Promise<void>;
  aoFechar: () => void;
}

/**
 * "Quem pega o quê" nesta ida ao mercado: cada categoria vai para uma pessoa (ou fica de todos).
 * A rota de cada um deixa de fora o que outra pessoa vai pegar.
 */
export function FolhaDeDivisao({
  visivel,
  categorias,
  membros,
  inicial,
  habitual = [],
  aoSalvar,
  aoFechar,
}: Props) {
  const p = usePaleta();
  const [divisao, setDivisao] = useState<DivisaoDaCategoria[]>(inicial);
  const [salvando, setSalvando] = useState(false);

  // Cada abertura parte da divisão salva (descarta o que ficou pela metade da última vez).
  useEffect(() => {
    if (visivel) setDivisao(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);

  async function salvar(valor: DivisaoDaCategoria[]) {
    setSalvando(true);
    try {
      await aoSalvar(valor);
    } finally {
      setSalvando(false);
    }
  }

  // Só categorias que estão nesta lista e cuja pessoa ainda é do grupo.
  const idsDaLista = new Set(categorias.map((c) => c.id));
  const nomeDe = (usuarioId: string) => {
    const m = membros.find((x) => x.usuarioId === usuarioId);
    return m ? (m.voce ? 'você' : m.nome.split(' ')[0]) : null;
  };
  const sugestoes = habitual.filter((h) => idsDaLista.has(h.categoriaId) && nomeDe(h.usuarioId));

  function usarHistorico() {
    // Categorias sem hábito mantêm o que já estava escolhido.
    const sem = divisao.filter((d) => !sugestoes.some((s) => s.categoriaId === d.categoriaId));
    setDivisao([...sem, ...sugestoes]);
  }

  return (
    <Moldura visivel={visivel} aoFechar={aoFechar}>
      <TituloDaFolha>Dividir a compra</TituloDaFolha>
      <TextoSuave>
        Escolha quem pega cada categoria. A rota de cada pessoa mostra só as categorias dela e as
        que ficarem de todos. Vale só para esta lista.
      </TextoSuave>
      {sugestoes.length > 0 && (
        <Botao titulo="Sugerir pelo histórico" variante="secundario" aoPressionar={usarHistorico} />
      )}
      {categorias.map((c) => {
        const dono = responsavelDaCategoria(divisao, c.id);
        const costuma = sugestoes.find((s) => s.categoriaId === c.id);
        return (
          <View key={c.id} style={{ gap: espaco.xs }}>
            <Text style={{ color: p.texto, fontSize: fonte.corpo, fontWeight: '700' }}>
              {c.nome}
            </Text>
            {costuma && (
              <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                Costuma ser de {nomeDe(costuma.usuarioId)}
              </Text>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm }}>
              <Chip
                rotulo="Todos"
                ativo={dono === null}
                aoPressionar={() => setDivisao(atribuirCategoria(divisao, c.id, null))}
              />
              {membros.map((m) => (
                <Chip
                  key={m.usuarioId}
                  rotulo={m.voce ? 'Eu' : m.nome.split(' ')[0]}
                  ativo={dono === m.usuarioId}
                  aoPressionar={() => setDivisao(atribuirCategoria(divisao, c.id, m.usuarioId))}
                />
              ))}
            </View>
          </View>
        );
      })}
      <Botao
        titulo="Salvar divisão"
        carregando={salvando}
        aoPressionar={() => void salvar(divisao)}
      />
      {inicial.length > 0 && (
        <Botao
          titulo="Desfazer divisão"
          variante="secundario"
          desabilitado={salvando}
          aoPressionar={() => void salvar([])}
        />
      )}
    </Moldura>
  );
}
