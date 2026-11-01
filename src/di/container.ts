import {
  CadastrarUsuario,
  EntrarNaConta,
  RestaurarSessao,
  SairDaConta,
  VerificarServidor,
} from '../application/useCases/autenticacao';
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

  return {
    cadastrarUsuario: new CadastrarUsuario(autenticacao, armazenamento),
    entrarNaConta: new EntrarNaConta(autenticacao, armazenamento),
    restaurarSessao: new RestaurarSessao(autenticacao, armazenamento),
    sairDaConta: new SairDaConta(armazenamento),
    verificarServidor: new VerificarServidor(servidor),
  };
}

export type Container = ReturnType<typeof criarContainer>;
