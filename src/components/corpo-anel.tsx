/**
 * As duas peças gráficas da aba Corpo: o anel do objetivo e a dupla linha do
 * peso.
 *
 * O anel mostra **quanto do caminho já foi feito**, e por isso não existe quando
 * não há partida registrada: `progressoObjetivo.percentual` é `null` nesse caso,
 * e desenhar um anel vazio ou cheio ali seria inventar um ponto de partida.
 *
 * A dupla linha existe porque peso corporal oscila 1–2 kg dentro do mesmo dia. A
 * fina é cada pesagem — o dado cru, que sobe e desce; a grossa é a média de 7
 * dias, que é a única das duas que responde "estou perdendo peso?". Desenhar só
 * a fina convidaria à leitura ansiosa do ponto do dia.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { cor, espaco } from '@/constants/tema';
import type { Ponto } from '@/dominio/datas';

const TAMANHO_DO_ANEL = 104;
const RAIO = 42;
const ESPESSURA = 12;
const PERIMETRO = 2 * Math.PI * RAIO;

export function AnelDoObjetivo({ percentual }: { percentual: number | null }) {
  const fracao = percentual === null ? 0 : Math.min(100, Math.max(0, percentual)) / 100;
  return (
    <Svg width={TAMANHO_DO_ANEL} height={TAMANHO_DO_ANEL} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={RAIO} fill="none" stroke={cor.borda} strokeWidth={ESPESSURA} />
      {percentual === null ? null : (
        <Circle
          cx={50}
          cy={50}
          r={RAIO}
          fill="none"
          stroke={cor.acao}
          strokeWidth={ESPESSURA}
          strokeLinecap="round"
          strokeDasharray={PERIMETRO}
          strokeDashoffset={PERIMETRO * (1 - fracao)}
          transform="rotate(-90 50 50)"
        />
      )}
    </Svg>
  );
}

/** Círculo tracejado do estado vazio: o lugar do anel, antes de haver o que medir. */
export function AnelVazio() {
  return <View style={estilos.anelVazio} />;
}

const ALTURA_DA_LINHA = 78;

export function LinhaDoPeso({
  pesagens,
  media,
}: {
  pesagens: readonly Ponto[];
  media: readonly Ponto[];
}) {
  const [largura, setLargura] = useState(0);

  if (pesagens.length < 2) return null;

  const todos = [...pesagens, ...media].map((p) => p.valor);
  const minimo = Math.min(...todos);
  const maximo = Math.max(...todos);
  // Escala entre o mínimo e o máximo do recorte, não a partir de zero: 78 a 80 kg
  // com eixo em zero vira uma reta, e a variação é justamente o assunto.
  const amplitude = maximo - minimo === 0 ? 1 : maximo - minimo;

  const primeiro = pesagens[0].instante;
  const ultimo = pesagens[pesagens.length - 1].instante;
  const periodo = ultimo - primeiro === 0 ? 1 : ultimo - primeiro;

  const pontos = (serie: readonly Ponto[]) =>
    serie
      .map((p) => {
        const x = ((p.instante - primeiro) / periodo) * largura;
        const y = 4 + (1 - (p.valor - minimo) / amplitude) * (ALTURA_DA_LINHA - 8);
        return `${x},${y}`;
      })
      .join(' ');

  return (
    <View
      style={estilos.linhaBloco}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
    >
      {largura === 0 ? null : (
        <Svg width={largura} height={ALTURA_DA_LINHA}>
          <Polyline
            points={pontos(pesagens)}
            fill="none"
            stroke={cor.borda}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          {media.length < 2 ? null : (
            <Polyline
              points={pontos(media)}
              fill="none"
              stroke={cor.acao}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  anelVazio: {
    width: 96,
    height: 96,
    borderRadius: 999,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: cor.borda,
  },
  linhaBloco: { height: ALTURA_DA_LINHA, marginTop: espaco.quatro },
});
