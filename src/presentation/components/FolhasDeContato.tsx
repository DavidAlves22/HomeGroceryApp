import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type {
  DadosDaInformacao,
  MensagemParaAdmin,
  NovaMensagem,
  StatusDaMensagem,
  TipoDeMensagem,
} from '../../domain/entities/contato';
import {
  ASSUNTO_MAXIMO,
  DESCRICAO_MAXIMA,
  RESPOSTA_MAXIMA,
  rotuloDoStatus,
  rotuloDoTipo,
  STATUS_DE_MENSAGEM,
  TEXTO_MAXIMO,
  TIPOS_DE_MENSAGEM,
  TITULO_MAXIMO,
  VALOR_MAXIMO,
} from '../../domain/services/contato';
import { fonte, usePaleta } from '../theme';
import { Botao, Campo, MensagemDeErro } from './base';
import { Moldura, RotuloDaFolha, TituloDaFolha } from './Folhas';
import { Chip } from './ui';

/** Roda a ação mostrando o erro na folha e travando o botão enquanto envia. */
function useEnvio() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setEnviando(true);
    try {
      await acao();
    } catch (e) {
      setErro(mensagemParaUsuario(e));
    } finally {
      setEnviando(false);
    }
  }

  return { erro, setErro, enviando, executar };
}

