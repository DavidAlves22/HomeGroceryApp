import type { LocalDoItem, LocalSugerido } from '../../src/domain/entities/mercados';
import {
  localDaSugestao,
  sugestaoDoItem,
  textoDaSugestao,
} from '../../src/domain/services/sugestaoDeLocal';

const sugerido = (itemId: string, grupos = 1): LocalSugerido => ({
  itemId,
  secaoId: `secao-${itemId}`,
  lado: 'B',
  grupos,
});
const proprio = (itemId: string): LocalDoItem => ({ itemId, secaoId: 's', lado: 'A' });

describe('textoDaSugestao', () => {
  it('fala em uma pessoa no singular e em várias no plural, sem dizer quem', () => {
    expect(textoDaSugestao(1)).toBe('Outra pessoa achou aqui');
    expect(textoDaSugestao(2)).toBe('2 pessoas acharam aqui');
    expect(textoDaSugestao(12)).toBe('12 pessoas acharam aqui');
  });

  it('valor inesperado (zero) não vira "0 pessoas"', () => {
    expect(textoDaSugestao(0)).toBe('Outra pessoa achou aqui');
  });
});

describe('sugestaoDoItem', () => {
  it('devolve a sugestão do item', () => {
    expect(sugestaoDoItem('a', [sugerido('a', 3), sugerido('b')], [])?.grupos).toBe(3);
  });

  it('o local que o próprio grupo marcou esconde a sugestão', () => {
    expect(sugestaoDoItem('a', [sugerido('a')], [proprio('a')])).toBeNull();
    expect(sugestaoDoItem('b', [sugerido('b')], [proprio('a')])?.itemId).toBe('b');
  });

  it('servidor sem o recurso (campos ausentes) não quebra', () => {
    expect(sugestaoDoItem('a', undefined, undefined)).toBeNull();
    expect(sugestaoDoItem('a', [], undefined)).toBeNull();
  });
});

describe('localDaSugestao', () => {
  it('grava exatamente a seção e o lado sugeridos', () => {
    expect(localDaSugestao(sugerido('a', 5))).toEqual({ secaoId: 'secao-a', lado: 'B' });
  });
});
