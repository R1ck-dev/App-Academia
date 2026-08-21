import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TipoMedicao, TipoSerie } from '../db/schema.ts';
import { INCREMENTO_PADRAO, kg, type Carga } from './carga.ts';

/**
 * O Peck Dorsal já foi medido em placas, e estes testes falavam em "5 placas".
 * Placa saiu do app; o que os casos afirmam continua sendo relativo — subiu um
 * degrau, manteve, ficou atrás da ficha —, então um degrau vira o incremento
 * padrão em quilo e cada asserção segue dizendo a mesma coisa.
 */
const degraus = (quantos: number): Carga => kg(quantos * INCREMENTO_PADRAO);
import { incrementoPadrao, type Exercicio } from './exercicio.ts';
import {
  divergenciasDoPlano,
  fimDoDescanso,
  montarPlanoDaSessao,
  proximoIndice,
  sugerirProximaSerie,
  type ItemDoPlano,
  type PlanoDaSessao,
} from './execucao.ts';
import type { SerieExecutada } from './volume.ts';

const T0 = 1_700_000_000_000;
const SESSAO: PlanoDaSessao['sessao'] = {
  id: 'sessao-hoje',
  nome: 'Treino A',
  iniciadaEm: T0,
  treinoId: 'treino-a',
};

function exercicio(id: string, tipoMedicao: TipoMedicao, nome = id): Exercicio {
  return {
    id,
    nome,
    grupoMuscular: null,
    tipoMedicao,
    incremento: incrementoPadrao(tipoMedicao),
    arquivadoEm: null,
  };
}

const PECK = exercicio('ex-peck', 'carga_kg', 'Peck Dorsal');
const SUPINO = exercicio('ex-supino', 'carga_kg', 'Supino Inclinado');
const ABDOMINAL = exercicio('ex-abd', 'peso_corporal', 'Abdominal Supra Solo');
const ESTEIRA = exercicio('ex-esteira', 'tempo', 'Esteira');

function item(p: {
  exercicio: Exercicio;
  itemId?: string;
  ordem?: number;
  seriesAlvo?: number;
  repsAlvoMin?: number | null;
  repsAlvoMax?: number | null;
  cargaAlvo?: Carga | null;
  duracaoAlvoS?: number | null;
  descansoS?: number;
}): ItemDoPlano {
  return {
    itemId: p.itemId ?? `te-${p.exercicio.id}`,
    exercicio: p.exercicio,
    ordem: p.ordem ?? 0,
    seriesAlvo: p.seriesAlvo ?? 4,
    repsAlvoMin: p.repsAlvoMin ?? null,
    repsAlvoMax: p.repsAlvoMax ?? null,
    cargaAlvo: p.cargaAlvo ?? null,
    duracaoAlvoS: p.duracaoAlvoS ?? null,
    descansoS: p.descansoS ?? 90,
  };
}

function serie(p: {
  exercicioId: string;
  indice: number;
  tipo?: TipoSerie;
  carga?: Carga | null;
  repeticoes?: number | null;
  duracaoS?: number | null;
  sessaoId?: string;
  concluidaEm?: number;
}): SerieExecutada {
  return {
    id: `serie-${p.exercicioId}-${p.indice}`,
    sessaoId: p.sessaoId ?? SESSAO.id,
    exercicioId: p.exercicioId,
    indice: p.indice,
    tipo: p.tipo ?? 'valida',
    carga: p.carga ?? null,
    repeticoes: p.repeticoes ?? null,
    duracaoS: p.duracaoS ?? null,
    rir: null,
    concluidaEm: p.concluidaEm ?? T0 + p.indice * 60_000,
  };
}

/** Atalho: o caso comum é um item só, sem sessão anterior. */
function proxima(p: {
  item: ItemDoPlano;
  feitasHoje?: readonly SerieExecutada[];
  sessaoAnterior?: readonly SerieExecutada[] | null;
  indicesOcupados?: readonly number[];
}) {
  const sugerida = sugerirProximaSerie({
    item: p.item,
    feitasHoje: p.feitasHoje ?? [],
    sessaoAnterior: p.sessaoAnterior ?? null,
    indicesOcupados: p.indicesOcupados ?? (p.feitasHoje ?? []).map((s) => s.indice),
  });
  assert.ok(sugerida, 'série extra é sempre 1 toque: a sugestão nunca é nula');
  return sugerida;
}

