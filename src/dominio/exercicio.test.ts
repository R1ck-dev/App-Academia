import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TIPOS_MEDICAO, type TipoMedicao } from '../db/schema.ts';
import { kg, placa } from './carga.ts';
import {
  calibrado,
  cargaCompativel,
  emGramas,
  incrementoPadrao,
  medidoPorTempo,
  rotuloDoTipoMedicao,
  temCarga,
  unidadeDoTipo,
  type Exercicio,
} from './exercicio.ts';

function exercicio(tipoMedicao: TipoMedicao, gramasPorPlaca: number | null = null): Exercicio {
  return {
    id: 'ex-1',
    nome: 'Teste',
    grupoMuscular: null,
    tipoMedicao,
    incremento: incrementoPadrao(tipoMedicao),
    gramasPorPlaca,
    arquivadoEm: null,
  };
}

describe('unidade do tipo de medição', () => {
  it('cobre os cinco tipos', () => {
    assert.equal(unidadeDoTipo('carga_kg'), 'kg');
    assert.equal(unidadeDoTipo('carga_placa'), 'placa');
    assert.equal(unidadeDoTipo('peso_corporal'), null);
    assert.equal(unidadeDoTipo('tempo'), null);
    assert.equal(unidadeDoTipo('distancia'), null);
  });

  it('temCarga separa quem tem número de carga de quem não tem', () => {
    assert.equal(temCarga('carga_kg'), true);
    assert.equal(temCarga('carga_placa'), true);
    assert.equal(temCarga('peso_corporal'), false);
    assert.equal(temCarga('tempo'), false);
    assert.equal(temCarga('distancia'), false);
  });
});

describe('incrementoPadrao', () => {
  it('nasce na unidade do exercício, nunca 2500 numa máquina de placa', () => {
    assert.deepEqual(incrementoPadrao('carga_kg'), kg(2500));
    assert.deepEqual(incrementoPadrao('carga_placa'), placa(1));
    assert.equal(incrementoPadrao('tempo'), null);
    assert.equal(incrementoPadrao('peso_corporal'), null);
    assert.equal(incrementoPadrao('distancia'), null);
  });
});

describe('cargaCompativel', () => {
  it('máquina de placa recusa quilo e recusa carga ausente', () => {
    const peckDeck = exercicio('carga_placa');
    assert.equal(cargaCompativel(peckDeck, kg(40000)), false);
    assert.equal(cargaCompativel(peckDeck, placa(5)), true);
    assert.equal(cargaCompativel(peckDeck, null), false);
  });

  it('exercício em kg recusa placa', () => {
    const supino = exercicio('carga_kg');
    assert.equal(cargaCompativel(supino, kg(40000)), true);
    assert.equal(cargaCompativel(supino, placa(5)), false);
    assert.equal(cargaCompativel(supino, null), false);
  });

  it('peso corporal, tempo e distância só aceitam ausência de carga', () => {
    const abdominal = exercicio('peso_corporal');
    assert.equal(cargaCompativel(abdominal, null), true);
    assert.equal(cargaCompativel(abdominal, placa(1)), false);
    assert.equal(cargaCompativel(abdominal, kg(1000)), false);
    assert.equal(cargaCompativel(exercicio('tempo'), null), true);
    assert.equal(cargaCompativel(exercicio('distancia'), kg(1000)), false);
  });
});

describe('emGramas', () => {
  it('converte placa pela calibração do próprio exercício', () => {
    assert.equal(emGramas(exercicio('carga_placa', 5000), placa(5)), 25000);
    assert.equal(emGramas(exercicio('carga_placa'), placa(5)), null);
  });

  it('kg passa direto', () => {
    assert.equal(emGramas(exercicio('carga_kg'), kg(42500)), 42500);
  });

  it('carga ausente ou de unidade errada não vira número', () => {
    assert.equal(emGramas(exercicio('carga_kg'), null), null);
    assert.equal(emGramas(exercicio('carga_placa', 5000), kg(40000)), null);
    assert.equal(emGramas(exercicio('peso_corporal'), null), null);
  });
});

describe('calibrado', () => {
  it('é a pergunta "sei quanto pesa a placa", e só existe em placa', () => {
    assert.equal(calibrado(exercicio('carga_placa', 5000)), true);
    assert.equal(calibrado(exercicio('carga_placa')), false);
    assert.equal(calibrado(exercicio('carga_kg')), false);
  });
});

describe('medidoPorTempo', () => {
  it('tempo e distância medem duração; os três restantes, não', () => {
    assert.equal(medidoPorTempo('tempo'), true);
    // `distancia` anda junto de `tempo` porque `series` não tem coluna de
    // distância: sem isso a sugestão sairia com carga, reps e duração nulas.
    assert.equal(medidoPorTempo('distancia'), true);
    assert.equal(medidoPorTempo('carga_kg'), false);
    assert.equal(medidoPorTempo('carga_placa'), false);
    assert.equal(medidoPorTempo('peso_corporal'), false);
  });

  it('é o complemento de temCarga em todo tipo menos peso corporal', () => {
    // Peso corporal é o único que não tem carga E não é medido por tempo — ele
    // mede repetição. As duas perguntas são independentes de propósito.
    for (const t of TIPOS_MEDICAO) {
      if (t === 'peso_corporal') continue;
      assert.notEqual(temCarga(t), medidoPorTempo(t), t);
    }
    assert.equal(temCarga('peso_corporal'), false);
    assert.equal(medidoPorTempo('peso_corporal'), false);
  });
});

describe('rotuloDoTipoMedicao', () => {
  it('todo tipo tem rótulo, e nenhum se repete', () => {
    const rotulos = TIPOS_MEDICAO.map(rotuloDoTipoMedicao);
    assert.deepEqual(rotulos, ['kg', 'placa', 'peso do corpo', 'tempo', 'distância']);
    assert.equal(new Set(rotulos).size, TIPOS_MEDICAO.length);
  });
});
