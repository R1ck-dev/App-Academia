/**
 * O teste do backup é o teste de uma promessa: **o que sai volta igual**.
 *
 * Não há servidor, então este arquivo é a única coisa entre o Henrique e perder
 * um ano de treino no dia em que o celular sumir. Por isso a volta completa
 * (exportar → apagar tudo → restaurar) é verificada linha a linha, e não por
 * amostragem: um backup que perde silenciosamente a tabela `medidas` só seria
 * descoberto no pior momento possível.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { criarBancoDeTeste } from './banco-de-teste.ts';
import { db } from './conexao.ts';
import {
  contarLinhas,
  interpretar,
  montarBackup,
  restaurarBackup,
  serializar,
  VERSAO_DO_BACKUP,
} from './exportar-dados.ts';
import {
  arquivarExercicio,
  criarExercicio,
  criarTreino,
  definirItemDoTreino,
  definirObjetivoPeso,
  finalizarSessao,
  iniciarSessao,
  registrarMedida,
  registrarPesagem,
  registrarSerie,
  salvarAltura,
} from './mutations.ts';
import { exercicios, medidas, pesagens, series, sessoes, treinos } from './schema.ts';
import { kg, placa } from '../dominio/carga.ts';

const T = Date.UTC(2026, 7, 16, 12, 0, 0);

/** Um banco com dado de todo tipo, inclusive o arquivado e as duas unidades. */
function bancoPovoado() {
  const supino = criarExercicio({ nome: 'Supino Inclinado', tipoMedicao: 'carga_kg' });
  const peck = criarExercicio({ nome: 'Peck Deck', tipoMedicao: 'carga_placa' });
  const antigo = criarExercicio({ nome: 'Exercício aposentado', tipoMedicao: 'carga_kg' });
  arquivarExercicio(antigo);

  const treino = criarTreino({ nome: 'Treino C', descricao: 'Peito' });
  definirItemDoTreino({
    treinoId: treino,
    exercicioId: supino,
    ordem: 0,
    seriesAlvo: 4,
    repsAlvoMin: 10,
    repsAlvoMax: 10,
    cargaAlvo: kg(10000),
  });

  const sessao = iniciarSessao({ nome: 'Treino C', treinoId: treino });
  assert.ok(sessao.ok);
  registrarSerie({
    sessaoId: sessao.sessaoId,
    exercicioId: supino,
    indice: 0,
    carga: kg(42500),
    repeticoes: 10,
  });
  registrarSerie({
    sessaoId: sessao.sessaoId,
    exercicioId: peck,
    indice: 0,
    carga: placa(5),
    repeticoes: 12,
    tipo: 'aquecimento',
  });
  finalizarSessao(sessao.sessaoId);

  registrarPesagem({ pesoG: 78400 });
  registrarMedida({ parte: 'braco_direito', valorMm: 385 });
  salvarAltura(1750);
  definirObjetivoPeso(75000);

  return { supino, peck, antigo, treino, sessao: sessao.sessaoId };
}

/** Uma foto comparável do banco inteiro, para o antes e o depois. */
function foto() {
  return serializar(montarBackup(0));
}

beforeEach(() => {
  criarBancoDeTeste();
});

describe('montarBackup', () => {
  it('leva as nove tabelas, mesmo as vazias', () => {
    const backup = montarBackup(T);
    assert.deepEqual(Object.keys(backup.tabelas).sort(), [
      'exercicios',
      'medidas',
      'perfil',
      'pesagens',
      'preferencias',
      'series',
      'sessoes',
      'treino_exercicios',
      'treinos',
    ]);
    assert.equal(backup.versao, VERSAO_DO_BACKUP);
    assert.equal(backup.geradoEm, T);
  });

  it('leva o ARQUIVADO junto — soft delete é para o histórico sobreviver', () => {
    const { antigo } = bancoPovoado();
    const backup = montarBackup(T);
    const linha = backup.tabelas.exercicios.find((e) => e.id === antigo);
    assert.ok(linha, 'o exercício arquivado tem que estar no backup');
    assert.notEqual(linha.arquivado_em ?? linha.arquivadoEm, null);
  });
});

