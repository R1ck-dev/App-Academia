import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cargaAnterior,
  cargaDaLinha,
  colunasDaCarga,
  compararCarga,
  formatarCarga,
  formatarMedida,
  formatarNumeroDaCarga,
  formatarPeso,
  formatarVolume,
  kg,
  parseCarga,
  parseKg,
  proximaCarga,
  type Carga,
} from './carga.ts';

describe('parseKg', () => {
  it('aceita vírgula, que é o que o teclado brasileiro dá', () => {
    assert.deepEqual(parseKg('42,5'), { ok: true, gramas: 42500 });
  });

  it('aceita ponto e inteiro', () => {
    assert.deepEqual(parseKg('42.5'), { ok: true, gramas: 42500 });
    assert.deepEqual(parseKg('42'), { ok: true, gramas: 42000 });
  });

  it('tolera espaço e o sufixo kg', () => {
    assert.deepEqual(parseKg(' 42,5 kg '), { ok: true, gramas: 42500 });
  });

  it('guarda a anilha de 1,25 kg sem perder precisão', () => {
    assert.deepEqual(parseKg('41,25'), { ok: true, gramas: 41250 });
  });

  it('recusa lixo em vez de devolver NaN', () => {
    assert.equal(parseKg('abc').ok, false);
    assert.equal(parseKg('').ok, false);
    assert.equal(parseKg('-10').ok, false);
    assert.equal(parseKg('0').ok, false);
  });

  it('recusa acima do teto de 1000 kg', () => {
    assert.equal(parseKg('1001').ok, false);
  });
});

describe('parseCarga', () => {
  it('é o parseKg embrulhado numa Carga', () => {
    assert.deepEqual(parseCarga(' 42,5 kg '), { ok: true, carga: kg(42500) });
  });

  it('propaga a recusa em vez de inventar zero', () => {
    assert.deepEqual(parseCarga('abc'), { ok: false, erro: 'Carga inválida.' });
    assert.deepEqual(parseCarga(''), { ok: false, erro: 'Informe a carga.' });
  });
});

describe('formatação', () => {
  it('kg omite decimal quando não há e mostra quando há', () => {
    assert.equal(formatarCarga(kg(40000)), '40 kg');
    assert.equal(formatarCarga(kg(42500)), '42,5 kg');
    assert.equal(formatarCarga(kg(41250)), '41,25 kg');
  });

  it('o dígito grande da tela vem sem unidade', () => {
    assert.equal(formatarNumeroDaCarga(kg(42500)), '42,5');
    assert.equal(formatarNumeroDaCarga(kg(40000)), '40');
  });

  it('volume sai formatado para nenhuma tela dividir por 1000', () => {
    assert.equal(formatarVolume(720000), '720 kg·rep');
    assert.equal(formatarVolume(0), '0 kg·rep');
  });

  it('peso corporal tem uma casa; medida vem de milímetro', () => {
    assert.equal(formatarPeso(78400), '78,4');
    assert.equal(formatarMedida(385), '38,5');
  });
});

describe('ida e volta', () => {
  it('parse e formatação não perdem valor', () => {
    for (const entrada of ['42,5', '100', '7,25', '0,5']) {
      const r = parseCarga(entrada);
      assert.equal(r.ok, true);
      assert.equal(formatarNumeroDaCarga((r as { ok: true; carga: Carga }).carga), entrada);
    }
  });
});

describe('a coluna crua', () => {
  it('NULL é "não se aplica", e não zero quilo', () => {
    assert.deepEqual(cargaDaLinha({ cargaG: 40000 }), kg(40000));
    assert.equal(cargaDaLinha({ cargaG: null }), null);
  });

  it('colunasDaCarga é o inverso exato', () => {
    assert.deepEqual(colunasDaCarga(kg(40000)), { cargaG: 40000 });
    assert.deepEqual(colunasDaCarga(null), { cargaG: null });
    assert.deepEqual(cargaDaLinha(colunasDaCarga(kg(42500))), kg(42500));
  });
});

describe('aritmética', () => {
  it('sobe e desce um degrau', () => {
    assert.deepEqual(proximaCarga(kg(40000), kg(2500)), kg(42500));
    assert.deepEqual(cargaAnterior(kg(42500), kg(2500)), kg(40000));
  });

  it('não passa do teto nem chega a uma carga impersistível', () => {
    // O piso é o próprio incremento: `CHECK carga_g > 0` recusaria zero, e
    // "levantou zero quilo" não é um estado que exista.
    assert.deepEqual(cargaAnterior(kg(2500), kg(2500)), kg(2500));
    assert.deepEqual(proximaCarga(kg(1_000_000), kg(2500)), kg(1_000_000));
  });

  it('compararCarga serve de comparador', () => {
    assert.ok(compararCarga(kg(42500), kg(40000)) > 0);
    assert.equal(compararCarga(kg(40000), kg(40000)), 0);
    assert.ok(compararCarga(kg(37500), kg(40000)) < 0);
  });
});

describe('o embrulho', () => {
  it('Carga não é um number solto — grama e quilo se confundem sozinhos', () => {
    // @ts-expect-error 42500 é um número, não uma carga: o embrulho existe para
    // impedir exatamente que alguém passe "42,5" onde se espera grama.
    proximaCarga(42500, kg(2500));
  });
});
