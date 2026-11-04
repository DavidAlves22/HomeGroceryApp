import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type { MercadoResumo } from '../../domain/entities/mercados';
import { mercadoEmUso } from '../../domain/services/compraDividida';
import { Botao, Campo, Cartao, MensagemDeErro, TextoSuave } from '../components/base';
import { Moldura, TituloDaFolha, RotuloDaFolha } from '../components/Folhas';
import { MapaSvg } from '../components/MapaSvg';
import { Cabecalho, Carregando, Chip, EstadoVazio, Pagina, Pilula } from '../components/ui';
import { useContainer, useMercadoAtual } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { aguardarFolhasFecharem } from '../hooks/useVoltarFecha';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

function CartaoDoMercado({
  mercado,
  emUso,
  podeExcluir,
  pendentes,
  confirmandoExclusao,
  aoComprar,
  aoEditar,
  aoExcluir,
  aoCompartilhar,
}: {
  mercado: MercadoResumo;
  emUso: boolean;
  podeExcluir: boolean;
  pendentes: { categoriaId: string | null; semNoMercado: boolean }[];
  confirmandoExclusao: boolean;
  aoComprar: () => void;
  aoEditar: () => void;
  aoExcluir: () => void;
  aoCompartilhar: () => void;
}) {
  const p = usePaleta();
  const container = useContainer();
  const { dados: completo } = useCarregar(
    () => container.obterMercado.executar(mercado.id),
    `mercado:${mercado.id}`,
  );
  const usadas = new Set(
    (completo?.secoes ?? []).flatMap((s) => [...s.categoriasLadoA, ...s.categoriasLadoB]),
  );
  const cobre = pendentes.filter(
    (i) => !i.semNoMercado && i.categoriaId && usadas.has(i.categoriaId),
  ).length;

  return (
    <Cartao estilo={{ gap: espaco.md }}>
      <View style={estilos.linha}>
        <View style={{ width: 120 }}>
          {completo && completo.id === mercado.id ? (
            <MapaSvg mapa={completo} modo="mini" />
          ) : (
            <View
              style={{
                aspectRatio: mercado.largura / mercado.altura,
                backgroundColor: p.superficie2,
                borderRadius: 8,
              }}
            />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: espaco.xs }}>
          <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '700' }}>
            {mercado.nome}
          </Text>
          {emUso && <Pilula texto="Comprando aqui" />}
          <Text
            style={{ color: p.textoSuave, fontSize: fonte.pequena, fontVariant: ['tabular-nums'] }}
          >
            {mercado.cidade ? `${mercado.cidade} · ` : ''}
            {mercado.secoes} {mercado.secoes === 1 ? 'seção' : 'seções'} · cobre {cobre} dos{' '}
            {pendentes.length} itens que faltam
          </Text>
        </View>
      </View>
      <View style={estilos.acoes}>
        <Botao titulo="Comprar aqui" aoPressionar={aoComprar} estilo={{ flex: 1, minHeight: 44 }} />
        <Botao
          titulo="Editar mapa"
          variante="secundario"
          aoPressionar={aoEditar}
          estilo={{ flex: 1, minHeight: 44 }}
        />
      </View>
      <View style={estilos.compartilhar}>
        <Text style={{ color: p.textoSuave, fontSize: fonte.pequena, flex: 1 }}>
          {mercado.compartilhada === false
            ? 'Mapa só seu: não aparece em Mapas existentes.'
            : 'Outras pessoas podem copiar este mapa (sem alterar o seu).'}
        </Text>
        <Botao
          titulo={mercado.compartilhada === false ? 'Compartilhar' : 'Parar de compartilhar'}
          variante="texto"
          aoPressionar={aoCompartilhar}
          estilo={{ minHeight: 36, paddingHorizontal: espaco.sm }}
        />
      </View>
      {podeExcluir && (
        <Botao
          titulo={confirmandoExclusao ? 'Toque de novo para excluir' : 'Excluir mercado'}
          variante={confirmandoExclusao ? 'principal' : 'texto'}
          aoPressionar={aoExcluir}
        />
      )}
    </Cartao>
  );
}

