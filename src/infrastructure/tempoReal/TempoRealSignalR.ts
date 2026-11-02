import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import type {
  EstadoDeConexao,
  EventoDeAlteracao,
  TempoRealGateway,
} from '../../application/ports/grupo';

/**
 * Conexão em tempo real com a API (SignalR). Reconecta sozinha com espera crescente e, ao voltar,
 * avisa o app com um evento `reconectado` para ele recarregar o que pode ter mudado enquanto esteve fora.
 * O token vem de uma função (e não fixo) porque expira: ela renova antes de cada (re)conexão.
 */
export class TempoRealSignalR implements TempoRealGateway {
  private conexao: HubConnection | null = null;

  constructor(
    private readonly urlDaApi: string,
    private readonly obterToken: () => Promise<string>,
  ) {}

  async conectar(
    aoEvento: (evento: EventoDeAlteracao) => void,
    aoMudarEstado: (estado: EstadoDeConexao) => void,
  ): Promise<void> {
    await this.desconectar();

    const conexao = new HubConnectionBuilder()
      // withCredentials=false: o token vai no parâmetro da URL, não em cookie (evita exigir CORS com credenciais).
      .withUrl(`${this.urlDaApi}/hub/grupo`, {
        accessTokenFactory: this.obterToken,
        withCredentials: false,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
      .configureLogging(LogLevel.None)
      .build();

    conexao.on('evento', (evento: EventoDeAlteracao) => aoEvento(evento));
    conexao.onreconnecting(() => aoMudarEstado('reconectando'));
    conexao.onreconnected(() => {
      aoMudarEstado('conectado');
      aoEvento({ tipo: 'reconectado' });
    });
    conexao.onclose(() => aoMudarEstado('desconectado'));

    this.conexao = conexao;
    aoMudarEstado('conectando');
    try {
      await conexao.start();
      aoMudarEstado('conectado');
    } catch {
      // Servidor fora ou dormindo: o app continua funcionando sem tempo real, e tenta de novo em seguida.
      aoMudarEstado('desconectado');
      this.reconectarDepois(aoEvento, aoMudarEstado);
    }
  }

  async desconectar(): Promise<void> {
    const conexao = this.conexao;
    this.conexao = null;
    if (conexao && conexao.state !== HubConnectionState.Disconnected) await conexao.stop();
  }

  private reconectarDepois(
    aoEvento: (evento: EventoDeAlteracao) => void,
    aoMudarEstado: (estado: EstadoDeConexao) => void,
  ) {
    const conexaoAtual = this.conexao;
    setTimeout(() => {
      // Só tenta de novo se ninguém trocou/encerrou a conexão nesse meio tempo.
      if (this.conexao !== conexaoAtual || this.conexao === null) return;
      void this.conectar(aoEvento, aoMudarEstado).then(() => aoEvento({ tipo: 'reconectado' }));
    }, 10000);
  }
}
