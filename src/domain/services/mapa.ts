import type { Area, LadoDaSecao, MapaEmEdicao, Mercado, Ponto, Secao } from '../entities/mercados';
import type { Categoria } from '../entities/tipos';

export const TAMANHO_MINIMO_DO_MAPA = 10;
export const TAMANHO_MAXIMO_DO_MAPA = 80;
export const MAXIMO_DE_SECOES = 150;
export const METROS_POR_CELULA = 1.5;

/** O que o usuário pode arrastar no editor. */
export type AlvoDoMapa = { tipo: 'secao'; id: string } | { tipo: 'entrada' } | { tipo: 'caixas' };

/** `alca`: o toque pegou a bolinha de redimensionar da seção selecionada. */
export interface Toque {
  alvo: AlvoDoMapa;
  alca: boolean;
}

let contadorLocal = 0;
/** Id provisório de uma seção nova: a API troca por ids definitivas ao salvar o mapa. */
export const novoIdLocal = () => `local-${++contadorLocal}`;

export const mesmoAlvo = (a: AlvoDoMapa | null | undefined, b: AlvoDoMapa | null | undefined) =>
  !!a && !!b && a.tipo === b.tipo && (a.tipo !== 'secao' || a.id === (b as { id: string }).id);

export const sobrepoe = (a: Area, b: Area) =>
  a.x < b.x + b.largura && b.x < a.x + a.largura && a.y < b.y + b.altura && b.y < a.y + a.altura;

const celula = (p: Ponto): Area => ({ x: p.x, y: p.y, largura: 1, altura: 1 });

export function cabeNoMapa(mapa: Pick<MapaEmEdicao, 'largura' | 'altura'>, a: Area): boolean {
  return (
    a.largura >= 1 &&
    a.altura >= 1 &&
    a.x >= 0 &&
    a.y >= 0 &&
    a.x + a.largura <= mapa.largura &&
    a.y + a.altura <= mapa.altura
  );
}

export function mapaDoMercado(m: Mercado): MapaEmEdicao {
  return {
    nome: m.nome,
    largura: m.largura,
    altura: m.altura,
    entrada: m.entrada,
    caixas: m.caixas,
    secoes: m.secoes,
  };
}

export function areaDoAlvo(mapa: MapaEmEdicao, alvo: AlvoDoMapa): Area | undefined {
  if (alvo.tipo === 'entrada') return celula(mapa.entrada);
  if (alvo.tipo === 'caixas') return mapa.caixas;
  return mapa.secoes.find((s) => s.id === alvo.id)?.area;
}

/** Seções, caixas e entrada nunca ficam uma em cima da outra, nem fora da grade. */
export function areaLivre(mapa: MapaEmEdicao, area: Area, ignorar?: AlvoDoMapa | null): boolean {
  if (!cabeNoMapa(mapa, area)) return false;
  const outros: { alvo: AlvoDoMapa; area: Area }[] = [
    ...mapa.secoes.map((s) => ({ alvo: { tipo: 'secao', id: s.id } as AlvoDoMapa, area: s.area })),
    { alvo: { tipo: 'caixas' }, area: mapa.caixas },
    { alvo: { tipo: 'entrada' }, area: celula(mapa.entrada) },
  ];
  return !outros.some((o) => !mesmoAlvo(o.alvo, ignorar) && sobrepoe(area, o.area));
}

function comArea(mapa: MapaEmEdicao, alvo: AlvoDoMapa, area: Area): MapaEmEdicao {
  if (alvo.tipo === 'entrada') return { ...mapa, entrada: { x: area.x, y: area.y } };
  if (alvo.tipo === 'caixas') return { ...mapa, caixas: area };
  return { ...mapa, secoes: mapa.secoes.map((s) => (s.id === alvo.id ? { ...s, area } : s)) };
}

const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Move o alvo para a célula (x, y). Devolve null se o destino estiver ocupado: quem chama mantém o mapa como estava. */
export function moverAlvo(mapa: MapaEmEdicao, alvo: AlvoDoMapa, x: number, y: number) {
  const atual = areaDoAlvo(mapa, alvo);
  if (!atual) return null;
  const nova = {
    ...atual,
    x: limitar(x, 0, mapa.largura - atual.largura),
    y: limitar(y, 0, mapa.altura - atual.altura),
  };
  if (nova.x === atual.x && nova.y === atual.y) return null;
  return areaLivre(mapa, nova, alvo) ? comArea(mapa, alvo, nova) : null;
}

