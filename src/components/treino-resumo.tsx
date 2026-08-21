/**
 * O que a sessão foi, depois de finalizada — e o ÚNICO lugar do app onde a ficha
 * pode mudar.
 *
 * Quatro blocos, na ordem em que interessam: volume (com o que NÃO entrou na
 * conta, nomeado, porque um total sozinho tem cara de completo e não é), o que
 * ficou de fora, as divergências entre o que ele fez e o que a ficha manda, e os
 * recordes. A divergência vira `definirCargaAlvo` só por toque, com os dois
 * números visíveis: plano ≠ realizado, e progressão automática vira laço que não
 * converge.
 *
 * A leitura é uma FOTO, tirada uma vez na montagem: a sessão acabou, nada mais
 * muda nela, e reler a cada escrita faria a divergência sumir da tela no
 * instante em que ele tocasse em "atualizar a ficha" — justamente quando o
 * desenho pede que ela vire "ficha atualizada para 6 placas".
 */

import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { motivoCurto } from '@/components/treino-texto';
import { alvo, cor, espaco, margem, raio, tipo } from '@/constants/tema';
import { definirCargaAlvo } from '@/db/mutations';
import { historicoDoExercicio, planoDaSessao, seriesDaSessaoComExercicio } from '@/db/queries';
import { formatarCarga, formatarVolume, type Carga } from '@/dominio/carga';
import { formatarDuracao } from '@/dominio/datas';
import { divergenciasDoPlano, type Divergencia, type PlanoDaSessao } from '@/dominio/execucao';
import { calcularRecordes, novoRecorde } from '@/dominio/recordes';
import { volumeDaSessao, type VolumeDaSessao } from '@/dominio/volume';

type RecordeBatido = { nome: string; carga: boolean; umRM: boolean; reps: boolean };

