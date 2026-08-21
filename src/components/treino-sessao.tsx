/**
 * A tela de execução: um exercício por vez, e a série do dia a UM toque.
 *
 * Não há estado de sessão em memória. A tela inteira é `planoDaSessao(sessaoId)`
 * — app morto, bateria acabada ou celular reiniciado dão no mesmo: reabrir
 * reconstrói tudo, inclusive o exercício em que ele estava e o cronômetro.
 *
 * O que é estado de UI, e só de UI: qual exercício está na tela, o ajuste de
 * carga/repetição da série corrente e o teclado aberto. O ajuste vale para UMA
 * série — gravada aquela, o índice anda e a sugestão do domínio volta a mandar,
 * que é o degrau `ajuste_de_hoje` fazendo o trabalho em vez de a tela guardar
 * estado paralelo ao banco.
 *
 * **A trilha é tocável.** O handoff a desenhou como indicador, mas a máquina
 * ocupada é o caso mais comum da academia: sem poder pular para o exercício 5 e
 * voltar, o app obrigaria a esperar de pé — e o bloco de notas não obriga.
 * O desenho não muda; só ganha alvo de toque.
 */

import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Vazio } from '@/components/tela';
import { useAgora, usePlanoDaSessao } from '@/components/treino-dados';
import { ReguaDeSeries } from '@/components/treino-regua';
import { TecladoDeCarga } from '@/components/treino-teclado-carga';
import { textoDaOrigem, textoDoEsforco, textoDoQueVaiGravar } from '@/components/treino-texto';
import { alvo, cor, espaco, margem, movimento, raio, tipo } from '@/constants/tema';
import { confirmarSerie, desfazerSerie, finalizarSessao } from '@/db/mutations';
import type { TipoSerie } from '@/db/schema';
import {
  cargaAnterior,
  formatarNumeroDaCarga,
  proximaCarga,
  type Carga,
} from '@/dominio/carga';
import { formatarDuracao, formatarRelogio } from '@/dominio/datas';
import { medidoPorTempo, temCarga } from '@/dominio/exercicio';
import { fimDoDescanso, type ItemDaSessao, type SerieSugerida } from '@/dominio/execucao';
import type { SerieExecutada } from '@/dominio/volume';

/** Um minuto por toque: menor degrau útil de esteira. */
const PASSO_DURACAO_S = 60;

/** Meio segundo: acima do intervalo de um toque duplo, abaixo de qualquer série real. */
const JANELA_TOQUE_REPETIDO_MS = 500;

type Ajuste = {
  readonly chave: string;
  readonly carga: Carga | null;
  readonly repeticoes: number | null;
  readonly duracaoS: number | null;
};