/** Muda o tamanho de uma seção (a bolinha do canto). Gôndola de dois lados precisa de 2+ células de espessura. */
export function redimensionarSecao(
  mapa: MapaEmEdicao,
  id: string,
  largura: number,
  altura: number,
) {
  const secao = mapa.secoes.find((s) => s.id === id);
  if (!secao) return null;
  const nova = {
    ...secao.area,
    largura: limitar(largura, 1, mapa.largura - secao.area.x),
    altura: limitar(altura, 1, mapa.altura - secao.area.y),
  };
  if (nova.largura === secao.area.largura && nova.altura === secao.area.altura) return null;
  if (secao.dividida && Math.min(nova.largura, nova.altura) < 2) return null;
  const alvo: AlvoDoMapa = { tipo: 'secao', id };
  return areaLivre(mapa, nova, alvo) ? comArea(mapa, alvo, nova) : null;
}

export function girarSecao(mapa: MapaEmEdicao, id: string) {
  const secao = mapa.secoes.find((s) => s.id === id);
  if (!secao) return null;
  const { x, y, largura, altura } = secao.area;
  const nova = {
    x: Math.min(x, mapa.largura - altura),
    y: Math.min(y, mapa.altura - largura),
    largura: altura,
    altura: largura,
  };
  const alvo: AlvoDoMapa = { tipo: 'secao', id };
  return areaLivre(mapa, nova, alvo) ? comArea(mapa, alvo, nova) : null;
}

/** Transforma a seção em gôndola de dois lados (cada lado precisa de 2 células de espessura). */
export function dividirSecao(mapa: MapaEmEdicao, id: string) {
  const secao = mapa.secoes.find((s) => s.id === id);
  if (!secao || secao.dividida) return null;
  const a = secao.area;
  const nova =
    a.largura >= a.altura
      ? { ...a, altura: Math.max(a.altura, 2) }
      : { ...a, largura: Math.max(a.largura, 2) };
  if (!areaLivre(mapa, nova, { tipo: 'secao', id })) return null;
  return {
    ...mapa,
    secoes: mapa.secoes.map((s) =>
      s.id === id
        ? { ...s, area: nova, dividida: true, nomeLadoB: 'Lado B', categoriasLadoB: [] }
        : s,
    ),
  };
}

/** Volta a ser uma seção de um lado só; as categorias do lado B passam para o lado A. */
export function juntarSecao(mapa: MapaEmEdicao, id: string): MapaEmEdicao {
  return {
    ...mapa,
    secoes: mapa.secoes.map((s) =>
      s.id === id && s.dividida
        ? {
            ...s,
            dividida: false,
            nomeLadoB: null,
            categoriasLadoA: [...new Set([...s.categoriasLadoA, ...s.categoriasLadoB])],
            categoriasLadoB: [],
          }
        : s,
    ),
  };
}

/** Coloca uma seção nova de 6 x 2 no primeiro espaço livre. Null se o mapa estiver cheio. */
export function adicionarSecao(mapa: MapaEmEdicao, id: string) {
  for (let y = 1; y < mapa.altura - 3; y++) {
    for (let x = 0; x <= mapa.largura - 6; x++) {
      const area = { x, y, largura: 6, altura: 2 };
      if (areaLivre(mapa, area)) {
        const secao: Secao = {
          id,
          nome: 'Nova seção',
          nomeLadoB: null,
          dividida: false,
          area,
          categoriasLadoA: [],
          categoriasLadoB: [],
        };
        return { ...mapa, secoes: [...mapa.secoes, secao] };
      }
    }
  }
  return null;
}

/**
 * Cria uma seção com o mesmo tamanho e formato (inclusive gôndola de dois lados) da original.
 * Nome e categorias começam vazios: o que se repete nas seções é a medida, não o conteúdo.
 * Procura lugar ao lado da original (direita, baixo, esquerda, cima) e depois no primeiro espaço livre.
 */
