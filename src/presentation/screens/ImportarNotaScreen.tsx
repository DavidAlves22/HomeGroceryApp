import { useRoute, type RouteProp } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import type { ItemDaLista } from '../../domain/entities/tipos';
import {
  lerNotaFiscal,
  nomeLegivel,
  precoParaOApp,
  sugerirPares,
  unidadeDaNota,
  unidadeReconhecidaDaNota,
  type ItemDaNota,
  type NotaLida,
} from '../../domain/services/notaFiscal';
import { rotuloDaUnidade } from '../../domain/entities/tipos';
import { formatarQuantidade, normalizar } from '../../domain/services/organizacao';
import { formatarCnpj, lerLinkDaNota, type LinkDaNota } from '../../domain/services/qrDaNota';
import { Dinheiro } from '../../domain/valueObjects/Dinheiro';
import { Botao, Campo, Cartao, MensagemDeErro, TextoSuave } from '../components/base';
import { CameraDoQr } from '../components/CameraDoQr';
import { Moldura, TituloDaFolha } from '../components/Folhas';
import {
  BlocoDaFolha,
  Cabecalho,
  CampoDeBusca,
  Carregando,
  Chip,
  DivisorOu,
  EstadoVazio,
  GatilhoDeSeletor,
  Pagina,
  PainelDeOpcoes,
  Pilula,
  TituloDeSecao,
} from '../components/ui';
import { useContainer } from '../hooks/AppProviders';
import { useCarregar } from '../hooks/dados';
import { useToast } from '../hooks/Toast';
import { useNavegacao, type RootStackParamList } from '../navigation/tipos';
import { espaco, fonte, raio, usePaleta } from '../theme';

type Escolha =
  | { tipo: 'item'; itemId: string }
  | { tipo: 'novo'; categoriaId: string; nome: string }
  | { tipo: 'ignorar' };

type Origem = 'vinculo' | 'nome' | 'manual' | 'nenhuma';

interface Linha {
  item: ItemDaNota;
  escolha: Escolha;
  origem: Origem;
  /** O par que o item tinha antes de ser ignorado (para "Desfazer"). */
  antes?: { escolha: Escolha; origem: Origem };
}

type Fase = 'colar' | 'revisar' | 'pronto';

const reais = (n: number) => Dinheiro.deReais(n).formatar();
const soDigitos = (texto: string | null) => (texto ?? '').replace(/\D/g, '');

/**
 * Importa o texto de uma nota fiscal (NFC-e): o usuário abre o link do QR da nota no navegador, copia o texto da
 * página e cola aqui. O app lê os itens, sugere o par de cada um na lista (pelo código do mercado já ensinado, ou pelo
 * nome parecido) e, ao confirmar, preenche preço e quantidade pagos e marca como comprado. Pode ser feito em casa,
 * depois de finalizar a compra, uma nota por mercado.
 */
