import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

registerRootComponent(App);

// Só na web: registra o service worker que guarda o "app shell" para a PWA abrir mais rápido.
// Os dados NUNCA são cacheados: o app é online-only (ver public/service-worker.js).
if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}
