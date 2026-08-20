/**
 * Progressão de carga: os chips do catálogo e o detalhe de um exercício.
 *
 * A tela só desenha. O agrupamento por sessão, a escolha de QUAL grandeza
 * progride em cada tipo e os recordes vêm todos de `src/dominio/` — aqui não há
 * `if` sobre carga nem comparação de número, e é o que mantém essas contas
 * testáveis com `node --test`, fora do aparelho.
 *
 * Nenhum número é comparado entre exercícios: cada gráfico está na escala do
 * próprio exercício (kg, placa, repetição ou segundo), que é o que `Carga` e
 * `VolumeNaUnidade` garantem carregando a unidade junto.
 *
 * Os recordes que a unidade daquele exercício NÃO permite continuam na lista,
 * apagados e com o motivo: sumir com a linha faria parecer que ainda não houve
 * dado, quando na verdade aquele recorde não existe ali.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GraficoDeProgressao, type PontoDoGrafico } from '@/components/progresso-grafico';
import { cor, espaco, margem, raio, tipo } from '@/constants/tema';
import { formatarCarga, formatarCargaAproximada, formatarPeso } from '@/dominio/carga';
import { formatarData, formatarDuracao } from '@/dominio/datas';
import { calibrado, temCarga, unidadeDoTipo, type Exercicio } from '@/dominio/exercicio';
import { calcularRecordes, type HistoricoDoExercicio, type Recordes } from '@/dominio/recordes';
import {
  formatarVolumeNaUnidade,
  progressaoDoExercicio,
  valorDaProgressao,
} from '@/dominio/volume';

/** A fila de chips: trocar de exercício é um toque, sem entrar e sair de tela. */
export function ChipsDeExercicio({
  exercicios,
  escolhido,
  aoEscolher,
}: {
  exercicios: readonly Exercicio[];
  escolhido: string | null;
  aoEscolher: (exercicioId: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.chips}
    >
      {exercicios.map((ex) => {
        const ativo = ex.id === escolhido;
        return (
          <Pressable
            key={ex.id}
            onPress={() => aoEscolher(ex.id)}
            style={[estilos.chip, ativo && estilos.chipAtivo]}
          >
            <Text style={ativo ? estilos.chipTextoAtivo : estilos.chipTexto} numberOfLines={1}>
              {ex.nome}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ProgressoDoExercicio({
  historico,
  alvoDaFicha,
  aoCalibrar,
}: {
  historico: HistoricoDoExercicio;
  /** "3×10 · 2 placas" — o que a ficha manda, para o exercício nunca registrado. */
  alvoDaFicha?: string | null;
  aoCalibrar: () => void;
}) {
  const ex = historico.exercicio;
  const pontos = progressaoDoExercicio(historico);
  const recordes = calcularRecordes(historico);

  const doGrafico: PontoDoGrafico[] = pontos.map((p) => ({
    valor: valorDaProgressao(p, ex),
    rotulo: formatarData(p.instante),
  }));

  return (
    <View style={estilos.detalhe}>
      <Text style={estilos.nome}>{ex.nome}</Text>
      <Text style={estilos.sub}>{textoDaMedida(ex, pontos.length, historico.series.length)}</Text>

      {doGrafico.length >= 2 ? (
        <>
          <Text style={estilos.eixo}>{rotuloDoEixo(ex)}</Text>
          <GraficoDeProgressao pontos={doGrafico} formatarValor={(v) => formatarDoEixo(ex, v)} />
        </>
      ) : doGrafico.length === 1 ? (
        <View style={estilos.blocoDeLeitura}>
          <Text style={estilos.numeroSozinho}>{formatarDoEixo(ex, doGrafico[0].valor)}</Text>
          <Text style={estilos.blocoTexto}>Uma sessão registrada, em {doGrafico[0].rotulo}.</Text>
        </View>
      ) : (
        <View style={estilos.blocoDeLeitura}>
          <Text style={estilos.blocoTitulo}>Nenhuma série registrada aqui ainda.</Text>
          {alvoDaFicha ? <Text style={estilos.blocoTexto}>Na ficha: {alvoDaFicha}.</Text> : null}
        </View>
      )}

      <View style={estilos.recordes}>
        {linhasDeRecorde(ex, recordes).map((linha) => (
          <View key={linha.rotulo} style={estilos.linhaDeRecorde}>
            <Text style={estilos.recordeRotulo}>{linha.rotulo}</Text>
            <Text style={linha.ausente ? estilos.recordeAusente : estilos.recordeValor}>
              {linha.valor}
            </Text>
          </View>
        ))}
      </View>

      {ex.tipoMedicao !== 'carga_placa' ? null : calibrado(ex) ? (
        <View style={estilos.blocoDeCalibracao}>
          <Text style={estilos.calibracaoTitulo}>
            Cada placa: {formatarPeso(ex.gramasPorPlaca ?? 0)}
          </Text>
          <Text style={estilos.calibracaoTexto}>
            {recordes.maiorCarga === null
              ? 'O histórico deste exercício ganha uma leitura em quilos.'
              : `Maior carga: ${formatarCargaAproximada(recordes.maiorCarga, ex.gramasPorPlaca)}.`}
          </Text>
          <Pressable onPress={aoCalibrar} hitSlop={10}>
            <Text style={estilos.descalibrar}>mudar</Text>
          </Pressable>
        </View>
      ) : (
        <View style={estilos.blocoDeCalibracao}>
          <Text style={estilos.calibracaoTitulo}>Sabe quanto pesa cada placa?</Text>
          <Text style={estilos.calibracaoTexto}>O histórico ganha uma leitura em quilos.</Text>
          <Pressable
            style={({ pressed }) => [estilos.botaoDeCalibrar, pressed && estilos.botaoPressionado]}
            onPress={aoCalibrar}
          >
            <Text style={estilos.botaoDeCalibrarTexto}>Calibrar a placa</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Texto ──────────────────────────────────────────────────────────────────

function textoDaMedida(ex: Exercicio, sessoes: number, series: number): string {
  const unidade = unidadeDoTipo(ex.tipoMedicao);
  const medida =
    unidade === null
      ? ex.tipoMedicao === 'tempo'
        ? 'medido em tempo'
        : 'peso corporal'
      : `medido em ${unidade}`;
  const s = sessoes === 1 ? 'sessão' : 'sessões';
  const t = series === 1 ? 'série' : 'séries';
  return `${medida} · ${sessoes} ${s} · ${series} ${t}`;
}

function rotuloDoEixo(ex: Exercicio): string {
  if (temCarga(ex.tipoMedicao)) return 'carga por sessão';
  if (ex.tipoMedicao === 'tempo') return 'duração por sessão';
  return 'repetições por sessão';
}

/** O eixo fala a unidade do exercício, e só ela. */
function formatarDoEixo(ex: Exercicio, valor: number): string {
  if (ex.tipoMedicao === 'carga_kg') return formatarPeso(Math.round(valor));
  if (ex.tipoMedicao === 'carga_placa') return String(Math.round(valor * 10) / 10);
  if (ex.tipoMedicao === 'tempo') return formatarDuracao(Math.round(valor));
  return String(Math.round(valor));
}

type LinhaDeRecorde = { rotulo: string; valor: string; ausente?: boolean };

function linhasDeRecorde(ex: Exercicio, r: Recordes): LinhaDeRecorde[] {
  const linhas: LinhaDeRecorde[] = [];

  if (temCarga(ex.tipoMedicao)) {
    linhas.push({
      rotulo: 'Maior carga',
      valor:
        r.maiorCarga === null
          ? 'sem registro'
          : formatarCargaAproximada(r.maiorCarga, ex.gramasPorPlaca),
      ausente: r.maiorCarga === null,
    });
  }

  if (r.maior1RM === null) {
    linhas.push({
      rotulo: '1RM estimado',
      valor:
        ex.tipoMedicao === 'carga_placa' && !calibrado(ex)
          ? 'não existe em placa sem calibração'
          : 'sem registro',
      ausente: true,
    });
  } else {
    const til = r.umRMAproximado ? '~' : '';
    const ressalva = r.maior1RM.confiavel ? '' : ' · estimativa fraca';
    linhas.push({
      rotulo: '1RM estimado',
      valor: `${til}${formatarCarga(r.maior1RM.carga)}${ressalva}`,
    });
  }

  linhas.push(
    r.maiorVolumeSessao === null
      ? {
          rotulo: 'Maior volume numa sessão',
          valor: 'não se soma: sem carga ou sem repetição',
          ausente: true,
        }
      : {
          rotulo: 'Maior volume numa sessão',
          valor: formatarVolumeNaUnidade(r.maiorVolumeSessao),
        }
  );

  linhas.push({
    rotulo: 'Mais repetições',
    valor:
      r.maiorReps === null
        ? 'sem registro'
        : r.maiorRepsNaCarga === null
          ? String(r.maiorReps)
          : `${r.maiorReps} × ${formatarCarga(r.maiorRepsNaCarga)}`,
    ausente: r.maiorReps === null,
  });

  linhas.push({ rotulo: 'Séries no total', valor: String(r.totalDeSeries) });
  return linhas;
}

const estilos = StyleSheet.create({
  chips: { gap: 7, paddingHorizontal: margem.listaDeCartoes, paddingVertical: espaco.dois },
  chip: {
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    paddingHorizontal: espaco.tres,
    paddingVertical: 7,
    maxWidth: 220,
  },
  chipAtivo: { backgroundColor: cor.acao, borderColor: cor.acao },
  chipTexto: { ...tipo.rotuloCompacto, color: cor.textoSecundario },
  chipTextoAtivo: { ...tipo.rotuloCompacto, color: cor.sobreAcao },

  detalhe: { paddingHorizontal: margem.conteudo, paddingTop: espaco.quatro, gap: espaco.um },
  nome: {
    fontFamily: tipo.nomeDoExercicio.fontFamily,
    fontSize: 26,
    lineHeight: 30,
    color: cor.texto,
  },
  sub: { ...tipo.meta, color: cor.textoTerciario },
  eixo: { ...tipo.metaMenor, color: cor.textoSecundario, marginTop: espaco.tres },

  blocoDeLeitura: {
    marginTop: espaco.tres,
    padding: espaco.quatro,
    borderRadius: raio.container,
    backgroundColor: cor.superficie,
    gap: espaco.um,
  },
  numeroSozinho: {
    fontFamily: tipo.tituloDeTela.fontFamily,
    fontSize: 38,
    lineHeight: 40,
    color: cor.texto,
  },
  blocoTitulo: { ...tipo.corpo, color: cor.texto },
  blocoTexto: { ...tipo.meta, fontSize: 12.5, color: cor.textoSecundario },

  recordes: { marginTop: espaco.quatro, gap: espaco.um },
  linhaDeRecorde: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco.dois },
  recordeRotulo: { ...tipo.corpoMenor, color: cor.textoSecundario, flexShrink: 1 },
  recordeValor: { ...tipo.corpoMenor, color: cor.texto, textAlign: 'right', flexShrink: 1 },
  recordeAusente: { ...tipo.corpoMenor, color: cor.textoTerciario, textAlign: 'right', flexShrink: 1 },

  blocoDeCalibracao: {
    marginTop: espaco.seis,
    padding: espaco.quatro,
    borderRadius: raio.container,
    backgroundColor: cor.infoTinta,
    gap: espaco.um,
  },
  calibracaoTitulo: { ...tipo.rotuloForte, color: cor.texto },
  calibracaoTexto: { ...tipo.meta, fontSize: 12.5, color: cor.infoTintaTexto },
  botaoDeCalibrar: {
    height: 46,
    borderRadius: raio.pilula,
    backgroundColor: cor.info,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: espaco.dois,
  },
  botaoPressionado: { backgroundColor: cor.infoPressionada },
  botaoDeCalibrarTexto: { ...tipo.rotuloForte, color: cor.sobreAcao },
  descalibrar: { ...tipo.rotuloCompacto, color: cor.infoTintaTexto, marginTop: espaco.dois },
});
