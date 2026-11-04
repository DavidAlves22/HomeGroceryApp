import type { MapaEmEdicao, Secao } from '../../src/domain/entities/mercados';
import type { Categoria } from '../../src/domain/entities/tipos';
import {
  acharAlvo,
  adicionarSecao,
  alternarCategoria,
  areaLivre,
  categoriasSemLocal,
  dividirSecao,
  duplicarSecao,
  girarSecao,
  juntarSecao,
  ladosSemCategoria,
  MINIMO_DE_SECOES_PARA_O_CATALOGO,
  ladoNoPonto,
  moverAlvo,
  redimensionarMapa,
  redimensionarSecao,
  secaoNoPonto,
  secoesComNomeProprio,
  TAMANHO_MAXIMO_DO_MAPA,
  textoDoLado,
  validarMapa,
} from '../../src/domain/services/mapa';

const secao = (id: string, x: number, y: number, largura: number, altura: number): Secao => ({
  id,
  nome: id,
  nomeLadoB: null,
  dividida: false,
  area: { x, y, largura, altura },
  categoriasLadoA: [],
  categoriasLadoB: [],
});

const mapa = (secoes: Secao[] = []): MapaEmEdicao => ({
  nome: 'Teste',
  cidade: 'Araras',
  largura: 30,
  altura: 20,
  entrada: { x: 2, y: 18 },
  caixas: { x: 24, y: 17, largura: 5, altura: 2 },
  secoes,
});

describe('mover e redimensionar', () => {
  it('move a seção para a célula pedida', () => {
    const novo = moverAlvo(mapa([secao('a', 5, 5, 6, 2)]), { tipo: 'secao', id: 'a' }, 10, 8);
    expect(novo?.secoes[0].area).toMatchObject({ x: 10, y: 8 });
  });

  it('recusa mover para cima de outra seção, dos caixas ou da entrada', () => {
    const base = mapa([secao('a', 5, 5, 6, 2), secao('b', 15, 5, 6, 2)]);
    const alvo = { tipo: 'secao', id: 'a' } as const;
    expect(moverAlvo(base, alvo, 14, 5)).toBeNull();
    expect(moverAlvo(base, alvo, 25, 17)).toBeNull();
    expect(moverAlvo(base, alvo, 2, 17)).toBeNull();
  });

  it('segura a seção nas bordas do mapa em vez de deixá-la sair', () => {
    const novo = moverAlvo(mapa([secao('a', 5, 5, 6, 2)]), { tipo: 'secao', id: 'a' }, 99, 0);
    expect(novo?.secoes[0].area.x).toBe(24);
  });

  it('a entrada e os caixas também se movem, sem pisar nas seções', () => {
    const base = mapa([secao('a', 5, 5, 6, 2)]);
    expect(moverAlvo(base, { tipo: 'entrada' }, 6, 6)).toBeNull();
    expect(moverAlvo(base, { tipo: 'entrada' }, 8, 18)?.entrada).toEqual({ x: 8, y: 18 });
    expect(moverAlvo(base, { tipo: 'caixas' }, 20, 17)?.caixas.x).toBe(20);
  });

  it('redimensiona dentro do espaço livre e recusa invadir vizinhos', () => {
    const base = mapa([secao('a', 5, 5, 6, 2), secao('b', 13, 5, 4, 2)]);
    expect(redimensionarSecao(base, 'a', 8, 3)?.secoes[0].area).toMatchObject({
      largura: 8,
      altura: 3,
    });
    expect(redimensionarSecao(base, 'a', 9, 2)).toBeNull();
  });

  it('gira trocando largura e altura e recusa se não houver espaço', () => {
    expect(girarSecao(mapa([secao('a', 5, 5, 6, 2)]), 'a')?.secoes[0].area).toMatchObject({
      largura: 2,
      altura: 6,
    });
    expect(girarSecao(mapa([secao('a', 5, 5, 6, 2), secao('b', 5, 8, 6, 2)]), 'a')).toBeNull();
  });
});

