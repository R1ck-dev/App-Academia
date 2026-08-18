/**
 * As frases que as telas de treino montam — e SÓ elas.
 *
 * Nada de formatação de número aqui: carga, peso e volume saem de
 * `dominio/carga.ts`; data, hora, duração e relógio saem de `dominio/datas.ts`.
 * O que sobra é a composição das frases, que é apresentação pura e não decide
 * dado nenhum.
 */

import { formatarCarga, type Carga } from '@/dominio/carga';
import { formatarDuracao } from '@/dominio/datas';
import type { OrigemCarga } from '@/dominio/execucao';
import type { MotivoForaDoVolume } from '@/dominio/volume';

/**
 * De onde veio o número grande — a razão de existir do app em três palavras.
 *
 * É a única microcópia da execução que o handoff manda manter: ele precisa
 * saber se aquele número é o que ele levantou semana passada ou o que está
 * escrito na ficha, porque a confiança antes do toque não é a mesma.
 */
export function textoDaOrigem(origem: OrigemCarga): string {
  if (origem === 'ajuste_de_hoje') return 'o que você fez hoje';
  if (origem === 'mesmo_indice_sessao_anterior') return 'igual à semana passada';
  if (origem === 'plano') return 'da ficha';
  return 'primeira vez — informe a carga';
}

/** A letra do cartão: "Treino A" → "A". Sem letra no nome, a inicial serve. */
export function letraDoTreino(nome: string): string {
  const ultima = nome.trim().split(/\s+/).at(-1) ?? '';
  if (ultima.length === 1) return ultima.toUpperCase();
  return (nome.trim()[0] ?? '?').toUpperCase();
}

/** Duas ou três palavras, do lado direito da linha de "fora da soma". */
export function motivoCurto(motivo: MotivoForaDoVolume): string {
  if (motivo === 'aquecimento') return 'aquecimento';
  if (motivo === 'sem_carga') return 'peso corporal';
  if (motivo === 'sem_repeticoes') return 'só duração';
  return 'placa sem calibração';
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

/**
 * O subrótulo do botão Registrar: **o que vai ser gravado**, em uma linha.
 * É o extrato e a confirmação ao mesmo tempo — sem ele, o toque único vira
 * toque às cegas.
 */
export function textoDoQueVaiGravar(e: EsforcoExibivel): string {
  const partes: string[] = [];
  if (e.carga !== null) partes.push(formatarCarga(e.carga));
  if (e.repeticoes !== null) partes.push(`${e.repeticoes}`);
  if (e.duracaoS !== null) partes.push(formatarDuracao(e.duracaoS));
  return partes.length === 0 ? 'uma série' : partes.join(' × ');
}
