import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { mensagemParaUsuario } from '../../application/errors';
import {
  rotuloDaUnidade,
  UNIDADES,
  type Categoria,
  type DadosDoItem,
  type Produto,
  type Unidade,
} from '../../domain/entities/tipos';
import { useVoltarFecha } from '../hooks/useVoltarFecha';
import { espaco, fonte, raio, usePaleta } from '../theme';
import { Botao, Campo, MensagemDeErro } from './base';
import { CampoNumerico } from './CampoNumerico';
import { SeletorDeOpcao } from './SeletorDeOpcao';
import { Chip, GatilhoDeSeletor } from './ui';

export function Moldura({
  visivel,
  aoFechar,
  children,
}: {
  visivel: boolean;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  const p = usePaleta();
  // O voltar do celular/navegador fecha a folha em vez de sair da tela por baixo dela.
  useVoltarFecha(visivel, aoFechar);
  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={aoFechar}>
      <KeyboardAvoidingView
        style={estilos.fundo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable accessibilityLabel="Fechar" style={StyleSheet.absoluteFill} onPress={aoFechar} />
        <View style={[estilos.folha, { backgroundColor: p.superficie }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: espaco.md }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function TituloDaFolha({ children }: { children: React.ReactNode }) {
  const p = usePaleta();
  return <Text style={[estilos.titulo, { color: p.texto }]}>{children}</Text>;
}

export function RotuloDaFolha({ children }: { children: React.ReactNode }) {
  const p = usePaleta();
  return <Text style={[estilos.rotulo, { color: p.textoSuave }]}>{children}</Text>;
}

/** Botão de exclusão que pede um segundo toque (operação destrutiva sempre confirma). */
function BotaoExcluir({
  aoConfirmar,
  carregando,
}: {
  aoConfirmar: () => void;
  carregando: boolean;
}) {
  const p = usePaleta();
  const [confirmando, setConfirmando] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (confirmando ? aoConfirmar() : setConfirmando(true))}
      disabled={carregando}
      style={[
        estilos.excluir,
        { borderColor: p.alerta, backgroundColor: confirmando ? p.alerta : 'transparent' },
      ]}
    >
      <Text style={{ color: confirmando ? p.textoSobreDestaque : p.alerta, fontWeight: '700' }}>
        {confirmando ? 'Toque de novo para confirmar' : 'Excluir'}
      </Text>
    </Pressable>
  );
}

interface FolhaDeItemProps {
  visivel: boolean;
  titulo: string;
  categorias: Categoria[];
  inicial?: Partial<DadosDoItem>;
  /** Mostra preço estimado, preço pago e quantidade comprada (só nas listas mensais). */
  comPrecos?: boolean;
  rotuloDoBotao: string;
  buscarSugestoes: (termo: string) => Promise<Produto[]>;
  /** Favoritos e recorrentes, mostrados enquanto o nome está vazio (só ao adicionar). */
  sugestoesIniciais?: Produto[];
  aoSalvar: (dados: DadosDoItem) => Promise<void>;
  aoExcluir?: () => Promise<void>;
  aoFechar: () => void;
}

/**
 * Formulário de produto usado na lista padrão e nas listas mensais.
 * Enquanto o usuário digita o nome, sugere produtos já cadastrados: tocar numa sugestão reaproveita
 * o cadastro (categoria e unidade) em vez de criar um "Arroz" duplicado.
 */
export function FolhaDeItem({
  visivel,
  titulo,
  categorias,
  inicial,
  comPrecos = false,
  rotuloDoBotao,
  buscarSugestoes,
  sugestoesIniciais = [],
  aoSalvar,
  aoExcluir,
  aoFechar,
}: FolhaDeItemProps) {
  const [nome, setNome] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [unidade, setUnidade] = useState<Unidade>('Unidade');
  const [quantidade, setQuantidade] = useState<number | null>(1);
  const [precoEstimado, setPrecoEstimado] = useState<number | null>(null);
  const [precoPago, setPrecoPago] = useState<number | null>(null);
  const [quantidadeComprada, setQuantidadeComprada] = useState<number | null>(null);
  // Lista de escolha aberta (unidade ou categoria): modal em tela cheia sobre a folha, uma de cada vez.
  const [painel, setPainel] = useState<'unidade' | 'categoria' | null>(null);
  const [sugestoes, setSugestoes] = useState<Produto[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const ultimaBusca = useRef(0);

  useEffect(() => {
    if (!visivel) return;
    setNome(inicial?.nome ?? '');
    setCategoriaId(
      inicial?.categoriaId ??
        categorias.find((c) => c.nome === 'Outros')?.id ??
        categorias[0]?.id ??
        '',
    );
    setUnidade(inicial?.unidade ?? 'Unidade');
    setQuantidade(inicial?.quantidade ?? 1);
    setPrecoEstimado(inicial?.precoEstimado ?? null);
    setPrecoPago(inicial?.precoUnitario ?? null);
    setQuantidadeComprada(inicial?.quantidadeComprada ?? null);
    setPainel(null);
    setSugestoes([]);
    setErro(null);
    // Reinicia o formulário só quando a folha abre (não a cada render do pai).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);

  function aoDigitarNome(texto: string) {
    setNome(texto);
    const busca = ++ultimaBusca.current;
    const limpo = texto.trim();
    if (limpo.length < 2 || limpo === inicial?.nome) return setSugestoes([]);
    setTimeout(async () => {
      if (busca !== ultimaBusca.current) return; // chegou outra tecla: descarta esta busca
      try {
        const achados = await buscarSugestoes(limpo);
        if (busca === ultimaBusca.current)
          setSugestoes(
            achados.filter((s) => s.nome.toLowerCase() !== limpo.toLowerCase()).slice(0, 5),
          );
      } catch {
        setSugestoes([]);
      }
    }, 250);
  }

  function usarSugestao(produto: Produto) {
    ultimaBusca.current++;
    setNome(produto.nome);
    setCategoriaId(produto.categoriaId);
    setUnidade(produto.unidadePadrao);
    setSugestoes([]);
  }

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setEnviando(true);
    try {
      await acao();
    } catch (e) {
      setErro(mensagemParaUsuario(e));
    } finally {
      setEnviando(false);
    }
  }

  function salvar() {
    if (quantidade === null || quantidade <= 0)
      return setErro('Informe uma quantidade maior que zero.');
    const dados: DadosDoItem = { nome, categoriaId, unidade, quantidade };
    if (comPrecos) {
      Object.assign(dados, {
        precoEstimado,
        precoUnitario: precoPago,
        quantidadeComprada,
      });
    }
    void executar(() => aoSalvar(dados));
  }

  return (
    <Moldura visivel={visivel} aoFechar={aoFechar}>
      <TituloDaFolha>{titulo}</TituloDaFolha>
      <Campo
        destacado
        rotulo="Nome do produto"
        value={nome}
        onChangeText={aoDigitarNome}
        autoCapitalize="sentences"
      />
      {!inicial?.nome && nome.trim() === '' && sugestoesIniciais.length > 0 && (
        <>
          <RotuloDaFolha>Favoritos e recorrentes</RotuloDaFolha>
          <View style={estilos.linha}>
            {sugestoesIniciais.map((s) => (
              <Chip
                key={s.id}
                rotulo={s.favorito ? `★ ${s.nome}` : s.nome}
                ativo={false}
                aoPressionar={() => usarSugestao(s)}
              />
            ))}
          </View>
        </>
      )}
      {sugestoes.length > 0 && (
        <View style={estilos.linha}>
          {sugestoes.map((s) => (
            <Chip key={s.id} rotulo={s.nome} ativo={false} aoPressionar={() => usarSugestao(s)} />
          ))}
        </View>
      )}
      <View style={estilos.duas}>
        <View style={{ flex: 1 }}>
          <CampoNumerico
            rotulo="Quantidade"
            modo="quantidade"
            valor={quantidade}
            aoMudar={setQuantidade}
            sufixo={rotuloDaUnidade(unidade)}
          />
        </View>
        {comPrecos && (
          <View style={{ flex: 1 }}>
            <CampoNumerico
              rotulo="Qtd. comprada"
              modo="quantidade"
              valor={quantidadeComprada}
              aoMudar={setQuantidadeComprada}
              placeholder={quantidade === null ? '0' : String(quantidade).replace('.', ',')}
              sufixo={rotuloDaUnidade(unidade)}
              zeroVazio
            />
          </View>
        )}
      </View>
      {comPrecos && (
        <View style={estilos.duas}>
          <View style={{ flex: 1 }}>
            <CampoNumerico
              rotulo="Preço estimado"
              modo="dinheiro"
              valor={precoEstimado}
              aoMudar={setPrecoEstimado}
              zeroVazio
            />
          </View>
          <View style={{ flex: 1 }}>
            <CampoNumerico
              rotulo="Preço pago"
              modo="dinheiro"
              valor={precoPago}
              aoMudar={setPrecoPago}
              zeroVazio
            />
          </View>
        </View>
      )}
      <View style={estilos.duas}>
        <View style={{ flex: 1, gap: espaco.xs }}>
          <RotuloDaFolha>Unidade</RotuloDaFolha>
          <GatilhoDeSeletor
            rotulo="Unidade"
            valor={rotuloDaUnidade(unidade)}
            aberto={painel === 'unidade'}
            aoPressionar={() => setPainel(painel === 'unidade' ? null : 'unidade')}
          />
        </View>
        <View style={{ flex: 1, gap: espaco.xs }}>
          <RotuloDaFolha>Categoria</RotuloDaFolha>
          <GatilhoDeSeletor
            rotulo="Categoria"
            valor={categorias.find((c) => c.id === categoriaId)?.nome ?? 'Escolha'}
            aberto={painel === 'categoria'}
            aoPressionar={() => setPainel(painel === 'categoria' ? null : 'categoria')}
          />
        </View>
      </View>
      <SeletorDeOpcao
        visivel={painel === 'unidade'}
        titulo="Escolher a unidade"
        opcoes={UNIDADES.map((u) => ({ chave: u.valor, rotulo: u.rotulo }))}
        escolhida={unidade}
        aoEscolher={(chave) => {
          setUnidade(chave as Unidade);
          setPainel(null);
        }}
        aoFechar={() => setPainel(null)}
      />
      <SeletorDeOpcao
        visivel={painel === 'categoria'}
        titulo="Escolher a categoria"
        opcoes={categorias.map((c) => ({ chave: c.id, rotulo: c.nome }))}
        escolhida={categoriaId}
        comBuscaEOrdem
        placeholderDaBusca="Buscar categoria"
        aoEscolher={(chave) => {
          setCategoriaId(chave);
          setPainel(null);
        }}
        aoFechar={() => setPainel(null)}
      />
      <MensagemDeErro mensagem={erro} />
      <Botao titulo={rotuloDoBotao} aoPressionar={salvar} carregando={enviando} />
      {aoExcluir && (
        <BotaoExcluir carregando={enviando} aoConfirmar={() => void executar(aoExcluir)} />
      )}
      <Botao titulo="Cancelar" variante="texto" aoPressionar={aoFechar} />
    </Moldura>
  );
}

interface FolhaDeTextoProps {
  visivel: boolean;
  titulo: string;
  rotulo: string;
  valorInicial?: string;
  rotuloDoBotao: string;
  aoSalvar: (texto: string) => Promise<void>;
  aoExcluir?: () => Promise<void>;
  aoFechar: () => void;
}

/** Folha simples com um campo de texto (criar/renomear categoria). */
export function FolhaDeTexto({
  visivel,
  titulo,
  rotulo,
  valorInicial,
  rotuloDoBotao,
  aoSalvar,
  aoExcluir,
  aoFechar,
}: FolhaDeTextoProps) {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (visivel) {
      setTexto(valorInicial ?? '');
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setEnviando(true);
    try {
      await acao();
    } catch (e) {
      setErro(mensagemParaUsuario(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Moldura visivel={visivel} aoFechar={aoFechar}>
      <TituloDaFolha>{titulo}</TituloDaFolha>
      <Campo
        rotulo={rotulo}
        value={texto}
        onChangeText={setTexto}
        onSubmitEditing={() => void executar(() => aoSalvar(texto))}
      />
      <MensagemDeErro mensagem={erro} />
      <Botao
        titulo={rotuloDoBotao}
        aoPressionar={() => void executar(() => aoSalvar(texto))}
        carregando={enviando}
      />
      {aoExcluir && (
        <BotaoExcluir carregando={enviando} aoConfirmar={() => void executar(aoExcluir)} />
      )}
      <Botao titulo="Cancelar" variante="texto" aoPressionar={aoFechar} />
    </Moldura>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  folha: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: espaco.lg,
    paddingBottom: espaco.xl,
  },
  titulo: { fontSize: fonte.titulo, fontWeight: '800' },
  rotulo: { fontSize: fonte.pequena, fontWeight: '700' },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  duas: { flexDirection: 'row', gap: espaco.md },
  excluir: {
    minHeight: 48,
    borderRadius: raio.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
