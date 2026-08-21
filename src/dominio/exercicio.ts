/**
 * O exercício visto pelo domínio — quem DEFINE se há carga no que vem depois.
 *
 * Existe separado de `carga.ts` para o grafo de módulos ficar uma DAG:
 * schema(tipos) -> carga -> exercicio -> volume -> recordes -> execucao. Referenciar
 * `Exercicio` de dentro de `carga.ts` criaria ciclo com o módulo mais primitivo
 * dependendo do mais derivado, que só sobrevive por ser type-only.
 */

import type { TipoMedicao } from '../db/schema.ts';
import { INCREMENTO_PADRAO, kg, type Carga } from './carga.ts';

export type Exercicio = {
  readonly id: string;
  readonly nome: string;
  readonly grupoMuscular: string | null;
  readonly tipoMedicao: TipoMedicao;
  /** null em peso_corporal/tempo/distancia — não há degrau onde não há carga. */
  readonly incremento: Carga | null;
  readonly arquivadoEm: number | null;
};

export function temCarga(t: TipoMedicao): boolean {
  return t === 'carga_kg';
}

/**
 * Esteira e prancha: o "quanto" é duração, nunca repetição — e as duas colunas
 * são mutuamente exclusivas. Mora aqui porque três lugares precisavam da mesma
 * pergunta (prefill, cartão da execução e o gráfico de progressão), e três
 * cópias de `t === 'tempo' || t === 'distancia'` divergem no dia em que um
 * quarto tipo nascer.
 *
 * `distancia` anda junto de `tempo` porque `series` ainda não tem coluna de
 * distância — sem isso a sugestão sairia com os três campos nulos.
 */
export function medidoPorTempo(t: TipoMedicao): boolean {
  return t === 'tempo' || t === 'distancia';
}

/** O tipo em uma palavra, para lista de catálogo e legenda de gráfico. */
export function rotuloDoTipoMedicao(t: TipoMedicao): string {
  if (t === 'carga_kg') return 'kg';
  if (t === 'peso_corporal') return 'peso do corpo';
  if (t === 'tempo') return 'tempo';
  return 'distância';
}

export function incrementoPadrao(t: TipoMedicao): Carga | null {
  return temCarga(t) ? kg(INCREMENTO_PADRAO) : null;
}

/**
 * A trava que o SQLite NÃO pode dar: `CHECK` não aceita subquery, então nada no
 * banco liga `series.carga_g` ao `tipo_medicao` do exercício — e nada nos tipos
 * pode ligar, porque `exercicioId` é uma `string`.
 *
 * Sem isto, `registrarSerie({ exercicioId: abdominal, carga: kg(40000) })` grava
 * quilo num exercício de peso corporal, e o volume passa a somar o que não foi
 * levantado. `mutations.ts` chama isto antes de gravar e lança se for false: é
 * garantia de APLICAÇÃO, declarada como tal.
 */
export function cargaCompativel(ex: Exercicio, c: Carga | null): boolean {
  // Exercício com carga EXIGE carga: "peck deck sem carga" é dado perdido, não
  // peso corporal. E peso corporal/tempo/distância recusam qualquer carga.
  return temCarga(ex.tipoMedicao) ? c !== null : c === null;
}

/** `null` quando não dá: carga incompatível com o exercício, ou sem carga. */
export function emGramas(ex: Exercicio, c: Carga | null): number | null {
  if (c === null || !cargaCompativel(ex, c)) return null;
  return c.gramas;
}
