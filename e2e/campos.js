// Ajudas de navegador para o formulário de produto: listas suspensas (unidade, categoria) e o teclado numérico do app.
// Telas anteriores continuam montadas no DOM, então sempre se usa o último elemento que casa.
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function clicarUltimo(page, seletor) {
  await page.waitForSelector(seletor, { timeout: 10000 });
  const alvos = await page.$$(seletor);
  await alvos[alvos.length - 1].click();
  await pausa(300);
}

/** Abre a lista suspensa ("Unidade", "Categoria") e escolhe a opção pelo texto. */
async function escolherNoCombo(page, combo, opcao) {
  await clicarUltimo(page, `[aria-label^="${combo}:"]`);
  await clicarUltimo(page, `xpath/.//*[normalize-space(text())="${opcao}"]`);
}

async function apertar(page, teclas) {
  for (const tecla of teclas) await clicarUltimo(page, `[aria-label="${tecla}"]`);
}

/** Abre o teclado do campo (pelo rótulo), digita e conclui. `dinheiro`: só os dígitos (a vírgula é fixa). */
async function preencher(page, rotulo, digitos) {
  await clicarUltimo(page, `[aria-label^="${rotulo},"]`);
  await apertar(page, digitos);
  await clicarUltimo(page, 'xpath/.//*[normalize-space(text())="Concluído"]');
  await pausa(300);
}

/** Preço: "24,00" aperta 2-4-0-0 (o teclado de dinheiro digita da direita para a esquerda). */
const preencherDinheiro = (page, rotulo, valor) =>
  preencher(page, rotulo, [...valor.replace(/\D/g, '')].map((d) => `Tecla ${d}`));

/** Quantidade: "1,5" aperta 1, vírgula, 5. */
const preencherQuantidade = (page, rotulo, valor) =>
  preencher(page, rotulo, [...valor].map((c) => (c === ',' ? 'Tecla vírgula' : `Tecla ${c}`)));

module.exports = { escolherNoCombo, preencherDinheiro, preencherQuantidade };
