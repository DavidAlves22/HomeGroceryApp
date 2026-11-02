import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { criarContainer } from './src/di/container';
import {
  ContainerProvider,
  SessaoProvider,
  useContainer,
  useSaudeDoServidor,
  useSessao,
} from './src/presentation/hooks/AppProviders';
import { AutenticacaoScreen } from './src/presentation/screens/AutenticacaoScreen';
import { ConexaoScreen } from './src/presentation/screens/ConexaoScreen';
import { ToastProvider } from './src/presentation/hooks/Toast';
import { NavegacaoApp } from './src/presentation/navigation/RootNavigator';
import { usePaleta } from './src/presentation/theme';

/**
 * Ordem de abertura: 1) servidor responde? 2) há sessão válida? 3) mostra o app ou o login.
 * Cada etapa só começa quando a anterior passou.
 */
function Raiz() {
  const p = usePaleta();
  const { verificarServidor, restaurarSessao } = useContainer();
  const { sessao, definirSessao } = useSessao();
  // useCallback: o hook refaz o health check sempre que a função muda, então ela precisa ser estável.
  const verificar = useCallback(
    (sinal?: AbortSignal) => verificarServidor.executar(sinal),
    [verificarServidor],
  );
  const { estado, tentarAgora } = useSaudeDoServidor(verificar);
  const [restaurando, setRestaurando] = useState(true);

  useEffect(() => {
    if (estado !== 'online') return;
    let ativo = true;
    restaurarSessao
      .executar()
      .then((s) => ativo && definirSessao(s))
      .catch(() => ativo && definirSessao(null))
      .finally(() => ativo && setRestaurando(false));
    return () => {
      ativo = false;
    };
  }, [estado, restaurarSessao, definirSessao]);

  if (estado !== 'online') return <ConexaoScreen estado={estado} aoTentarNovamente={tentarAgora} />;

  if (restaurando) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: p.fundo,
        }}
      >
        <ActivityIndicator size="large" color={p.destaque} />
      </View>
    );
  }

  return sessao ? <NavegacaoApp /> : <AutenticacaoScreen />;
}

export default function App() {
  // Quando a API recusa a sessão de vez, o cliente HTTP avisa e o app volta ao login.
  const [sessaoExpirou, setSessaoExpirou] = useState(0);
  const container = useMemo(() => criarContainer(() => setSessaoExpirou((n) => n + 1)), []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <ContainerProvider container={container}>
        <SessaoProvider key={sessaoExpirou}>
          <ToastProvider>
            <Raiz />
          </ToastProvider>
        </SessaoProvider>
      </ContainerProvider>
    </SafeAreaProvider>
  );
}
