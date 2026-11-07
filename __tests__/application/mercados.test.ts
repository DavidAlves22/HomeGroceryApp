import { ErroDeApi } from '../../src/application/errors';
import type { MercadosGateway, RotasGateway } from '../../src/application/ports/mercados';
import {
  CriarMercado,
  DefinirLocalDoItem,
  MarcarItemSemNoMercado,
  SalvarMapaDoMercado,
} from '../../src/application/useCases/mercados';
import type { MapaEmEdicao } from '../../src/domain/entities/mercados';

const mapaValido: MapaEmEdicao = {
  nome: ' Central ',
  cidade: ' Araras ',
  largura: 30,
  altura: 20,
  entrada: { x: 2, y: 18 },
  caixas: { x: 24, y: 17, largura: 5, altura: 2 },
  secoes: [],
};

const gateway = () =>
  ({
    criar: jest.fn().mockResolvedValue({}),
    salvarMapa: jest.fn().mockResolvedValue({}),
  }) as unknown as MercadosGateway & { criar: jest.Mock; salvarMapa: jest.Mock };

describe('CriarMercado', () => {
  it('exige nome e limpa os espaços das pontas', async () => {
    const g = gateway();

    await expect(new CriarMercado(g).executar('   ', 'Araras')).rejects.toBeInstanceOf(ErroDeApi);
    await new CriarMercado(g).executar('  Mercado A ', ' Araras ', 'origem');

    expect(g.criar).toHaveBeenCalledWith('Mercado A', 'Araras', 'origem');
    expect(g.criar).toHaveBeenCalledTimes(1);
  });

  it('exige a cidade (e recusa uma grande demais) antes de chamar a API', async () => {
    const g = gateway();

    await expect(new CriarMercado(g).executar('Mercado A', '   ')).rejects.toThrow('cidade');
    await expect(new CriarMercado(g).executar('Mercado A', 'x'.repeat(81))).rejects.toThrow('80');
    expect(g.criar).not.toHaveBeenCalled();
  });
});

describe('SalvarMapaDoMercado', () => {
  it('não chama a API quando o mapa tem seções sobrepostas', async () => {
    const g = gateway();
    const secao = (id: string, x: number) => ({
      id,
      nome: id,
      nomeLadoB: null,
      dividida: false,
      area: { x, y: 5, largura: 6, altura: 2 },
      categoriasLadoA: [],
      categoriasLadoB: [],
    });

    await expect(
      new SalvarMapaDoMercado(g).executar(
        'm1',
        { ...mapaValido, secoes: [secao('a', 5), secao('b', 8)] },
        1,
      ),
    ).rejects.toThrow(/sobreposta/);
    expect(g.salvarMapa).not.toHaveBeenCalled();
  });

  it('envia o mapa com o nome limpo e a versão que o usuário abriu', async () => {
    const g = gateway();

    await new SalvarMapaDoMercado(g).executar('m1', mapaValido, 3);

    expect(g.salvarMapa).toHaveBeenCalledWith(
      'm1',
      { ...mapaValido, nome: 'Central', cidade: 'Araras' },
      3,
    );
  });
});

describe('MarcarItemSemNoMercado', () => {
  it('repassa mercado e sentido ("não encontrei" / desfazer)', async () => {
    const g = { marcarSemNoMercado: jest.fn().mockResolvedValue({}) } as unknown as RotasGateway & {
      marcarSemNoMercado: jest.Mock;
    };

    await new MarcarItemSemNoMercado(g).executar('lista', 'item', 'm1', true);
    await new MarcarItemSemNoMercado(g).executar('lista', 'item', 'm1', false);

    expect(g.marcarSemNoMercado).toHaveBeenNthCalledWith(1, 'lista', 'item', 'm1', true);
    expect(g.marcarSemNoMercado).toHaveBeenNthCalledWith(2, 'lista', 'item', 'm1', false);
  });
});

describe('DefinirLocalDoItem', () => {
  it('envia os locais ao servidor e recusa mais de 5 por mercado', async () => {
    const definirLocalDoItem = jest.fn().mockResolvedValue([]);
    const caso = new DefinirLocalDoItem({ definirLocalDoItem } as unknown as RotasGateway);
    const local = (i: number) => ({ secaoId: `s${i}`, lado: 'A' as const });

    await caso.executar('l1', 'i1', 'm1', [local(1), local(2)]);
    await expect(
      caso.executar('l1', 'i1', 'm1', [1, 2, 3, 4, 5, 6].map(local)),
    ).rejects.toBeInstanceOf(ErroDeApi);

    expect(definirLocalDoItem).toHaveBeenCalledTimes(1);
    expect(definirLocalDoItem).toHaveBeenCalledWith('l1', 'i1', 'm1', [local(1), local(2)]);
  });

  it('lista vazia é válida: apaga o local e a rota volta à categoria', async () => {
    const definirLocalDoItem = jest.fn().mockResolvedValue([]);
    await new DefinirLocalDoItem({ definirLocalDoItem } as unknown as RotasGateway).executar(
      'l1',
      'i1',
      'm1',
      [],
    );
    expect(definirLocalDoItem).toHaveBeenCalledWith('l1', 'i1', 'm1', []);
  });
});
