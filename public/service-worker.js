// Cache do "app shell" do HomeGrocery (PWA).
//
// O app é online-only: DADOS NUNCA entram no cache. Só arquivos estáticos do próprio site
// (HTML, JS, ícones) são guardados, e apenas para a PWA abrir mais rápido. Chamadas à API
// (outra origem) passam direto para a rede, sem interceptação.
const CACHE_NAME = 'homegrocery-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(event.request)),
  );
});

// Avisos (Web Push): o servidor manda { titulo, corpo, url, tag } quando alguém da família pede um item ou finaliza a compra.
// Com o app aberto e visível, quem avisa é o próprio app (toast), então aqui não repetimos.
self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { corpo: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      if (janelas.some((j) => j.visibilityState === 'visible')) return undefined;
      return self.registration.showNotification(dados.titulo || 'HomeGrocery', {
        body: dados.corpo || '',
        tag: dados.tag || undefined,
        renotify: !!dados.tag,
        icon: '/icon.png',
        badge: '/icon.png',
        data: { url: dados.url || '/' },
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => 'focus' in j);
      if (aberta) {
        if ('navigate' in aberta) aberta.navigate(url).catch(() => {});
        return aberta.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