describe('gôndola de dois lados', () => {
  it('dividir dá espessura 2, nome do lado B e lado B vazio', () => {
    const novo = dividirSecao(mapa([secao('a', 5, 5, 8, 1)]), 'a');
    expect(novo?.secoes[0]).toMatchObject({
      dividida: true,
      nomeLadoB: 'Lado B',
      area: { altura: 2 },
    });
  });

  it('não divide se não há espaço para a segunda célula de espessura', () => {
    expect(dividirSecao(mapa([secao('a', 5, 5, 8, 1), secao('b', 5, 6, 8, 2)]), 'a')).toBeNull();
  });

  it('juntar leva as categorias do lado B para o lado A, sem repetir', () => {
    const dividida = {
      ...secao('a', 5, 5, 8, 2),
      dividida: true,
      nomeLadoB: 'Copos',
      categoriasLadoA: ['x', 'y'],
      categoriasLadoB: ['y', 'z'],
    };
    const juntada = juntarSecao(mapa([dividida]), 'a').secoes[0];
    expect(juntada.dividida).toBe(false);
    expect(juntada.categoriasLadoA).toEqual(['x', 'y', 'z']);
    expect(juntada.categoriasLadoB).toEqual([]);
  });

  it('gôndola dividida não pode ficar mais fina que 2 células', () => {
    const dividida = { ...secao('a', 5, 5, 8, 2), dividida: true, nomeLadoB: 'B' };
    expect(redimensionarSecao(mapa([dividida]), 'a', 8, 1)).toBeNull();
  });

  it('o texto do lado acompanha a orientação', () => {
    const horizontal = { ...secao('h', 1, 1, 10, 2), dividida: true };
    const vertical = { ...secao('v', 15, 1, 2, 10), dividida: true };
    expect(textoDoLado(horizontal, 'B')).toBe('lado de baixo');
    expect(textoDoLado(vertical, 'A')).toBe('lado esquerdo');
    expect(textoDoLado(secao('s', 20, 1, 4, 2), 'A')).toBeNull();
  });
});

describe('categorias', () => {
  const categorias: Categoria[] = [
    { id: 'm', nome: 'Mercearia', ordem: 0, padrao: true },
    { id: 'l', nome: 'Limpeza', ordem: 1, padrao: true },
  ];

  it('a mesma categoria pode estar em vários lugares do mercado', () => {
    let m = mapa([secao('a', 5, 5, 6, 2), secao('b', 15, 5, 6, 2)]);
    m = alternarCategoria(m, 'a', 'A', 'm');
    m = alternarCategoria(m, 'b', 'A', 'm');
    expect(m.secoes.map((s) => s.categoriasLadoA)).toEqual([['m'], ['m']]);
    expect(alternarCategoria(m, 'a', 'A', 'm').secoes[0].categoriasLadoA).toEqual([]);
  });

  it('lista as categorias que ainda não têm lugar no mercado', () => {
    const m = alternarCategoria(mapa([secao('a', 5, 5, 6, 2)]), 'a', 'A', 'm');
    expect(categoriasSemLocal(m, categorias).map((c) => c.nome)).toEqual(['Limpeza']);
  });
});

describe('adicionarSecao', () => {
  it('acha o primeiro espaço livre e devolve null com o mapa cheio', () => {
    const novo = adicionarSecao(mapa(), 'nova');
    expect(novo?.secoes[0].area).toMatchObject({ largura: 6, altura: 2 });
    expect(areaLivre(mapa(), novo!.secoes[0].area)).toBe(true);

    const cheio = { ...mapa(), largura: 10, altura: 10 };
    expect(adicionarSecao({ ...cheio, secoes: [secao('x', 0, 1, 10, 6)] }, 'y')).toBeNull();
  });
});

