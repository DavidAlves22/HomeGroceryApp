import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTempoReal } from '../hooks/TempoReal';
import { raio, usePaleta } from '../theme';

/**
 * Mostra se a lista está sendo atualizada ao vivo. A informação vem escrita e não só colorida:
 * "Ao vivo" quando conectado, "Reconectando..." quando a conexão caiu e voltando.
 */
export function IndicadorDeSincronizacao() {
  const p = usePaleta();
  const { estado } = useTempoReal();
  if (estado === 'desconectado') return null;

  const aoVivo = estado === 'conectado';
  const texto = aoVivo ? 'Ao vivo' : estado === 'conectando' ? 'Conectando...' : 'Reconectando...';

  return (
    <View
      accessibilityLabel={`Sincronização: ${texto}`}
      accessibilityLiveRegion="polite"
      style={[estilos.pilula, { backgroundColor: aoVivo ? p.destaqueSuave : p.superficie2 }]}
    >
      <View style={[estilos.ponto, { backgroundColor: aoVivo ? p.destaque : p.textoSuave }]} />
      <Text style={{ color: aoVivo ? p.destaque : p.textoSuave, fontSize: 12, fontWeight: '700' }}>
        {texto}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pilula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: raio.pilula,
  },
  ponto: { width: 8, height: 8, borderRadius: 4 },
});