describe('proximoIndice', () => {
  it('começa em zero e anda com o maior ocupado', () => {
    assert.equal(proximoIndice([]), 0);
    assert.equal(proximoIndice([0, 1]), 2);
  });

  it('conta a ARQUIVADA: o UNIQUE do slot não filtra arquivado_em', () => {
    // Ele fez 3 séries e desfez a última. Vivas: 0 e 1. Ocupados: 0, 1 e 2.
    // `indice = feitas.length` daria 2 e estouraria o UNIQUE na hora de gravar.
    assert.equal(proximoIndice([0, 1, 2]), 3);
  });

  it('buraco no meio continua buraco', () => {
    assert.equal(proximoIndice([0, 2]), 3);
  });

  it('não depende da ordem em que os índices chegam', () => {
    assert.equal(proximoIndice([2, 0, 1]), 3);
  });
});

describe('cadeia da carga', () => {
  it('degrau 1: repete o ajuste feito HOJE, e as séries seguintes voltam a 1 toque', () => {
    const s = proxima({
      item: item({ exercicio: PECK, cargaAlvo: degraus(5), repsAlvoMax: 10 }),
      feitasHoje: [
        serie({ exercicioId: PECK.id, indice: 0, carga: degraus(5), repeticoes: 10 }),
        serie({ exercicioId: PECK.id, indice: 1, carga: degraus(6), repeticoes: 10 }),
      ],
    });

    assert.deepEqual(s.carga, degraus(6));
    assert.equal(s.origemCarga, 'ajuste_de_hoje');
    assert.equal(s.indice, 2);
  });

  it('degrau 1 ignora aquecimento: herdar a carga leve baixaria a régua sozinho', () => {
    const s = proxima({
      item: item({ exercicio: PECK, cargaAlvo: degraus(5) }),
      feitasHoje: [
        serie({ exercicioId: PECK.id, indice: 0, tipo: 'aquecimento', carga: degraus(3), repeticoes: 15 }),
      ],
    });

    assert.deepEqual(s.carga, degraus(5));
    assert.equal(s.origemCarga, 'plano');
    assert.equal(s.indice, 1);
  });

  it('degrau 1 não enxerga a série do exercício vizinho', () => {
    const s = proxima({
      item: item({ exercicio: PECK, cargaAlvo: degraus(5) }),
      feitasHoje: [serie({ exercicioId: SUPINO.id, indice: 0, carga: kg(40000), repeticoes: 10 })],
      indicesOcupados: [],
    });

    assert.deepEqual(s.carga, degraus(5));
    assert.equal(s.origemCarga, 'plano');
  });

  it('degrau 2 é ANTI-CATRACA: 6,6,5,5 volta abrindo em 6, não em 5', () => {
    const anterior = [
      serie({ exercicioId: PECK.id, indice: 0, carga: degraus(6), repeticoes: 10, sessaoId: 'sessao-semana-passada' }),
      serie({ exercicioId: PECK.id, indice: 1, carga: degraus(6), repeticoes: 10, sessaoId: 'sessao-semana-passada' }),
      serie({ exercicioId: PECK.id, indice: 2, carga: degraus(5), repeticoes: 9, sessaoId: 'sessao-semana-passada' }),
      serie({ exercicioId: PECK.id, indice: 3, carga: degraus(5), repeticoes: 8, sessaoId: 'sessao-semana-passada' }),
    ];
    const hoje = item({ exercicio: PECK, seriesAlvo: 4, repsAlvoMax: 10 });

    const primeira = proxima({ item: hoje, sessaoAnterior: anterior });
    assert.deepEqual(primeira.carga, degraus(6));
    assert.equal(primeira.origemCarga, 'mesmo_indice_sessao_anterior');

    // E a queda por fadiga reaparece na POSIÇÃO em que aconteceu.
    const terceira = proxima({ item: hoje, sessaoAnterior: anterior, indicesOcupados: [0, 1] });
    assert.deepEqual(terceira.carga, degraus(5));
    assert.equal(terceira.origemCarga, 'mesmo_indice_sessao_anterior');
  });

  it('degrau 2 perde para o ajuste de hoje assim que existe ajuste de hoje', () => {
    const s = proxima({
      item: item({ exercicio: PECK, cargaAlvo: degraus(5) }),
      feitasHoje: [serie({ exercicioId: PECK.id, indice: 0, carga: degraus(7), repeticoes: 10 })],
      sessaoAnterior: [serie({ exercicioId: PECK.id, indice: 1, carga: degraus(6), repeticoes: 10 })],
    });

    assert.deepEqual(s.carga, degraus(7));
    assert.equal(s.origemCarga, 'ajuste_de_hoje');
  });

  it('degrau 3: na estreia, a carga vem da ficha', () => {
    const s = proxima({ item: item({ exercicio: SUPINO, cargaAlvo: kg(40000) }) });

    assert.deepEqual(s.carga, kg(40000));
    assert.equal(s.origemCarga, 'plano');
  });

  it('degrau 4: sem plano e sem histórico, o botão vira "informar carga"', () => {
    const s = proxima({ item: item({ exercicio: SUPINO }) });

    assert.equal(s.carga, null);
    assert.equal(s.origemCarga, 'sem_referencia');
  });

  it('carga incompatível com o exercício é descartada em vez de virar toque recusado', () => {
    // Cenário do exercício que mudou de tipo: com uma carga vinda da ficha ou do
    // histórico, `registrarSerie` lançaria em cima de um prefill que ela recusa.
    // Descartar aqui é o que faz o toque continuar existindo.
    const s = proxima({
      item: item({ exercicio: ABDOMINAL, cargaAlvo: kg(40000) }),
      sessaoAnterior: [
        serie({ exercicioId: ABDOMINAL.id, indice: 0, carga: kg(40000), repeticoes: 10 }),
      ],
    });

    assert.equal(s.carga, null);
    assert.equal(s.origemCarga, 'sem_referencia');
  });
});

