/**
 * Valor monetário em centavos inteiros. Nunca guardamos reais em `number` com casas decimais,
 * porque 0.1 + 0.2 !== 0.3 em ponto flutuante; somar centavos inteiros é exato.
 *
 * Exemplo: 6 unidades de R$ 5,50 → `Dinheiro.deReais(5.5).vezes(6)` = 3300 centavos = "R$ 33,00".
 */
export class Dinheiro {
  private constructor(readonly centavos: number) {}

  static readonly ZERO = new Dinheiro(0);

  static deCentavos(centavos: number): Dinheiro {
    if (!Number.isFinite(centavos)) throw new Error('Valor monetário inválido.');
    return new Dinheiro(Math.round(centavos));
  }

  static deReais(reais: number): Dinheiro {
    return Dinheiro.deCentavos(reais * 100);
  }

  /** Lê o que o usuário digitou: "5,50", "1.234,56", "R$ 18". Vazio vira null. */
  static deTexto(texto: string): Dinheiro | null {
    const limpo = texto.replace(/[^\d,.-]/g, '').trim();
    if (limpo === '') return null;
    const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
    const numero = Number(normalizado);
    return Number.isFinite(numero) ? Dinheiro.deReais(numero) : null;
  }

  mais(outro: Dinheiro): Dinheiro {
    return new Dinheiro(this.centavos + outro.centavos);
  }

  menos(outro: Dinheiro): Dinheiro {
    return new Dinheiro(this.centavos - outro.centavos);
  }

  /** Multiplica por uma quantidade (pode ser fracionada, como 0,5 kg) arredondando ao centavo. */
  vezes(quantidade: number): Dinheiro {
    return new Dinheiro(Math.round(this.centavos * quantidade));
  }

  igual(outro: Dinheiro): boolean {
    return this.centavos === outro.centavos;
  }

  get reais(): number {
    return this.centavos / 100;
  }

  formatar(): string {
    return this.reais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
