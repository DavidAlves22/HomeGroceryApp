import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import { ListaPrincipalJaExiste } from '../../application/useCases/listas';
import {
  rotuloDaUnidade,
  type ItemDoModelo,
  type OrigemDaLista,
} from '../../domain/entities/tipos';
import { formatarQuantidade } from '../../domain/services/organizacao';
import { Competencia } from '../../domain/valueObjects/Competencia';
import { Botao, Cartao, MensagemDeErro, TextoSuave } from '../components/base';
import { Icone } from '../components/Icone';
import { BotaoDeIcone, Cabecalho, Carregando, Pagina } from '../components/ui';
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
    origem: 'Zero',
    titulo: 'Criar do zero',
    texto: 'Começa vazia e você adiciona os produtos que precisar.',
  },
];

/**
 * Criação da lista do mês em duas etapas: 1) mês e origem; 2) (só para a lista padrão) quais produtos entram.
 * Os produtos escolhidos são COPIADOS: a nova lista passa a ser independente da lista padrão.
 */
export function NovaListaScreen() {
  const p = usePaleta();
  const container = useContainer();
  const navegacao = useNavegacao();

  const [competencia, setCompetencia] = useState(Competencia.daData(new Date()));
  const [origem, setOrigem] = useState<OrigemDaLista>('Padrao');
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [modelo, setModelo] = useState<ItemDoModelo[]>([]);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pedirConfirmacao, setPedirConfirmacao] = useState(false);

  async function continuar() {
    setErro(null);
    if (origem === 'Zero') return criar(false);

    setCarregando(true);
    try {
      const itens = await container.listarItensDoModelo.executar();
      setModelo(itens);
      setEscolhidos(new Set(itens.map((i) => i.id)));
      setEtapa(2);
    } catch (e) {
      setErro(mensagemParaUsuario(e));
    } finally {
      setCarregando(false);
    }
  }

  async function criar(permitirDuplicada: boolean) {
    setErro(null);
    setPedirConfirmacao(false);
    setCriando(true);
    try {
      const lista = await container.criarLista.executar({
        competencia: competencia.chave,
        origem,
        itensDoModeloIds:
          origem === 'Padrao'
            ? modelo.filter((i) => escolhidos.has(i.id)).map((i) => i.id)
            : undefined,
        permitirDuplicada,
      });
      navegacao.replace('DetalheDaLista', { listaId: lista.resumo.id });
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

  if (etapa === 2) {
    const selecionados = modelo.filter((i) => escolhidos.has(i.id)).length;
    return (
      <Pagina>
        <Cabecalho
          titulo="Escolha os produtos"
          aoVoltar={() => {
            setEtapa(1);
            setPedirConfirmacao(false);
          }}
        />
        <ScrollView contentContainerStyle={estilos.conteudo}>
          <TextoSuave>
            Desmarque o que não precisa em {competencia.nome}. Alterar aqui não muda a sua lista
            padrão.
          </TextoSuave>
          {modelo.length === 0 ? (
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
                  aoPressionar={() => setEscolhidos(new Set(modelo.map((i) => i.id)))}
                />
                <Botao
                  titulo="Desmarcar todos"
                  variante="texto"
                  aoPressionar={() => setEscolhidos(new Set())}
                />
              </View>
              <Cartao estilo={{ paddingVertical: 4 }}>
                {modelo.map((item, indice) => {
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
                          {item.categoriaNome} · {formatarQuantidade(item.quantidade)}{' '}
                          {rotuloDaUnidade(item.unidade)}
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
              modelo.length === 0
                ? 'Criar lista vazia'
                : `Criar lista com ${selecionados} ${selecionados === 1 ? 'produto' : 'produtos'}`
            }
            carregando={criando}
            desabilitado={modelo.length > 0 && selecionados === 0}
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
                fontSize: 11,
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
            <Text style={{ color: p.texto, fontSize: fonte.corpo, fontWeight: '700' }}>
              {o.titulo}
            </Text>
            <Text style={{ color: p.textoSuave, fontSize: fonte.pequena }}>{o.texto}</Text>
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
            aoPressionar={() => void continuar()}
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
