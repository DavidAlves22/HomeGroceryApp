import type { CatalogoGateway } from '../../src/application/ports/catalogo';
import { BuscarNomesComuns } from '../../src/application/useCases/catalogo';
import type { NomeComum } from '../../src/domain/entities/tipos';

const comum = (nome: string): NomeComum => ({
  nome,
  categoria: 'Laticínios',
  unidadePadrao: 'Litro',
  grupos: 2,
});

describe('BuscarNomesComuns', () => {
  it('com menos de 2 letras nem chama o servidor', async () => {
    const buscarNomesComuns = jest.fn().mockResolvedValue([comum('Leite')]);
    const caso = new BuscarNomesComuns({ buscarNomesComuns } as unknown as CatalogoGateway);

    expect(await caso.executar('l')).toEqual([]);
    expect(await caso.executar('  ')).toEqual([]);
    expect(buscarNomesComuns).not.toHaveBeenCalled();
  });

  it('repassa o termo sem espaços nas pontas e devolve o que o servidor achou', async () => {
    const buscarNomesComuns = jest.fn().mockResolvedValue([comum('Leite caixinha')]);
    const caso = new BuscarNomesComuns({ buscarNomesComuns } as unknown as CatalogoGateway);

    expect(await caso.executar('  leit ')).toEqual([comum('Leite caixinha')]);
    expect(buscarNomesComuns).toHaveBeenCalledWith('leit');
  });

  it('falha de rede vira lista vazia e nunca atrapalha a digitação', async () => {
    const buscarNomesComuns = jest.fn().mockRejectedValue(new Error('sem rede'));
    const caso = new BuscarNomesComuns({ buscarNomesComuns } as unknown as CatalogoGateway);

    await expect(caso.executar('leite')).resolves.toEqual([]);
  });
});
