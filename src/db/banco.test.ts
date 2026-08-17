/**
 * Prova que o caminho inteiro funciona contra SQLite de verdade: migration real,
 * escrita pelas mutations, leitura pelas queries, conta pelo domínio.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { volumeTotal } from '../dominio/volume.ts';
import { criarBancoDeTeste, type BancoDeTeste } from './banco-de-teste.ts';
import {
  arquivarExercicio,
  criarExercicio,
  finalizarSessao,
  iniciarSessao,
  registrarMedida,
  registrarPesagem,
  registrarSerie,
} from './mutations.ts';
import {
  historicoMedidas,
  historicoPeso,
  listarExercicios,
  seriesDaSessao,
  seriesDoExercicio,
  sessaoEmAndamento,
} from './queries.ts';

let banco: BancoDeTeste;

beforeEach(() => {
  banco = criarBancoDeTeste();
});

describe('migration inicial', () => {
  it('cria as oito tabelas do schema', () => {
    const tabelas = banco.bruto
      .prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%'")
      .all()
      .map((linha) => (linha as { name: string }).name);

    for (const esperada of [
      'exercicios',
      'treinos',
      'treino_exercicios',
      'sessoes',
      'series',
      'pesagens',
      'medidas',
      'preferencias',
    ]) {
      assert.ok(tabelas.includes(esperada), `faltou a tabela ${esperada}`);
    }
  });
});

describe('sessão de treino', () => {
  it('registra séries e devolve o volume da sessão', () => {
    const supino = criarExercicio({ nome: 'Supino reto', grupoMuscular: 'Peito' });
    const sessao = iniciarSessao({ nome: 'Treino A' });

    registrarSerie({ sessaoId: sessao, exercicioId: supino, indice: 0, tipo: 'aquecimento', cargaG: 20000, repeticoes: 15 });
    registrarSerie({ sessaoId: sessao, exercicioId: supino, indice: 1, cargaG: 40000, repeticoes: 10 });
    registrarSerie({ sessaoId: sessao, exercicioId: supino, indice: 2, cargaG: 40000, repeticoes: 8 });

    const registradas = seriesDaSessao(sessao);
    assert.equal(registradas.length, 3);
    assert.equal(volumeTotal(registradas), 40000 * 18);
  });

  it('sessão sem finalizar é a sessão em andamento; finalizada não é', () => {
    const sessao = iniciarSessao({ nome: 'Treino B' });
    assert.equal(sessaoEmAndamento()?.id, sessao);

    banco.avancarRelogio(60 * 60 * 1000);
    finalizarSessao(sessao);
    assert.equal(sessaoEmAndamento(), undefined);
  });

  it('recusa duas séries com o mesmo índice — duplo toque no botão', () => {
    const ex = criarExercicio({ nome: 'Remada' });
    const sessao = iniciarSessao({ nome: 'Treino C' });
    registrarSerie({ sessaoId: sessao, exercicioId: ex, indice: 0, cargaG: 30000, repeticoes: 10 });

    assert.throws(() =>
      registrarSerie({ sessaoId: sessao, exercicioId: ex, indice: 0, cargaG: 30000, repeticoes: 10 })
    );
  });

  it('série sem carga (peso corporal) grava com carga nula, não zero', () => {
    const barra = criarExercicio({ nome: 'Barra fixa', tipoMedicao: 'peso_corporal' });
    const sessao = iniciarSessao({ nome: 'Treino D' });
    registrarSerie({ sessaoId: sessao, exercicioId: barra, indice: 0, repeticoes: 8 });

    assert.equal(seriesDaSessao(sessao)[0].cargaG, null);
  });
});

describe('soft delete', () => {
  it('exercício arquivado some da lista mas mantém o histórico de séries', () => {
    const ex = criarExercicio({ nome: 'Rosca direta' });
    const sessao = iniciarSessao({ nome: 'Treino E' });
    registrarSerie({ sessaoId: sessao, exercicioId: ex, indice: 0, cargaG: 15000, repeticoes: 12 });

    arquivarExercicio(ex);

    assert.equal(listarExercicios().length, 0);
    assert.equal(seriesDoExercicio(ex).length, 1);
  });
});

describe('corpo', () => {
  it('guarda pesagem e medida na menor unidade, em ordem cronológica', () => {
    registrarPesagem(78400);
    banco.avancarRelogio(24 * 60 * 60 * 1000);
    registrarPesagem(78100);
    registrarMedida('braco_direito', 385);

    const pesos = historicoPeso();
    assert.deepEqual(pesos.map((p) => p.pesoG), [78400, 78100]);
    assert.equal(historicoMedidas()[0].parte, 'braco_direito');
    assert.equal(historicoMedidas()[0].valorMm, 385);
  });
});
