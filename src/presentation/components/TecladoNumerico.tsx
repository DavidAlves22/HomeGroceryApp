import React, { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  apagar,
  calculoInicial,
  digitar,
  ehEscala,
  operar,
  resolver,
  SIMBOLO,
  textoDoVisor,
  textoPendente,
  valorDoCalculo,
  virgula,
  type EstadoCalculo,
  type ModoNumerico,
  type Operacao,
} from '../../domain/services/calculadora';
import { useVoltarFecha } from '../hooks/useVoltarFecha';
import { espaco, fonte, raio, usePaleta } from '../theme';

interface Props {
  modo: ModoNumerico;
  /** O nome do campo que está sendo preenchido ("Preço pago"), escrito no alto do visor. */
  titulo: string;
  /** O valor de onde o teclado parte (o campo abre com ele no visor; o primeiro dígito o troca). */
  inicial: number | null;
  /** Texto depois do número, na quantidade ("kg"). */
  sufixo?: string;
  /** "Concluído" devolve o resultado (com a conta pendente já resolvida); cancelar não devolve nada. */
  aoConcluir: (valor: number) => void;
  aoCancelar: () => void;
}

/** Um operador por fila da grade, na ordem das filas. */
const OPERADOR_DA_FILA: readonly Operacao[] = ['/', '*', '-'];

/**
 * Teclado numérico em folha, igual ao do Minhas Finanças: visor, grade 7-8-9 / 4-5-6 / 1-2-3 / ⌫-0-=, operadores
 * ÷ × − + na coluna da direita e Cancelar / Concluído. Em `dinheiro` digita-se da direita para a esquerda (5 → 0,05);
 * em `quantidade` da esquerda para a direita, com a tecla "," (a de "=" dá lugar a ela).
 *
 * Só "Concluído" atribui: o véu e o botão de voltar cancelam, como em qualquer outra folha do app.
 */
export function TecladoNumerico({ modo, titulo, inicial, sufixo, aoConcluir, aoCancelar }: Props) {
  const p = usePaleta();
  const margem = useSafeAreaInsets().bottom;
  // O teclado só existe enquanto está aberto; o voltar do navegador o cancela (e não sai da tela).
  useVoltarFecha(true, aoCancelar);
  const [calculo, setCalculo] = useState<EstadoCalculo>(() => calculoInicial(modo, inicial));
  const escala = ehEscala(calculo);

  return (
    <Modal transparent animationType="slide" onRequestClose={aoCancelar}>
      <View style={estilos.fundo}>
        <Pressable
          accessibilityLabel="Fechar o teclado"
          style={StyleSheet.absoluteFill}
          onPress={aoCancelar}
        />
        {/* O onPress vazio impede que o toque na folha chegue ao véu e cancele. A área segura soma-se ao respiro,
            porque dentro de um Modal o inset de baixo costuma chegar zerado. */}
        <Pressable
          style={[estilos.folha, { backgroundColor: p.fundo, paddingBottom: margem + espaco.xl }]}
          onPress={() => {}}
        >
          <View style={estilos.visor}>
            <View style={estilos.linhaDoTitulo}>
              <Text style={{ color: p.textoSuave, fontSize: fonte.pequena, fontWeight: '700' }}>
                {titulo}
              </Text>
              {/* A linha da conta fica montada mesmo vazia: sem ela a folha crescia ao apertar o primeiro operador. */}
              <Text
                numberOfLines={1}
                style={{ color: p.textoSuave, fontSize: fonte.corpo, flexShrink: 1 }}
              >
                {textoPendente(calculo)}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              accessibilityLabel={`Valor digitado: ${textoDoVisor(calculo)}${sufixo && !escala ? ` ${sufixo}` : ''}`}
              style={{
                color: p.texto,
                fontSize: 40,
                fontWeight: '700',
                textAlign: 'right',
                letterSpacing: -1,
              }}
            >
              {textoDoVisor(calculo)}
              {sufixo && !escala ? ` ${sufixo}` : ''}
            </Text>
          </View>

          <View style={estilos.grade}>
            {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n, i) => (
              <React.Fragment key={n}>
                <Tecla rotulo={`Tecla ${n}`} aoPressionar={() => setCalculo((c) => digitar(c, n))}>
                  {String(n)}
                </Tecla>
                {/* O operador da fila fecha a fila, depois do terceiro dígito. */}
                {i % 3 === 2 && (
                  <TeclaOperador
                    operacao={OPERADOR_DA_FILA[(i - 2) / 3]}
                    pendente={calculo.operacao}
                    aoPressionar={(op) => setCalculo((c) => operar(c, op))}
                  />
                )}
              </React.Fragment>
            ))}

            <Tecla rotulo="Apagar dígito" aoPressionar={() => setCalculo(apagar)}>
              ⌫
            </Tecla>
            <Tecla rotulo="Tecla 0" aoPressionar={() => setCalculo((c) => digitar(c, 0))}>
              0
            </Tecla>
            {modo === 'dinheiro' ? (
              <Tecla rotulo="Igual" aoPressionar={() => setCalculo(resolver)}>
                =
              </Tecla>
            ) : (
              <Tecla rotulo="Tecla vírgula" aoPressionar={() => setCalculo(virgula)}>
                ,
              </Tecla>
            )}
            <TeclaOperador
              operacao="+"
              pendente={calculo.operacao}
              aoPressionar={(op) => setCalculo((c) => operar(c, op))}
            />
          </View>

          <View style={estilos.rodape}>
            <Pressable
              accessibilityRole="button"
              onPress={aoCancelar}
              style={[estilos.botao, { borderWidth: 1, borderColor: p.linha }]}
            >
              <Text style={{ color: p.textoSuave, fontSize: fonte.corpo, fontWeight: '700' }}>
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => aoConcluir(valorDoCalculo(calculo))}
              style={[estilos.botao, { backgroundColor: p.destaque }]}
            >
              <Text
                style={{ color: p.textoSobreDestaque, fontSize: fonte.corpo, fontWeight: '700' }}
              >
                Concluído
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

