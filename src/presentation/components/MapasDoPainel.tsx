import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type { AdminMapa } from '../../domain/entities/admin';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { espaco, fonte, usePaleta } from '../theme';
import { Cartao, TextoSuave } from './base';
import { ListaComVerMais } from './ListaComVerMais';
import { TituloDoCartao } from './painel';
import { PreviaDoMapa } from './PreviaDoMapa';
import { Carregando, Pilula } from './ui';

interface LinhaProps {
  mapa: AdminMapa;
  aberto: boolean;
  confirmando: boolean;
  ocupado: boolean;
  aoAlternar: () => void;
  aoExcluir: () => void;
}

function LinhaDoMapa({ mapa, aberto, confirmando, ocupado, aoAlternar, aoExcluir }: LinhaProps) {
  const p = usePaleta();
  const container = useContainer();
  const copias =
    mapa.copias === 0
      ? 'ninguém copiou'
      : mapa.copias === 1
        ? 'copiado 1 vez'
        : `copiado ${mapa.copias} vezes`;

  return (
    <View style={[estilos.linha, { borderBottomColor: p.linha }]}>
      <View style={estilos.entre}>
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}
        >
          {mapa.nome}
        </Text>
        <Pilula
          texto={mapa.noCatalogo ? 'No catálogo' : 'Fora do catálogo'}
          tom={mapa.noCatalogo ? 'destaque' : 'neutro'}
        />
      </View>
      <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
        {mapa.cidade ? `${mapa.cidade} · ` : 'Sem cidade · '}
        {mapa.secoesComNome} {mapa.secoesComNome === 1 ? 'seção com nome' : 'seções com nome'} ·{' '}
        {copias}
        {mapa.copia ? ' · é uma cópia' : ''}
      </Text>
      <Text numberOfLines={1} style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
        Dono: {mapa.donoNome ?? 'sem dono'}
        {mapa.donoEmail ? ` · ${mapa.donoEmail}` : ''}
      </Text>
      {aberto && <PreviaDoMapa carregar={() => container.obterMapaDoPainel.executar(mapa.id)} />}
      {confirmando && (
        <Text style={{ color: p.alerta, fontSize: fonte.pequena }}>
          Apaga o mapa de vez e o tira do catálogo. As compras antigas continuam, sem o mercado, e
          as cópias que outros já fizeram não mudam.
        </Text>
      )}
      <View style={estilos.acoes}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${aberto ? 'Esconder' : 'Ver'} mapa ${mapa.nome}`}
          onPress={aoAlternar}
          style={[estilos.botao, { borderColor: p.destaque }]}
        >
          <Text style={{ color: p.destaque, fontWeight: '700', fontSize: fonte.pequena }}>
            {aberto ? 'Esconder mapa' : 'Ver mapa'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Excluir mapa ${mapa.nome}`}
          disabled={ocupado}
          onPress={aoExcluir}
          style={[
            estilos.botao,
            {
              borderColor: p.alerta,
              backgroundColor: confirmando ? p.alerta : 'transparent',
              opacity: ocupado ? 0.5 : 1,
            },
          ]}
        >
          <Text
            style={{
              color: confirmando ? p.textoSobreDestaque : p.alerta,
              fontWeight: '700',
              fontSize: fonte.pequena,
            }}
          >
            {confirmando ? 'Confirmar exclusão' : 'Excluir'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Moderação de mapas: todos os mapas de mercado criados pelos usuários, com quem é o dono, o desenho (prévia sob
 * demanda) e a exclusão, que pede um segundo toque porque apaga o mapa de vez.
 */
export function MapasDoPainel() {
  const p = usePaleta();
  const container = useContainer();
  const toast = useToast();
  const mapas = useCarregar(() => container.listarMapasDoPainel.executar(), 'admin-mapas');
  const [aberto, setAberto] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function excluir(mapa: AdminMapa) {
    if (confirmando !== mapa.id) {
      setConfirmando(mapa.id);
      return;
    }

    setOcupado(mapa.id);
    try {
      await container.excluirMapaDoPainel.executar(mapa.id);
      toast(`O mapa "${mapa.nome}" foi excluído.`);
      setAberto((atual) => (atual === mapa.id ? null : atual));
      await mapas.recarregar();
    } catch (e) {
      toast(mensagemParaUsuario(e));
    } finally {
      setConfirmando(null);
      setOcupado(null);
    }
  }

  return (
    <Cartao estilo={{ gap: espaco.sm }}>
      <View style={estilos.entre}>
        <TituloDoCartao>Mapas dos usuários</TituloDoCartao>
        {mapas.dados && (
          <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
            {mapas.dados.total} no total
          </Text>
        )}
      </View>
      {mapas.dados ? (
        mapas.dados.itens.length === 0 ? (
          <TextoSuave>Nenhum mapa criado ainda.</TextoSuave>
        ) : (
          <ListaComVerMais
            titulo="Mapas dos usuários"
            itens={mapas.dados.itens}
            renderizar={(lista) =>
              lista.map((mapa) => (
                <LinhaDoMapa
                  key={mapa.id}
                  mapa={mapa}
                  aberto={aberto === mapa.id}
                  confirmando={confirmando === mapa.id}
                  ocupado={ocupado === mapa.id}
                  aoAlternar={() => setAberto(aberto === mapa.id ? null : mapa.id)}
                  aoExcluir={() => void excluir(mapa)}
                />
              ))
            }
          />
        )
      ) : mapas.erro ? (
        <TextoSuave>{mapas.erro}</TextoSuave>
      ) : (
        <Carregando />
      )}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { paddingVertical: espaco.md, borderBottomWidth: 1, gap: 4 },
  entre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  acoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.xs },
  botao: {
    minHeight: 36,
    paddingHorizontal: espaco.md,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
