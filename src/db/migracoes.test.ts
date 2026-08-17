/**
 * As migrations, contra o SQLite de verdade — e o molde do teste que a PRÓXIMA
 * migration é obrigada a preencher.
 *
 * A skill `dados-locais` cita este arquivo como se ele existisse desde sempre; a
 * hora de escrevê-lo é agora, com a 0000 recém-gerada e nenhum aparelho instalado.
 * Depois do primeiro `apk:instalar` o banco do celular é o único exemplar dos
 * dados, e "a migration roda num banco vazio" deixa de ser uma resposta: o que
 * importa é ela rodar em cima do que a versão instalada gravou.
 *
 * Por isso o caso central aqui não testa a 0000 sozinha — ele executa o padrão
 * inteiro: aplicar até N−1, gravar como a versão instalada gravaria, aplicar N,
 * conferir que nada sumiu nem virou NULL. Hoje N é a migration que ainda não
 * existe, então o passo 3 não faz nada; no dia em que ela nascer, o mesmo teste
 * passa a aplicá-la sem uma linha de edição.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import { aplicarMigrations, criarBancoDeTeste } from './banco-de-teste.ts';

const PASTA_MIGRATIONS = join(import.meta.dirname, '..', '..', 'drizzle');

/** Os índices das migrations, na ordem em que o aparelho as aplica. */
function indicesDoJournal(): number[] {
  const journal = JSON.parse(
    readFileSync(join(PASTA_MIGRATIONS, 'meta', '_journal.json'), 'utf8')
  ) as { entries: { idx: number }[] };
  return journal.entries.map((e) => e.idx).sort((a, b) => a - b);
}

const INDICES = indicesDoJournal();
const ULTIMA = INDICES[INDICES.length - 1];
/** A migration que ainda não existe: é ela que o padrão abaixo está esperando. */
const PROXIMA = ULTIMA + 1;

const TABELAS = [
  'exercicios',
  'treinos',
  'treino_exercicios',
  'sessoes',
  'series',
  'perfil',
  'pesagens',
  'medidas',
  'preferencias',
];

function bancoCru(opcoes?: { ate?: number }): DatabaseSync {
  const bruto = new DatabaseSync(':memory:');
  bruto.exec('PRAGMA foreign_keys = ON;');
  aplicarMigrations(bruto, { ate: opcoes?.ate });
  return bruto;
}

function tabelasDe(bruto: DatabaseSync): string[] {
  return bruto
    .prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%'")
    .all()
    .map((l) => (l as { name: string }).name);
}

describe('0000: o banco que o primeiro boot cria', () => {
  it('cria as nove tabelas', () => {
    const tabelas = tabelasDe(bancoCru({ ate: 0 }));
    for (const esperada of TABELAS) {
      assert.ok(tabelas.includes(esperada), `faltou a tabela ${esperada}`);
    }
  });

  it('`criarBancoDeTeste({ ate: N })` aplica o mesmo que o migrator do aparelho', () => {
    // O intervalo é a peça que torna o padrão de migration testável; se ele
    // parasse de funcionar, o teste da próxima migration nasceria morto.
    const parcial = criarBancoDeTeste({ ate: ULTIMA });
    assert.deepEqual(tabelasDe(parcial.bruto).sort(), tabelasDe(bancoCru()).sort());
  });

  it('cria o índice único PARCIAL da sessão aberta, e não um índice comum', () => {
    const bruto = bancoCru();
    const indice = bruto
      .prepare("select sql from sqlite_master where type='index' and name='uq_sessao_aberta'")
      .get() as { sql: string } | undefined;
    assert.ok(indice, 'faltou uq_sessao_aberta');
    // Sem o WHERE, a segunda sessão da vida seria recusada para sempre.
    assert.match(indice.sql, /where/i);
    assert.match(indice.sql, /finalizada_em/);
  });
});