function FolhaDeNovoMercado({
  visivel,
  mercados,
  aoCriar,
  aoFechar,
}: {
  visivel: boolean;
  mercados: MercadoResumo[];
  aoCriar: (nome: string, cidade: string, copiarDe?: string) => Promise<void>;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [copiarDe, setCopiarDe] = useState<string | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function criar() {
    setEnviando(true);
    setErro(null);
    try {
      await aoCriar(nome, cidade, copiarDe);
      setNome('');
      setCidade('');
      setCopiarDe(undefined);
    } catch (e) {
      setErro(mensagemParaUsuario(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Moldura visivel={visivel} aoFechar={aoFechar}>
      <TituloDaFolha>Novo mercado</TituloDaFolha>
      <Campo
        rotulo="Nome"
        value={nome}
        onChangeText={setNome}
        placeholder="Ex.: Supermercado da Praça"
        maxLength={120}
      />
      <Campo
        rotulo="Cidade"
        value={cidade}
        onChangeText={setCidade}
        placeholder="Ex.: Araras"
        autoCapitalize="words"
        maxLength={80}
      />
      <TextoSuave>
        A cidade ajuda outras pessoas a encontrar este mapa em Mapas existentes.
      </TextoSuave>
      <RotuloDaFolha>Ponto de partida do mapa</RotuloDaFolha>
      <View style={estilos.chips}>
        <Chip
          rotulo="Mapa em branco"
          ativo={!copiarDe}
          aoPressionar={() => setCopiarDe(undefined)}
        />
        {mercados.map((m) => (
          <Chip
            key={m.id}
            rotulo={`Copiar de ${m.nome}`}
            ativo={copiarDe === m.id}
            aoPressionar={() => {
              setCopiarDe(m.id);
              // Mesmo mercado em outro bairro costuma ser da mesma cidade: já sugere a do mapa copiado.
              if (!cidade.trim() && m.cidade) setCidade(m.cidade);
            }}
          />
        ))}
      </View>
      <MensagemDeErro mensagem={erro} />
      <Botao
        titulo="Criar e abrir o editor"
        carregando={enviando}
        aoPressionar={() => void criar()}
      />
      <Botao titulo="Cancelar" variante="texto" aoPressionar={aoFechar} />
    </Moldura>
  );
}

/** Mercados do grupo: cada um com o seu mapa. A mesma compra pode passar por vários. */
export function MercadosScreen() {
  const container = useContainer();
  const navegacao = useNavegacao();
  const toast = useToast();
  const { mercadoId, definirMercado } = useMercadoAtual();
  const {
    dados: mercados,
    erro,
    carregando,
    recarregar,
  } = useCarregar(() => container.listarMercados.executar(), 'mercados');
  const { dados: lista } = useCarregar(() => container.obterListaAtual.executar(), 'atual');
  const [novo, setNovo] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const emUso = mercadoEmUso(mercados, mercadoId);
  const pendentesDaLista = (lista?.itens ?? []).filter((i) => !i.comprado);

  async function excluir(m: MercadoResumo) {
    if (excluindo !== m.id) {
      setExcluindo(m.id);
      return;
    }
    try {
      await container.excluirMercado.executar(m.id);
      setExcluindo(null);
      if (mercadoId === m.id) definirMercado(null);
      toast('Mercado removido. Itens já comprados nele continuam comprados.');
      await recarregar();
    } catch (e) {
      toast(mensagemParaUsuario(e));
    }
  }

  async function alternarCompartilhamento(m: MercadoResumo) {
    const compartilhar = m.compartilhada === false;
    try {
      await container.compartilharMercado.executar(m.id, compartilhar);
      toast(
        compartilhar
          ? 'Mapa compartilhado: outras pessoas podem copiá-lo.'
          : 'Mapa deixou de aparecer para os outros. Quem já copiou continua com a cópia.',
      );
      await recarregar();
    } catch (e) {
      toast(mensagemParaUsuario(e));
    }
  }

  return (
    <Pagina>
      <Cabecalho titulo="Mercados" aoVoltar={() => navegacao.goBack()} />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <TextoSuave>
          Cada mercado tem o seu próprio mapa. A mesma compra pode ser dividida entre vários: a rota
          de cada um mostra só o que ainda falta.
        </TextoSuave>
        {carregando && !mercados ? (
          <Carregando />
        ) : erro && !mercados ? (
          <EstadoVazio
            titulo="Não foi possível carregar"
            texto={erro}
            acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void recarregar() }}
          />
        ) : mercados && mercados.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum mercado ainda"
            texto="Cadastre o primeiro mercado e desenhe o layout dele para receber a rota da compra."
            acao={{ rotulo: 'Novo mercado', aoPressionar: () => setNovo(true) }}
          />
        ) : (
          (mercados ?? []).map((m) => (
            <CartaoDoMercado
              key={m.id}
              mercado={m}
              emUso={emUso?.id === m.id}
              podeExcluir={(mercados ?? []).length > 1}
              confirmandoExclusao={excluindo === m.id}
              pendentes={pendentesDaLista.map((i) => ({
                categoriaId: i.categoriaId,
                semNoMercado: i.semNasLojas.includes(m.id),
              }))}
              aoComprar={() => {
                definirMercado(m.id);
                navegacao.navigate('Rota');
              }}
              aoEditar={() => navegacao.navigate('MapaDoMercado', { mercadoId: m.id })}
              aoExcluir={() => void excluir(m)}
              aoCompartilhar={() => void alternarCompartilhamento(m)}
            />
          ))
        )}
        {mercados && mercados.length > 0 && (
          <Botao titulo="Novo mercado" aoPressionar={() => setNovo(true)} />
        )}
        <Botao
          titulo="Carregar mapas existentes"
          variante="secundario"
          aoPressionar={() => navegacao.navigate('CatalogoDeMapas')}
        />
      </ScrollView>

      <FolhaDeNovoMercado
        visivel={novo}
        mercados={mercados ?? []}
        aoFechar={() => setNovo(false)}
        aoCriar={async (nome, cidade, copiarDe) => {
          const criado = await container.criarMercado.executar(nome, cidade, copiarDe);
          setNovo(false);
          // A folha desfaz uma entrada do histórico ao fechar; navegar antes disso a desfaria junto com a tela nova.
          await aguardarFolhasFecharem();
          toast('Mercado criado. Ajuste o mapa e as categorias.');
          navegacao.navigate('MapaDoMercado', { mercadoId: criado.id });
        }}
      />
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, paddingBottom: 40, gap: espaco.lg },
  linha: { flexDirection: 'row', gap: espaco.md, alignItems: 'flex-start' },
  acoes: { flexDirection: 'row', gap: espaco.sm },
  compartilhar: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
});
