import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ModoNumerico } from '../../domain/services/calculadora';
import { formatarQuantidade } from '../../domain/services/organizacao';
import { Dinheiro } from '../../domain/valueObjects/Dinheiro';
import { espaco, fonte, raio, usePaleta } from '../theme';
import { TecladoNumerico } from './TecladoNumerico';

interface Props {
  rotulo: string;
  modo: ModoNumerico;
  /** O valor em reais (dinheiro) ou na unidade da quantidade. Nulo = campo vazio. */
  valor: number | null;
  aoMudar: (valor: number | null) => void;
  /** O que aparece com o campo vazio (em dinheiro, "R$ 0,00"). */
  placeholder?: string;
  /** Texto depois da quantidade ("kg"). */
  sufixo?: string;
  /** Zero conta como "vazio" (preços e quantidade comprada são opcionais); a quantidade planejada guarda o zero. */
  zeroVazio?: boolean;
}

/**
 * Campo que mostra o número e abre o teclado numérico do app ao toque, no lugar do teclado do sistema: a mesma
 * digitação em todo campo de valor (preço da direita para a esquerda, quantidade com vírgula) e a calculadora à mão.
 */
export function CampoNumerico({
  rotulo,
  modo,
  valor,
  aoMudar,
  placeholder,
  sufixo,
  zeroVazio = false,
}: Props) {
  const p = usePaleta();
  const [digitando, setDigitando] = useState(false);

  const vazio = valor === null;
  const texto = vazio
    ? (placeholder ?? (modo === 'dinheiro' ? Dinheiro.deReais(0).formatar() : '0'))
    : modo === 'dinheiro'
      ? Dinheiro.deReais(valor).formatar()
      : `${formatarQuantidade(valor)}${sufixo ? ` ${sufixo}` : ''}`;

  return (
    <View style={{ gap: espaco.xs }}>
      <Text style={[estilos.rotulo, { color: p.textoSuave }]}>{rotulo}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${rotulo}, ${vazio ? 'vazio' : texto}`}
        onPress={() => setDigitando(true)}
        style={[estilos.caixa, { backgroundColor: p.superficie, borderColor: p.bordaCampo }]}
      >
        <Text
          numberOfLines={1}
          style={{ color: vazio ? p.textoSuave : p.texto, fontSize: fonte.corpo }}
        >
          {texto}
        </Text>
      </Pressable>
      {digitando && (
        <TecladoNumerico
          modo={modo}
          titulo={rotulo}
          inicial={valor}
          sufixo={sufixo}
          aoConcluir={(novo) => {
            // Evita resto de ponto flutuante (0.1 + 0.2): preço tem 2 casas, quantidade 3.
            const exato =
              Math.round(novo * (modo === 'dinheiro' ? 100 : 1000)) /
              (modo === 'dinheiro' ? 100 : 1000);
            aoMudar(zeroVazio && exato === 0 ? null : exato);
            setDigitando(false);
          }}
          aoCancelar={() => setDigitando(false)}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  rotulo: { fontSize: fonte.pequena, fontWeight: '700' },
  caixa: {
    minHeight: 48,
    borderRadius: raio.sm,
    borderWidth: 1,
    paddingHorizontal: espaco.md,
    justifyContent: 'center',
  },
});
