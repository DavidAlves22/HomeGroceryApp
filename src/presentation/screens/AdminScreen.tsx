import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { JANELAS_DO_PAINEL } from '../../application/useCases/admin';
import type { AdminUsuario, PontoDoDia } from '../../domain/entities/admin';
import { Dinheiro } from '../../domain/valueObjects/Dinheiro';
import {
  melhorDia,
  rotuloDoDia,
  somarPontos,
  totalDePaginas,
  vistoPorUltimo,
} from '../../domain/services/painelAdmin';
import { Botao, Cartao, TextoSuave } from '../components/base';
import { ColunasPorDia } from '../components/graficos';
import { Cabecalho, Carregando, Chip, EstadoVazio, Pagina } from '../components/ui';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, raio, usePaleta } from '../theme';

type SerieEscolhida = 'cadastros' | 'listasCriadas' | 'itensComprados';

const SERIES: { chave: SerieEscolhida; rotulo: string; unidade: [string, string] }[] = [
  { chave: 'cadastros', rotulo: 'Cadastros', unidade: ['cadastro', 'cadastros'] },
  { chave: 'listasCriadas', rotulo: 'Listas criadas', unidade: ['lista', 'listas'] },
  { chave: 'itensComprados', rotulo: 'Itens comprados', unidade: ['item', 'itens'] },
];

function Titulo2({ children }: { children: React.ReactNode }) {
  const p = usePaleta();
  return (
    <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '800' }}>{children}</Text>
  );
}

/** Um número grande com a legenda embaixo. Duas por linha no celular. */
function Metrica({ valor, rotulo }: { valor: string; rotulo: string }) {
  const p = usePaleta();
  return (
    <View style={[estilos.metrica, { backgroundColor: p.superficie2 }]}>
      <Text
        style={{
          color: p.texto,
          fontSize: fonte.grande,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
        }}
      >
        {valor}
      </Text>
      <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>{rotulo}</Text>
    </View>
  );
}

function LinhaDeConta({ conta, agora }: { conta: AdminUsuario; agora: Date }) {
  const p = usePaleta();
  return (
    <View style={[estilos.conta, { borderBottomColor: p.linha }]}>
      <View style={estilos.entre}>
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}
        >
          {conta.nome}
        </Text>
        <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
          {vistoPorUltimo(conta.ultimoAcessoEm, agora)}
        </Text>
      </View>
      <Text numberOfLines={1} style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
        {conta.email}
      </Text>
      <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
        {conta.membrosDoGrupo > 1 ? `Família de ${conta.membrosDoGrupo}` : 'Sozinho(a)'} ·{' '}
        {conta.listasCriadas} {conta.listasCriadas === 1 ? 'lista' : 'listas'} ·{' '}
        {conta.itensComprados} {conta.itensComprados === 1 ? 'item comprado' : 'itens comprados'}
      </Text>
    </View>
  );
}

function pontosParaGrafico(pontos: PontoDoDia[]) {
  return pontos.map((ponto) => ({ rotulo: rotuloDoDia(ponto.dia), valor: ponto.valor }));
}

/**
 * Painel do administrador: números gerais do app, atividade por dia e a lista de contas. A API só responde a quem
 * tem o papel Admin; quem chegar aqui sem ele (ex.: digitando /admin) vê o aviso de acesso negado.
 */
