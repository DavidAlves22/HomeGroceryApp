import React from 'react';
import { Text, View } from 'react-native';
import type { MercadoResumo } from '../../domain/entities/mercados';
import type { ItemDaLista } from '../../domain/entities/tipos';
import { dividirCompra } from '../../domain/services/compraDividida';
import { espaco, fonte, raio, usePaleta } from '../theme';

const INTENSIDADES = [100, 62, 38, 80, 50];

/** A compra do mês pode passar por vários mercados: a barra mostra quanto foi comprado em cada um e quanto falta. */
export function DivisaoDaCompra({
  itens,
  mercados,
}: {
  itens: ItemDaLista[];
  mercados: MercadoResumo[];
}) {
  const p = usePaleta();
  const { fatias, faltam } = dividirCompra(itens, mercados);
  // Mesma cor de destaque em intensidades diferentes (sem cores novas nem recursos só da web).
  const cor = (i: number) => ({
    backgroundColor: p.destaque,
    opacity: INTENSIDADES[i % INTENSIDADES.length] / 100,
  });

  return (
    <View style={{ gap: espaco.sm }}>
      <View
        accessibilityRole="image"
        accessibilityLabel="Divisão da compra por mercado"
        style={{ flexDirection: 'row', gap: 3, height: 12 }}
      >
        {fatias.map((f, i) => (
          <View
            key={f.nome}
            style={[{ flex: f.quantidade, minWidth: 8, borderRadius: raio.pilula }, cor(i)]}
          />
        ))}
        {faltam > 0 && (
          <View
            style={{
              flex: faltam,
              minWidth: 8,
              borderRadius: raio.pilula,
              backgroundColor: p.superficie2,
            }}
          />
        )}
      </View>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, columnGap: espaco.lg }}
      >
        {fatias.map((f, i) => (
          <View key={f.nome} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[{ width: 10, height: 10, borderRadius: 5 }, cor(i)]} />
            <Text
              style={{ color: p.texto, fontSize: fonte.pequena, fontVariant: ['tabular-nums'] }}
            >
              {f.nome} <Text style={{ fontWeight: '800' }}>{f.quantidade}</Text>
            </Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: p.superficie2,
              borderWidth: 1,
              borderColor: p.linha,
            }}
          />
          <Text style={{ color: p.texto, fontSize: fonte.pequena, fontVariant: ['tabular-nums'] }}>
            Falta <Text style={{ fontWeight: '800' }}>{faltam}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}
