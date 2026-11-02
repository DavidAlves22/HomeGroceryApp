import type { Convite, Grupo } from '../../domain/entities/grupo';
import type { Sessao } from '../dtos/sessao';

export interface GrupoGateway {
  obter(): Promise<Grupo>;
  renomear(nome: string): Promise<void>;
  criarConvite(): Promise<Convite>;
  entrar(codigo: string): Promise<Sessao>;
  sair(): Promise<Sessao>;
  removerMembro(usuarioId: string): Promise<void>;
}

export type EstadoDeConexao = 'desconectado' | 'conectando' | 'conectado' | 'reconectando';

/**
 * Aviso de que algo mudou no grupo. Só ids: quem recebe busca o dado novo pela API.
 * `reconectado` não vem do servidor: o app o gera ao voltar a conexão, para recarregar tudo que pode ter mudado no intervalo.
 */
export interface EventoDeAlteracao {
  tipo: 'lista' | 'catalogo' | 'membros' | 'grupoAlterado' | 'reconectado';
  listaId?: string | null;
  itemId?: string | null;
  porUsuarioId?: string | null;
}

export interface TempoRealGateway {
  conectar(
    aoEvento: (evento: EventoDeAlteracao) => void,
    aoMudarEstado: (estado: EstadoDeConexao) => void,
  ): Promise<void>;
  desconectar(): Promise<void>;
}
