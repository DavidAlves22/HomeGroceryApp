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
  UNIDADES,
  type Categoria,
  type DadosDoItem,
  type Produto,
  type Unidade,
} from '../../domain/entities/tipos';
import { lerPreco, precoParaCampo } from '../../domain/services/financeiro';
import { formatarQuantidade, lerQuantidade } from '../../domain/services/organizacao';
import { espaco, fonte, raio, usePaleta } from '../theme';
import { Botao, Campo, MensagemDeErro } from './base';
import { Chip } from './ui';

function Moldura({
  visivel,
  aoFechar,
  children,
}: {
  visivel: boolean;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  const p = usePaleta();
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

function TituloDaFolha({ children }: { children: React.ReactNode }) {
  const p = usePaleta();
  return <Text style={[estilos.titulo, { color: p.texto }]}>{children}</Text>;
}

function RotuloDaFolha({ children }: { children: React.ReactNode }) {
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
  aoSalvar,
  aoExcluir,
  aoFechar,
}: FolhaDeItemProps) {
  const [nome, setNome] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [unidade, setUnidade] = useState<Unidade>('Unidade');
  const [quantidade, setQuantidade] = useState('1');
  const [precoEstimado, setPrecoEstimado] = useState('');
  const [precoPago, setPrecoPago] = useState('');
  const [quantidadeComprada, setQuantidadeComprada] = useState('');
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
    setQuantidade(formatarQuantidade(inicial?.quantidade ?? 1));
    setPrecoEstimado(precoParaCampo(inicial?.precoEstimado));
    setPrecoPago(precoParaCampo(inicial?.precoUnitario));
    setQuantidadeComprada(
      inicial?.quantidadeComprada ? formatarQuantidade(inicial.quantidadeComprada) : '',
    );
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
    const qtd = lerQuantidade(quantidade);
    if (qtd === null) return setErro('Informe uma quantidade maior que zero.');
    const dados: DadosDoItem = { nome, categoriaId, unidade, quantidade: qtd };

    if (comPrecos) {
      const estimado = lerPreco(precoEstimado);
      const pago = lerPreco(precoPago);
      const comprada = quantidadeComprada.trim() === '' ? null : lerQuantidade(quantidadeComprada);
      if (estimado === undefined)
        return setErro('Informe o preço estimado em reais, por exemplo 5,50.');
      if (pago === undefined) return setErro('Informe o preço pago em reais, por exemplo 5,50.');
      if (comprada === undefined || (quantidadeComprada.trim() !== '' && comprada === null)) {
        return setErro('A quantidade comprada precisa ser maior que zero.');
      }
      Object.assign(dados, {
        precoEstimado: estimado,
        precoUnitario: pago,
        quantidadeComprada: comprada,
      });
    }
    void executar(() => aoSalvar(dados));
  }

  return (
    <Moldura visivel={visivel} aoFechar={aoFechar}>
      <TituloDaFolha>{titulo}</TituloDaFolha>
      <Campo
        rotulo="Nome do produto"
        value={nome}
        onChangeText={aoDigitarNome}
        autoCapitalize="sentences"
      />
      {sugestoes.length > 0 && (
        <View style={estilos.linha}>
          {sugestoes.map((s) => (
            <Chip key={s.id} rotulo={s.nome} ativo={false} aoPressionar={() => usarSugestao(s)} />
          ))}
        </View>
      )}
      <Campo
        rotulo="Quantidade"
        value={quantidade}
        onChangeText={setQuantidade}
        keyboardType="decimal-pad"
      />
      {comPrecos && (
        <>
          <RotuloDaFolha>Valores (por unidade, em reais)</RotuloDaFolha>
          <View style={estilos.duas}>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="Preço estimado"
                value={precoEstimado}
                onChangeText={setPrecoEstimado}
                keyboardType="decimal-pad"
                placeholder="0,00"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="Preço pago"
                value={precoPago}
                onChangeText={setPrecoPago}
                keyboardType="decimal-pad"
                placeholder="0,00"
              />
            </View>
          </View>
          <Campo
            rotulo="Quantidade comprada (se diferente da planejada)"
            value={quantidadeComprada}
            onChangeText={setQuantidadeComprada}
            keyboardType="decimal-pad"
            placeholder={quantidade}
          />
        </>
      )}
      <RotuloDaFolha>Unidade</RotuloDaFolha>
      <View style={estilos.linha}>
        {UNIDADES.map((u) => (
          <Chip
            key={u.valor}
            rotulo={u.rotulo}
            ativo={unidade === u.valor}
            aoPressionar={() => setUnidade(u.valor)}
          />
        ))}
      </View>
      <RotuloDaFolha>Categoria</RotuloDaFolha>
      <View style={estilos.linha}>
        {categorias.map((c) => (
          <Chip
            key={c.id}
            rotulo={c.nome}
            ativo={categoriaId === c.id}
            aoPressionar={() => setCategoriaId(c.id)}
          />
        ))}
      </View>
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
