import type { AnaliseDeGastos, AnaliseDePrecos } from '../../domain/entities/analises';

export interface AnalisesGateway {
  gastos(meses: number, competencia?: string): Promise<AnaliseDeGastos>;
  precos(): Promise<AnaliseDePrecos>;
}