describe('a volta completa', () => {
  it('exportar → apagar tudo → restaurar devolve o MESMO banco', () => {
    bancoPovoado();
    const antes = foto();
    const backup = montarBackup(T);

    // O aparelho novo: banco limpo, migrado, sem uma linha.
    criarBancoDeTeste();
    assert.equal(db.select().from(series).all().length, 0);

    restaurarBackup(backup);

    assert.equal(foto(), antes);
  });

  it('restaurar por cima de um banco COM dados substitui, não mistura', () => {
    bancoPovoado();
    const backup = montarBackup(T);

    criarBancoDeTeste();
    criarExercicio({ nome: 'Coisa que não estava no backup', tipoMedicao: 'carga_kg' });
    criarTreino({ nome: 'Treino que não estava no backup' });

    restaurarBackup(backup);

    const nomes = db
      .select()
      .from(exercicios)
      .all()
      .map((e) => e.nome);
    assert.ok(!nomes.includes('Coisa que não estava no backup'));
    assert.deepEqual(
      db
        .select()
        .from(treinos)
        .all()
        .map((t) => t.nome),
      ['Treino C']
    );
  });

  it('atravessa o texto: serializar e interpretar não perdem nada', () => {
    bancoPovoado();
    const antes = foto();
    const texto = serializar(montarBackup(T));

    const lido = interpretar(texto);
    assert.ok(lido.ok);

    criarBancoDeTeste();
    restaurarBackup(lido.backup);

    assert.equal(foto(), antes);
  });

  it('preserva as duas unidades de carga separadas', () => {
    bancoPovoado();
    const backup = montarBackup(T);
    criarBancoDeTeste();
    restaurarBackup(backup);

    const linhas = db.select().from(series).all();
    const emKg = linhas.find((s) => s.cargaG !== null);
    const emPlaca = linhas.find((s) => s.cargaPlacas !== null);

    assert.equal(emKg?.cargaG, 42500);
    assert.equal(emKg?.cargaPlacas, null);
    assert.equal(emPlaca?.cargaPlacas, 5);
    assert.equal(emPlaca?.cargaG, null);
  });

  it('restaurar avisa a tela — senão o app fica mostrando o banco antigo', () => {
    bancoPovoado();
    const backup = montarBackup(T);
    criarBancoDeTeste();

    // `restaurarBackup` usa `db.transaction`, e o proxy de `conexao.ts` avisa
    // depois do commit. Se alguém trocar a transação por escritas soltas, a tela
    // para de atualizar e este teste é quem percebe.
    const fonte = restaurarBackup.toString();
    assert.match(fonte, /db\.transaction/);
    restaurarBackup(backup);
  });
});

describe('interpretar recusa antes de tocar no banco', () => {
  it('arquivo que não é JSON', () => {
    const r = interpretar('isto não é json');
    assert.ok(!r.ok);
    assert.match(r.erro, /não é um backup/);
  });

  it('JSON válido que não é backup', () => {
    const r = interpretar('{"qualquer":"coisa"}');
    assert.ok(!r.ok);
    assert.match(r.erro, /versão/);
  });

  it('backup de versão FUTURA — restaurar às cegas perderia dado', () => {
    const r = interpretar(JSON.stringify({ versao: 99, geradoEm: T, tabelas: {} }));
    assert.ok(!r.ok);
    assert.match(r.erro, /Atualize o app/);
  });

  it('tabela corrompida', () => {
    const r = interpretar(JSON.stringify({ versao: 1, geradoEm: T, tabelas: { series: 42 } }));
    assert.ok(!r.ok);
    assert.match(r.erro, /series/);
  });

  it('backup sem uma tabela restaura o resto e deixa aquela vazia', () => {
    bancoPovoado();
    const backup = montarBackup(T);
    delete backup.tabelas.medidas;

    criarBancoDeTeste();
    restaurarBackup(backup);

    assert.equal(db.select().from(medidas).all().length, 0);
    assert.ok(db.select().from(series).all().length > 0);
  });
});

describe('contarLinhas', () => {
  it('conta o que a restauração vai substituir', () => {
    assert.deepEqual(contarLinhas(), { sessoes: 0, pesagens: 0, series: 0 });
    bancoPovoado();
    const contagem = contarLinhas();
    assert.equal(contagem.sessoes, 1);
    assert.equal(contagem.pesagens, 1);
    assert.equal(contagem.series, 2);
    assert.equal(db.select().from(pesagens).all().length, 1);
    assert.equal(db.select().from(sessoes).all().length, 1);
  });
});
