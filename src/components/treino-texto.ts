/**
 * As duas frases que a tela de treino monta — e SÓ elas.
 *
 * Nada de formatação de número aqui: carga, peso e volume saem de
 * `dominio/carga.ts`; data, hora, duração e relógio saem de `dominio/datas.ts`.
 * O que sobra é a composição das frases, que é apresentação pura e não decide
 * dado nenhum.
 */

import { formatarCarga, type Carga } from '@/dominio/carga';
import { formatarDuracao } from '@/dominio/datas';
import type { OrigemCarga } from '@/dominio/execucao';

/**
 * De onde veio o número grande. Existe porque "igual à semana passada" e "da
 * ficha" pedem confiança diferente antes do toque — e `sem_referencia` não tem
 * frase nenhuma, porque nesse caso o botão já diz "Informar carga".
 */
export function textoDaOrigem(origem: OrigemCarga): string | null {
  if (origem === 'ajuste_de_hoje') return 'igual à série anterior';
  if (origem === 'mesmo_indice_sessao_anterior') return 'igual à última vez';
  if (origem === 'plano') return 'da ficha';
  return null;
}

/** O mínimo que descreve uma série, feita ou sugerida, sem inventar zero. */
export type EsforcoExibivel = {
  readonly carga: Carga | null;
  readonly repeticoes: number | null;
  readonly duracaoS: number | null;
};

export function textoDoEsforco(e: EsforcoExibivel): string {
  const partes: string[] = [];
  if (e.carga !== null) partes.push(formatarCarga(e.carga));
  if (e.repeticoes !== null) partes.push(`${e.repeticoes} reps`);
  if (e.duracaoS !== null) partes.push(formatarDuracao(e.duracaoS));
  // Só acontece em exercício sem carga cuja série ainda não tem repetição
  // resolvida: "série" é honesto, "0 kg × 0" seria mentira.
  return partes.length === 0 ? 'série' : partes.join(' × ');
}