describe('cadeia das repetições — invertida de propósito', () => {
  it('reps vêm SEMPRE do plano: fez 8 na semana passada, hoje o alvo continua 10', () => {
    const s = proxima({
      item: item({ exercicio: PECK, cargaAlvo: degraus(5), seriesAlvo: 4, repsAlvoMax: 10 }),
      sessaoAnterior: [serie({ exercicioId: PECK.id, indice: 0, carga: degraus(5), repeticoes: 8 })],
    });

    assert.equal(s.repeticoes, 10);
    assert.equal(s.origemReps, 'plano');
    // A carga, essa sim, herda o histórico — as duas cadeias andam separadas.
    assert.deepEqual(s.carga, degraus(5));
    assert.equal(s.origemCarga, 'mesmo_indice_sessao_anterior');
  });

  it('numa faixa 8–12 o alvo é o topo', () => {
    const s = proxima({ item: item({ exercicio: PECK, repsAlvoMin: 8, repsAlvoMax: 12 }) });
    assert.equal(s.repeticoes, 12);

    const soMinimo = proxima({ item: item({ exercicio: PECK, repsAlvoMin: 8 }) });
    assert.equal(soMinimo.repeticoes, 8);
  });

  it('sem plano de reps, cai no mesmo índice da sessão anterior', () => {
    const s = proxima({
      item: item({ exercicio: PECK, cargaAlvo: degraus(5) }),
      sessaoAnterior: [serie({ exercicioId: PECK.id, indice: 0, carga: degraus(5), repeticoes: 9 })],
    });

    assert.equal(s.repeticoes, 9);
    assert.equal(s.origemReps, 'mesmo_indice_sessao_anterior');
  });

  it('sem plano e sem histórico, reps ficam nulas', () => {
    const s = proxima({ item: item({ exercicio: PECK, cargaAlvo: degraus(5) }) });
    assert.equal(s.repeticoes, null);
    assert.equal(s.origemReps, 'sem_referencia');
  });
});