/** Feedback ou solicitação nova: o tipo, um assunto curto e o texto. */
export function FolhaDeNovaMensagem({
  visivel,
  aoEnviar,
  aoFechar,
}: {
  visivel: boolean;
  aoEnviar: (dados: NovaMensagem) => Promise<void>;
  aoFechar: () => void;
}) {
  const p = usePaleta();
  const [tipo, setTipo] = useState<TipoDeMensagem>('Feedback');
  const [assunto, setAssunto] = useState('');
  const [texto, setTexto] = useState('');
  const { erro, setErro, enviando, executar } = useEnvio();

  useEffect(() => {
    if (visivel) {
      setTipo('Feedback');
      setAssunto('');
      setTexto('');
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);

  return (
    <Moldura visivel={visivel} aoFechar={aoFechar}>
      <TituloDaFolha>Novo feedback ou solicitação</TituloDaFolha>
      <RotuloDaFolha>O que você quer enviar?</RotuloDaFolha>
      <ChipsDeTipo tipo={tipo} aoEscolher={setTipo} />
      <Campo
        rotulo="Assunto"
        value={assunto}
        onChangeText={setAssunto}
        maxLength={ASSUNTO_MAXIMO}
        placeholder="Resumo em poucas palavras"
      />
      <Campo
        rotulo="Mensagem"
        value={texto}
        onChangeText={setTexto}
        multiline
        numberOfLines={6}
        maxLength={TEXTO_MAXIMO}
        placeholder="Conte com detalhes"
        style={{ minHeight: 140, textAlignVertical: 'top' }}
      />
      <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
        {texto.length} de {TEXTO_MAXIMO} caracteres
      </Text>
      <MensagemDeErro mensagem={erro} />
      <Botao
        titulo="Enviar"
        carregando={enviando}
        aoPressionar={() => void executar(() => aoEnviar({ tipo, assunto, texto }))}
      />
      <Botao titulo="Cancelar" variante="texto" aoPressionar={aoFechar} />
    </Moldura>
  );
}

function ChipsDeTipo({
  tipo,
  aoEscolher,
}: {
  tipo: TipoDeMensagem;
  aoEscolher: (tipo: TipoDeMensagem) => void;
}) {
  return (
    <View style={estilos.chips}>
      {TIPOS_DE_MENSAGEM.map((t) => (
        <Chip
          key={t}
          rotulo={rotuloDoTipo(t)}
          ativo={t === tipo}
          aoPressionar={() => aoEscolher(t)}
        />
      ))}
    </View>
  );
}

/** O administrador responde e/ou muda o status de uma mensagem. */
export function FolhaDeResposta({
  mensagem,
  aoSalvar,
  aoFechar,
}: {
  mensagem: MensagemParaAdmin | null;
  aoSalvar: (id: string, resposta: string, status: StatusDaMensagem) => Promise<void>;
  aoFechar: () => void;
}) {
  const p = usePaleta();
  const [resposta, setResposta] = useState('');
  const [status, setStatus] = useState<StatusDaMensagem>('Respondida');
  const { erro, setErro, enviando, executar } = useEnvio();

  useEffect(() => {
    if (mensagem) {
      setResposta(mensagem.resposta ?? '');
      setStatus(mensagem.status === 'Recebida' ? 'Respondida' : mensagem.status);
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagem?.id]);

  return (
    <Moldura visivel={mensagem !== null} aoFechar={aoFechar}>
      <TituloDaFolha>Responder</TituloDaFolha>
      {mensagem && (
        <>
          <Text style={{ color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}>
            {mensagem.assunto}
          </Text>
          <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
            {mensagem.nome} · {mensagem.email}
          </Text>
          <Text style={{ color: p.texto, fontSize: fonte.corpo }}>{mensagem.texto}</Text>
        </>
      )}
      <Campo
        rotulo="Sua resposta"
        value={resposta}
        onChangeText={setResposta}
        multiline
        numberOfLines={5}
        maxLength={RESPOSTA_MAXIMA}
        style={{ minHeight: 120, textAlignVertical: 'top' }}
      />
      <RotuloDaFolha>Status</RotuloDaFolha>
      <View style={estilos.chips}>
        {STATUS_DE_MENSAGEM.map((s) => (
          <Chip
            key={s}
            rotulo={rotuloDoStatus(s)}
            ativo={s === status}
            aoPressionar={() => setStatus(s)}
          />
        ))}
      </View>
      <MensagemDeErro mensagem={erro} />
      <Botao
        titulo="Salvar"
        carregando={enviando}
        aoPressionar={() =>
          void executar(async () => {
            if (mensagem) await aoSalvar(mensagem.id, resposta, status);
          })
        }
      />
      <Botao titulo="Cancelar" variante="texto" aoPressionar={aoFechar} />
    </Moldura>
  );
}

/** Cria ou edita uma informação do card de contato; ao editar, também dá para excluir (segundo toque). */
export function FolhaDeInformacao({
  visivel,
  inicial,
  aoSalvar,
  aoExcluir,
  aoFechar,
}: {
  visivel: boolean;
  /** Presente = edição. */
  inicial: DadosDaInformacao | null;
  aoSalvar: (dados: DadosDaInformacao) => Promise<void>;
  aoExcluir?: () => Promise<void>;
  aoFechar: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const { erro, setErro, enviando, executar } = useEnvio();

  useEffect(() => {
    if (visivel) {
      setTitulo(inicial?.titulo ?? '');
      setDescricao(inicial?.descricao ?? '');
      setValor(inicial?.valor ?? '');
      setConfirmando(false);
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);

  return (
    <Moldura visivel={visivel} aoFechar={aoFechar}>
      <TituloDaFolha>{inicial ? 'Editar informação' : 'Nova informação'}</TituloDaFolha>
      <Campo
        rotulo="Título"
        value={titulo}
        onChangeText={setTitulo}
        maxLength={TITULO_MAXIMO}
        placeholder="Ex.: E-mail para contato"
      />
      <Campo
        rotulo="Descrição (opcional)"
        value={descricao}
        onChangeText={setDescricao}
        maxLength={DESCRICAO_MAXIMA}
        placeholder="Ex.: Caso queira mandar um e-mail"
      />
      <Campo
        rotulo="Valor"
        value={valor}
        onChangeText={setValor}
        maxLength={VALOR_MAXIMO}
        autoCapitalize="none"
        placeholder="Ex.: contato@exemplo.com"
      />
      <MensagemDeErro mensagem={erro} />
      <Botao
        titulo="Salvar"
        carregando={enviando}
        aoPressionar={() => void executar(() => aoSalvar({ titulo, descricao, valor }))}
      />
      {inicial && aoExcluir && (
        <Botao
          titulo={confirmando ? 'Toque de novo para excluir' : 'Excluir'}
          variante={confirmando ? 'perigoCheio' : 'perigo'}
          desabilitado={enviando}
          aoPressionar={() => (confirmando ? void executar(aoExcluir) : setConfirmando(true))}
        />
      )}
      <Botao titulo="Cancelar" variante="texto" aoPressionar={aoFechar} />
    </Moldura>
  );
}

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
