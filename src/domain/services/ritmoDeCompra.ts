/** "a cada ~31 dias"; acima de 45 dias conta em meses ("a cada ~2 meses"), como a API descreve o ciclo. */
export function descreverCiclo(dias: number): string {
  if (dias <= 45) return `a cada ~${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  const meses = Math.round(dias / 30.4);
  return `a cada ~${meses} ${meses === 1 ? 'mês' : 'meses'}`;
}

/** "2026-10-06" -> "06/10". Sem ano: a tela já deixa claro que é a última compra. */
export function dataCurta(dia: string): string {
  const [, mes, diaDoMes] = dia.split('-');
  return `${diaDoMes}/${mes}`;
}

export interface SituacaoDaReposicao {
  texto: string;
  /** Já passou do dia previsto: merece destaque de alerta. */
  atrasado: boolean;
}

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/** Onde o produto está em relação ao dia previsto da próxima compra (datas "AAAA-MM-DD", dia civil do aparelho). */
export function situacaoDaReposicao(proximaPrevista: string, hoje: Date): SituacaoDaReposicao {
  const [ano, mes, dia] = proximaPrevista.split('-').map(Number);
  const previsto = Date.UTC(ano, mes - 1, dia);
  const agora = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diferenca = Math.round((agora - previsto) / 86_400_000);

  if (diferenca > 0) return { texto: `Atrasado há ${dias(diferenca)}`, atrasado: true };
  if (diferenca === 0) return { texto: 'Previsto para hoje', atrasado: false };
  return { texto: `Previsto em ${dias(-diferenca)}`, atrasado: false };
}
