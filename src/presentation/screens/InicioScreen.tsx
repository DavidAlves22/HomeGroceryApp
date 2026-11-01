import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Botao, Cartao, TextoSuave, Titulo } from '../components/base';
import { useContainer, useSessao } from '../hooks/AppProviders';
import { espaco, usePaleta } from '../theme';

/**
 * Casca da Fase 0: prova que login, sessão e grupo funcionam de ponta a ponta.
 * As abas e o conteúdo real (lista do mês, histórico etc.) entram na Fase 1.
 */
export function InicioScreen() {
  const p = usePaleta();
  const { sairDaConta } = useContainer();
  const { sessao, definirSessao } = useSessao();

  return (
    <View style={[estilos.tela, { backgroundColor: p.fundo }]}>
      <Titulo>Olá, {sessao?.usuario.nome}</Titulo>
      <Cartao>
        <TextoSuave>
          Sua conta está pronta e conectada ao servidor. Em breve você verá aqui a lista do mês.
        </TextoSuave>
      </Cartao>
      <Botao
        variante="secundario"
        titulo="Sair"
        aoPressionar={async () => {
          await sairDaConta.executar();
          definirSessao(null);
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    gap: espaco.lg,
    padding: espaco.xl,
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
});
