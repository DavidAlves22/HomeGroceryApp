import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { espaco, fonte, raio, usePaleta } from '../theme';

/** Título de cartão do painel do administrador. */
export function TituloDoCartao({ children }: { children: React.ReactNode }) {
  const p = usePaleta();
  return (
    <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '800' }}>{children}</Text>
  );
}

/** Um número grande com a legenda embaixo. Duas por linha no celular, mais no computador. */
export function Metrica({ valor, rotulo }: { valor: string; rotulo: string }) {
  const p = usePaleta();
  return (
    <View style={[estilos.metrica, { backgroundColor: p.superficie2 }]}>
      <Text
        style={{
          color: p.texto,
          fontSize: fonte.grande,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
        }}
      >
        {valor}
      </Text>
      <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>{rotulo}</Text>
    </View>
  );
}

/** Linha de métricas que quebra conforme a largura. */
export function GradeDeMetricas({ children }: { children: React.ReactNode }) {
  return <View style={estilos.grade}>{children}</View>;
}

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  metrica: {
    flexGrow: 1,
    // Largura mínima em vez de porcentagem: 2 colunas no celular e mais delas no computador.
    flexBasis: 150,
    borderRadius: raio.sm,
    padding: espaco.md,
    gap: 2,
  },
});
