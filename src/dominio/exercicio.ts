/**
 * O exercício visto pelo domínio — quem DEFINE a unidade de tudo que vem depois.
 *
 * Existe separado de `carga.ts` para o grafo de módulos ficar uma DAG:
 * schema(tipos) -> carga -> exercicio -> volume -> recordes -> execucao. Referenciar
 * `Exercicio` de dentro de `carga.ts` criaria ciclo com o módulo mais primitivo
 * dependendo do mais derivado, que só sobrevive por ser type-only.
 */

import type { TipoMedicao } from '../db/schema.ts';
import { cargaEmGramas, INCREMENTO_PADRAO, kg, placa, type Carga, type Unidade } from './carga.ts';

export type Exercicio = {
  readonly id: string;
  readonly nome: string;
  readonly grupoMuscular: string | null;
  readonly tipoMedicao: TipoMedicao;
  /** Já na unidade do exercício. null em peso_corporal/tempo/distancia. */
  readonly incremento: Carga | null;
  /** Crença revisável: quanto pesa UMA placa desta máquina. null = não sei. */
  readonly gramasPorPlaca: number | null;
  readonly arquivadoEm: number | null;
};

/** `null` = o exercício não tem carga nenhuma, e não "tem carga de unidade desconhecida". */
export function unidadeDoTipo(t: TipoMedicao): Unidade | null {
  if (t === 'carga_kg') return 'kg';
  if (t === 'carga_placa') return 'placa';
  return null;
}

export function temCarga(t: TipoMedicao): boolean {
  return unidadeDoTipo(t) !== null;
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
  if (t === 'carga_placa') return 'placa';
  if (t === 'peso_corporal') return 'peso do corpo';
  if (t === 'tempo') return 'tempo';
  return 'distância';
}

export function incrementoPadrao(t: TipoMedicao): Carga | null {
  const u = unidadeDoTipo(t);
  if (u === null) return null;
  return u === 'kg' ? kg(INCREMENTO_PADRAO.kg) : placa(INCREMENTO_PADRAO.placa);
}

/**
 * A trava que o SQLite NÃO pode dar: `CHECK` não aceita subquery, então nada no
 * banco liga `series.carga_placas` ao `tipo_medicao` do exercício — e nada nos
 * tipos pode ligar, porque `exercicioId` é uma `string`.
 *
 * Sem isto, `registrarSerie({ exercicioId: peckDeck, carga: kg(40000) })` grava
 * quilo num exercício de placa, o histórico passa a ter duas unidades e os
 * recordes comparam maçã com laranja. `mutations.ts` chama isto antes de gravar
 * e lança se for false: é garantia de APLICAÇÃO, declarada como tal.
 */
export function cargaCompativel(ex: Exercicio, c: Carga | null): boolean {
  const u = unidadeDoTipo(ex.tipoMedicao);
  // Exercício com carga EXIGE carga: "peck deck sem carga" é dado perdido, não
  // peso corporal. E peso corporal/tempo/distância recusam qualquer carga.
  if (u === null) return c === null;
  return c !== null && c.unidade === u;
}

/** `null` quando não dá: carga incompatível, sem carga, ou placa sem calibração. */
export function emGramas(ex: Exercicio, c: Carga | null): number | null {
  if (c === null || !cargaCompativel(ex, c)) return null;
  return cargaEmGramas(c, ex.gramasPorPlaca);
}

/**
 * "Já sei quanto pesa a placa desta máquina?" — pergunta que só existe em
 * `carga_placa`. Um exercício em kg devolve false porque não há o que calibrar,
 * não porque falte informação; para saber se dá para converter, use `emGramas`.
 */
export function calibrado(ex: Exercicio): boolean {
  return (
    ex.tipoMedicao === 'carga_placa' && ex.gramasPorPlaca !== null && ex.gramasPorPlaca > 0
  );
}
