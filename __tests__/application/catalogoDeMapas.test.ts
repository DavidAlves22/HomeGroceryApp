import type {
  MapasCompartilhadosGateway,
  MercadosGateway,
} from '../../src/application/ports/mercados';
import {
  CopiarMapaCompartilhado,
  ListarMapasCompartilhados,
  ObterMapaCompartilhado,
} from '../../src/application/useCases/mercados';

const gateway = () =>
  ({
    listar: jest.fn().mockResolvedValue([]),
    obter: jest.fn().mockResolvedValue({ id: 'm1' }),
    copiar: jest.fn().mockResolvedValue({ id: 'novo' }),
  }) as unknown as MapasCompartilhadosGateway & Record<string, jest.Mock>;

describe('mapas compartilhados', () => {
  it('a busca vai sem espaços nas pontas (a API filtra pelo nome)', async () => {
    const g = gateway();
    await new ListarMapasCompartilhados(g).executar('  Favetta ', ' Araras ');
    expect(g.listar).toHaveBeenCalledWith('Favetta', 'Araras');
  });

  it('obter e copiar repassam o id; copiar devolve o mercado novo do grupo', async () => {
    const g = gateway();
    await new ObterMapaCompartilhado(g).executar('m1');
    expect(g.obter).toHaveBeenCalledWith('m1');

    const novo = await new CopiarMapaCompartilhado(g).executar('m1');
    expect(g.copiar).toHaveBeenCalledWith('m1');
    expect(novo.id).toBe('novo');
  });
});
