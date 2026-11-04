import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  useNavigation,
  type CompositeNavigationProp,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Abas: NavigatorScreenParams<AbasParamList> | undefined;
  NovaLista: undefined;
  ListaPadrao: undefined;
  DetalheDaLista: { listaId: string };
  ImportarNota: { listaId: string };
  Categorias: undefined;
  Produtos: undefined;
  Grupo: undefined;
  Mercados: undefined;
  MapaDoMercado: { mercadoId: string };
  Rota: undefined;
};

export type AbasParamList = {
  Inicio: undefined;
  Lista: undefined;
  Historico: undefined;
  Analises: undefined;
  Mais: undefined;
};

export type Navegacao = CompositeNavigationProp<
  BottomTabNavigationProp<AbasParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function useNavegacao() {
  return useNavigation<Navegacao>();
}
