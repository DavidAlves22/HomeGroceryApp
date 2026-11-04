import {
  AdicionarItemAoModelo,
  BuscarProdutos,
  CriarCategoria,
  EditarItemDoModelo,
  ExcluirCategoria,
  AlternarFavoritoDoProduto,
  ExcluirProduto,
  ListarCategorias,
  ListarProdutos,
  ObterSugestoesDeProdutos,
  RenomearProduto,
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
  CancelarLista,
  ConsultarNotaImportada,
  DividirCompra,
  ImportarNota,
  ObterVinculosDaNota,
  FinalizarLista,
  ListarListas,
  MarcarItemComprado,
  ObterLista,
  ObterListaAtual,
  ReabrirLista,
  RemoverItemDaLista,
  ReordenarItensDaLista,
} from '../application/useCases/listas';
import {
  CadastrarUsuario,
  EntrarNaConta,
  RestaurarSessao,
  SairDaConta,
  VerificarServidor,
  AlterarNomeDoUsuario,
  ConsultarLoginComGoogle,
  EntrarComGoogle,
  ConsultarRecuperacaoDeSenha,
  PedirCodigoDeRecuperacao,
  RedefinirSenha,
} from '../application/useCases/autenticacao';
import { ObterAnaliseDeGastos, ObterAnaliseDePrecos } from '../application/useCases/analises';
import {
  CriarMercado,
  ExcluirMercado,
  CompartilharMercado,
  CopiarMapaCompartilhado,
  ListarMapasCompartilhados,
  ListarMercados,
  ObterMapaCompartilhado,
  DefinirLocalDoItem,
  MarcarItemSemNoMercado,
  ObterMercado,
  PlanejarRota,
  SalvarMapaDoMercado,
} from '../application/useCases/mercados';
import {
  DesligarAvisos,
  LigarAvisos,
  ObterEstadoDosAvisos,
} from '../application/useCases/notificacoes';
import {
  MapasCompartilhadosApiGateway,
  MercadosApiGateway,
  RotasApiGateway,
} from '../infrastructure/gateways/mercadosGateways';
import {
  CriarConvite,
  EntrarEmGrupo,
  ObterGrupo,
  RemoverMembroDoGrupo,
  RenomearGrupo,
  SairDoGrupo,
} from '../application/useCases/grupo';
import {
  AnalisesApiGateway,
  CatalogoApiGateway,
  ListasApiGateway,
} from '../infrastructure/gateways/catalogoGateways';
import { AutenticacaoApiGateway, ServidorApiGateway } from '../infrastructure/gateways/gateways';
import { GrupoApiGateway } from '../infrastructure/gateways/grupoGateway';
import { NotificacoesApiGateway } from '../infrastructure/gateways/notificacoesGateway';
import { LeitorDeQrDoNavegador } from '../infrastructure/camera/LeitorDeQrDoNavegador';
import { BotaoDeLoginGoogleDoNavegador } from '../infrastructure/google/BotaoDeLoginGoogleDoNavegador';
import { AvisosDoNavegador } from '../infrastructure/push/AvisosDoNavegador';
import { ClienteHttp } from '../infrastructure/http/ClienteHttp';
import { TempoRealSignalR } from '../infrastructure/tempoReal/TempoRealSignalR';
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
  const grupo = new GrupoApiGateway(http);
  const mercados = new MercadosApiGateway(http);
  const mapasCompartilhados = new MapasCompartilhadosApiGateway(http);
  const rotas = new RotasApiGateway(http);
  const notificacoes = new NotificacoesApiGateway(http);
  const avisosDoDispositivo = new AvisosDoNavegador();

  return {
    // Conta e sessão
    cadastrarUsuario: new CadastrarUsuario(autenticacao, armazenamento),
    entrarNaConta: new EntrarNaConta(autenticacao, armazenamento),
    consultarRecuperacaoDeSenha: new ConsultarRecuperacaoDeSenha(autenticacao),
    pedirCodigoDeRecuperacao: new PedirCodigoDeRecuperacao(autenticacao),
    redefinirSenha: new RedefinirSenha(autenticacao),
    consultarLoginComGoogle: new ConsultarLoginComGoogle(autenticacao),
    entrarComGoogle: new EntrarComGoogle(autenticacao, armazenamento),
    botaoDeLoginGoogle: new BotaoDeLoginGoogleDoNavegador(),
    alterarNomeDoUsuario: new AlterarNomeDoUsuario(autenticacao, armazenamento),
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
    listarProdutos: new ListarProdutos(catalogo),
    obterSugestoesDeProdutos: new ObterSugestoesDeProdutos(catalogo),
    alternarFavoritoDoProduto: new AlternarFavoritoDoProduto(catalogo),
    renomearProduto: new RenomearProduto(catalogo),
    excluirProduto: new ExcluirProduto(catalogo),
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
    reordenarItensDaLista: new ReordenarItensDaLista(listas),
    marcarItemComprado: new MarcarItemComprado(listas),
    finalizarLista: new FinalizarLista(listas),
    cancelarLista: new CancelarLista(listas),
    dividirCompra: new DividirCompra(listas),
    importarNota: new ImportarNota(listas),
    obterVinculosDaNota: new ObterVinculosDaNota(listas),
    consultarNotaImportada: new ConsultarNotaImportada(listas),
    // Câmera para ler o QR da nota (só no navegador).
    leitorDeQr: new LeitorDeQrDoNavegador(),
    reabrirLista: new ReabrirLista(listas),

    // Mercados, mapas e rota
    listarMercados: new ListarMercados(mercados),
    obterMercado: new ObterMercado(mercados),
    criarMercado: new CriarMercado(mercados),
    compartilharMercado: new CompartilharMercado(mercados),
    listarMapasCompartilhados: new ListarMapasCompartilhados(mapasCompartilhados),
    obterMapaCompartilhado: new ObterMapaCompartilhado(mapasCompartilhados),
    copiarMapaCompartilhado: new CopiarMapaCompartilhado(mapasCompartilhados),
    salvarMapaDoMercado: new SalvarMapaDoMercado(mercados),
    excluirMercado: new ExcluirMercado(mercados),
    planejarRota: new PlanejarRota(rotas),
    marcarItemSemNoMercado: new MarcarItemSemNoMercado(rotas),
    definirLocalDoItem: new DefinirLocalDoItem(rotas),

    // Avisos no celular (Web Push)
    obterEstadoDosAvisos: new ObterEstadoDosAvisos(avisosDoDispositivo, notificacoes),
    ligarAvisos: new LigarAvisos(avisosDoDispositivo, notificacoes),
    desligarAvisos: new DesligarAvisos(avisosDoDispositivo, notificacoes),

    // Grupo familiar e tempo real
    obterGrupo: new ObterGrupo(grupo),
    renomearGrupo: new RenomearGrupo(grupo),
    criarConvite: new CriarConvite(grupo),
    entrarEmGrupo: new EntrarEmGrupo(grupo, armazenamento),
    sairDoGrupo: new SairDoGrupo(grupo, armazenamento),
    removerMembroDoGrupo: new RemoverMembroDoGrupo(grupo),
    tempoReal: new TempoRealSignalR(URL_DA_API, () => http.obterTokenDeAcesso()),

    // Análises
    obterAnaliseDeGastos: new ObterAnaliseDeGastos(analises),
    obterAnaliseDePrecos: new ObterAnaliseDePrecos(analises),
  };
}

export type Container = ReturnType<typeof criarContainer>;
