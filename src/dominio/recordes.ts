/**
 * 1RM estimado e recordes pessoais.
 *
 * "PR" é ambíguo — por isso aqui são recordes NOMEADOS, e todos dentro do MESMO
 * exercício: comparar supino reto com supino inclinado não é recorde. A garantia
 * de que o histórico é de um exercício só não vem de um genérico (verificado: um
 * genérico em array aceita `[kg, placa]` alargando o parâmetro de tipo), vem do
 * contêiner `HistoricoDoExercicio` — que só a query que lê UM exercício produz.
 *
 * Puro: recebe dado, devolve dado.
 */

import { compararCarga, kg, type Carga, type CargaKg } from './carga.ts';
import { cargaCompativel, emGramas, type Exercicio } from './exercicio.ts';
import {
  contaNoVolume,
  volumeDoExercicio,
  type HistoricoDoExercicio,
  type SerieExecutada,
  type VolumeNaUnidade,
} from './volume.ts';

export type { HistoricoDoExercicio } from './volume.ts';

/** Acima disso a estimativa de Epley vira ficção; ver `Estimativa.confiavel`. */
const LIMITE_REPS_CONFIAVEL = 12;

export type Estimativa = { readonly carga: CargaKg; readonly confiavel: boolean };

/**
 * Fórmula de Epley: `carga × (1 + reps / 30)`. Com 1 repetição devolve
 * praticamente a própria carga, que é o comportamento certo.
 *
 * Só aceita `CargaKg`, e isso é o ponto: Epley sobre placa crua é ficção — seis
 * placas não são 20% mais resistência que cinco. Em placa, o caminho é converter
 * antes com `gramasPorPlaca`, e aí o número já é (aproximadamente) quilo.
 */
export function estimar1RM(carga: CargaKg, repeticoes: number): Estimativa | null {
  if (carga.gramas <= 0 || repeticoes <= 0) return null;
  return {
    carga: kg(Math.round(carga.gramas * (1 + repeticoes / 30))),
    confiavel: repeticoes <= LIMITE_REPS_CONFIAVEL,
  };
}

export type Recordes = {
  readonly maiorCarga: Carga | null;
  /** Existe em kg SEMPRE, e em placa QUANDO calibrada (via `gramasPorPlaca`). */
  readonly maior1RM: Estimativa | null;
  readonly maiorVolumeSessao: VolumeNaUnidade | null;
  /** O recorde que placa não-calibrada, peso corporal e isométrico também têm. */
  readonly maiorReps: number | null;
  readonly maiorRepsNaCarga: Carga | null;
  readonly totalDeSeries: number;
  /**
   * `maior1RM` veio de conversão por `gramasPorPlaca` — a linearidade que a
   * conversão assume não é garantida por alavanca nem por roldana, então a tela
   * escreve "~" nesse número. Falso quando não há 1RM.
   */
  readonly umRMAproximado: boolean;
};

const SEM_RECORDES: Recordes = {
  maiorCarga: null,
  maior1RM: null,
  maiorVolumeSessao: null,
  maiorReps: null,
  maiorRepsNaCarga: null,
  totalDeSeries: 0,
  umRMAproximado: false,
};

/**
 * Comparação de cargas com narrow explícito por unidade. `compararCarga` é
 * genérica com `NoInfer` justamente para recusar o par misto em tempo de
 * compilação; aqui os dois valores vieram do banco, então a recusa precisa
 * acontecer em runtime — unidades diferentes NÃO são recorde, são outra escala.
 */
function superaCarga(nova: Carga, anterior: Carga | null): boolean {
  if (anterior === null) return true;
  if (nova.unidade === 'kg' && anterior.unidade === 'kg') return compararCarga(nova, anterior) > 0;
  if (nova.unidade === 'placa' && anterior.unidade === 'placa') {
    return compararCarga(nova, anterior) > 0;
  }
  return false;
}

/** Aquecimento nunca é recorde, e série sem repetição executada não é esforço medido. */
function contaParaRecorde(s: SerieExecutada): boolean {
  return contaNoVolume(s) && s.repeticoes !== null && s.repeticoes > 0;
}