export function duplicarSecao(mapa: MapaEmEdicao, id: string, novoId: string) {
  const origem = mapa.secoes.find((s) => s.id === id);
  if (!origem) return null;
  const { x, y, largura, altura } = origem.area;
  const candidatas = [
    { x: x + largura, y },
    { x, y: y + altura },
    { x: x - largura, y },
    { x, y: y - altura },
  ].map((c) => ({ ...c, largura, altura }));
  let area = candidatas.find((c) => areaLivre(mapa, c));
  for (let cy = 0; !area && cy <= mapa.altura - altura; cy++) {
    for (let cx = 0; !area && cx <= mapa.largura - largura; cx++) {
      const livre = { x: cx, y: cy, largura, altura };
      if (areaLivre(mapa, livre)) area = livre;
    }
  }
  if (!area) return null;
  const copia: Secao = {
    id: novoId,
    nome: 'Nova seção',
    nomeLadoB: origem.dividida ? 'Lado B' : null,
    dividida: origem.dividida,
    area,
    categoriasLadoA: [],
    categoriasLadoB: [],
  };
  return { ...mapa, secoes: [...mapa.secoes, copia] };
}

export function removerSecao(mapa: MapaEmEdicao, id: string): MapaEmEdicao {
  return { ...mapa, secoes: mapa.secoes.filter((s) => s.id !== id) };
}

export function renomearSecao(mapa: MapaEmEdicao, id: string, lado: LadoDaSecao, nome: string) {
  return {
    ...mapa,
    secoes: mapa.secoes.map((s) =>
      s.id !== id ? s : lado === 'B' ? { ...s, nomeLadoB: nome } : { ...s, nome },
    ),
  };
}

/** Liga ou desliga uma categoria num lado. Pode estar em vários lugares do mesmo mercado. */
export function alternarCategoria(
  mapa: MapaEmEdicao,
  id: string,
  lado: LadoDaSecao,
  categoriaId: string,
): MapaEmEdicao {
  const alternar = (lista: string[]) =>
    lista.includes(categoriaId) ? lista.filter((c) => c !== categoriaId) : [...lista, categoriaId];
  return {
    ...mapa,
    secoes: mapa.secoes.map((s) =>
      s.id !== id
        ? s
        : lado === 'B'
          ? { ...s, categoriasLadoB: alternar(s.categoriasLadoB) }
          : { ...s, categoriasLadoA: alternar(s.categoriasLadoA) },
    ),
  };
}

export function categoriasSemLocal(mapa: MapaEmEdicao, categorias: Categoria[]): Categoria[] {
  const usadas = new Set(mapa.secoes.flatMap((s) => [...s.categoriasLadoA, ...s.categoriasLadoB]));
  return categorias.filter((c) => !usadas.has(c.id));
}

export const nomeDoLado = (secao: Secao, lado: LadoDaSecao) =>
  lado === 'B' ? (secao.nomeLadoB ?? 'Lado B') : secao.nome;

/** Dito ao usuário: "lado de baixo", "lado esquerdo"... Vazio em seção de um lado só. */
export function textoDoLado(secao: Secao, lado: LadoDaSecao): string | null {
  if (!secao.dividida) return null;
  const horizontal = secao.area.largura >= secao.area.altura;
  if (lado === 'A') return horizontal ? 'lado de cima' : 'lado esquerdo';
  return horizontal ? 'lado de baixo' : 'lado direito';
}

/** "6 x 2 células, cerca de 9 m x 3 m". */
export function descreverTamanho(area: Area): string {
  const m = (c: number) => String(Math.round(c * METROS_POR_CELULA * 10) / 10).replace('.', ',');
  return `${area.largura} × ${area.altura} células · cerca de ${m(area.largura)} m × ${m(area.altura)} m`;
}

/**
 * Descobre o que está sob o dedo. As coordenadas vêm em células (com fração) e `tolerancia` é o
 * tamanho de um dedo em células: a bolinha de redimensionar e a entrada têm área de toque maior que o desenho.
 */
