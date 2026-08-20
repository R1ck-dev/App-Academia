/**
 * As invariantes de escrita, contra SQLite de verdade.
 *
 * Os asserts leem o banco por SQL cru de propósito: o que está sendo provado é
 * o que FOI GRAVADO em qual COLUNA — passar por `queries.ts` esconderia
 * justamente a distinção `carga_g` × `carga_placas` atrás do mapeamento.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { kg, placa } from '../dominio/carga.ts';
import { criarBancoDeTeste, type BancoDeTeste } from './banco-de-teste.ts';
import {
  arquivarMedida,
  arquivarPesagem,
  atualizarItemDoTreino,
  confirmarSerie,
  corrigirSerie,
  arquivarTreino,
  criarExercicio,
  criarTreino,
  definirCargaAlvo,
  definirItemDoTreino,
  definirObjetivoPeso,
  definirPreferencia,
  descartarSessaoVazia,
  desfazerSerie,
  editarExercicio,
  finalizarSessao,
  iniciarSessao,
  limparObjetivoPeso,
  reabrirSessao,
  registrarMedida,
  registrarPesagem,
  registrarSerie,
  removerItemDoTreino,
  reordenarItensDoTreino,
  salvarAltura,
} from './mutations.ts';

let banco: BancoDeTeste;

beforeEach(() => {
  banco = criarBancoDeTeste();
});

/**
 * Uma linha do SQLite, sem passar por `queries.ts`. O espalhamento não é
 * enfeite: `node:sqlite` devolve objeto sem protótipo, e `deepEqual` estrito
 * recusa comparar isso com um literal.
 */
function linha<T = Record<string, unknown>>(sql: string, ...p: unknown[]): T {
  return { ...(banco.bruto.prepare(sql).get(...(p as never[])) as object) } as T;
}

function linhas<T = Record<string, unknown>>(sql: string, ...p: unknown[]): T[] {
  return (banco.bruto.prepare(sql).all(...(p as never[])) as object[]).map((l) => ({
    ...l,
  })) as T[];
}

/** O índice que o BANCO decidiu para a série — quem manda desde o toque duplo. */
function indiceDe(serieId: string): number {
  return linha<{ indice: number }>('select indice from series where id = ?', serieId).indice;
}

function contar(sql: string, ...p: unknown[]): number {
  return linha<{ n: number }>(sql, ...p).n;
}

/** Abre a sessão e falha o teste se ela não abriu — o resto do caso depende disso. */
function abrir(nome: string, treinoId?: string): string {
  const r = iniciarSessao({ nome, treinoId });
  assert.ok(r.ok, 'esperava a sessão abrir');
  return r.sessaoId;
}

describe('catálogo', () => {
  it('usa o incremento padrão da unidade e grava na coluna certa', () => {
    const remada = criarExercicio({ nome: 'Remada Alta', tipoMedicao: 'carga_placa' });
    const supino = criarExercicio({ nome: 'Supino Inclinado', tipoMedicao: 'carga_kg' });
    const abdominal = criarExercicio({ nome: 'Abdominal Supra', tipoMedicao: 'peso_corporal' });

    assert.deepEqual(
      linha('select incremento_g, incremento_placas from exercicios where id = ?', remada),
      { incremento_g: null, incremento_placas: 1 }
    );
    assert.deepEqual(
      linha('select incremento_g, incremento_placas from exercicios where id = ?', supino),
      { incremento_g: 2500, incremento_placas: null }
    );
    assert.deepEqual(
      linha('select incremento_g, incremento_placas from exercicios where id = ?', abdominal),
      { incremento_g: null, incremento_placas: null }
    );
  });

  it('recusa incremento na unidade errada e gramas por placa fora de placa', () => {
    assert.throws(() =>
      criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa', incremento: kg(2500) })
    );
    assert.throws(() =>
      criarExercicio({ nome: 'Esteira', tipoMedicao: 'tempo', incremento: kg(2500) })
    );
    assert.throws(() =>
      criarExercicio({ nome: 'Supino', tipoMedicao: 'carga_kg', gramasPorPlaca: 5000 })
    );
    assert.equal(contar('select count(*) n from exercicios'), 0);
  });

  it('editar troca o incremento na mesma unidade e recusa a outra', () => {
    const halter = criarExercicio({ nome: 'Elevação Lateral', tipoMedicao: 'carga_kg' });

    editarExercicio(halter, { nome: 'Elevação Lateral c/ Halter', incremento: kg(1000) });
    const depois = linha<{ nome: string; incremento_g: number }>(
      'select nome, incremento_g from exercicios where id = ?',
      halter
    );
    assert.equal(depois.nome, 'Elevação Lateral c/ Halter');
    assert.equal(depois.incremento_g, 1000);

    assert.throws(() => editarExercicio(halter, { incremento: placa(1) }));
  });
});

