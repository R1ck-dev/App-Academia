/**
 * A leitura memorizada por VERSÃO de escrita — o que `useSyncExternalStore`
 * exige e o React Compiler não tem como estragar.
 *
 * ## Por que existe
 *
 * `useSyncExternalStore` chama `getSnapshot()` a cada render e compara o
 * resultado com o anterior por identidade. Uma consulta ao SQLite devolve objeto
 * novo toda vez, então chamá-la direto ali daria laço infinito. Este módulo
 * resolve isso guardando o resultado por `chave` enquanto a versão de `sinal.ts`
 * não muda: mesmo render, mesmo objeto; escreveu, objeto novo.
 *
 * ## Por que não é `useMemo(..., [versao])`
 *
 * Porque era, e não funcionava no aparelho. O React Compiler (ligado em
 * `app.json`) **recalcula as dependências** a partir do corpo do callback e
 * descarta as que ele não vê serem usadas lá dentro. `useMemo(() =>
 * planoDaSessao(id), [id, versao])` virava, no bundle:
 *
 *     if ($[0] !== id) { t0 = planoDaSessao(id); ... }   // `versao` sumiu
 *
 * Ou seja: a tela de execução lia o plano UMA vez e nunca mais. Registrar série
 * gravava no banco e não aparecia nada (17/08/2026, no aparelho). O padrão
 * "dependência artificial para invalidar cache" é justamente o que o compilador
 * tem permissão de apagar, porque assume que a função é pura — e uma consulta ao
 * banco não é.
 *
 * Aqui o valor sai de um HOOK (`useSyncExternalStore`), e hook o compilador
 * sempre chama. Ver `reatividade.test.ts`, que compila as telas com o compilador
 * de verdade e falha se alguma leitura voltar a cair dentro de um cache dele.
 *
 * ## A regra da chave
 *
 * A chave identifica a consulta **e todos os parâmetros dela** — `plano:<id>`,
 * não `plano`. Duas leituras diferentes com a mesma chave devolvem uma o valor
 * da outra. Por isso o prefixo é sempre o nome do hook que chama.
 */

import { versaoDasEscritas } from './sinal.ts';

const guardados = new Map<string, { versao: number; valor: unknown }>();

/**
 * Devolve o MESMO valor enquanto ninguém escreveu; relê na primeira chamada
 * depois de uma escrita. Só há uma entrada por chave: a versão nova sobrescreve
 * a velha, então o mapa não cresce com o uso.
 */
export function lerComCache<T>(chave: string, consultar: () => T): T {
  const versao = versaoDasEscritas();
  const guardado = guardados.get(chave);
  if (guardado !== undefined && guardado.versao === versao) return guardado.valor as T;
  const valor = consultar();
  guardados.set(chave, { versao, valor });
  return valor;
}

/** Só para teste: esquece tudo que foi lido, sem mexer na versão. */
export function esquecerConsultas(): void {
  guardados.clear();
}
