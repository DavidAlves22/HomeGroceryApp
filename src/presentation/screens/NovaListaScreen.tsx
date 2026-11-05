import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import { ListaPrincipalJaExiste } from '../../application/useCases/listas';
import {
  rotuloDaUnidade,
  type ItemDaLista,
  type ItemDoModelo,
  type ListaResumo,
  type OrigemDaLista,
} from '../../domain/entities/tipos';
import { formatarQuantidade } from '../../domain/services/organizacao';
import { Competencia } from '../../domain/valueObjects/Competencia';
import { Dinheiro } from '../../domain/valueObjects/Dinheiro';
import { Botao, Cartao, MensagemDeErro, TextoSuave } from '../components/base';
import { Icone } from '../components/Icone';
import { BotaoDeIcone, Cabecalho, Carregando, Pagina, Pilula } from '../components/ui';
import { useContainer } from '../hooks/AppProviders';
import { useNavegacao } from '../navigation/tipos';
import { espaco, fonte, raio, usePaleta } from '../theme';

const OPCOES: { origem: OrigemDaLista; titulo: string; texto: string }[] = [
  {
    origem: 'Padrao',
    titulo: 'Usar minha lista padrão',
    texto: 'Carrega seus produtos recorrentes para você escolher o que entra neste mês.',
  },
  {
    origem: 'Copiar',
    titulo: 'Copiar de outro mês',
    texto:
      'Parte de uma compra anterior. Tudo volta como pendente e os preços antigos ficam só de referência.',
  },
  {
    origem: 'Zero',
    titulo: 'Criar do zero',
    texto: 'Começa vazia e você adiciona os produtos que precisar.',
  },
];

type Etapa = 'inicio' | 'origem' | 'itens';

/** Linha da lista de seleção (serve para itens da lista padrão e de uma lista copiada). */
interface Selecionavel {
  id: string;
  nome: string;
  detalhe: string;
}

const daLista = (i: ItemDaLista): Selecionavel => ({
  id: i.id,
  nome: i.nome,
  detalhe: `${i.categoriaNome} · ${formatarQuantidade(i.quantidade)} ${rotuloDaUnidade(i.unidade)}${
    i.precoUnitario !== null ? ` · pago ${Dinheiro.deReais(i.precoUnitario).formatar()}` : ''
  }`,
});

const doModelo = (i: ItemDoModelo): Selecionavel => ({
  id: i.id,
  nome: i.nome,
  detalhe: `${i.categoriaNome} · ${formatarQuantidade(i.quantidade)} ${rotuloDaUnidade(i.unidade)}`,
});

/**
 * Criação da lista do mês. Três caminhos: lista padrão, cópia de qualquer mês anterior ou do zero.
 * Nos dois primeiros o usuário escolhe quais produtos entram. Os produtos são COPIADOS: a nova lista
 * nasce independente da origem, tudo pendente, e preços antigos servem só de referência.
 */
