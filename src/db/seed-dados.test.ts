/**
 * O conteúdo do seed, sem abrir banco: são dados, e dado errado aqui vira
 * catálogo errado no aparelho dele, digitado uma vez e para sempre.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EXERCICIOS_INICIAIS, SEED_VERSAO, TREINOS_INICIAIS } from './seed-dados.ts';

const TODOS_OS_ITENS = TREINOS_INICIAIS.flatMap((t) => t.itens);
const PORTIPO = (t: string) => EXERCICIOS_INICIAIS.filter((e) => e.tipoMedicao === t);

function exercicioDoItem(exercicioId: string) {
  const ex = EXERCICIOS_INICIAIS.find((e) => e.id === exercicioId);
  assert.ok(ex, `item aponta para exercício inexistente: ${exercicioId}`);
  return ex;
}

describe('catálogo do seed', () => {
  it('tem os 24 exercícios da ficha, com id e nome únicos', () => {
    assert.equal(EXERCICIOS_INICIAIS.length, 24);
    assert.equal(new Set(EXERCICIOS_INICIAIS.map((e) => e.id)).size, 24);
    assert.equal(new Set(EXERCICIOS_INICIAIS.map((e) => e.nome)).size, 24);
  });

  it('distribui 13 placa / 8 kg / 2 peso corporal / 1 tempo', () => {
    assert.equal(PORTIPO('carga_placa').length, 13);
    assert.equal(PORTIPO('carga_kg').length, 8);
    assert.equal(PORTIPO('peso_corporal').length, 2);
    assert.equal(PORTIPO('tempo').length, 1);
    assert.equal(PORTIPO('distancia').length, 0);
  });

  it('tem incremento exatamente nos exercícios com carga — nos dois sentidos', () => {
    for (const ex of EXERCICIOS_INICIAIS) {
      const comCarga = ex.tipoMedicao === 'carga_kg' || ex.tipoMedicao === 'carga_placa';
      if (comCarga) {
        assert.ok(ex.incremento !== null && ex.incremento > 0, `${ex.nome} sem incremento`);
      } else {
        assert.equal(ex.incremento, null, `${ex.nome} não devia ter incremento`);
      }
    }
  });

  it('respeita o CHECK do schema: incremento de placa entre 1 e 5', () => {
    // `ck_exercicios_incremento` recusa a linha no banco; falhar aqui é falhar
    // em milissegundos em vez de no boot do aparelho.
    for (const ex of PORTIPO('carga_placa')) {
      assert.ok(ex.incremento! >= 1 && ex.incremento! <= 5, `${ex.nome}: ${ex.incremento}`);
    }
  });

  it('todo exercício tem grupo muscular e equipamento preenchidos', () => {
    for (const ex of EXERCICIOS_INICIAIS) {
      assert.ok(ex.grupoMuscular.length > 0, `${ex.nome} sem grupo muscular`);
      assert.ok(ex.equipamento.length > 0, `${ex.nome} sem equipamento`);
    }
  });
});

describe('fichas do seed', () => {
  it('são três treinos de oito itens, ordenados e com ids únicos', () => {
    assert.deepEqual(
      TREINOS_INICIAIS.map((t) => [t.nome, t.ordem]),
      [
        ['Treino A', 0],
        ['Treino B', 1],
        ['Treino C', 2],
      ]
    );
    for (const t of TREINOS_INICIAIS) {
      assert.equal(t.itens.length, 8, `${t.nome} não tem 8 itens`);
      assert.deepEqual(
        t.itens.map((i) => i.ordem),
        [0, 1, 2, 3, 4, 5, 6, 7]
      );
    }
    assert.equal(new Set(TODOS_OS_ITENS.map((i) => i.id)).size, 24);
  });

  it('cada exercício do catálogo aparece em exatamente um item', () => {
    const usados = TODOS_OS_ITENS.map((i) => i.exercicioId);
    assert.equal(new Set(usados).size, 24);
    for (const id of usados) exercicioDoItem(id);
  });

  it('tem carga-alvo exatamente onde o exercício tem carga', () => {
    for (const item of TODOS_OS_ITENS) {
      const ex = exercicioDoItem(item.exercicioId);
      const comCarga = ex.tipoMedicao === 'carga_kg' || ex.tipoMedicao === 'carga_placa';
      if (comCarga) {
        // Alvo é o que faz o um-toque existir na ESTREIA: sem ele a primeira
        // sessão de cada exercício pede digitação.
        assert.ok(item.cargaAlvo !== null && item.cargaAlvo > 0, `${ex.nome} sem carga-alvo`);
      } else {
        // NULL, nunca 0 — zero seria "levantou zero".
        assert.equal(item.cargaAlvo, null, `${ex.nome} não devia ter carga-alvo`);
      }
    }
  });

  it('Esteira é tempo: 1 série de 600 s, sem reps e sem carga', () => {
    const esteira = TODOS_OS_ITENS.find((i) => i.exercicioId === 'seed-ex-esteira');
    assert.ok(esteira);
    assert.equal(exercicioDoItem(esteira.exercicioId).tipoMedicao, 'tempo');
    assert.equal(esteira.seriesAlvo, 1);
    assert.equal(esteira.duracaoAlvoS, 600);
    assert.equal(esteira.repsAlvoMin, null);
    assert.equal(esteira.repsAlvoMax, null);
    assert.equal(esteira.cargaAlvo, null);
  });

  it('só a Esteira tem duração-alvo', () => {
    const comDuracao = TODOS_OS_ITENS.filter((i) => i.duracaoAlvoS !== null);
    assert.deepEqual(
      comDuracao.map((i) => i.exercicioId),
      ['seed-ex-esteira']
    );
  });

  it('os abdominais são peso corporal, 4×12', () => {
    for (const id of ['seed-ex-abdominal-supra-solo', 'seed-ex-abdominal-infra-solo']) {
      assert.equal(exercicioDoItem(id).tipoMedicao, 'peso_corporal');
      const item = TODOS_OS_ITENS.find((i) => i.exercicioId === id);
      assert.ok(item);
      assert.equal(item.seriesAlvo, 4);
      assert.equal(item.repsAlvoMax, 12);
      assert.equal(item.cargaAlvo, null);
    }
  });

  it('Facepull é o único 3×10 da ficha inteira', () => {
    const tres = TODOS_OS_ITENS.filter((i) => i.seriesAlvo === 3);
    assert.deepEqual(
      tres.map((i) => i.exercicioId),
      ['seed-ex-facepull']
    );
    assert.equal(TODOS_OS_ITENS.filter((i) => i.seriesAlvo === 4).length, 22);
  });

  it('respeita os CHECKs do schema: séries > 0, faixa de reps coerente, descanso positivo', () => {
    for (const item of TODOS_OS_ITENS) {
      assert.ok(item.seriesAlvo > 0, `${item.id}: seriesAlvo`);
      assert.ok(item.descansoS > 0, `${item.id}: descansoS`);
      if (item.repsAlvoMin !== null && item.repsAlvoMax !== null) {
        assert.ok(item.repsAlvoMax >= item.repsAlvoMin, `${item.id}: faixa de reps invertida`);
      }
      assert.ok(item.duracaoAlvoS === null || item.duracaoAlvoS > 0, `${item.id}: duracaoAlvoS`);
    }
  });
});

describe('estabilidade dos ids', () => {
  it('a versão do seed é 1', () => {
    assert.equal(SEED_VERSAO, 1);
  });

  /**
   * ESTE TESTE FICAR VERMELHO NÃO É PARA SER "ATUALIZADO" SEM PENSAR.
   *
   * Id de seed é para sempre: mudar `seed-ex-peck-deck` depois de instalado não
   * renomeia nada no aparelho — cria um SEGUNDO Peck Deck e divide o histórico
   * em dois. Nome se edita na tela; id, não. Se este snapshot quebrou, ou você
   * renomeou um id (não faça) ou está subindo o SEED_VERSAO com um catálogo novo
   * (aí some com o id só se ele nunca esteve num aparelho).
   */
  it('snapshot dos ids de exercício', () => {
    assert.deepEqual(
      EXERCICIOS_INICIAIS.map((e) => e.id),
      [
        'seed-ex-remada-alta-barra',
        'seed-ex-remada-baixa-barra',
        'seed-ex-peck-dorsal',
        'seed-ex-facepull',
        'seed-ex-rosca-martelo-polia',
        'seed-ex-rosca-direta-polia',
        'seed-ex-elevacao-lateral-halter',
        'seed-ex-abdominal-supra-solo',
        'seed-ex-seated-leg-press',
        'seed-ex-smith-press',
        'seed-ex-cadeira-extensora',
        'seed-ex-cadeira-flexora',
        'seed-ex-leg-press',
        'seed-ex-panturrilha',
        'seed-ex-cadeira-abdutora',
        'seed-ex-esteira',
        'seed-ex-supino-inclinado-barra',
        'seed-ex-supino-maquina',
        'seed-ex-peck-deck',
        'seed-ex-paralela-articulada',
        'seed-ex-desenvolvimento-articulado',
        'seed-ex-elevacao-frontal-halteres',
        'seed-ex-triceps-frances-halter',
        'seed-ex-abdominal-infra-solo',
      ]
    );
  });

  it('snapshot dos ids de treino e de item', () => {
    assert.deepEqual(
      TREINOS_INICIAIS.map((t) => t.id),
      ['seed-tr-a', 'seed-tr-b', 'seed-tr-c']
    );
    assert.deepEqual(
      TODOS_OS_ITENS.map((i) => i.id),
      [
        'seed-te-a-01',
        'seed-te-a-02',
        'seed-te-a-03',
        'seed-te-a-04',
        'seed-te-a-05',
        'seed-te-a-06',
        'seed-te-a-07',
        'seed-te-a-08',
        'seed-te-b-01',
        'seed-te-b-02',
        'seed-te-b-03',
        'seed-te-b-04',
        'seed-te-b-05',
        'seed-te-b-06',
        'seed-te-b-07',
        'seed-te-b-08',
        'seed-te-c-01',
        'seed-te-c-02',
        'seed-te-c-03',
        'seed-te-c-04',
        'seed-te-c-05',
        'seed-te-c-06',
        'seed-te-c-07',
        'seed-te-c-08',
      ]
    );
  });
});
