import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Categoria } from '../../domain/entities/tipos';
import { useVoltarFecha } from '../hooks/useVoltarFecha';
import { espaco, fonte, usePaleta } from '../theme';
import { Botao, TextoSuave } from './base';
import { Icone } from './Icone';
import { Cabecalho, CampoDeBusca, Chip, Pagina } from './ui';

interface Props {
  visivel: boolean;
  titulo: string;
  categorias: Categoria[];
  selecionadas: string[];
  aoAlternar: (categoriaId: string) => void;
  aoFechar: () => void;
}

const comparar = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

/**
 * Lista de categorias em tela cheia (sobre o app inteiro) para marcar várias de uma vez, com busca e ordem alfabética
 * crescente ou decrescente. Marcar ou desmarcar vale na hora; "Concluído" só fecha.
 */
export function SeletorDeCategorias({
  visivel,
  titulo,
  categorias,
  selecionadas,
  aoAlternar,
  aoFechar,
}: Props) {
  const p = usePaleta();
  const [busca, setBusca] = useState('');
  const [crescente, setCrescente] = useState(true);
  // O voltar do celular/navegador fecha a lista em vez de sair do editor por baixo dela.
  useVoltarFecha(visivel, aoFechar);

  const lista = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    const filtradas = termo
      ? categorias.filter((c) => c.nome.toLocaleLowerCase('pt-BR').includes(termo))
      : [...categorias];
    return filtradas.sort((a, b) =>
      crescente ? comparar(a.nome, b.nome) : comparar(b.nome, a.nome),
    );
  }, [categorias, busca, crescente]);

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar}>
      <Pagina>
        <Cabecalho titulo={titulo} aoVoltar={aoFechar} />
        <View style={estilos.barra}>
          <View style={{ flex: 1 }}>
            <CampoDeBusca valor={busca} aoMudar={setBusca} placeholder="Buscar categoria" />
          </View>
          <Chip
            rotulo={crescente ? 'A → Z' : 'Z → A'}
            ativo={false}
            aoPressionar={() => setCrescente(!crescente)}
          />
        </View>
        <TextoSuave estilo={{ paddingHorizontal: espaco.lg, fontSize: fonte.pequena }}>
          {selecionadas.length === 0
            ? 'Nenhuma categoria marcada.'
            : selecionadas.length === 1
              ? '1 categoria marcada.'
              : `${selecionadas.length} categorias marcadas.`}
        </TextoSuave>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: espaco.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {lista.length === 0 ? (
            <TextoSuave estilo={{ padding: espaco.lg }}>
              Nenhuma categoria com esse nome.
            </TextoSuave>
          ) : (
            lista.map((c) => {
              const marcada = selecionadas.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcada }}
                  accessibilityLabel={c.nome}
                  onPress={() => aoAlternar(c.id)}
                  style={[estilos.linha, { borderBottomColor: p.linha }]}
                >
                  <View
                    style={[
                      estilos.caixa,
                      {
                        borderColor: marcada ? p.destaque : p.bordaCampo,
                        backgroundColor: marcada ? p.destaque : 'transparent',
                      },
                    ]}
                  >
                    {marcada && <Icone nome="check" cor={p.textoSobreDestaque} tamanho={16} />}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      color: p.texto,
                      fontSize: fonte.corpo,
                      fontWeight: marcada ? '700' : '500',
                    }}
                  >
                    {c.nome}
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
        <View style={{ padding: espaco.lg }}>
          <Botao titulo="Concluído" aoPressionar={aoFechar} />
        </View>
      </Pagina>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    paddingHorizontal: espaco.lg,
    paddingBottom: espaco.sm,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    paddingHorizontal: espaco.lg,
    paddingVertical: espaco.md,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  caixa: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
