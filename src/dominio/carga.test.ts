import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cargaAnterior,
  cargaDaLinha,
  cargaEmGramas,
  colunasDaCarga,
  compararCarga,
  criarCarga,
  formatarCarga,
  formatarCargaAproximada,
  formatarMedida,
  formatarNumeroDaCarga,
  formatarPeso,
  formatarVolume,
  kg,
  mesmaUnidade,
  parseCarga,
  parseKg,
  placa,
  proximaCarga,
  rotuloDaUnidade,
  valorDaCarga,
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
});

describe('parseCarga', () => {
  it('em kg é o parseKg embrulhado numa Carga', () => {
    assert.deepEqual(parseCarga(' 42,5 kg ', 'kg'), { ok: true, carga: kg(42500) });
  });

  it('em placa recusa decimal com a mensagem que explica', () => {
    const r = parseCarga('5,5', 'placa');
    assert.deepEqual(r, { ok: false, erro: 'Placa é número inteiro.' });
  });

  it('em placa aceita inteiro e tolera o sufixo', () => {
    assert.deepEqual(parseCarga('5', 'placa'), { ok: true, carga: placa(5) });
    assert.deepEqual(parseCarga(' 12 placas ', 'placa'), { ok: true, carga: placa(12) });
  });

  it('em placa recusa acima do teto de 30', () => {
    const r = parseCarga('40', 'placa');
    assert.equal(r.ok, false);
  });

  it('em placa recusa vazio, lixo e zero', () => {
    assert.equal(parseCarga('', 'placa').ok, false);
    assert.equal(parseCarga('abc', 'placa').ok, false);
    assert.equal(parseCarga('0', 'placa').ok, false);
    assert.equal(parseCarga('-3', 'placa').ok, false);
  });
});

