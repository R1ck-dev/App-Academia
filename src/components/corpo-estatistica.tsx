/**
 * Os quatro números do período — mudança, amplitude, mínimo e máximo — mais o
 * ritmo semanal COM o sinal de confiança.
 *
 * O ritmo é o motivo de o bloco existir na forma que tem. O app de referência
 * anuncia "+1,8 kg por semana · Muito rápido" extrapolando duas pesagens em seis
 * dias. Aqui `Ritmo` é união discriminada: no ramo insuficiente o campo
 * `porSemana` não existe, então esta tela NÃO CONSEGUE imprimir a tendência sem
 * base — e no ramo suficiente ela imprime, ao lado, de quantas pesagens e de
 * quantos dias o número saiu.
 *
 * O gráfico é a média móvel de 7 dias, não a série crua: peso corporal oscila com
 * água e sal, e o serrote do dado bruto sugere 800 g ganhos num dia.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Aviso,
  Barras,
  Cartao,
  Chip,
  Estatistica,
} from '@/components/progresso-base';
import { cores, espaco, fonte } from '@/constants/tema';
import type { Pesagem } from '@/db/schema';
import { formatarPeso } from '@/dominio/carga';
import {
  estatisticaDoPeso,
  filtrarPeriodo,
  formatarVariacao,
  MIN_DIAS_PARA_RITMO,
  MIN_PESAGENS_PARA_RITMO,
  periodoDeDias,
  type Ritmo,
} from '@/dominio/corpo';
import { formatarData, mediaMovel } from '@/dominio/datas';

const PERIODOS = [
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '90 dias' },
  { dias: 365, rotulo: '1 ano' },
] as const;

const JANELA_MEDIA_DIAS = 7;

export function CorpoEstatistica({ pesagens }: { pesagens: readonly Pesagem[] }) {
  const [dias, setDias] = useState<number>(PERIODOS[0].dias);

  const periodo = periodoDeDias(dias, Date.now());
  const estatistica = estatisticaDoPeso(pesagens, periodo);
  const media = mediaMovel(
    filtrarPeriodo(
      pesagens.map((p) => ({ instante: p.medidoEm, valor: p.pesoG })),
      periodo
    ),
    JANELA_MEDIA_DIAS
  );

  return (
    <Cartao titulo="Período">
      <View style={estilos.chips}>
        {PERIODOS.map((p) => (
          <Chip
            key={p.dias}
            texto={p.rotulo}
            ativo={p.dias === dias}
            aoTocar={() => setDias(p.dias)}
          />
        ))}
      </View>

      {estatistica === null ? (
        <Aviso texto="Sem pesagens neste período." />
      ) : (
        <>
          <View style={estilos.grade}>
            <Estatistica
              rotulo="Mudança"
              valor={`${formatarVariacao(estatistica.mudanca)} kg`}
              detalhe={`${formatarData(estatistica.primeiro.instante)} → ${formatarData(estatistica.ultimo.instante)}`}
            />
            <Estatistica
              rotulo="Oscilação"
              valor={`${formatarPeso(estatistica.amplitude)} kg`}
              detalhe={`${estatistica.pontos} pesagens em ${estatistica.dias} dias`}
            />
            <Estatistica
              rotulo="Mínimo"
              valor={`${formatarPeso(estatistica.minimo.valor)} kg`}
              detalhe={formatarData(estatistica.minimo.instante)}
            />
            <Estatistica
              rotulo="Máximo"
              valor={`${formatarPeso(estatistica.maximo.valor)} kg`}
              detalhe={formatarData(estatistica.maximo.instante)}
            />
          </View>

          <RitmoSemanal ritmo={estatistica.ritmo} />

          <Barras
            valores={media.map((p) => p.valor)}
            inicio={media.length > 0 ? formatarData(media[0].instante) : undefined}
            fim={media.length > 0 ? formatarData(media[media.length - 1].instante) : undefined}
          />
          <Text style={estilos.legenda}>Média móvel de {JANELA_MEDIA_DIAS} dias</Text>
        </>
      )}
    </Cartao>
  );
}

function RitmoSemanal({ ritmo }: { ritmo: Ritmo }) {
  if (ritmo.suficiente) {
    return (
      <View style={estilos.ritmo}>
        <Text style={estilos.ritmoValor}>{formatarVariacao(ritmo.porSemana)} kg por semana</Text>
        {/* O denominador da estimativa fica visível: é ele que separa tendência de chute. */}
        <Text style={estilos.legenda}>
          tendência de {ritmo.pontos} pesagens ao longo de {ritmo.dias} dias
        </Text>
      </View>
    );
  }

  return (
    <View style={estilos.ritmo}>
      <Text style={estilos.ritmoIndefinido}>Tendência ainda não estimável</Text>
      <Aviso texto={motivo(ritmo)} />
    </View>
  );
}

function motivo(ritmo: Extract<Ritmo, { suficiente: false }>): string {
  if (ritmo.motivo === 'sem_dados') return 'Nenhuma pesagem no período.';
  if (ritmo.motivo === 'poucas_pesagens') {
    return `São precisas ${MIN_PESAGENS_PARA_RITMO} pesagens; há ${ritmo.pontos}.`;
  }
  return `São precisos ${MIN_DIAS_PARA_RITMO} dias entre a primeira e a última; há ${ritmo.dias}.`;
}

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', gap: espaco.sm },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  ritmo: { gap: 2 },
  ritmoValor: { color: cores.texto, fontSize: fonte.titulo, fontWeight: '600' },
  ritmoIndefinido: { color: cores.textoFraco, fontSize: fonte.corpo },
  legenda: { color: cores.textoFraco, fontSize: fonte.legenda },
});
