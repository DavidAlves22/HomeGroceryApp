import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Botao, Cartao } from '../components/base';
import { CartaoDeAvisos } from '../components/CartaoDeAvisos';
import { Icone, type NomeDoIcone } from '../components/Icone';
import { FolhaDeEncerrarConta } from '../components/FolhaDeEncerrarConta';
import { FolhaDeTexto } from '../components/Folhas';
import { Cabecalho, Pagina, Pilula } from '../components/ui';
import { useContainer, useSessao } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
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

/** Card de contato: igual para todos (inclusive o administrador). Avisa quando há resposta nova do administrador. */
function LinhaDeContato() {
  const { listarMinhasMensagens } = useContainer();
  const navegacao = useNavegacao();
  const { dados } = useCarregar(() => listarMinhasMensagens.executar(), 'contato-resumo');
  const novas = dados?.respostasNovas ?? 0;
  return (
    <Linha
      icone="mensagem"
      titulo="Contato e feedback"
      detalhe={
        novas > 0
          ? `${novas} ${novas === 1 ? 'resposta nova' : 'respostas novas'}`
          : 'Fale com a gente, envie sugestões e pedidos'
      }
      aoPressionar={() => navegacao.navigate('Contato')}
    />
  );
}

/** Atalho do administrador para as mensagens dos usuários, com quantas esperam resposta. */
function LinhaDasMensagensDoAdmin() {
  const { listarMensagensDoPainel } = useContainer();
  const navegacao = useNavegacao();
  const { dados } = useCarregar(() => listarMensagensDoPainel.executar(), 'admin-mensagens-resumo');
  const esperando = dados?.aguardandoResposta ?? 0;
  return (
    <Linha
      icone="mensagem"
      titulo="Mensagens dos usuários"
      detalhe={
        esperando > 0
          ? `${esperando} aguardando resposta`
          : 'Responda feedbacks e edite o card de contato'
      }
      aoPressionar={() => navegacao.navigate('AdminMensagens')}
    />
  );
}

export function MaisScreen() {
  const p = usePaleta();
  const { sairDaConta, alterarNomeDoUsuario, encerrarConta } = useContainer();
  const [editandoNome, setEditandoNome] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const { sessao, definirSessao } = useSessao();
  const navegacao = useNavegacao();

  return (
    <Pagina>
      <Cabecalho titulo="Mais" />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <CartaoDeAvisos />

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

        <Cartao estilo={{ paddingVertical: 4 }}>
          <LinhaDeContato />
        </Cartao>

        {sessao?.ehAdmin && (
          <Cartao estilo={{ paddingVertical: 4 }}>
            <Linha
              icone="grafico"
              titulo="Painel do administrador"
              detalhe="Usuários, uso e números do app"
              aoPressionar={() => navegacao.navigate('Admin')}
            />
            <View style={{ height: 1, backgroundColor: p.linha }} />
            <LinhaDasMensagensDoAdmin />
          </Cartao>
        )}

        <Cartao estilo={{ gap: espaco.sm }}>
          <View style={estilos.nomeELinha}>
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}
            >
              {sessao?.usuario.nome}
            </Text>
            <Pilula texto="Servidor conectado" />
          </View>
          <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
            {sessao?.usuario.email}
          </Text>
          <Botao
            titulo="Alterar nome"
            variante="secundario"
            aoPressionar={() => setEditandoNome(true)}
          />
        </Cartao>
        <FolhaDeTexto
          visivel={editandoNome}
          titulo="Alterar nome"
          rotulo="Seu nome"
          valorInicial={sessao?.usuario.nome}
          rotuloDoBotao="Salvar"
          aoSalvar={async (nome) => {
            definirSessao(await alterarNomeDoUsuario.executar(nome));
            setEditandoNome(false);
          }}
          aoFechar={() => setEditandoNome(false)}
        />

        <Botao
          titulo="Sair da conta"
          variante="secundario"
          aoPressionar={async () => {
            await sairDaConta.executar();
            definirSessao(null);
          }}
        />
        {/* O administrador não encerra a própria conta por aqui (a API também recusa). */}
        {!sessao?.ehAdmin && (
          <Botao
            titulo="Encerrar conta"
            variante="perigoTexto"
            aoPressionar={() => setEncerrando(true)}
          />
        )}
        <FolhaDeEncerrarConta
          visivel={encerrando}
          emailDaConta={sessao?.usuario.email ?? ''}
          aoConfirmar={async (dados) => {
            await encerrarConta.executar(dados);
            setEncerrando(false);
            definirSessao(null);
          }}
          aoFechar={() => setEncerrando(false)}
        />
      </ScrollView>
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  nomeELinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
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
