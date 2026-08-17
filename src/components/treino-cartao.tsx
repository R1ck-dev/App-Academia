/**
 * O cartão de UM exercício dentro da sessão — onde o "um toque" acontece.
 *
 * A tela não escolhe carga, repetição nem índice: tudo isso já veio resolvido em
 * `item.proxima` (`sugerirProximaSerie`, no domínio, com teste). O que existe
 * aqui é o DEDO: qual dos dois degraus (`proximaCarga`/`cargaAnterior`) o "+"
 * chama, e quando o toque longo diz "isto foi aquecimento".
 *
 * O ajuste local é intencionalmente efêmero e amarrado ao ÍNDICE da série
 * sugerida: assim que a série é gravada, o índice muda, o ajuste deixa de valer e
 * a sugestão volta a mandar — que é o degrau 1 (`ajuste_de_hoje`) fazendo o
 * trabalho, em vez de a tela guardar estado paralelo ao banco.
 */

import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { TecladoDeCarga } from '@/components/treino-teclado-carga';
import { useAgora } from '@/components/treino-dados';
import { textoDaOrigem, textoDoEsforco } from '@/components/treino-texto';
import { ALVO_TOQUE, cores, espaco, fonte } from '@/constants/tema';
import { confirmarSerie, desfazerSerie } from '@/db/mutations';
import type { TipoSerie } from '@/db/schema';
import {
  cargaAnterior,
  formatarCarga,
  formatarNumeroDaCarga,
  proximaCarga,
  rotuloDaUnidade,
  type Carga,
} from '@/dominio/carga';
import { formatarDuracao, formatarRelogio } from '@/dominio/datas';
import { medidoPorTempo, temCarga, unidadeDoTipo } from '@/dominio/exercicio';
import { fimDoDescanso, type ItemDaSessao, type SerieSugerida } from '@/dominio/execucao';
import type { SerieExecutada } from '@/dominio/volume';

/** Um minuto por toque: menor degrau útil de esteira. Não é regra de domínio, é o botão. */
const PASSO_DURACAO_S = 60;

type Ajuste = {
  readonly indice: number;
  readonly carga: Carga | null;
  readonly repeticoes: number | null;
  readonly duracaoS: number | null;
};

