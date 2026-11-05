import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { espaco, fonte, raio, usePaleta } from '../theme';
import { Icone, type NomeDoIcone } from './Icone';

interface BotaoProps {
  titulo: string;
  aoPressionar: () => void;
  variante?: 'principal' | 'secundario' | 'texto' | 'perigo' | 'perigoTexto' | 'perigoCheio';
  /** Ícone desenhado antes do nome, na cor do texto do botão. */
  icone?: NomeDoIcone;
  carregando?: boolean;
  desabilitado?: boolean;
  estilo?: ViewStyle;
}

/** Botão de 48 px de altura (alvo de toque confortável para uma mão só). */
export function Botao({
  titulo,
  aoPressionar,
  variante = 'principal',
  icone,
  carregando,
  desabilitado,
  estilo,
}: BotaoProps) {
  const p = usePaleta();
  const principal = variante === 'principal';
  const perigoCheio = variante === 'perigoCheio';
  const comBorda = variante === 'secundario' || variante === 'perigo';
  const inativo = desabilitado || carregando;
  const corDoTexto =
    principal || perigoCheio
      ? p.textoSobreDestaque
      : variante === 'texto'
        ? p.destaque
        : variante === 'perigo' || variante === 'perigoTexto'
          ? p.alerta
          : p.texto;

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
            : perigoCheio
              ? p.alerta
              : comBorda
                ? p.superficie
                : 'transparent',
          // Secundário: borda laranja (1,5 px) para o botão branco não se perder no fundo claro.
          // Perigo: a mesma forma, em vermelho, para a ação que não volta atrás não parecer um link comum.
          borderColor:
            variante === 'secundario'
              ? p.destaque
              : variante === 'perigo'
                ? p.alerta
                : 'transparent',
          borderWidth: comBorda ? 1.5 : 1,
          opacity: inativo ? 0.6 : pressed ? 0.85 : 1,
        },
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={principal || perigoCheio ? p.textoSobreDestaque : p.destaque} />
      ) : (
        <View style={estilos.botaoConteudo}>
          {icone && <Icone nome={icone} cor={corDoTexto} tamanho={20} />}
          <Text style={[estilos.botaoTexto, { color: corDoTexto, flexShrink: 1 }]}>{titulo}</Text>
        </View>
      )}
    </Pressable>
  );
}

interface CampoProps extends TextInputProps {
  rotulo: string;
  /** Rótulo forte e borda na cor de destaque, para o campo principal de uma folha. */
  destacado?: boolean;
}

export function Campo({ rotulo, style, destacado, onFocus, onBlur, ...resto }: CampoProps) {
  const p = usePaleta();
  const [focado, setFocado] = useState(false);
  return (
    <View style={{ gap: espaco.xs }}>
      <Text
        style={[
          estilos.rotulo,
          { color: destacado ? p.texto : p.textoSuave },
          destacado && { fontSize: 14 },
        ]}
      >
        {rotulo}
      </Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={p.textoSuave}
        style={[
          estilos.campo,
          { backgroundColor: p.superficie, borderColor: p.bordaCampo, color: p.texto },
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
          // Foco desenhado na própria borda (no navegador o contorno preto padrão aparecia por cima).
          focado && { borderColor: p.destaque, borderWidth: 2 },
          destacado && { borderColor: p.destaque, borderWidth: 2 },
          style,
        ]}
        onFocus={(e) => {
          setFocado(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocado(false);
          onBlur?.(e);
        }}
        {...resto}
      />
    </View>
  );
}

export function Cartao({
  children,
  estilo,
  heroi,
}: {
  children: React.ReactNode;
  estilo?: ViewStyle;
  /** Cartão principal da tela: faixa laranja de 4 px no topo, para se destacar dos demais. */
  heroi?: boolean;
}) {
  const p = usePaleta();
  return (
    <View
      style={[
        estilos.cartao,
        { backgroundColor: p.superficie, borderColor: p.linha },
        // Cartão principal: faixa laranja de 4 px no topo (a borda laranja inteira fica para seleção e foco).
        heroi && { overflow: 'hidden' },
        estilo,
      ]}
    >
      {heroi && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            backgroundColor: p.destaque,
          }}
        />
      )}
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
    // O mesmo espaçamento lateral em todos os botões: com `flex: 1` lado a lado, padding diferente deixaria
    // um botão mais estreito que o outro (e o nome com ícone não quebraria em duas linhas).
    paddingHorizontal: espaco.md,
  },
  botaoConteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.sm,
  },
  botaoTexto: { fontSize: fonte.corpo, fontWeight: '700', textAlign: 'center' },
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
