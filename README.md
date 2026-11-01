# HomeGrocery App

Aplicativo (PWA) para organizar as compras mensais de supermercado: lista padrão reutilizável, listas por mês, histórico, controle de gastos e compartilhamento familiar.

## Rodando

```
npm install
npm run web
```

A API precisa estar no ar (veja o repositório `HomeGroceryApi`). Para apontar para outra URL: `EXPO_PUBLIC_API_URL=https://... npm run web`.

## Qualidade

`npm test`, `npm run typecheck`, `npm run lint`.

## Publicação

`npm run build:web` e `npx vercel dist --prod --yes`. Defina `EXPO_PUBLIC_API_URL` no build para a URL da API em produção.
