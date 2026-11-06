import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type {
  AnaliseDeGastos,
  AnaliseDePrecos,
  SerieDePreco,
} from '../../domain/entities/analises';
import { formatarVariacao } from '../../domain/services/financeiro';
import {
  ORDENS_DE_PRODUTOS,
  ordenarProdutos,
  type OrdemDeProdutos,
} from '../../domain/services/ordemDeProdutos';
import { Competencia } from '../../domain/valueObjects/Competencia';
import { Dinheiro } from '../../domain/valueObjects/Dinheiro';
import { Botao, Cartao, TextoSuave } from '../components/base';
import { BarrasHorizontais, GraficoDeBarras, GraficoDeLinha } from '../components/graficos';
import { Icone } from '../components/Icone';
import { Cabecalho, Carregando, EstadoVazio, GatilhoDeSeletor, Pagina } from '../components/ui';
import { SeletorDeOpcao } from '../components/SeletorDeOpcao';
import { CartaoDeLista } from '../components/CartaoDeLista';
import { ListaComVerMais } from '../components/ListaComVerMais';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { espaco, fonte, usePaleta } from '../theme';

const reais = (valor: number) => Dinheiro.deReais(valor).formatar();
const reaisInteiros = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Variação com seta e sinal (não depende só da cor: subir é sempre "▲ +x%"). */
function Variacao({
  percentual,
  aumentoEhRuim = true,
}: {
  percentual: number | null;
  aumentoEhRuim?: boolean;
}) {
  const p = usePaleta();
  if (percentual === null || percentual === 0) {
    return (
      <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
        {formatarVariacao(percentual)}
      </Text>
    );
  }
  const subiu = percentual > 0;
  const ruim = subiu === aumentoEhRuim;
  return (
    <View style={estilos.variacao}>
      <Icone
        nome={subiu ? 'alta' : 'baixa'}
        tamanho={14}
        cor={ruim ? p.alerta : p.textoSuave}
        espessura={2.5}
      />
      <Text
        style={{
          color: ruim ? p.alerta : p.textoSuave,
          fontSize: fonte.pequena,
          fontWeight: '700',
        }}
      >
        {formatarVariacao(percentual)}
      </Text>
    </View>
  );
}

function Titulo2({ children }: { children: React.ReactNode }) {
  const p = usePaleta();
  return (
    <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '800' }}>{children}</Text>
  );
}

/**
 * Análises: gasto por mês, peso de cada categoria, produtos mais comprados e evolução de preços.
 * Tudo vem do histórico de listas (o servidor calcula); aqui só se desenha. Cada gráfico tem uma
 * tabela de valores logo abaixo, para quem usa leitor de tela ou quer o número exato.
 */
