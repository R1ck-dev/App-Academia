import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kg } from './carga.ts';
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
  });

  it('volume é por sessão, não somando o histórico todo', () => {
    const series = [
      serie({ id: 'a', sessaoId: 's1', indice: 0 }),
      serie({ id: 'b', sessaoId: 's1', indice: 1 }),
      serie({ id: 'c', sessaoId: 's2', indice: 0, repeticoes: 12 }),
    ];
    const r = calcularRecordes({ exercicio: supino, series });
    assert.deepEqual(r.maiorVolumeSessao, { valor: 800000 });
  });

  it('desempata o recorde de repetições pela carga', () => {
    // 12 reps com 30 kg é um recorde melhor que 12 reps com 25, e a tela
    // precisa mostrar a carga certa ao lado do número.
    const series = [
      serie({ id: 'a', indice: 0, carga: kg(25000), repeticoes: 12 }),
      serie({ id: 'b', indice: 1, carga: kg(30000), repeticoes: 12 }),
    ];
    const r = calcularRecordes({ exercicio: supino, series });

    assert.equal(r.maiorReps, 12);
    assert.deepEqual(r.maiorRepsNaCarga, kg(30000));
  });

  it('peso corporal tem recorde de repetições e nada mais', () => {
    const abdominal: Exercicio = {
      id: 'ex-abdominal',
      nome: 'Abdominal Supra Solo',
      grupoMuscular: 'abdomen',
      tipoMedicao: 'peso_corporal',
      incremento: null,
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

  it('a primeira série de um exercício é recorde nos três selos', () => {
    const semRecorde = calcularRecordes({ exercicio: supino, series: [] });
    const nova = serie({ id: 'n', carga: kg(40000), repeticoes: 12 });
    assert.deepEqual(novoRecorde(nova, supino, semRecorde), {
      carga: true,
      umRM: true,
      reps: true,
    });
  });

  it('carga num exercício de peso corporal não vira recorde de carga', () => {
    const abdominal: Exercicio = {
      id: 'ex-abdominal',
      nome: 'Abdominal Supra Solo',
      grupoMuscular: 'abdomen',
      tipoMedicao: 'peso_corporal',
      incremento: null,
      arquivadoEm: null,
    };
    const antes = calcularRecordes({
      exercicio: abdominal,
      series: [serie({ exercicioId: 'ex-abdominal', carga: null, repeticoes: 20 })],
    });
    // Só chega aqui se `registrarSerie` for burlada: carga onde não cabe carga
    // não é um recorde, é dado inválido.
    const intrusa = serie({ id: 'n', exercicioId: 'ex-abdominal', indice: 1, carga: kg(40000), repeticoes: 10 });
    assert.deepEqual(novoRecorde(intrusa, abdominal, antes), {
      carga: false,
      umRM: false,
      reps: false,
    });
  });
});
