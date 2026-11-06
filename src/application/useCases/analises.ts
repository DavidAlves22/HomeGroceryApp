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

/** O que repor agora e quais itens da lista padrão estão parados (a conta é toda no servidor). */
export class ObterAvisosDeRitmo {
  constructor(private readonly gateway: AnalisesGateway) {}
  executar() {
    return this.gateway.avisos();
  }
}

/** Preço bom na última compra, produtos de época e pares que costumam ir juntos (conta feita no servidor). */
export class ObterPadroesDeCompra {
  constructor(private readonly gateway: AnalisesGateway) {}
  executar() {
    return this.gateway.padroes();
  }
}

/** Mercado habitual de cada produto e responsável habitual de cada categoria (conta feita no servidor). */
export class ObterHabitosDeCompra {
  constructor(private readonly gateway: AnalisesGateway) {}
  executar() {
    return this.gateway.habitos();
  }
}
