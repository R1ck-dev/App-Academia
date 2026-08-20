/**
 * A curva de "estou evoluindo neste exercício".
 *
 * **Um ponto é uma SESSÃO**, não uma série: 4×10 num dia são quatro linhas no
 * banco e um ponto aqui. Quem agrupa é `progressaoDoExercicio`, no domínio; esta
 * tela só desenha o que recebe.
 *
 * A escala é a do próprio exercício e nunca é convertida — placa progride em
 * placas, esteira em minutos, peso corporal em repetições. Calibrar a placa
 * acrescenta uma leitura em quilos no texto e **não mexe neste eixo**.
 *
 * Os rótulos são `Text` posicionado sobre o SVG, não `<text>` dentro dele: o
 * `react-native-svg` não herda a família da fonte empacotada, e um eixo em
 * Roboto no meio de um app em Figtree é justamente o tipo de detalhe que
 * denuncia o gráfico como peça estrangeira.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { cor, espaco, grafico, tipo } from '@/constants/tema';

export type PontoDoGrafico = { valor: number; rotulo: string };

/** Espaço à esquerda para os rótulos do eixo. */
const CALHA = 34;
const ALTURA_DOS_ROTULOS = 26;
const LINHAS_DE_GRADE = 3;

export function GraficoDeProgressao({
  pontos,
  formatarValor,
}: {
  pontos: readonly PontoDoGrafico[];
  formatarValor: (valor: number) => string;
}) {
  const [largura, setLargura] = useState(0);

  if (pontos.length < 2) return null;

  const valores = pontos.map((p) => p.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  // Amplitude zero é o caso real de quem repete a mesma carga por semanas: sem o
  // piso, a divisão explodiria e a linha sumiria da tela.
  const amplitude = maximo - minimo === 0 ? 1 : maximo - minimo;

  const alturaUtil = grafico.altura - grafico.pontoRaio * 2;
  const y = (valor: number) =>
    grafico.pontoRaio + (1 - (valor - minimo) / amplitude) * alturaUtil;
  const x = (i: number) =>
    pontos.length === 1
      ? CALHA
      : CALHA + (i / (pontos.length - 1)) * Math.max(0, largura - CALHA - grafico.pontoRaio * 2);

  const grade = Array.from({ length: LINHAS_DE_GRADE }, (_, i) => {
    const valor = maximo - (i / (LINHAS_DE_GRADE - 1)) * (maximo - minimo);
    return { valor, y: y(valor) };
  });

  return (
    <View style={estilos.bloco} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {largura === 0 ? null : (
        <>
          <Svg width={largura} height={grafico.altura} style={estilos.svg}>
            {grade.map((g) => (
              <Line
                key={`grade-${g.valor}`}
                x1={CALHA}
                x2={largura}
                y1={g.y}
                y2={g.y}
                stroke={grafico.grade}
                strokeWidth={grafico.gradeEspessura}
                strokeLinecap="round"
              />
            ))}
            <Polyline
              points={pontos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ')}
              fill="none"
              stroke={grafico.curva}
              strokeWidth={grafico.curvaEspessura}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {pontos.map((p, i) => (
              <Circle
                key={`ponto-${p.rotulo}-${i}`}
                cx={x(i)}
                cy={y(p.valor)}
                r={grafico.pontoRaio}
                fill={grafico.pontoPreenchimento}
                stroke={grafico.curva}
                strokeWidth={grafico.curvaEspessura}
              />
            ))}
          </Svg>

          {grade.map((g) => (
            <Text
              key={`rotulo-${g.valor}`}
              style={[estilos.rotuloDoEixo, { top: g.y - 7 }]}
              numberOfLines={1}
            >
              {formatarValor(g.valor)}
            </Text>
          ))}

          {pontos.map((p, i) => (
            <Text
              key={`data-${p.rotulo}-${i}`}
              style={[estilos.rotuloDaData, { left: x(i) - 30 }]}
              numberOfLines={1}
            >
              {p.rotulo}
            </Text>
          ))}
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { height: grafico.altura + ALTURA_DOS_ROTULOS, marginTop: espaco.dois },
  svg: { position: 'absolute', left: 0, top: 0 },
  rotuloDoEixo: {
    position: 'absolute',
    left: 0,
    width: CALHA - 4,
    ...tipo.metaMenor,
    fontSize: 11,
    color: cor.textoTerciario,
  },
  rotuloDaData: {
    position: 'absolute',
    top: grafico.altura + 6,
    width: 60,
    textAlign: 'center',
    ...tipo.metaMenor,
    fontSize: 10.5,
    color: cor.textoTerciario,
  },
});