describe('sessão', () => {
  it('recusa a segunda sessão aberta e diz qual é a que está aberta', () => {
    const primeira = abrir('Treino A');

    const segunda = iniciarSessao({ nome: 'Treino B' });
    assert.deepEqual(segunda, { ok: false, jaAberta: primeira });
    assert.equal(contar('select count(*) n from sessoes'), 1);
  });

  it('depois de finalizar, uma nova sessão abre', () => {
    const primeira = abrir('Treino A');
    banco.avancarRelogio(60 * 60 * 1000);
    finalizarSessao(primeira);

    const segunda = iniciarSessao({ nome: 'Treino B' });
    assert.ok(segunda.ok);
    assert.notEqual(segunda.sessaoId, primeira);
  });

  it('refinalizar não reescreve o instante da primeira vez', () => {
    const sessao = abrir('Treino A');
    banco.avancarRelogio(60 * 60 * 1000);
    finalizarSessao(sessao);
    const primeiro = linha<{ finalizada_em: number }>(
      'select finalizada_em from sessoes where id = ?',
      sessao
    ).finalizada_em;

    banco.avancarRelogio(24 * 60 * 60 * 1000);
    finalizarSessao(sessao);

    assert.equal(
      linha<{ finalizada_em: number }>('select finalizada_em from sessoes where id = ?', sessao)
        .finalizada_em,
      primeiro
    );
  });

  it('finaliza no instante da última série quando a sessão ficou aberta desde ontem', () => {
    const sessao = abrir('Treino A');
    const ultimaSerie = Date.UTC(2026, 7, 16, 20, 5, 0);

    finalizarSessao(sessao, ultimaSerie);

    assert.equal(
      linha<{ finalizada_em: number }>('select finalizada_em from sessoes where id = ?', sessao)
        .finalizada_em,
      ultimaSerie
    );
  });

  it('descartar apaga a sessão que não tem série nenhuma, e libera abrir outra', () => {
    const errada = abrir('Treino B');

    assert.equal(descartarSessaoVazia(errada), true);
    assert.equal(contar('select count(*) n from sessoes'), 0);

    // O ponto do descarte: `uq_sessao_aberta` não bloqueia mais o treino certo.
    const certa = iniciarSessao({ nome: 'Treino A' });
    assert.ok(certa.ok);
  });

  it('descartar RECUSA a sessão que já tem série, e não apaga nada', () => {
    const exercicio = criarExercicio({ nome: 'Supino', tipoMedicao: 'carga_kg' });
    const sessao = abrir('Treino A');
    registrarSerie({ sessaoId: sessao, exercicioId: exercicio, indice: 0, carga: kg(40), repeticoes: 10 });

    assert.equal(descartarSessaoVazia(sessao), false);
    assert.equal(contar('select count(*) n from sessoes'), 1);
  });

  it('descartar recusa também quando a única série foi DESFEITA', () => {
    // A série arquivada continua sendo linha com FK para a sessão: apagar a
    // sessão deixaria o banco apontando para o que não existe mais.
    const exercicio = criarExercicio({ nome: 'Remada', tipoMedicao: 'carga_kg' });
    const sessao = abrir('Treino A');
    const serie = registrarSerie({
      sessaoId: sessao,
      exercicioId: exercicio,
      indice: 0,
      carga: kg(30),
      repeticoes: 12,
    });
    desfazerSerie(serie);

    assert.equal(descartarSessaoVazia(sessao), false);
    assert.equal(contar('select count(*) n from sessoes'), 1);
  });

  it('reabrir devolve a sessão ao estado de em andamento', () => {
    const sessao = abrir('Treino A');
    banco.avancarRelogio(60 * 60 * 1000);
    finalizarSessao(sessao);

    reabrirSessao(sessao);

    assert.equal(
      linha<{ finalizada_em: number | null }>(
        'select finalizada_em from sessoes where id = ?',
        sessao
      ).finalizada_em,
      null
    );
  });
});

