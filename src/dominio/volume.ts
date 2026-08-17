/**
 * Volume e sugestão de progressão. Puro: recebe dados, devolve dados.
 */

import type { TipoSerie } from '../db/schema.ts';
import { INCREMENTO_PADRAO_G } from './carga.ts';

export type SerieExecutada = {
  tipo: TipoSerie;
  cargaG: number | null;
  repeticoes: number | null;
};

/** Aquecimento não é esforço a contabilizar — só infla o gráfico. */
export const contaNoVolume = (s: SerieExecutada): boolean => s.tipo !== 'aquecimento';

/** `null` quando a série não tem carga (peso corporal, tempo, distância). */
export function volumeDaSerie(serie: SerieExecutada): number | null {
  if (!contaNoVolume(serie)) return 0;
  if (serie.cargaG === null || serie.repeticoes === null) return null;
  return serie.cargaG * serie.repeticoes;
}

/** Séries sem carga são ignoradas em vez de virarem zero — zero seria mentira. */
export function volumeTotal(series: SerieExecutada[]): number {
  return series.reduce((soma, s) => soma + (volumeDaSerie(s) ?? 0), 0);
}

export type Alvo = { seriesAlvo: number; repsAlvoMin: number | null };

/**
 * Sugestão de carga para a próxima sessão, deliberadamente conservadora:
 * bateu **todas** as séries no mínimo de repetições, sobe um incremento.
 * Não bateu, mantém. **Nunca reduz** — reduzir é decisão do Henrique.
 */
export function sugerirCarga(
  seriesAnteriores: SerieExecutada[],
  alvo: Alvo,
  incrementoG = INCREMENTO_PADRAO_G
): number | null {
  const validas = seriesAnteriores.filter(contaNoVolume);
  const comCarga = validas.filter((s) => s.cargaG !== null);
  if (comCarga.length === 0) return null;

  const ultimaCarga = comCarga[comCarga.length - 1].cargaG as number;
  if (alvo.repsAlvoMin === null) return ultimaCarga;

  const bateuTudo =
    validas.length >= alvo.seriesAlvo &&
    validas.every((s) => (s.repeticoes ?? 0) >= (alvo.repsAlvoMin as number));

  return bateuTudo ? ultimaCarga + incrementoG : ultimaCarga;
}
