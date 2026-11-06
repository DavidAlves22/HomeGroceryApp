import type { AdminUsuarios, PontoDoDia, RecursoDoApp } from '../entities/admin';

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

/** Data (dia/mês/ano, horário de Brasília como no resto do painel) de um instante; sem data válida, "sem registro". */
export function dataDoDia(iso: string | null): string {
  if (!iso) return 'sem registro';
  const instante = new Date(iso).getTime();
  if (Number.isNaN(instante)) return 'sem registro';

  // Brasília é UTC-3 fixo (sem horário de verão); usar os getters UTC deixa o resultado igual em qualquer fuso do aparelho.
  const data = new Date(instante - 3 * 3_600_000);
  const dia = String(data.getUTCDate()).padStart(2, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getUTCFullYear()}`;
}

/** Quantas páginas a lista de contas tem (sempre pelo menos 1, para a tela não mostrar "página 1 de 0"). */
export function totalDePaginas(usuarios: Pick<AdminUsuarios, 'total' | 'tamanho'>): number {
  return Math.max(1, Math.ceil(usuarios.total / Math.max(usuarios.tamanho, 1)));
}

/** Porcentagem inteira de `parte` em `total` (0 a 100). Sem total não há o que medir: 0. */
export function percentual(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

const ROTULOS_DE_RECURSO: Record<RecursoDoApp, string> = {
  familia: 'Têm família (2+ pessoas)',
  divisao: 'Já dividiram uma compra',
  mercado: 'Mapearam um mercado',
  nota: 'Importaram nota fiscal',
  avisos: 'Ligaram os avisos',
};

export function rotuloDoRecurso(recurso: RecursoDoApp): string {
  return ROTULOS_DE_RECURSO[recurso] ?? recurso;
}

/** "1 dia", "7 dias": o rótulo de cada linha da retenção. */
export function rotuloDeDias(dias: number): string {
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

/** "06/11/2026 às 14:32" (horário de Brasília, UTC-3 fixo como no resto do painel); sem data válida, "sem registro". */
export function dataEHoraDoDia(iso: string | null): string {
  if (!iso) return 'sem registro';
  const instante = new Date(iso).getTime();
  if (Number.isNaN(instante)) return 'sem registro';

  const data = new Date(instante - 3 * 3_600_000);
  const hora = String(data.getUTCHours()).padStart(2, '0');
  const minuto = String(data.getUTCMinutes()).padStart(2, '0');
  return `${dataDoDia(iso)} às ${hora}:${minuto}`;
}
