import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kg, placa } from './carga.ts';
import type { Exercicio } from './exercicio.ts';
import { calcularRecordes, estimar1RM, novoRecorde, type Recordes } from './recordes.ts';
import type { SerieExecutada } from './volume.ts';

const serie = (p: Partial<SerieExecutada> = {}): SerieExecutada => ({
  id: 'sr1',
  sessaoId: 's1',
  exercicioId: 'ex-supino',
  indice: 0,
  tipo: 'valida',
  carga: kg(40000),
  repeticoes: 10,
  duracaoS: null,
  rir: null,
  concluidaEm: 1_000,
  ...p,
});

const supino: Exercicio = {
  id: 'ex-supino',
  nome: 'Supino Inclinado',
  grupoMuscular: 'peito',
  tipoMedicao: 'carga_kg',
  incremento: kg(2500),
  gramasPorPlaca: null,
  arquivadoEm: null,
};

const remadaAlta: Exercicio = {
  id: 'ex-remada',
  nome: 'Remada Alta',
  grupoMuscular: 'costas',
  tipoMedicao: 'carga_placa',
  incremento: placa(1),
  gramasPorPlaca: null,
  arquivadoEm: null,
};

describe('estimar1RM', () => {
  it('com 1 repetição, o 1RM é praticamente a própria carga', () => {
    assert.deepEqual(estimar1RM(kg(100000), 1)?.carga, kg(Math.round(100000 * (1 + 1 / 30))));
  });

  it('marca como não confiável acima de 12 repetições', () => {
    assert.equal(estimar1RM(kg(40000), 12)?.confiavel, true);
    assert.equal(estimar1RM(kg(40000), 20)?.confiavel, false);
  });

  it('devolve null quando não há o que estimar', () => {
    assert.equal(estimar1RM(kg(0), 10), null);
    assert.equal(estimar1RM(kg(40000), 0), null);
  });
});

describe('calcularRecordes', () => {
  it('contêiner sem série válida não tem recorde nenhum', () => {
    assert.deepEqual(calcularRecordes({ exercicio: supino, series: [] }), {
      maiorCarga: null,
      maior1RM: null,
      maiorVolumeSessao: null,
      maiorReps: null,
      maiorRepsNaCarga: null,
      totalDeSeries: 0,
      umRMAproximado: false,
    } satisfies Recordes);
  });

  it('maior carga ignora o aquecimento pesado', () => {
    const series = [
      serie(),
      serie({ id: 'aq', indice: 1, tipo: 'aquecimento', carga: kg(90000), repeticoes: 5 }),
    ];
    const r = calcularRecordes({ exercicio: supino, series });
    assert.deepEqual(r.maiorCarga, kg(40000));
    assert.equal(r.totalDeSeries, 1);
  });

  it('1RM compara série pesada com série longa', () => {
    const pesada = serie({ id: 'p', carga: kg(60000), repeticoes: 3 });
    const longa = serie({ id: 'l', indice: 1, carga: kg(40000), repeticoes: 15 });
    const r = calcularRecordes({ exercicio: supino, series: [pesada, longa] });
    assert.deepEqual(r.maior1RM, estimar1RM(kg(60000), 3));
    assert.equal(r.umRMAproximado, false);
  });

  it('volume é por sessão, não somando o histórico todo', () => {
    const series = [
      serie({ id: 'a', sessaoId: 's1', indice: 0 }),
      serie({ id: 'b', sessaoId: 's1', indice: 1 }),
      serie({ id: 'c', sessaoId: 's2', indice: 0, repeticoes: 12 }),
    ];
    const r = calcularRecordes({ exercicio: supino, series });
    assert.deepEqual(r.maiorVolumeSessao, { valor: 800000, unidade: 'kg' });
  });

  const historicoEmPlaca = [
    serie({ id: 'r0', exercicioId: 'ex-remada', indice: 0, carga: placa(5), repeticoes: 12 }),
    serie({ id: 'r1', exercicioId: 'ex-remada', indice: 1, carga: placa(6), repeticoes: 8 }),
  ];

  it('placa NÃO calibrada: sem 1RM, mas com recorde de carga e de repetições', () => {
    const r = calcularRecordes({ exercicio: remadaAlta, series: historicoEmPlaca });

    assert.equal(r.maior1RM, null, '1RM em placa crua seria ficção');
    assert.equal(r.umRMAproximado, false);
    assert.deepEqual(r.maiorCarga, placa(6));
    assert.equal(r.maiorReps, 12);
    assert.deepEqual(r.maiorRepsNaCarga, placa(5));
    assert.deepEqual(r.maiorVolumeSessao, { valor: 5 * 12 + 6 * 8, unidade: 'placa' });
    assert.equal(r.totalDeSeries, 2);
  });

  it('depois de calibrar, o MESMO histórico ganha 1RM retroativamente e marcado como aproximado', () => {
    const calibrada: Exercicio = { ...remadaAlta, gramasPorPlaca: 5000 };
    const r = calcularRecordes({ exercicio: calibrada, series: historicoEmPlaca });

    // 6 placas x 5 kg = 30 kg em 8 reps ganha de 5 placas (25 kg) em 12.
    assert.deepEqual(r.maior1RM, estimar1RM(kg(30000), 8));
    assert.equal(r.umRMAproximado, true);
    // O que é da escala da máquina não se converte: carga e volume seguem em placa.
    assert.deepEqual(r.maiorCarga, placa(6));
    assert.deepEqual(r.maiorVolumeSessao, { valor: 5 * 12 + 6 * 8, unidade: 'placa' });
  });

  it('peso corporal tem recorde de repetições e nada mais', () => {
    const abdominal: Exercicio = {
      id: 'ex-abdominal',
      nome: 'Abdominal Supra Solo',
      grupoMuscular: 'abdomen',
      tipoMedicao: 'peso_corporal',
      incremento: null,
      gramasPorPlaca: null,
      arquivadoEm: null,
    };
    const series = [
      serie({ id: 'b0', exercicioId: 'ex-abdominal', carga: null, repeticoes: 20 }),
      serie({ id: 'b1', exercicioId: 'ex-abdominal', indice: 1, carga: null, repeticoes: 25 }),
    ];
    const r = calcularRecordes({ exercicio: abdominal, series });

    assert.equal(r.maiorReps, 25);
    assert.equal(r.maiorRepsNaCarga, null);
    assert.equal(r.maiorCarga, null);
    assert.equal(r.maior1RM, null);
    assert.equal(r.maiorVolumeSessao, null);
  });

  it('empate de repetições fica com a carga maior', () => {
    const series = [
      serie({ id: 'e0', carga: kg(40000), repeticoes: 12 }),
      serie({ id: 'e1', indice: 1, carga: kg(45000), repeticoes: 12 }),
    ];
    const r = calcularRecordes({ exercicio: supino, series });
    assert.deepEqual(r.maiorRepsNaCarga, kg(45000));
  });
});