export function calcularRecordes(h: HistoricoDoExercicio): Recordes {
  const validas = h.series.filter(contaParaRecorde);
  if (validas.length === 0) return SEM_RECORDES;

  const ex = h.exercicio;
  let maiorCarga: Carga | null = null;
  let maior1RM: Estimativa | null = null;
  let maiorReps: number | null = null;
  let maiorRepsNaCarga: Carga | null = null;

  for (const s of validas) {
    const reps = s.repeticoes as number;
    const carga = s.carga !== null && cargaCompativel(ex, s.carga) ? s.carga : null;

    if (carga !== null && superaCarga(carga, maiorCarga)) maiorCarga = carga;

    // Desempate do recorde de repetições pela carga: 12 reps com 6 placas é um
    // recorde melhor que 12 reps com 5, e a tela precisa mostrar a carga certa.
    if (maiorReps === null || reps > maiorReps) {
      maiorReps = reps;
      maiorRepsNaCarga = carga;
    } else if (reps === maiorReps && carga !== null && superaCarga(carga, maiorRepsNaCarga)) {
      maiorRepsNaCarga = carga;
    }

    // A conversão acontece AQUI, na leitura: calibrar a placa depois faz todo o
    // histórico ganhar 1RM retroativamente, sem reescrever uma linha de `series`.
    const gramas = emGramas(ex, carga);
    if (gramas === null) continue;
    const estimativa = estimar1RM(kg(gramas), reps);
    if (estimativa === null) continue;
    if (maior1RM === null || estimativa.carga.gramas > maior1RM.carga.gramas) {
      maior1RM = estimativa;
    }
  }

  return {
    maiorCarga,
    maior1RM,
    maiorVolumeSessao: maiorVolumeDeUmaSessao(h),
    maiorReps,
    maiorRepsNaCarga,
    totalDeSeries: validas.length,
    umRMAproximado: maior1RM !== null && ex.tipoMedicao === 'carga_placa',
  };
}

/** Recorde é o maior volume em UMA sessão, nunca a soma do histórico inteiro. */
function maiorVolumeDeUmaSessao(h: HistoricoDoExercicio): VolumeNaUnidade | null {
  const porSessao = new Map<string, SerieExecutada[]>();
  for (const s of h.series) {
    const atual = porSessao.get(s.sessaoId);
    if (atual) atual.push(s);
    else porSessao.set(s.sessaoId, [s]);
  }

  let maior: VolumeNaUnidade | null = null;
  for (const series of porSessao.values()) {
    const v = volumeDoExercicio({ exercicio: h.exercicio, series });
    if (v !== null && (maior === null || v.valor > maior.valor)) maior = v;
  }
  return maior;
}

/**
 * "Bateu recorde agora?" — o selo que a tela acende no instante do toque, com os
 * recordes que já estavam carregados para o cabeçalho, sem consulta nova.
 *
 * `anteriores` é o estado ANTES desta série. Empate não acende: igualar não é
 * bater, e um selo que pisca a cada série repetida deixa de significar algo.
 */
export function novoRecorde(
  serie: SerieExecutada,
  ex: Exercicio,
  anteriores: Recordes
): { readonly carga: boolean; readonly umRM: boolean; readonly reps: boolean } {
  const nenhum = { carga: false, umRM: false, reps: false };
  if (!contaParaRecorde(serie)) return nenhum;

  const reps = serie.repeticoes as number;
  const carga = serie.carga !== null && cargaCompativel(ex, serie.carga) ? serie.carga : null;

  const gramas = emGramas(ex, carga);
  const estimativa = gramas === null ? null : estimar1RM(kg(gramas), reps);

  return {
    carga: carga !== null && superaCarga(carga, anteriores.maiorCarga),
    umRM:
      estimativa !== null &&
      (anteriores.maior1RM === null ||
        estimativa.carga.gramas > anteriores.maior1RM.carga.gramas),
    reps: reps > (anteriores.maiorReps ?? 0),
  };
}
