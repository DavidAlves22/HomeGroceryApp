import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Botao, TextoSuave, Titulo } from '../components/base';
import type { EstadoDoServidor } from '../hooks/AppProviders';
import { espaco, usePaleta } from '../theme';

interface Props {
  estado: EstadoDoServidor;
  aoTentarNovamente: () => void;
}

/**
 * Tela bloqueante mostrada enquanto o servidor não responde. O app é online-only: sem servidor
 * não existe lista confiável para mostrar, então não deixamos o usuário "continuar" às cegas.
 */
export function ConexaoScreen({ estado, aoTentarNovamente }: Props) {
  const p = usePaleta();
  const offline = estado === 'offline';

  return (
    <View style={[estilos.tela, { backgroundColor: p.fundo }]}>
      {!offline && <ActivityIndicator size="large" color={p.destaque} />}
      <Titulo>
        {offline
          ? 'Sem conexão com o servidor'
          : estado === 'acordando'
            ? 'Acordando o servidor...'
            : 'Conectando...'}
      </Titulo>
      <TextoSuave estilo={{ textAlign: 'center', maxWidth: 320 }}>
        {offline
          ? 'O Home Grocery precisa de internet para manter a lista igual para todos da família. Conecte-se e tente novamente.'
          : estado === 'acordando'
            ? 'O servidor estava descansando e pode levar até 1 minuto para responder na primeira vez.'
            : 'Verificando o servidor.'}
      </TextoSuave>
      {offline && (
        <>
          <Botao
            titulo="Tentar novamente"
            aoPressionar={aoTentarNovamente}
            estilo={{ alignSelf: 'stretch', maxWidth: 320 }}
          />
          <TextoSuave estilo={{ fontSize: 12 }}>
            Tentando de novo automaticamente a cada 5 segundos.
          </TextoSuave>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.lg,
    padding: espaco.xxl,
  },
});
