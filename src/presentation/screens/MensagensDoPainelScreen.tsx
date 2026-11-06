import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  DadosDaInformacao,
  InformacaoDeContato,
  MensagemParaAdmin,
  StatusDaMensagem,
} from '../../domain/entities/contato';
import {
  aguardandoResposta,
  FILTROS_DE_MENSAGENS,
  filtrarMensagens,
  rotuloDoStatus,
  rotuloDoTipo,
  type FiltroDeMensagens,
} from '../../domain/services/contato';
import { dataEHoraDoDia } from '../../domain/services/painelAdmin';
import { Botao, Cartao, TextoSuave } from '../components/base';
import { FolhaDeInformacao, FolhaDeResposta } from '../components/FolhasDeContato';
import { LinhaDeInformacao } from '../components/InformacoesDeContato';
import { TituloDoCartao } from '../components/painel';
import { Cabecalho, Carregando, Chip, EstadoVazio, Pagina, Pilula } from '../components/ui';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

type FolhaAberta = { tipo: 'nova' } | { tipo: 'editar'; informacao: InformacaoDeContato } | null;

function CartaoDaMensagem({
  mensagem,
  aoResponder,
}: {
  mensagem: MensagemParaAdmin;
  aoResponder: () => void;
}) {
  const p = usePaleta();
  return (
    <Cartao estilo={{ gap: espaco.sm }}>
      <View style={estilos.entre}>
        <Text style={{ flex: 1, color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}>
          {mensagem.assunto}
        </Text>
        <Pilula
          texto={rotuloDoStatus(mensagem.status)}
          tom={aguardandoResposta(mensagem.status) ? 'alerta' : 'neutro'}
        />
      </View>
      <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
        {rotuloDoTipo(mensagem.tipo)} · {dataEHoraDoDia(mensagem.criadoEm)}
      </Text>
      <Text selectable style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
        {mensagem.nome} · {mensagem.email}
      </Text>
      <Text selectable style={{ color: p.texto, fontSize: fonte.corpo }}>
        {mensagem.texto}
      </Text>
      {!!mensagem.resposta && (
        <View style={[estilos.resposta, { backgroundColor: p.superficie2 }]}>
          <Text style={{ color: p.textoSuave, fontSize: fonte.pequena, fontWeight: '700' }}>
            Sua resposta
            {mensagem.respondidoEm ? ` · ${dataEHoraDoDia(mensagem.respondidoEm)}` : ''}
          </Text>
          <Text selectable style={{ color: p.texto, fontSize: fonte.corpo }}>
            {mensagem.resposta}
          </Text>
        </View>
      )}
      <Botao
        titulo={mensagem.resposta ? 'Editar resposta ou status' : 'Responder'}
        variante="secundario"
        aoPressionar={aoResponder}
      />
    </Cartao>
  );
}

/**
 * Área do administrador para o contato: cadastra as informações que todos veem no card "Contato e feedback" (título,
 * descrição opcional e valor) e responde as mensagens dos usuários, mudando o status de cada uma.
 */
export function MensagensDoPainelScreen() {
  const container = useContainer();
  const navegacao = useNavegacao();
  const toast = useToast();
  const p = usePaleta();
  const caixa = useCarregar(() => container.listarMensagensDoPainel.executar(), 'admin-mensagens');
  const [filtro, setFiltro] = useState<FiltroDeMensagens>('aguardando');
  const [folha, setFolha] = useState<FolhaAberta>(null);
  const [respondendo, setRespondendo] = useState<MensagemParaAdmin | null>(null);

  const dados = caixa.dados;
  const visiveis = dados ? filtrarMensagens(dados.itens, filtro) : [];

  async function salvarInformacao(entrada: DadosDaInformacao) {
    if (folha?.tipo === 'editar') {
      await container.alterarInformacaoDeContato.executar(folha.informacao.id, entrada);
    } else {
      await container.adicionarInformacaoDeContato.executar(entrada);
    }
    await caixa.recarregar();
    setFolha(null);
    toast('Informação salva');
  }

  async function excluirInformacao(id: string) {
    await container.removerInformacaoDeContato.executar(id);
    await caixa.recarregar();
    setFolha(null);
    toast('Informação excluída');
  }

  async function responder(id: string, resposta: string, status: StatusDaMensagem) {
    await container.responderMensagemDoPainel.executar(id, { resposta, status });
    await caixa.recarregar();
    setRespondendo(null);
    toast('Resposta salva');
  }

  return (
    <Pagina>
      <Cabecalho titulo="Mensagens dos usuários" aoVoltar={() => navegacao.goBack()} />
      {caixa.carregando && !dados ? (
        <Carregando />
      ) : !dados ? (
        <EstadoVazio
          titulo="Não foi possível carregar"
          texto={caixa.erro ?? ''}
          acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void caixa.recarregar() }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={estilos.conteudo}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => void caixa.recarregar()}
              tintColor={p.destaque}
            />
          }
        >
          <Cartao estilo={{ gap: espaco.xs }}>
            <TituloDoCartao>Card de contato</TituloDoCartao>
            <TextoSuave estilo={{ fontSize: fonte.pequena }}>
              O que você cadastrar aparece para todos os usuários em Mais → Contato e feedback.
            </TextoSuave>
            {dados.informacoes.length === 0 && (
              <TextoSuave>Nenhuma informação ainda. Adicione e-mail, Pix, links...</TextoSuave>
            )}
            {dados.informacoes.map((info) => (
              <LinhaDeInformacao
                key={info.id}
                informacao={info}
                aoEditar={() => setFolha({ tipo: 'editar', informacao: info })}
              />
            ))}
            <View style={{ paddingTop: espaco.sm }}>
              <Botao
                titulo="Adicionar informação"
                aoPressionar={() => setFolha({ tipo: 'nova' })}
              />
            </View>
          </Cartao>

          <View style={estilos.entre}>
            <TituloDoCartao>Mensagens</TituloDoCartao>
            <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
              {dados.aguardandoResposta} aguardando resposta
            </Text>
          </View>
          <View style={estilos.chips}>
            {FILTROS_DE_MENSAGENS.map((f) => (
              <Chip
                key={f.chave}
                rotulo={f.rotulo}
                ativo={f.chave === filtro}
                aoPressionar={() => setFiltro(f.chave)}
              />
            ))}
          </View>
          {visiveis.length === 0 ? (
            <Text style={{ color: p.textoSuave, fontSize: fonte.corpo }}>
              {filtro === 'aguardando'
                ? 'Nenhuma mensagem aguardando resposta.'
                : 'Nenhuma mensagem.'}
            </Text>
          ) : (
            visiveis.map((m) => (
              <CartaoDaMensagem key={m.id} mensagem={m} aoResponder={() => setRespondendo(m)} />
            ))
          )}
        </ScrollView>
      )}

      <FolhaDeInformacao
        visivel={folha !== null}
        inicial={
          folha?.tipo === 'editar'
            ? {
                titulo: folha.informacao.titulo,
                descricao: folha.informacao.descricao ?? '',
                valor: folha.informacao.valor,
              }
            : null
        }
        aoSalvar={salvarInformacao}
        aoExcluir={
          folha?.tipo === 'editar' ? () => excluirInformacao(folha.informacao.id) : undefined
        }
        aoFechar={() => setFolha(null)}
      />
      <FolhaDeResposta
        mensagem={respondendo}
        aoSalvar={responder}
        aoFechar={() => setRespondendo(null)}
      />
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: {
    padding: espaco.lg,
    gap: espaco.lg,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  entre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  resposta: { borderRadius: 12, padding: espaco.md, gap: 4 },
});