export function acharAlvo(
  mapa: MapaEmEdicao,
  fx: number,
  fy: number,
  tolerancia: number,
  selecionado: AlvoDoMapa | null,
): Toque | null {
  if (selecionado?.tipo === 'secao') {
    const s = mapa.secoes.find((x) => x.id === selecionado.id);
    if (
      s &&
      Math.hypot(fx - (s.area.x + s.area.largura), fy - (s.area.y + s.area.altura)) <= tolerancia
    ) {
      return { alvo: selecionado, alca: true };
    }
  }

  const raioDaEntrada = Math.max(tolerancia, 0.8);
  if (Math.hypot(fx - (mapa.entrada.x + 0.5), fy - (mapa.entrada.y + 0.5)) <= raioDaEntrada) {
    return { alvo: { tipo: 'entrada' }, alca: false };
  }

  const dentro = (a: Area, folga = 0) =>
    fx >= a.x - folga &&
    fx < a.x + a.largura + folga &&
    fy >= a.y - folga &&
    fy < a.y + a.altura + folga;
  if (dentro(mapa.caixas)) return { alvo: { tipo: 'caixas' }, alca: false };

  // A seção selecionada tem prioridade e uma folga pequena, para ser fácil de pegar quando é fina.
  const idSelecionado = selecionado?.tipo === 'secao' ? selecionado.id : null;
  const ordenadas = [...mapa.secoes].sort(
    (a, b) => Number(b.id === idSelecionado) - Number(a.id === idSelecionado),
  );
  const achada = ordenadas.find((s) => dentro(s.area, 0.25));
  return achada ? { alvo: { tipo: 'secao', id: achada.id }, alca: false } : null;
}

/** Confere o mapa antes de enviar (a API confere de novo). Devolve a primeira mensagem de erro, ou null. */
export function validarMapa(mapa: MapaEmEdicao): string | null {
  if (!mapa.nome.trim()) return 'Informe o nome do mercado.';
  if (
    mapa.largura < TAMANHO_MINIMO_DO_MAPA ||
    mapa.largura > TAMANHO_MAXIMO_DO_MAPA ||
    mapa.altura < TAMANHO_MINIMO_DO_MAPA ||
    mapa.altura > TAMANHO_MAXIMO_DO_MAPA
  ) {
    return `O mapa deve ter de ${TAMANHO_MINIMO_DO_MAPA} a ${TAMANHO_MAXIMO_DO_MAPA} células de largura e de altura.`;
  }
  if (mapa.secoes.length > MAXIMO_DE_SECOES)
    return `O mapa aceita no máximo ${MAXIMO_DE_SECOES} seções.`;
  if (!cabeNoMapa(mapa, mapa.caixas)) return 'Os caixas precisam estar dentro do mapa.';
  if (!cabeNoMapa(mapa, celula(mapa.entrada))) return 'A entrada precisa estar dentro do mapa.';
  if (sobrepoe(celula(mapa.entrada), mapa.caixas))
    return 'A entrada não pode ficar em cima dos caixas.';

  const ocupadas: Area[] = [mapa.caixas];
  for (const s of mapa.secoes) {
    const nome = s.nome.trim();
    if (nome.length === 0 || nome.length > 40) {
      return 'O nome da seção é obrigatório e pode ter no máximo 40 caracteres.';
    }
    if (!cabeNoMapa(mapa, s.area)) return `A seção "${nome}" precisa estar dentro do mapa.`;
    if (sobrepoe(celula(mapa.entrada), s.area))
      return `A seção "${nome}" não pode ficar em cima da entrada.`;
    if (ocupadas.some((o) => sobrepoe(o, s.area))) {
      return `A seção "${nome}" está sobreposta a outra seção ou aos caixas.`;
    }
    ocupadas.push(s.area);
    if (s.dividida) {
      const nomeB = (s.nomeLadoB ?? '').trim();
      if (nomeB.length === 0 || nomeB.length > 40) {
        return `Informe o nome do outro lado da gôndola "${nome}" (até 40 caracteres).`;
      }
      if (Math.min(s.area.largura, s.area.altura) < 2) {
        return `A gôndola de dois lados "${nome}" precisa ter pelo menos 2 células de espessura.`;
      }
    }
  }
  return null;
}