function Tecla({
  children,
  rotulo,
  aoPressionar,
}: {
  children: ReactNode;
  rotulo: string;
  aoPressionar: () => void;
}) {
  const p = usePaleta();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={aoPressionar}
      style={[estilos.tecla, { backgroundColor: p.superficie, borderColor: p.linha }]}
    >
      <Text style={{ color: p.texto, fontSize: 22, fontWeight: '600' }}>{children}</Text>
    </Pressable>
  );
}

/** O operador escolhido fica aceso enquanto espera o segundo operando. */
function TeclaOperador({
  operacao,
  pendente,
  aoPressionar,
}: {
  operacao: Operacao;
  pendente: Operacao | null;
  aoPressionar: (op: Operacao) => void;
}) {
  const p = usePaleta();
  const aceso = pendente === operacao;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Operação ${SIMBOLO[operacao]}`}
      onPress={() => aoPressionar(operacao)}
      style={[
        estilos.tecla,
        {
          backgroundColor: aceso ? p.destaque : p.superficie2,
          borderColor: aceso ? p.destaque : p.superficie2,
        },
      ]}
    >
      <Text
        style={{
          color: aceso ? p.textoSobreDestaque : p.destaque,
          fontSize: 22,
          fontWeight: '700',
        }}
      >
        {SIMBOLO[operacao]}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  folha: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: espaco.lg,
    paddingTop: espaco.md,
  },
  visor: { paddingHorizontal: espaco.sm, paddingTop: espaco.xs, paddingBottom: espaco.md, gap: 2 },
  linhaDoTitulo: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco.md },
  grade: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tecla: {
    width: '23.5%',
    minHeight: 56,
    borderWidth: 1,
    borderRadius: raio.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espaco.sm,
  },
  rodape: { flexDirection: 'row', gap: espaco.md, marginTop: espaco.sm },
  botao: {
    flex: 1,
    minHeight: 52,
    borderRadius: raio.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