describe('a trava exercício ↔ série', () => {
  // Esta é a defesa que o SQLite NÃO pode dar: CHECK não aceita subquery, então
  // sem estes casos "gravar 5 placas num exercício de kg" passa em silêncio e o
  // histórico do exercício vira duas unidades misturadas.

  it('recusa kg num exercício de placa, e não grava nada', () => {
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrir('Treino A');

    assert.throws(
      () =>
        registrarSerie({
          sessaoId: sessao,
          exercicioId: peck,
          indice: 0,
          carga: kg(40000),
          repeticoes: 10,
        }),
      /Peck Dorsal/
    );
    assert.equal(contar('select count(*) n from series'), 0);
  });

  it('recusa placa num exercício de kg', () => {
    const supino = criarExercicio({ nome: 'Supino Inclinado', tipoMedicao: 'carga_kg' });
    const sessao = abrir('Treino C');

    assert.throws(() =>
      registrarSerie({
        sessaoId: sessao,
        exercicioId: supino,
        indice: 0,
        carga: placa(5),
        repeticoes: 10,
      })
    );
  });

  it('recusa série sem carga em exercício que tem carga', () => {
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrir('Treino A');

    assert.throws(() =>
      registrarSerie({ sessaoId: sessao, exercicioId: peck, indice: 0, carga: null, repeticoes: 10 })
    );
  });

  it('recusa carga em peso corporal', () => {
    const abdominal = criarExercicio({ nome: 'Abdominal Supra', tipoMedicao: 'peso_corporal' });
    const sessao = abrir('Treino A');

    assert.throws(() =>
      registrarSerie({
        sessaoId: sessao,
        exercicioId: abdominal,
        indice: 0,
        carga: placa(1),
        repeticoes: 12,
      })
    );
  });

  it('corrigir uma série gravada também revalida a unidade', () => {
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrir('Treino A');
    const serie = registrarSerie({
      sessaoId: sessao,
      exercicioId: peck,
      indice: 0,
      carga: placa(5),
      repeticoes: 10,
    });

    corrigirSerie(serie, { carga: placa(6) });
    assert.equal(
      linha<{ carga_placas: number }>('select carga_placas from series where id = ?', serie)
        .carga_placas,
      6
    );

    assert.throws(() => corrigirSerie(serie, { carga: kg(30000) }));
  });
});

