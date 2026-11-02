import {
  AdicionarItemAoModelo,
  BuscarProdutos,
  CriarCategoria,
  EditarItemDoModelo,
  ExcluirCategoria,
  ListarCategorias,
  ListarItensDoModelo,
  RemoverItemDoModelo,
  RenomearCategoria,
  ReordenarCategorias,
  ReordenarItensDoModelo,
} from '../application/useCases/catalogo';
import {
  AdicionarItemNaLista,
  CriarLista,
  EditarItemDaLista,
  FinalizarLista,
  ListarListas,
  MarcarItemComprado,
  ObterLista,
  ObterListaAtual,
  ReabrirLista,
  RemoverItemDaLista,
} from '../application/useCases/listas';
import {
  CadastrarUsuario,
  EntrarNaConta,
  RestaurarSessao,
  SairDaConta,
  VerificarServidor,
} from '../application/useCases/autenticacao';
import { ObterAnaliseDeGastos, ObterAnaliseDePrecos } from '../application/useCases/analises';
import {
  AnalisesApiGateway,
  CatalogoApiGateway,
  ListasApiGateway,
} from '../infrastructure/gateways/catalogoGateways';
import { AutenticacaoApiGateway, ServidorApiGateway } from '../infrastructure/gateways/gateways';
import { ClienteHttp } from '../infrastructure/http/ClienteHttp';
import { ArmazenamentoDeSessaoLocal } from '../infrastructure/sessao/ArmazenamentoDeSessaoLocal';

export const URL_DA_API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5272';

/**
 * Composition root: o único lugar do app que conhece as implementações concretas.
 * A apresentação recebe só os casos de uso prontos.
 */
export function criarContainer(aoExpirarSessao: () => void) {
  const armazenamento = new ArmazenamentoDeSessaoLocal();
  const http = new ClienteHttp(URL_DA_API, armazenamento, aoExpirarSessao);

  const autenticacao = new AutenticacaoApiGateway(http);
  const servidor = new ServidorApiGateway(http);
  const catalogo = new CatalogoApiGateway(http);
  const listas = new ListasApiGateway(http);
  const analises = new AnalisesApiGateway(http);

  return {
    // Conta e sessão
    cadastrarUsuario: new CadastrarUsuario(autenticacao, armazenamento),
    entrarNaConta: new EntrarNaConta(autenticacao, armazenamento),
    restaurarSessao: new RestaurarSessao(autenticacao, armazenamento),
    sairDaConta: new SairDaConta(armazenamento),
    verificarServidor: new VerificarServidor(servidor),

    // Categorias, produtos e lista padrão
    listarCategorias: new ListarCategorias(catalogo),
    criarCategoria: new CriarCategoria(catalogo),
    renomearCategoria: new RenomearCategoria(catalogo),
    excluirCategoria: new ExcluirCategoria(catalogo),
    reordenarCategorias: new ReordenarCategorias(catalogo),
    buscarProdutos: new BuscarProdutos(catalogo),
    listarItensDoModelo: new ListarItensDoModelo(catalogo),
    adicionarItemAoModelo: new AdicionarItemAoModelo(catalogo),
    editarItemDoModelo: new EditarItemDoModelo(catalogo),
    removerItemDoModelo: new RemoverItemDoModelo(catalogo),
    reordenarItensDoModelo: new ReordenarItensDoModelo(catalogo),

    // Listas mensais
    listarListas: new ListarListas(listas),
    obterLista: new ObterLista(listas),
    obterListaAtual: new ObterListaAtual(listas),
    criarLista: new CriarLista(listas),
    adicionarItemNaLista: new AdicionarItemNaLista(listas),
    editarItemDaLista: new EditarItemDaLista(listas),
    removerItemDaLista: new RemoverItemDaLista(listas),
    marcarItemComprado: new MarcarItemComprado(listas),
    finalizarLista: new FinalizarLista(listas),
    reabrirLista: new ReabrirLista(listas),

    // Análises
    obterAnaliseDeGastos: new ObterAnaliseDeGastos(analises),
    obterAnaliseDePrecos: new ObterAnaliseDePrecos(analises),
  };
}

export type Container = ReturnType<typeof criarContainer>;
