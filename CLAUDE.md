# HomeGrocery App — CLAUDE.md

PWA (Expo web + React Native) de compras de supermercado. **Online-only**: o servidor (`HomeGroceryApi`) é a fonte da verdade; o app não tem banco local nem fila offline. Hospedado na Vercel.

## Comandos

```
npm run web          # desenvolvimento no navegador (API em EXPO_PUBLIC_API_URL, padrão http://localhost:5272)
npm test             # Jest (rodar antes de dar algo por pronto)
npm run typecheck && npm run lint
npm run build:web    # gera dist/ (corrige o problema do node_modules na Vercel)
npx vercel dist --prod --yes   # publicar
```

## Camadas (`src/`) e regra de dependência

- **domain/** — value objects (`Dinheiro` em centavos inteiros, `Competencia` AAAA-MM) e regras puras. Sem React/Expo.
- **application/** — casos de uso (uma classe por operação), portas (`ports/`), DTOs, `ErroDeApi`. Sem framework.
- **infrastructure/** — `ClienteHttp` (token, renovação única em 401, timeout, erros amigáveis), gateways HTTP, armazenamento da sessão.
- **presentation/** — telas, componentes, hooks, tema. **Não importa `infrastructure/`** (ESLint barra): recebe casos de uso pelo container.
- **di/container.ts** — único lugar que conhece as implementações concretas.

## Regras do produto que afetam o código

- Ao abrir e ao voltar ao primeiro plano: health check (`GET /saude`). Sem resposta → `ConexaoScreen` bloqueante; só segue quando o servidor responder. Servidor "acordando" (hospedagem gratuita) tem mensagem própria.
- Sessão: JWT de acesso (30 min) + token de renovação com rotação. `RestaurarSessao` só apaga a sessão se o servidor a recusar (401); falha de rede preserva.
- Valores monetários sempre em centavos (`Dinheiro`); nunca `number` com casas decimais.
- Service worker guarda só o app shell; **dados nunca vão para o cache**.
- Sem scripts de terceiros (o token fica em localStorage na web).

## Convenções

Nomes em português; comentários explicam o porquê; Prettier (`.prettierrc.json`); testes em `__tests__/` espelhando `src/`; cobertura em domain/application/http.

## Fase 1 (MVP) — o que existe
- Telas: Início, Lista (do momento), Histórico, Mais (+ Nova lista, Lista padrão, Categorias, Detalhe de lista). Navegação em `presentation/navigation`.
- `domain/services/organizacao.ts`: busca (sem acento), filtro, ordenação, progresso e "qual é a lista atual". Regra pura, testada sem celular.
- Marcar comprado é **otimista** (a tela responde ao toque e desfaz se o servidor recusar). Edição usa a `versao` do item: conflito vira aviso e recarrega.
- Lista finalizada abre em somente leitura; "Reabrir" libera edição. Exclusões pedem segundo toque.
- Casos de uso que validam são `async` (sempre devolvem Promise rejeitada, nunca lançam de forma síncrona).
- Teste de navegador: `e2e/` (ver `e2e/README.md`). Rodar após mudanças de tela ou de contrato com a API.

## Fase 2 (financeiro) — o que existe
- `domain/services/financeiro.ts`: `calcularTotais` recalcula estimado/gasto/restante no aparelho (a tela atualiza na hora ao marcar um item). Espelha `CalculoDeTotais` da API; os testes usam os mesmos números dos testes da API (ex.: R$ 101,00). `Dinheiro.vezes` usa milésimos inteiros para dar o mesmo centavo do servidor.
- Só preço **pago** de item **comprado** vira gasto; estimado é referência. Item comprado sem preço pago é sinalizado ("o gasto real pode ser maior").
- Aba Análises (`AnalisesScreen`): barras do gasto mensal (toque escolhe o mês das categorias), tabela de variação, categorias, mais comprados, evolução de preço por produto e maiores aumentos. Gráficos em `components/graficos.tsx` (SVG/Views, um só tom, tabela de valores abaixo para acessibilidade; variação sempre com seta e sinal, nunca só cor).
- Formatador pt-BR coloca espaço não separável depois de "R$": em testes de navegador normalize ` `.
