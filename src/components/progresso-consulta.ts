/**
 * Reatividade da leitura para as telas de Corpo e Histórico.
 *
 * As telas leem por `queries.ts`, e não por consulta do Drizzle montada no
 * componente: é em `queries.ts` que mora o filtro de `arquivado_em`, o join que
 * não pode encolher volume de ontem e o mapeamento `carga_g`/`carga_placas` para
 * `Carga`. Repetir qualquer um desses na tela é o jeito silencioso de a tela
 * discordar do resto do app.
 *
 * `useLiveQuery` continua sendo quem escuta a escrita (é ele que assina o
 * `addDatabaseChangeListener` do `enableChangeListener`), só que sobre uma
 * CONTAGEM barata usada como sinal: ele reage à tabela do `from`, e a consulta
 * de verdade acontece depois, num `useMemo` que depende desse sinal.
 */

import { count } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { db } from '@/db/client';

/**
 * Muda a cada escrita em qualquer das tabelas observadas. Use como dependência
 * de `useMemo` em volta das funções de `queries.ts`.
 *
 * Observa NO MÁXIMO TRÊS tabelas, e o limite é proposital nas duas pontas: a
 * quantidade de hooks tem que ser fixa entre renders (regra do React), e uma
 * tela que depende de mais de três tabelas está lendo demais para uma tela só.
 */
export function useSinalDeEscrita(tabelas: readonly SQLiteTable[]): number {
  const primeira = tabelas[0];
  // Repetir a primeira tabela quando faltam entradas é de graça: duas escutas
  // sobre a mesma tabela custam duas contagens e mantêm a ordem dos hooks estável.
  const a = useMarcaDeEscrita(primeira);
  const b = useMarcaDeEscrita(tabelas[1] ?? primeira);
  const c = useMarcaDeEscrita(tabelas[2] ?? primeira);
  return a + b + c;
}

function useMarcaDeEscrita(tabela: SQLiteTable): number {
  // `count()` devolve UMA linha por consulta, independentemente do tamanho da
  // tabela: o valor não é usado, só o instante em que ele chegou.
  const { updatedAt } = useLiveQuery(db.select({ linhas: count() }).from(tabela));
  return updatedAt?.getTime() ?? 0;
}
