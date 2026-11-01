import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Sessao } from '../../application/dtos/sessao';
import type { ArmazenamentoDeSessao } from '../../application/ports/portas';

const CHAVE = 'homegrocery.sessao';

/**
 * Guarda a sessão no aparelho. No celular nativo usa o cofre seguro do sistema (Keychain/Keystore).
 * Na web (PWA) o cofre não existe, então usa localStorage: o risco aceito é script malicioso na
 * página ler o token, por isso o app não carrega nenhum script de terceiros.
 */
export class ArmazenamentoDeSessaoLocal implements ArmazenamentoDeSessao {
  private cache: Sessao | null | undefined;

  async ler(): Promise<Sessao | null> {
    if (this.cache !== undefined) return this.cache;
    try {
      const bruto =
        Platform.OS === 'web'
          ? globalThis.localStorage?.getItem(CHAVE)
          : await SecureStore.getItemAsync(CHAVE);
      this.cache = bruto ? (JSON.parse(bruto) as Sessao) : null;
    } catch {
      this.cache = null;
    }
    return this.cache;
  }

  async salvar(sessao: Sessao): Promise<void> {
    this.cache = sessao;
    const texto = JSON.stringify(sessao);
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(CHAVE, texto);
    else await SecureStore.setItemAsync(CHAVE, texto);
  }

  async limpar(): Promise<void> {
    this.cache = null;
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(CHAVE);
    else await SecureStore.deleteItemAsync(CHAVE);
  }
}
