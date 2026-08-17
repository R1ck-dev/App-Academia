/**
 * O aviso de "o banco mudou", publicado por quem escreve.
 *
 * ## Por que não é o listener do expo-sqlite
 *
 * A versão anterior dependia de `addDatabaseChangeListener` (via `useLiveQuery`
 * do Drizzle) para saber quando reler. No APK de release, no aparelho, o evento
 * **não chega** — e o sintoma foi tão ruim quanto silencioso: iniciar um treino
 * gravava a sessão e a tela continuava na lista, oferecendo iniciar de novo.
 *
 * Duas propriedades tornam este módulo melhor que o evento nativo, mesmo que um
 * dia o evento volte a funcionar:
 *
 * 1. **É completo por construção.** Toda escrita passa por `mutations.ts`
 *    (regra de `dados-locais`), então avisar de lá não tem como perder um caso.
 * 2. **É testável no `node --test`.** O listener nativo é invisível para a suíte
 *    — foi por isso que 337 testes verdes conviveram com um app inutilizável no
 *    celular. `sinal.test.ts` e o teste de cobertura em `mutations.test.ts`
 *    fecham esse buraco.
 *
 * Não há granularidade por tabela de propósito: as consultas são SQLite local
 * síncrono, medidas em microssegundos, e "reler tudo a cada escrita" é barato
 * perto do custo de errar qual tabela invalidar.
 */

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();
let versao = 0;

/**
 * Chamado por toda mutation, depois de a escrita ter acontecido de fato.
 * Dentro de transação, chame **depois** do commit: avisar no meio faria a tela
 * reler um estado que ainda pode sofrer rollback.
 */
export function anunciarEscrita(): void {
  versao++;
  // Cópia antes de percorrer: um ouvinte que se desinscreve durante o aviso
  // (React desmontando a tela) mutaria o Set em iteração.
  for (const ouvinte of [...ouvintes]) ouvinte();
}

/** Assinatura no formato que `useSyncExternalStore` espera: devolve o cancelador. */
export function assinarEscritas(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * O snapshot. É um número que só cresce — nunca um objeto novo, porque
 * `useSyncExternalStore` compara por identidade e entraria em laço infinito.
 */
export function versaoDasEscritas(): number {
  return versao;
}

/** Só para teste: devolve o módulo ao estado inicial entre casos. */
export function reiniciarSinal(): void {
  ouvintes.clear();
  versao = 0;
}