export function ImportarNotaScreen() {
  const p = usePaleta();
  const container = useContainer();
  const navegacao = useNavegacao();
  const toast = useToast();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ImportarNota'>>();
  const {
    dados: lista,
    carregando,
    erro,
    recarregar,
  } = useCarregar(() => container.obterLista.executar(params.listaId), params.listaId);
  const { dados: categorias } = useCarregar(
    () => container.listarCategorias.executar(),
    'categorias',
  );
  const { dados: mercados } = useCarregar(() => container.listarMercados.executar(), 'mercados');

  // QR lido pela câmera: dá o link da nota, o CNPJ (mercado certo) e a chave (nota repetida), sem precisar do texto.
  const [camera, setCamera] = useState(false);
  const [qr, setQr] = useState<LinkDaNota | null>(null);
  const [jaImportada, setJaImportada] = useState(false);
  const ultimoAvisoDoQr = useRef(0);
  const [fase, setFase] = useState<Fase>('colar');
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [nota, setNota] = useState<NotaLida | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [mercadoId, setMercadoId] = useState<string | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  // Cada vez que uma linha é aberta, a busca e a lista de categorias recomeçam.
  useEffect(() => {
    setBuscaNaLista('');
    setEscolhendoCategoria(false);
  }, [editando]);
  const [nomeNovo, setNomeNovo] = useState('');
  // Folha de escolha do par: busca na lista e categoria do item novo (lista suspensa). Recomeçam a cada abertura.
  const [buscaNaLista, setBuscaNaLista] = useState('');
  const [escolhendoCategoria, setEscolhendoCategoria] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{
    itens: number;
    novos: number;
    total: number;
  } | null>(null);

  if (carregando && !lista)
    return (
      <Pagina>
        <Carregando />
      </Pagina>
    );
  if (!lista) {
    return (
      <Pagina>
        <Cabecalho titulo="Importar nota" aoVoltar={() => navegacao.goBack()} />
        <EstadoVazio
          titulo="Não foi possível abrir a lista"
          texto={erro ?? 'A lista não está mais disponível.'}
          acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void recarregar() }}
        />
      </Pagina>
    );
  }

  const itensDaLista = lista.itens;
  const categoriaPadrao = categorias?.find((c) => c.nome === 'Outros') ?? categorias?.[0];
  const itemPorId = (id: string): ItemDaLista | undefined => itensDaLista.find((i) => i.id === id);
  const nomeDaCategoria = (id: string) => categorias?.find((c) => c.id === id)?.nome ?? '';

  /** Cada QR que a câmera encontra; `true` encerra a leitura. QR que não é de NFC-e é ignorado (com um aviso de vez em quando). */
  function aoLerQr(conteudo: string): boolean {
    const lido = lerLinkDaNota(conteudo);
    if (!lido) {
      if (Date.now() - ultimoAvisoDoQr.current > 3000) {
        ultimoAvisoDoQr.current = Date.now();
        toast('Este QR não é de uma nota fiscal (NFC-e).');
      }
      return false;
    }
    setQr(lido);
    setJaImportada(false);
    setAviso(null);
    void container.consultarNotaImportada
      .executar(lido.chave)
      .then(setJaImportada)
      .catch(() => {
        // Sem resposta agora: a importação ainda barra a nota repetida.
      });
    return true;
  }

  async function ler() {
    setAviso(null);
    const lida = lerNotaFiscal(texto);
    if (lida.itens.length === 0) {
      setAviso(lida.avisos[0] ?? 'Não encontrei nenhum item.');
      return;
    }
    let vinculos = new Map<string, string>();
    try {
      const achados = await container.obterVinculosDaNota.executar(lida.mercado.cnpj);
      vinculos = new Map(achados.map((v) => [v.codigo, v.produtoId]));
    } catch {
      // Sem os pares aprendidos o app sugere só pelo nome; a importação continua possível.
    }
    const pares = sugerirPares(lida.itens, itensDaLista, vinculos);
    setLinhas(
      lida.itens.map((item, i): Linha => {
        const par = pares.get(i);
        if (par) return { item, escolha: { tipo: 'item', itemId: par.itemId }, origem: par.origem };
        return {
          item,
          escolha: {
            tipo: 'novo',
            categoriaId: categoriaPadrao?.id ?? '',
            nome: nomeLegivel(item.nome),
          },
          origem: 'nenhuma',
        };
      }),
    );
    const digitos = soDigitos(lida.mercado.cnpj) || qr?.cnpj || '';
    setMercadoId(mercados?.find((m) => m.cnpj && m.cnpj === digitos)?.id ?? null);
    // O QR de uma nota e o texto de outra: o QR é descartado para não barrar a importação por engano.
    if (qr && soDigitos(lida.mercado.cnpj) && soDigitos(lida.mercado.cnpj) !== qr.cnpj) {
      setQr(null);
      toast('O QR lido é de outro mercado; usei só o texto colado.');
    }
    setNota(lida);
    setFase('revisar');
  }

  function escolher(indice: number, escolha: Escolha) {
    setLinhas((atual) =>
      atual.map((l, i) => (i === indice ? { ...l, escolha, origem: 'manual' } : l)),
    );
    setEditando(null);
  }

  /** Liga/desliga "ignorar" direto na linha. Ao desfazer volta ao par que o item tinha (por código, por nome ou o que você escolheu). */
  function alternarIgnorar(indice: number) {
    setLinhas((atual) =>
      atual.map((l, i) => {
        if (i !== indice) return l;
        if (l.escolha.tipo !== 'ignorar') {
          return {
            ...l,
            antes: { escolha: l.escolha, origem: l.origem },
            escolha: { tipo: 'ignorar' },
          };
        }
        return {
          ...l,
          escolha: l.antes?.escolha ?? l.escolha,
          origem: l.antes?.origem ?? l.origem,
          antes: undefined,
        };
      }),
    );
  }

  const usadas = linhas.filter((l) => l.escolha.tipo !== 'ignorar');
  const novos = usadas.filter((l) => l.escolha.tipo === 'novo').length;
  const casados = usadas.length - novos;
  const totalImportado = usadas.reduce((t, l) => t + l.item.valorTotal, 0);
  const jaTinhamPreco = usadas.filter((l) => {
    if (l.escolha.tipo !== 'item') return false;
    const item = itemPorId(l.escolha.itemId);
    return !!item && item.precoUnitario !== null;
  }).length;
  const semCategoria = linhas.some((l) => l.escolha.tipo === 'novo' && !l.escolha.categoriaId);

  async function importar() {
    if (!nota) return;
    setEnviando(true);
    setAviso(null);
    try {
      await container.importarNota.executar(params.listaId, {
        cnpj: nota.mercado.cnpj,
        mercadoId,
        chaveDeAcesso: qr?.chave ?? null,
        itens: usadas.map((l) => ({
          codigo: l.item.codigo,
          nome: l.escolha.tipo === 'novo' ? l.escolha.nome : l.item.nome,
          quantidade: l.item.quantidade,
          precoUnitario: precoParaOApp(l.item),
          itemId: l.escolha.tipo === 'item' ? l.escolha.itemId : null,
          categoriaId: l.escolha.tipo === 'novo' ? l.escolha.categoriaId : null,
          unidade: unidadeReconhecidaDaNota(l.item.unidadeNaNota),
        })),
      });
      setResultado({ itens: casados, novos, total: totalImportado });
      setFase('pronto');
      toast('Nota importada');
      void recarregar();
    } catch (e) {
      setAviso(mensagemParaUsuario(e));
    } finally {
      setEnviando(false);
    }
  }

  function outraNota() {
    setTexto('');
    setNota(null);
    setLinhas([]);
    setResultado(null);
    setAviso(null);
    setQr(null);
    setJaImportada(false);
    setFase('colar');
  }

  const linhaEmEdicao = editando !== null ? linhas[editando] : null;
  const termoDaBusca = normalizar(buscaNaLista.trim());
  const itensParaEscolher = [...itensDaLista]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
    .filter((item) => !termoDaBusca || normalizar(item.nome).includes(termoDaBusca));
  const categoriasEmOrdem = [...(categorias ?? [])].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
  );

  return (
    <Pagina>
      <Cabecalho titulo="Importar nota" aoVoltar={() => navegacao.goBack()} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        {fase === 'colar' && (
          <>
            {container.leitorDeQr.suportado() && !qr && (
              <Cartao estilo={{ gap: espaco.sm }}>
                <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '700' }}>
                  Comece pelo QR da nota
                </Text>
                <TextoSuave>
                  A câmera lê o QR do cupom aqui mesmo. O app já reconhece o mercado e avisa se a
                  nota foi importada antes.
                </TextoSuave>
                <Botao titulo="Ler QR da nota com a câmera" aoPressionar={() => setCamera(true)} />
              </Cartao>
            )}
            {qr && (
              <Cartao estilo={{ gap: espaco.sm }}>
                <Pilula
                  texto={jaImportada ? 'Já importada' : 'QR lido'}
                  tom={jaImportada ? 'alerta' : 'destaque'}
                />
                <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '800' }}>
                  {mercados?.find((m) => m.cnpj === qr.cnpj)?.nome ??
                    `CNPJ ${formatarCnpj(qr.cnpj)}`}
                </Text>
                <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                  {qr.mes} · {qr.uf}
                  {mercados?.find((m) => m.cnpj === qr.cnpj)
                    ? ' · mercado reconhecido pelo CNPJ'
                    : ''}
                </Text>
                {jaImportada ? (
                  <TextoSuave>
                    Esta nota já foi importada neste grupo. Não precisa importar de novo; leia o QR
                    de outra nota.
                  </TextoSuave>
                ) : (
                  <TextoSuave>
                    1. Toque em “Abrir a nota” (abre numa nova aba).{'\n'}2. Selecione todo o texto,
                    copie e volte para esta aba.{'\n'}3. Cole o texto abaixo.
                  </TextoSuave>
                )}
                {!jaImportada && (
                  <Botao titulo="Abrir a nota" aoPressionar={() => void Linking.openURL(qr.link)} />
                )}
                <Botao
                  titulo="Ler outro QR"
                  variante="texto"
                  aoPressionar={() => {
                    setQr(null);
                    setJaImportada(false);
                    setCamera(true);
                  }}
                />
              </Cartao>
            )}
            {!jaImportada && (
              <>
                <Cartao estilo={{ gap: espaco.sm }}>
                  <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '700' }}>
                    Cole o texto da nota fiscal
                  </Text>
                  <TextoSuave>
                    1. Abra o link do QR da nota no navegador.{'\n'}2. Selecione todo o texto da
                    página e copie.{'\n'}
                    3. Cole aqui. Com 2 ou 3 mercados, importe uma nota de cada vez.
                  </TextoSuave>
                </Cartao>
                <Campo
                  rotulo="Texto da nota"
                  value={texto}
                  onChangeText={setTexto}
                  multiline
                  numberOfLines={8}
                  placeholder="Cole aqui"
                  style={{ minHeight: 160, textAlignVertical: 'top' }}
                />
                <MensagemDeErro mensagem={aviso} />
                <Botao
                  titulo="Ler nota"
                  desabilitado={texto.trim().length < 20}
                  aoPressionar={() => void ler()}
                />
              </>
            )}
          </>
        )}

        {fase === 'revisar' && nota && (
          <>
            <Cartao estilo={{ gap: espaco.sm }}>
              <Text style={{ color: p.texto, fontSize: fonte.titulo, fontWeight: '800' }}>
                {nota.mercado.nome ?? 'Nota fiscal'}
              </Text>
              <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                {nota.itens.length} {nota.itens.length === 1 ? 'item' : 'itens'}
                {nota.totalDaNota !== null ? ` · total da nota ${reais(nota.totalDaNota)}` : ''}
              </Text>
              {nota.avisos.map((a) => (
                <Text
                  key={a}
                  style={{ color: p.alerta, fontSize: fonte.pequena, fontWeight: '600' }}
                >
                  {a}
                </Text>
              ))}
            </Cartao>

            {mercados && mercados.length > 0 && (
              <Cartao estilo={{ gap: espaco.sm }}>
                <TituloDeSecao>Mercado desta nota</TituloDeSecao>
                <View style={estilos.chips}>
                  {mercados.map((m) => (
                    <Chip
                      key={m.id}
                      rotulo={m.nome}
                      ativo={mercadoId === m.id}
                      aoPressionar={() => setMercadoId(m.id)}
                    />
                  ))}
                  <Chip
                    rotulo="Outro"
                    ativo={mercadoId === null}
                    aoPressionar={() => setMercadoId(null)}
                  />
                </View>
                <TextoSuave>
                  {mercadoId !== null && mercados.find((m) => m.id === mercadoId)?.cnpj
                    ? 'Reconheci este mercado pelo CNPJ da nota.'
                    : 'Escolha uma vez: nas próximas notas deste CNPJ o mercado já vem marcado.'}
                </TextoSuave>
              </Cartao>
            )}

            <TituloDeSecao>Confira os pares (toque para trocar)</TituloDeSecao>
            {linhas.map((linha, indice) => (
              <Pressable
                key={`${linha.item.codigo}-${indice}`}
                accessibilityRole="button"
                accessibilityLabel={`Trocar o par de ${linha.item.nome}`}
                onPress={() => {
                  setEditando(indice);
                  setNomeNovo(
                    linha.escolha.tipo === 'novo'
                      ? linha.escolha.nome
                      : nomeLegivel(linha.item.nome),
                  );
                }}
                style={[
                  estilos.linha,
                  {
                    borderColor: p.linha,
                    backgroundColor:
                      linha.escolha.tipo === 'ignorar' ? p.superficie2 : p.superficie,
                  },
                ]}
              >
                <View style={estilos.entre}>
                  <Text
                    numberOfLines={2}
                    style={{ flex: 1, color: p.texto, fontSize: fonte.corpo, fontWeight: '700' }}
                  >
                    {linha.escolha.tipo === 'novo'
                      ? linha.escolha.nome
                      : nomeLegivel(linha.item.nome)}
                  </Text>
                  <Text
                    style={{ color: p.texto, fontWeight: '700', fontVariant: ['tabular-nums'] }}
                  >
                    {reais(linha.item.valorTotal)}
                  </Text>
                </View>
                <View style={estilos.entre}>
                  <Text
                    style={{
                      color: p.textoSuave,
                      fontSize: fonte.pequena,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {formatarQuantidade(linha.item.quantidade)} × {reais(linha.item.valorUnitario)}
                  </Text>
                  {/* Ignorar sem abrir a folha: um toque, e "Desfazer" devolve o par que o item tinha. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${linha.escolha.tipo === 'ignorar' ? 'Desfazer ignorar' : 'Ignorar'} ${linha.item.nome}`}
                    onPress={() => alternarIgnorar(indice)}
                    hitSlop={6}
                    style={[
                      estilos.botaoIgnorar,
                      { borderColor: p.linha, backgroundColor: p.superficie },
                    ]}
                  >
                    <Text style={{ color: p.textoSuave, fontSize: 12, fontWeight: '700' }}>
                      {linha.escolha.tipo === 'ignorar' ? 'Desfazer' : 'Ignorar'}
                    </Text>
                  </Pressable>
                </View>
                <View style={estilos.entre}>
                  {linha.escolha.tipo === 'item' ? (
                    <Text
                      style={{
                        flex: 1,
                        color: p.destaque,
                        fontSize: fonte.pequena,
                        fontWeight: '700',
                      }}
                    >
                      → {itemPorId(linha.escolha.itemId)?.nome ?? 'item da lista'}
                    </Text>
                  ) : linha.escolha.tipo === 'novo' ? (
                    <Text
                      style={{
                        flex: 1,
                        color: p.texto,
                        fontSize: fonte.pequena,
                        fontWeight: '700',
                      }}
                    >
                      + Novo item · {nomeDaCategoria(linha.escolha.categoriaId) || 'sem categoria'}
                    </Text>
                  ) : (
                    <Text
                      style={{
                        flex: 1,
                        color: p.textoSuave,
                        fontSize: fonte.pequena,
                        fontWeight: '700',
                      }}
                    >
                      Ignorado
                    </Text>
                  )}
                  {linha.origem === 'vinculo' && <Pilula texto="pelo código" tom="neutro" />}
                  {linha.origem === 'nome' && <Pilula texto="pelo nome" tom="neutro" />}
                </View>
              </Pressable>
            ))}

            <Cartao estilo={{ gap: espaco.xs }}>
              <Text style={{ color: p.texto, fontSize: fonte.corpo, fontWeight: '700' }}>
                {casados} da lista · {novos} {novos === 1 ? 'novo' : 'novos'} ·{' '}
                {linhas.length - usadas.length} ignorados
              </Text>
              <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                Vão entrar como comprados, somando {reais(totalImportado)}.
                {jaTinhamPreco > 0
                  ? ` ${jaTinhamPreco} ${jaTinhamPreco === 1 ? 'item já tinha' : 'itens já tinham'} preço e será atualizado pela nota.`
                  : ''}
              </Text>
            </Cartao>
            <MensagemDeErro mensagem={aviso} />
            <Botao
              titulo={`Importar ${usadas.length} ${usadas.length === 1 ? 'item' : 'itens'}`}
              carregando={enviando}
              desabilitado={usadas.length === 0 || semCategoria}
              aoPressionar={() => void importar()}
            />
            <Botao titulo="Voltar para colar" variante="texto" aoPressionar={outraNota} />
          </>
        )}

        {fase === 'pronto' && resultado && (
          <>
            <Cartao estilo={{ gap: espaco.sm }}>
              <Pilula texto="Nota importada" tom="destaque" />
              <Text style={{ color: p.texto, fontSize: 24, fontWeight: '800' }}>
                {reais(resultado.total)}
              </Text>
              <TextoSuave>
                {resultado.itens}{' '}
                {resultado.itens === 1
                  ? 'item da lista foi preenchido'
                  : 'itens da lista foram preenchidos'}
                {resultado.novos > 0
                  ? ` e ${resultado.novos} ${resultado.novos === 1 ? 'item novo entrou' : 'itens novos entraram'} na lista`
                  : ''}
                . O gasto do mês já está atualizado.
              </TextoSuave>
            </Cartao>
            <Botao icone="nota" titulo="Importar outra nota" aoPressionar={outraNota} />
            <Botao
              titulo="Concluir"
              variante="secundario"
              aoPressionar={() => navegacao.goBack()}
            />
          </>
        )}
      </ScrollView>

      <CameraDoQr visivel={camera} aoLer={aoLerQr} aoFechar={() => setCamera(false)} />

      <Moldura visivel={editando !== null} aoFechar={() => setEditando(null)}>
        {linhaEmEdicao && editando !== null && (
          <>
            <TituloDaFolha>{linhaEmEdicao.item.nome}</TituloDaFolha>
            <TextoSuave>
              {formatarQuantidade(linhaEmEdicao.item.quantidade)}{' '}
              {rotuloDaUnidade(unidadeDaNota(linhaEmEdicao.item.unidadeNaNota))} ·{' '}
              {reais(linhaEmEdicao.item.valorTotal)}
            </TextoSuave>

            <BlocoDaFolha
              titulo="É um item da sua lista"
              dica="Busque pelo nome e toque no item para usá-lo como par."
            >
              <CampoDeBusca
                destacado
                valor={buscaNaLista}
                aoMudar={setBuscaNaLista}
                placeholder="Buscar produto"
              />
              {itensParaEscolher.length === 0 && (
                <TextoSuave>Nenhum item da sua lista com esse nome.</TextoSuave>
              )}
              <ScrollView
                style={{ maxHeight: 320 }}
                contentContainerStyle={{ gap: espaco.sm }}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {itensParaEscolher.map((item) => {
                  const marcado =
                    linhaEmEdicao.escolha.tipo === 'item' &&
                    linhaEmEdicao.escolha.itemId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Usar ${item.nome}`}
                      onPress={() => escolher(editando, { tipo: 'item', itemId: item.id })}
                      style={[
                        estilos.opcao,
                        {
                          borderColor: marcado ? p.destaque : p.linha,
                          backgroundColor: marcado ? p.destaqueSuave : p.superficie,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          flex: 1,
                          color: p.texto,
                          fontSize: fonte.corpo,
                          fontWeight: '600',
                        }}
                      >
                        {item.nome}
                      </Text>
                      <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>
                        {item.comprado ? 'comprado' : 'pendente'}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </BlocoDaFolha>

            <DivisorOu />

            <BlocoDaFolha
              titulo="Adicionar como item novo"
              dica="Se este produto ainda não está na sua lista."
            >
              <Campo
                destacado
                rotulo="Nome do item novo"
                value={nomeNovo}
                onChangeText={setNomeNovo}
                maxLength={120}
              />
              <Text style={{ color: p.texto, fontSize: 14, fontWeight: '700' }}>
                Categoria do item novo
              </Text>
              <GatilhoDeSeletor
                rotulo="Categoria"
                valor={
                  (linhaEmEdicao.escolha.tipo === 'novo' &&
                    nomeDaCategoria(linhaEmEdicao.escolha.categoriaId)) ||
                  'Escolha a categoria'
                }
                aberto={escolhendoCategoria}
                aoPressionar={() => setEscolhendoCategoria(!escolhendoCategoria)}
              />
              {escolhendoCategoria && (
                <PainelDeOpcoes
                  titulo="Escolher a categoria"
                  opcoes={categoriasEmOrdem.map((c) => ({
                    chave: c.id,
                    rotulo: c.nome,
                    marcada:
                      linhaEmEdicao.escolha.tipo === 'novo' &&
                      linhaEmEdicao.escolha.categoriaId === c.id,
                    aoPressionar: () => {
                      escolher(editando, {
                        tipo: 'novo',
                        categoriaId: c.id,
                        nome: nomeNovo.trim() || linhaEmEdicao.item.nome,
                      });
                      setEscolhendoCategoria(false);
                    },
                  }))}
                />
              )}
            </BlocoDaFolha>
            <Botao
              titulo="Ignorar este item da nota"
              variante="secundario"
              aoPressionar={() => escolher(editando, { tipo: 'ignorar' })}
            />
            <Botao titulo="Fechar" variante="texto" aoPressionar={() => setEditando(null)} />
          </>
        )}
      </Moldura>
    </Pagina>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  entre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  linha: { borderWidth: 1, borderRadius: raio.md, padding: espaco.md, gap: 2 },
  botaoIgnorar: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: raio.pilula,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcao: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    paddingHorizontal: espaco.md,
    borderWidth: 1,
    borderRadius: raio.md,
  },
});
