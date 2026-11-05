import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type {
  AnaliseDeGastos,
  AnaliseDePrecos,
  SerieDePreco,
} from '../../domain/entities/analises';
import { formatarVariacao } from '../../domain/services/financeiro';
import { normalizar } from '../../domain/services/organizacao';
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
import {
  CampoDeBusca,
  Cabecalho,
  Carregando,
  Chip,
  EstadoVazio,
  GatilhoDeSeletor,
  Pagina,
  PainelDeOpcoes,
} from '../components/ui';
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
  const [buscaDeProduto, setBuscaDeProduto] = useState('');
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

  const produtosFiltrados = useMemo(() => {
    const termo = normalizar(buscaDeProduto);
    const filtrados =
      termo === ''
        ? produtosOrdenados
        : produtosOrdenados.filter((s) => normalizar(s.nome).includes(termo));
    return ordenarProdutos(filtrados, ordemDosProdutos);
  }, [produtosOrdenados, buscaDeProduto, ordemDosProdutos]);

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
            <BarrasHorizontais
              itens={analise.categorias.map((c) => ({
                rotulo: c.categoria,
                valor: c.total,
                texto: reais(c.total),
                detalhe: `${c.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do gasto do mês`,
              }))}
            />
          )}
          {erroDeCategorias && <TextoSuave>{erroDeCategorias}</TextoSuave>}
        </Cartao>

        {analise.frequentes.length > 0 && (
          <Cartao estilo={{ gap: espaco.md }}>
            <Titulo2>Produtos mais comprados</Titulo2>
            <BarrasHorizontais
              itens={analise.frequentes.map((f) => ({
                rotulo: f.nome,
                valor: f.compras,
                texto: `${f.compras} ${f.compras === 1 ? 'compra' : 'compras'}`,
              }))}
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
                  aoPressionar={() => {
                    setEscolhendoProduto(!escolhendoProduto);
                    setBuscaDeProduto('');
                  }}
                />
                {escolhendoProduto && (
                  <>
                    <CampoDeBusca
                      valor={buscaDeProduto}
                      aoMudar={setBuscaDeProduto}
                      placeholder="Filtrar produtos"
                    />
                    <View style={estilos.chips}>
                      {ORDENS_DE_PRODUTOS.map((o) => (
                        <Chip
                          key={o.valor}
                          rotulo={o.rotulo}
                          ativo={ordemDosProdutos === o.valor}
                          aoPressionar={() => setOrdemDosProdutos(o.valor)}
                        />
                      ))}
                    </View>
                    {produtosFiltrados.length === 0 ? (
                      <TextoSuave>Nenhum produto encontrado.</TextoSuave>
                    ) : (
                      <PainelDeOpcoes
                        titulo="Escolher o produto"
                        opcoes={produtosFiltrados.map((s) => ({
                          chave: `${s.nome}|${s.unidadeBase}`,
                          rotulo: `${nomeNaLista(s, produtosOrdenados)} · ${s.pontos.length} ${s.pontos.length === 1 ? 'mês' : 'meses'}`,
                          detalhe:
                            s.variacaoPercentual === null
                              ? undefined
                              : formatarVariacao(s.variacaoPercentual),
                          marcada:
                            `${s.nome}|${s.unidadeBase}` ===
                            `${serieSelecionada.nome}|${serieSelecionada.unidadeBase}`,
                          aoPressionar: () => {
                            setProdutoEscolhido(`${s.nome}|${s.unidadeBase}`);
                            setEscolhendoProduto(false);
                            setBuscaDeProduto('');
                          },
                        }))}
                      />
                    )}
                  </>
                )}
              </>
            )}
            <View style={estilos.entre}>
              <Text style={{ color: p.texto, fontSize: fonte.corpo, fontWeight: '700' }}>
                {serieSelecionada.nome}
              </Text>
              <Variacao percentual={serieSelecionada.variacaoPercentual} />
            </View>
            <Text style={{ color: p.textoSuave, fontSize: 12 }}>
              Preço por {rotuloDaBase(serieSelecionada.unidadeBase)}
            </Text>
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
            {precos.dados!.maioresAumentos.map((s) => (
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
          </Cartao>
        )}

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
