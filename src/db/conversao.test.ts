/**
 * A pergunta de seis meses: "descobri que a placa pesa 5 kg — e agora?"
 *
 * São duas respostas de custo muito diferente, e o ponto destes testes é provar
 * que a barata (`calibrarPlaca`) NÃO toca em `series`, e que a cara
 * (`converterExercicioParaKg`) reescreve tudo de uma vez ou nada.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { placa } from '../dominio/carga.ts';
import { criarBancoDeTeste, type BancoDeTeste } from './banco-de-teste.ts';
import {
  alterarTipoMedicao,
  calibrarPlaca,
  converterExercicioParaKg,
  criarExercicio,
  criarTreino,
  definirItemDoTreino,
  desfazerSerie,
  iniciarSessao,
  registrarSerie,
} from './mutations.ts';

let banco: BancoDeTeste;

beforeEach(() => {
  banco = criarBancoDeTeste();
});

function linhas<T = Record<string, unknown>>(sql: string, ...p: unknown[]): T[] {
  return (banco.bruto.prepare(sql).all(...(p as never[])) as object[]).map((l) => ({
    ...l,
  })) as T[];
}

function linha<T = Record<string, unknown>>(sql: string, ...p: unknown[]): T {
  return { ...(banco.bruto.prepare(sql).get(...(p as never[])) as object) } as T;
}

/** Um exercício de placa com quatro séries gravadas e carga-alvo na ficha. */
function peckDorsalComHistorico() {
  const exercicio = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
  const treino = criarTreino({ nome: 'Treino A' });
  const item = definirItemDoTreino({
    treinoId: treino,
    exercicioId: exercicio,
    ordem: 0,
    seriesAlvo: 4,
    repsAlvoMin: 10,
    repsAlvoMax: 10,
    cargaAlvo: placa(5),
  });

  const sessao = iniciarSessao({ nome: 'Treino A', treinoId: treino });
  assert.ok(sessao.ok);
  const series = [placa(5), placa(5), placa(4), placa(4)].map((carga, indice) =>
    registrarSerie({
      sessaoId: sessao.sessaoId,
      exercicioId: exercicio,
      indice,
      carga,
      repeticoes: 10,
    })
  );

  return { exercicio, item, sessao: sessao.sessaoId, series };
}

describe('calibrarPlaca', () => {
  it('recusa exercício que não é de placa', () => {
    const supino = criarExercicio({ nome: 'Supino Inclinado', tipoMedicao: 'carga_kg' });

    assert.deepEqual(calibrarPlaca(supino, 5000), { ok: false, motivo: 'nao_e_placa' });
    assert.equal(
      linha<{ gramas_por_placa: number | null }>(
        'select gramas_por_placa from exercicios where id = ?',
        supino
      ).gramas_por_placa,
      null
    );
  });

  it('não altera nenhuma linha de series — é a diferença para a conversão', () => {
    const { exercicio } = peckDorsalComHistorico();
    const antes = linhas('select * from series order by indice');

    assert.deepEqual(calibrarPlaca(exercicio, 5000), { ok: true });

    assert.deepEqual(linhas('select * from series order by indice'), antes);
    assert.equal(
      linha<{ gramas_por_placa: number }>(
        'select gramas_por_placa from exercicios where id = ?',
        exercicio
      ).gramas_por_placa,
      5000
    );
  });

  it('descalibra de volta para "não sei" sem perder o histórico', () => {
    const { exercicio } = peckDorsalComHistorico();
    calibrarPlaca(exercicio, 5000);

    assert.deepEqual(calibrarPlaca(exercicio, null), { ok: true });

    assert.equal(
      linha<{ gramas_por_placa: number | null }>(
        'select gramas_por_placa from exercicios where id = ?',
        exercicio
      ).gramas_por_placa,
      null
    );
    assert.equal(linhas('select id from series').length, 4);
  });

  it('recusa peso zero ou negativo — "não sei" se escreve com null', () => {
    const { exercicio } = peckDorsalComHistorico();
    assert.throws(() => calibrarPlaca(exercicio, 0));
    assert.throws(() => calibrarPlaca(exercicio, -5000));
  });
});

