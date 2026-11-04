import React, { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type { Convite, Membro } from '../../domain/entities/grupo';
import { Botao, Campo, Cartao, MensagemDeErro, TextoSuave } from '../components/base';
import { FolhaDeTexto } from '../components/Folhas';
import { IndicadorDeSincronizacao } from '../components/Sincronizacao';
import { Cabecalho, Carregando, EstadoVazio, Pagina, Pilula } from '../components/ui';
import { useContainer, useSessao } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

/**
 * Grupo familiar. Todo mundo começa sozinho no próprio grupo; para compartilhar, o administrador gera um
 * código e a outra pessoa o digita aqui. Os dados antigos de quem entra ficam guardados e voltam se sair.
 */
export function GrupoScreen() {
  const p = usePaleta();
  const container = useContainer();
  const { definirSessao } = useSessao();
  const navegacao = useNavegacao();
  const toast = useToast();
  const {
    dados: grupo,
    erro,
    carregando,
    recarregar,
  } = useCarregar(() => container.obterGrupo.executar(), 'grupo');

  const [convite, setConvite] = useState<Convite | null>(null);
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  if (carregando && !grupo)
    return (
      <Pagina>
        <Carregando />
      </Pagina>
    );
  if (erro && !grupo) {
    return (
      <Pagina>
        <Cabecalho titulo="Grupo familiar" aoVoltar={() => navegacao.goBack()} />
        <EstadoVazio
          titulo="Não foi possível carregar"
          texto={erro}
          acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void recarregar() }}
        />
      </Pagina>
    );
  }
  if (!grupo) return null;

  const souAdministrador = grupo.meuPapel === 'Administrador';

  async function executar(acao: () => Promise<void>) {
    setErroDaAcao(null);
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      setErroDaAcao(mensagemParaUsuario(e));
    } finally {
      setOcupado(false);
    }
  }

  const gerarConvite = () =>
    executar(async () => setConvite(await container.criarConvite.executar()));

  const entrar = () =>
    executar(async () => {
      const sessao = await container.entrarEmGrupo.executar(codigo);
      toast('Você entrou no grupo. Agora vê as listas da família.');
      definirSessao(sessao); // o app inteiro passa a usar o grupo novo
    });

  const sair = () =>
    executar(async () => {
      const sessao = await container.sairDoGrupo.executar();
      toast('Você saiu do grupo e voltou às suas listas.');
      definirSessao(sessao);
    });

  const remover = (membro: Membro) =>
    executar(async () => {
      await container.removerMembroDoGrupo.executar(membro.usuarioId);
      setRemovendo(null);
      toast(`${membro.nome} saiu do grupo`);
      await recarregar();
    });

  async function compartilhar(c: Convite) {
    const mensagem = `Entre na minha lista de compras no Home Grocery com o código ${c.codigo} (vale por 7 dias).`;
    try {
      await Share.share({ message: mensagem });
    } catch {
      // Sem compartilhamento nativo (alguns navegadores): o código continua na tela para copiar.
      toast('Copie o código acima e envie para a pessoa.');
    }
  }

  async function copiar(c: Convite) {
    try {
      await navigator.clipboard.writeText(c.codigo);
      toast('Código copiado');
    } catch {
      toast('Selecione o código e copie.');
    }
  }

  return (
    <Pagina>
      <Cabecalho
        titulo="Grupo familiar"
        aoVoltar={() => navegacao.goBack()}
        direita={<IndicadorDeSincronizacao />}
      />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Cartao estilo={{ gap: espaco.sm }}>
          <View style={estilos.entre}>
            <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '800', flex: 1 }}>
              {grupo.nome}
            </Text>
            <Pilula texto={grupo.meuPapel === 'Administrador' ? 'Administrador' : 'Membro'} />
          </View>
          <TextoSuave>
            {grupo.compartilhado
              ? `${grupo.membros.length} pessoas compartilham as listas, a lista padrão e o histórico em tempo real.`
              : 'Só você está neste grupo. Convide alguém da família ou entre com um código.'}
          </TextoSuave>
          {souAdministrador && (
            <Botao
              titulo="Renomear grupo"
              variante="texto"
              aoPressionar={() => setRenomeando(true)}
              estilo={{ alignSelf: 'flex-start' }}
            />
          )}
        </Cartao>

        <Cartao estilo={{ paddingVertical: 4 }}>
          {grupo.membros.map((membro, indice) => (
            <View
              key={membro.usuarioId}
              style={[
                estilos.membro,
                { borderTopColor: p.linha, borderTopWidth: indice === 0 ? 0 : 1 },
              ]}
            >
              <View style={[estilos.inicial, { backgroundColor: p.destaqueSuave }]}>
                <Text style={{ color: p.destaque, fontWeight: '800' }}>
                  {membro.nome.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}
                >
                  {membro.nome}
                  {membro.voce ? ' (você)' : ''}
                </Text>
                <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                  {membro.papel === 'Administrador' ? 'Administrador' : 'Membro'}
                </Text>
              </View>
              {souAdministrador && !membro.voce && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${membro.nome}`}
                  onPress={() =>
                    removendo === membro.usuarioId
                      ? void remover(membro)
                      : setRemovendo(membro.usuarioId)
                  }
                  style={[
                    estilos.remover,
                    {
                      borderColor: p.alerta,
                      backgroundColor: removendo === membro.usuarioId ? p.alerta : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: removendo === membro.usuarioId ? p.textoSobreDestaque : p.alerta,
                      fontWeight: '700',
                      fontSize: fonte.pequena,
                    }}
                  >
                    {removendo === membro.usuarioId ? 'Confirmar' : 'Remover'}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </Cartao>

        {souAdministrador && (
          <Cartao estilo={{ gap: espaco.md }}>
            <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '800' }}>
              Convidar alguém
            </Text>
            <TextoSuave>
              Gere um código e envie para a pessoa. Ele vale por 7 dias e só pode ser usado uma vez.
            </TextoSuave>
            {convite && (
              <View
                style={[estilos.codigoCaixa, { backgroundColor: p.fundo, borderColor: p.linha }]}
              >
                <Text
                  selectable
                  accessibilityLabel={`Código de convite ${convite.codigo}`}
                  style={{
                    color: p.texto,
                    fontSize: 30,
                    fontWeight: '800',
                    letterSpacing: 3,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {convite.codigo}
                </Text>
                <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                  Vale até {new Date(convite.expiraEm).toLocaleDateString('pt-BR')}
                </Text>
                <View style={estilos.linhaDeBotoes}>
                  <Botao
                    titulo="Copiar"
                    variante="secundario"
                    estilo={{ flex: 1 }}
                    aoPressionar={() => void copiar(convite)}
                  />
                  <Botao
                    titulo="Compartilhar"
                    variante="secundario"
                    estilo={{ flex: 1 }}
                    aoPressionar={() => void compartilhar(convite)}
                  />
                </View>
              </View>
            )}
            <Botao
              titulo={convite ? 'Gerar outro código' : 'Gerar código de convite'}
              carregando={ocupado}
              aoPressionar={() => void gerarConvite()}
            />
          </Cartao>
        )}

        {!grupo.compartilhado && (
          <Cartao estilo={{ gap: espaco.md }}>
            <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '800' }}>
              Entrar com um código
            </Text>
            <TextoSuave>
              Recebeu um código? Digite abaixo. Suas listas atuais ficam guardadas e voltam se você
              sair do grupo.
            </TextoSuave>
            <Campo
              rotulo="Código de convite"
              value={codigo}
              onChangeText={setCodigo}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="K7M2-XQ9P"
              onSubmitEditing={() => void entrar()}
            />
            <Botao
              titulo="Entrar na família"
              carregando={ocupado}
              desabilitado={codigo.trim().length === 0}
              aoPressionar={() => void entrar()}
            />
          </Cartao>
        )}

        <MensagemDeErro mensagem={erroDaAcao} />

        {grupo.compartilhado && (
          <Botao
            titulo={confirmandoSaida ? 'Toque de novo para sair do grupo' : 'Sair do grupo'}
            variante={confirmandoSaida ? 'principal' : 'secundario'}
            carregando={ocupado}
            aoPressionar={() => (confirmandoSaida ? void sair() : setConfirmandoSaida(true))}
          />
        )}
      </ScrollView>

      <FolhaDeTexto
        visivel={renomeando}
        titulo="Renomear grupo"
        rotulo="Nome do grupo"
        valorInicial={grupo.nome}
        rotuloDoBotao="Salvar"
        aoSalvar={async (texto) => {
          await container.renomearGrupo.executar(texto);
          setRenomeando(false);
          toast('Grupo renomeado');
          await recarregar();
        }}
        aoFechar={() => setRenomeando(false)}
      />
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, gap: espaco.lg, paddingBottom: 60 },
  entre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  membro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    paddingVertical: espaco.md,
    minHeight: 64,
  },
  inicial: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remover: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codigoCaixa: {
    borderRadius: 16,
    borderWidth: 1,
    padding: espaco.lg,
    alignItems: 'center',
    gap: espaco.sm,
  },
  linhaDeBotoes: { flexDirection: 'row', gap: espaco.sm, alignSelf: 'stretch' },
});
