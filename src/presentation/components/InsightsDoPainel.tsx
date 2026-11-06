import React, { useState } from 'react';
import type { AdminItemDeRanking, AdminInsights } from '../../domain/entities/admin';
import { percentual, rotuloDeDias, rotuloDoRecurso } from '../../domain/services/painelAdmin';
import { Competencia } from '../../domain/valueObjects/Competencia';
import { Dinheiro } from '../../domain/valueObjects/Dinheiro';
import { espaco, fonte } from '../theme';
import { Cartao, TextoSuave } from './base';
import { BarrasHorizontais, GraficoDeBarras } from './graficos';
import { ListaComVerMais } from './ListaComVerMais';
import { GradeDeMetricas, Metrica, TituloDoCartao } from './painel';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Ranking({
  titulo,
  itens,
  unidade,
  vazio,
}: {
  /** Título da folha com o ranking inteiro. */
  titulo: string;
  itens: AdminItemDeRanking[];
  unidade: [string, string];
  vazio: string;
}) {
  if (itens.length === 0) return <TextoSuave>{vazio}</TextoSuave>;
  return (
    <ListaComVerMais
      titulo={titulo}
      itens={itens.map((i) => ({
        rotulo: i.nome,
        valor: i.quantidade,
        texto: plural(i.quantidade, unidade[0], unidade[1]),
        detalhe: i.detalhe === null ? undefined : `em ${plural(i.detalhe, 'casa', 'casas')}`,
      }))}
      renderizar={(barras) => <BarrasHorizontais itens={barras} />}
    />
  );
}

/**
 * Cartões de análise do painel: retenção, funil, gasto, mais comprados, mercados e adoção de recursos.
 * Tudo é contagem agregada que a API calcula; nenhum cartão mostra quem comprou o quê.
 */
export function InsightsDoPainel({ dados }: { dados: AdminInsights }) {
  const [mesEscolhido, setMesEscolhido] = useState(dados.gasto.porMes.length - 1);
  const meses = dados.gasto.porMes;
  const mes = meses[Math.min(mesEscolhido, meses.length - 1)];
  const { funil } = dados;

  return (
    <>
      <Cartao estilo={{ gap: espaco.md }}>
        <TituloDoCartao>Retenção</TituloDoCartao>
        <BarrasHorizontais
          itens={dados.retencao.map((r) => ({
            rotulo: `Ainda usavam após ${rotuloDeDias(r.dias)}`,
            valor: percentual(r.voltaram, r.elegiveis),
            texto:
              r.elegiveis === 0
                ? 'sem contas ainda'
                : `${percentual(r.voltaram, r.elegiveis)}% (${r.voltaram} de ${r.elegiveis})`,
          }))}
        />
        <TextoSuave estilo={{ fontSize: fonte.pequena }}>
          Entre as contas criadas há pelo menos esse tempo, quantas ainda abriam o app depois dele.
          Contas anteriores ao painel só contam depois de entrarem de novo.
        </TextoSuave>
      </Cartao>

      <Cartao estilo={{ gap: espaco.md }}>
        <TituloDoCartao>Funil de uso</TituloDoCartao>
        <BarrasHorizontais
          itens={[
            { rotulo: 'Criaram a conta', valor: funil.contas, texto: String(funil.contas) },
            {
              rotulo: 'Criaram uma lista',
              valor: funil.criaramLista,
              texto: `${funil.criaramLista} (${percentual(funil.criaramLista, funil.contas)}%)`,
            },
            {
              rotulo: 'Compraram um item',
              valor: funil.compraram,
              texto: `${funil.compraram} (${percentual(funil.compraram, funil.contas)}%)`,
            },
            {
              rotulo: 'Finalizaram uma compra',
              valor: funil.finalizaram,
              texto: `${funil.finalizaram} (${percentual(funil.finalizaram, funil.contas)}%)`,
            },
          ]}
        />
        <TextoSuave estilo={{ fontSize: fonte.pequena }}>
          {funil.semAtividade === 1
            ? '1 conta nunca criou lista nem comprou nada'
            : `${funil.semAtividade} contas nunca criaram lista nem compraram nada`}{' '}
          ({percentual(funil.semAtividade, funil.contas)}%).
        </TextoSuave>
      </Cartao>

      <Cartao estilo={{ gap: espaco.md }}>
        <TituloDoCartao>Gasto nas compras finalizadas</TituloDoCartao>
        {meses.length === 0 ? (
          <TextoSuave>Ainda não há compras finalizadas com preço.</TextoSuave>
        ) : (
          <>
            <GradeDeMetricas>
              <Metrica
                valor={Dinheiro.deReais(dados.gasto.medio).formatar()}
                rotulo="gasto médio por compra"
              />
              <Metrica valor={String(dados.gasto.compras)} rotulo="compras com preço" />
            </GradeDeMetricas>
            <GraficoDeBarras
              barras={meses.map((m) => ({
                rotulo: Competencia.deChave(m.competencia).abreviado,
                valor: m.total,
                texto: Dinheiro.deReais(m.total).formatar(),
              }))}
              selecionada={Math.min(mesEscolhido, meses.length - 1)}
              aoSelecionar={setMesEscolhido}
              descricao="Total gasto por mês nas compras finalizadas. Toque em uma barra para ver o mês."
            />
            <TextoSuave estilo={{ fontSize: fonte.pequena }}>
              {Competencia.deChave(mes.competencia).abreviado}:{' '}
              {Dinheiro.deReais(mes.total).formatar()} em {plural(mes.compras, 'compra', 'compras')}
              .
            </TextoSuave>
          </>
        )}
      </Cartao>

      <Cartao estilo={{ gap: espaco.md }}>
        <TituloDoCartao>Mais comprados</TituloDoCartao>
        <Ranking
          titulo="Produtos mais comprados"
          itens={dados.produtosMaisComprados}
          unidade={['compra', 'compras']}
          vazio="Ainda não há itens comprados."
        />
        {dados.categoriasMaisCompradas.length > 0 && (
          <>
            <TituloDoCartao>Categorias</TituloDoCartao>
            <Ranking
              titulo="Categorias mais compradas"
              itens={dados.categoriasMaisCompradas}
              unidade={['compra', 'compras']}
              vazio=""
            />
          </>
        )}
      </Cartao>

      <Cartao estilo={{ gap: espaco.md }}>
        <TituloDoCartao>Mercados</TituloDoCartao>
        <Ranking
          titulo="Cidades com mercados"
          itens={dados.cidadesComMercados}
          unidade={['mercado', 'mercados']}
          vazio="Nenhum mercado com cidade cadastrada ainda."
        />
        {dados.mapasMaisCopiados.length > 0 && (
          <>
            <TituloDoCartao>Mapas mais copiados</TituloDoCartao>
            <Ranking
              titulo="Mapas mais copiados"
              itens={dados.mapasMaisCopiados}
              unidade={['cópia', 'cópias']}
              vazio=""
            />
          </>
        )}
      </Cartao>

      <Cartao estilo={{ gap: espaco.md }}>
        <TituloDoCartao>Uso dos recursos</TituloDoCartao>
        <BarrasHorizontais
          itens={dados.adocao.map((a) => ({
            rotulo: rotuloDoRecurso(a.recurso),
            valor: percentual(a.quantidade, a.de),
            texto: `${percentual(a.quantidade, a.de)}%`,
            detalhe: `${a.quantidade} de ${plural(a.de, a.base === 'grupos' ? 'grupo' : 'conta', a.base === 'grupos' ? 'grupos' : 'contas')}`,
          }))}
        />
      </Cartao>
    </>
  );
}
