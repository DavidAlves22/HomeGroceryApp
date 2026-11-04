import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import { useContainer, useSessao } from '../hooks/AppProviders';
import { espaco } from '../theme';
import { MensagemDeErro, TextoSuave } from './base';

/**
 * "Entrar com Google": o botão oficial do Google (a imagem e o clique são dele, por exigência do Google) aparece só se
 * o servidor tiver o Client ID configurado. Quem escolhe a conta recebe um ID token, que o servidor confere.
 */
export function BotaoGoogle({ aoErro }: { aoErro?: (mensagem: string | null) => void }) {
  const { consultarLoginComGoogle, entrarComGoogle, botaoDeLoginGoogle } = useContainer();
  const { definirSessao } = useSessao();
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [elemento, setElemento] = useState<unknown>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!botaoDeLoginGoogle.suportado()) return;
    void consultarLoginComGoogle.executar().then(setClienteId);
  }, [botaoDeLoginGoogle, consultarLoginComGoogle]);

  useEffect(() => {
    if (!clienteId || !elemento) return;
    let ativo = true;
    let remover: (() => void) | null = null;
    void botaoDeLoginGoogle
      .montar(
        elemento,
        clienteId,
        320,
        async (idToken) => {
          setErro(null);
          aoErro?.(null);
          try {
            definirSessao(await entrarComGoogle.executar(idToken));
          } catch (e) {
            const mensagem = mensagemParaUsuario(e);
            setErro(mensagem);
            aoErro?.(mensagem);
          }
        },
        (mensagem) => ativo && setErro(mensagem),
      )
      .then((limpar) => {
        if (ativo) remover = limpar;
        else limpar();
      });
    return () => {
      ativo = false;
      remover?.();
    };
    // definirSessao/aoErro mudam a cada renderização; o botão só é montado de novo se o Client ID ou o elemento mudarem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, elemento, botaoDeLoginGoogle, entrarComGoogle]);

  if (!clienteId) return null;

  return (
    <View style={{ alignItems: 'center', gap: espaco.sm }}>
      <TextoSuave estilo={{ fontSize: 12 }}>ou</TextoSuave>
      {React.createElement('div', {
        ref: setElemento,
        'data-testid': 'botao-google',
        style: { minHeight: 44 },
      })}
      <MensagemDeErro mensagem={erro} />
    </View>
  );
}
