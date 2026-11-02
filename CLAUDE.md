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

## Fase 3 (experiência avançada) — o que existe
- **Copiar de outro mês** (`NovaListaScreen`, origem `Copiar`): escolhe QUALQUER lista do grupo e quais produtos levar. Tudo volta pendente; o preço pago antes aparece só como "antes R$ x" (referência) e nunca soma no gasto do novo mês. `CriarLista` valida origem e seleção antes de chamar a API.
- **Ordem manual**: ordenação "Minha ordem" com botões subir/descer (otimista, com rollback), só com a lista inteira na tela (sem busca/filtro). Cópias preservam a ordem.
- **Filtro por categoria** na lista (chips rolando na horizontal), combinável com busca e status (`organizarItens`).
- **Favoritos e recorrentes**: tela Produtos (Mais) marca favoritos, renomeia e exclui; o formulário de novo produto sugere favoritos/recorrentes (comprados em 2+ listas) quando o nome está vazio.

## Fase 4 (família e tempo real) — o que existe
- **Grupo familiar** (Mais → Grupo familiar): membros e papéis, gerar código de convite (admin), entrar com código, sair, remover membro (admin, com confirmação), renomear. Entrar/sair devolve uma sessão NOVA, guardada por `EntrarEmGrupo`/`SairDoGrupo`; `definirSessao` troca o grupo e o `key={sessao.grupoId}` em `App.tsx` refaz telas, dados e conexão.
- **Tempo real** (`TempoRealProvider` + `useAoReceberEvento`): conexão SignalR por grupo, reconexão automática; ao reconectar manda `reconectado` e tudo recarrega. `useCarregar` assina sozinho os eventos certos pela `chave` (lista/catálogo/membros), junta rajadas (250 ms) e ignora eventos do próprio usuário. Evento `grupoAlterado` (removido/entrou em outro aparelho) faz o app renovar a sessão.
- Indicador "Ao vivo / Reconectando..." (`IndicadorDeSincronizacao`) escrito, não só colorido. Itens mostram "Ana marcou" (nomes vêm de `GET /grupo`).
- Online-only continua: sem conexão em tempo real o app funciona normalmente pela API; o health check de abertura segue obrigatório.
- E2E de duas pessoas: `e2e/familia.js` (dois contextos de navegador). Suba a API com `Seguranca__TentativasDeAutenticacaoPorMinuto=100000` para o limite de login não atrapalhar.
- Pegadinha de teste: abas e telas anteriores ficam montadas no DOM; ao clicar em textos repetidos (ex.: "Mais") use o último elemento.

## Fase 5 (mercados, mapa e rota) — o que existe
- **N mercados por grupo** (Mais → Mercados). Cada um tem mapa em grade (ver API: `Loja`/`Secao`); no app o nome é "mercado" e a API diz "loja" (`/lojas`). `MercadoAtualProvider` guarda o mercado de hoje (o primeiro da lista se nada foi escolhido).
- **Editor do mapa** (`MapaDoMercadoScreen`): arrasta seção, entrada e caixas; a bolinha do canto redimensiona; adicionar, girar, excluir, dividir em dois lados. Toques por `PanResponder` na View que envolve o desenho (`MapaSvg` só desenha, com `pointerEvents="none"`); o arrasto sempre parte do mapa do início do gesto (`base`) e mantém a última posição válida quando o destino está ocupado. Toda a regra de edição é pura e testada em `domain/services/mapa.ts` (sem sobreposição, limites, espessura 2 na gôndola dupla). Salvar envia o mapa inteiro com a `versao` aberta (409 = outra pessoa salvou antes); as ids das seções são provisórias (`local-N`) até salvar.
- **Duplicar seção** (`duplicarSecao`): copia só a medida e o formato (inclusive dois lados); nome e categorias começam vazios. Coloca ao lado da original ou no primeiro espaço livre.
- **Gôndola de dois lados**: lado A (cima/esquerda) e B (baixo/direita) com nome e categorias próprios; a rota para no corredor do lado do item. **Categoria em vários lugares** do mesmo mercado: a rota vai ao mais próximo.
- **Compra dividida**: marcar um item guarda o mercado de hoje (`compradoNaLojaId`); a barra `DivisaoDaCompra` mostra comprado por mercado e o que falta. "Não tem aqui" mantém o item pendente (`semNasLojas`) e o tira da rota daquele mercado.
- **Rota** (`RotaScreen`, `POST /listas/{id}/rota`): só itens pendentes que o mercado tem; posição = parada do último item marcado (sem GPS) ou a entrada. O algoritmo vive na API; o app só desenha (`MapaSvg` com trilha, paradas numeradas e posição).
- Tempo real: evento `lojas` recarrega mercados/mapas (`useCarregar` com chaves `mercados`, `mercado:{id}`, `rota:{lista}:{mercado}`). Salvar o próprio mapa atualiza o estado à mão (o aviso do próprio usuário é ignorado).
- E2E: `e2e/mercados.js` (prepara conta e mercados pela API; testa rota, compra dividida entre 2 mercados, "Não tem aqui" e arrastar a seção com o mouse). Rode também com `DARK=1`.
- `SVG`: a fonte do texto precisa ser definida (não herda); `MapaSvg` usa a fonte do sistema no navegador.
