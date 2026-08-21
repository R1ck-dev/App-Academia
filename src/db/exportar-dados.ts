/**
 * O conteúdo do backup — sem nenhum módulo nativo, para o FORMATO ter teste.
 *
 * Quem fala com o sistema de arquivos e com o share sheet é `exportar.ts`. A
 * separação não é cerimônia: é o que permite `node --test` verificar que uma
 * volta completa (exportar → restaurar) devolve exatamente o mesmo banco,
 * inclusive as linhas arquivadas, sem simulador e sem aparelho.
 *
 * ## Por que JSON e não uma cópia do arquivo .db
 *
 * Copiar `academia.db` seria mais simples e é o que muita gente faz. Duas razões
 * contra: o arquivo em WAL só está íntegro depois de um checkpoint, e um `.db`
 * restaurado por cima traz consigo o `__drizzle_migrations` daquele momento —
 * restaurar um backup velho num app novo faria o Drizzle acreditar que
 * migrations já aplicadas não rodaram. O JSON é lido pelas migrations atuais e
 * atravessa versão de schema.
 *
 * ## O que ele NÃO é
 *
 * Não é sync, não é histórico versionado, não é incremental. É uma foto do banco
 * inteiro, para o dia em que o celular sumir — que é o único cenário em que o
 * histórico de um ano deste app deixa de existir.
 */

import { sql } from 'drizzle-orm';

import { db } from './conexao.ts';
import {
  exercicios,
  medidas,
  perfil,
  pesagens,
  preferencias,
  series,
  sessoes,
  treinoExercicios,
  treinos,
} from './schema.ts';

/**
 * Sobe quando o formato mudar de um jeito que a versão anterior não leia.
 *
 * A 2 removeu a unidade "placa": sumiram as colunas `carga_placas`,
 * `carga_alvo_placas`, `incremento_placas` e `gramas_por_placa`. Backup v1 é
 * RECUSADO, e não convertido — converter exigiria saber quanto pesa cada placa,
 * e nenhum exercício jamais foi calibrado. Fingir uma conversão inventaria um
 * histórico de cargas que nunca existiu, que é pior do que dizer não.
 */
export const VERSAO_DO_BACKUP = 2;

/** Abaixo disto o arquivo é de um schema que este app não sabe mais ler. */
const VERSAO_MINIMA_LEGIVEL = 2;

/**
 * A ORDEM importa e é a de dependência: `exercicios` antes de
 * `treino_exercicios`, `sessoes` antes de `series`. Restaurar insere nesta
 * ordem e apaga na inversa — com `PRAGMA foreign_keys = ON`, qualquer outra
 * sequência é violação de chave estrangeira.
 */
const TABELAS = [
  ['exercicios', exercicios],
  ['treinos', treinos],
  ['treino_exercicios', treinoExercicios],
  ['sessoes', sessoes],
  ['series', series],
  ['perfil', perfil],
  ['pesagens', pesagens],
  ['medidas', medidas],
  ['preferencias', preferencias],
] as const;

export type Backup = {
  versao: number;
  geradoEm: number;
  tabelas: Record<string, Record<string, unknown>[]>;
};

/**
 * Lê o banco INTEIRO, inclusive o que está arquivado.
 *
 * Filtrar `arquivado_em` aqui seria o erro clássico: o soft delete existe para o
 * histórico sobreviver, e um backup que descarta o arquivado apaga de vez, na
 * restauração, o que o app só tinha escondido.
 */
export function montarBackup(geradoEm: number): Backup {
  const tabelas: Record<string, Record<string, unknown>[]> = {};
  for (const [nome, tabela] of TABELAS) {
    tabelas[nome] = db.select().from(tabela).all() as Record<string, unknown>[];
  }
  return { versao: VERSAO_DO_BACKUP, geradoEm, tabelas };
}

