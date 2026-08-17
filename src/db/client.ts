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
 * `enableChangeListener` liga o `sqlite3_update_hook` do lado nativo, que emite
 * `onDatabaseChange`. **A reatividade das telas NÃO depende mais disso** — em
 * 17/08/2026, no APK de release neste aparelho, o evento simplesmente não chegou
 * ao JS: a sessão era gravada e a tela continuava oferecendo iniciar o treino.
 * Quem avisa a UI agora é `sinal.ts`, publicado pelas mutations.
 *
 * A opção fica ligada porque custa nada e é a porta para depuração futura (e
 * para o dia em que o evento voltar a funcionar), mas nenhum código do app deve
 * voltar a DEPENDER dela sem um teste que rode no aparelho — foi essa dependência
 * invisível para o `npm test` que deixou o app inutilizável com a suíte verde.
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
