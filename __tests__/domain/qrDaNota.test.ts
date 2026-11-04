import {
  chaveDeAcessoValida,
  formatarCnpj,
  lerLinkDaNota,
} from '../../src/domain/services/qrDaNota';

// QR de uma nota real do WMS (Araras, SP).
const CHAVE = '35261093209765050998655340000029561048579171';
const LINK = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${CHAVE}|2|1|1|7542552EB9442466883AA1E443481D0B2F0A8BFD`;

describe('chaveDeAcessoValida', () => {
  it('confere o dígito verificador', () => {
    expect(chaveDeAcessoValida(CHAVE)).toBe(true);
    expect(chaveDeAcessoValida(CHAVE.slice(0, 43) + '2')).toBe(false);
    expect(chaveDeAcessoValida('123')).toBe(false);
  });
});

describe('lerLinkDaNota', () => {
  it('lê o link do QR da nota: chave, CNPJ, estado e mês', () => {
    expect(lerLinkDaNota(LINK)).toEqual({
      link: LINK,
      chave: CHAVE,
      cnpj: '93209765050998',
      uf: 'SP',
      mes: 'outubro de 2026',
    });
  });

  it('aceita o link com a chave codificada e espaços em volta', () => {
    expect(lerLinkDaNota(`  ${LINK.replace(/\|/g, '%7C')}\n`)?.chave).toBe(CHAVE);
  });

  it('aceita o formato de outros estados (chNFe=)', () => {
    const outro = `https://www.nfce.sefaz.mg.gov.br/portalnfce/sistema/qrcode.xhtml?chNFe=${CHAVE}&nVersao=100`;
    expect(lerLinkDaNota(outro)?.cnpj).toBe('93209765050998');
  });

  it('recusa o que não é uma NFC-e: site que não é do governo, http, QR sem chave, chave inválida e NF-e', () => {
    expect(
      lerLinkDaNota(LINK.replace('nfce.fazenda.sp.gov.br', 'nfce-sefaz.exemplo.com')),
    ).toBeNull();
    expect(lerLinkDaNota(LINK.replace('https:', 'http:'))).toBeNull();
    expect(lerLinkDaNota('https://www.nfce.fazenda.sp.gov.br/qrcode?p=123')).toBeNull();
    expect(lerLinkDaNota(LINK.replace(CHAVE, CHAVE.slice(0, 43) + '2'))).toBeNull();
    expect(lerLinkDaNota('texto qualquer')).toBeNull();
    expect(lerLinkDaNota('https://exemplo.gov.br/')).toBeNull();
  });
});

describe('formatarCnpj', () => {
  it('põe a pontuação', () => {
    expect(formatarCnpj('93209765050998')).toBe('93.209.765/0509-98');
  });
});