export function NovaListaScreen() {
  const p = usePaleta();
  const container = useContainer();
  const navegacao = useNavegacao();

  const [competencia, setCompetencia] = useState(Competencia.daData(new Date()));
  const [origem, setOrigem] = useState<OrigemDaLista>('Padrao');
  const [etapa, setEtapa] = useState<Etapa>('inicio');
  const [listasAnteriores, setListasAnteriores] = useState<ListaResumo[]>([]);
  const [listaDeOrigem, setListaDeOrigem] = useState<ListaResumo | null>(null);
  const [opcoes, setOpcoes] = useState<Selecionavel[]>([]);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pedirConfirmacao, setPedirConfirmacao] = useState(false);

  async function comCarregamento(acao: () => Promise<void>) {
    setErro(null);
    setCarregando(true);
    try {
      await acao();
    } catch (e) {
      setErro(mensagemParaUsuario(e));
    } finally {
      setCarregando(false);
    }
  }

  function mostrarSelecao(itens: Selecionavel[]) {
    setOpcoes(itens);
    setEscolhidos(new Set(itens.map((i) => i.id)));
    setEtapa('itens');
  }

  function aoContinuar() {
    if (origem === 'Zero') return void criar(false);

    void comCarregamento(async () => {
      if (origem === 'Padrao') {
        const itens = await container.listarItensDoModelo.executar();
        mostrarSelecao(itens.map(doModelo));
      } else {
        setListasAnteriores(await container.listarListas.executar());
        setEtapa('origem');
      }
    });
  }

  function escolherListaDeOrigem(lista: ListaResumo) {
    void comCarregamento(async () => {
      const completa = await container.obterLista.executar(lista.id);
      setListaDeOrigem(lista);
      mostrarSelecao(completa.itens.map(daLista));
    });
  }

  async function criar(permitirDuplicada: boolean) {
    setErro(null);
    setPedirConfirmacao(false);
    setCriando(true);
    try {
      const selecionados = opcoes.filter((i) => escolhidos.has(i.id)).map((i) => i.id);
      const lista = await container.criarLista.executar({
        competencia: competencia.chave,
        origem,
        itensDoModeloIds: origem === 'Padrao' ? selecionados : undefined,
        listaDeOrigemId: origem === 'Copiar' ? listaDeOrigem?.id : undefined,
        itensDeOrigemIds: origem === 'Copiar' ? selecionados : undefined,
        permitirDuplicada,
      });
      // A lista do mês atual é a da aba Lista (com a barra de navegação): vai para lá, sem tela à parte.
      // Lista de outro mês ou segunda lista do mesmo mês não é a "atual" da aba, então abre o detalhe dela.
      if (
        lista.resumo.principal &&
        lista.resumo.competencia === Competencia.daData(new Date()).chave
      ) {
        navegacao.navigate('Abas', { screen: 'Lista' });
      } else {
        navegacao.replace('DetalheDaLista', { listaId: lista.resumo.id });
      }
    } catch (e) {
      if (e instanceof ListaPrincipalJaExiste) setPedirConfirmacao(true);
      else setErro(mensagemParaUsuario(e));
    } finally {
      setCriando(false);
    }
  }

  function alternar(id: string) {
    setEscolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const aviso = pedirConfirmacao && (
    <Cartao estilo={{ gap: espaco.md, backgroundColor: p.alertaSuave, borderColor: p.alertaSuave }}>
      <Text style={{ color: p.texto, fontWeight: '700' }}>
        Já existe a lista principal de {competencia.nome}.
      </Text>
      <TextoSuave>
        Deseja criar outra lista neste mesmo mês? A principal continua como está.
      </TextoSuave>
      <Botao titulo="Criar outra lista mesmo assim" aoPressionar={() => void criar(true)} />
      <Botao titulo="Voltar" variante="texto" aoPressionar={() => setPedirConfirmacao(false)} />
    </Cartao>
  );

  if (etapa === 'origem') {
    return (
      <Pagina>
        <Cabecalho
          titulo="Copiar de qual mês?"
          aoVoltar={() => {
            setEtapa('inicio');
            setErro(null);
          }}
        />
        <ScrollView contentContainerStyle={estilos.conteudo}>
          <TextoSuave>
            Escolha a lista que será a base de {competencia.nome}. A lista original não é alterada.
          </TextoSuave>
          {carregando && <Carregando />}
          {!carregando && listasAnteriores.length === 0 && (
            <Cartao estilo={{ gap: espaco.sm }}>
              <Text style={{ color: p.texto, fontWeight: '700' }}>
                Ainda não há listas para copiar
              </Text>
              <TextoSuave>Crie a primeira lista do zero ou a partir da lista padrão.</TextoSuave>
            </Cartao>
          )}
          {listasAnteriores.map((lista) => (
            <Pressable
              key={lista.id}
              accessibilityRole="button"
              accessibilityLabel={`Copiar ${lista.competenciaNome}`}
              onPress={() => escolherListaDeOrigem(lista)}
            >
              <Cartao estilo={{ gap: espaco.xs }}>
                <View style={estilos.entre}>
                  <Text
                    style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '800', flex: 1 }}
                  >
                    {lista.competenciaNome}
                  </Text>
                  <Pilula
                    texto={lista.status === 'Finalizada' ? 'Finalizada' : 'Em andamento'}
                    tom={lista.status === 'Finalizada' ? 'neutro' : 'destaque'}
                  />
                </View>
                {!lista.principal && (
                  <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>{lista.nome}</Text>
                )}
                <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                  {lista.totalDeItens} {lista.totalDeItens === 1 ? 'produto' : 'produtos'} · gasto{' '}
                  {Dinheiro.deReais(lista.totalRealizado).formatar()}
                </Text>
              </Cartao>
            </Pressable>
          ))}
          <MensagemDeErro mensagem={erro} />
        </ScrollView>
      </Pagina>
    );
  }

  if (etapa === 'itens') {
    const selecionados = opcoes.filter((i) => escolhidos.has(i.id)).length;
    const vazioDoModelo = origem === 'Padrao' && opcoes.length === 0;
    return (
      <Pagina>
        <Cabecalho
          titulo="Escolha os produtos"
          aoVoltar={() => {
            setEtapa(origem === 'Copiar' ? 'origem' : 'inicio');
            setPedirConfirmacao(false);
            setErro(null);
          }}
        />
        <ScrollView contentContainerStyle={estilos.conteudo}>
          <TextoSuave>
            {origem === 'Copiar'
              ? `Itens de ${listaDeOrigem?.competenciaNome}. Tudo começa pendente; os preços pagos lá ficam só de referência.`
              : `Desmarque o que não precisa em ${competencia.nome}. Alterar aqui não muda a sua lista padrão.`}
          </TextoSuave>
          {vazioDoModelo ? (
            <Cartao estilo={{ gap: espaco.md }}>
              <Text style={{ color: p.texto, fontWeight: '700' }}>Sua lista padrão está vazia</Text>
              <TextoSuave>
                Cadastre seus produtos recorrentes na lista padrão ou crie esta lista do zero.
              </TextoSuave>
              <Botao
                titulo="Abrir lista padrão"
                variante="secundario"
                aoPressionar={() => navegacao.navigate('ListaPadrao')}
              />
            </Cartao>
          ) : (
            <>
              <View style={estilos.linhaAcoes}>
                <Botao
                  titulo="Marcar todos"
                  variante="texto"
                  aoPressionar={() => setEscolhidos(new Set(opcoes.map((i) => i.id)))}
                />
                <Botao
                  titulo="Desmarcar todos"
                  variante="texto"
                  aoPressionar={() => setEscolhidos(new Set())}
                />
              </View>
              <Cartao estilo={{ paddingVertical: 4 }}>
                {opcoes.map((item, indice) => {
                  const marcado = escolhidos.has(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: marcado }}
                      onPress={() => alternar(item.id)}
                      style={[
                        estilos.linhaDoItem,
                        { borderTopColor: p.linha, borderTopWidth: indice === 0 ? 0 : 1 },
                      ]}
                    >
                      <View
                        style={[
                          estilos.caixa,
                          {
                            borderColor: marcado ? p.destaque : p.textoSuave,
                            backgroundColor: marcado ? p.destaque : 'transparent',
                          },
                        ]}
                      >
                        {marcado && (
                          <Icone
                            nome="check"
                            tamanho={16}
                            cor={p.textoSobreDestaque}
                            espessura={3}
                          />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: p.texto, fontWeight: '600', fontSize: fonte.corpo }}>
                          {item.nome}
                        </Text>
                        <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                          {item.detalhe}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </Cartao>
            </>
          )}
          {aviso}
          <MensagemDeErro mensagem={erro} />
          <Botao
            titulo={
              vazioDoModelo
                ? 'Criar lista vazia'
                : `Criar lista com ${selecionados} ${selecionados === 1 ? 'produto' : 'produtos'}`
            }
            carregando={criando}
            desabilitado={!vazioDoModelo && selecionados === 0}
            aoPressionar={() => void criar(false)}
          />
        </ScrollView>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <Cabecalho titulo="Nova lista" aoVoltar={() => navegacao.goBack()} />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Cartao estilo={estilos.seletorDeMes}>
          <BotaoDeIcone
            icone="voltar"
            rotulo="Mês anterior"
            aoPressionar={() => setCompetencia(competencia.anterior())}
          />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                color: p.textoSuave,
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Mês da compra
            </Text>
            <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '800' }}>
              {competencia.nome}
            </Text>
          </View>
          <BotaoDeIcone
            icone="seta"
            rotulo="Próximo mês"
            aoPressionar={() => setCompetencia(competencia.proxima())}
          />
        </Cartao>

        {OPCOES.map((o) => (
          <Pressable
            key={o.origem}
            accessibilityRole="radio"
            accessibilityState={{ selected: origem === o.origem }}
            onPress={() => setOrigem(o.origem)}
            style={[
              estilos.opcao,
              {
                backgroundColor: p.superficie,
                borderColor: origem === o.origem ? p.destaque : p.linha,
                borderWidth: origem === o.origem ? 2 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espaco.md }}>
              {/* Marca de seleção: o estado não depende só da cor da borda. */}
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: origem === o.origem ? p.destaque : p.bordaCampo,
                  backgroundColor: origem === o.origem ? p.destaque : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {origem === o.origem && (
                  <Icone nome="check" cor={p.textoSobreDestaque} tamanho={14} espessura={3} />
                )}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: p.texto, fontSize: fonte.corpo, fontWeight: '700' }}>
                  {o.titulo}
                </Text>
                <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>{o.texto}</Text>
              </View>
            </View>
          </Pressable>
        ))}

        {aviso}
        <MensagemDeErro mensagem={erro} />
        {carregando ? (
          <Carregando />
        ) : (
          <Botao
            titulo={origem === 'Zero' ? 'Criar lista vazia' : 'Continuar'}
            carregando={criando}
            aoPressionar={aoContinuar}
          />
        )}
      </ScrollView>
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: 40 },
  seletorDeMes: { flexDirection: 'row', alignItems: 'center', paddingVertical: espaco.sm },
  opcao: { borderRadius: raio.lg, padding: espaco.lg, gap: 4 },
  entre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  linhaAcoes: { flexDirection: 'row', justifyContent: 'space-between' },
  linhaDoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    paddingVertical: espaco.md,
    minHeight: 56,
  },
  caixa: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
