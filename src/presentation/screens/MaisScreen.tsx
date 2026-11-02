import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Botao, Cartao } from '../components/base';
import { Icone, type NomeDoIcone } from '../components/Icone';
import { Cabecalho, Pagina, Pilula } from '../components/ui';
import { useContainer, useSessao } from '../hooks/AppProviders';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, raio, usePaleta } from '../theme';

function Linha({
  icone,
  titulo,
  detalhe,
  aoPressionar,
}: {
  icone: NomeDoIcone;
  titulo: string;
  detalhe: string;
  aoPressionar: () => void;
}) {
  const p = usePaleta();
  return (
    <Pressable accessibilityRole="button" onPress={aoPressionar} style={estilos.linha}>
      <View style={[estilos.emblema, { backgroundColor: p.destaqueSuave }]}>
        <Icone nome={icone} cor={p.destaque} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}>{titulo}</Text>
        <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>{detalhe}</Text>
      </View>
      <Icone nome="seta" cor={p.textoSuave} tamanho={18} />
    </Pressable>
  );
}

export function MaisScreen() {
  const p = usePaleta();
  const { sairDaConta } = useContainer();
  const { sessao, definirSessao } = useSessao();
  const navegacao = useNavegacao();

  return (
    <Pagina>
      <Cabecalho titulo="Mais" />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Cartao estilo={{ paddingVertical: 4 }}>
          <Linha
            icone="pessoas"
            titulo="Grupo familiar"
            detalhe="Compartilhe as listas em tempo real"
            aoPressionar={() => navegacao.navigate('Grupo')}
          />
          <View style={{ height: 1, backgroundColor: p.linha }} />
          <Linha
            icone="mapa"
            titulo="Mercados"
            detalhe="Mapa de cada mercado, para a rota da compra"
            aoPressionar={() => navegacao.navigate('Mercados')}
          />
          <View style={{ height: 1, backgroundColor: p.linha }} />
          <Linha
            icone="estrela"
            titulo="Lista padrão"
            detalhe="Seus produtos de todo mês"
            aoPressionar={() => navegacao.navigate('ListaPadrao')}
          />
          <View style={{ height: 1, backgroundColor: p.linha }} />
          <Linha
            icone="estrela"
            titulo="Produtos e favoritos"
            detalhe="Marque os que você sempre compra"
            aoPressionar={() => navegacao.navigate('Produtos')}
          />
          <View style={{ height: 1, backgroundColor: p.linha }} />
          <Linha
            icone="categoria"
            titulo="Categorias"
            detalhe="Criar, renomear, reordenar e excluir"
            aoPressionar={() => navegacao.navigate('Categorias')}
          />
        </Cartao>

        <Cartao estilo={{ gap: espaco.sm }}>
          <Text style={{ color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}>
            {sessao?.usuario.nome}
          </Text>
          <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
            {sessao?.usuario.email}
          </Text>
          <Pilula texto="Servidor conectado" />
        </Cartao>

        <Botao
          titulo="Sair da conta"
          variante="secundario"
          aoPressionar={async () => {
            await sairDaConta.executar();
            definirSessao(null);
          }}
        />
      </ScrollView>
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, gap: espaco.lg, paddingBottom: 40 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    paddingVertical: espaco.md,
    minHeight: 64,
  },
  emblema: {
    width: 40,
    height: 40,
    borderRadius: raio.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