describe('série', () => {
  it('grava a carga na coluna da unidade e deixa a outra nula', () => {
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const supino = criarExercicio({ nome: 'Supino Inclinado', tipoMedicao: 'carga_kg' });
    const esteira = criarExercicio({ nome: 'Esteira', tipoMedicao: 'tempo' });
    const sessao = abrir('Treino A');

    const emPlaca = registrarSerie({
      sessaoId: sessao,
      exercicioId: peck,
      indice: 0,
      carga: placa(5),
      repeticoes: 10,
    });
    const emKg = registrarSerie({
      sessaoId: sessao,
      exercicioId: supino,
      indice: 0,
      carga: kg(42500),
      repeticoes: 8,
    });
    const emTempo = registrarSerie({
      sessaoId: sessao,
      exercicioId: esteira,
      indice: 0,
      carga: null,
      duracaoS: 600,
    });

    assert.deepEqual(linha('select carga_g, carga_placas from series where id = ?', emPlaca), {
      carga_g: null,
      carga_placas: 5,
    });
    assert.deepEqual(linha('select carga_g, carga_placas from series where id = ?', emKg), {
      carga_g: 42500,
      carga_placas: null,
    });
    assert.deepEqual(
      linha('select carga_g, carga_placas, repeticoes, duracao_s from series where id = ?', emTempo),
      { carga_g: null, carga_placas: null, repeticoes: null, duracao_s: 600 }
    );
  });

  it('duplo toque no botão não vira duas séries no mesmo índice', () => {
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrir('Treino A');
    const gravar = () =>
      registrarSerie({
        sessaoId: sessao,
        exercicioId: peck,
        indice: 0,
        carga: placa(5),
        repeticoes: 10,
      });

    gravar();
    assert.throws(gravar);
    assert.equal(contar('select count(*) n from series'), 1);
  });

  it('desfazer arquiva sem apagar, e o índice continua ocupado', () => {
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrir('Treino A');
    const serie = registrarSerie({
      sessaoId: sessao,
      exercicioId: peck,
      indice: 0,
      carga: placa(5),
      repeticoes: 10,
    });

    desfazerSerie(serie);

    assert.equal(contar('select count(*) n from series'), 1);
    assert.notEqual(
      linha<{ arquivado_em: number | null }>('select arquivado_em from series where id = ?', serie)
        .arquivado_em,
      null
    );
    // O UNIQUE não filtra `arquivado_em`: reusar o índice 0 continua barrado, e
    // é por isso que `proximoIndice` conta as arquivadas.
    assert.throws(() =>
      registrarSerie({
        sessaoId: sessao,
        exercicioId: peck,
        indice: 0,
        carga: placa(5),
        repeticoes: 10,
      })
    );
  });

  it('registrar série toca o atualizado_em da sessão', () => {
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrir('Treino A');
    const antes = linha<{ atualizado_em: number }>(
      'select atualizado_em from sessoes where id = ?',
      sessao
    ).atualizado_em;

    banco.avancarRelogio(90 * 1000);
    registrarSerie({
      sessaoId: sessao,
      exercicioId: peck,
      indice: 0,
      carga: placa(5),
      repeticoes: 10,
    });

    assert.equal(
      linha<{ atualizado_em: number }>('select atualizado_em from sessoes where id = ?', sessao)
        .atualizado_em,
      antes + 90 * 1000
    );
  });

  it('confirmarSerie grava o esforço que o domínio sugeriu', () => {
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrir('Treino A');

    const serie = confirmarSerie(sessao, {
      exercicioId: peck,
      indice: 2,
      tipo: 'valida',
      carga: placa(6),
      repeticoes: 10,
      duracaoS: null,
      origemCarga: 'ajuste_de_hoje',
      origemReps: 'plano',
    });

    assert.deepEqual(
      linha('select tipo, carga_placas, repeticoes, rir from series where id = ?', serie),
      { tipo: 'valida', carga_placas: 6, repeticoes: 10, rir: null }
    );
  });

  /**
   * O bug do primeiro treino real (17/08/2026): dois toques antes de a tela
   * redesenhar mandavam o MESMO índice, o segundo batia no UNIQUE e o erro de
   * SQL aparecia na cara dele no meio da série.
   */
  it('confirmarSerie IGNORA o índice da tela — ele é sempre do render anterior', () => {
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrir('Treino A');

    const sugerida = {
      exercicioId: peck,
      indice: 7, // número absurdo de propósito: a tela não manda mais no índice
      tipo: 'valida' as const,
      carga: placa(5),
      repeticoes: 10,
      duracaoS: null,
      origemCarga: 'plano' as const,
      origemReps: 'plano' as const,
    };

    const primeira = confirmarSerie(sessao, sugerida);
    assert.equal(indiceDe(primeira), 0);
  });

  it('toque duplo com o mesmo índice não estoura o UNIQUE — grava 0 e 1', () => {
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrir('Treino A');

    const sugerida = {
      exercicioId: peck,
      indice: 0,
      tipo: 'valida' as const,
      carga: placa(5),
      repeticoes: 10,
      duracaoS: null,
      origemCarga: 'plano' as const,
      origemReps: 'plano' as const,
    };

    // Duas chamadas com a MESMA sugestão, como dois toques no mesmo render.
    const a = confirmarSerie(sessao, sugerida);
    const b = confirmarSerie(sessao, sugerida);

    assert.deepEqual([indiceDe(a), indiceDe(b)], [0, 1]);
  });

  it('depois de desfazer, o índice não volta — o slot desfeito continua ocupado', () => {
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrir('Treino A');
    const sugerida = {
      exercicioId: peck,
      indice: 0,
      tipo: 'valida' as const,
      carga: placa(5),
      repeticoes: 10,
      duracaoS: null,
      origemCarga: 'plano' as const,
      origemReps: 'plano' as const,
    };

    confirmarSerie(sessao, sugerida);
    const segunda = confirmarSerie(sessao, sugerida);
    desfazerSerie(segunda);

    // O UNIQUE não filtra arquivadas: reusar o 1 seria erro de gravação.
    assert.equal(indiceDe(confirmarSerie(sessao, sugerida)), 2);
  });
});