export function AdminScreen() {
  const p = usePaleta();
  const container = useContainer();
  const navegacao = useNavegacao();
  const [dias, setDias] = useState<number>(30);
  const [serie, setSerie] = useState<SerieEscolhida>('cadastros');
  const [pagina, setPagina] = useState(1);

  const resumo = useCarregar(() => container.obterResumoDoPainel.executar(), 'admin-resumo');
  const series = useCarregar(
    () => container.obterSeriesDoPainel.executar(dias),
    `admin-series-${dias}`,
  );
  const contas = useCarregar(
    () => container.listarUsuariosDoPainel.executar(pagina),
    `admin-contas-${pagina}`,
  );

  const voltar = () => navegacao.goBack();
  const recarregarTudo = () => {
    void resumo.recarregar();
    void series.recarregar();
    void contas.recarregar();
  };

  if (resumo.carregando && !resumo.dados) {
    return (
      <Pagina>
        <Carregando />
      </Pagina>
    );
  }

  if (!resumo.dados) {
    return (
      <Pagina>
        <Cabecalho titulo="Painel" aoVoltar={voltar} />
        <EstadoVazio
          titulo="Painel indisponível"
          texto={resumo.erro ?? 'Não foi possível carregar o painel.'}
          acao={{ rotulo: 'Tentar novamente', aoPressionar: recarregarTudo }}
        />
      </Pagina>
    );
  }

  const r = resumo.dados;
  const agora = new Date(r.geradoEm);
  const serieAtual = SERIES.find((s) => s.chave === serie) ?? SERIES[0];
  const pontos = series.dados ? series.dados[serie] : [];
  const total = somarPontos(pontos);
  const melhor = melhorDia(pontos);
  const paginas = contas.dados ? totalDePaginas(contas.dados) : 1;

  return (
    <Pagina larga>
      <Cabecalho titulo="Painel" aoVoltar={voltar} />
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={recarregarTudo} tintColor={p.destaque} />
        }
      >
        <Cartao estilo={{ gap: espaco.md }}>
          <Titulo2>Usuários</Titulo2>
          <View style={estilos.grade}>
            <Metrica valor={String(r.usuarios.total)} rotulo="contas no total" />
            <Metrica valor={String(r.usuarios.ativos24Horas)} rotulo="ativas nas últimas 24 h" />
            <Metrica valor={String(r.usuarios.ativos7Dias)} rotulo="ativas em 7 dias" />
            <Metrica valor={String(r.usuarios.ativos30Dias)} rotulo="ativas em 30 dias" />
            <Metrica valor={String(r.usuarios.novos7Dias)} rotulo="novas em 7 dias" />
            <Metrica valor={String(r.usuarios.novos30Dias)} rotulo="novas em 30 dias" />
          </View>
          <TextoSuave estilo={{ fontSize: fonte.pequena }}>
            Ativa = entrou ou renovou a sessão no período (o app renova a cada 30 minutos de uso).
          </TextoSuave>
        </Cartao>

        <Cartao estilo={{ gap: espaco.md }}>
          <Titulo2>Uso do app</Titulo2>
          <View style={estilos.grade}>
            <Metrica valor={String(r.grupos.familias)} rotulo="famílias (2+ pessoas)" />
            <Metrica valor={String(r.listas.emAndamento)} rotulo="listas em andamento" />
            <Metrica valor={String(r.listas.finalizadas)} rotulo="compras finalizadas" />
            <Metrica
              valor={Dinheiro.deReais(r.listas.gastoTotalFinalizado).formatar()}
              rotulo="gasto registrado"
            />
            <Metrica
              valor={String(r.itens.comprados)}
              rotulo={`itens comprados de ${r.itens.total}`}
            />
            <Metrica valor={String(r.mercados)} rotulo="mercados mapeados" />
            <Metrica valor={String(r.notasImportadas)} rotulo="notas fiscais importadas" />
            <Metrica valor={String(r.aparelhosComAvisos)} rotulo="aparelhos com avisos" />
          </View>
        </Cartao>

        <Cartao estilo={{ gap: espaco.md }}>
          <Titulo2>Atividade por dia</Titulo2>
          <View style={estilos.chips}>
            {SERIES.map((s) => (
              <Chip
                key={s.chave}
                rotulo={s.rotulo}
                ativo={s.chave === serie}
                aoPressionar={() => setSerie(s.chave)}
              />
            ))}
          </View>
          <View style={estilos.chips}>
            {JANELAS_DO_PAINEL.map((janela) => (
              <Chip
                key={janela}
                rotulo={`${janela} dias`}
                ativo={janela === dias}
                aoPressionar={() => setDias(janela)}
              />
            ))}
          </View>
          {series.dados && pontos.length > 0 ? (
            <>
              <ColunasPorDia
                key={`${serie}-${dias}`}
                pontos={pontosParaGrafico(pontos)}
                unidade={(n) => serieAtual.unidade[n === 1 ? 0 : 1]}
                descricao={`${serieAtual.rotulo} por dia nos últimos ${dias} dias. Toque em uma coluna para ver o dia.`}
              />
              <TextoSuave estilo={{ fontSize: fonte.pequena }}>
                {total} {serieAtual.unidade[total === 1 ? 0 : 1]} em {dias} dias
                {melhor ? ` · pico em ${rotuloDoDia(melhor.dia)} (${melhor.valor})` : ''}. Os dias
                seguem o horário de Brasília.
              </TextoSuave>
            </>
          ) : series.erro ? (
            <TextoSuave>{series.erro}</TextoSuave>
          ) : (
            <Carregando />
          )}
        </Cartao>

        <Cartao estilo={{ gap: espaco.sm }}>
          <View style={estilos.entre}>
            <Titulo2>Contas</Titulo2>
            {contas.dados && (
              <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                {contas.dados.total} no total
              </Text>
            )}
          </View>
          {contas.dados ? (
            <>
              {contas.dados.itens.map((conta) => (
                <LinhaDeConta key={conta.id} conta={conta} agora={agora} />
              ))}
              {paginas > 1 && (
                <View style={estilos.paginacao}>
                  <View style={{ flex: 1 }}>
                    <Botao
                      titulo="Anterior"
                      variante="secundario"
                      desabilitado={pagina <= 1}
                      aoPressionar={() => setPagina(pagina - 1)}
                    />
                  </View>
                  <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                    {pagina} de {paginas}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Botao
                      titulo="Próxima"
                      variante="secundario"
                      desabilitado={pagina >= paginas}
                      aoPressionar={() => setPagina(pagina + 1)}
                    />
                  </View>
                </View>
              )}
            </>
          ) : contas.erro ? (
            <TextoSuave>{contas.erro}</TextoSuave>
          ) : (
            <Carregando />
          )}
        </Cartao>
      </ScrollView>
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: {
    padding: espaco.lg,
    gap: espaco.lg,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  metrica: {
    flexGrow: 1,
    // Largura mínima em vez de porcentagem: 2 colunas no celular e mais delas no computador.
    flexBasis: 150,
    borderRadius: raio.sm,
    padding: espaco.md,
    gap: 2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  entre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  conta: { paddingVertical: espaco.md, borderBottomWidth: 1, gap: 2 },
  paginacao: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, paddingTop: espaco.sm },
});
