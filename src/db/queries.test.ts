/**
 * As leituras contra SQLite de verdade, com a migration real.
 *
 * As fixtures escrevem com `db.insert` em vez de passar por `mutations.ts`, ao
 * contrário do resto do app. É deliberado e vale só aqui: o que está sob teste é
 * a CONSULTA, e amarrá-la às mutations faria um teste de leitura falhar por
 * mudança de escrita. Quem prova que as duas pontas se encaixam é `banco.test.ts`.
 * As colunas usadas abaixo vêm de `schema.ts`, então os CHECKs continuam valendo.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';

import { kg, placa } from '../dominio/carga.ts';
import { volumeDaSessao } from '../dominio/volume.ts';
import { criarBancoDeTeste } from './banco-de-teste.ts';
import { db } from './conexao.ts';
import {
  historicoDoExercicio,
  historicoMedidas,
  historicoPeso,
  indicesOcupados,
  itensDoTreino,
  listarExercicios,
  obterExercicio,
  obterPerfil,
  planoDaSessao,
  preferencia,
  seriesDaSessao,
  seriesDaSessaoComExercicio,
  seriesDoExercicio,
  sessoesFinalizadas,
  ultimaPesagem,
  ultimaSessaoDoExercicio,
} from './queries.ts';
import {
  exercicios,
  medidas,
  perfil,
  pesagens,
  preferencias,
  series,
  sessoes,
  treinoExercicios,
  treinos,
  type ParteCorpo,
  type TipoMedicao,
  type TipoSerie,
} from './schema.ts';

const T = Date.UTC(2026, 0, 5, 10, 0, 0);
const DIA = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

// ── Fixtures ──────────────────────────────────────────────────────────────

function exercicio(d: {
  id: string;
  nome: string;
  tipoMedicao: TipoMedicao;
  gramasPorPlaca?: number;
  grupoMuscular?: string;
  arquivadoEm?: number;
}) {
  // O incremento segue o tipo porque `ck_exercicios_incremento` exige: kg em
  // gramas, placa em placas, nenhum nos demais.
  const incremento =
    d.tipoMedicao === 'carga_kg'
      ? { incrementoG: 2500 }
      : d.tipoMedicao === 'carga_placa'
        ? { incrementoPlacas: 1 }
        : {};
  db.insert(exercicios)
    .values({ criadoEm: T, atualizadoEm: T, ...incremento, ...d })
    .run();
  return d.id;
}

function sessao(d: {
  id: string;
  nome: string;
  iniciadaEm: number;
  finalizadaEm?: number;
  treinoId?: string;
  arquivadoEm?: number;
}) {
  db.insert(sessoes)
    .values({ criadoEm: d.iniciadaEm, atualizadoEm: d.iniciadaEm, ...d })
    .run();
  return d.id;
}

function serie(d: {
  id: string;
  sessaoId: string;
  exercicioId: string;
  indice: number;
  concluidaEm: number;
  tipo?: TipoSerie;
  cargaG?: number;
  cargaPlacas?: number;
  repeticoes?: number;
  duracaoS?: number;
  arquivadoEm?: number;
}) {
  db.insert(series)
    .values({ criadoEm: d.concluidaEm, atualizadoEm: d.concluidaEm, ...d })
    .run();
  return d.id;
}

function treino(d: { id: string; nome: string; ordem?: number }) {
  db.insert(treinos)
    .values({ criadoEm: T, atualizadoEm: T, ...d })
    .run();
  return d.id;
}

function item(d: {
  id: string;
  treinoId: string;
  exercicioId: string;
  ordem: number;
  seriesAlvo?: number;
  repsAlvoMin?: number;
  repsAlvoMax?: number;
  cargaAlvoG?: number;
  cargaAlvoPlacas?: number;
  duracaoAlvoS?: number;
  descansoS?: number;
  arquivadoEm?: number;
}) {
  db.insert(treinoExercicios)
    .values({ criadoEm: T, atualizadoEm: T, ...d })
    .run();
  return d.id;
}

function pesagem(d: { id: string; pesoG: number; medidoEm: number; arquivadoEm?: number }) {
  db.insert(pesagens)
    .values({ criadoEm: T, atualizadoEm: T, ...d })
    .run();
}

function medida(d: { id: string; parte: ParteCorpo; valorMm: number; medidoEm: number }) {
  db.insert(medidas)
    .values({ criadoEm: T, atualizadoEm: T, ...d })
    .run();
}

beforeEach(() => {
  criarBancoDeTeste();
});

// ── Catálogo ──────────────────────────────────────────────────────────────

describe('catálogo', () => {
  it('lê o incremento pela coluna em que ele mora e esconde o arquivado', () => {
    exercicio({ id: 'ex-supino', nome: 'Supino inclinado', tipoMedicao: 'carga_kg' });
    exercicio({ id: 'ex-peck', nome: 'Peck dorsal', tipoMedicao: 'carga_placa' });
    exercicio({ id: 'ex-abd', nome: 'Abdominal supra', tipoMedicao: 'peso_corporal' });
    exercicio({ id: 'ex-velho', nome: 'A esquecer', tipoMedicao: 'carga_kg', arquivadoEm: T });

    const lista = listarExercicios();

    assert.deepEqual(
      lista.map((e) => e.nome),
      ['Abdominal supra', 'Peck dorsal', 'Supino inclinado']
    );
    assert.deepEqual(lista[1].incremento, placa(1));
    assert.deepEqual(lista[2].incremento, kg(2500));
    assert.equal(lista[0].incremento, null);
  });

  it('obterExercicio devolve o arquivado — é dele o histórico que a tela ainda mostra', () => {
    exercicio({ id: 'ex-velho', nome: 'Facepull', tipoMedicao: 'carga_placa', arquivadoEm: T });

    assert.equal(obterExercicio('ex-velho')?.nome, 'Facepull');
    assert.equal(obterExercicio('ex-velho')?.arquivadoEm, T);
    assert.equal(obterExercicio('nao-existe'), undefined);
  });
});

// ── Séries da sessão ──────────────────────────────────────────────────────

describe('séries da sessão', () => {
  beforeEach(() => {
    exercicio({ id: 'ex-kg', nome: 'Supino', tipoMedicao: 'carga_kg' });
    exercicio({ id: 'ex-placa', nome: 'Peck', tipoMedicao: 'carga_placa', gramasPorPlaca: 5000 });
    exercicio({ id: 'ex-corpo', nome: 'Abdominal', tipoMedicao: 'peso_corporal' });
    sessao({ id: 's1', nome: 'Treino A', iniciadaEm: T });
  });

  it('a coluna onde o número mora vira a unidade da Carga', () => {
    serie({ id: 'a', sessaoId: 's1', exercicioId: 'ex-kg', indice: 0, cargaG: 42500, repeticoes: 10, concluidaEm: T + MIN });
    serie({ id: 'b', sessaoId: 's1', exercicioId: 'ex-placa', indice: 0, cargaPlacas: 5, repeticoes: 12, concluidaEm: T + 2 * MIN });
    serie({ id: 'c', sessaoId: 's1', exercicioId: 'ex-corpo', indice: 0, repeticoes: 15, concluidaEm: T + 3 * MIN });

    const feitas = seriesDaSessao('s1');

    assert.deepEqual(
      feitas.map((s) => s.carga),
      [kg(42500), placa(5), null]
    );
  });

  it('ignora série arquivada e devolve em ordem cronológica', () => {
    serie({ id: 'b', sessaoId: 's1', exercicioId: 'ex-kg', indice: 1, cargaG: 40000, repeticoes: 10, concluidaEm: T + 5 * MIN });
    serie({ id: 'a', sessaoId: 's1', exercicioId: 'ex-kg', indice: 0, cargaG: 40000, repeticoes: 10, concluidaEm: T + MIN });
    serie({ id: 'x', sessaoId: 's1', exercicioId: 'ex-kg', indice: 2, cargaG: 40000, repeticoes: 10, concluidaEm: T + 9 * MIN, arquivadoEm: T + 10 * MIN });

    assert.deepEqual(
      seriesDaSessao('s1').map((s) => s.id),
      ['a', 'b']
    );
  });

  it('traz nome, tipo e calibração junto — inclusive de exercício arquivado depois', () => {
    serie({ id: 'a', sessaoId: 's1', exercicioId: 'ex-placa', indice: 0, cargaPlacas: 5, repeticoes: 12, concluidaEm: T + MIN });
    db.update(exercicios).set({ arquivadoEm: T + DIA }).where(eq(exercicios.id, 'ex-placa')).run();

    const [s] = seriesDaSessaoComExercicio('s1');

    assert.equal(s.exercicioNome, 'Peck');
    assert.equal(s.tipoMedicao, 'carga_placa');
    assert.equal(s.gramasPorPlaca, 5000);
    assert.deepEqual(s.carga, placa(5));
  });
});

// ── Índices ───────────────────────────────────────────────────────────────

describe('índices ocupados', () => {
  it('conta a série arquivada — o UNIQUE do banco também não a libera', () => {
    exercicio({ id: 'ex', nome: 'Remada', tipoMedicao: 'carga_placa' });
    sessao({ id: 's1', nome: 'Treino A', iniciadaEm: T });
    serie({ id: 'a', sessaoId: 's1', exercicioId: 'ex', indice: 0, cargaPlacas: 5, repeticoes: 10, concluidaEm: T + MIN });
    serie({ id: 'b', sessaoId: 's1', exercicioId: 'ex', indice: 1, cargaPlacas: 5, repeticoes: 10, concluidaEm: T + 2 * MIN });
    serie({ id: 'c', sessaoId: 's1', exercicioId: 'ex', indice: 2, cargaPlacas: 5, repeticoes: 10, concluidaEm: T + 3 * MIN, arquivadoEm: T + 4 * MIN });

    assert.deepEqual(indicesOcupados('s1', 'ex'), [0, 1, 2]);
    assert.equal(seriesDaSessao('s1').length, 2);
  });
});

// ── Sessão anterior ───────────────────────────────────────────────────────

describe('última sessão do exercício', () => {
  beforeEach(() => {
    exercicio({ id: 'ex', nome: 'Remada alta', tipoMedicao: 'carga_placa' });
    sessao({ id: 'antiga', nome: 'Treino A', iniciadaEm: T - 7 * DIA, finalizadaEm: T - 7 * DIA + MIN });
    sessao({ id: 'anterior', nome: 'Treino A', iniciadaEm: T - DIA, finalizadaEm: T - DIA + MIN });
    sessao({ id: 'hoje', nome: 'Treino A', iniciadaEm: T });
  });

  it('devolve a sessão anterior por índice, ignorando a de hoje', () => {
    serie({ id: 'v0', sessaoId: 'antiga', exercicioId: 'ex', indice: 0, cargaPlacas: 4, repeticoes: 10, concluidaEm: T - 7 * DIA });
    // Fora de ordem de propósito: quem casa por índice não pode depender da ordem de inserção.
    serie({ id: 'a3', sessaoId: 'anterior', exercicioId: 'ex', indice: 3, cargaPlacas: 5, repeticoes: 8, concluidaEm: T - DIA + 3 * MIN });
    serie({ id: 'a0', sessaoId: 'anterior', exercicioId: 'ex', indice: 0, cargaPlacas: 6, repeticoes: 10, concluidaEm: T - DIA });
    serie({ id: 'a1', sessaoId: 'anterior', exercicioId: 'ex', indice: 1, cargaPlacas: 6, repeticoes: 10, concluidaEm: T - DIA + MIN });
    serie({ id: 'a2', sessaoId: 'anterior', exercicioId: 'ex', indice: 2, cargaPlacas: 5, repeticoes: 9, concluidaEm: T - DIA + 2 * MIN });
    serie({ id: 'h0', sessaoId: 'hoje', exercicioId: 'ex', indice: 0, cargaPlacas: 6, repeticoes: 10, concluidaEm: T });

    const anterior = ultimaSessaoDoExercicio('ex', 'hoje');

    assert.deepEqual(
      anterior.map((s) => s.carga),
      [placa(6), placa(6), placa(5), placa(5)]
    );
  });

  it('exercício sem histórico devolve lista vazia', () => {
    assert.deepEqual(ultimaSessaoDoExercicio('ex', 'hoje'), []);
  });

  it('pula sessão arquivada', () => {
    db.update(sessoes).set({ arquivadoEm: T }).where(eq(sessoes.id, 'anterior')).run();
    serie({ id: 'v0', sessaoId: 'antiga', exercicioId: 'ex', indice: 0, cargaPlacas: 4, repeticoes: 10, concluidaEm: T - 7 * DIA });
    serie({ id: 'a0', sessaoId: 'anterior', exercicioId: 'ex', indice: 0, cargaPlacas: 6, repeticoes: 10, concluidaEm: T - DIA });

    assert.deepEqual(
      ultimaSessaoDoExercicio('ex', 'hoje').map((s) => s.carga),
      [placa(4)]
    );
  });
});

// ── Ficha ─────────────────────────────────────────────────────────────────

describe('itens do treino', () => {
  it('mapeia carga-alvo nas duas unidades, em ordem, sem item nem exercício arquivado', () => {
    exercicio({ id: 'ex-placa', nome: 'Remada alta', tipoMedicao: 'carga_placa' });
    exercicio({ id: 'ex-kg', nome: 'Seated leg press', tipoMedicao: 'carga_kg' });
    exercicio({ id: 'ex-tempo', nome: 'Esteira', tipoMedicao: 'tempo' });
    exercicio({ id: 'ex-fora', nome: 'Facepull', tipoMedicao: 'carga_placa', arquivadoEm: T });
    treino({ id: 'tr-a', nome: 'Treino A' });
    item({ id: 'it-2', treinoId: 'tr-a', exercicioId: 'ex-kg', ordem: 2, seriesAlvo: 4, repsAlvoMin: 8, repsAlvoMax: 10, cargaAlvoG: 20000 });
    item({ id: 'it-1', treinoId: 'tr-a', exercicioId: 'ex-placa', ordem: 1, seriesAlvo: 4, repsAlvoMax: 10, cargaAlvoPlacas: 5 });
    item({ id: 'it-3', treinoId: 'tr-a', exercicioId: 'ex-tempo', ordem: 3, seriesAlvo: 1, duracaoAlvoS: 600 });
    item({ id: 'it-x', treinoId: 'tr-a', exercicioId: 'ex-kg', ordem: 4, arquivadoEm: T });
    item({ id: 'it-y', treinoId: 'tr-a', exercicioId: 'ex-fora', ordem: 5 });

    const itens = itensDoTreino('tr-a');

    assert.deepEqual(
      itens.map((i) => i.itemId),
      ['it-1', 'it-2', 'it-3']
    );
    assert.deepEqual(itens[0].cargaAlvo, placa(5));
    assert.deepEqual(itens[1].cargaAlvo, kg(20000));
    assert.equal(itens[2].cargaAlvo, null);
    assert.equal(itens[2].duracaoAlvoS, 600);
    assert.equal(itens[2].descansoS, 90);
    assert.deepEqual(itens[0].exercicio.incremento, placa(1));
  });
});

// ── Histórico do exercício ────────────────────────────────────────────────

describe('histórico do exercício', () => {
  beforeEach(() => {
    exercicio({ id: 'ex', nome: 'Rosca direta', tipoMedicao: 'carga_kg' });
    sessao({ id: 's1', nome: 'Treino C', iniciadaEm: T, finalizadaEm: T + MIN });
  });

  it('exercício arquivado mantém o histórico inteiro — a regra do soft delete', () => {
    serie({ id: 'a', sessaoId: 's1', exercicioId: 'ex', indice: 0, cargaG: 15000, repeticoes: 12, concluidaEm: T });
    db.update(exercicios).set({ arquivadoEm: T + DIA }).where(eq(exercicios.id, 'ex')).run();

    const h = historicoDoExercicio('ex');

    assert.equal(listarExercicios().length, 0);
    assert.equal(h?.series.length, 1);
    assert.equal(h?.exercicio.arquivadoEm, T + DIA);
  });

  it('o limite traz as MAIS RECENTES, devolvidas em ordem crescente', () => {
    for (let i = 0; i < 5; i++) {
      serie({ id: `s${i}`, sessaoId: 's1', exercicioId: 'ex', indice: i, cargaG: 10000 + i * 1000, repeticoes: 10, concluidaEm: T + i * DIA });
    }

    assert.deepEqual(
      seriesDoExercicio('ex', 2).map((s) => s.carga),
      [kg(13000), kg(14000)]
    );
    assert.equal(seriesDoExercicio('ex').length, 5);
  });

  it('id inexistente devolve null, não um contêiner vazio', () => {
    assert.equal(historicoDoExercicio('nao-existe'), null);
  });
});

// ── Histórico de sessões ──────────────────────────────────────────────────

describe('sessões finalizadas', () => {
  it('soma kg, converte placa calibrada e deixa de fora aquecimento e placa sem calibração', () => {
    exercicio({ id: 'ex-kg', nome: 'Supino', tipoMedicao: 'carga_kg' });
    exercicio({ id: 'ex-cal', nome: 'Peck', tipoMedicao: 'carga_placa', gramasPorPlaca: 5000 });
    exercicio({ id: 'ex-cru', nome: 'Remada', tipoMedicao: 'carga_placa' });
    exercicio({ id: 'ex-corpo', nome: 'Abdominal', tipoMedicao: 'peso_corporal' });
    sessao({ id: 's1', nome: 'Treino A', iniciadaEm: T, finalizadaEm: T + 60 * MIN });

    serie({ id: 'q', sessaoId: 's1', exercicioId: 'ex-kg', indice: 0, tipo: 'aquecimento', cargaG: 20000, repeticoes: 15, concluidaEm: T });
    serie({ id: 'a', sessaoId: 's1', exercicioId: 'ex-kg', indice: 1, cargaG: 40000, repeticoes: 10, concluidaEm: T + MIN });
    serie({ id: 'b', sessaoId: 's1', exercicioId: 'ex-cal', indice: 0, cargaPlacas: 5, repeticoes: 10, concluidaEm: T + 2 * MIN });
    serie({ id: 'c', sessaoId: 's1', exercicioId: 'ex-cru', indice: 0, cargaPlacas: 5, repeticoes: 10, concluidaEm: T + 3 * MIN });
    serie({ id: 'd', sessaoId: 's1', exercicioId: 'ex-corpo', indice: 0, repeticoes: 12, concluidaEm: T + 4 * MIN });

    const [resumo] = sessoesFinalizadas();

    assert.equal(resumo.gramasReps, 40000 * 10 + 5 * 5000 * 10);
    assert.equal(resumo.totalSeries, 5);
    assert.equal(resumo.finalizadaEm, T + 60 * MIN);
    // Só a parcela do Peck: é ela que obriga o til na lista. A placa SEM
    // calibração não entra em lugar nenhum — nem no total, nem aqui.
    assert.equal(resumo.gramasRepsAproximados, 5 * 5000 * 10);

    // A consulta tem que dar o MESMO número que o domínio, senão a lista mostra
    // um volume e abrir a sessão mostra outro.
    const doDominio = volumeDaSessao(seriesDaSessaoComExercicio('s1'));
    assert.equal(resumo.gramasReps, doDominio.gramasReps);
    assert.equal(resumo.gramasRepsAproximados, doDominio.gramasRepsAproximados);
  });

  it('sessão só de kg tem aproximado ZERO — o til não aparece onde não há conversão', () => {
    exercicio({ id: 'ex-kg', nome: 'Supino', tipoMedicao: 'carga_kg' });
    sessao({ id: 's1', nome: 'Treino A', iniciadaEm: T, finalizadaEm: T + MIN });
    serie({ id: 'a', sessaoId: 's1', exercicioId: 'ex-kg', indice: 0, cargaG: 40000, repeticoes: 10, concluidaEm: T });

    const [resumo] = sessoesFinalizadas();
    assert.equal(resumo.gramasReps, 400000);
    assert.equal(resumo.gramasRepsAproximados, 0);
  });

  it('calibrar a placa muda o volume do histórico sem tocar em nenhuma série', () => {
    exercicio({ id: 'ex', nome: 'Peck', tipoMedicao: 'carga_placa' });
    sessao({ id: 's1', nome: 'Treino A', iniciadaEm: T, finalizadaEm: T + MIN });
    serie({ id: 'a', sessaoId: 's1', exercicioId: 'ex', indice: 0, cargaPlacas: 5, repeticoes: 10, concluidaEm: T });

    assert.equal(sessoesFinalizadas()[0].gramasReps, 0);

    db.update(exercicios).set({ gramasPorPlaca: 5000 }).where(eq(exercicios.id, 'ex')).run();

    assert.equal(sessoesFinalizadas()[0].gramasReps, 250000);
    assert.deepEqual(seriesDaSessao('s1')[0].carga, placa(5));
  });

  it('lista só as finalizadas e não arquivadas, da mais recente para a mais antiga', () => {
    sessao({ id: 'velha', nome: 'Treino A', iniciadaEm: T - 2 * DIA, finalizadaEm: T - 2 * DIA + MIN });
    sessao({ id: 'nova', nome: 'Treino B', iniciadaEm: T - DIA, finalizadaEm: T - DIA + MIN });
    sessao({ id: 'lixo', nome: 'Treino C', iniciadaEm: T - 3 * DIA, finalizadaEm: T - 3 * DIA + MIN, arquivadoEm: T });
    sessao({ id: 'aberta', nome: 'Treino A', iniciadaEm: T });

    assert.deepEqual(
      sessoesFinalizadas().map((s) => s.id),
      ['nova', 'velha']
    );
    assert.deepEqual(
      sessoesFinalizadas(1).map((s) => s.id),
      ['nova']
    );
  });
});

// ── Plano da sessão ───────────────────────────────────────────────────────

describe('plano da sessão', () => {
  it('sessão inexistente devolve null', () => {
    assert.equal(planoDaSessao('nao-existe'), null);
  });

  it('monta a ficha inteira a partir do id da sessão', () => {
    exercicio({ id: 'ex-placa', nome: 'Remada alta', tipoMedicao: 'carga_placa' });
    exercicio({ id: 'ex-kg', nome: 'Supino', tipoMedicao: 'carga_kg' });
    treino({ id: 'tr-a', nome: 'Treino A' });
    item({ id: 'it-1', treinoId: 'tr-a', exercicioId: 'ex-placa', ordem: 1, seriesAlvo: 4, repsAlvoMax: 10, cargaAlvoPlacas: 5 });
    item({ id: 'it-2', treinoId: 'tr-a', exercicioId: 'ex-kg', ordem: 2, seriesAlvo: 3, repsAlvoMax: 12, cargaAlvoG: 40000 });
    sessao({ id: 's1', nome: 'Treino A', iniciadaEm: T, treinoId: 'tr-a' });
    serie({ id: 'a', sessaoId: 's1', exercicioId: 'ex-placa', indice: 0, cargaPlacas: 6, repeticoes: 10, concluidaEm: T + MIN });

    const plano = planoDaSessao('s1');

    assert.equal(plano?.sessao.nome, 'Treino A');
    assert.deepEqual(plano?.itens.map((i) => i.itemId), ['it-1', 'it-2']);
    assert.equal(plano?.itens[0].feitas.length, 1);
    assert.deepEqual(plano?.itens[0].exercicio.incremento, placa(1));
  });

  it('exercício feito FORA da ficha entra no fim do plano, e não some', () => {
    exercicio({ id: 'ex-ficha', nome: 'Remada alta', tipoMedicao: 'carga_placa' });
    exercicio({ id: 'ex-fora', nome: 'Rosca direta', tipoMedicao: 'carga_kg' });
    treino({ id: 'tr-a', nome: 'Treino A' });
    item({ id: 'it-1', treinoId: 'tr-a', exercicioId: 'ex-ficha', ordem: 0, seriesAlvo: 4 });
    sessao({ id: 's1', nome: 'Treino A', iniciadaEm: T, treinoId: 'tr-a' });
    // Aparelho ocupado, trocou de exercício no meio: a série existe e precisa
    // aparecer no cartão, senão o plano mostra menos do que o banco tem.
    serie({ id: 'a', sessaoId: 's1', exercicioId: 'ex-fora', indice: 0, cargaG: 15000, repeticoes: 12, concluidaEm: T + MIN });

    const plano = planoDaSessao('s1');

    assert.deepEqual(
      plano?.itens.map((i) => i.itemId),
      ['it-1', 'avulso:ex-fora']
    );
    assert.equal(plano?.itens[1].feitas.length, 1);
    // Sem alvo: a série improvisada não vira dívida no contador do cabeçalho.
    assert.equal(plano?.itens[1].seriesAlvo, 0);
    assert.equal(plano?.seriesAlvo, 4);
    assert.equal(plano?.seriesFaltando, 4);
  });

  it('sessão avulsa deriva os itens das séries que já apareceram', () => {
    exercicio({ id: 'ex', nome: 'Rosca direta', tipoMedicao: 'carga_kg' });
    sessao({ id: 's1', nome: 'Treino livre', iniciadaEm: T });
    serie({ id: 'a', sessaoId: 's1', exercicioId: 'ex', indice: 0, cargaG: 15000, repeticoes: 12, concluidaEm: T + MIN });

    const plano = planoDaSessao('s1');

    assert.equal(plano?.itens.length, 1);
    assert.equal(plano?.itens[0].itemId, 'avulso:ex');
    // Sem ficha não há alvo a bater: o cartão nunca fica "faltando 3".
    assert.equal(plano?.itens[0].faltam, 0);
  });
});

// ── Corpo e preferências ──────────────────────────────────────────────────

describe('corpo e preferências', () => {
  it('perfil é undefined até o primeiro save', () => {
    assert.equal(obterPerfil(), undefined);

    db.insert(perfil).values({ id: 'unico', alturaMm: 1780, criadoEm: T, atualizadoEm: T }).run();

    assert.equal(obterPerfil()?.alturaMm, 1780);
  });

  it('a última pesagem é a de maior medido_em, não a última gravada', () => {
    pesagem({ id: 'p1', pesoG: 78400, medidoEm: T });
    // Lançada depois, referente a ontem — o caso normal de quem pesa em jejum e
    // registra à noite.
    pesagem({ id: 'p0', pesoG: 79000, medidoEm: T - DIA });

    assert.equal(ultimaPesagem()?.pesoG, 78400);
  });

  it('histórico de peso filtra período e ignora arquivada', () => {
    pesagem({ id: 'p0', pesoG: 80000, medidoEm: T - 90 * DIA });
    pesagem({ id: 'p1', pesoG: 79000, medidoEm: T - 10 * DIA });
    pesagem({ id: 'p2', pesoG: 78400, medidoEm: T });
    pesagem({ id: 'px', pesoG: 99000, medidoEm: T - DIA, arquivadoEm: T });

    assert.deepEqual(
      historicoPeso().map((p) => p.pesoG),
      [80000, 79000, 78400]
    );
    assert.deepEqual(
      historicoPeso({ de: T - 30 * DIA, ate: T }).map((p) => p.pesoG),
      [79000, 78400]
    );
  });

  it('histórico de medidas filtra por parte, em ordem cronológica', () => {
    medida({ id: 'm1', parte: 'braco_direito', valorMm: 385, medidoEm: T });
    medida({ id: 'm2', parte: 'braco_direito', valorMm: 390, medidoEm: T + 30 * DIA });
    medida({ id: 'm3', parte: 'cintura', valorMm: 840, medidoEm: T });

    assert.deepEqual(
      historicoMedidas({ parte: 'braco_direito' }).map((m) => m.valorMm),
      [385, 390]
    );
    assert.equal(historicoMedidas().length, 3);
  });

  it('preferência devolve o valor gravado, e undefined quando a chave não existe', () => {
    db.insert(preferencias).values({ chave: 'seed_versao', valor: '1', atualizadoEm: T }).run();

    assert.equal(preferencia('seed_versao'), '1');
    assert.equal(preferencia('ultimo_treino'), undefined);
  });
});
