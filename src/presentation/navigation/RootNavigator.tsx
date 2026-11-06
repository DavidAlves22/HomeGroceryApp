import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform } from 'react-native';
import { Icone, type NomeDoIcone } from '../components/Icone';
import { AdminScreen } from '../screens/AdminScreen';
import { ContatoScreen } from '../screens/ContatoScreen';
import { MensagensDoPainelScreen } from '../screens/MensagensDoPainelScreen';
import { AnalisesScreen } from '../screens/AnalisesScreen';
import { CategoriasScreen } from '../screens/CategoriasScreen';
import { HistoricoScreen } from '../screens/HistoricoScreen';
import { InicioScreen } from '../screens/InicioScreen';
import { ImportarNotaScreen } from '../screens/ImportarNotaScreen';
import { DetalheDaListaScreen, ListaScreen } from '../screens/ListaScreen';
import { ListaPadraoScreen } from '../screens/ListaPadraoScreen';
import { MaisScreen } from '../screens/MaisScreen';
import { CatalogoDeMapasScreen } from '../screens/CatalogoDeMapasScreen';
import { MapaDoMercadoScreen } from '../screens/MapaDoMercadoScreen';
import { MercadosScreen } from '../screens/MercadosScreen';
import { RotaScreen } from '../screens/RotaScreen';
import { GrupoScreen } from '../screens/GrupoScreen';
import { ProdutosScreen } from '../screens/ProdutosScreen';
import { NovaListaScreen } from '../screens/NovaListaScreen';
import { useLayoutLargo } from '../hooks/useLayoutLargo';
import { usePaleta } from '../theme';
import type { AbasParamList, RootStackParamList } from './tipos';

const Pilha = createNativeStackNavigator<RootStackParamList>();
const Abas = createBottomTabNavigator<AbasParamList>();

/**
 * No navegador (PWA) cada tela tem um endereço e entra no histórico, então o botão voltar do celular (e do
 * navegador) retrocede para a tela anterior em vez de fechar o app. No app nativo o voltar já funciona sem isto.
 */
const LINKING: LinkingOptions<RootStackParamList> | undefined =
  Platform.OS === 'web'
    ? {
        prefixes: [],
        config: {
          // Ao abrir ou recarregar numa tela de fora das abas (ex.: /grupo depois de entrar numa família), as abas
          // ficam por baixo: a seta de voltar e a barra de navegação continuam funcionando.
          initialRouteName: 'Abas',
          screens: {
            Abas: {
              path: '',
              screens: {
                Inicio: '',
                Lista: 'lista',
                Historico: 'historico',
                Analises: 'analises',
                Mais: 'mais',
              },
            },
            NovaLista: 'nova-lista',
            ListaPadrao: 'lista-padrao',
            DetalheDaLista: 'lista/:listaId',
            ImportarNota: 'importar-nota/:listaId',
            Categorias: 'categorias',
            Produtos: 'produtos',
            Grupo: 'grupo',
            Mercados: 'mercados',
            CatalogoDeMapas: 'mercados/catalogo',
            MapaDoMercado: 'mercados/:mercadoId/mapa',
            Rota: 'rota',
            Admin: 'admin',
            AdminMensagens: 'admin/mensagens',
            Contato: 'contato',
          },
        },
      }
    : undefined;

const ICONES: Record<keyof AbasParamList, NomeDoIcone> = {
  Inicio: 'inicio',
  Lista: 'lista',
  Historico: 'historico',
  Analises: 'grafico',
  Mais: 'mais',
};

function NavegacaoPorAbas() {
  const p = usePaleta();
  // No computador o menu vira uma coluna na lateral; no celular continua embaixo.
  const largo = useLayoutLargo();
  return (
    <Abas.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarPosition: largo ? 'left' : 'bottom',
        tabBarVariant: largo ? 'material' : 'uikit',
        tabBarActiveTintColor: p.destaque,
        tabBarInactiveTintColor: p.textoSuave,
        tabBarStyle: largo
          ? {
              backgroundColor: p.superficie,
              borderRightColor: p.linha,
              paddingTop: 12,
              width: 220,
              minWidth: 220,
            }
          : {
              backgroundColor: p.superficie,
              borderTopColor: p.linha,
              height: 76,
              paddingBottom: 14,
              paddingTop: 8,
            },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color }) => <Icone nome={ICONES[route.name]} cor={color} />,
      })}
    >
      <Abas.Screen name="Inicio" component={InicioScreen} options={{ title: 'Início' }} />
      <Abas.Screen name="Lista" component={ListaScreen} options={{ title: 'Lista' }} />
      <Abas.Screen name="Historico" component={HistoricoScreen} options={{ title: 'Histórico' }} />
      <Abas.Screen name="Analises" component={AnalisesScreen} options={{ title: 'Análises' }} />
      <Abas.Screen name="Mais" component={MaisScreen} options={{ title: 'Mais' }} />
    </Abas.Navigator>
  );
}

/** Navegação do app logado: abas principais + telas que abrem por cima (nova lista, lista padrão, detalhes). */
export function NavegacaoApp() {
  const p = usePaleta();
  const base = p.fundo === '#17110D' ? DarkTheme : DefaultTheme;
  const tema = {
    ...base,
    colors: {
      ...base.colors,
      background: p.fundo,
      card: p.superficie,
      text: p.texto,
      border: p.linha,
      primary: p.destaque,
    },
  };

  return (
    <NavigationContainer theme={tema} linking={LINKING} documentTitle={{ enabled: false }}>
      <Pilha.Navigator screenOptions={{ headerShown: false }}>
        <Pilha.Screen name="Abas" component={NavegacaoPorAbas} />
        <Pilha.Screen name="NovaLista" component={NovaListaScreen} />
        <Pilha.Screen name="ListaPadrao" component={ListaPadraoScreen} />
        <Pilha.Screen name="DetalheDaLista" component={DetalheDaListaScreen} />
        <Pilha.Screen name="ImportarNota" component={ImportarNotaScreen} />
        <Pilha.Screen name="Categorias" component={CategoriasScreen} />
        <Pilha.Screen name="Produtos" component={ProdutosScreen} />
        <Pilha.Screen name="Grupo" component={GrupoScreen} />
        <Pilha.Screen name="Mercados" component={MercadosScreen} />
        <Pilha.Screen name="CatalogoDeMapas" component={CatalogoDeMapasScreen} />
        <Pilha.Screen name="MapaDoMercado" component={MapaDoMercadoScreen} />
        <Pilha.Screen name="Rota" component={RotaScreen} />
        <Pilha.Screen name="Admin" component={AdminScreen} />
        <Pilha.Screen name="AdminMensagens" component={MensagensDoPainelScreen} />
        <Pilha.Screen name="Contato" component={ContatoScreen} />
      </Pilha.Navigator>
    </NavigationContainer>
  );
}
