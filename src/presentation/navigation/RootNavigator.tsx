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
import { AnalisesScreen } from '../screens/AnalisesScreen';
import { CategoriasScreen } from '../screens/CategoriasScreen';
import { HistoricoScreen } from '../screens/HistoricoScreen';
import { InicioScreen } from '../screens/InicioScreen';
import { DetalheDaListaScreen, ListaScreen } from '../screens/ListaScreen';
import { ListaPadraoScreen } from '../screens/ListaPadraoScreen';
import { MaisScreen } from '../screens/MaisScreen';
import { MapaDoMercadoScreen } from '../screens/MapaDoMercadoScreen';
import { MercadosScreen } from '../screens/MercadosScreen';
import { RotaScreen } from '../screens/RotaScreen';
import { GrupoScreen } from '../screens/GrupoScreen';
import { ProdutosScreen } from '../screens/ProdutosScreen';
import { NovaListaScreen } from '../screens/NovaListaScreen';
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
            Categorias: 'categorias',
            Produtos: 'produtos',
            Grupo: 'grupo',
            Mercados: 'mercados',
            MapaDoMercado: 'mercados/:mercadoId/mapa',
            Rota: 'rota',
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
  return (
    <Abas.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: p.destaque,
        tabBarInactiveTintColor: p.textoSuave,
        tabBarStyle: {
          backgroundColor: p.superficie,
          borderTopColor: p.linha,
          height: 76,
          paddingBottom: 14,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
        <Pilha.Screen name="Categorias" component={CategoriasScreen} />
        <Pilha.Screen name="Produtos" component={ProdutosScreen} />
        <Pilha.Screen name="Grupo" component={GrupoScreen} />
        <Pilha.Screen name="Mercados" component={MercadosScreen} />
        <Pilha.Screen name="MapaDoMercado" component={MapaDoMercadoScreen} />
        <Pilha.Screen name="Rota" component={RotaScreen} />
      </Pilha.Navigator>
    </NavigationContainer>
  );
}
