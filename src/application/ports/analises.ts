import type {
  AnaliseDeGastos,
  AnaliseDePrecos,
  AvisosDeRitmo,
  HabitosDeCompra,
  PadroesDeCompra,
} from '../../domain/entities/analises';

export interface AnalisesGateway {
  gastos(meses: number, competencia?: string): Promise<AnaliseDeGastos>;
  precos(): Promise<AnaliseDePrecos>;
  avisos(): Promise<AvisosDeRitmo>;
  padroes(): Promise<PadroesDeCompra>;
  habitos(): Promise<HabitosDeCompra>;
}