describe('duplicarSecao', () => {
  it('copia o tamanho ao lado da original, sem nome nem categorias', () => {
    const original = { ...secao('a', 5, 5, 6, 2), nome: 'Mercearia', categoriasLadoA: ['m'] };
    const novo = duplicarSecao(mapa([original]), 'a', 'b')!;
    expect(novo.secoes).toHaveLength(2);
    expect(novo.secoes[1]).toMatchObject({
      id: 'b',
      nome: 'Nova seção',
      categoriasLadoA: [],
      area: { x: 11, y: 5, largura: 6, altura: 2 },
    });
  });

  it('mantém a gôndola de dois lados', () => {
    const dupla = { ...secao('a', 5, 5, 8, 2), dividida: true, nomeLadoB: 'Copos' };
    const copia = duplicarSecao(mapa([dupla]), 'a', 'b')!.secoes[1];
    expect(copia).toMatchObject({ dividida: true, nomeLadoB: 'Lado B' });
  });

  it('tenta outro lado quando a direita está ocupada', () => {
    const base = mapa([secao('a', 5, 5, 6, 2), secao('c', 11, 5, 4, 2)]);
    expect(duplicarSecao(base, 'a', 'b')!.secoes[2].area).toMatchObject({ x: 5, y: 7 });
  });

  it('devolve null se a seção não existe ou não há espaço', () => {
    expect(duplicarSecao(mapa(), 'x', 'b')).toBeNull();
    const cheio = { ...mapa(), largura: 10, altura: 10 };
    expect(duplicarSecao({ ...cheio, secoes: [secao('a', 0, 0, 10, 8)] }, 'a', 'b')).toBeNull();
  });
});

describe('onde o produto foi achado (toque no mapa)', () => {
  const horizontal = { ...secao('h', 5, 5, 10, 2), dividida: true, nomeLadoB: 'B' };
  const vertical = { ...secao('v', 20, 2, 2, 10), dividida: true, nomeLadoB: 'B' };

  it('acha a seção sob o toque, com folga para as finas, e nada no chão', () => {
    const m = mapa([horizontal]);
    expect(secaoNoPonto(m, 7, 5.5)?.id).toBe('h');
    expect(secaoNoPonto(m, 7, 4.9)?.id).toBe('h');
    expect(secaoNoPonto(m, 7, 9)).toBeNull();
  });

  it('em gôndola horizontal a metade de cima é o lado A e a de baixo é o B', () => {
    expect(ladoNoPonto(horizontal, 8, 5.4)).toBe('A');
    expect(ladoNoPonto(horizontal, 8, 6.6)).toBe('B');
  });

  it('em gôndola vertical a metade da esquerda é o lado A e a da direita é o B', () => {
    expect(ladoNoPonto(vertical, 20.4, 6)).toBe('A');
    expect(ladoNoPonto(vertical, 21.6, 6)).toBe('B');
  });

  it('seção de um lado só é sempre o lado A', () => {
    expect(ladoNoPonto(secao('s', 1, 1, 4, 2), 3, 2.9)).toBe('A');
  });
});

describe('acharAlvo (o que está sob o dedo)', () => {
  const base = mapa([secao('a', 5, 5, 6, 2)]);

  it('acha a seção, a entrada e os caixas', () => {
    expect(acharAlvo(base, 7.2, 5.5, 1, null)?.alvo).toEqual({ tipo: 'secao', id: 'a' });
    expect(acharAlvo(base, 2.4, 18.4, 0.5, null)?.alvo).toEqual({ tipo: 'entrada' });
    expect(acharAlvo(base, 26, 18, 0.5, null)?.alvo).toEqual({ tipo: 'caixas' });
    expect(acharAlvo(base, 20, 10, 0.5, null)).toBeNull();
  });

  it('a bolinha do canto da seção selecionada tem prioridade e marca "alça"', () => {
    const toque = acharAlvo(base, 11.1, 7.1, 1, { tipo: 'secao', id: 'a' });
    expect(toque).toEqual({ alvo: { tipo: 'secao', id: 'a' }, alca: true });
    expect(acharAlvo(base, 11.1, 7.1, 1, null)?.alca).toBeFalsy();
  });
});

describe('validarMapa', () => {
  it('aceita um mapa correto', () => {
    expect(validarMapa(mapa([secao('a', 5, 5, 6, 2)]))).toBeNull();
  });

  it.each([
    ['sem nome', { ...mapa(), nome: '  ' }],
    ['pequeno demais', { ...mapa(), largura: 5 }],
    ['seção sem nome', mapa([{ ...secao('a', 5, 5, 6, 2), nome: '' }])],
    ['seções sobrepostas', mapa([secao('a', 5, 5, 6, 2), secao('b', 8, 5, 6, 2)])],
    ['seção fora da grade', mapa([secao('a', 28, 5, 6, 2)])],
    ['seção nos caixas', mapa([secao('a', 25, 17, 2, 2)])],
    ['gôndola fina', mapa([{ ...secao('a', 5, 5, 8, 1), dividida: true, nomeLadoB: 'B' }])],
    [
      'gôndola sem nome do lado B',
      mapa([{ ...secao('a', 5, 5, 8, 2), dividida: true, nomeLadoB: ' ' }]),
    ],
  ])('recusa: %s', (_nome, m) => {
    expect(validarMapa(m)).not.toBeNull();
  });
});

