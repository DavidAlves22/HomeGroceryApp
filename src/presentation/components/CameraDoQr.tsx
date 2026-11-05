import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { espaco, fonte, raio, usePaleta } from '../theme';
import { Botao, TextoSuave } from './base';
import { Moldura, TituloDaFolha } from './Folhas';
import { useContainer } from '../hooks/AppProviders';

interface Props {
  visivel: boolean;
  /** Recebe cada QR lido; devolva `true` para encerrar a leitura (QR aceito) e `false` para continuar procurando. */
  aoLer: (texto: string) => boolean;
  aoFechar: () => void;
}

/** Folha com a câmera traseira para ler o QR code da nota. Só na PWA (no navegador). */
export function CameraDoQr({ visivel, aoLer, aoFechar }: Props) {
  const p = usePaleta();
  const { leitorDeQr } = useContainer();
  const [video, setVideo] = useState<unknown>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    if (!visivel || !video) return;
    setMensagem(null);
    let ativo = true;
    let parar: (() => void) | null = null;
    void leitorDeQr
      .iniciar(
        video,
        (texto) => {
          if (!ativo) return false;
          const aceito = aoLer(texto);
          if (aceito) aoFechar();
          return aceito;
        },
        (erro) => ativo && setMensagem(erro),
      )
      .then((desligar) => {
        if (ativo) parar = desligar;
        else desligar();
      });
    return () => {
      ativo = false;
      parar?.();
    };
    // `aoLer` e `aoFechar` mudam a cada renderização da tela; a câmera só reinicia ao abrir/fechar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, video, leitorDeQr]);

  return (
    <Moldura visivel={visivel} aoFechar={aoFechar}>
      <TituloDaFolha>Aponte para o QR da nota</TituloDaFolha>
      <TextoSuave>Deixe o QR code do cupom inteiro na imagem. A leitura é automática.</TextoSuave>
      <View
        style={{
          width: '100%',
          aspectRatio: 1,
          borderRadius: raio.md,
          overflow: 'hidden',
          backgroundColor: '#000',
        }}
      >
        {React.createElement('video', {
          ref: setVideo,
          muted: true,
          playsInline: true,
          autoPlay: true,
          'aria-label': 'Imagem da câmera',
          style: { width: '100%', height: '100%', objectFit: 'cover' },
        })}
        {mensagem && (
          <View
            style={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              padding: espaco.lg,
              backgroundColor: p.superficie,
            }}
          >
            <Text
              style={{
                color: p.alerta,
                fontSize: fonte.corpo,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {mensagem}
            </Text>
          </View>
        )}
      </View>
      <Botao titulo="Cancelar" variante="secundario" aoPressionar={aoFechar} />
    </Moldura>
  );
}