describe('ficha', () => {
  it('grava a carga-alvo na coluna da unidade e recusa a unidade errada', () => {
    const treino = criarTreino({ nome: 'Treino A' });
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const supino = criarExercicio({ nome: 'Supino Inclinado', tipoMedicao: 'carga_kg' });

    const item = definirItemDoTreino({
      treinoId: treino,
      exercicioId: peck,
      ordem: 0,
      seriesAlvo: 4,
      repsAlvoMin: 10,
      repsAlvoMax: 10,
      cargaAlvo: placa(4),
    });
    assert.deepEqual(
      linha('select carga_alvo_g, carga_alvo_placas from treino_exercicios where id = ?', item),
      { carga_alvo_g: null, carga_alvo_placas: 4 }
    );

    assert.throws(() =>
      definirItemDoTreino({
        treinoId: treino,
        exercicioId: supino,
        ordem: 1,
        seriesAlvo: 4,
        cargaAlvo: placa(5),
      })
    );
  });

  it('item sem carga-alvo é legítimo, inclusive em exercício com carga', () => {
    const treino = criarTreino({ nome: 'Treino A' });
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });

    const item = definirItemDoTreino({
      treinoId: treino,
      exercicioId: peck,
      ordem: 0,
      seriesAlvo: 4,
    });

    assert.deepEqual(
      linha('select carga_alvo_g, carga_alvo_placas from treino_exercicios where id = ?', item),
      { carga_alvo_g: null, carga_alvo_placas: null }
    );
  });

  it('definirCargaAlvo é o único caminho que muda a carga da ficha, e aceita limpar', () => {
    const treino = criarTreino({ nome: 'Treino A' });
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const item = definirItemDoTreino({
      treinoId: treino,
      exercicioId: peck,
      ordem: 0,
      seriesAlvo: 4,
      cargaAlvo: placa(5),
    });

    definirCargaAlvo(item, placa(6));
    assert.equal(
      linha<{ carga_alvo_placas: number }>(
        'select carga_alvo_placas from treino_exercicios where id = ?',
        item
      ).carga_alvo_placas,
      6
    );

    // `atualizarItemDoTreino` não tem por onde tocar na carga: é o que impede a
    // ficha de mudar como efeito colateral de mexer no descanso.
    atualizarItemDoTreino(item, { descansoS: 120, seriesAlvo: 5 });
    assert.equal(
      linha<{ carga_alvo_placas: number }>(
        'select carga_alvo_placas from treino_exercicios where id = ?',
        item
      ).carga_alvo_placas,
      6
    );

    definirCargaAlvo(item, null);
    assert.equal(
      linha<{ carga_alvo_placas: number | null }>(
        'select carga_alvo_placas from treino_exercicios where id = ?',
        item
      ).carga_alvo_placas,
      null
    );
  });

  it('reordena numa transação e remove item por soft delete', () => {
    const treino = criarTreino({ nome: 'Treino A' });
    const a = criarExercicio({ nome: 'Remada Alta', tipoMedicao: 'carga_placa' });
    const b = criarExercicio({ nome: 'Facepull', tipoMedicao: 'carga_placa' });
    const c = criarExercicio({ nome: 'Rosca Direta', tipoMedicao: 'carga_placa' });
    const itens = [a, b, c].map((exercicioId, ordem) =>
      definirItemDoTreino({ treinoId: treino, exercicioId, ordem, seriesAlvo: 4 })
    );

    reordenarItensDoTreino(treino, [itens[2], itens[0], itens[1]]);

    assert.deepEqual(
      linhas<{ id: string }>(
        'select id from treino_exercicios where treino_id = ? order by ordem',
        treino
      ).map((l) => l.id),
      [itens[2], itens[0], itens[1]]
    );

    removerItemDoTreino(itens[0]);
    assert.equal(contar('select count(*) n from treino_exercicios where treino_id = ?', treino), 3);
    assert.equal(
      contar(
        'select count(*) n from treino_exercicios where treino_id = ? and arquivado_em is null',
        treino
      ),
      2
    );
  });

  it('arquivarTreino some da lista e NÃO cascateia nos itens', () => {
    const treino = criarTreino({ nome: 'Treino A' });
    const exercicioId = criarExercicio({ nome: 'Remada Alta', tipoMedicao: 'carga_placa' });
    definirItemDoTreino({ treinoId: treino, exercicioId, ordem: 0, seriesAlvo: 4 });

    arquivarTreino(treino);

    assert.equal(
      contar('select count(*) n from treinos where arquivado_em is null'),
      0,
      'sumiu da escolha do dia'
    );
    // A linha continua no SQLite, como todo soft delete.
    assert.equal(contar('select count(*) n from treinos where id = ?', treino), 1);
    // Os itens ficam INTACTOS de propósito: cascatear tornaria um futuro
    // "desarquivar" impossível de reverter fielmente, e item de treino
    // arquivado já é inalcançável — ninguém pede a ficha que sumiu da lista.
    assert.equal(
      contar(
        'select count(*) n from treino_exercicios where treino_id = ? and arquivado_em is null',
        treino
      ),
      1
    );
  });
});

