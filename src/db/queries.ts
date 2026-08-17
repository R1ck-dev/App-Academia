/**
 * Leituras. Toda consulta filtra `arquivado_em IS NULL` — esquecer isso é o jeito
 * mais fácil de fazer um exercício apagado voltar a aparecer no histórico.
 */

import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { db } from './conexao.ts';
import { exercicios, medidas, pesagens, series, sessoes, treinos } from './schema.ts';

export function listarExercicios() {
  return db
    .select()
    .from(exercicios)
    .where(isNull(exercicios.arquivadoEm))
    .orderBy(asc(exercicios.nome))
    .all();
}

export function listarTreinos() {
  return db
    .select()
    .from(treinos)
    .where(isNull(treinos.arquivadoEm))
    .orderBy(asc(treinos.ordem), asc(treinos.nome))
    .all();
}

/** A sessão aberta, se houver. Duas abertas ao mesmo tempo é bug, não fluxo. */
export function sessaoEmAndamento() {
  return db
    .select()
    .from(sessoes)
    .where(and(isNull(sessoes.finalizadaEm), isNull(sessoes.arquivadoEm)))
    .orderBy(desc(sessoes.iniciadaEm))
    .get();
}

export function seriesDaSessao(sessaoId: string) {
  return db
    .select()
    .from(series)
    .where(and(eq(series.sessaoId, sessaoId), isNull(series.arquivadoEm)))
    .orderBy(asc(series.indice))
    .all();
}

/** O histórico que responde "estou evoluindo?" — usa o índice por exercício. */
export function seriesDoExercicio(exercicioId: string) {
  return db
    .select()
    .from(series)
    .where(and(eq(series.exercicioId, exercicioId), isNull(series.arquivadoEm)))
    .orderBy(asc(series.concluidaEm))
    .all();
}

export function historicoPeso() {
  return db
    .select()
    .from(pesagens)
    .where(isNull(pesagens.arquivadoEm))
    .orderBy(asc(pesagens.medidoEm))
    .all();
}

export function historicoMedidas() {
  return db
    .select()
    .from(medidas)
    .where(isNull(medidas.arquivadoEm))
    .orderBy(asc(medidas.medidoEm))
    .all();
}
