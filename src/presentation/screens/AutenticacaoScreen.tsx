import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import { BotaoGoogle } from '../components/BotaoGoogle';
import { Botao, Campo, MensagemDeErro, TextoSuave, Titulo } from '../components/base';
import { useContainer, useSessao } from '../hooks/AppProviders';
import { espaco, usePaleta } from '../theme';

/** Uma tela só para entrar e criar conta: o usuário alterna sem sair do contexto. */
export function AutenticacaoScreen() {
  const p = usePaleta();
  const {
    entrarNaConta,
    cadastrarUsuario,
    consultarRecuperacaoDeSenha,
    pedirCodigoDeRecuperacao,
    redefinirSenha,
  } = useContainer();
  const { definirSessao } = useSessao();

  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Recuperação: null = não está recuperando; 'email' = pede o código; 'codigo' = digita código + senha nova.
  const [etapa, setEtapa] = useState<null | 'email' | 'codigo'>(null);
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [recuperacaoDisponivel, setRecuperacaoDisponivel] = useState(false);

  useEffect(() => {
    consultarRecuperacaoDeSenha.executar().then(setRecuperacaoDisponivel);
  }, [consultarRecuperacaoDeSenha]);

  function sairDaRecuperacao() {
    setEtapa(null);
    setCodigo('');
    setSenha('');
    setErro(null);
  }

  async function pedirCodigo() {
    setErro(null);
    setAviso(null);
    setEnviando(true);
    try {
      await pedirCodigoDeRecuperacao.executar(email);
      setEtapa('codigo');
      setAviso('Se este e-mail tiver conta, enviamos um código de 6 dígitos. Vale por 15 minutos.');
    } catch (e) {
      setErro(mensagemParaUsuario(e));
    } finally {
      setEnviando(false);
    }
  }

  async function redefinir() {
    setErro(null);
    setEnviando(true);
    try {
      await redefinirSenha.executar({ email, codigo, novaSenha: senha });
      sairDaRecuperacao();
      setAviso('Senha alterada. Entre com a nova senha.');
    } catch (e) {
      setErro(mensagemParaUsuario(e));
    } finally {
      setEnviando(false);
    }
  }

  async function enviar() {
    setErro(null);
    setAviso(null);
    setEnviando(true);
    try {
      const sessao = criando
        ? await cadastrarUsuario.executar({ nome, email, senha })
        : await entrarNaConta.executar({ email, senha });
      definirSessao(sessao);
    } catch (e) {
      setErro(mensagemParaUsuario(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.fundo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <View style={estilos.cartaz}>
          <Titulo>Home Grocery</Titulo>
          <TextoSuave>
            {etapa
              ? 'Recupere o acesso com um código enviado por e-mail.'
              : criando
                ? 'Crie sua conta para organizar as compras da casa.'
                : 'Entre para continuar suas compras.'}
          </TextoSuave>
        </View>

        {!etapa && criando && (
          <Campo rotulo="Nome" value={nome} onChangeText={setNome} autoComplete="name" />
        )}
        <Campo
          rotulo="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={etapa !== 'codigo'}
        />
        {etapa === 'codigo' && (
          <Campo
            rotulo="Código de 6 dígitos"
            value={codigo}
            onChangeText={setCodigo}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
          />
        )}
        {etapa !== 'email' && (
          <Campo
            rotulo={etapa ? 'Nova senha' : 'Senha'}
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoComplete={criando || etapa ? 'new-password' : 'current-password'}
            onSubmitEditing={etapa ? redefinir : enviar}
          />
        )}
        {!criando && !etapa && recuperacaoDisponivel && (
          <Botao
            variante="texto"
            titulo="Esqueci minha senha"
            estilo={{
              alignSelf: 'flex-start',
              minHeight: 32,
              paddingHorizontal: 0,
              marginTop: -espaco.sm,
            }}
            aoPressionar={() => {
              setErro(null);
              setAviso(null);
              setEtapa('email');
            }}
          />
        )}
        {(criando || etapa === 'codigo') && (
          <TextoSuave estilo={{ fontSize: 12 }}>
            Mínimo de 8 caracteres, com ao menos um número.
          </TextoSuave>
        )}

        {aviso && <TextoSuave estilo={{ fontSize: 13 }}>{aviso}</TextoSuave>}
        <MensagemDeErro mensagem={erro} />
        {etapa === 'email' && (
          <Botao titulo="Enviar código" aoPressionar={pedirCodigo} carregando={enviando} />
        )}
        {etapa === 'codigo' && (
          <>
            <Botao titulo="Redefinir senha" aoPressionar={redefinir} carregando={enviando} />
            <Botao variante="texto" titulo="Reenviar código" aoPressionar={pedirCodigo} />
          </>
        )}
        {etapa && (
          <Botao variante="texto" titulo="Voltar ao login" aoPressionar={sairDaRecuperacao} />
        )}
        {!etapa && (
          <>
            <Botao
              titulo={criando ? 'Criar conta' : 'Entrar'}
              aoPressionar={enviar}
              carregando={enviando}
            />
            <BotaoGoogle />
            <Botao
              variante="texto"
              titulo={criando ? 'Já tenho conta' : 'Criar uma conta'}
              aoPressionar={() => {
                setErro(null);
                setAviso(null);
                setCriando(!criando);
              }}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: espaco.lg,
    padding: espaco.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  cartaz: { gap: espaco.sm, marginBottom: espaco.md },
});