describe('0000: os CHECK barram a linha incoerente', () => {
  /** Insere o mínimo para as FKs existirem, e devolve os ids. */
  function base(bruto: DatabaseSync) {
    bruto.exec(`insert into exercicios (id, nome, tipo_medicao, incremento_placas, criado_em, atualizado_em)
      values ('ex-placa', 'Peck Dorsal', 'carga_placa', 1, 1, 1)`);
    bruto.exec(`insert into sessoes (id, nome, iniciada_em, criado_em, atualizado_em)
      values ('ss-1', 'Treino A', 100, 1, 1)`);
    return { exercicio: 'ex-placa', sessao: 'ss-1' };
  }

  function serie(campos: string, valores: string): string {
    return `insert into series (id, sessao_id, exercicio_id, indice, tipo, concluida_em, criado_em, atualizado_em${campos})
      values ('se-x', 'ss-1', 'ex-placa', 0, 'valida', 100, 1, 1${valores})`;
  }

  it('série não pode ter as duas cargas — a mistura de unidade não chega a existir', () => {
    const bruto = bancoCru();
    base(bruto);
    assert.throws(() => bruto.exec(serie(', carga_g, carga_placas', ', 40000, 5')), /ck_series_uma_unidade/);
  });

  it('série não pode ter carga zero nem negativa', () => {
    const bruto = bancoCru();
    base(bruto);
    assert.throws(() => bruto.exec(serie(', carga_g', ', 0')), /ck_series_carga_positiva/);
    assert.throws(() => bruto.exec(serie(', carga_placas', ', -1')), /ck_series_carga_positiva/);
  });

  it('série não pode ter rir fora de 0..5, repetição zero, duração zero nem índice negativo', () => {
    const bruto = bancoCru();
    base(bruto);
    assert.throws(() => bruto.exec(serie(', rir', ', 47')), /ck_series_rir/);
    assert.throws(() => bruto.exec(serie(', repeticoes', ', 0')), /ck_series_reps/);
    assert.throws(() => bruto.exec(serie(', duracao_s', ', 0')), /ck_series_duracao/);
    assert.throws(
      () =>
        bruto.exec(`insert into series (id, sessao_id, exercicio_id, indice, tipo, concluida_em, criado_em, atualizado_em)
          values ('se-y', 'ss-1', 'ex-placa', -1, 'valida', 100, 1, 1)`),
      /ck_series_indice/
    );
  });

  it('exercício de tempo não carrega incremento, e exercício de placa não carrega incremento em gramas', () => {
    const bruto = bancoCru();
    assert.throws(
      () =>
        bruto.exec(`insert into exercicios (id, nome, tipo_medicao, incremento_g, criado_em, atualizado_em)
          values ('ex-1', 'Esteira', 'tempo', 2500, 1, 1)`),
      /ck_exercicios_incremento/
    );
    assert.throws(
      () =>
        bruto.exec(`insert into exercicios (id, nome, tipo_medicao, incremento_g, criado_em, atualizado_em)
          values ('ex-2', 'Remada Alta', 'carga_placa', 2500, 1, 1)`),
      /ck_exercicios_incremento/
    );
  });

  it('só exercício de placa tem gramas por placa', () => {
    const bruto = bancoCru();
    assert.throws(
      () =>
        bruto.exec(`insert into exercicios (id, nome, tipo_medicao, incremento_g, gramas_por_placa, criado_em, atualizado_em)
          values ('ex-3', 'Supino', 'carga_kg', 2500, 5000, 1, 1)`),
      /ck_exercicios_placa/
    );
  });

  it('sessão não pode terminar antes de começar', () => {
    const bruto = bancoCru();
    assert.throws(
      () =>
        bruto.exec(`insert into sessoes (id, nome, iniciada_em, finalizada_em, criado_em, atualizado_em)
          values ('ss-2', 'Treino A', 200, 100, 1, 1)`),
      /ck_sessoes_intervalo/
    );
  });

  it('só existe uma sessão aberta, e finalizar a primeira libera a próxima', () => {
    const bruto = bancoCru();
    bruto.exec(
      `insert into sessoes (id, nome, iniciada_em, criado_em, atualizado_em) values ('ss-1', 'A', 100, 1, 1)`
    );
    assert.throws(
      () =>
        bruto.exec(
          `insert into sessoes (id, nome, iniciada_em, criado_em, atualizado_em) values ('ss-2', 'B', 100, 1, 1)`
        ),
      /uq_sessao_aberta/
    );
    bruto.exec(`update sessoes set finalizada_em = 200 where id = 'ss-1'`);
    bruto.exec(
      `insert into sessoes (id, nome, iniciada_em, criado_em, atualizado_em) values ('ss-2', 'B', 100, 1, 1)`
    );
    assert.equal(
      (bruto.prepare('select count(*) as n from sessoes').get() as { n: number }).n,
      2
    );
  });

  it('perfil é linha única e recusa altura que na verdade é centímetro', () => {
    const bruto = bancoCru();
    assert.throws(
      () =>
        bruto.exec(
          `insert into perfil (id, criado_em, atualizado_em) values ('outro', 1, 1)`
        ),
      /ck_perfil_linha_unica/
    );
    // 178 é o que sai de digitar centímetro no campo de milímetro: sem o piso de
    // 1000 mm, o IMC apareceria como 561.
    assert.throws(
      () =>
        bruto.exec(
          `insert into perfil (id, altura_mm, criado_em, atualizado_em) values ('unico', 178, 1, 1)`
        ),
      /ck_perfil_valores/
    );
  });

  it('pesagem e medida recusam zero, e item de ficha recusa alvo de zero série', () => {
    const bruto = bancoCru();
    assert.throws(
      () =>
        bruto.exec(
          `insert into pesagens (id, peso_g, medido_em, criado_em, atualizado_em) values ('pe-1', 0, 1, 1, 1)`
        ),
      /ck_pesagens_peso/
    );
    assert.throws(
      () =>
        bruto.exec(
          `insert into medidas (id, parte, valor_mm, medido_em, criado_em, atualizado_em) values ('me-1', 'peito', 0, 1, 1, 1)`
        ),
      /ck_medidas_valor/
    );

    bruto.exec(`insert into treinos (id, nome, criado_em, atualizado_em) values ('tr-1', 'A', 1, 1)`);
    bruto.exec(`insert into exercicios (id, nome, tipo_medicao, incremento_placas, criado_em, atualizado_em)
      values ('ex-placa', 'Peck Dorsal', 'carga_placa', 1, 1, 1)`);
    assert.throws(
      () =>
        bruto.exec(`insert into treino_exercicios (id, treino_id, exercicio_id, series_alvo, criado_em, atualizado_em)
          values ('te-1', 'tr-1', 'ex-placa', 0, 1, 1)`),
      /ck_te_series_alvo/
    );
    assert.throws(
      () =>
        bruto.exec(`insert into treino_exercicios (id, treino_id, exercicio_id, series_alvo, carga_alvo_g, carga_alvo_placas, criado_em, atualizado_em)
          values ('te-2', 'tr-1', 'ex-placa', 4, 40000, 5, 1, 1)`),
      /ck_te_uma_unidade/
    );
  });
});