/** Duas casas de indentação: o arquivo é lido por humano quando dá problema. */
export function serializar(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

export type Leitura = { ok: true; backup: Backup } | { ok: false; erro: string };

/**
 * Interpreta o arquivo escolhido. Recusa antes de tocar no banco: restaurar é a
 * operação mais destrutiva do app, e falhar no meio dela deixaria o aparelho
 * sem o backup e sem os dados.
 */
export function interpretar(texto: string): Leitura {
  let cru: unknown;
  try {
    cru = JSON.parse(texto);
  } catch {
    return { ok: false, erro: 'Este arquivo não é um backup do app (não é JSON válido).' };
  }

  if (typeof cru !== 'object' || cru === null) {
    return { ok: false, erro: 'Este arquivo não é um backup do app.' };
  }
  const objeto = cru as Record<string, unknown>;

  if (typeof objeto.versao !== 'number') {
    return { ok: false, erro: 'Este arquivo não é um backup do app (falta a versão).' };
  }
  if (objeto.versao > VERSAO_DO_BACKUP) {
    return {
      ok: false,
      erro: `Backup da versão ${objeto.versao}; este app lê até a ${VERSAO_DO_BACKUP}. Atualize o app antes de restaurar.`,
    };
  }
  if (objeto.versao < VERSAO_MINIMA_LEGIVEL) {
    return {
      ok: false,
      erro: `Backup da versão ${objeto.versao}, de quando existia carga em placa. Este app só usa quilo e não tem como converter — a conversão dependeria de saber o peso de cada placa.`,
    };
  }

  const tabelas = objeto.tabelas;
  if (typeof tabelas !== 'object' || tabelas === null) {
    return { ok: false, erro: 'Backup sem tabelas.' };
  }
  const mapa = tabelas as Record<string, unknown>;

  for (const [nome] of TABELAS) {
    const linhas = mapa[nome];
    if (linhas !== undefined && !Array.isArray(linhas)) {
      return { ok: false, erro: `A tabela "${nome}" do backup está corrompida.` };
    }
  }

  return {
    ok: true,
    backup: {
      versao: objeto.versao,
      geradoEm: typeof objeto.geradoEm === 'number' ? objeto.geradoEm : 0,
      tabelas: mapa as Record<string, Record<string, unknown>[]>,
    },
  };
}

/** O que o diálogo de confirmação precisa dizer antes de substituir tudo. */
export function contarLinhas(): { sessoes: number; pesagens: number; series: number } {
  const contar = (tabela: (typeof TABELAS)[number][1]) =>
    db.select({ total: sql<number>`count(*)` }).from(tabela).get()?.total ?? 0;
  // Conta TUDO, arquivado incluído: o que o aparelho perde na restauração é o
  // banco inteiro, não a parte visível dele.
  return { sessoes: contar(sessoes), pesagens: contar(pesagens), series: contar(series) };
}

/**
 * Substitui o banco pelo backup, numa transação só.
 *
 * Uma transação e não nove: apagar as nove tabelas e falhar na quinta inserção
 * deixaria o aparelho com metade do histórico e nenhuma forma de voltar. O
 * callback é SÍNCRONO de propósito — o driver do Expo commita sem `await`, e um
 * callback `async` faria o COMMIT acontecer antes das escritas (ver
 * `dados-locais`).
 */
export function restaurarBackup(backup: Backup): void {
  db.transaction((tx) => {
    for (const [, tabela] of [...TABELAS].reverse()) {
      tx.delete(tabela).run();
    }
    for (const [nome, tabela] of TABELAS) {
      const linhas = backup.tabelas[nome] ?? [];
      // Uma linha por vez: o `insert().values([...])` do Drizzle monta um único
      // comando com um parâmetro por coluna de cada linha, e um ano de séries
      // estoura o limite de variáveis do SQLite.
      for (const linha of linhas) {
        tx.insert(tabela).values(linha as never).run();
      }
    }
  });
}
