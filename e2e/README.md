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

Outros roteiros (`node e2e/<nome>.js`, também com `DARK=1`): `ajustes`, `divisao`, `mercados`, `familia`, `zoom`, `pedidos` e `comunidade` (este pede a API com `Locais__LimiteDeGrupos=1000000`). Suba a API com `Seguranca__TentativasDeAutenticacaoPorMinuto=100000`.

`avisos.js` testa o push de verdade (o Chrome assina no serviço de push do Google, então precisa de internet): suba a API com um par de chaves de teste em `Push__ChavePublica`, `Push__ChavePrivada` e `Push__Assunto` (nunca as de produção) e deixe o contêiner `homegroceryapi-banco-1` no ar (o teste confere a tabela `assinaturas_de_push`).
