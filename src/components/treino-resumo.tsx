/**
 * O que a sessão foi, depois de finalizada — e o ÚNICO lugar do app onde a ficha
 * pode mudar.
 *
 * Três blocos, na ordem em que interessam: volume (com o que NÃO entrou na
 * conta, nomeado, porque `VolumeDaSessao` não tem um número solto para imprimir
 * no lugar da frase), recordes batidos e as divergências entre o que ele fez e o
 * que a ficha manda. A divergência vira `definirCargaAlvo` só por toque, com os
 * dois números visíveis: plano ≠ realizado, e progressão automática vira loop que
 * não converge.
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Tela } from '@/components/tela';
import { ALVO_TOQUE, cores, espaco, fonte } from '@/constants/tema';
import { definirCargaAlvo } from '@/db/mutations';
import { historicoDoExercicio, planoDaSessao, seriesDaSessaoComExercicio } from '@/db/queries';
import { formatarCarga, formatarVolume } from '@/dominio/carga';
import { divergenciasDoPlano, type Divergencia, type PlanoDaSessao } from '@/dominio/execucao';
import { calcularRecordes, novoRecorde } from '@/dominio/recordes';
import {
  volumeDaSessao,
  type MotivoForaDoVolume,
  type VolumeDaSessao,
} from '@/dominio/volume';

type RecordeBatido = { nome: string; carga: boolean; umRM: boolean; reps: boolean };

export function ResumoDaSessao({
  sessaoId,
  aoConcluir,
}: {
  sessaoId: string;
  aoConcluir: () => void;
}) {
  const [aplicadas, setAplicadas] = useState<readonly string[]>([]);
  const resumo = useMemo(() => montarResumo(sessaoId), [sessaoId]);

  function atualizarFicha(d: Divergencia) {
    try {
      definirCargaAlvo(d.itemId, d.sugerida);
      setAplicadas((antes) => [...antes, d.itemId]);
    } catch (erro) {
      Alert.alert('Não deu para atualizar a ficha', erro instanceof Error ? erro.message : String(erro));
    }
  }

  if (resumo === null) {
    return (
      <Tela titulo="Treino concluído">
        <Pressable style={estilos.concluir} onPress={aoConcluir}>
          <Text style={estilos.concluirTexto}>Voltar</Text>
        </Pressable>
      </Tela>
    );
  }

  const pendentes = resumo.divergencias.filter((d) => !aplicadas.includes(d.itemId));

  return (
    <Tela titulo={resumo.nome}>
      <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.lista}>
        <View style={estilos.bloco}>
          <Text style={estilos.tituloBloco}>Volume</Text>
          {linhasDoVolume(resumo.volume).map((linha) => (
            <Text key={linha} style={estilos.linha}>
              {linha}
            </Text>
          ))}
        </View>

        {resumo.recordes.length === 0 ? null : (
          <View style={estilos.bloco}>
            <Text style={estilos.tituloBloco}>Recordes</Text>
            {resumo.recordes.map((r) => (
              <Text key={r.nome} style={estilos.linha}>
                {r.nome}: {textoDoRecorde(r)}
              </Text>
            ))}
          </View>
        )}

        {pendentes.length === 0 ? null : (
          <View style={estilos.bloco}>
            <Text style={estilos.tituloBloco}>Atualizar a ficha?</Text>
            {pendentes.map((d) => (
              <Pressable key={d.itemId} style={estilos.divergencia} onPress={() => atualizarFicha(d)}>
                <Text style={estilos.linha}>
                  {d.nome}: ficha {d.noPlano === null ? 'sem carga' : formatarCarga(d.noPlano)} →{' '}
                  {formatarCarga(d.sugerida)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable style={estilos.concluir} onPress={aoConcluir}>
          <Text style={estilos.concluirTexto}>Pronto</Text>
        </Pressable>
      </ScrollView>
    </Tela>
  );
}

// ── Montagem ───────────────────────────────────────────────────────────────

type Resumo = {
  nome: string;
  volume: VolumeDaSessao;
  recordes: RecordeBatido[];
  divergencias: readonly Divergencia[];
};

function montarResumo(sessaoId: string): Resumo | null {
  const plano = planoDaSessao(sessaoId);
  if (plano === null) return null;
  return {
    nome: plano.sessao.nome,
    volume: volumeDaSessao(seriesDaSessaoComExercicio(sessaoId)),
    recordes: recordesBatidos(plano),
    divergencias: divergenciasDoPlano(plano),
  };
}

/**
 * "Bateu recorde hoje?" comparando com os recordes de ANTES desta sessão — o
 * histórico completo inclui as séries de hoje, e cada uma empataria consigo
 * mesma, fazendo o resumo nunca acender nada.
 */
