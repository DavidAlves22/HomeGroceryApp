import type { AnalisesGateway } from '../ports/analises';

export class ObterAnaliseDeGastos {
  constructor(private readonly gateway: AnalisesGateway) {}

  /** `competencia` escolhe de qual mês mostrar as categorias (padrão: o mais recente com gasto). */
  executar(meses = 6, competencia?: string) {
    return this.gateway.gastos(meses, competencia);
  }
}

export class ObterAnaliseDePrecos {
  constructor(private readonly gateway: AnalisesGateway) {}
  executar() {
    return this.gateway.precos();
  }
}
