import type { AdminUsuarios, PontoDoDia } from '../entities/admin';

/** Soma os valores de uma série (o total do período mostrado no gráfico). */
export function somarPontos(pontos: PontoDoDia[]): number {
  return pontos.reduce((soma, ponto) => soma + ponto.valor, 0);
}

/** "2026-11-04" -> "04/11". Texto que não é uma data é devolvido como veio. */
export function rotuloDoDia(dia: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  return partes ? `${partes[3]}/${partes[2]}` : dia;
}

/** O dia com mais ocorrências (o mais recente em caso de empate); nulo se nada aconteceu no período. */
export function melhorDia(pontos: PontoDoDia[]): PontoDoDia | null {
  let melhor: PontoDoDia | null = null;
  for (const ponto of pontos) {
    if (ponto.valor > 0 && (melhor === null || ponto.valor >= melhor.valor)) melhor = ponto;
  }
  return melhor;
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias". Sem data = nunca voltou depois do cadastro. */
export function vistoPorUltimo(iso: string | null, agora: Date): string {
  if (!iso) return 'sem registro';
  const instante = new Date(iso).getTime();
  if (Number.isNaN(instante)) return 'sem registro';

  const minutos = Math.floor((agora.getTime() - instante) / 60_000);
  if (minutos < 2) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

/** Quantas páginas a lista de contas tem (sempre pelo menos 1, para a tela não mostrar "página 1 de 0"). */
export function totalDePaginas(usuarios: Pick<AdminUsuarios, 'total' | 'tamanho'>): number {
  return Math.max(1, Math.ceil(usuarios.total / Math.max(usuarios.tamanho, 1)));
}
