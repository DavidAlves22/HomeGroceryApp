import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Dinheiro } from '../../domain/valueObjects/Dinheiro';
import { espaco, fonte, raio, usePaleta } from '../theme';

interface Props {
  estimado: Dinheiro;
  realizado: Dinheiro;
  /** Compras sem preço pago informado (o gasto real pode ser maior que o mostrado). */
  compradosSemPreco?: number;
}

function Caixa({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  const p = usePaleta();
  return (
    <View style={[estilos.caixa, { backgroundColor: p.fundo }]}>
      <Text style={[estilos.rotulo, { color: p.textoSuave }]}>{rotulo}</Text>
      <Text
        style={{
          color: destaque ? p.alerta : p.texto,
          fontSize: fonte.titulo,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {valor}
      </Text>
    </View>
  );
}

/**
 * Estimado, gasto e restante. Estimado e gasto são separados de propósito: o estimado é só uma
 * referência e nunca vira gasto sozinho. Passar da estimativa aparece em vermelho com o rótulo
 * "Acima do estimado" (a cor não é a única pista).
 */
export function ResumoFinanceiro({ estimado, realizado, compradosSemPreco = 0 }: Props) {
  const p = usePaleta();
  const restante = estimado.menos(realizado);
  const acima = restante.centavos < 0;

  return (
    <View style={{ gap: espaco.sm }}>
      <View style={estilos.linha}>
        <Caixa rotulo="Estimado" valor={estimado.formatar()} />
        <Caixa rotulo="Gasto" valor={realizado.formatar()} />
        <Caixa
          rotulo={acima ? 'Acima do estimado' : 'Restante'}
          valor={(acima ? restante.vezes(-1) : restante).formatar()}
          destaque={acima}
        />
      </View>
      {compradosSemPreco > 0 && (
        <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
          {compradosSemPreco} {compradosSemPreco === 1 ? 'item comprado' : 'itens comprados'} sem
          preço pago: o gasto real pode ser maior.
        </Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', gap: espaco.sm },
  caixa: { flex: 1, borderRadius: raio.sm + 2, padding: espaco.md, gap: 2 },
  rotulo: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
});