export function CartaoDoExercicio({
  sessaoId,
  item,
  atual,
}: {
  sessaoId: string;
  item: ItemDaSessao;
  atual: boolean;
}) {
  const [ajuste, setAjuste] = useState<Ajuste | null>(null);
  const [tecladoAberto, setTecladoAberto] = useState(false);

  const ex = item.exercicio;
  const unidade = unidadeDoTipo(ex.tipoMedicao);
  const sugerida = item.proxima === null ? null : aplicar(item.proxima, ajuste);
  // Em `const` locais porque o narrow de `sugerida.carga` não sobrevive dentro
  // dos callbacks dos botões — só o de uma variável que não pode ser reatribuída.
  const cargaAtual = sugerida?.carga ?? null;
  const repeticoesAtuais = sugerida?.repeticoes ?? null;
  const duracaoAtual = sugerida?.duracaoS ?? PASSO_DURACAO_S;

  function ajustar(campos: Partial<Ajuste>) {
    if (sugerida === null) return;
    setAjuste({
      indice: sugerida.indice,
      carga: sugerida.carga,
      repeticoes: sugerida.repeticoes,
      duracaoS: sugerida.duracaoS,
      ...campos,
    });
  }

  function registrar(tipo: TipoSerie) {
    if (sugerida === null) return;
    // Sem carga num exercício que exige carga, `registrarSerie` recusaria — abrir
    // o teclado é a resposta certa, e não um erro na cara dele.
    if (temCarga(ex.tipoMedicao) && sugerida.carga === null) {
      setTecladoAberto(true);
      return;
    }
    try {
      confirmarSerie(sessaoId, { ...sugerida, tipo });
      setAjuste(null);
      // Fora da transação e sem toque: o dado já está commitado antes disto.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (erro) {
      Alert.alert('Não deu para registrar', mensagemDe(erro));
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
  const origem = sugerida === null ? null : textoDaOrigem(sugerida.origemCarga);

  return (
    <View style={[estilos.cartao, atual && estilos.cartaoAtual]}>
      <View style={estilos.cabecalho}>
        <Text style={estilos.nome}>{ex.nome}</Text>
        <Text style={estilos.alvo}>{textoDoAlvo(item)}</Text>
      </View>

      {item.feitas.length === 0 ? null : (
        <View style={estilos.chips}>
          {item.feitas.map((serie) => (
            <Pressable
              key={serie.id}
              style={[estilos.chip, serie.tipo === 'aquecimento' && estilos.chipAquecimento]}
              onPress={() => desfazer(serie)}
            >
              <Text style={estilos.chipTexto}>
                {serie.tipo === 'aquecimento' ? 'aq ' : '✓ '}
                {textoDoEsforco(serie)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {item.completo ? (
        <Pressable style={estilos.extra} onPress={() => registrar('valida')}>
          <Text style={estilos.extraTexto}>+ série extra</Text>
        </Pressable>
      ) : sugerida === null ? null : (
        <>
          {unidade === null || cargaAtual === null ? null : (
            <LinhaDeAjuste
              valor={formatarNumeroDaCarga(cargaAtual)}
              rotulo={rotuloDaUnidade(cargaAtual)}
              aoDiminuir={() => ajustar({ carga: passo(cargaAtual, ex.incremento, -1) })}
              aoAumentar={() => ajustar({ carga: passo(cargaAtual, ex.incremento, 1) })}
              aoDigitar={() => setTecladoAberto(true)}
            />
          )}

          {repeticoesAtuais === null ? null : (
            <LinhaDeAjuste
              valor={String(repeticoesAtuais)}
              rotulo="reps"
              aoDiminuir={() => ajustar({ repeticoes: Math.max(1, repeticoesAtuais - 1) })}
              aoAumentar={() => ajustar({ repeticoes: repeticoesAtuais + 1 })}
            />
          )}

          {!medidoPorTempo(ex.tipoMedicao) ? null : (
            <LinhaDeAjuste
              valor={formatarDuracao(duracaoAtual)}
              rotulo=""
              aoDiminuir={() =>
                ajustar({ duracaoS: Math.max(PASSO_DURACAO_S, duracaoAtual - PASSO_DURACAO_S) })
              }
              aoAumentar={() => ajustar({ duracaoS: duracaoAtual + PASSO_DURACAO_S })}
            />
          )}

          <Pressable
            style={estilos.registrar}
            onPress={() => registrar('valida')}
            // Toque longo = aquecimento: um toque, sem menu e sem campo novo.
            onLongPress={() => registrar('aquecimento')}
          >
            <Text style={estilos.registrarTexto}>
              {temCarga(ex.tipoMedicao) && sugerida.carga === null
                ? 'Informar carga'
                : `REGISTRAR ${textoDoEsforco(sugerida)}`}
            </Text>
          </Pressable>

          <Text style={estilos.rodape}>
            {textoDoProgresso(item)}
            {origem === null ? '' : ` · ${origem}`}
            {' · segure para aquecimento'}
          </Text>
        </>
      )}

      {atual && fim !== null ? <Descanso fim={fim} /> : null}

      {tecladoAberto && unidade !== null ? (
        <TecladoDeCarga
          visivel
          unidade={unidade}
          inicial={sugerida?.carga ?? item.cargaAlvo}
          aoConfirmar={(carga) => {
            setTecladoAberto(false);
            ajustar({ carga });
          }}
          aoCancelar={() => setTecladoAberto(false)}
        />
      ) : null}
    </View>
  );
}

/** Os dois botões grandes com o número no meio. Toque longo no número = teclado. */
function LinhaDeAjuste({
  valor,
  rotulo,
  aoDiminuir,
  aoAumentar,
  aoDigitar,
}: {
  valor: string;
  rotulo: string;
  aoDiminuir: () => void;
  aoAumentar: () => void;
  aoDigitar?: () => void;
}) {
  return (
    <View style={estilos.linha}>
      <Pressable style={estilos.passo} onPress={aoDiminuir}>
        <Text style={estilos.passoTexto}>−</Text>
      </Pressable>
      <Pressable style={estilos.numeroArea} onLongPress={aoDigitar} disabled={!aoDigitar}>
        <Text style={estilos.numero}>{valor}</Text>
        {rotulo === '' ? null : <Text style={estilos.rotulo}>{rotulo}</Text>}
      </Pressable>
      <Pressable style={estilos.passo} onPress={aoAumentar}>
        <Text style={estilos.passoTexto}>+</Text>
      </Pressable>
    </View>
  );
}

/**
 * O que falta do descanso, derivado do INSTANTE de término a cada segundo — nunca
 * de ticks somados. Componente separado para o relógio redesenhar só esta linha.
 */
function Descanso({ fim }: { fim: number }) {
  const agora = useAgora();
  const restante = fim - agora;
  return (
    <Text style={[estilos.descanso, restante <= 0 && estilos.descansoPronto]}>
      {restante <= 0 ? 'descanso concluído' : `descanso ${formatarRelogio(restante)}`}
    </Text>
  );
}

// ── Apoio ──────────────────────────────────────────────────────────────────

function aplicar(sugerida: SerieSugerida, ajuste: Ajuste | null): SerieSugerida {
  // O ajuste vale para UMA série. Gravada aquela, o índice anda e o que ele
  // acabou de fazer volta a vir do banco, não da memória da tela.
  if (ajuste === null || ajuste.indice !== sugerida.indice) return sugerida;
  return {
    ...sugerida,
    carga: ajuste.carga,
    repeticoes: ajuste.repeticoes,
    duracaoS: ajuste.duracaoS,
  };
}

/**
 * O narrow por unidade não é burocracia: `proximaCarga`/`cargaAnterior` são
 * genéricas com `NoInfer`, e é este `if` que prova ao compilador que o incremento
 * é da MESMA unidade da carga. Incremento nulo (peso corporal, tempo) devolve a
 * carga intacta.
 */
function passo(carga: Carga, incremento: Carga | null, direcao: 1 | -1): Carga {
  if (incremento === null) return carga;
  if (carga.unidade === 'kg') {
    if (incremento.unidade !== 'kg') return carga;
    return direcao === 1 ? proximaCarga(carga, incremento) : cargaAnterior(carga, incremento);
  }
  if (incremento.unidade !== 'placa') return carga;
  return direcao === 1 ? proximaCarga(carga, incremento) : cargaAnterior(carga, incremento);
}

/** "4×10 · 5 placas" — o plano, do jeito que está escrito na ficha. */
function textoDoAlvo(item: ItemDaSessao): string {
  const partes: string[] = [];
  if (item.seriesAlvo > 0) {
    const reps = item.repsAlvoMax ?? item.repsAlvoMin;
    partes.push(reps === null ? `${item.seriesAlvo} séries` : `${item.seriesAlvo}×${reps}`);
  }
  if (item.cargaAlvo !== null) partes.push(formatarCarga(item.cargaAlvo));
  if (item.duracaoAlvoS !== null) partes.push(formatarDuracao(item.duracaoAlvoS));
  // Exercício fora da ficha (`seriesAlvo` 0): não tem alvo a bater, e dizer
  // "0 séries" o transformaria numa dívida que ele nunca contraiu.
  return partes.length === 0 ? 'fora da ficha' : partes.join(' · ');
}

function textoDoProgresso(item: ItemDaSessao): string {
  if (item.seriesAlvo <= 0) return `${item.contamParaAlvo + 1}ª série`;
  if (item.completo) return `série extra (${item.contamParaAlvo} de ${item.seriesAlvo})`;
  return `série ${item.contamParaAlvo + 1} de ${item.seriesAlvo}`;
}

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

const estilos = StyleSheet.create({
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.md,
    gap: espaco.sm,
  },
  cartaoAtual: { borderColor: cores.destaque },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco.sm },
  nome: { color: cores.texto, fontSize: fonte.corpo, fontWeight: '700', flexShrink: 1 },
  alvo: { color: cores.textoFraco, fontSize: fonte.legenda },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.xs },
  chip: {
    backgroundColor: cores.superficieAlta,
    borderRadius: 999,
    paddingHorizontal: espaco.sm,
    paddingVertical: espaco.xs,
  },
  chipAquecimento: { opacity: 0.6 },
  chipTexto: { color: cores.texto, fontSize: fonte.legenda },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  passo: {
    width: ALVO_TOQUE + 8,
    height: ALVO_TOQUE + 8,
    borderRadius: 12,
    backgroundColor: cores.superficieAlta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passoTexto: { color: cores.texto, fontSize: fonte.titulo, fontWeight: '700' },
  numeroArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  numero: { color: cores.texto, fontSize: fonte.numero, fontWeight: '700' },
  rotulo: { color: cores.textoFraco, fontSize: fonte.legenda },
  registrar: {
    minHeight: 76,
    borderRadius: 14,
    backgroundColor: cores.destaque,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espaco.md,
  },
  registrarTexto: {
    color: cores.fundo,
    fontSize: fonte.titulo,
    fontWeight: '800',
    textAlign: 'center',
  },
  extra: {
    minHeight: ALVO_TOQUE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraTexto: { color: cores.textoFraco, fontSize: fonte.corpo },
  rodape: { color: cores.textoFraco, fontSize: fonte.legenda, textAlign: 'center' },
  descanso: { color: cores.textoFraco, fontSize: fonte.legenda, textAlign: 'center' },
  descansoPronto: { color: cores.destaque },
});
