/** O que o QR de uma NFC-e diz: o link do portal da SEFAZ do estado e, dentro dele, a chave de acesso (44 dígitos). */
export interface LinkDaNota {
  link: string;
  /** Chave de acesso, só dígitos. */
  chave: string;
  /** CNPJ do emitente (14 dígitos), tirado da própria chave. */
  cnpj: string;
  uf: string;
  /** Mês de emissão ("outubro de 2026"). */
  mes: string;
}

const UFS: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
};

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Dígito verificador da chave (módulo 11, pesos 2 a 9 da direita para a esquerda): pega QR lido pela metade. */
export function chaveDeAcessoValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(chave[43]);
}

/**
 * Lê o conteúdo de um QR de NFC-e. Só aceita link seguro de um portal do governo (`.gov.br`) com uma chave de acesso
 * válida de nota de consumidor (modelo 65): QR de qualquer outra coisa (ou de um site falso) é recusado, porque o app
 * abre esse link no navegador. Devolve null quando não for uma NFC-e.
 */
export function lerLinkDaNota(conteudo: string): LinkDaNota | null {
  const texto = conteudo.trim();
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.gov.br')) return null;

  const chave = /(?:^|[^\d])(\d{44})(?!\d)/.exec(decodeURIComponent(url.search))?.[1];
  if (!chave || !chaveDeAcessoValida(chave) || chave.slice(20, 22) !== '65') return null;

  const uf = UFS[chave.slice(0, 2)];
  const mesDaNota = Number(chave.slice(4, 6));
  if (!uf || mesDaNota < 1 || mesDaNota > 12) return null;

  return {
    link: texto,
    chave,
    cnpj: chave.slice(6, 20),
    uf,
    mes: `${MESES[mesDaNota - 1]} de ${2000 + Number(chave.slice(2, 4))}`,
  };
}

/** "93209765050998" → "93.209.765/0509-98". */
export function formatarCnpj(digitos: string): string {
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
