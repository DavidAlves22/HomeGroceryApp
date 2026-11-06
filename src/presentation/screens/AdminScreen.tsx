import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import { JANELAS_DO_PAINEL } from '../../application/useCases/admin';
import type { AdminUsuario, PontoDoDia } from '../../domain/entities/admin';
import { Dinheiro } from '../../domain/valueObjects/Dinheiro';
import {
  dataDoDia,
  dataEHoraDoDia,
  melhorDia,
  rotuloDoDia,
  somarPontos,
  totalDePaginas,
  vistoPorUltimo,
} from '../../domain/services/painelAdmin';
import { Botao, Cartao, TextoSuave } from '../components/base';
import { ColunasPorDia } from '../components/graficos';
import { InsightsDoPainel } from '../components/InsightsDoPainel';
import { GradeDeMetricas, Metrica, TituloDoCartao } from '../components/painel';
import { ListaComVerMais } from '../components/ListaComVerMais';
import { MapasDoPainel } from '../components/MapasDoPainel';
import { Cabecalho, Carregando, Chip, EstadoVazio, Pagina, Pilula } from '../components/ui';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, usePaleta } from '../theme';

type SerieEscolhida = 'cadastros' | 'listasCriadas' | 'itensComprados';

const SERIES: { chave: SerieEscolhida; rotulo: string; unidade: [string, string] }[] = [
  { chave: 'cadastros', rotulo: 'Cadastros', unidade: ['cadastro', 'cadastros'] },
  { chave: 'listasCriadas', rotulo: 'Listas criadas', unidade: ['lista', 'listas'] },
  { chave: 'itensComprados', rotulo: 'Itens comprados', unidade: ['item', 'itens'] },
];

interface LinhaDeContaProps {
  conta: AdminUsuario;
  agora: Date;
  /** Esta conta está esperando o segundo toque para ser bloqueada. */
  confirmando: boolean;
  /** Esta conta está esperando o segundo toque para ser apagada de vez. */
  confirmandoExclusao: boolean;
  ocupada: boolean;
  aoAlternarBloqueio: () => void;
  aoExcluir: () => void;
}

