import React, { useEffect, useState } from 'react';
import { mensagemParaUsuario } from '../../application/errors';
import type { MapaCompartilhadoDetalhe, MapaEmEdicao } from '../../domain/entities/mercados';
import { MensagemDeErro } from './base';
import { MapaSvg } from './MapaSvg';
import { Carregando } from './ui';

interface Props {
  /** Busca o desenho; só roda quando a prévia aparece (cada mapa é uma consulta). */
  carregar: () => Promise<MapaCompartilhadoDetalhe>;
}

/**
 * Prévia grande de um mapa que não é do grupo (catálogo ou moderação do administrador). Só desenha: as categorias
 * chegam como nomes e a prévia não usa ids.
 */
export function PreviaDoMapa({ carregar }: Props) {
  const [mapa, setMapa] = useState<MapaEmEdicao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    carregar()
      .then((detalhe) => {
        if (!ativo) return;
        setMapa({
          nome: detalhe.nome,
          cidade: detalhe.cidade ?? '',
          largura: detalhe.largura,
          altura: detalhe.altura,
          entrada: detalhe.entrada,
          caixas: detalhe.caixas,
          secoes: detalhe.secoes.map((s, i) => ({ ...s, id: `previa-${i}` })),
        });
      })
      .catch((e) => ativo && setErro(mensagemParaUsuario(e)));
    return () => {
      ativo = false;
    };
    // `carregar` muda a cada render do pai; a prévia só busca uma vez por montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (erro) return <MensagemDeErro mensagem={erro} />;
  if (!mapa) return <Carregando />;
  return <MapaSvg mapa={mapa} modo="mini" />;
}
