import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calcularRecordes, estimar1RM, type SerieComSessao } from './recordes.ts';

const serie = (p: Partial<SerieComSessao> = {}): SerieComSessao => ({
  sessaoId: 's1',
  tipo: 'valida',
  cargaG: 40000,
  repeticoes: 10,
  ...p,
});

describe('estimar1RM', () => {
  it('com 1 repetição, o 1RM é a própria carga', () => {
    assert.equal(estimar1RM(100000, 1)?.gramas, Math.round(100000 * (1 + 1 / 30)));
  });

  it('marca como não confiável acima de 12 repetições', () => {
    assert.equal(estimar1RM(40000, 12)?.confiavel, true);
    assert.equal(estimar1RM(40000, 20)?.confiavel, false);
  });

  it('devolve null quando não há o que estimar', () => {
    assert.equal(estimar1RM(0, 10), null);
    assert.equal(estimar1RM(40000, 0), null);
  });
});

describe('calcularRecordes', () => {
  it('sem série válida, não há recorde', () => {
    assert.deepEqual(calcularRecordes([]), {
      maiorCarga: null,
      maior1RM: null,
      maiorVolumeSessao: null,
    });
  });

  it('maior carga ignora o aquecimento pesado', () => {
    const series = [serie(), serie({ tipo: 'aquecimento', cargaG: 90000, repeticoes: 5 })];
    assert.equal(calcularRecordes(series).maiorCarga, 40000);
  });

  it('1RM compara série pesada com série longa', () => {
    const pesada = serie({ cargaG: 60000, repeticoes: 3 });
    const longa = serie({ cargaG: 40000, repeticoes: 15 });
    const r = calcularRecordes([pesada, longa]);
    assert.equal(r.maior1RM, estimar1RM(60000, 3)?.gramas);
  });

  it('volume é por sessão, não somando o histórico todo', () => {
    const series = [
      serie({ sessaoId: 's1' }),
      serie({ sessaoId: 's1' }),
      serie({ sessaoId: 's2', repeticoes: 12 }),
    ];
    assert.equal(calcularRecordes(series).maiorVolumeSessao, 800000);
  });
});
