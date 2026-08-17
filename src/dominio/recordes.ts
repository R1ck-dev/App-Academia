/**
 * 1RM estimado e recordes pessoais.
 *
 * "PR" é ambíguo — por isso aqui são três recordes nomeados, e todos dentro do
 * mesmo exercício: comparar supino reto com supino inclinado não é recorde.
 */

import { contaNoVolume, volumeDaSerie, type SerieExecutada } from './volume.ts';

/** Acima disso a estimativa de 1RM vira ficção; ver `confiavel`. */
const LIMITE_REPS_CONFIAVEL = 12;

export type Estimativa = { gramas: number; confiavel: boolean };

/**
 * Fórmula de Epley: `carga × (1 + reps / 30)`. Com 1 repetição devolve a própria
 * carga, que é o comportamento certo.
 */
export function estimar1RM(cargaG: number, repeticoes: number): Estimativa | null {
  if (cargaG <= 0 || repeticoes <= 0) return null;
  return {
    gramas: Math.round(cargaG * (1 + repeticoes / 30)),
    confiavel: repeticoes <= LIMITE_REPS_CONFIAVEL,
  };
}

export type SerieComSessao = SerieExecutada & { sessaoId: string };

export type Recordes = {
  maiorCarga: number | null;
  maior1RM: number | null;
  maiorVolumeSessao: number | null;
};

/** Considera só séries `valida` e `falha` — aquecimento nunca é recorde. */
export function calcularRecordes(series: SerieComSessao[]): Recordes {
  const validas = series.filter(
    (s): s is SerieComSessao & { cargaG: number; repeticoes: number } =>
      contaNoVolume(s) && s.cargaG !== null && s.repeticoes !== null && s.repeticoes > 0
  );

  if (validas.length === 0) {
    return { maiorCarga: null, maior1RM: null, maiorVolumeSessao: null };
  }

  const volumePorSessao = new Map<string, number>();
  for (const s of validas) {
    const anterior = volumePorSessao.get(s.sessaoId) ?? 0;
    volumePorSessao.set(s.sessaoId, anterior + (volumeDaSerie(s) ?? 0));
  }

  return {
    maiorCarga: Math.max(...validas.map((s) => s.cargaG)),
    maior1RM: Math.max(...validas.map((s) => estimar1RM(s.cargaG, s.repeticoes)?.gramas ?? 0)),
    maiorVolumeSessao: Math.max(...volumePorSessao.values()),
  };
}