describe('corpo e perfil', () => {
  it('pesagem retroativa entra com o instante informado, não com o de agora', () => {
    const ontem = Date.UTC(2026, 7, 15, 7, 0, 0);
    const id = registrarPesagem({ pesoG: 78400, medidoEm: ontem, observacao: 'jejum' });

    const gravada = linha<{ medido_em: number; peso_g: number; observacao: string }>(
      'select medido_em, peso_g, observacao from pesagens where id = ?',
      id
    );
    assert.equal(gravada.medido_em, ontem);
    assert.equal(gravada.peso_g, 78400);
    assert.equal(gravada.observacao, 'jejum');
  });

  it('a primeira pesagem depois da meta vira o peso de partida, e as seguintes não', () => {
    // Sem isto, definir a meta antes de pesar deixaria o percentual null para
    // sempre — e ele não teria como adivinhar por quê.
    definirObjetivoPeso(75000);
    assert.equal(
      linha<{ peso_inicial_g: number | null }>('select peso_inicial_g from perfil').peso_inicial_g,
      null
    );

    registrarPesagem({ pesoG: 78400 });
    assert.equal(
      linha<{ peso_inicial_g: number }>('select peso_inicial_g from perfil').peso_inicial_g,
      78400
    );

    banco.avancarRelogio(7 * 24 * 60 * 60 * 1000);
    registrarPesagem({ pesoG: 77900 });
    assert.equal(
      linha<{ peso_inicial_g: number }>('select peso_inicial_g from perfil').peso_inicial_g,
      78400
    );
  });

  it('definir a meta com pesagem prévia copia a última como partida', () => {
    registrarPesagem({ pesoG: 82000, medidoEm: Date.UTC(2026, 6, 1) });
    registrarPesagem({ pesoG: 78400, medidoEm: Date.UTC(2026, 7, 1) });

    definirObjetivoPeso(75000);

    assert.deepEqual(linha('select peso_objetivo_g, peso_inicial_g from perfil'), {
      peso_objetivo_g: 75000,
      peso_inicial_g: 78400,
    });
  });

  it('perfil é linha única: salvar altura duas vezes não cria a segunda', () => {
    salvarAltura(1780);
    banco.avancarRelogio(1000);
    salvarAltura(1785);

    assert.equal(contar('select count(*) n from perfil'), 1);
    assert.equal(linha<{ altura_mm: number }>('select altura_mm from perfil').altura_mm, 1785);
  });

  it('altura e objetivo convivem na mesma linha, e limpar o objetivo não apaga a altura', () => {
    salvarAltura(1780);
    definirObjetivoPeso(75000, 82000);
    limparObjetivoPeso();

    assert.deepEqual(
      linha('select altura_mm, peso_objetivo_g, peso_inicial_g, objetivo_definido_em from perfil'),
      { altura_mm: 1780, peso_objetivo_g: null, peso_inicial_g: null, objetivo_definido_em: null }
    );
  });

  it('arquivar pesagem e medida marca a linha sem apagá-la', () => {
    const pesagem = registrarPesagem({ pesoG: 78400 });
    const medida = registrarMedida({ parte: 'braco_direito', valorMm: 385 });

    arquivarPesagem(pesagem);
    arquivarMedida(medida);

    assert.equal(contar('select count(*) n from pesagens'), 1);
    assert.equal(contar('select count(*) n from pesagens where arquivado_em is null'), 0);
    assert.equal(contar('select count(*) n from medidas where arquivado_em is null'), 0);
  });

  it('preferência é upsert por chave', () => {
    definirPreferencia('seed_versao', '1');
    banco.avancarRelogio(1000);
    definirPreferencia('seed_versao', '2');

    assert.equal(contar('select count(*) n from preferencias'), 1);
    assert.equal(
      linha<{ valor: string }>('select valor from preferencias where chave = ?', 'seed_versao')
        .valor,
      '2'
    );
  });
});
