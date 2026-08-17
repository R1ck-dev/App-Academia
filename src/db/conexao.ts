/**
 * A conexão do banco, separada de quem a cria.
 *
 * Por que este arquivo existe: `client.ts` importa `expo-sqlite`, que é um
 * módulo **nativo** e não carrega fora do aparelho. Enquanto `queries.ts` e
 * `mutations.ts` importarem dele, nenhuma dessas duas camadas pode ser testada
 * fora de um simulador — e são justamente elas que decidem se o volume da sessão
 * e o recorde estão certos.
 *
 * Aqui não há import nativo nenhum: só o contrato. Quem preenche é `client.ts`
 * no aparelho e `banco-de-teste.ts` no `node --test`, e as consultas exercitadas
 * no teste são **as mesmas** que rodam no celular.
 */

import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import type * as schema from './schema.ts';

/**
 * O driver do Expo é **síncrono** (`prepareSync`/`executeSync`). Isso não é
 * detalhe de tipagem: `db.transaction(async ...)` não faz rollback nenhum,
 * porque o `COMMIT` roda antes de o callback assíncrono chegar na primeira
 * escrita. Manter o tipo como 'sync' é o que faz o TypeScript recusar essa
 * armadilha em vez de deixá-la passar silenciosamente.
 */
export type Banco = ExpoSQLiteDatabase<typeof schema>;

let instancia: Banco | null = null;
let gerarId: (() => string) | null = null;
let relogio: () => number = () => Date.now();

export function conectarBanco(opcoes: {
  banco: Banco;
  novoId: () => string;
  /** Injetável para o teste poder congelar o tempo. */
  agora?: () => number;
}) {
  instancia = opcoes.banco;
  gerarId = opcoes.novoId;
  if (opcoes.agora) relogio = opcoes.agora;
}

function ativo(): Banco {
  if (!instancia) {
    throw new Error(
      'Banco não conectado: importe "@/db/client" (aparelho) ou chame criarBancoDeTeste() (testes) antes de consultar.'
    );
  }
  return instancia;
}

/**
 * Proxy em vez do objeto direto para que os módulos possam fazer `import { db }`
 * no topo, sem que a ordem de carga importe: a resolução acontece na primeira
 * chamada, não no import.
 */
export const db: Banco = new Proxy({} as Banco, {
  get(_, prop) {
    const banco = ativo() as unknown as Record<string | symbol, unknown>;
    const valor = banco[prop];
    // Métodos precisam do `this` do banco real; devolver a função crua faria o
    // Drizzle enxergar o proxy vazio como sessão.
    return typeof valor === 'function' ? valor.bind(banco) : valor;
  },
});

/**
 * IDs são gerados no aparelho, não pelo banco: `AUTOINCREMENT` inviabiliza
 * qualquer merge futuro de dois bancos (dois aparelhos gerariam o mesmo 42).
 */
export const novoId = (): string => {
  if (!gerarId) throw new Error('Gerador de id não configurado — chame conectarBanco().');
  return gerarId();
};

export const agora = (): number => relogio();
