import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import { fonte, usePaleta } from '../theme';
import { Botao, Campo, MensagemDeErro, TextoSuave } from './base';
import { Moldura, TituloDaFolha } from './Folhas';

interface Props {
  visivel: boolean;
  /** E-mail da conta: a pessoa precisa digitá-lo para liberar o botão. */
  emailDaConta: string;
  aoConfirmar: (dados: { confirmacaoEmail: string; senha: string }) => Promise<void>;
  aoFechar: () => void;
}

/**
 * Encerrar a conta apaga tudo e não tem volta, então a confirmação é digitada (e-mail, e senha quando a conta tem
 * uma): um toque sem querer ou um aparelho emprestado não bastam.
 */
export function FolhaDeEncerrarConta({ visivel, emailDaConta, aoConfirmar, aoFechar }: Props) {
  const p = usePaleta();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Cada abertura começa limpa: nada digitado antes sobra na tela.
  useEffect(() => {
    if (visivel) {
      setEmail('');
      setSenha('');
      setErro(null);
    }
  }, [visivel]);

  const confere = email.trim().toLowerCase() === emailDaConta.trim().toLowerCase();

  async function confirmar() {
    setErro(null);
    setEnviando(true);
    try {
      await aoConfirmar({ confirmacaoEmail: email.trim(), senha });
    } catch (e) {
      setErro(mensagemParaUsuario(e));
      setEnviando(false);
    }
  }

  return (
    <Moldura visivel={visivel} aoFechar={aoFechar}>
      <TituloDaFolha>Encerrar conta</TituloDaFolha>
      <Text style={{ color: p.alerta, fontSize: fonte.corpo, fontWeight: '700' }}>
        Isto apaga tudo e não tem volta.
      </Text>
      <TextoSuave>
        Somem para sempre a sua conta e o que é só seu: listas, histórico de compras, produtos,
        lista padrão, categorias e mercados com mapa.
      </TextoSuave>
      <TextoSuave>
        Se você está numa família, só sai dela: as listas da família continuam com as outras
        pessoas.
      </TextoSuave>
      <Campo
        rotulo="Digite seu e-mail para confirmar"
        value={email}
        onChangeText={setEmail}
        placeholder={emailDaConta}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <Campo
        rotulo="Senha"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoCapitalize="none"
      />
      <TextoSuave estilo={{ fontSize: fonte.pequena }}>
        Entrou só com o Google e nunca criou uma senha? Deixe a senha em branco.
      </TextoSuave>
      <MensagemDeErro mensagem={erro} />
      <Botao
        titulo="Encerrar conta e apagar tudo"
        variante="perigoCheio"
        desabilitado={!confere}
        carregando={enviando}
        aoPressionar={() => void confirmar()}
      />
      <Botao titulo="Cancelar" variante="texto" aoPressionar={aoFechar} />
    </Moldura>
  );
}
