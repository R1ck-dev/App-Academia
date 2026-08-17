/**
 * A ponte entre as consultas SÍNCRONAS de `queries.ts` e o React.
 *
 * O que a tela de execução precisa — `planoDaSessao` — são várias consultas com
 * o domínio no meio, e não existe consulta única do Drizzle que as substitua.
 * Então o padrão é `useConsulta`: a consulta de verdade, a mesma que o `npm test`
 * exercita contra SQLite, relida a cada escrita. A alternativa (reimplementar o
 * plano como um select na tela) colocaria regra de execução dentro de `src/app/`,
 * que é o que este projeto proíbe.
 *
 * Por que não é `useMemo` com a versão do sinal na lista de dependências — que é
 * o que estava aqui e deixou a tela de execução congelada no aparelho — está
 * escrito em `progresso-consulta.ts` e em `db/consulta.ts`.
 */

import { useEffect, useState } from 'react';

import { planoDaSessao, listarTreinos, seriesDaSessao, sessaoEmAndamento } from '@/db/queries';
import type { Sessao, Treino } from '@/db/schema';
import type { PlanoDaSessao } from '@/dominio/execucao';
import type { SerieExecutada } from '@/dominio/volume';

import { useConsulta } from './progresso-consulta';

export function useTreinos(): Treino[] {
  return useConsulta('useTreinos', listarTreinos);
}

/** `uq_sessao_aberta` garante que é uma só — a tela não precisa desempatar nada. */
export function useSessaoEmAndamento(): Sessao | undefined {
  return useConsulta('useSessaoEmAndamento', sessaoEmAndamento);
}

export function usePlanoDaSessao(sessaoId: string): PlanoDaSessao | null {
  return useConsulta(`usePlanoDaSessao:${sessaoId}`, () => planoDaSessao(sessaoId));
}

export function useSeriesDaSessao(sessaoId: string): SerieExecutada[] {
  return useConsulta(`useSeriesDaSessao:${sessaoId}`, () => seriesDaSessao(sessaoId));
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
