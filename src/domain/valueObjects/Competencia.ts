const PADRAO = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const ABREVIADOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/**
 * Mês de referência de uma lista de compras, no formato "AAAA-MM" (ex.: "2026-11").
 * É o mesmo formato que a API usa, então viaja sem conversão.
 */
export class Competencia {
  private constructor(readonly chave: string) {}

  static deChave(chave: string): Competencia {
    if (!PADRAO.test(chave)) throw new Error(`Competência inválida: "${chave}". Use AAAA-MM.`);
    return new Competencia(chave);
  }

  static de(ano: number, mes: number): Competencia {
    return Competencia.deChave(`${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`);
  }

  static daData(data: Date): Competencia {
    return Competencia.de(data.getFullYear(), data.getMonth() + 1);
  }

  get ano(): number {
    return Number(this.chave.slice(0, 4));
  }

  get mes(): number {
    return Number(this.chave.slice(5, 7));
  }

  /** "Novembro de 2026" */
  get nome(): string {
    return `${MESES[this.mes - 1]} de ${this.ano}`;
  }

  /** "nov/26": cabe no eixo de um gráfico. */
  get abreviado(): string {
    return `${ABREVIADOS[this.mes - 1]}/${String(this.ano).slice(2)}`;
  }

  proxima(): Competencia {
    return this.mes === 12
      ? Competencia.de(this.ano + 1, 1)
      : Competencia.de(this.ano, this.mes + 1);
  }

  anterior(): Competencia {
    return this.mes === 1
      ? Competencia.de(this.ano - 1, 12)
      : Competencia.de(this.ano, this.mes - 1);
  }

  igual(outra: Competencia): boolean {
    return this.chave === outra.chave;
  }
}
