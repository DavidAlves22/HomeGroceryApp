import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Abas: undefined;
  NovaLista: undefined;
  ListaPadrao: undefined;
  DetalheDaLista: { listaId: string };
  Categorias: undefined;
  Produtos: undefined;
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
