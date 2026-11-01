import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import { Botao, Campo, MensagemDeErro, TextoSuave, Titulo } from '../components/base';
import { useContainer, useSessao } from '../hooks/AppProviders';
import { espaco, usePaleta } from '../theme';

/** Uma tela só para entrar e criar conta: o usuário alterna sem sair do contexto. */
export function AutenticacaoScreen() {
  const p = usePaleta();
  const { entrarNaConta, cadastrarUsuario } = useContainer();
  const { definirSessao } = useSessao();

  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setErro(null);
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
          <Titulo>HomeGrocery</Titulo>
          <TextoSuave>
            {criando
              ? 'Crie sua conta para organizar as compras da casa.'
              : 'Entre para continuar suas compras.'}
          </TextoSuave>
        </View>

        {criando && <Campo rotulo="Nome" value={nome} onChangeText={setNome} autoComplete="name" />}
        <Campo
          rotulo="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Campo
          rotulo="Senha"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoComplete={criando ? 'new-password' : 'current-password'}
          onSubmitEditing={enviar}
        />
        {criando && (
          <TextoSuave estilo={{ fontSize: 12 }}>
            Mínimo de 8 caracteres, com ao menos um número.
          </TextoSuave>
        )}

        <MensagemDeErro mensagem={erro} />
        <Botao
          titulo={criando ? 'Criar conta' : 'Entrar'}
          aoPressionar={enviar}
          carregando={enviando}
        />
        <Botao
          variante="texto"
          titulo={criando ? 'Já tenho conta' : 'Criar uma conta'}
          aoPressionar={() => {
            setErro(null);
            setCriando(!criando);
          }}
        />
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
