import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatarKg, formatarMedida, formatarPeso, parseKg } from './carga.ts';

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
});

describe('formatação', () => {
  it('omite decimal quando não há', () => {
    assert.equal(formatarKg(40000), '40');
  });

  it('mostra meia anilha e um quarto de anilha', () => {
    assert.equal(formatarKg(42500), '42,5');
    assert.equal(formatarKg(41250), '41,25');
  });

  it('peso corporal tem uma casa; medida vem de milímetro', () => {
    assert.equal(formatarPeso(78400), '78,4');
    assert.equal(formatarMedida(385), '38,5');
  });
});

describe('ida e volta', () => {
  it('parse e formatação não perdem valor', () => {
    for (const entrada of ['42,5', '100', '7,25', '0,5']) {
      const r = parseKg(entrada);
      assert.equal(r.ok, true);
      assert.equal(formatarKg((r as { ok: true; gramas: number }).gramas), entrada.replace('.', ','));
    }
  });
});
