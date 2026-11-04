import { formatarQuantidade } from './organizacao';
import { Dinheiro } from '../valueObjects/Dinheiro';

/**
 * A calculadora do teclado numérico (a mesma do Minhas Finanças). Mora aqui, e não na tela, porque é cálculo, e
 * cálculo em `.tsx` não se testa sem celular. A tela só desenha teclas e mostra o visor.
 *
 * Dois modos, que mudam como se digita e em que unidade se guarda:
 * - `dinheiro`: o visor guarda CENTAVOS e se digita da direita para a esquerda (5 → 0,05; 50 → 0,50), como um
 *   teclado de banco. Sem vírgula.
 * - `quantidade`: o visor guarda MILÉSIMOS (até 3 casas) e se digita da esquerda para a direita, com a tecla ","
 *   (1 , 5 → 1,5), porque quase toda quantidade de mercado é um número inteiro.
 *
 * **Encadeada, sem precedência:** cada operador fecha a conta anterior, como numa calculadora de bolso
 * (`2 + 3 × 4` dá 20). **Somar e subtrair operam no valor; multiplicar e dividir, num número puro** (um fator inteiro):
 * dividir por "R$ 3,00" não quer dizer nada, e depois de `×` ou `÷` o visor deixa de mostrar a unidade.
 */
export type ModoNumerico = 'dinheiro' | 'quantidade';
export type Operacao = '+' | '-' | '*' | '/';

export interface EstadoCalculo {
  readonly modo: ModoNumerico;
  /** O que o visor mostra, na menor unidade do modo (centavos ou milésimos); ou o fator inteiro, em escala. */
  readonly visor: number;
  /** O valor já fechado por um operador, na menor unidade do modo. */
  readonly acumulado: number | null;
  /** A operação à espera do segundo operando. */
  readonly operacao: Operacao | null;
  /** O próximo dígito começa um operando novo em vez de ampliar o visor. */
  readonly recomeca: boolean;
  /** Só em `quantidade`: null = ainda na parte inteira; n = quantas casas decimais já foram digitadas (0 = só a vírgula). */
  readonly casas: number | null;
}

const FATOR: Record<ModoNumerico, number> = { dinheiro: 100, quantidade: 1000 };
/** R$ 999.999,99 e 999.999,999: os mesmos tetos que a API aceita. */
const TETO: Record<ModoNumerico, number> = { dinheiro: 99999999, quantidade: 999999999 };
/** Ninguém divide ou multiplica por mais de dez mil. */
const TETO_ESCALA = 9999;
const CASAS_DA_QUANTIDADE = 3;

export const SIMBOLO: Record<Operacao, string> = { '/': '÷', '*': '×', '-': '−', '+': '+' };

const limitar = (n: number, teto: number) => Math.max(0, Math.min(n, teto));

/** O teclado abre no valor atual (ou zero). O primeiro dígito o troca, em vez de grudar nele. */
export function calculoInicial(modo: ModoNumerico, valor: number | null): EstadoCalculo {
  const visor = limitar(Math.round((valor ?? 0) * FATOR[modo]), TETO[modo]);
  return { modo, visor, acumulado: null, operacao: null, recomeca: true, casas: null };
}

/** O visor mostra um número puro (o fator de `×` ou `÷`)? Só depois de um dígito: antes, ainda mostra o valor acumulado. */
export function ehEscala(e: EstadoCalculo): boolean {
  return (e.operacao === '*' || e.operacao === '/') && !e.recomeca;
}

/** Com × ou ÷ pendente, o que se digita é um fator inteiro (não dinheiro nem quantidade), desde o primeiro dígito. */
const digitandoFator = (e: EstadoCalculo) => e.operacao === '*' || e.operacao === '/';

export function digitar(e: EstadoCalculo, n: number): EstadoCalculo {
  if (digitandoFator(e) || e.modo === 'dinheiro') {
    const teto = digitandoFator(e) ? TETO_ESCALA : TETO[e.modo];
    const proximo = (e.recomeca ? 0 : e.visor) * 10 + n;
    // O dígito que estoura o teto é ignorado, não aparado: aparar trocaria o número inteiro por outro.
    if (proximo > teto) return e;
    return { ...e, visor: proximo, recomeca: false };
  }

  // Quantidade: parte inteira da esquerda para a direita; depois da vírgula, uma casa por dígito (até 3).
  const base = e.recomeca ? 0 : e.visor;
  const casas = e.recomeca ? null : e.casas;
  if (casas === null) {
    const visor = (Math.trunc(base / FATOR.quantidade) * 10 + n) * FATOR.quantidade;
    return visor > TETO.quantidade ? e : { ...e, visor, recomeca: false, casas: null };
  }
  if (casas >= CASAS_DA_QUANTIDADE) return e;
  return {
    ...e,
    visor: base + n * 10 ** (CASAS_DA_QUANTIDADE - 1 - casas),
    recomeca: false,
    casas: casas + 1,
  };
}

