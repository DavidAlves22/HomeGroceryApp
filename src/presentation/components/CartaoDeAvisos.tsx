import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type { EstadoDosAvisos } from '../../application/useCases/notificacoes';
import { useContainer } from '../hooks/AppProviders';
import { useToast } from '../hooks/Toast';
import { espaco, fonte, usePaleta } from '../theme';
import { Botao, Cartao, TextoSuave } from './base';

/**
 * Liga ou desliga os avisos neste aparelho ("Ana pediu um item", "compra finalizada") mesmo com o app fechado.
 * Não aparece onde não há como avisar (app nativo, navegador sem suporte ou servidor sem os avisos ligados).
 */
export function CartaoDeAvisos() {
  const p = usePaleta();
  const container = useContainer();
  const toast = useToast();
  const [estado, setEstado] = useState<EstadoDosAvisos | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setEstado(await container.obterEstadoDosAvisos.executar());
    } catch {
      setEstado('indisponivel');
    }
  }, [container]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (estado === null || estado === 'indisponivel') return null;

  async function alternar() {
    setOcupado(true);
    try {
      const novo =
        estado === 'ligado'
          ? await container.desligarAvisos.executar()
          : await container.ligarAvisos.executar();
      setEstado(novo);
      if (novo === 'ligado') toast('Avisos ligados neste aparelho');
      if (novo === 'bloqueado')
        toast('Permissão negada. Libere as notificações nas configurações do navegador.');
    } catch (e) {
      toast(mensagemParaUsuario(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Cartao estilo={{ gap: espaco.sm }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}>
          Avisos neste aparelho
        </Text>
        <TextoSuave>
          {estado === 'ligado'
            ? 'Você recebe um aviso quando alguém da família pede um item ou finaliza a compra, mesmo com o app fechado.'
            : estado === 'bloqueado'
              ? 'As notificações estão bloqueadas neste navegador. Libere nas configurações do site para receber os avisos.'
              : 'Receba um aviso quando alguém da família pedir um item ou finalizar a compra, mesmo com o app fechado.'}
        </TextoSuave>
      </View>
      {estado !== 'bloqueado' && (
        <Botao
          titulo={estado === 'ligado' ? 'Desligar avisos' : 'Ligar avisos'}
          variante={estado === 'ligado' ? 'secundario' : 'principal'}
          carregando={ocupado}
          aoPressionar={() => void alternar()}
        />
      )}
    </Cartao>
  );
}