export function TelaSessao({
  sessaoId,
  aoFinalizar,
}: {
  sessaoId: string;
  aoFinalizar: (sessaoId: string) => void;
}) {
  // A tela fica ligada durante o treino: bloquear o celular a cada série e
  // desbloquear com a mão suada é o atrito que manda ele de volta pro papel.
  useKeepAwake();
  const plano = usePlanoDaSessao(sessaoId);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<Ajuste | null>(null);
  const [tecladoAberto, setTecladoAberto] = useState(false);
  // `useRef` e não `useState`: o valor é lido e escrito dentro do MESMO toque, e
  // um `state` só mudaria no render seguinte — tarde demais para barrar o
  // segundo toque, que é justamente o que chega antes do redesenho.
  const ultimoRegistro = useRef(0);
  const voo = useRef(new Animated.Value(0)).current;
  const [voando, setVoando] = useState<string | null>(null);

  if (plano === null) {
    return (
      <SafeAreaView style={estilos.area} edges={['top', 'left', 'right']}>
        <Vazio mensagem="Esta sessão não existe mais." acao="Volte e escolha um treino." />
      </SafeAreaView>
    );
  }

  const itens = plano.itens;
  const item = itens.find((i) => i.itemId === escolhido) ?? plano.itemAtual ?? itens[itens.length - 1];

  if (item === undefined) {
    return (
      <SafeAreaView style={estilos.area} edges={['top', 'left', 'right']}>
        <Vazio
          mensagem="Esta sessão não tem exercícios."
          acao="Monte a ficha deste treino para registrar séries."
        />
      </SafeAreaView>
    );
  }

  const ex = item.exercicio;
  const chave = `${ex.id}:${item.proxima?.indice ?? -1}`;
  const sugerida = item.proxima === null ? null : aplicar(item.proxima, ajuste, chave);
  const seguinte = itens[itens.indexOf(item) + 1];

  function ajustar(campos: Partial<Omit<Ajuste, 'chave'>>) {
    if (sugerida === null) return;
    setAjuste({
      chave,
      carga: sugerida.carga,
      repeticoes: sugerida.repeticoes,
      duracaoS: sugerida.duracaoS,
      ...campos,
    });
  }

  function animarVoo(texto: string) {
    setVoando(texto);
    voo.setValue(0);
    Animated.timing(voo, {
      toValue: 1,
      duration: movimento.voo.duracaoMs,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start(() => setVoando(null));
  }

  function registrar(tipo: TipoSerie) {
    if (sugerida === null) return;
    // Sem carga num exercício que exige carga, `registrarSerie` recusaria — abrir
    // o teclado é a resposta certa, e não um erro na cara dele.
    if (temCarga(ex.tipoMedicao) && sugerida.carga === null) {
      setTecladoAberto(true);
      return;
    }
    // Ninguém faz duas séries em meio segundo: o segundo toque é engano ou tela
    // engasgando. Registrar as duas deixaria uma série fantasma no histórico,
    // descoberta só semanas depois.
    if (Date.now() - ultimoRegistro.current < JANELA_TOQUE_REPETIDO_MS) return;
    ultimoRegistro.current = Date.now();
    try {
      confirmarSerie(sessaoId, { ...sugerida, tipo });
      setAjuste(null);
      // Escolheu um exercício à mão e acabou de fechá-lo: o fluxo volta a mandar,
      // em vez de deixá-lo parado num exercício completo.
      if (escolhido !== null && item.faltam === 1) setEscolhido(null);
      animarVoo(numeroPrincipal(sugerida, ex.tipoMedicao));
      // Fora da transação e sem toque: o dado já está commitado antes disto. Ele
      // não está olhando a tela quando toca — a vibração é a confirmação.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (erro) {
      Alert.alert('Não deu para registrar', erro instanceof Error ? erro.message : String(erro));
    }
  }

  function desfazer(serie: SerieExecutada) {
    Alert.alert('Desfazer esta série?', textoDoEsforco(serie), [
      { text: 'Manter', style: 'cancel' },
      { text: 'Desfazer', style: 'destructive', onPress: () => desfazerSerie(serie.id) },
    ]);
  }

  const ultima = item.feitas.length === 0 ? null : item.feitas[item.feitas.length - 1];
  const fim = fimDoDescanso(ultima, item.descansoS);
  const numero = sugerida === null ? '—' : numeroPrincipal(sugerida, ex.tipoMedicao);
  const unidade = rotuloDaGrandeza(sugerida?.carga ?? null, ex.tipoMedicao);

  return (
    <SafeAreaView style={estilos.area} edges={['top', 'left', 'right']}>
      <View style={estilos.topo}>
        <View style={estilos.topoTextos}>
          <Text style={estilos.nomeDaSessao}>{plano.sessao.nome}</Text>
          <Text style={estilos.contagem}>
            {plano.seriesFeitas} de {plano.seriesAlvo} séries · tela acordada
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [estilos.finalizar, pressed && estilos.finalizarTocado]}
          onPress={() => confirmarFim(plano.seriesFaltando, () => {
            finalizarSessao(sessaoId);
            aoFinalizar(sessaoId);
          })}
        >
          <Text style={estilos.finalizarTexto}>Finalizar</Text>
        </Pressable>
      </View>

      <View style={estilos.trilha}>
        {itens.map((passo) => (
          <Pressable
            key={passo.itemId}
            onPress={() => setEscolhido(passo.itemId)}
            hitSlop={14}
            style={[
              estilos.passo,
              passo.itemId === item.itemId && estilos.passoAtual,
              passo.completo && estilos.passoCompleto,
            ]}
          />
        ))}
      </View>

      <ScrollView
        style={estilos.expandir}
        contentContainerStyle={estilos.rolagem}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.cabecalhoDoExercicio}>
          <Text style={estilos.nomeDoExercicio}>{ex.nome}</Text>
          <View style={estilos.contexto}>
            <View style={estilos.posicao}>
              <Text style={estilos.posicaoTexto}>{textoDaPosicao(item)}</Text>
            </View>
            {sugerida === null ? null : (
              <Text style={estilos.procedencia}>{textoDaOrigem(sugerida.origemCarga)}</Text>
            )}
            {fim === null ? null : <Descanso fim={fim} />}
          </View>
        </View>

        <View style={estilos.controle}>
          <Pressable
            style={({ pressed }) => [estilos.passoMenos, pressed && estilos.passoMenosTocado]}
            onPress={() => ajustarGrandeza(-1)}
          >
            <Text style={estilos.passoSinal}>−</Text>
          </Pressable>

          <Pressable style={estilos.numeroArea} onPress={() => setTecladoAberto(true)}>
            <Text style={estilos.numero}>{numero}</Text>
            <Text style={estilos.unidade}>{unidade}</Text>
            {voando === null ? null : (
              <Animated.Text
                pointerEvents="none"
                style={[
                  estilos.numero,
                  estilos.numeroVoando,
                  {
                    opacity: voo.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                    transform: [
                      {
                        translateY: voo.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, movimento.voo.deslocamentoY],
                        }),
                      },
                      {
                        scale: voo.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, movimento.voo.escalaFinal],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {voando}
              </Animated.Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [estilos.passoMais, pressed && estilos.passoMaisTocado]}
            onPress={() => ajustarGrandeza(1)}
          >
            <Text style={estilos.passoSinalMais}>+</Text>
          </Pressable>
        </View>

        {!temCarga(ex.tipoMedicao) || sugerida?.repeticoes == null ? null : (
          <View style={estilos.faixaDeReps}>
            <Text style={estilos.repsRotulo}>
              repetições <Text style={estilos.repsNumero}>{sugerida.repeticoes}</Text>
            </Text>
            <View style={estilos.repsBotoes}>
              <Pressable
                style={({ pressed }) => [estilos.passoDeReps, pressed && estilos.passoMenosTocado]}
                onPress={() => ajustar({ repeticoes: Math.max(1, (sugerida.repeticoes ?? 1) - 1) })}
              >
                <Text style={estilos.passoSinalPequeno}>−</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [estilos.passoDeReps, pressed && estilos.passoMenosTocado]}
                onPress={() => ajustar({ repeticoes: (sugerida.repeticoes ?? 0) + 1 })}
              >
                <Text style={estilos.passoSinalPequeno}>+</Text>
              </Pressable>
            </View>
          </View>
        )}

        <ReguaDeSeries item={item} aoDesfazer={desfazer} />

        {seguinte === undefined ? null : (
          <Text style={estilos.aSeguir}>a seguir · {seguinte.exercicio.nome}</Text>
        )}
      </ScrollView>

      <View style={estilos.acoes}>
        <Pressable
          style={({ pressed }) => [estilos.aquecimento, pressed && estilos.aquecimentoTocado]}
          onPress={() => registrar('aquecimento')}
        >
          <Text style={estilos.aquecimentoTitulo}>Aquec.</Text>
          <Text style={estilos.aquecimentoSub}>não conta</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [estilos.registrar, pressed && estilos.registrarTocado]}
          onPress={() => registrar('valida')}
        >
          <Text style={estilos.registrarTitulo}>
            {sugerida !== null && temCarga(ex.tipoMedicao) && sugerida.carga === null
              ? 'Informar carga'
              : 'Registrar'}
          </Text>
          {sugerida === null ? null : (
            <Text style={estilos.registrarSub}>{textoDoQueVaiGravar(sugerida)}</Text>
          )}
        </Pressable>
      </View>

      {tecladoAberto && temCarga(ex.tipoMedicao) ? (
        <TecladoDeCarga
          visivel
          inicial={sugerida?.carga ?? item.cargaAlvo}
          aoConfirmar={(carga) => {
            setTecladoAberto(false);
            ajustar({ carga });
          }}
          aoCancelar={() => setTecladoAberto(false)}
        />
      ) : null}
    </SafeAreaView>
  );

  /**
   * O ± mexe na grandeza QUE AQUELE EXERCÍCIO tem: carga onde há carga, minuto
   * na esteira, repetição no peso corporal. É o mesmo critério de
   * `valorDaProgressao` no gráfico — a tela não inventa uma grandeza própria.
   */
  function ajustarGrandeza(direcao: 1 | -1) {
    if (sugerida === null) return;
    if (temCarga(ex.tipoMedicao)) {
      if (sugerida.carga === null) {
        setTecladoAberto(true);
        return;
      }
      ajustar({ carga: passo(sugerida.carga, ex.incremento, direcao) });
      return;
    }
    if (medidoPorTempo(ex.tipoMedicao)) {
      const atual = sugerida.duracaoS ?? PASSO_DURACAO_S;
      ajustar({ duracaoS: Math.max(PASSO_DURACAO_S, atual + direcao * PASSO_DURACAO_S) });
      return;
    }
    ajustar({ repeticoes: Math.max(1, (sugerida.repeticoes ?? 1) + direcao) });
  }
}