export function ResumoDaSessao({
  sessaoId,
  aoConcluir,
}: {
  sessaoId: string;
  aoConcluir: () => void;
}) {
  const [resumo] = useState(() => montarResumo(sessaoId));
  const [aplicadas, setAplicadas] = useState<readonly string[]>([]);

  if (resumo === null) {
    return (
      <SafeAreaView style={estilos.area} edges={['top', 'left', 'right']}>
        <View style={estilos.cabecalho}>
          <Text style={estilos.titulo}>Treino concluído</Text>
        </View>
        <Pressable style={estilos.concluir} onPress={aoConcluir}>
          <Text style={estilos.concluirTexto}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  function atualizarFicha(d: Divergencia) {
    try {
      definirCargaAlvo(d.itemId, d.sugerida);
      setAplicadas((antes) => [...antes, d.itemId]);
    } catch (erro) {
      Alert.alert(
        'Não deu para atualizar a ficha',
        erro instanceof Error ? erro.message : String(erro)
      );
    }
  }

  const { volume } = resumo;

  return (
    <SafeAreaView style={estilos.area} edges={['top', 'left', 'right']}>
      <ScrollView style={estilos.expandir} contentContainerStyle={estilos.rolagem}>
        <View style={estilos.cabecalho}>
          <Text style={estilos.kicker}>
            {resumo.nome}
            {resumo.duracaoS === null ? '' : ` · ${formatarDuracao(resumo.duracaoS)}`}
          </Text>
          <Text style={estilos.titulo}>Terminado</Text>
          <Text style={estilos.volume}>{formatarVolume(volume.gramasReps)}</Text>
          <Text style={estilos.volumeSub}>{textoDoVolume(volume)}</Text>
        </View>

        <View style={estilos.bloco}>
          <Text style={estilos.tituloDoBloco}>Fora da soma</Text>
          {volume.foraDaSoma.length === 0 ? (
            <Text style={estilos.linhaVazia}>
              {volume.seriesSomadas === 0 ? 'Nada registrado ainda.' : 'Tudo entrou na conta.'}
            </Text>
          ) : (
            volume.foraDaSoma.map((f) => (
              <View key={`${f.id}-${f.motivo}`} style={estilos.linhaFora}>
                <Text style={estilos.foraNome} numberOfLines={1}>
                  {f.nome}
                </Text>
                <Text style={estilos.foraMotivo}>
                  {f.series}× · {motivoCurto(f.motivo)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={estilos.secao}>
          {resumo.divergencias.length === 0 ? (
            <Text style={estilos.observacao}>A ficha bate com o que você fez. Nada a mudar aqui.</Text>
          ) : (
            resumo.divergencias.map((d) => {
              const aplicada = aplicadas.includes(d.itemId);
              return (
                <View key={d.itemId} style={estilos.divergencia}>
                  <Text style={estilos.divergenciaNome}>{d.nome}</Text>
                  <Text style={estilos.divergenciaTexto}>
                    Você fez <Text style={estilos.forte}>{resumo.comoAconteceu[d.itemId]}</Text>. A
                    ficha diz{' '}
                    <Text style={estilos.forte}>
                      {d.noPlano === null ? 'sem carga' : formatarCarga(d.noPlano)}
                    </Text>
                    .
                  </Text>
                  <Pressable
                    disabled={aplicada}
                    style={({ pressed }) => [
                      estilos.botaoDaDivergencia,
                      aplicada ? estilos.botaoAplicado : null,
                      pressed && !aplicada ? estilos.botaoPressionado : null,
                    ]}
                    onPress={() => atualizarFicha(d)}
                  >
                    <Text style={aplicada ? estilos.textoAplicado : estilos.textoDoBotao}>
                      {aplicada ? 'Ficha atualizada para ' : 'Atualizar a ficha para '}
                      {formatarCarga(d.sugerida)}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        <View style={estilos.secao}>
          {resumo.recordes.length === 0 ? (
            <Text style={estilos.observacao}>Nenhum recorde hoje.</Text>
          ) : (
            resumo.recordes.map((r) => (
              <View key={r.nome} style={estilos.recorde}>
                <View style={estilos.estrela}>
                  <Text style={estilos.estrelaTexto}>★</Text>
                </View>
                <Text style={estilos.recordeTexto}>
                  {r.nome} · {textoDoRecorde(r)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Pressable
        style={({ pressed }) => [estilos.concluir, pressed && estilos.concluirTocado]}
        onPress={aoConcluir}
      >
        <Text style={estilos.concluirTexto}>Concluir</Text>
      </Pressable>
    </SafeAreaView>
  );
}

// ── Montagem ───────────────────────────────────────────────────────────────

type Resumo = {
  nome: string;
  duracaoS: number | null;
  volume: VolumeDaSessao;
  recordes: RecordeBatido[];
  divergencias: readonly Divergencia[];
  /** itemId → "6 placas em 2 séries, 8 placas em 1 série". */
  comoAconteceu: Record<string, string>;
};

function montarResumo(sessaoId: string): Resumo | null {
  const plano = planoDaSessao(sessaoId);
  if (plano === null) return null;

  const series = seriesDaSessaoComExercicio(sessaoId);
  const ultima = series.reduce((maior, s) => Math.max(maior, s.concluidaEm), 0);
  const divergencias = divergenciasDoPlano(plano);

  const comoAconteceu: Record<string, string> = {};
  for (const d of divergencias) {
    const item = plano.itens.find((i) => i.itemId === d.itemId);
    if (item !== undefined) comoAconteceu[d.itemId] = cargasComoAconteceram(item.feitas);
  }

  return {
    nome: plano.sessao.nome,
    // Do início até a ÚLTIMA série: é o último instante sobre o qual existe
    // dado. "Agora" incluiria o tempo que ele levou para olhar o resumo.
    duracaoS: ultima === 0 ? null : Math.round((ultima - plano.sessao.iniciadaEm) / 1000),
    volume: volumeDaSessao(series),
    recordes: recordesBatidos(plano),
    divergencias,
    comoAconteceu,
  };
}

/**
 * "6 placas em 2 séries, 8 placas em 1 série" — o que ele fez, como aconteceu.
 *
 * Um número só ("30 kg") esconderia que a última série subiu, que é exatamente
 * a informação que decide se vale mudar a ficha.
 */
function cargasComoAconteceram(feitas: readonly { carga: Carga | null; tipo: string }[]): string {
  const contagem = new Map<string, { carga: Carga; series: number }>();
  for (const s of feitas) {
    if (s.tipo === 'aquecimento' || s.carga === null) continue;
    const chave = String(s.carga.gramas);
    const atual = contagem.get(chave);
    contagem.set(chave, { carga: s.carga, series: (atual?.series ?? 0) + 1 });
  }
  const partes = [...contagem.values()]
    .sort((a, b) => a.carga.gramas - b.carga.gramas)
    .map((c) => `${formatarCarga(c.carga)} em ${c.series} ${c.series === 1 ? 'série' : 'séries'}`);
  return partes.length === 0 ? 'as séries de hoje' : partes.join(', ');
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

function textoDoVolume(v: VolumeDaSessao): string {
  return `${v.seriesSomadas} ${v.seriesSomadas === 1 ? 'série somada' : 'séries somadas'}`;
}

const estilos = StyleSheet.create({
  /** A rolagem cede o espaço do rodapé fixo em vez de empurrá-lo para fora. */
  expandir: { flex: 1 },
  area: { flex: 1, backgroundColor: cor.fundo },
  rolagem: { paddingBottom: espaco.seis },
  cabecalho: { paddingHorizontal: margem.conteudo, paddingTop: espaco.tres, gap: espaco.dois },
  kicker: { ...tipo.kicker, color: cor.infoKicker },
  titulo: { fontFamily: tipo.tituloDeTela.fontFamily, fontSize: 38, lineHeight: 40, color: cor.texto },
  volume: { ...tipo.numeroMedio, color: cor.acaoTexto, marginTop: espaco.tres },
  volumeSub: { ...tipo.meta, fontSize: 12.5, color: cor.textoSecundario },

  bloco: {
    marginTop: espaco.quatro,
    marginHorizontal: margem.listaDeCartoes,
    padding: espaco.quatro,
    borderRadius: raio.container,
    backgroundColor: cor.superficie,
    gap: espaco.dois,
  },
  tituloDoBloco: { ...tipo.kicker, letterSpacing: 1.5, color: cor.textoSecundario },
  linhaFora: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco.dois },
  foraNome: { ...tipo.meta, fontSize: 12.5, color: cor.texto, flexShrink: 1 },
  foraMotivo: { ...tipo.meta, fontSize: 12.5, color: cor.textoTerciario },
  linhaVazia: { ...tipo.meta, fontSize: 12.5, color: cor.textoSecundario },

  secao: { paddingHorizontal: margem.conteudo, paddingTop: espaco.quatro, gap: espaco.dois },
  observacao: { ...tipo.meta, fontSize: 12.5, color: cor.textoTerciario },

  // O único contorno de atenção do app inteiro.
  divergencia: {
    padding: espaco.quatro,
    borderRadius: raio.container,
    borderWidth: 2,
    borderColor: cor.acaoContorno,
    gap: espaco.dois,
  },
  divergenciaNome: { fontFamily: tipo.rotuloForte.fontFamily, fontSize: 14.5, color: cor.texto },
  divergenciaTexto: { ...tipo.corpoMenor, color: cor.textoSecundario },
  forte: { fontFamily: tipo.rotuloForte.fontFamily, color: cor.texto },
  botaoDaDivergencia: {
    height: 46,
    borderRadius: raio.pilula,
    backgroundColor: cor.acao,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: espaco.um,
  },
  botaoPressionado: { backgroundColor: cor.acaoPressionada },
  botaoAplicado: { backgroundColor: cor.infoTinta },
  textoDoBotao: { ...tipo.rotuloForte, color: cor.sobreAcao },
  textoAplicado: { ...tipo.rotuloForte, color: cor.infoTintaTextoForte },

  recorde: { flexDirection: 'row', alignItems: 'center', gap: espaco.dois },
  estrela: {
    width: 34,
    height: 34,
    borderRadius: raio.pilula,
    backgroundColor: cor.acao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estrelaTexto: { fontSize: 15, color: cor.sobreAcao },
  recordeTexto: { ...tipo.corpoMenor, fontSize: 13.5, color: cor.texto, flexShrink: 1 },

  concluir: {
    height: 60,
    marginHorizontal: margem.listaDeCartoes,
    marginBottom: espaco.seis,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  concluirTocado: { backgroundColor: cor.acaoTinta },
  concluirTexto: { fontFamily: tipo.itemForte.fontFamily, fontSize: 16, color: cor.texto },
});