describe('exercício sem carga e exercício de tempo', () => {
  it('peso corporal sugere repetições e NENHUMA carga', () => {
    const s = proxima({ item: item({ exercicio: ABDOMINAL, seriesAlvo: 4, repsAlvoMax: 12 }) });

    assert.equal(s.carga, null);
    assert.equal(s.origemCarga, 'sem_referencia');
    assert.equal(s.repeticoes, 12);
    assert.equal(s.origemReps, 'plano');
    assert.equal(s.duracaoS, null);
  });

  it('esteira sugere duração, sem carga e sem repetições', () => {
    const s = proxima({
      item: item({ exercicio: ESTEIRA, seriesAlvo: 1, duracaoAlvoS: 600 }),
    });

    assert.equal(s.duracaoS, 600);
    assert.equal(s.repeticoes, null);
    assert.equal(s.carga, null);
    assert.equal(s.origemReps, 'plano');
  });

  it('esteira sem duração na ficha herda a duração da mesma posição', () => {
    const s = proxima({
      item: item({ exercicio: ESTEIRA, seriesAlvo: 1 }),
      sessaoAnterior: [serie({ exercicioId: ESTEIRA.id, indice: 0, duracaoS: 720 })],
    });

    assert.equal(s.duracaoS, 720);
    assert.equal(s.origemReps, 'mesmo_indice_sessao_anterior');
  });
});

