/**
 * Progressão de carga: a lista do catálogo e o detalhe de um exercício.
 *
 * A tela só desenha. O agrupamento por sessão, a escolha de QUAL grandeza
 * progride em cada tipo e os recordes vêm todos de `src/dominio/` — aqui não há
 * `if` sobre carga nem comparação de número, e é o que mantém essas contas
 * testáveis com `node --test`, fora do aparelho.
 *
 * Nenhum número é comparado entre exercícios: cada gráfico está na escala do
 * próprio exercício (kg, placa, repetição ou segundo), que é o que `Carga` e
 * `VolumeNaUnidade` garantem carregando a unidade junto.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Aviso, Barras, Botao, Cartao, Estatistica, ItemLista } from '@/components/progresso-base';
import { cores, espacoLegado as espaco, tamanho as fonte } from '@/constants/tema';
import type { TipoMedicao } from '@/db/schema';
import { formatarCarga, formatarCargaAproximada } from '@/dominio/carga';
import { formatarData, formatarDuracao } from '@/dominio/datas';
import {
  calibrado,
  rotuloDoTipoMedicao,
  temCarga,
  type Exercicio,
} from '@/dominio/exercicio';
import { calcularRecordes, type HistoricoDoExercicio } from '@/dominio/recordes';
import {
  formatarVolumeNaUnidade,
  progressaoDoExercicio,
  valorDaProgressao,
  type PontoDeProgressao,
} from '@/dominio/volume';

export function ProgressoExercicios({
  exercicios,
  aoEscolher,
}: {
  exercicios: readonly Exercicio[];
  aoEscolher: (exercicioId: string) => void;
}) {
  if (exercicios.length === 0) {
    return <Aviso texto="Nenhum exercício no catálogo." />;
  }

  return (
    <View style={estilos.lista}>
      {exercicios.map((ex) => (
        <ItemLista
          key={ex.id}
          titulo={ex.nome}
          detalhe={ex.grupoMuscular ?? undefined}
          valor={rotuloDoTipoMedicao(ex.tipoMedicao)}
          aoTocar={() => aoEscolher(ex.id)}
        />
      ))}
    </View>
  );
}

export function ProgressoDoExercicio({
  historico,
  aoVoltar,
}: {
  historico: HistoricoDoExercicio;
  aoVoltar: () => void;
}) {
  const ex = historico.exercicio;
  const recordes = calcularRecordes(historico);
  const sessoes = progressaoDoExercicio(historico);

  return (
    <View style={estilos.detalhe}>
      <Botao texto="← Exercícios" tipo="secundario" aoTocar={aoVoltar} />

      <Cartao titulo="Recordes">
        {recordes.totalDeSeries === 0 ? (
          <Aviso texto="Sem séries válidas registradas para este exercício." />
        ) : (
          <View style={estilos.grade}>
            {recordes.maiorCarga === null ? null : (
              <Estatistica
                rotulo="Maior carga"
                valor={formatarCargaAproximada(recordes.maiorCarga, ex.gramasPorPlaca)}
              />
            )}
            {recordes.maior1RM === null ? null : (
              <Estatistica
                rotulo="1RM estimado"
                // O til não é enfeite: converter placa em quilo assume resistência
                // proporcional ao número de placas, que alavanca não garante.
                valor={`${recordes.umRMAproximado ? '~' : ''}${formatarCarga(recordes.maior1RM.carga)}`}
                detalhe={
                  recordes.maior1RM.confiavel ? undefined : 'de série longa: estimativa frágil'
                }
              />
            )}
            {recordes.maiorVolumeSessao === null ? null : (
              <Estatistica
                rotulo="Maior volume numa sessão"
                valor={formatarVolumeNaUnidade(recordes.maiorVolumeSessao)}
              />
            )}
            {recordes.maiorReps === null ? null : (
              <Estatistica
                rotulo="Mais repetições"
                valor={`${recordes.maiorReps}`}
                detalhe={
                  recordes.maiorRepsNaCarga === null
                    ? `em ${recordes.totalDeSeries} séries`
                    : `com ${formatarCarga(recordes.maiorRepsNaCarga)}`
                }
              />
            )}
          </View>
        )}

        {ex.tipoMedicao === 'carga_placa' && !calibrado(ex) ? (
          <Aviso texto="Placa sem calibração: volume em quilo e 1RM não aparecem enquanto o peso de uma placa for desconhecido." />
        ) : null}
      </Cartao>

      <Cartao titulo="Progressão">
        {sessoes.length === 0 ? (
          <Aviso texto="Sem sessões registradas para este exercício." />
        ) : (
          <>
            <Barras
              valores={sessoes.map((s) => valorDaProgressao(s, ex))}
              inicio={formatarData(sessoes[0].instante)}
              fim={formatarData(sessoes[sessoes.length - 1].instante)}
            />
            <Text style={estilos.legenda}>{legendaDoGrafico(ex.tipoMedicao)}</Text>

            <View style={estilos.lista}>
              {[...sessoes].reverse().map((s) => (
                <ItemLista
                  key={s.sessaoId}
                  titulo={formatarData(s.instante)}
                  detalhe={`${s.series} ${s.series === 1 ? 'série' : 'séries'}`}
                  valor={valorDaSessao(s, ex)}
                  valorDetalhe={detalheDaSessao(s, ex)}
                />
              ))}
            </View>
          </>
        )}
      </Cartao>
    </View>
  );
}

function valorDaSessao(s: PontoDeProgressao, ex: Exercicio): string {
  if (temCarga(ex.tipoMedicao)) {
    return s.melhorCarga === null ? '—' : formatarCargaAproximada(s.melhorCarga, ex.gramasPorPlaca);
  }
  if (ex.tipoMedicao === 'peso_corporal') return `${s.repeticoes} reps`;
  return formatarDuracao(s.duracaoS);
}

function detalheDaSessao(s: PontoDeProgressao, ex: Exercicio): string | undefined {
  if (!temCarga(ex.tipoMedicao)) return undefined;
  return `${s.repeticoes} reps`;
}

function legendaDoGrafico(tipo: TipoMedicao): string {
  if (tipo === 'carga_kg') return 'Maior carga por sessão, em kg';
  if (tipo === 'carga_placa') return 'Maior carga por sessão, em placas';
  if (tipo === 'peso_corporal') return 'Repetições por sessão';
  return 'Tempo por sessão';
}

const estilos = StyleSheet.create({
  lista: { gap: espaco.xs },
  detalhe: { gap: espaco.md },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  legenda: { color: cores.textoFraco, fontSize: fonte.legenda },
});
