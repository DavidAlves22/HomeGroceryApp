import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { espaco, raio, usePaleta } from '../theme';

const ToastContexto = createContext<(mensagem: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContexto);
}

/** Aviso rápido que some sozinho (confirmações e erros leves). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const p = usePaleta();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrar = useCallback((texto: string) => {
    setMensagem(texto);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setMensagem(null), 3000);
  }, []);

  return (
    <ToastContexto.Provider value={mostrar}>
      {children}
      {mensagem && (
        <View pointerEvents="none" style={estilos.area}>
          <View
            accessibilityLiveRegion="polite"
            style={[estilos.toast, { backgroundColor: p.texto }]}
          >
            <Text style={{ color: p.fundo, fontWeight: '600' }}>{mensagem}</Text>
          </View>
        </View>
      )}
    </ToastContexto.Provider>
  );
}

const estilos = StyleSheet.create({
  area: {
    position: 'absolute',
    left: espaco.lg,
    right: espaco.lg,
    bottom: 96,
    alignItems: 'center',
  },
  toast: {
    maxWidth: 520,
    paddingHorizontal: espaco.lg,
    paddingVertical: espaco.md,
    borderRadius: raio.md,
  },
});
