/**
 * A conexão real, do aparelho. Este é o único arquivo do `src/db` que importa
 * módulo nativo — o resto fala com `conexao.ts` e por isso roda também no
 * `node --test`.
 *
 * Importar este módulo tem efeito colateral de propósito: ele conecta o banco.
 * Quem garante a ordem é `components/provedor-banco.tsx`, que o importa e segura
 * a UI até as migrations terminarem.
 */

import * as Crypto from 'expo-crypto';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import { conectarBanco } from './conexao.ts';
import * as schema from './schema.ts';

export const NOME_BANCO = 'academia.db';

/**
 * `enableChangeListener` é o que faz `useLiveQuery` reagir a escritas. Sem ele a
 * lista de séries não atualiza sozinha, e alguém "resolve" com refresh manual —
 * remendo que esconde a causa.
 */
const sqlite = openDatabaseSync(NOME_BANCO, { enableChangeListener: true });

// Rodam a cada abertura. `journal_mode` fica gravado no arquivo, mas
// `foreign_keys` e `synchronous` são por conexão e precisam ser reaplicados —
// e sem `foreign_keys = ON` as FKs do schema são só documentação, já que o
// SQLite as ignora por padrão.
sqlite.execSync(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA synchronous = NORMAL;
`);

// Não exportado: quem quiser o banco pede `db` a `conexao.ts`. Exportar a
// instância daqui seria a porta dos fundos que faz uma tela importar o Drizzle
// do aparelho direto e deixar de rodar no `node --test`.
const bancoDoAparelho = drizzle(sqlite, { schema });

conectarBanco({ banco: bancoDoAparelho, novoId: () => Crypto.randomUUID() });

export { agora, db, novoId } from './conexao.ts';
