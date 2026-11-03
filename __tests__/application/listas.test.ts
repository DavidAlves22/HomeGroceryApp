import { ErroDeApi } from '../../src/application/errors';
import type { CatalogoGateway, ListasGateway } from '../../src/application/ports/catalogo';
import {
  AdicionarItemAoModelo,
  BuscarProdutos,
  validarDadosDoItem,
} from '../../src/application/useCases/catalogo';
import {
  CancelarLista,
  CriarLista,
  ListaPrincipalJaExiste,
  ObterListaAtual,
} from '../../src/application/useCases/listas';
import type { ListaResumo } from '../../src/domain/entities/tipos';
import { Competencia } from '../../src/domain/valueObjects/Competencia';

const resumo = (sobrescritas: Partial<ListaResumo> = {}): ListaResumo => ({
  id: 'l1',
  competencia: '2026-11',
  competenciaNome: 'Novembro de 2026',
  nome: 'Novembro',
  principal: true,
  status: 'EmAndamento',
  finalizadaEm: null,
  totalDeItens: 0,
  comprados: 0,
  percentual: 0,
  totalEstimado: 0,
  totalRealizado: 0,
  ...sobrescritas,
});

function gatewayDeListas(existentes: ListaResumo[] = []) {
  return {
    listar: jest.fn().mockResolvedValue(existentes),
    obter: jest.fn().mockResolvedValue({ resumo: existentes[0], itens: [], divisao: [] }),
    criar: jest.fn().mockResolvedValue({ resumo: resumo(), itens: [], divisao: [] }),
  } as unknown as ListasGateway & { criar: jest.Mock; obter: jest.Mock };
}

describe('CriarLista', () => {
  it('avisa quando já existe a lista principal do mês, sem chamar a API de criação', async () => {
    const gateway = gatewayDeListas([resumo()]);

    await expect(
      new CriarLista(gateway).executar({ competencia: '2026-11', origem: 'Padrao' }),
    ).rejects.toBeInstanceOf(ListaPrincipalJaExiste);
    expect(gateway.criar).not.toHaveBeenCalled();
  });

  it('com confirmação explícita cria a segunda lista do mês', async () => {
    const gateway = gatewayDeListas([resumo()]);

    await new CriarLista(gateway).executar({
      competencia: '2026-11',
      origem: 'Zero',
      permitirDuplicada: true,
    });

    expect(gateway.criar).toHaveBeenCalledTimes(1);
  });

  it('cria normalmente em um mês sem lista', async () => {
    const gateway = gatewayDeListas([resumo()]);

    await new CriarLista(gateway).executar({ competencia: '2026-12', origem: 'Padrao' });

    expect(gateway.criar).toHaveBeenCalledWith({ competencia: '2026-12', origem: 'Padrao' });
  });

  it('copiar exige a lista de origem e ao menos um produto', async () => {
    const gateway = gatewayDeListas();
    await expect(
      new CriarLista(gateway).executar({ competencia: '2026-12', origem: 'Copiar' }),
    ).rejects.toThrow('Escolha a lista que será copiada');
    await expect(
      new CriarLista(gateway).executar({
        competencia: '2026-12',
        origem: 'Copiar',
        listaDeOrigemId: 'l9',
        itensDeOrigemIds: [],
      }),
    ).rejects.toThrow('Selecione ao menos um produto');
    expect(gateway.criar).not.toHaveBeenCalled();
  });

  it('copiar envia a origem e os itens escolhidos', async () => {
    const gateway = gatewayDeListas();
    const dados = {
      competencia: '2026-12',
      origem: 'Copiar' as const,
      listaDeOrigemId: 'l9',
      itensDeOrigemIds: ['a', 'b'],
    };
    await new CriarLista(gateway).executar(dados);
    expect(gateway.criar).toHaveBeenCalledWith(dados);
  });

  it('recusa competência inválida e seleção vazia da lista padrão', async () => {
    const gateway = gatewayDeListas();
    await expect(
      new CriarLista(gateway).executar({ competencia: '2026-13', origem: 'Zero' }),
    ).rejects.toThrow();
    await expect(
      new CriarLista(gateway).executar({
        competencia: '2026-12',
        origem: 'Padrao',
        itensDoModeloIds: [],
      }),
    ).rejects.toThrow('Selecione ao menos um produto');
  });
});

describe('ObterListaAtual', () => {
  it('carrega a lista escolhida ou devolve null quando não há nenhuma', async () => {
    const com = gatewayDeListas([resumo()]);
    expect(await new ObterListaAtual(com).executar(Competencia.deChave('2026-11'))).not.toBeNull();
    expect(com.obter).toHaveBeenCalledWith('l1');

    const sem = gatewayDeListas([]);
    expect(await new ObterListaAtual(sem).executar(Competencia.deChave('2026-11'))).toBeNull();
  });
});

describe('validação de itens e produtos', () => {
  const valido = { nome: ' Arroz ', categoriaId: 'c1', unidade: 'Pacote', quantidade: 2 } as const;

  it('apara o nome e aceita dados válidos', () => {
    expect(validarDadosDoItem(valido).nome).toBe('Arroz');
  });

  it.each([
    [{ ...valido, nome: '  ' }, 'Informe o nome'],
    [{ ...valido, categoriaId: '' }, 'Escolha uma categoria'],
    [{ ...valido, quantidade: 0 }, 'maior que zero'],
    [{ ...valido, nome: 'a'.repeat(121) }, '120 caracteres'],
  ])('recusa dados inválidos', (dados, mensagem) => {
    expect(() => validarDadosDoItem(dados)).toThrow(mensagem);
    expect(() => validarDadosDoItem(dados)).toThrow(ErroDeApi);
  });

  it('não chama a API se o item é inválido', async () => {
    const gateway = { adicionarItemAoModelo: jest.fn() } as unknown as CatalogoGateway;
    await expect(
      new AdicionarItemAoModelo(gateway).executar({ ...valido, quantidade: -1 }),
    ).rejects.toThrow();
    expect(gateway.adicionarItemAoModelo).not.toHaveBeenCalled();
  });

  it('só busca produtos com 2 ou mais letras', async () => {
    const gateway = {
      buscarProdutos: jest.fn().mockResolvedValue([]),
    } as unknown as CatalogoGateway;
    const caso = new BuscarProdutos(gateway);

    expect(await caso.executar('a')).toEqual([]);
    expect(gateway.buscarProdutos).not.toHaveBeenCalled();
    await caso.executar(' ar ');
    expect(gateway.buscarProdutos).toHaveBeenCalledWith('ar');
  });
});

describe('CancelarLista', () => {
  it('pede ao servidor para apagar a lista informada', async () => {
    const gateway = {
      cancelar: jest.fn().mockResolvedValue(undefined),
    } as unknown as ListasGateway;
    await new CancelarLista(gateway).executar('l1');
    expect(gateway.cancelar).toHaveBeenCalledWith('l1');
  });
});