describe('novoRecorde', () => {
  const anteriores = calcularRecordes({
    exercicio: supino,
    series: [serie({ carga: kg(40000), repeticoes: 10 })],
  });

  it('acende os três quando a série supera carga, 1RM e repetições', () => {
    const nova = serie({ id: 'n', indice: 1, carga: kg(45000), repeticoes: 12 });
    assert.deepEqual(novoRecorde(nova, supino, anteriores), {
      carga: true,
      umRM: true,
      reps: true,
    });
  });

  it('empatar não é bater: série idêntica não acende nada', () => {
    const igual = serie({ id: 'n', indice: 1 });
    assert.deepEqual(novoRecorde(igual, supino, anteriores), {
      carga: false,
      umRM: false,
      reps: false,
    });
  });

  it('acende só o que de fato caiu: mais carga com menos reps não é recorde de reps', () => {
    const pesada = serie({ id: 'n', indice: 1, carga: kg(50000), repeticoes: 6 });
    assert.deepEqual(novoRecorde(pesada, supino, anteriores), {
      carga: true,
      umRM: true,
      reps: false,
    });
  });

  it('aquecimento nunca acende recorde, por mais pesado que seja', () => {
    const aquece = serie({ id: 'n', indice: 1, tipo: 'aquecimento', carga: kg(90000), repeticoes: 20 });
    assert.deepEqual(novoRecorde(aquece, supino, anteriores), {
      carga: false,
      umRM: false,
      reps: false,
    });
  });

  it('em placa sem calibração o selo de repetições continua existindo, o de 1RM não', () => {
    const semRecorde = calcularRecordes({ exercicio: remadaAlta, series: [] });
    const nova = serie({ id: 'n', exercicioId: 'ex-remada', carga: placa(5), repeticoes: 12 });
    assert.deepEqual(novoRecorde(nova, remadaAlta, semRecorde), {
      carga: true,
      umRM: false,
      reps: true,
    });
  });

  it('carga de outra unidade não vira recorde — é outra escala, não um número maior', () => {
    const emPlaca = calcularRecordes({
      exercicio: remadaAlta,
      series: [serie({ exercicioId: 'ex-remada', carga: placa(5), repeticoes: 10 })],
    });
    // Só chega aqui se `registrarSerie` for burlada; 40000 não pode ganhar de 5.
    const intrusa = serie({ id: 'n', exercicioId: 'ex-remada', indice: 1, carga: kg(40000) });
    assert.deepEqual(novoRecorde(intrusa, remadaAlta, emPlaca), {
      carga: false,
      umRM: false,
      reps: false,
    });
  });
});
