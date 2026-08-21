import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TIPOS_MEDICAO, type TipoMedicao } from '../db/schema.ts';
import { kg } from './carga.ts';
import {
  cargaCompativel,
  emGramas,
  incrementoPadrao,
  medidoPorTempo,
  rotuloDoTipoMedicao,
  temCarga,
  type Exercicio,
} from './exercicio.ts';

function exercicio(tipoMedicao: TipoMedicao): Exercicio {
  return {
    id: 'ex-1',
    nome: 'Teste',
    grupoMuscular: null,
    tipoMedicao,
    incremento: incrementoPadrao(tipoMedicao),
    arquivadoEm: null,
  };
}

describe('temCarga', () => {
  it('só carga_kg tem carga; os outros três não', () => {
    assert.equal(temCarga('carga_kg'), true);
    assert.equal(temCarga('peso_corporal'), false);
    assert.equal(temCarga('tempo'), false);
    assert.equal(temCarga('distancia'), false);
  });
});

describe('incrementoPadrao', () => {
  it('só existe onde há carga — a esteira não anda de 2,5 kg em 2,5 kg', () => {
    assert.deepEqual(incrementoPadrao('carga_kg'), kg(2500));
    assert.equal(incrementoPadrao('tempo'), null);
    assert.equal(incrementoPadrao('peso_corporal'), null);
    assert.equal(incrementoPadrao('distancia'), null);
  });
});

describe('cargaCompativel', () => {
  it('exercício com carga EXIGE carga: ausente é dado perdido, não peso corporal', () => {
    const supino = exercicio('carga_kg');
    assert.equal(cargaCompativel(supino, kg(40000)), true);
    assert.equal(cargaCompativel(supino, null), false);
  });

  it('peso corporal, tempo e distância só aceitam ausência de carga', () => {
    const abdominal = exercicio('peso_corporal');
    assert.equal(cargaCompativel(abdominal, null), true);
    assert.equal(cargaCompativel(abdominal, kg(1000)), false);
    assert.equal(cargaCompativel(exercicio('tempo'), null), true);
    assert.equal(cargaCompativel(exercicio('distancia'), kg(1000)), false);
  });
});

describe('emGramas', () => {
  it('kg passa direto', () => {
    assert.equal(emGramas(exercicio('carga_kg'), kg(42500)), 42500);
  });

  it('carga ausente, ou carga onde não cabe carga, não vira número', () => {
    assert.equal(emGramas(exercicio('carga_kg'), null), null);
    assert.equal(emGramas(exercicio('peso_corporal'), kg(40000)), null);
    assert.equal(emGramas(exercicio('peso_corporal'), null), null);
  });
});

describe('medidoPorTempo', () => {
  it('tempo e distância medem duração; os três restantes, não', () => {
    assert.equal(medidoPorTempo('tempo'), true);
    // `distancia` anda junto de `tempo` porque `series` não tem coluna de
    // distância: sem isso a sugestão sairia com carga, reps e duração nulas.
    assert.equal(medidoPorTempo('distancia'), true);
    assert.equal(medidoPorTempo('carga_kg'), false);
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
    assert.deepEqual(rotulos, ['kg', 'peso do corpo', 'tempo', 'distância']);
    assert.equal(new Set(rotulos).size, TIPOS_MEDICAO.length);
  });
});