describe('redimensionarMapa (colunas x linhas)', () => {
  it('o limite da grade é de 10 a 120 células em cada lado', () => {
    expect(TAMANHO_MAXIMO_DO_MAPA).toBe(120);
    expect(redimensionarMapa(mapa(), 120, 120).ok).toBe(true);
    expect(redimensionarMapa(mapa(), 121, 20)).toMatchObject({ ok: false });
    expect(redimensionarMapa(mapa(), 30, 121)).toMatchObject({ ok: false });
    expect(redimensionarMapa(mapa(), 9, 20)).toMatchObject({ ok: false });
    expect(redimensionarMapa(mapa(), 30.5, 20)).toMatchObject({ ok: false });
  });

  it('aumentar mantém as seções e leva a entrada e os caixas junto da borda de baixo', () => {
    const r = redimensionarMapa(mapa([secao('a', 5, 5, 6, 2)]), 49, 29);
    if (!r.ok) throw new Error(r.erro);
    expect(r.mapa.largura).toBe(49);
    expect(r.mapa.altura).toBe(29);
    expect(r.mapa.secoes[0].area).toMatchObject({ x: 5, y: 5 });
    expect(r.mapa.entrada).toEqual({ x: 2, y: 27 });
    expect(r.mapa.caixas).toMatchObject({ x: 24 + 19, y: 26 });
  });

  it('diminuir recusa quando uma seção ficaria para fora e diz qual', () => {
    const r = redimensionarMapa(mapa([secao('Açougue', 20, 5, 6, 2)]), 22, 20);
    expect(r).toEqual({ ok: false, erro: 'A seção "Açougue" precisa estar dentro do mapa.' });
  });

  it('diminuir acompanha a entrada e os caixas quando as seções cabem', () => {
    const r = redimensionarMapa(mapa([secao('a', 2, 2, 6, 2)]), 20, 12);
    if (!r.ok) throw new Error(r.erro);
    expect(r.mapa.entrada).toEqual({ x: 2, y: 10 });
    expect(r.mapa.caixas).toMatchObject({ x: 14, y: 9 });
  });
});

describe('ladosSemCategoria', () => {
  it('lista seções sem categoria e, em gôndola dividida, só o lado que falta', () => {
    const comCategoria = { ...secao('a', 2, 2, 6, 2), categoriasLadoA: ['m'] };
    const semNada = { ...secao('b', 2, 6, 6, 2), nome: 'Açougue' };
    const dividida = {
      ...secao('c', 12, 2, 2, 6),
      nome: 'Cervejas',
      nomeLadoB: 'Refrigerantes',
      dividida: true,
      categoriasLadoA: ['k'],
    };
    expect(ladosSemCategoria(mapa([comCategoria, semNada, dividida]))).toEqual([
      { secaoId: 'b', lado: 'A', rotulo: 'Açougue' },
      { secaoId: 'c', lado: 'B', rotulo: 'Refrigerantes · lado direito' },
    ]);
    expect(ladosSemCategoria(mapa([comCategoria]))).toEqual([]);
  });
});

describe('secoesComNomeProprio', () => {
  it('não conta seção sem nome nem com o nome padrão, em qualquer caixa', () => {
    const nomeada = (id: string, nome: string) => ({ ...secao(id, 1, 1, 2, 2), nome });
    const m = mapa([
      nomeada('a', 'Açougue'),
      nomeada('b', 'Nova seção'),
      nomeada('c', ' NOVA SEÇÃO '),
      nomeada('d', '   '),
      nomeada('e', 'Padaria'),
    ]);
    expect(secoesComNomeProprio(m)).toBe(2);
    expect(MINIMO_DE_SECOES_PARA_O_CATALOGO).toBe(8);
  });
});