/**
 * O que falta do descanso, derivado do INSTANTE de término a cada segundo —
 * nunca de ticks somados. Componente separado para o relógio redesenhar só esta
 * linha.
 */
function Descanso({ fim }: { fim: number }) {
  const agora = useAgora();
  const restante = fim - agora;
  if (restante <= 0) return null;
  return <Text style={estilos.descanso}>· descanso {formatarRelogio(restante)}</Text>;
}

// ── Apoio ──────────────────────────────────────────────────────────────────

function confirmarFim(faltando: number, encerrar: () => void) {
  if (faltando === 0) {
    encerrar();
    return;
  }
  Alert.alert(
    'Finalizar assim?',
    `Ainda faltam ${faltando} ${faltando === 1 ? 'série' : 'séries'} do plano.`,
    [
      { text: 'Continuar treinando', style: 'cancel' },
      { text: 'Finalizar', style: 'destructive', onPress: encerrar },
    ]
  );
}

function aplicar(sugerida: SerieSugerida, ajuste: Ajuste | null, chave: string): SerieSugerida {
  // O ajuste vale para UMA série do MESMO exercício. Gravada aquela — ou trocado
  // o exercício pela trilha — a chave muda e o que ele acabou de fazer volta a
  // vir do banco, não da memória da tela.
  if (ajuste === null || ajuste.chave !== chave) return sugerida;
  return {
    ...sugerida,
    carga: ajuste.carga,
    repeticoes: ajuste.repeticoes,
    duracaoS: ajuste.duracaoS,
  };
}

