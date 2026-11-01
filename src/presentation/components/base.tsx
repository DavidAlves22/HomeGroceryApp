import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { espaco, fonte, raio, usePaleta } from '../theme';

interface BotaoProps {
  titulo: string;
  aoPressionar: () => void;
  variante?: 'principal' | 'secundario' | 'texto';
  carregando?: boolean;
  desabilitado?: boolean;
  estilo?: ViewStyle;
}

/** Botão de 48 px de altura (alvo de toque confortável para uma mão só). */
export function Botao({
  titulo,
  aoPressionar,
  variante = 'principal',
  carregando,
  desabilitado,
  estilo,
}: BotaoProps) {
  const p = usePaleta();
  const principal = variante === 'principal';
  const inativo = desabilitado || carregando;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inativo }}
      onPress={aoPressionar}
      disabled={inativo}
      style={({ pressed }) => [
        estilos.botao,
        {
          backgroundColor: principal
            ? p.destaque
            : variante === 'secundario'
              ? p.superficie
              : 'transparent',
          borderColor: variante === 'secundario' ? p.linha : 'transparent',
          opacity: inativo ? 0.6 : pressed ? 0.85 : 1,
        },
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={principal ? p.textoSobreDestaque : p.destaque} />
      ) : (
        <Text
          style={[
            estilos.botaoTexto,
            {
              color: principal ? p.textoSobreDestaque : variante === 'texto' ? p.destaque : p.texto,
            },
          ]}
        >
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}

interface CampoProps extends TextInputProps {
  rotulo: string;
}

export function Campo({ rotulo, style, ...resto }: CampoProps) {
  const p = usePaleta();
  return (
    <View style={{ gap: espaco.xs }}>
      <Text style={[estilos.rotulo, { color: p.textoSuave }]}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={p.textoSuave}
        style={[
          estilos.campo,
          { backgroundColor: p.superficie, borderColor: p.linha, color: p.texto },
          style,
        ]}
        {...resto}
      />
    </View>
  );
}

export function Cartao({ children, estilo }: { children: React.ReactNode; estilo?: ViewStyle }) {
  const p = usePaleta();
  return (
    <View style={[estilos.cartao, { backgroundColor: p.superficie, borderColor: p.linha }, estilo]}>
      {children}
    </View>
  );
}

export function Titulo({ children }: { children: React.ReactNode }) {
  const p = usePaleta();
  return <Text style={[estilos.titulo, { color: p.texto }]}>{children}</Text>;
}

export function TextoSuave({ children, estilo }: { children: React.ReactNode; estilo?: object }) {
  const p = usePaleta();
  return (
    <Text style={[{ color: p.textoSuave, fontSize: fonte.corpo, lineHeight: 21 }, estilo]}>
      {children}
    </Text>
  );
}

/** Faixa de erro com mensagem amigável (nunca detalhe técnico). */
export function MensagemDeErro({ mensagem }: { mensagem: string | null }) {
  const p = usePaleta();
  if (!mensagem) return null;
  return (
    <View accessibilityRole="alert" style={[estilos.erro, { backgroundColor: p.alertaSuave }]}>
      <Text style={{ color: p.alerta, fontSize: fonte.corpo, fontWeight: '600' }}>{mensagem}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: 48,
    borderRadius: raio.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espaco.xl,
  },
  botaoTexto: { fontSize: fonte.corpo, fontWeight: '700' },
  rotulo: { fontSize: fonte.pequena, fontWeight: '700' },
  campo: {
    minHeight: 48,
    borderRadius: raio.sm,
    borderWidth: 1,
    paddingHorizontal: espaco.md,
    fontSize: fonte.corpo,
  },
  cartao: { borderRadius: raio.lg, borderWidth: 1, padding: espaco.lg },
  titulo: { fontSize: fonte.grande, fontWeight: '800', letterSpacing: -0.5 },
  erro: { borderRadius: raio.sm, padding: espaco.md },
});