/** Uma informação por linha, na ordem em que o administrador as procura: quem é, desde quando, último acesso, uso. */
function LinhaDeConta({
  conta,
  agora,
  confirmando,
  confirmandoExclusao,
  ocupada,
  aoAlternarBloqueio,
  aoExcluir,
}: LinhaDeContaProps) {
  const p = usePaleta();
  const bloqueada = conta.bloqueadoEm !== null;
  const rotuloDoBotao = bloqueada ? 'Desbloquear' : confirmando ? 'Confirmar bloqueio' : 'Bloquear';
  const suave = { color: p.textoSuave, fontSize: fonte.pequena };

  return (
    <View style={[estilos.conta, { borderBottomColor: p.linha }]}>
      <View style={estilos.entre}>
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: p.texto, fontWeight: '700', fontSize: fonte.corpo }}
        >
          {conta.nome}
        </Text>
        {bloqueada && <Pilula texto="Bloqueada" tom="alerta" />}
      </View>
      <Text numberOfLines={1} style={suave}>
        {conta.email}
      </Text>
      <Text style={suave}>Usuário desde {dataDoDia(conta.criadoEm)}</Text>
      <Text style={suave}>
        {conta.ultimoAcessoEm
          ? `Último acesso em ${dataEHoraDoDia(conta.ultimoAcessoEm)} (${vistoPorUltimo(conta.ultimoAcessoEm, agora)})`
          : 'Último acesso: sem registro'}
      </Text>
      {bloqueada && <Text style={suave}>Bloqueada em {dataDoDia(conta.bloqueadoEm)}</Text>}
      <Text style={suave}>
        {conta.membrosDoGrupo > 1 ? `Família de ${conta.membrosDoGrupo}` : 'Sozinho(a)'}
      </Text>
      <Text style={suave}>
        {conta.listasCriadas} {conta.listasCriadas === 1 ? 'lista' : 'listas'}
      </Text>
      <Text style={suave}>
        {conta.itensComprados} {conta.itensComprados === 1 ? 'item comprado' : 'itens comprados'}
      </Text>
      {conta.ehAdmin ? (
        <Text style={suave}>Administrador (não pode ser bloqueado nem excluído)</Text>
      ) : (
        <>
          {confirmandoExclusao && (
            <Text style={{ color: p.alerta, fontSize: fonte.pequena }}>
              Apaga a conta e todos os dados dela do banco, sem volta. Se ela está numa família, só
              sai dela.
            </Text>
          )}
          <View style={estilos.acoes}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${bloqueada ? 'Desbloquear' : 'Bloquear'} ${conta.nome}`}
              disabled={ocupada}
              onPress={aoAlternarBloqueio}
              style={[
                estilos.botaoDaConta,
                {
                  borderColor: bloqueada ? p.destaque : p.alerta,
                  backgroundColor: confirmando ? p.alerta : 'transparent',
                  opacity: ocupada ? 0.5 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: confirmando ? p.textoSobreDestaque : bloqueada ? p.destaque : p.alerta,
                  fontWeight: '700',
                  fontSize: fonte.pequena,
                }}
              >
                {rotuloDoBotao}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Excluir conta ${conta.nome}`}
              disabled={ocupada}
              onPress={aoExcluir}
              style={[
                estilos.botaoDaConta,
                {
                  borderColor: p.alerta,
                  backgroundColor: confirmandoExclusao ? p.alerta : 'transparent',
                  opacity: ocupada ? 0.5 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: confirmandoExclusao ? p.textoSobreDestaque : p.alerta,
                  fontWeight: '700',
                  fontSize: fonte.pequena,
                }}
              >
                {confirmandoExclusao ? 'Apagar tudo da conta' : 'Excluir conta'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
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
  const toast = useToast();
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);

  const resumo = useCarregar(() => container.obterResumoDoPainel.executar(), 'admin-resumo');
  const series = useCarregar(
    () => container.obterSeriesDoPainel.executar(dias),
    `admin-series-${dias}`,
  );
  const contas = useCarregar(
    () => container.listarUsuariosDoPainel.executar(pagina),
    `admin-contas-${pagina}`,
  );

  const insights = useCarregar(() => container.obterInsightsDoPainel.executar(), 'admin-insights');

  /** Liberar vale no primeiro toque; bloquear pede um segundo toque, porque desconecta a pessoa na hora. */
  async function alternarBloqueio(conta: AdminUsuario) {
    const bloquear = conta.bloqueadoEm === null;
    if (bloquear && confirmando !== conta.id) {
      setConfirmando(conta.id);
      return;
    }

    setOcupada(conta.id);
    try {
      await container.definirBloqueioDeConta.executar(conta.id, bloquear);
      toast(
        bloquear
          ? `A conta de ${conta.nome} foi bloqueada.`
          : `A conta de ${conta.nome} foi liberada.`,
      );
      await contas.recarregar();
    } catch (e) {
      toast(mensagemParaUsuario(e));
    } finally {
      setConfirmando(null);
      setOcupada(null);
    }
  }

  /** Excluir apaga a conta e os dados dela do banco: sempre pede um segundo toque. */
  async function excluirConta(conta: AdminUsuario) {
    if (confirmandoExclusao !== conta.id) {
      setConfirmandoExclusao(conta.id);
      setConfirmando(null);
      return;
    }

    setOcupada(conta.id);
    try {
      await container.excluirContaDoPainel.executar(conta.id);
      toast(`A conta de ${conta.nome} foi excluída.`);
      await Promise.all([contas.recarregar(), resumo.recarregar(), insights.recarregar()]);
    } catch (e) {
      toast(mensagemParaUsuario(e));
    } finally {
      setConfirmandoExclusao(null);
      setOcupada(null);
    }
  }

  const voltar = () => navegacao.goBack();
  const recarregarTudo = () => {
    void resumo.recarregar();
    void series.recarregar();
    void insights.recarregar();
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
          <TituloDoCartao>Usuários</TituloDoCartao>
          <GradeDeMetricas>
            <Metrica valor={String(r.usuarios.total)} rotulo="contas no total" />
            <Metrica valor={String(r.usuarios.ativos24Horas)} rotulo="ativas nas últimas 24 h" />
            <Metrica valor={String(r.usuarios.ativos7Dias)} rotulo="ativas em 7 dias" />
            <Metrica valor={String(r.usuarios.ativos30Dias)} rotulo="ativas em 30 dias" />
            <Metrica valor={String(r.usuarios.novos7Dias)} rotulo="novas em 7 dias" />
            <Metrica valor={String(r.usuarios.novos30Dias)} rotulo="novas em 30 dias" />
          </GradeDeMetricas>
          <TextoSuave estilo={{ fontSize: fonte.pequena }}>
            Ativa = entrou ou renovou a sessão no período (o app renova a cada 30 minutos de uso).
          </TextoSuave>
        </Cartao>

        <Cartao estilo={{ gap: espaco.md }}>
          <TituloDoCartao>Uso do app</TituloDoCartao>
          <GradeDeMetricas>
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
          </GradeDeMetricas>
        </Cartao>

        <Cartao estilo={{ gap: espaco.md }}>
          <TituloDoCartao>Atividade por dia</TituloDoCartao>
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

        {insights.dados ? (
          <InsightsDoPainel dados={insights.dados} />
        ) : (
          <Cartao>
            {insights.erro ? <TextoSuave>{insights.erro}</TextoSuave> : <Carregando />}
          </Cartao>
        )}

        <MapasDoPainel />

        <Cartao estilo={{ gap: espaco.sm }}>
          <View style={estilos.entre}>
            <TituloDoCartao>Contas</TituloDoCartao>
            {contas.dados && (
              <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                {contas.dados.total} no total
              </Text>
            )}
          </View>
          {contas.dados ? (
            <>
              <ListaComVerMais
                titulo="Contas"
                itens={contas.dados.itens}
                renderizar={(lista) =>
                  lista.map((conta) => (
                    <LinhaDeConta
                      key={conta.id}
                      conta={conta}
                      agora={agora}
                      confirmando={confirmando === conta.id}
                      confirmandoExclusao={confirmandoExclusao === conta.id}
                      ocupada={ocupada === conta.id}
                      aoAlternarBloqueio={() => void alternarBloqueio(conta)}
                      aoExcluir={() => void excluirConta(conta)}
                    />
                  ))
                }
              />
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  entre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  conta: { paddingVertical: espaco.md, borderBottomWidth: 1, gap: 2 },
  acoes: { flexDirection: 'row', paddingTop: espaco.sm },
  botaoDaConta: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginacao: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, paddingTop: espaco.sm },
});