describe('montarPlanoDaSessao', () => {
  const peck = item({ exercicio: PECK, itemId: 'te-1', ordem: 0, seriesAlvo: 4, repsAlvoMax: 10, cargaAlvo: degraus(5) });
  const supino = item({ exercicio: SUPINO, itemId: 'te-2', ordem: 1, seriesAlvo: 3, repsAlvoMax: 10, cargaAlvo: kg(40000) });

  function plano(feitas: readonly SerieExecutada[], ocupados?: Map<string, readonly number[]>) {
    return montarPlanoDaSessao({
      sessao: SESSAO,
      // Fora de ordem de propósito: quem monta o plano ordena.
      itens: [supino, peck],
      feitas,
      anteriores: new Map(),
      indicesOcupados: ocupados ?? agrupaIndices(feitas),
    });
  }

  function agrupaIndices(feitas: readonly SerieExecutada[]): Map<string, readonly number[]> {
    const m = new Map<string, number[]>();
    for (const s of feitas) {
      const atual = m.get(s.exercicioId);
      if (atual) atual.push(s.indice);
      else m.set(s.exercicioId, [s.indice]);
    }
    return m;
  }

  it('aquecimento não abate o alvo: 2 aquecimentos + 1 válida num 4×10 deixa 3 faltando', () => {
    const p = plano([
      serie({ exercicioId: PECK.id, indice: 0, tipo: 'aquecimento', carga: degraus(3), repeticoes: 15 }),
      serie({ exercicioId: PECK.id, indice: 1, tipo: 'aquecimento', carga: degraus(4), repeticoes: 12 }),
      serie({ exercicioId: PECK.id, indice: 2, carga: degraus(6), repeticoes: 10 }),
    ]);
    const item0 = p.itens[0];

    assert.equal(item0.itemId, 'te-1', 'ordena por `ordem`, não pela ordem de chegada');
    assert.equal(item0.feitas.length, 3);
    assert.equal(item0.contamParaAlvo, 1);
    assert.equal(item0.faltam, 3);
    assert.equal(item0.completo, false);
  });

  it('fez 3 de 4: falta 1 e o cartão aberto continua sendo o dele', () => {
    const p = plano([0, 1, 2].map((i) => serie({ exercicioId: PECK.id, indice: i, carga: degraus(5), repeticoes: 10 })));

    assert.equal(p.itens[0].faltam, 1);
    assert.equal(p.itemAtual?.itemId, 'te-1');
    assert.equal(p.seriesFeitas, 3);
    assert.equal(p.seriesAlvo, 7);
    assert.equal(p.seriesFaltando, 4);
  });

  it('itemAtual anda para o próximo quando o alvo fecha, e o item completo ainda oferece série extra', () => {
    const p = plano([0, 1, 2, 3].map((i) => serie({ exercicioId: PECK.id, indice: i, carga: degraus(5), repeticoes: 10 })));
    const item0 = p.itens[0];

    assert.equal(item0.faltam, 0);
    assert.equal(item0.completo, true);
    assert.equal(p.itemAtual?.itemId, 'te-2', 'o avanço é manual na tela, mas o alvo já apontou para frente');
    assert.deepEqual(item0.proxima?.carga, degraus(5));
    assert.equal(item0.proxima?.indice, 4, 'série extra entra no slot seguinte');
  });

  it('exercício pulado não some: itemAtual volta para o primeiro que falta', () => {
    const p = plano([0, 1, 2].map((i) => serie({ exercicioId: SUPINO.id, indice: i, carga: kg(40000), repeticoes: 10 })));

    assert.equal(p.itens[1].completo, true);
    assert.equal(p.itemAtual?.itemId, 'te-1');
    assert.equal(p.seriesFaltando, 4);
  });

  it('desfazer e registrar de novo: o slot arquivado continua ocupado', () => {
    const vivas = [0, 1].map((i) => serie({ exercicioId: PECK.id, indice: i, carga: degraus(5), repeticoes: 10 }));
    // A série 2 foi desfeita (soft delete): não vem em `feitas`, mas o índice
    // segue ocupado no UNIQUE.
    const p = plano(vivas, new Map([[PECK.id, [0, 1, 2]]]));

    assert.equal(p.itens[0].contamParaAlvo, 2);
    assert.equal(p.itens[0].faltam, 2);
    assert.equal(p.itens[0].proxima?.indice, 3);
  });

  it('sessão vazia: todo mundo falta e o primeiro item é o atual', () => {
    const p = plano([]);

    assert.equal(p.seriesFeitas, 0);
    assert.equal(p.seriesFaltando, 7);
    assert.equal(p.itemAtual?.itemId, 'te-1');
    assert.deepEqual(p.itemAtual?.proxima?.carga, degraus(5));
    assert.equal(p.itemAtual?.proxima?.indice, 0);
  });

  it('série extra não paga a série que falta em outro exercício', () => {
    const p = plano([
      ...[0, 1, 2, 3, 4].map((i) => serie({ exercicioId: PECK.id, indice: i, carga: degraus(5), repeticoes: 10 })),
      serie({ exercicioId: SUPINO.id, indice: 0, carga: kg(40000), repeticoes: 10 }),
    ]);

    assert.equal(p.itens[0].faltam, 0);
    assert.equal(p.itens[1].faltam, 2);
    assert.equal(p.seriesFeitas, 6);
    assert.equal(p.seriesFaltando, 2);
  });

  it('a sessão anterior de cada exercício alimenta o prefill do item certo', () => {
    const p = montarPlanoDaSessao({
      sessao: SESSAO,
      itens: [peck, supino],
      feitas: [],
      anteriores: new Map([
        [PECK.id, [serie({ exercicioId: PECK.id, indice: 0, carga: degraus(7), repeticoes: 10 })]],
      ]),
      indicesOcupados: new Map(),
    });

    assert.deepEqual(p.itens[0].proxima?.carga, degraus(7));
    assert.equal(p.itens[0].proxima?.origemCarga, 'mesmo_indice_sessao_anterior');
    assert.deepEqual(p.itens[1].proxima?.carga, kg(40000));
    assert.equal(p.itens[1].proxima?.origemCarga, 'plano');
  });
});

describe('fimDoDescanso', () => {
  it('é o instante de término derivado da série, nunca "agora + descanso"', () => {
    const ultima = serie({ exercicioId: PECK.id, indice: 0, carga: degraus(5), repeticoes: 10, concluidaEm: T0 });
    assert.equal(fimDoDescanso(ultima, 90), T0 + 90_000);
  });

  it('sem série não há descanso a contar', () => {
    assert.equal(fimDoDescanso(null, 90), null);
  });
});