/** O número de 84 px: a grandeza que ele ajusta neste exercício. */
function numeroPrincipal(
  esforco: { carga: Carga | null; repeticoes: number | null; duracaoS: number | null },
  tipoMedicao: ItemDaSessao['exercicio']['tipoMedicao']
): string {
  if (temCarga(tipoMedicao)) {
    return esforco.carga === null ? '—' : formatarNumeroDaCarga(esforco.carga);
  }
  if (medidoPorTempo(tipoMedicao)) return formatarDuracao(esforco.duracaoS ?? PASSO_DURACAO_S);
  return esforco.repeticoes === null ? '—' : String(esforco.repeticoes);
}

function rotuloDaGrandeza(
  carga: Carga | null,
  tipoMedicao: ItemDaSessao['exercicio']['tipoMedicao']
): string {
  if (temCarga(tipoMedicao)) return carga === null ? 'toque para informar' : 'kg';
  if (medidoPorTempo(tipoMedicao)) return 'na esteira';
  return 'repetições';
}

/** Sem incremento não há degrau: exercício sem carga não anda pelo "+"/"−". */
function passo(carga: Carga, incremento: Carga | null, direcao: 1 | -1): Carga {
  if (incremento === null) return carga;
  return direcao === 1 ? proximaCarga(carga, incremento) : cargaAnterior(carga, incremento);
}

/** "3ª de 4" — ou "fora da ficha · 2ª", que nunca vira "0 séries". */
function textoDaPosicao(item: ItemDaSessao): string {
  if (item.seriesAlvo <= 0) return `fora da ficha · ${item.contamParaAlvo + 1}ª`;
  if (item.completo) return `extra · ${item.contamParaAlvo} de ${item.seriesAlvo}`;
  return `${item.contamParaAlvo + 1}ª de ${item.seriesAlvo}`;
}

