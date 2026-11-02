import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { espaco, fonte, raio, usePaleta } from '../theme';
import { Botao, Titulo } from './base';
import { Icone, type NomeDoIcone } from './Icone';

/** Moldura de toda tela: respeita as áreas seguras e limita a largura no desktop. */
export function Pagina({ children }: { children: React.ReactNode }) {
  const p = usePaleta();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.fundo }}>
      <View style={estilos.coluna}>{children}</View>
    </SafeAreaView>
  );
}

export function Carregando() {
  const p = usePaleta();
  return (
    <View style={estilos.centro}>
      <ActivityIndicator size="large" color={p.destaque} />
    </View>
  );
}

interface CabecalhoProps {
  titulo: string;
  aoVoltar?: () => void;
  direita?: React.ReactNode;
}

export function Cabecalho({ titulo, aoVoltar, direita }: CabecalhoProps) {
  const p = usePaleta();
  return (
    <View style={estilos.cabecalho}>
      {aoVoltar && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={aoVoltar}
          style={estilos.botaoIcone}
        >
          <Icone nome="voltar" cor={p.texto} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Titulo>{titulo}</Titulo>
      </View>
      {direita}
    </View>
  );
}

interface ChipProps {
  rotulo: string;
  ativo: boolean;
  aoPressionar: () => void;
}

export function Chip({ rotulo, ativo, aoPressionar }: ChipProps) {
  const p = usePaleta();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      onPress={aoPressionar}
      style={[
        estilos.chip,
        {
          backgroundColor: ativo ? p.destaque : p.superficie,
          borderColor: ativo ? p.destaque : p.linha,
        },
      ]}
    >
      <Text
        style={{ color: ativo ? p.textoSobreDestaque : p.texto, fontWeight: '600', fontSize: 13 }}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

export function BarraDeProgresso({ percentual }: { percentual: number }) {
  const p = usePaleta();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percentual }}
      style={[estilos.barra, { backgroundColor: p.superficie2 }]}
    >
      <View
        style={{
          width: `${percentual}%`,
          height: '100%',
          backgroundColor: p.destaque,
          borderRadius: raio.pilula,
        }}
      />
    </View>
  );
}

export function Pilula({
  texto,
  tom = 'destaque',
}: {
  texto: string;
  tom?: 'destaque' | 'neutro' | 'alerta';
}) {
  const p = usePaleta();
  const fundo =
    tom === 'destaque' ? p.destaqueSuave : tom === 'alerta' ? p.alertaSuave : p.superficie2;
  const cor = tom === 'destaque' ? p.destaque : tom === 'alerta' ? p.alerta : p.textoSuave;
  return (
    <View style={[estilos.pilula, { backgroundColor: fundo }]}>
      <Text style={{ color: cor, fontSize: 12, fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}

interface EstadoVazioProps {
  titulo: string;
  texto: string;
  acao?: { rotulo: string; aoPressionar: () => void };
}

/** Tela vazia que explica o que fazer, em vez de um branco sem explicação. */
export function EstadoVazio({ titulo, texto, acao }: EstadoVazioProps) {
  const p = usePaleta();
  return (
    <View style={estilos.vazio}>
      <Text
        style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '700', textAlign: 'center' }}
      >
        {titulo}
      </Text>
      <Text
        style={{ color: p.textoSuave, fontSize: fonte.corpo, textAlign: 'center', lineHeight: 21 }}
      >
        {texto}
      </Text>
      {acao && (
        <Botao
          titulo={acao.rotulo}
          aoPressionar={acao.aoPressionar}
          estilo={{ alignSelf: 'stretch' }}
        />
      )}
    </View>
  );
}

interface CampoDeBuscaProps {
  valor: string;
  aoMudar: (texto: string) => void;
  placeholder: string;
}

export function CampoDeBusca({ valor, aoMudar, placeholder }: CampoDeBuscaProps) {
  const p = usePaleta();
  return (
    <View style={[estilos.busca, { backgroundColor: p.superficie, borderColor: p.linha }]}>
      <Icone nome="busca" cor={p.textoSuave} tamanho={20} />
      <TextInput
        accessibilityLabel={placeholder}
        value={valor}
        onChangeText={aoMudar}
        placeholder={placeholder}
        placeholderTextColor={p.textoSuave}
        style={{ flex: 1, minHeight: 44, color: p.texto, fontSize: fonte.corpo }}
      />
    </View>
  );
}

export function BotaoFlutuante({
  aoPressionar,
  rotulo,
}: {
  aoPressionar: () => void;
  rotulo: string;
}) {
  const p = usePaleta();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={aoPressionar}
      style={[estilos.fab, { backgroundColor: p.destaque }]}
    >
      <Icone nome="mais_mais" cor={p.textoSobreDestaque} tamanho={26} espessura={2.5} />
    </Pressable>
  );
}

export function BotaoDeIcone({
  icone,
  rotulo,
  aoPressionar,
  desabilitado,
}: {
  icone: NomeDoIcone;
  rotulo: string;
  aoPressionar: () => void;
  desabilitado?: boolean;
}) {
  const p = usePaleta();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!desabilitado }}
      disabled={desabilitado}
      onPress={aoPressionar}
      style={[estilos.botaoIcone, { opacity: desabilitado ? 0.3 : 1 }]}
    >
      <Icone nome={icone} cor={p.textoSuave} tamanho={20} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  coluna: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    paddingHorizontal: espaco.lg,
    paddingTop: espaco.lg,
    paddingBottom: espaco.sm,
  },
  botaoIcone: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: raio.sm,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: raio.pilula,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barra: { height: 10, borderRadius: raio.pilula, overflow: 'hidden' },
  pilula: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: raio.pilula,
  },
  vazio: { alignItems: 'center', gap: espaco.md, padding: espaco.xxl },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    borderWidth: 1,
    borderRadius: raio.md,
    paddingHorizontal: espaco.md,
  },
  fab: {
    position: 'absolute',
    right: espaco.lg,
    bottom: espaco.lg,
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
