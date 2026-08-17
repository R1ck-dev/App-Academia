/**
 * Banco de verdade para os testes, em memória.
 *
 * ## Por que não é um mock
 *
 * As perguntas que quebram este app são todas de SQL: o aquecimento saiu da soma
 * de volume? o exercício arquivado sumiu do histórico junto? o `leftJoin` da
 * evolução duplicou série? a migration roda em cima de dado que já existe? Um
 * mock responde o que eu programei nele — ou seja, concorda comigo. Só o SQLite
 * de verdade discorda.
 *
 * ## Por que não precisa de dependência nova
 *
 * `node:sqlite` vem embutido no Node 22+. O Drizzle não tem driver para ele,
 * mas o driver `better-sqlite3` conversa com o cliente por uma superfície
 * pequena — `prepare`, `stmt.run/all/get/raw` e `transaction` — que o adaptador
 * abaixo implementa em 30 linhas. O caminho alternativo seria instalar
 * `better-sqlite3`, um módulo **nativo** que precisa compilar: num projeto cujo
 * objetivo é o app rodando no celular, trocar isso por 30 linhas é barato.
 *
 * A sessão usada é a síncrona, igual à do `expo-sqlite` no aparelho. Isso
 * importa: é o que faz o teste enxergar bugs de transação em vez de escondê-los.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { BetterSQLiteSession } from 'drizzle-orm/better-sqlite3/session';
import { createTableRelationsHelpers, extractTablesRelationalConfig } from 'drizzle-orm/relations';
import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core/db';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core/dialect';

import { conectarBanco, type Banco } from './conexao.ts';
import * as schema from './schema.ts';

const PASTA_MIGRATIONS = join(import.meta.dirname, '..', '..', 'drizzle');

type EntradaJournal = { idx: number; tag: string };

/** Adapta `node:sqlite` à superfície que o driver better-sqlite3 do Drizzle usa. */
function adaptar(bruto: DatabaseSync) {
  return {
    prepare(textoSql: string) {
      const stmt = bruto.prepare(textoSql);
      let cru = false;
      // `raw()` no better-sqlite3 devolve o próprio statement e alterna o modo.
      // Aqui o modo é de um uso só: o Drizzle chama `.raw().all()` para as
      // consultas com projeção e `.all()` puro para as sem, no MESMO statement
      // preparado, e um modo grudento devolveria array onde se espera objeto.
      const api = {
        raw() {
          cru = true;
          return api;
        },
        run: (...p: unknown[]) => stmt.run(...(p as never[])),
        all: (...p: unknown[]) => {
          stmt.setReturnArrays(cru);
          try {
            return stmt.all(...(p as never[]));
          } finally {
            cru = false;
            stmt.setReturnArrays(false);
          }
        },
        get: (...p: unknown[]) => {
          stmt.setReturnArrays(cru);
          try {
            return stmt.get(...(p as never[]));
          } finally {
            cru = false;
            stmt.setReturnArrays(false);
          }
        },
      };
      return api;
    },
    transaction(fn: (...args: unknown[]) => unknown) {
      const correr =
        (comportamento: string) =>
        (...args: unknown[]) => {
          bruto.exec(`begin ${comportamento}`);
          try {
            const r = fn(...args);
            bruto.exec('commit');
            return r;
          } catch (e) {
            bruto.exec('rollback');
            throw e;
          }
        };
      const alvo = correr('deferred') as ReturnType<typeof correr> & Record<string, unknown>;
      for (const c of ['deferred', 'immediate', 'exclusive']) alvo[c] = correr(c);
      return alvo;
    },
  };
}

function montarDrizzle(bruto: DatabaseSync): Banco {
  const dialeto = new SQLiteSyncDialect({});
  const cfg = extractTablesRelationalConfig(schema, createTableRelationsHelpers);
  const info = { fullSchema: schema, schema: cfg.tables, tableNamesMap: cfg.tableNamesMap };
  const sessao = new BetterSQLiteSession(adaptar(bruto) as never, dialeto, info as never, {});
  return new BaseSQLiteDatabase('sync', dialeto, sessao, info as never) as unknown as Banco;
}

/** Lê o journal para aplicar as migrations na ordem real, como no aparelho. */
function migrations(): EntradaJournal[] {
  const journal = JSON.parse(readFileSync(join(PASTA_MIGRATIONS, 'meta', '_journal.json'), 'utf8'));
  return (journal.entries as EntradaJournal[]).sort((a, b) => a.idx - b.idx);
}

/**
 * Aplica as migrations do intervalo `[de, ate]`.
 *
 * O intervalo existe para o teste que importa: parar na versão anterior,
 * escrever dados como a versão instalada escreveria, e só então aplicar a nova.
 */
export function aplicarMigrations(bruto: DatabaseSync, opcoes?: { de?: number; ate?: number }) {
  const de = opcoes?.de ?? 0;
  const ate = opcoes?.ate;

  for (const m of migrations()) {
    if (m.idx < de) continue;
    if (ate !== undefined && m.idx > ate) break;
    const sql = readFileSync(join(PASTA_MIGRATIONS, `${m.tag}.sql`), 'utf8');
    // O mesmo separador que o migrator do Drizzle usa.
    for (const trecho of sql.split('--> statement-breakpoint')) {
      const limpo = trecho.trim();
      if (limpo) bruto.exec(limpo);
    }
  }
}

export type BancoDeTeste = {
  db: Banco;
  bruto: DatabaseSync;
  /** Avança o relógio injetado, para `atualizadoEm` mudar entre escritas. */
  avancarRelogio: (ms: number) => void;
};

/**
 * Cria um banco limpo, migrado, e o conecta como banco ativo do processo.
 *
 * `novoId` e `agora` são determinísticos de propósito: teste que depende de UUID
 * aleatório e de `Date.now()` falha uma vez a cada tantas execuções, e teste que
 * falha às vezes é teste que se aprende a ignorar.
 */
export function criarBancoDeTeste(opcoes?: { ate?: number }): BancoDeTeste {
  const bruto = new DatabaseSync(':memory:');
  bruto.exec('PRAGMA foreign_keys = ON;');
  aplicarMigrations(bruto, { ate: opcoes?.ate });

  const db = montarDrizzle(bruto);

  let contador = 0;
  let instante = Date.UTC(2026, 7, 16, 12, 0, 0);

  conectarBanco({
    banco: db,
    novoId: () => `id-${String(++contador).padStart(4, '0')}`,
    agora: () => instante,
  });

  return {
    db,
    bruto,
    avancarRelogio: (ms) => {
      instante += ms;
    },
  };
}
