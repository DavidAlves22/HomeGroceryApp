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
