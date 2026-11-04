import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type { MapaCompartilhado, MapaEmEdicao } from '../../domain/entities/mercados';
import { Botao, Cartao, MensagemDeErro, TextoSuave } from '../components/base';
import { MapaSvg } from '../components/MapaSvg';
import { Cabecalho, CampoDeBusca, Carregando, EstadoVazio, Pagina } from '../components/ui';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

/** Prévia grande de um mapa do catálogo: só carrega quando a pessoa pede (cada mapa é uma consulta). */
function PreviaDoMapa({ id }: { id: string }) {
  const container = useContainer();
  const [mapa, setMapa] = useState<MapaEmEdicao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    container.obterMapaCompartilhado
      .executar(id)
      .then((detalhe) => {
        if (!ativo) return;
        // Só desenha: as categorias do catálogo são nomes e a prévia não usa ids.
        setMapa({
          nome: detalhe.nome,
          cidade: detalhe.cidade ?? '',
          largura: detalhe.largura,
          altura: detalhe.altura,
          entrada: detalhe.entrada,
          caixas: detalhe.caixas,
          secoes: detalhe.secoes.map((s, i) => ({ ...s, id: `previa-${i}` })),
        });
      })
      .catch((e) => ativo && setErro(mensagemParaUsuario(e)));
    return () => {
      ativo = false;
    };
  }, [container, id]);

  if (erro) return <MensagemDeErro mensagem={erro} />;
  if (!mapa) return <Carregando />;
  return <MapaSvg mapa={mapa} modo="mini" />;
}

function CartaoDoMapa({
  mapa,
  aberto,
  copiando,
  aoAlternar,
  aoCopiar,
}: {
  mapa: MapaCompartilhado;
  aberto: boolean;
  copiando: boolean;
  aoAlternar: () => void;
  aoCopiar: () => void;
}) {
  const p = usePaleta();
  return (
    <Cartao estilo={{ gap: espaco.md }}>
      <View style={{ gap: espaco.xs }}>
        <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '700' }}>
          {mapa.nome}
        </Text>
        <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
          {mapa.cidade ? `${mapa.cidade} · ` : ''}
          {mapa.secoes} {mapa.secoes === 1 ? 'seção' : 'seções'} ·{' '}
          {mapa.copias === 0
            ? 'ainda ninguém copiou'
            : mapa.copias === 1
              ? 'copiado 1 vez'
              : `copiado ${mapa.copias} vezes`}
        </Text>
      </View>
      {aberto && <PreviaDoMapa id={mapa.id} />}
      <View style={estilos.acoes}>
        <Botao
          titulo={aberto ? 'Esconder mapa' : 'Ver mapa'}
          variante="secundario"
          aoPressionar={aoAlternar}
          estilo={{ flex: 1, minHeight: 44 }}
        />
        <Botao
          titulo="Copiar"
          carregando={copiando}
          aoPressionar={aoCopiar}
          estilo={{ flex: 1, minHeight: 44 }}
        />
      </View>
    </Cartao>
  );
}

/** Catálogo: mapas de mercado de todos os grupos. Copiar cria um mercado só seu, que você edita à vontade. */
export function CatalogoDeMapasScreen() {
  const container = useContainer();
  const navegacao = useNavegacao();
  const toast = useToast();
  const [busca, setBusca] = useState('');
  // Espera a pessoa parar de digitar para não consultar a cada letra.
  const [termo, setTermo] = useState('');
  const [cidade, setCidade] = useState('');
  const [cidadeFiltro, setCidadeFiltro] = useState('');
  useEffect(() => {
    const espera = setTimeout(() => {
      setTermo(busca.trim());
      setCidadeFiltro(cidade.trim());
    }, 350);
    return () => clearTimeout(espera);
  }, [busca, cidade]);

  const {
    dados: mapas,
    erro,
    carregando,
    recarregar,
  } = useCarregar(
    () => container.listarMapasCompartilhados.executar(termo, cidadeFiltro),
    `mapas-catalogo:${termo}|${cidadeFiltro}`,
  );
  const [aberto, setAberto] = useState<string | null>(null);
  const [copiando, setCopiando] = useState<string | null>(null);
  const [erroAoCopiar, setErroAoCopiar] = useState<string | null>(null);

  async function copiar(mapa: MapaCompartilhado) {
    setCopiando(mapa.id);
    setErroAoCopiar(null);
    try {
      const novo = await container.copiarMapaCompartilhado.executar(mapa.id);
      toast('Mapa copiado. Agora ele é seu: ajuste como quiser.');
      navegacao.navigate('MapaDoMercado', { mercadoId: novo.id });
    } catch (e) {
      setErroAoCopiar(mensagemParaUsuario(e));
      void recarregar();
    } finally {
      setCopiando(null);
    }
  }

  return (
    <Pagina>
      <Cabecalho titulo="Mapas existentes" aoVoltar={() => navegacao.goBack()} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <TextoSuave>
          Mapas de mercado feitos por outras pessoas. Ao copiar, você recebe uma versão só sua, que
          pode editar; o mapa original continua como está para os outros.
        </TextoSuave>
        <CampoDeBusca valor={busca} aoMudar={setBusca} placeholder="Buscar mercado" />
        <CampoDeBusca valor={cidade} aoMudar={setCidade} placeholder="Filtrar por cidade" />
        <MensagemDeErro mensagem={erroAoCopiar} />
        {carregando && !mapas ? (
          <Carregando />
        ) : erro && !mapas ? (
          <EstadoVazio
            titulo="Não foi possível carregar"
            texto={erro}
            acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void recarregar() }}
          />
        ) : mapas && mapas.length === 0 ? (
          <EstadoVazio
            titulo={
              termo || cidadeFiltro
                ? 'Nenhum mapa encontrado com esse filtro'
                : 'Ainda não há mapas de outras pessoas'
            }
            texto="Você pode criar o seu: ele fica aqui para os outros copiarem também."
          />
        ) : (
          (mapas ?? []).map((m) => (
            <CartaoDoMapa
              key={m.id}
              mapa={m}
              aberto={aberto === m.id}
              copiando={copiando === m.id}
              aoAlternar={() => setAberto(aberto === m.id ? null : m.id)}
              aoCopiar={() => void copiar(m)}
            />
          ))
        )}
      </ScrollView>
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, paddingBottom: 40, gap: espaco.lg },
  acoes: { flexDirection: 'row', gap: espaco.sm },
});
