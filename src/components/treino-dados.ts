/**
 * A ponte entre as consultas SÍNCRONAS de `queries.ts` e o React.
 *
 * `useLiveQuery` do Drizzle sabe reexecutar UMA consulta e observa apenas a
 * tabela do `from` (está no fonte: `expo-sqlite/query.js` compara
 * `config.name === tableName`). O que a tela de execução precisa —
 * `planoDaSessao` — são várias consultas com o domínio no meio, e não existe
 * consulta única que as substitua.
 *
 * Por isso a consulta viva aqui é um `count(*)` descartável: ela não traz dado
 * nenhum, serve de GATILHO. Quem devolve o dado é a query de verdade, relida
 * dentro de um `useMemo` — a mesma que o `npm test` exercita contra SQLite. A
 * alternativa (reimplementar o plano como um select do Drizzle na tela) colocaria
 * regra de execução dentro de `src/app/`, que é o que este projeto proíbe.
 */

import { count } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { useEffect, useMemo, useState } from 'react';

import { db } from '@/db/client';
import { planoDaSessao, listarTreinos, seriesDaSessao, sessaoEmAndamento } from '@/db/queries';
import { series, sessoes, treinos, type Sessao, type Treino } from '@/db/schema';
import type { PlanoDaSessao } from '@/dominio/execucao';
import type { SerieExecutada } from '@/dominio/volume';

/**
 * Um número que muda a cada escrita na tabela. O valor em si não significa nada
 * — é só a dependência do `useMemo` que relê o banco.
 */
function useMudancasNa(tabela: SQLiteTable): number {
  const { updatedAt } = useLiveQuery(db.select({ linhas: count() }).from(tabela));
  return updatedAt?.getTime() ?? 0;
}

export function useTreinos(): Treino[] {
  const mudou = useMudancasNa(treinos);
  return useMemo(() => listarTreinos(), [mudou]);
}

/** `uq_sessao_aberta` garante que é uma só — a tela não precisa desempatar nada. */
export function useSessaoEmAndamento(): Sessao | undefined {
  const mudou = useMudancasNa(sessoes);
  return useMemo(() => sessaoEmAndamento(), [mudou]);
}

/**
 * Observa as DUAS tabelas que mexem no plano: `series` (registrar, desfazer,
 * corrigir) e `sessoes` (finalizar). Sem a segunda, finalizar deixaria a tela
 * mostrando uma sessão que já acabou.
 */
export function usePlanoDaSessao(sessaoId: string): PlanoDaSessao | null {
  const mudaramSeries = useMudancasNa(series);
  const mudaramSessoes = useMudancasNa(sessoes);
  return useMemo(
    () => planoDaSessao(sessaoId),
    [sessaoId, mudaramSeries, mudaramSessoes]
  );
}

export function useSeriesDaSessao(sessaoId: string): SerieExecutada[] {
  const mudaramSeries = useMudancasNa(series);
  return useMemo(() => seriesDaSessao(sessaoId), [sessaoId, mudaramSeries]);
}

/**
 * Relógio de parede, para o descanso ser REDESENHADO a cada segundo.
 *
 * O tempo restante continua sendo derivado do instante de término
 * (`fimDoDescanso`), nunca de ticks somados: o JS é suspenso em background e um
 * contador que soma ticks atrasa exatamente o tempo em que a tela ficou apagada.
 * Este hook só diz "redesenhe"; a conta é sempre `fim - agora`.
 */
export function useAgora(intervaloMs = 1000): number {
  const [instante, setInstante] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setInstante(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return instante;
}