describe('alterarTipoMedicao', () => {
  it('recusa quando já existe série, e diz quantas', () => {
    const { exercicio } = peckDorsalComHistorico();

    assert.deepEqual(alterarTipoMedicao(exercicio, 'carga_kg'), {
      ok: false,
      motivo: 'tem_series',
      series: 4,
    });
    assert.equal(
      linha<{ tipo_medicao: string }>('select tipo_medicao from exercicios where id = ?', exercicio)
        .tipo_medicao,
      'carga_placa'
    );
  });

  it('série arquivada ainda conta: desfazer não apaga a unidade do histórico', () => {
    const { exercicio, series } = peckDorsalComHistorico();
    series.forEach(desfazerSerie);

    assert.deepEqual(alterarTipoMedicao(exercicio, 'carga_kg'), {
      ok: false,
      motivo: 'tem_series',
      series: 4,
    });
  });

  it('sem série, troca o tipo e leva o incremento junto', () => {
    const exercicio = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });

    assert.deepEqual(alterarTipoMedicao(exercicio, 'carga_kg'), { ok: true });

    assert.deepEqual(
      linha(
        'select tipo_medicao, incremento_g, incremento_placas, gramas_por_placa from exercicios where id = ?',
        exercicio
      ),
      {
        tipo_medicao: 'carga_kg',
        incremento_g: 2500,
        incremento_placas: null,
        gramas_por_placa: null,
      }
    );
  });

  it('limpa a carga-alvo que ficaria na unidade errada na ficha', () => {
    // Deixá-la ali faria o prefill sugerir "5 placas" num exercício de kg, e
    // `registrarSerie` recusaria isso na academia, com 40 segundos correndo.
    const exercicio = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const treino = criarTreino({ nome: 'Treino A' });
    const item = definirItemDoTreino({
      treinoId: treino,
      exercicioId: exercicio,
      ordem: 0,
      seriesAlvo: 4,
      cargaAlvo: placa(5),
    });

    alterarTipoMedicao(exercicio, 'carga_kg');

    assert.deepEqual(
      linha('select carga_alvo_g, carga_alvo_placas from treino_exercicios where id = ?', item),
      { carga_alvo_g: null, carga_alvo_placas: null }
    );
  });
});

describe('converterExercicioParaKg', () => {
  it('recusa sem calibração — converter sem saber o peso seria inventar dado', () => {
    const { exercicio } = peckDorsalComHistorico();

    assert.deepEqual(converterExercicioParaKg(exercicio), {
      ok: false,
      motivo: 'sem_calibracao',
    });
    assert.equal(
      linhas('select id from series where carga_placas is not null').length,
      4,
      'nenhuma série pode ter sido tocada'
    );
  });

  it('recusa exercício que não é de placa — o sentido kg -> placa não existe', () => {
    const supino = criarExercicio({ nome: 'Supino Inclinado', tipoMedicao: 'carga_kg' });
    assert.deepEqual(converterExercicioParaKg(supino), { ok: false, motivo: 'nao_e_placa' });
  });

  it('com calibração, migra séries e carga-alvo para gramas numa transação', () => {
    const { exercicio, item, series } = peckDorsalComHistorico();
    calibrarPlaca(exercicio, 5000);
    // Uma série arquivada precisa migrar junto: ela continuaria em placa num
    // exercício que passou a ser de kg — exatamente a mistura de unidades que
    // todo o desenho existe para impedir.
    desfazerSerie(series[3]);

    assert.deepEqual(converterExercicioParaKg(exercicio), { ok: true, seriesConvertidas: 4 });

    assert.deepEqual(
      linhas<{ carga_g: number; carga_placas: number | null }>(
        'select carga_g, carga_placas from series order by indice'
      ),
      [
        { carga_g: 25000, carga_placas: null },
        { carga_g: 25000, carga_placas: null },
        { carga_g: 20000, carga_placas: null },
        { carga_g: 20000, carga_placas: null },
      ]
    );
    assert.deepEqual(
      linha('select carga_alvo_g, carga_alvo_placas from treino_exercicios where id = ?', item),
      { carga_alvo_g: 25000, carga_alvo_placas: null }
    );
    assert.deepEqual(
      linha(
        'select tipo_medicao, incremento_g, incremento_placas, gramas_por_placa from exercicios where id = ?',
        exercicio
      ),
      {
        tipo_medicao: 'carga_kg',
        // 1 placa valia 5 kg: o degrau do "+" continua sendo o mesmo salto real.
        incremento_g: 5000,
        incremento_placas: null,
        gramas_por_placa: null,
      }
    );
  });

  it('depois de converter, o exercício aceita kg e recusa placa', () => {
    const { exercicio, sessao } = peckDorsalComHistorico();
    calibrarPlaca(exercicio, 5000);
    converterExercicioParaKg(exercicio);

    assert.throws(() =>
      registrarSerie({
        sessaoId: sessao,
        exercicioId: exercicio,
        indice: 4,
        carga: placa(5),
        repeticoes: 10,
      })
    );
  });
});
