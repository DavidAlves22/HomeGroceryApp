import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useVoltarFecha } from '../hooks/useVoltarFecha';
import { espaco, fonte, usePaleta } from '../theme';
import { TextoSuave } from './base';
import { Icone } from './Icone';
import { BotaoFlutuante, Cabecalho, CampoDeBusca, Chip, Pagina } from './ui';

export interface OpcaoUnica {
  chave: string;
  rotulo: string;
}

interface Props {
  visivel: boolean;
  titulo: string;
  opcoes: OpcaoUnica[];
  /** Chave da opção atual (ganha o ✓). */
  escolhida: string;
  /** Mostra o campo de busca e a ordem A → Z / Z → A (a lista passa a ser ordenada por nome). */
  comBuscaEOrdem?: boolean;
  placeholderDaBusca?: string;
  aoEscolher: (chave: string) => void;
  aoFechar: () => void;
  /** Botão "+" flutuante no canto (ex.: criar a categoria que não está na lista). */
  acaoDeAdicionar?: { rotulo: string; aoPressionar: () => void };
}

const comparar = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

/**
 * Escolha de UMA opção numa lista em tela cheia, sobreposta ao app (e à folha que a abriu).
 * Com `comBuscaEOrdem` tem busca por texto e ordem alfabética; sem, mostra as opções na ordem recebida.
 * Tocar numa opção escolhe e fecha na hora.
 */
export function SeletorDeOpcao({
  visivel,
  titulo,
  opcoes,
  escolhida,
  comBuscaEOrdem = false,
  placeholderDaBusca = 'Buscar',
  aoEscolher,
  aoFechar,
  acaoDeAdicionar,
}: Props) {
  const p = usePaleta();
  const [busca, setBusca] = useState('');
  const [crescente, setCrescente] = useState(true);
  // O voltar do celular/navegador fecha a lista em vez de sair da folha por baixo dela.
  useVoltarFecha(visivel, aoFechar);

  const lista = useMemo(() => {
    if (!comBuscaEOrdem) return opcoes;
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    const filtradas = termo
      ? opcoes.filter((o) => o.rotulo.toLocaleLowerCase('pt-BR').includes(termo))
      : [...opcoes];
    return filtradas.sort((a, b) =>
      crescente ? comparar(a.rotulo, b.rotulo) : comparar(b.rotulo, a.rotulo),
    );
  }, [opcoes, busca, crescente, comBuscaEOrdem]);

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar}>
      <Pagina>
        <Cabecalho titulo={titulo} aoVoltar={aoFechar} />
        {comBuscaEOrdem && (
          <View style={estilos.barra}>
            <View style={{ flex: 1 }}>
              <CampoDeBusca valor={busca} aoMudar={setBusca} placeholder={placeholderDaBusca} />
            </View>
            <Chip
              rotulo={crescente ? 'A → Z' : 'Z → A'}
              ativo={false}
              aoPressionar={() => setCrescente(!crescente)}
            />
          </View>
        )}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: espaco.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {lista.length === 0 ? (
            <TextoSuave estilo={{ padding: espaco.lg }}>Nada com esse nome.</TextoSuave>
          ) : (
            lista.map((o) => {
              const marcada = o.chave === escolhida;
              return (
                <Pressable
                  key={o.chave}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: marcada }}
                  accessibilityLabel={o.rotulo}
                  onPress={() => aoEscolher(o.chave)}
                  style={[estilos.linha, { borderBottomColor: p.linha }]}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: p.texto,
                      fontSize: fonte.corpo,
                      fontWeight: marcada ? '700' : '500',
                    }}
                  >
                    {o.rotulo}
                  </Text>
                  {marcada && <Icone nome="check" cor={p.destaque} tamanho={20} />}
                </Pressable>
              );
            })
          )}
        </ScrollView>
        {acaoDeAdicionar && (
          <BotaoFlutuante
            rotulo={acaoDeAdicionar.rotulo}
            aoPressionar={acaoDeAdicionar.aoPressionar}
          />
        )}
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
});
