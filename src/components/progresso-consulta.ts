/**
 * O ÚNICO jeito de uma tela ler o banco.
 *
 * As telas leem por `queries.ts`, e não por consulta do Drizzle montada no
 * componente: é em `queries.ts` que mora o filtro de `arquivado_em`, o join que
 * não pode encolher volume de ontem e o mapeamento `carga_g`/`carga_placas` para
 * `Carga`. Repetir qualquer um desses na tela é o jeito silencioso de a tela
 * discordar do resto do app.
 *
 * ## As duas versões que não funcionaram no aparelho
 *
 * 1. `useLiveQuery` do Drizzle, que escuta o `addDatabaseChangeListener` do
 *    expo-sqlite: no APK de release o evento nativo não chega ao JS. A sessão era
 *    gravada e a tela continuava oferecendo iniciar o treino.
 * 2. `useMemo(() => consulta(), [versaoDoSinal])`: o React Compiler recalcula as
 *    dependências pelo corpo do callback e apaga a que não é usada lá dentro. A
 *    tela de execução passou a ler o plano uma vez e nunca mais — registrar série
 *    gravava e não aparecia.
 *
 * As duas tinham 350 testes verdes por cima. Por isso o mecanismo agora é
 * `useSyncExternalStore` (hook: o compilador é obrigado a chamar) sobre o cache
 * por versão de `db/consulta.ts` (testável no `node --test`), e existe
 * `reatividade.test.ts` compilando as telas com o compilador de verdade.
 */

import { useSyncExternalStore } from 'react';

import { lerComCache } from '@/db/consulta';
import { assinarEscritas } from '@/db/sinal';

/**
 * Lê `consultar()` e relê a cada escrita no banco.
 *
 * `chave` identifica a consulta **e os parâmetros dela** (`'usePlano:' + id`,
 * nunca só `'usePlano'`): é ela que separa uma leitura da outra no cache. O
 * prefixo é o nome do hook que chama, para colisão ser impossível de acontecer
 * por acidente.
 *
 * Sem granularidade por tabela de propósito: as consultas são SQLite local
 * síncrono, e relê-las custa microssegundos — menos que o risco de errar qual
 * tabela invalidar.
 */
export function useConsulta<T>(chave: string, consultar: () => T): T {
  // O cache é o que torna este `getSnapshot` legal: `useSyncExternalStore`
  // compara o resultado por identidade, e uma consulta crua devolveria objeto
  // novo a cada chamada — laço infinito.
  const ler = () => lerComCache(chave, consultar);
  return useSyncExternalStore(assinarEscritas, ler, ler);
}
