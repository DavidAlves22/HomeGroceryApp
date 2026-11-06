import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { InformacaoDeContato } from '../../domain/entities/contato';
import { useToast } from '../hooks/Toast';
import { espaco, fonte, usePaleta } from '../theme';
import { Icone } from './Icone';

/**
 * Copia para a área de transferência. A API moderna exige permissão e contexto seguro; se ela recusar, o plano B é o
 * comando antigo sobre um campo escondido (funciona dentro de um toque em qualquer navegador).
 */
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const campo = document.createElement('textarea');
      campo.value = texto;
      campo.setAttribute('readonly', '');
      campo.style.position = 'fixed';
      campo.style.opacity = '0';
      document.body.appendChild(campo);
      campo.select();
      const copiou = document.execCommand('copy');
      document.body.removeChild(campo);
      return copiou;
    } catch {
      return false;
    }
  }
}

/**
 * Uma informação do card de contato como o usuário a vê: título (com o ícone de copiar à direita), descrição (só se
 * existir) e o valor, que dá para selecionar. Os nomes dos campos ("título", "descrição", "valor") nunca aparecem.
 * `acoes` abre espaço para os botões do administrador (editar).
 */
export function LinhaDeInformacao({
  informacao,
  acoes,
}: {
  informacao: InformacaoDeContato;
  acoes?: React.ReactNode;
}) {
  const p = usePaleta();
  const toast = useToast();

  async function copiar() {
    if (await copiarTexto(informacao.valor)) toast('Copiado para a área de transferência');
    else toast('Não foi possível copiar. Selecione o texto e copie.');
  }

  return (
    <View style={[estilos.linha, { borderBottomColor: p.linha }]}>
      <View style={estilos.titulo}>
        <Text style={{ flex: 1, color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}>
          {informacao.titulo}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Copiar ${informacao.titulo}`}
          hitSlop={8}
          onPress={() => void copiar()}
          style={estilos.copiar}
        >
          <Icone nome="copiar" cor={p.destaque} tamanho={20} />
        </Pressable>
      </View>
      {!!informacao.descricao && (
        <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>{informacao.descricao}</Text>
      )}
      <Text
        selectable
        style={{ color: p.texto, fontSize: fonte.corpo, fontWeight: '600', paddingVertical: 2 }}
      >
        {informacao.valor}
      </Text>
      {acoes && <View style={estilos.acoes}>{acoes}</View>}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { gap: 2, paddingVertical: espaco.md, borderBottomWidth: 1 },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  copiar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, paddingTop: espaco.xs },
});