export function AnalisesScreen() {
  const container = useContainer();
  const p = usePaleta();
  const [competenciaEscolhida, setCompetenciaEscolhida] = useState<string | undefined>(undefined);
  const [produtoEscolhido, setProdutoEscolhido] = useState<string | null>(null);
  // Lista suspensa de produtos (com busca): com dezenas de produtos, pílulas viram uma parede de botões.
  const [escolhendoProduto, setEscolhendoProduto] = useState(false);
  const [ordemDosProdutos, setOrdemDosProdutos] = useState<OrdemDeProdutos>('meses');
  const [erroDeCategorias, setErroDeCategorias] = useState<string | null>(null);

  const gastos = useCarregar<AnaliseDeGastos>(
    () => container.obterAnaliseDeGastos.executar(6, competenciaEscolhida),
    `gastos-${competenciaEscolhida ?? 'auto'}`,
  );
  const precos = useCarregar<AnaliseDePrecos>(
    () => container.obterAnaliseDePrecos.executar(),
    'precos',
  );

  // Padrões do histórico inteiro: não bloqueiam a tela e cada cartão só aparece se houver algo a dizer.
  const padroes = useCarregar(() => container.obterPadroesDeCompra.executar(), 'padroes');

  // Produtos com mais meses de histórico primeiro: é onde o gráfico de evolução diz alguma coisa.
  const produtosOrdenados = useMemo(
    () =>
      [...(precos.dados?.produtos ?? [])].sort(
        (a, b) => b.pontos.length - a.pontos.length || a.nome.localeCompare(b.nome, 'pt-BR'),
      ),
    [precos.dados],
  );
  const serieSelecionada: SerieDePreco | null = useMemo(
    () =>
      produtosOrdenados.find((s) => `${s.nome}|${s.unidadeBase}` === produtoEscolhido) ??
      produtosOrdenados[0] ??
      null,
    [produtosOrdenados, produtoEscolhido],
  );

  if ((gastos.carregando && !gastos.dados) || (precos.carregando && !precos.dados)) {
    return (
      <Pagina>
        <Carregando />
      </Pagina>
    );
  }

  const erro = gastos.erro ?? precos.erro;
  if (erro && !gastos.dados) {
    return (
      <Pagina>
        <Cabecalho titulo="Análises" />
        <EstadoVazio
          titulo="Não foi possível carregar"
          texto={erro}
          acao={{
            rotulo: 'Tentar novamente',
            aoPressionar: () => {
              void gastos.recarregar();
              void precos.recarregar();
              void padroes.recarregar();
            },
          }}
        />
      </Pagina>
    );
  }

  const analise = gastos.dados;
  const meses = analise?.meses ?? [];
  const temGasto = meses.some((m) => m.realizado > 0);

  if (!analise || meses.length === 0 || !temGasto) {
    return (
      <Pagina>
        <Cabecalho titulo="Análises" />
        <EstadoVazio
          titulo="Ainda não há gastos para analisar"
          texto="Marque os produtos como comprados e informe o preço pago em cada um (toque em ⋯ no produto). Quando houver compras com preço, os gráficos aparecem aqui."
        />
      </Pagina>
    );
  }

  const indiceDoMes = Math.max(
    meses.findIndex((m) => m.competencia === analise.competenciaDasCategorias),
    0,
  );
  const mesSelecionado = meses[indiceDoMes];
  const ultimo = meses[meses.length - 1];
  const anterior = meses.length > 1 ? meses[meses.length - 2] : null;

  return (
    <Pagina>
      <Cabecalho titulo="Análises" />
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              void gastos.recarregar();
              void precos.recarregar();
            }}
            tintColor={p.destaque}
          />
        }
      >
        <Cartao heroi estilo={{ gap: espaco.md }}>
          <View style={estilos.entre}>
            <Titulo2>Gasto por mês</Titulo2>
            {anterior && (
              <View style={{ alignItems: 'flex-end' }}>
                <Variacao percentual={ultimo.variacaoPercentual} />
                <Text style={{ color: p.textoSuave, fontSize: 12 }}>
                  {Competencia.deChave(ultimo.competencia).abreviado} vs.{' '}
                  {Competencia.deChave(anterior.competencia).abreviado}
                </Text>
              </View>
            )}
          </View>
          <GraficoDeBarras
            barras={meses.map((m) => ({
              rotulo: Competencia.deChave(m.competencia).abreviado,
              valor: m.realizado,
              texto: reaisInteiros(m.realizado),
            }))}
            selecionada={indiceDoMes}
            aoSelecionar={(i) => setCompetenciaEscolhida(meses[i].competencia)}
            descricao={`Gasto dos últimos ${meses.length} meses. Toque em uma barra para ver as categorias do mês.`}
          />
          <TextoSuave estilo={{ fontSize: fonte.pequena }}>
            Toque em uma barra para ver as categorias daquele mês.
          </TextoSuave>

          <View style={{ gap: 0 }}>
            <View style={[estilos.linhaTabela, { borderBottomColor: p.linha }]}>
              <Text style={[estilos.cabecalhoTabela, { color: p.textoSuave, flex: 1.2 }]}>Mês</Text>
              <Text
                style={[
                  estilos.cabecalhoTabela,
                  { color: p.textoSuave, flex: 1, textAlign: 'right' },
                ]}
              >
                Gasto
              </Text>
              <Text
                style={[
                  estilos.cabecalhoTabela,
                  { color: p.textoSuave, flex: 0.9, textAlign: 'right' },
                ]}
              >
                Variação
              </Text>
            </View>
            {[...meses].reverse().map((m) => (
              <View
                key={m.competencia}
                style={[estilos.linhaTabela, { borderBottomColor: p.linha }]}
              >
                <Text style={{ flex: 1.2, color: p.texto, fontSize: fonte.pequena }}>
                  {Competencia.deChave(m.competencia).abreviado}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    textAlign: 'right',
                    color: p.texto,
                    fontSize: fonte.pequena,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {reais(m.realizado)}
                </Text>
                <View style={{ flex: 0.9, alignItems: 'flex-end' }}>
                  <Variacao percentual={m.variacaoPercentual} />
                </View>
              </View>
            ))}
          </View>
        </Cartao>

        <Cartao estilo={{ gap: espaco.md }}>
          <Titulo2>Por categoria em {mesSelecionado.competenciaNome}</Titulo2>
          {analise.categorias.length === 0 ? (
            <TextoSuave>Sem gastos com preço informado neste mês.</TextoSuave>
          ) : (
            <ListaComVerMais
              titulo={`Por categoria em ${mesSelecionado.competenciaNome}`}
              itens={analise.categorias.map((c) => ({
                rotulo: c.categoria,
                valor: c.total,
                texto: reais(c.total),
                detalhe: `${c.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do gasto do mês`,
              }))}
              renderizar={(itens) => <BarrasHorizontais itens={itens} />}
            />
          )}
          {erroDeCategorias && <TextoSuave>{erroDeCategorias}</TextoSuave>}
        </Cartao>

        {analise.frequentes.length > 0 && (
          <Cartao estilo={{ gap: espaco.md }}>
            <Titulo2>Produtos mais comprados</Titulo2>
            <ListaComVerMais
              titulo="Produtos mais comprados"
              itens={analise.frequentes.map((f) => ({
                rotulo: f.nome,
                valor: f.compras,
                texto: `${f.compras} ${f.compras === 1 ? 'compra' : 'compras'}`,
              }))}
              renderizar={(itens) => <BarrasHorizontais itens={itens} />}
            />
          </Cartao>
        )}

        {serieSelecionada ? (
          <Cartao estilo={{ gap: espaco.md }}>
            <Titulo2>Evolução de preços</Titulo2>
            {produtosOrdenados.length > 1 && (
              <>
                <GatilhoDeSeletor
                  rotulo="Produto"
                  valor={nomeNaLista(serieSelecionada, produtosOrdenados)}
                  aberto={escolhendoProduto}
                  aoPressionar={() => setEscolhendoProduto(true)}
                />
                <SeletorDeOpcao
                  visivel={escolhendoProduto}
                  titulo="Escolher o produto"
                  comBuscaEOrdem
                  placeholderDaBusca="Filtrar produtos"
                  ordens={{
                    opcoes: ORDENS_DE_PRODUTOS.map((o) => ({ chave: o.valor, rotulo: o.rotulo })),
                    atual: ordemDosProdutos,
                    aoMudar: (chave) => setOrdemDosProdutos(chave as OrdemDeProdutos),
                  }}
                  opcoes={ordenarProdutos(produtosOrdenados, ordemDosProdutos).map((s) => ({
                    chave: `${s.nome}|${s.unidadeBase}`,
                    rotulo: `${nomeNaLista(s, produtosOrdenados)} · ${s.pontos.length} ${s.pontos.length === 1 ? 'mês' : 'meses'}`,
                    detalhe:
                      s.variacaoPercentual === null
                        ? undefined
                        : formatarVariacao(s.variacaoPercentual),
                  }))}
                  escolhida={`${serieSelecionada.nome}|${serieSelecionada.unidadeBase}`}
                  aoEscolher={(chave) => {
                    setProdutoEscolhido(chave);
                    setEscolhendoProduto(false);
                  }}
                  aoFechar={() => setEscolhendoProduto(false)}
                />
              </>
            )}
            <View style={estilos.entre}>
              {/* Com o seletor na tela o nome já aparece nele; só repete quando o produto é o único. */}
              <View style={{ flex: 1 }}>
                {produtosOrdenados.length <= 1 && (
                  <Text style={{ color: p.texto, fontSize: fonte.corpo, fontWeight: '700' }}>
                    {serieSelecionada.nome}
                  </Text>
                )}
                <Text style={{ color: p.textoSuave, fontSize: 12 }}>
                  Preço por {rotuloDaBase(serieSelecionada.unidadeBase)}
                </Text>
              </View>
              <Variacao percentual={serieSelecionada.variacaoPercentual} />
            </View>
            <GraficoDeLinha
              pontos={serieSelecionada.pontos.map((pt) => ({
                rotulo: Competencia.deChave(pt.competencia).abreviado,
                valor: pt.preco,
              }))}
              textoDoValor={reais}
              descricao={`Evolução do preço de ${serieSelecionada.nome}: ${serieSelecionada.pontos.map((pt) => `${pt.competenciaNome} ${reais(pt.preco)}`).join(', ')}.`}
            />
            <View style={estilos.estatisticas}>
              {[
                ['Último', serieSelecionada.ultimoPreco],
                ['Menor', serieSelecionada.menorPreco],
                ['Maior', serieSelecionada.maiorPreco],
                ['Médio', serieSelecionada.precoMedio],
              ].map(([rotulo, valor]) => (
                <View
                  key={rotulo as string}
                  style={[estilos.estatistica, { backgroundColor: p.fundo }]}
                >
                  <Text
                    style={{
                      color: p.textoSuave,
                      fontSize: 12,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                    }}
                  >
                    {rotulo}
                  </Text>
                  <Text
                    style={{
                      color: p.texto,
                      fontSize: fonte.corpo,
                      fontWeight: '700',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {reais(valor as number)}
                  </Text>
                </View>
              ))}
            </View>
          </Cartao>
        ) : (
          <Cartao>
            <Titulo2>Evolução de preços</Titulo2>
            <TextoSuave>
              Informe o preço pago nos produtos comprados para acompanhar como os preços mudam mês a
              mês.
            </TextoSuave>
          </Cartao>
        )}

        {(precos.dados?.maioresAumentos.length ?? 0) > 0 && (
          <Cartao estilo={{ gap: espaco.sm }}>
            <Titulo2>Maiores aumentos de preço</Titulo2>
            <TextoSuave estilo={{ fontSize: fonte.pequena }}>
              Comparando o último mês comprado com o anterior.
            </TextoSuave>
            <ListaComVerMais
              titulo="Maiores aumentos de preço"
              itens={precos.dados!.maioresAumentos}
              renderizar={(itens) => (
                <View>
                  {itens.map((s) => (
                    <View
                      key={`${s.nome}|${s.unidadeBase}`}
                      style={[estilos.linhaTabela, { borderBottomColor: p.linha }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: p.texto, fontWeight: '600', fontSize: fonte.corpo }}>
                          {s.nome}
                        </Text>
                        <Text style={{ color: p.textoSuave, fontSize: 12 }}>
                          {reais(s.pontos[s.pontos.length - 2].preco)} para {reais(s.ultimoPreco)}
                        </Text>
                      </View>
                      <Variacao percentual={s.variacaoPercentual} />
                    </View>
                  ))}
                </View>
              )}
            />
          </Cartao>
        )}

        <CartaoDeLista
          titulo="Preço bom na última compra"
          texto="Produtos que você pagou bem abaixo da média. Pode valer estocar quando o preço estiver assim."
          itens={padroes.dados?.precosBons ?? []}
          chave={(item) => `${item.nome}|${item.unidadeBase}`}
          renderizar={(item) => <LinhaDePadrao titulo={item.nome} texto={item.descricao} />}
        />

        <CartaoDeLista
          titulo="Costumam ir juntos"
          texto="Produtos que aparecem no mesmo dia de compra mais do que o acaso explicaria."
          itens={padroes.dados?.casados ?? []}
          chave={(item) => `${item.primeiro}|${item.segundo}`}
          renderizar={(item) => (
            <LinhaDePadrao titulo={`${item.primeiro} + ${item.segundo}`} texto={item.descricao} />
          )}
        />

        <CartaoDeLista
          titulo="Deste mês, em outros anos"
          texto="Produtos de época: você os comprou neste mesmo mês e não tem comprado agora."
          itens={padroes.dados?.sazonais ?? []}
          chave={(item) => item.chave}
          renderizar={(item) => <LinhaDePadrao titulo={item.nome} texto={item.descricao} />}
        />

        <Botao
          titulo="Atualizar"
          variante="texto"
          aoPressionar={() => {
            setErroDeCategorias(null);
            void gastos.recarregar().catch((e) => setErroDeCategorias(mensagemParaUsuario(e)));
            void precos.recarregar();
          }}
        />
      </ScrollView>
    </Pagina>
  );
}

/** Linha simples dos cartões de padrões: nome em destaque e a frase que explica o achado. */
function LinhaDePadrao({ titulo, texto }: { titulo: string; texto: string }) {
  const p = usePaleta();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}>{titulo}</Text>
      <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>{texto}</Text>
    </View>
  );
}

/** O nome na lista de produtos; se há o mesmo nome em outra unidade (Arroz em kg e em pacote), a unidade desempata. */
function nomeNaLista(serie: SerieDePreco, todas: SerieDePreco[]): string {
  const repetido = todas.some((o) => o !== serie && o.nome === serie.nome);
  return repetido ? `${serie.nome} (${rotuloDaBase(serie.unidadeBase)})` : serie.nome;
}

function rotuloDaBase(base: string): string {
  return base === 'Kg' ? 'kg' : base === 'Litro' ? 'litro' : base.toLowerCase();
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, gap: espaco.lg, paddingBottom: 40 },
  entre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  variacao: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linhaTabela: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: espaco.sm,
    borderBottomWidth: 1,
    minHeight: 40,
  },
  cabecalhoTabela: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  estatisticas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  estatistica: { flexGrow: 1, flexBasis: '45%', borderRadius: 12, padding: espaco.md, gap: 2 },
});