describe('divergenciasDoPlano', () => {
  it('lista só o que divergiu, com os dois números visíveis', () => {
    const peck = item({ exercicio: PECK, itemId: 'te-1', ordem: 0, seriesAlvo: 4, repsAlvoMin: 10, repsAlvoMax: 10, cargaAlvo: degraus(5) });
    const supino = item({ exercicio: SUPINO, itemId: 'te-2', ordem: 1, seriesAlvo: 3, repsAlvoMin: 10, repsAlvoMax: 10, cargaAlvo: kg(40000) });
    const esteira = item({ exercicio: ESTEIRA, itemId: 'te-3', ordem: 2, seriesAlvo: 1, duracaoAlvoS: 600 });

    const p = montarPlanoDaSessao({
      sessao: SESSAO,
      itens: [peck, supino, esteira],
      feitas: [
        // Bateu o 4×10 inteiro acima da ficha: diverge.
        ...[0, 1, 2, 3].map((i) => serie({ exercicioId: PECK.id, indice: i, carga: degraus(6), repeticoes: 10 })),
        // Fez 2 das 3 séries na carga da ficha: não diverge.
        ...[0, 1].map((i) => serie({ exercicioId: SUPINO.id, indice: i, carga: kg(40000), repeticoes: 10 })),
        // Esteira não tem carga: nunca entra na lista.
        serie({ exercicioId: ESTEIRA.id, indice: 0, duracaoS: 600 }),
      ],
      anteriores: new Map(),
      indicesOcupados: new Map(),
    });

    const divergencias = divergenciasDoPlano(p);

    assert.equal(divergencias.length, 1);
    assert.equal(divergencias[0].itemId, 'te-1');
    assert.equal(divergencias[0].nome, 'Peck Dorsal');
    assert.deepEqual(divergencias[0].noPlano, degraus(5));
    // O degrau exato é contrato de `sugerirCarga`; aqui basta que a ficha esteja
    // atrás do que foi realizado.
    assert.ok(divergencias[0].sugerida.gramas >= degraus(6).gramas);
  });

  it('exercício sem série nenhuma não vira botão de atualizar ficha', () => {
    const p = montarPlanoDaSessao({
      sessao: SESSAO,
      itens: [item({ exercicio: PECK, cargaAlvo: degraus(5), repsAlvoMin: 10 })],
      feitas: [],
      anteriores: new Map(),
      indicesOcupados: new Map(),
    });

    assert.deepEqual(divergenciasDoPlano(p), []);
  });

  it('sessão avulsa não gera botão: não há linha de ficha para atualizar', () => {
    const p = montarPlanoDaSessao({
      sessao: { ...SESSAO, treinoId: null },
      // É a forma do item avulso: sem alvo, sem carga na ficha.
      itens: [item({ exercicio: PECK, itemId: 'avulso:ex-peck', seriesAlvo: 0 })],
      feitas: [0, 1].map((i) => serie({ exercicioId: PECK.id, indice: i, carga: degraus(4), repeticoes: 10 })),
      anteriores: new Map(),
      indicesOcupados: new Map(),
    });

    assert.equal(p.itens[0].faltam, 0);
    assert.equal(p.itemAtual, null);
    assert.deepEqual(divergenciasDoPlano(p), []);
  });

  it('ficha sem carga nenhuma diverge assim que existe realizado', () => {
    const p = montarPlanoDaSessao({
      sessao: SESSAO,
      itens: [item({ exercicio: PECK, itemId: 'te-1', seriesAlvo: 4, repsAlvoMin: 10 })],
      feitas: [0, 1, 2, 3].map((i) => serie({ exercicioId: PECK.id, indice: i, carga: degraus(4), repeticoes: 10 })),
      anteriores: new Map(),
      indicesOcupados: new Map(),
    });

    const divergencias = divergenciasDoPlano(p);
    assert.equal(divergencias.length, 1);
    assert.equal(divergencias[0].noPlano, null);
  });
});