function recordesBatidos(plano: PlanoDaSessao): RecordeBatido[] {
  const batidos: RecordeBatido[] = [];
  for (const item of plano.itens) {
    if (item.feitas.length === 0) continue;
    const historico = historicoDoExercicio(item.exercicio.id);
    if (historico === null) continue;

    const anteriores = calcularRecordes({
      exercicio: historico.exercicio,
      series: historico.series.filter((s) => s.sessaoId !== plano.sessao.id),
    });

    const batido = item.feitas.reduce<RecordeBatido>(
      (acumulado, serie) => {
        const novo = novoRecorde(serie, item.exercicio, anteriores);
        return {
          nome: acumulado.nome,
          carga: acumulado.carga || novo.carga,
          umRM: acumulado.umRM || novo.umRM,
          reps: acumulado.reps || novo.reps,
        };
      },
      { nome: item.exercicio.nome, carga: false, umRM: false, reps: false }
    );

    if (batido.carga || batido.umRM || batido.reps) batidos.push(batido);
  }
  return batidos;
}

function textoDoRecorde(r: RecordeBatido): string {
  const partes: string[] = [];
  if (r.carga) partes.push('carga');
  if (r.umRM) partes.push('1RM estimado');
  if (r.reps) partes.push('repetições');
  return partes.join(', ');
}

const FRASE: Readonly<Record<MotivoForaDoVolume, string>> = {
  aquecimento: 'de aquecimento',
  sem_carga: 'sem carga',
  sem_repeticoes: 'sem repetições',
  placa_sem_calibracao: 'em placa sem peso conhecido',
};

/**
 * Os quatro motivos viram quatro frases, com os nomes dos exercícios: sem isso o
 * abdominal apareceria contado junto das placas, que é o buraco que
 * `foraDaSoma` existe para fechar.
 */
function linhasDoVolume(v: VolumeDaSessao): string[] {
  const linhas = [`${formatarVolume(v.gramasReps)} em ${v.seriesSomadas} séries`];

  if (v.seriesAproximadas > 0) {
    linhas.push(
      `inclui ${v.seriesAproximadas} convertidas de placa (~${formatarVolume(v.gramasRepsAproximados)})`
    );
  }

  const totais: Readonly<Record<MotivoForaDoVolume, number>> = {
    placa_sem_calibracao: v.seriesEmPlacaSemCalibracao,
    sem_carga: v.seriesSemCarga,
    sem_repeticoes: v.seriesSemRepeticoes,
    aquecimento: v.seriesAquecimento,
  };

  for (const motivo of Object.keys(totais) as MotivoForaDoVolume[]) {
    const total = totais[motivo];
    if (total === 0) continue;
    const nomes = v.foraDaSoma.filter((f) => f.motivo === motivo).map((f) => f.nome);
    const lista = nomes.length === 0 ? '' : ` (${nomes.join(', ')})`;
    linhas.push(`${total} ${total === 1 ? 'série' : 'séries'} ${FRASE[motivo]}${lista}`);
  }

  return linhas;
}

const estilos = StyleSheet.create({
  rolagem: { flex: 1 },
  lista: { gap: espaco.md, paddingBottom: espaco.xl },
  bloco: {
    backgroundColor: cores.superficie,
    borderRadius: 14,
    padding: espaco.md,
    gap: espaco.xs,
  },
  tituloBloco: { color: cores.texto, fontSize: fonte.corpo, fontWeight: '700' },
  linha: { color: cores.textoFraco, fontSize: fonte.legenda, lineHeight: 20 },
  divergencia: {
    minHeight: ALVO_TOQUE,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  concluir: {
    minHeight: ALVO_TOQUE + 8,
    borderRadius: 12,
    backgroundColor: cores.destaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  concluirTexto: { color: cores.fundo, fontSize: fonte.corpo, fontWeight: '700' },
});