/** A tecla ",": só existe em `quantidade`, e só uma vez por número. */
export function virgula(e: EstadoCalculo): EstadoCalculo {
  if (e.modo !== 'quantidade' || digitandoFator(e)) return e;
  if (e.recomeca) return { ...e, visor: 0, recomeca: false, casas: 0 };
  return e.casas === null ? { ...e, casas: 0 } : e;
}

export function apagar(e: EstadoCalculo): EstadoCalculo {
  // Depois de um operador o visor mostra o acumulado, que não é o que se está digitando: apagar come o número todo.
  if (e.recomeca) return { ...e, visor: 0, recomeca: false, casas: null };
  if (e.modo === 'dinheiro' || ehEscala(e)) return { ...e, visor: Math.trunc(e.visor / 10) };

  if (e.casas === null) {
    return { ...e, visor: Math.trunc(e.visor / FATOR.quantidade / 10) * FATOR.quantidade };
  }
  if (e.casas === 0) return { ...e, casas: null }; // some a vírgula
  const unidade = 10 ** (CASAS_DA_QUANTIDADE - e.casas);
  const ultimoDigito = Math.floor(e.visor / unidade) % 10;
  return { ...e, visor: e.visor - ultimoDigito * unidade, casas: e.casas - 1 };
}

export function operar(e: EstadoCalculo, op: Operacao): EstadoCalculo {
  // Operador em cima de operador troca o operador (sem isso `+` seguido de `×` fecharia a soma contra o acumulado).
  if (e.operacao !== null && e.recomeca) return { ...e, operacao: op };
  const fechado = fechar(e);
  if (fechado === null) return e;
  return { ...e, visor: fechado, acumulado: fechado, operacao: op, recomeca: true, casas: null };
}

/** O `=`: resolve o que estiver pendente. Operador sem segundo operando é operador desistido (`4,50 ×` vale 4,50). */
export function resolver(e: EstadoCalculo): EstadoCalculo {
  if (e.recomeca) return { ...e, acumulado: null, operacao: null, casas: null };
  const fechado = fechar(e);
  if (fechado === null) return e;
  return { ...e, visor: fechado, acumulado: null, operacao: null, recomeca: true, casas: null };
}

/**
 * O valor que o teclado entrega à tela (em reais ou na unidade da quantidade), com o pendente já resolvido.
 * Conta que não fecha (dividir por zero) sai pelo acumulado: o visor guarda o divisor, e entregá-lo apagaria o valor.
 */
export function valorDoCalculo(e: EstadoCalculo): number {
  const pendenteSemFechar = !e.recomeca && fechar(e) === null;
  const menorUnidade = pendenteSemFechar ? (e.acumulado ?? e.visor) : resolver(e).visor;
  return menorUnidade / FATOR[e.modo];
}

function fechar(e: EstadoCalculo): number | null {
  if (e.operacao === null || e.acumulado === null) return e.visor;
  const a = e.acumulado;
  const b = e.visor;
  switch (e.operacao) {
    case '+':
      return limitar(a + b, TETO[e.modo]);
    case '-':
      // Sem negativo: nem preço nem quantidade são menores que zero.
      return limitar(a - b, TETO[e.modo]);
    case '*':
      return limitar(a * b, TETO[e.modo]);
    case '/':
      return b === 0 ? null : Math.round(a / b);
  }
}

// --- O que a tela mostra ---------------------------------------------------------------------------------------

const textoDaQuantidade = (milesimos: number) => formatarQuantidade(milesimos / FATOR.quantidade);

/** O número em foco: dinheiro formatado, a quantidade com a vírgula como foi digitada, ou o fator puro em escala. */
export function textoDoVisor(e: EstadoCalculo): string {
  if (ehEscala(e)) return String(e.visor);
  if (e.modo === 'dinheiro') return Dinheiro.deCentavos(e.visor).formatar();
  const inteiro = Math.trunc(e.visor / FATOR.quantidade).toLocaleString('pt-BR');
  if (e.casas === null || e.recomeca) return e.recomeca ? textoDaQuantidade(e.visor) : inteiro;
  const decimais = String(e.visor % FATOR.quantidade)
    .padStart(CASAS_DA_QUANTIDADE, '0')
    .slice(0, e.casas);
  return `${inteiro},${decimais}`;
}

/** A conta pendente, escrita acima do visor ("12,00 ×"). Vazio (mas com espaço) quando não há. */
export function textoPendente(e: EstadoCalculo): string {
  if (e.acumulado === null || e.operacao === null) return ' ';
  const valor =
    e.modo === 'dinheiro'
      ? Dinheiro.deCentavos(e.acumulado).formatar()
      : textoDaQuantidade(e.acumulado);
  return `${valor} ${SIMBOLO[e.operacao]}`;
}