describe('o padrão que toda migration nova é obrigada a seguir', () => {
  /**
   * Escreve exatamente o que a versão instalada gravaria — pelo SQL cru, e não
   * pelas mutations, porque as mutations são o código NOVO: usá-las aqui provaria
   * que a versão nova consegue ler o que ela mesma escreveu, que é a pergunta
   * errada.
   */
  function gravarComoAVersaoInstalada(bruto: DatabaseSync) {
    bruto.exec(`insert into exercicios (id, nome, grupo_muscular, tipo_medicao, incremento_placas, gramas_por_placa, criado_em, atualizado_em)
      values ('ex-1', 'Peck Dorsal', 'Costas', 'carga_placa', 1, 5000, 10, 10)`);
    bruto.exec(`insert into treinos (id, nome, ordem, criado_em, atualizado_em)
      values ('tr-1', 'Treino A', 0, 10, 10)`);
    bruto.exec(`insert into treino_exercicios (id, treino_id, exercicio_id, ordem, series_alvo, reps_alvo_min, reps_alvo_max, carga_alvo_placas, descanso_s, criado_em, atualizado_em)
      values ('te-1', 'tr-1', 'ex-1', 0, 4, 10, 10, 5, 90, 10, 10)`);
    bruto.exec(`insert into sessoes (id, treino_id, nome, iniciada_em, finalizada_em, criado_em, atualizado_em)
      values ('ss-1', 'tr-1', 'Treino A', 100, 200, 10, 10)`);
    bruto.exec(`insert into series (id, sessao_id, exercicio_id, indice, tipo, carga_placas, repeticoes, rir, concluida_em, criado_em, atualizado_em)
      values ('se-1', 'ss-1', 'ex-1', 0, 'valida', 5, 10, 2, 150, 10, 10)`);
    bruto.exec(`insert into pesagens (id, peso_g, medido_em, criado_em, atualizado_em)
      values ('pe-1', 78400, 100, 10, 10)`);
    bruto.exec(`insert into medidas (id, parte, valor_mm, medido_em, criado_em, atualizado_em)
      values ('me-1', 'braco_direito', 385, 100, 10, 10)`);
    bruto.exec(`insert into perfil (id, altura_mm, peso_objetivo_g, peso_inicial_g, criado_em, atualizado_em)
      values ('unico', 1780, 75000, 82000, 10, 10)`);
    bruto.exec(`insert into preferencias (chave, valor, atualizado_em) values ('seed_versao', '1', 10)`);
  }

  it(`aplicar até ${PROXIMA - 1}, gravar, aplicar ${PROXIMA}: nada some nem vira NULL`, () => {
    const bruto = bancoCru({ ate: PROXIMA - 1 });
    gravarComoAVersaoInstalada(bruto);

    // Hoje não faz nada, porque a próxima migration ainda não existe. No dia em
    // que ela nascer, é AQUI que ela roda — em cima de dado, como no aparelho.
    aplicarMigrations(bruto, { de: PROXIMA });

    const serie = bruto.prepare("select * from series where id = 'se-1'").get() as Record<
      string,
      unknown
    >;
    assert.equal(serie.carga_placas, 5);
    // A carga continua na COLUNA da unidade: uma migration que "unificasse" as
    // duas colunas passaria a somar 5 com 42500 sem ninguém perceber.
    assert.equal(serie.carga_g, null);
    assert.equal(serie.repeticoes, 10);
    assert.equal(serie.rir, 2);
    assert.equal(serie.concluida_em, 150);

    const exercicio = bruto.prepare("select * from exercicios where id = 'ex-1'").get() as Record<
      string,
      unknown
    >;
    assert.equal(exercicio.tipo_medicao, 'carga_placa');
    assert.equal(exercicio.incremento_placas, 1);
    assert.equal(exercicio.gramas_por_placa, 5000);

    const item = bruto.prepare("select * from treino_exercicios where id = 'te-1'").get() as Record<
      string,
      unknown
    >;
    assert.equal(item.carga_alvo_placas, 5);
    assert.equal(item.series_alvo, 4);
    assert.equal(item.descanso_s, 90);

    const perfil = bruto.prepare("select * from perfil where id = 'unico'").get() as Record<
      string,
      unknown
    >;
    assert.equal(perfil.altura_mm, 1780);
    assert.equal(perfil.peso_inicial_g, 82000);

    // Contagem por tabela: uma migration que recria tabela e esquece o
    // `insert ... select` some com tudo e não dá erro nenhum.
    for (const [tabela, esperado] of [
      ['exercicios', 1],
      ['treinos', 1],
      ['treino_exercicios', 1],
      ['sessoes', 1],
      ['series', 1],
      ['pesagens', 1],
      ['medidas', 1],
      ['perfil', 1],
      ['preferencias', 1],
    ] as const) {
      const { n } = bruto.prepare(`select count(*) as n from ${tabela}`).get() as { n: number };
      assert.equal(n, esperado, `${tabela} perdeu linha na migration`);
    }
  });

  it('hoje só existe a 0000 — quando a próxima nascer, este teste cai e cobra o caso dela', () => {
    // Não é burocracia: o passo que o padrão acima NÃO consegue adivinhar é o que
    // a migration nova promete (coluna com DEFAULT? tabela nova? backfill?). Este
    // assert é o lembrete de escrever esse caso aqui em vez de confiar na moldura.
    assert.deepEqual(INDICES, [0]);
  });
});