const estilos = StyleSheet.create({
  /** A rolagem cede o espaço do rodapé fixo em vez de empurrá-lo para fora. */
  expandir: { flex: 1 },
  area: { flex: 1, backgroundColor: cor.fundo },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.tres,
    paddingHorizontal: margem.listaDeCartoes,
    paddingTop: espaco.dois,
  },
  topoTextos: { flex: 1, minWidth: 0 },
  nomeDaSessao: { fontFamily: tipo.itemForte.fontFamily, fontSize: 16, color: cor.texto },
  contagem: { ...tipo.metaMenor, color: cor.textoTerciario },
  finalizar: {
    height: 40,
    paddingHorizontal: espaco.quatro,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalizarTocado: { backgroundColor: cor.acaoTinta },
  finalizarTexto: { ...tipo.rotuloCompacto, color: cor.textoSecundario },

  trilha: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    paddingHorizontal: margem.listaDeCartoes,
    paddingTop: espaco.quatro,
  },
  passo: {
    width: 14,
    height: 14,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
  },
  passoAtual: { width: 18, height: 18, borderColor: cor.acao, backgroundColor: cor.acaoTinta },
  passoCompleto: { backgroundColor: cor.acao, borderColor: cor.acao },

  rolagem: { paddingBottom: espaco.quatro },
  cabecalhoDoExercicio: { paddingHorizontal: margem.conteudo, paddingTop: espaco.seis },
  nomeDoExercicio: { ...tipo.nomeDoExercicio, color: cor.texto },
  contexto: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: espaco.dois,
    marginTop: espaco.dois,
  },
  posicao: {
    borderRadius: raio.pilula,
    backgroundColor: cor.acaoTinta,
    paddingHorizontal: espaco.tres,
    paddingVertical: 5,
  },
  posicaoTexto: { fontFamily: tipo.rotuloCompacto.fontFamily, fontSize: 12, color: cor.acaoTexto },
  procedencia: { ...tipo.meta, fontSize: 12.5, color: cor.textoSecundario },
  descanso: { ...tipo.meta, fontSize: 12.5, color: cor.textoTerciario },

  controle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.tres,
    paddingHorizontal: margem.listaDeCartoes,
    paddingTop: espaco.quatro,
  },
  passoMenos: {
    width: alvo.passoDeCarga,
    height: alvo.passoDeCarga,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passoMenosTocado: { backgroundColor: cor.acaoTinta },
  passoMais: {
    width: alvo.passoDeCarga,
    height: alvo.passoDeCarga,
    borderRadius: raio.pilula,
    backgroundColor: cor.acao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passoMaisTocado: { backgroundColor: cor.acaoPressionada },
  passoSinal: { fontSize: 32, lineHeight: 36, color: cor.textoSecundario },
  passoSinalMais: { fontSize: 32, lineHeight: 36, color: cor.sobreAcao },
  passoSinalPequeno: { fontSize: 19, lineHeight: 22, color: cor.textoSecundario },
  numeroArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  numero: { ...tipo.numeroGrande, color: cor.texto, textAlign: 'center' },
  numeroVoando: { position: 'absolute', top: 0, color: cor.acao },
  unidade: { ...tipo.corpo, fontSize: 14.5, color: cor.textoSecundario, marginTop: 2 },

  faixaDeReps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: margem.listaDeCartoes,
    marginTop: espaco.tres,
    paddingVertical: espaco.tres,
    paddingHorizontal: espaco.quatro,
    borderRadius: raio.container,
    backgroundColor: cor.superficie,
  },
  repsRotulo: { ...tipo.corpoMenor, color: cor.textoSecundario },
  repsNumero: { fontFamily: tipo.numeroPequeno.fontFamily, fontSize: 22, color: cor.texto },
  repsBotoes: { flexDirection: 'row', gap: espaco.dois },
  passoDeReps: {
    width: alvo.passoDeReps.largura,
    height: alvo.passoDeReps.altura,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },

  aSeguir: {
    paddingHorizontal: margem.conteudo,
    paddingTop: espaco.quatro,
    ...tipo.meta,
    color: cor.textoTerciario,
  },

  acoes: {
    flexDirection: 'row',
    gap: espaco.dois,
    paddingHorizontal: margem.listaDeCartoes,
    paddingBottom: espaco.seis,
    paddingTop: espaco.dois,
  },
  aquecimento: {
    width: alvo.aquecimento,
    height: alvo.aquecimento,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: cor.infoBorda,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  aquecimentoTocado: { backgroundColor: cor.infoTinta },
  aquecimentoTitulo: { fontFamily: tipo.rotuloForte.fontFamily, fontSize: 13.5, color: cor.infoTintaTexto },
  aquecimentoSub: { ...tipo.metaMenor, fontSize: 10.5, color: cor.infoKicker },
  registrar: {
    flex: 1,
    height: alvo.registrar,
    borderRadius: raio.pilula,
    backgroundColor: cor.acao,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  registrarTocado: { backgroundColor: cor.acaoPressionada },
  registrarTitulo: { ...tipo.rotuloPrimario, color: cor.sobreAcao },
  registrarSub: { ...tipo.meta, fontSize: 12.5, color: cor.sobreAcao, opacity: 0.88 },
});
