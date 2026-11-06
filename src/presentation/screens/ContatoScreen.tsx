import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MensagemDeContato, MinhasMensagens } from '../../domain/entities/contato';
import { dataEHoraDoDia } from '../../domain/services/painelAdmin';
import { rotuloDoStatus, rotuloDoTipo } from '../../domain/services/contato';
import { Botao, Cartao, TextoSuave } from '../components/base';
import { FolhaDeNovaMensagem } from '../components/FolhasDeContato';
import { LinhaDeInformacao } from '../components/InformacoesDeContato';
import { TituloDoCartao } from '../components/painel';
import { Cabecalho, Carregando, EstadoVazio, Pagina, Pilula } from '../components/ui';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

function CartaoDaMensagem({
  mensagem,
  aberta,
  aoAlternar,
}: {
  mensagem: MensagemDeContato;
  aberta: boolean;
  aoAlternar: () => void;
}) {
  const p = usePaleta();
  return (
    <Cartao estilo={{ gap: espaco.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${aberta ? 'Recolher' : 'Abrir'} ${mensagem.assunto}`}
        accessibilityState={{ expanded: aberta }}
        onPress={aoAlternar}
        style={{ gap: 4 }}
      >
        <View style={estilos.entre}>
          <Text style={{ flex: 1, color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}>
            {mensagem.assunto}
          </Text>
          <Pilula
            texto={rotuloDoStatus(mensagem.status)}
            tom={
              mensagem.status === 'Recebida' || mensagem.status === 'Concluida'
                ? 'neutro'
                : 'destaque'
            }
          />
        </View>
        <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
          {rotuloDoTipo(mensagem.tipo)} · {dataEHoraDoDia(mensagem.criadoEm)}
        </Text>
        {mensagem.respostaNova && <Pilula texto="Resposta nova" />}
      </Pressable>
      {aberta && (
        <>
          <Text selectable style={{ color: p.texto, fontSize: fonte.corpo }}>
            {mensagem.texto}
          </Text>
          {mensagem.resposta ? (
            <View style={[estilos.resposta, { backgroundColor: p.superficie2 }]}>
              <Text style={{ color: p.textoSuave, fontSize: fonte.pequena, fontWeight: '700' }}>
                Resposta{mensagem.respondidoEm ? ` · ${dataEHoraDoDia(mensagem.respondidoEm)}` : ''}
              </Text>
              <Text selectable style={{ color: p.texto, fontSize: fonte.corpo }}>
                {mensagem.resposta}
              </Text>
            </View>
          ) : (
            <TextoSuave>Ainda sem resposta.</TextoSuave>
          )}
        </>
      )}
    </Cartao>
  );
}

/**
 * Contato com o administrador: as informações que ele cadastrou (e-mail, Pix...) e as mensagens da própria pessoa
 * (feedbacks e solicitações) com o status de cada uma. Abrir uma mensagem com resposta nova marca a resposta como vista.
 */
export function ContatoScreen() {
  const p = usePaleta();
  const container = useContainer();
  const navegacao = useNavegacao();
  const toast = useToast();
  const informacoes = useCarregar(() => container.obterInformacoesDeContato.executar(), 'contato');
  const mensagens = useCarregar(
    () => container.listarMinhasMensagens.executar(),
    'contato-mensagens',
  );
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [escrevendo, setEscrevendo] = useState(false);

  function alternar(mensagem: MensagemDeContato) {
    const proximo = new Set(abertas);
    if (proximo.has(mensagem.id)) proximo.delete(mensagem.id);
    else proximo.add(mensagem.id);
    setAbertas(proximo);

    // Ver a resposta é o que a "gasta": some o selo e o contador, aqui e no servidor.
    if (proximo.has(mensagem.id) && mensagem.respostaNova) {
      void container.marcarRespostaComoVista.executar(mensagem.id);
      mensagens.definirDados((atual: MinhasMensagens | null) =>
        atual
          ? {
              itens: atual.itens.map((m) =>
                m.id === mensagem.id ? { ...m, respostaNova: false } : m,
              ),
              respostasNovas: Math.max(0, atual.respostasNovas - 1),
            }
          : atual,
      );
    }
  }

  return (
    <Pagina>
      <Cabecalho titulo="Contato e feedback" aoVoltar={() => navegacao.goBack()} />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        {(informacoes.dados?.length ?? 0) > 0 && (
          <Cartao estilo={{ gap: espaco.xs }}>
            <TituloDoCartao>Fale com a gente</TituloDoCartao>
            {informacoes.dados?.map((info) => (
              <LinhaDeInformacao key={info.id} informacao={info} />
            ))}
          </Cartao>
        )}

        <Botao titulo="Novo feedback ou solicitação" aoPressionar={() => setEscrevendo(true)} />

        <TituloDoCartao>Suas mensagens</TituloDoCartao>
        {mensagens.carregando && !mensagens.dados ? (
          <Carregando />
        ) : mensagens.erro && !mensagens.dados ? (
          <EstadoVazio
            titulo="Não foi possível carregar"
            texto={mensagens.erro}
            acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void mensagens.recarregar() }}
          />
        ) : (mensagens.dados?.itens.length ?? 0) === 0 ? (
          <Text style={{ color: p.textoSuave, fontSize: fonte.corpo }}>
            Você ainda não enviou nenhuma mensagem. Toque no botão acima para escrever a primeira.
          </Text>
        ) : (
          mensagens.dados?.itens.map((m) => (
            <CartaoDaMensagem
              key={m.id}
              mensagem={m}
              aberta={abertas.has(m.id)}
              aoAlternar={() => alternar(m)}
            />
          ))
        )}
      </ScrollView>

      <FolhaDeNovaMensagem
        visivel={escrevendo}
        aoEnviar={async (dados) => {
          const criada = await container.enviarMensagemDeContato.executar(dados);
          mensagens.definirDados((atual: MinhasMensagens | null) => ({
            itens: [criada, ...(atual?.itens ?? [])],
            respostasNovas: atual?.respostasNovas ?? 0,
          }));
          setEscrevendo(false);
          toast('Mensagem enviada');
        }}
        aoFechar={() => setEscrevendo(false)}
      />
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, gap: espaco.lg, paddingBottom: 40 },
  entre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  resposta: { borderRadius: 12, padding: espaco.md, gap: 4 },
});
