/**
 * 1RM estimado e recordes pessoais.
 *
 * "PR" é ambíguo — por isso aqui são recordes NOMEADOS, e todos dentro do MESMO
 * exercício: comparar supino reto com supino inclinado não é recorde. Essa
 * garantia vem do contêiner `HistoricoDoExercicio`, que só a query que lê UM
 * exercício produz.
 *
 * Puro: recebe dado, devolve dado.
 */

import { compararCarga, kg, type Carga } from './carga.ts';
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

export type Estimativa = { readonly carga: Carga; readonly confiavel: boolean };

/**
 * Fórmula de Epley: `carga × (1 + reps / 30)`. Com 1 repetição devolve
 * praticamente a própria carga, que é o comportamento certo.
 */
export function estimar1RM(carga: Carga, repeticoes: number): Estimativa | null {
  if (carga.gramas <= 0 || repeticoes <= 0) return null;
  return {
    carga: kg(Math.round(carga.gramas * (1 + repeticoes / 30))),
    confiavel: repeticoes <= LIMITE_REPS_CONFIAVEL,
  };
}

export type Recordes = {
  readonly maiorCarga: Carga | null;
  readonly maior1RM: Estimativa | null;
  readonly maiorVolumeSessao: VolumeNaUnidade | null;
  /** O recorde que peso corporal e isométrico também têm. */
  readonly maiorReps: number | null;
  readonly maiorRepsNaCarga: Carga | null;
  readonly totalDeSeries: number;
};

const SEM_RECORDES: Recordes = {
  maiorCarga: null,
  maior1RM: null,
  maiorVolumeSessao: null,
  maiorReps: null,
  maiorRepsNaCarga: null,
  totalDeSeries: 0,
};

function superaCarga(nova: Carga, anterior: Carga | null): boolean {
  return anterior === null || compararCarga(nova, anterior) > 0;
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

    // Desempate do recorde de repetições pela carga: 12 reps com 30 kg é um
    // recorde melhor que 12 reps com 25, e a tela precisa mostrar a carga certa.
    if (maiorReps === null || reps > maiorReps) {
      maiorReps = reps;
      maiorRepsNaCarga = carga;
    } else if (reps === maiorReps && carga !== null && superaCarga(carga, maiorRepsNaCarga)) {
      maiorRepsNaCarga = carga;
    }

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
