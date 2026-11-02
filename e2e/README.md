# Teste de ponta a ponta (navegador)

Dirige o Chrome contra a PWA compilada e a API real: cadastro, lista padrão, nova lista, marcar comprado,
lista principal duplicada, finalizar, histórico e categorias. Roda em tema claro e escuro (`DARK=1`).

```
docker compose up -d banco                     # no repositório da API
dotnet run --project HomeGroceryApi.API        # com Cors__OrigensPermitidas__2=http://localhost:8090
npm run build:web
node e2e/servir.js dist                        # serve a PWA em 8090
npm i --no-save puppeteer-core
node e2e/fluxo.js                              # capturas de tela em e2e/capturas/
```
Variáveis: `BASE_URL` (padrão http://localhost:8090) e `CHROME_PATH`.