describe('formatação', () => {
  it('kg omite decimal quando não há e mostra quando há', () => {
    assert.equal(formatarCarga(kg(40000)), '40 kg');
    assert.equal(formatarCarga(kg(42500)), '42,5 kg');
    assert.equal(formatarCarga(kg(41250)), '41,25 kg');
  });

  it('placa tem plural — "1 placas" denuncia app amador', () => {
    assert.equal(formatarCarga(placa(5)), '5 placas');
    assert.equal(formatarCarga(placa(1)), '1 placa');
    assert.equal(rotuloDaUnidade(placa(1)), 'placa');
    assert.equal(rotuloDaUnidade(placa(2)), 'placas');
    assert.equal(rotuloDaUnidade(kg(1000)), 'kg');
  });

  it('o dígito grande da tela vem sem unidade', () => {
    assert.equal(formatarNumeroDaCarga(kg(42500)), '42,5');
    assert.equal(formatarNumeroDaCarga(placa(5)), '5');
  });

  it('a conversão aproximada carrega o til, porque placa não é proporcional', () => {
    assert.equal(formatarCargaAproximada(placa(5), 5000), '5 placas (~25 kg)');
    assert.equal(formatarCargaAproximada(placa(1), 5000), '1 placa (~5 kg)');
    assert.equal(formatarCargaAproximada(placa(5), null), '5 placas');
    assert.equal(formatarCargaAproximada(kg(42500), 5000), '42,5 kg');
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
  it('parse e formatação não perdem valor em kg', () => {
    for (const entrada of ['42,5', '100', '7,25', '0,5']) {
      const r = parseCarga(entrada, 'kg');
      assert.equal(r.ok, true);
      assert.equal(formatarNumeroDaCarga((r as { ok: true; carga: Carga }).carga), entrada);
    }
  });

  it('parse e formatação não perdem valor em placa', () => {
    for (const entrada of ['1', '5', '30']) {
      const r = parseCarga(entrada, 'placa');
      assert.equal(r.ok, true);
      assert.equal(formatarNumeroDaCarga((r as { ok: true; carga: Carga }).carga), entrada);
    }
  });
});

describe('colunas do banco', () => {
  it('a coluna onde o número mora é o discriminante', () => {
    assert.deepEqual(cargaDaLinha({ cargaG: 40000, cargaPlacas: null }), kg(40000));
    assert.deepEqual(cargaDaLinha({ cargaG: null, cargaPlacas: 5 }), placa(5));
    assert.equal(cargaDaLinha({ cargaG: null, cargaPlacas: null }), null);
  });

  it('colunasDaCarga é o inverso exato', () => {
    assert.deepEqual(colunasDaCarga(kg(40000)), { cargaG: 40000, cargaPlacas: null });
    assert.deepEqual(colunasDaCarga(placa(5)), { cargaG: null, cargaPlacas: 5 });
    assert.deepEqual(colunasDaCarga(null), { cargaG: null, cargaPlacas: null });

    for (const c of [kg(42500), placa(3)] as const) {
      assert.deepEqual(cargaDaLinha(colunasDaCarga(c)), c);
    }
  });
});

describe('construção e valor cru', () => {
  it('criarCarga dispara o ramo da unidade', () => {
    assert.deepEqual(criarCarga('kg', 42500), kg(42500));
    assert.deepEqual(criarCarga('placa', 5), placa(5));
  });

  it('valorDaCarga devolve o número que vai para a coluna', () => {
    assert.equal(valorDaCarga(kg(42500)), 42500);
    assert.equal(valorDaCarga(placa(5)), 5);
  });

  it('mesmaUnidade é a guarda de runtime para dado vindo do banco', () => {
    assert.equal(mesmaUnidade(kg(1000), kg(2000)), true);
    assert.equal(mesmaUnidade(kg(1000), placa(1)), false);
  });
});

describe('aritmética na unidade certa', () => {
  it('sobe e desce um degrau sem trocar de unidade', () => {
    assert.deepEqual(proximaCarga(kg(40000), kg(2500)), kg(42500));
    assert.deepEqual(proximaCarga(placa(5), placa(1)), placa(6));
    assert.deepEqual(cargaAnterior(kg(42500), kg(2500)), kg(40000));
    assert.deepEqual(cargaAnterior(placa(6), placa(1)), placa(5));
  });

  it('não passa do teto nem chega a uma carga impersistível', () => {
    assert.deepEqual(proximaCarga(placa(30), placa(1)), placa(30));
    assert.deepEqual(cargaAnterior(placa(1), placa(1)), placa(1));
    assert.deepEqual(cargaAnterior(kg(2500), kg(2500)), kg(2500));
  });

  it('compararCarga serve de comparador', () => {
    assert.ok(compararCarga(kg(42500), kg(40000)) > 0);
    assert.equal(compararCarga(placa(5), placa(5)), 0);
    assert.ok(compararCarga(placa(4), placa(5)) < 0);
  });

  it('NoInfer: misturar unidade NÃO compila', () => {
    // Estes três @ts-expect-error são o compilador vigiando o compilador. Sem o
    // NoInfer na assinatura, U alarga para 'kg' | 'placa' e as três linhas
    // passam a compilar em silêncio — somando 2500 a cinco placas.
    // @ts-expect-error comparar quilo com placa não significa nada
    compararCarga(kg(1000), placa(1));
    // @ts-expect-error incremento em kg não sobe uma máquina de placa
    proximaCarga(placa(5), kg(2500));
    // @ts-expect-error idem descendo
    cargaAnterior(kg(40000), placa(1));
  });
});

describe('cargaEmGramas', () => {
  it('converte placa só quando a máquina foi calibrada', () => {
    assert.equal(cargaEmGramas(placa(5), 5000), 25000);
    assert.equal(cargaEmGramas(placa(5), null), null);
  });

  it('kg ignora a calibração porque já está em grama', () => {
    assert.equal(cargaEmGramas(kg(42500), null), 42500);
    assert.equal(cargaEmGramas(kg(42500), 5000), 42500);
  });
});
