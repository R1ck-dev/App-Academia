import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kg, placa } from './carga.ts';
import type { Exercicio } from './exercicio.ts';
import {
  contaNoVolume,
  formatarVolumeNaUnidade,
  progressaoDoExercicio,
  sugerirCarga,
  valorDaProgressao,
  volumeDaSerie,
  volumeDaSessao,
  volumeDoExercicio,
  type SerieComExercicio,
  type SerieExecutada,
} from './volume.ts';

const serie = (p: Partial<SerieExecutada> = {}): SerieExecutada => ({
  id: 'sr1',
  sessaoId: 's1',
  exercicioId: 'ex-supino',
  indice: 0,
  tipo: 'valida',
  carga: kg(40000),
  repeticoes: 10,
  duracaoS: null,
  rir: null,
  concluidaEm: 1_000,
  ...p,
});

const comExercicio = (p: Partial<SerieComExercicio> = {}): SerieComExercicio => ({
  ...serie(),
  exercicioNome: 'Supino Inclinado',
  tipoMedicao: 'carga_kg',
  gramasPorPlaca: null,
  ...p,
});

const exercicio = (p: Partial<Exercicio> = {}): Exercicio => ({
  id: 'ex-supino',
  nome: 'Supino Inclinado',
  grupoMuscular: 'peito',
  tipoMedicao: 'carga_kg',
  incremento: kg(2500),
  gramasPorPlaca: null,
  arquivadoEm: null,
  ...p,
});

const remadaAlta = exercicio({
  id: 'ex-remada',
  nome: 'Remada Alta',
  grupoMuscular: 'costas',
  tipoMedicao: 'carga_placa',
  incremento: placa(1),
});

describe('volumeDaSerie', () => {
  it('em kg, multiplica carga por repetições e não é aproximado', () => {
    assert.deepEqual(volumeDaSerie(serie(), null), {
      conta: true,
      gramasReps: 400000,
      aproximado: false,
    });
  });

  it('aquecimento fica de fora — senão o gráfico sobe quando só se aqueceu mais', () => {
    assert.deepEqual(volumeDaSerie(serie({ tipo: 'aquecimento', carga: kg(20000) }), null), {
      conta: false,
      motivo: 'aquecimento',
    });
  });

  it('série levada à falha conta', () => {
    assert.equal(volumeDaSerie(serie({ tipo: 'falha' }), null).conta, true);
  });

  it('peso corporal sai como sem_carga — abdominal não é "placa sem peso conhecido"', () => {
    assert.deepEqual(volumeDaSerie(serie({ carga: null, repeticoes: 20 }), null), {
      conta: false,
      motivo: 'sem_carga',
    });
  });

  it('placa sem calibração fica de fora, com motivo próprio', () => {
    assert.deepEqual(volumeDaSerie(serie({ carga: placa(5) }), null), {
      conta: false,
      motivo: 'placa_sem_calibracao',
    });
  });

  it('placa calibrada entra convertida e MARCADA como aproximada', () => {
    assert.deepEqual(volumeDaSerie(serie({ carga: placa(5) }), 5000), {
      conta: true,
      gramasReps: 250000,
      aproximado: true,
    });
  });

  it('esteira (sem carga e sem repetição) sai como sem_repeticoes, não sem_carga', () => {
    const corrida = serie({ carga: null, repeticoes: null, duracaoS: 600 });
    assert.deepEqual(volumeDaSerie(corrida, null), { conta: false, motivo: 'sem_repeticoes' });
  });

  it('contaNoVolume separa aquecimento de valida e falha', () => {
    assert.equal(contaNoVolume(serie()), true);
    assert.equal(contaNoVolume(serie({ tipo: 'falha' })), true);
    assert.equal(contaNoVolume(serie({ tipo: 'aquecimento' })), false);
  });
});

// Uma sessão mista de verdade: 9 séries, quatro motivos de exclusão diferentes.
const sessaoMista = (gramasPorPlaca: number | null): SerieComExercicio[] => [
  comExercicio({ id: 'a1', indice: 0, tipo: 'aquecimento', carga: kg(20000), repeticoes: 12 }),
  comExercicio({ id: 'a2', indice: 1 }),
  comExercicio({ id: 'a3', indice: 2 }),
  ...[0, 1, 2].map((i) =>
    comExercicio({
      id: `r${i}`,
      exercicioId: 'ex-remada',
      exercicioNome: 'Remada Alta',
      tipoMedicao: 'carga_placa',
      gramasPorPlaca,
      indice: i,
      carga: placa(5),
      repeticoes: 10,
    })
  ),
  ...[0, 1].map((i) =>
    comExercicio({
      id: `b${i}`,
      exercicioId: 'ex-abdominal',
      exercicioNome: 'Abdominal Supra Solo',
      tipoMedicao: 'peso_corporal',
      indice: i,
      carga: null,
      repeticoes: 20,
    })
  ),
  comExercicio({
    id: 'e1',
    exercicioId: 'ex-esteira',
    exercicioNome: 'Esteira',
    tipoMedicao: 'tempo',
    indice: 0,
    carga: null,
    repeticoes: null,
    duracaoS: 600,
  }),
];

describe('volumeDaSessao', () => {
  it('soma só o que é kg e os quatro contadores fecham com o total de séries', () => {
    const series = sessaoMista(null);
    const v = volumeDaSessao(series);

    assert.equal(v.gramasReps, 800000);
    assert.equal(v.seriesSomadas, 2);
    assert.equal(v.seriesAquecimento, 1);
    assert.equal(v.seriesEmPlacaSemCalibracao, 3);
    assert.equal(v.seriesSemCarga, 2);
    assert.equal(v.seriesSemRepeticoes, 1);

    const contados =
      v.seriesSomadas +
      v.seriesAquecimento +
      v.seriesEmPlacaSemCalibracao +
      v.seriesSemCarga +
      v.seriesSemRepeticoes;
    assert.equal(contados, series.length);
  });

  it('foraDaSoma nomeia cada exercício com o motivo certo, sem juntar abdominal com placa', () => {
    const v = volumeDaSessao(sessaoMista(null));

    assert.deepEqual(v.foraDaSoma, [
      { id: 'ex-supino', nome: 'Supino Inclinado', motivo: 'aquecimento', series: 1 },
      { id: 'ex-remada', nome: 'Remada Alta', motivo: 'placa_sem_calibracao', series: 3 },
      { id: 'ex-abdominal', nome: 'Abdominal Supra Solo', motivo: 'sem_carga', series: 2 },
      { id: 'ex-esteira', nome: 'Esteira', motivo: 'sem_repeticoes', series: 1 },
    ]);

    // A frase da UI: "e mais N exercícios em placa" sai daqui, e conta 1, não 3.
    const emPlaca = v.foraDaSoma.filter((f) => f.motivo === 'placa_sem_calibracao');
    assert.equal(emPlaca.length, 1);
  });

  it('calibrar muda o bucket das MESMAS séries, sem tocar em nenhuma delas', () => {
    const series = sessaoMista(null);
    const antes = structuredClone(series);
    volumeDaSessao(series);
    const depois = volumeDaSessao(sessaoMista(5000));

    assert.deepEqual(series, antes, 'volumeDaSessao não pode mutar a entrada');
    assert.equal(depois.seriesEmPlacaSemCalibracao, 0);
    assert.equal(depois.seriesSomadas, 5);
    assert.equal(depois.gramasReps, 800000 + 750000);
    assert.equal(depois.seriesAproximadas, 3);
    assert.equal(depois.gramasRepsAproximados, 750000);
  });

  it('sessão vazia devolve zeros, não null', () => {
    const v = volumeDaSessao([]);
    assert.equal(v.gramasReps, 0);
    assert.equal(v.seriesSomadas, 0);
    assert.deepEqual(v.foraDaSoma, []);
  });
});

describe('volumeDoExercicio', () => {
  it('devolve o volume na unidade do exercício — placa·rep, nunca convertido', () => {
    const h = {
      exercicio: remadaAlta,
      series: [
        serie({ id: 'r0', exercicioId: 'ex-remada', carga: placa(5), repeticoes: 10 }),
        serie({ id: 'r1', exercicioId: 'ex-remada', carga: placa(6), repeticoes: 8, indice: 1 }),
      ],
    };
    assert.deepEqual(volumeDoExercicio(h), { valor: 5 * 10 + 6 * 8, unidade: 'placa' });
  });

  it('calibrar NÃO converte o volume do exercício: a escala dele continua a dele', () => {
    const calibrada = { ...remadaAlta, gramasPorPlaca: 5000 };
    const series = [serie({ exercicioId: 'ex-remada', carga: placa(5), repeticoes: 10 })];
    assert.deepEqual(volumeDoExercicio({ exercicio: calibrada, series }), {
      valor: 50,
      unidade: 'placa',
    });
  });

  it('ignora aquecimento e devolve null quando não sobra série somável', () => {
    const h = {
      exercicio: exercicio(),
      series: [serie({ tipo: 'aquecimento' })],
    };
    assert.equal(volumeDoExercicio(h), null);
  });

  it('exercício sem carga (esteira, abdominal) não tem volume', () => {
    const esteira = exercicio({ id: 'ex-esteira', nome: 'Esteira', tipoMedicao: 'tempo', incremento: null });
    const series = [serie({ exercicioId: 'ex-esteira', carga: null, repeticoes: null, duracaoS: 600 })];
    assert.equal(volumeDoExercicio({ exercicio: esteira, series }), null);
  });

  it('descarta série com unidade incompatível em vez de somar maçã com laranja', () => {
    const h = {
      exercicio: remadaAlta,
      series: [
        serie({ id: 'r0', exercicioId: 'ex-remada', carga: placa(5), repeticoes: 10 }),
        // Só chega aqui se `registrarSerie` for burlada; ainda assim não entra.
        serie({ id: 'r1', exercicioId: 'ex-remada', carga: kg(40000), repeticoes: 10, indice: 1 }),
      ],
    };
    assert.deepEqual(volumeDoExercicio(h), { valor: 50, unidade: 'placa' });
  });
});

describe('sugerirCarga', () => {
  const alvo = { seriesAlvo: 3, repsAlvoMin: 8 };
  const tres = (p: Partial<SerieExecutada> = {}) =>
    [0, 1, 2].map((i) => serie({ id: `s${i}`, indice: i, concluidaEm: 1000 + i, ...p }));

  it('sobe um incremento quando bateu todas as séries no alvo', () => {
    const h = { exercicio: exercicio(), series: tres() };
    assert.deepEqual(sugerirCarga(h, alvo), kg(42500));
  });

  it('em placa sobe UMA placa, nunca 2500', () => {
    const series = tres({ exercicioId: 'ex-remada', carga: placa(5) });
    assert.deepEqual(sugerirCarga({ exercicio: remadaAlta, series }, alvo), placa(6));
  });

  it('mantém quando faltou repetição em alguma série', () => {
    const series = tres();
    series[2] = serie({ id: 's2', indice: 2, concluidaEm: 1002, repeticoes: 6 });
    assert.deepEqual(sugerirCarga({ exercicio: exercicio(), series }, alvo), kg(40000));
  });

  it('mantém quando fez menos séries que o alvo', () => {
    const series = tres().slice(0, 2);
    assert.deepEqual(sugerirCarga({ exercicio: exercicio(), series }, alvo), kg(40000));
  });

  it('nunca reduz sozinha — reduzir é decisão do Henrique', () => {
    const series = tres({ repeticoes: 1 });
    assert.deepEqual(sugerirCarga({ exercicio: exercicio(), series }, alvo), kg(40000));
  });

  it('ignora o aquecimento ao decidir', () => {
    const series = [
      serie({ id: 'aq', indice: 0, tipo: 'aquecimento', carga: kg(20000), repeticoes: 15, concluidaEm: 999 }),
      ...tres(),
    ];
    assert.deepEqual(sugerirCarga({ exercicio: exercicio(), series }, alvo), kg(42500));
  });

  it('sem histórico com carga, não sugere nada', () => {
    assert.equal(sugerirCarga({ exercicio: exercicio(), series: [] }, alvo), null);
    const semCarga = [serie({ carga: null, repeticoes: 20 })];
    assert.equal(sugerirCarga({ exercicio: exercicio(), series: semCarga }, alvo), null);
  });

  it('exercício sem carga nenhuma não gera sugestão', () => {
    const esteira = exercicio({ id: 'ex-esteira', tipoMedicao: 'tempo', incremento: null });
    const series = [serie({ exercicioId: 'ex-esteira', carga: null, repeticoes: null, duracaoS: 600 })];
    assert.equal(sugerirCarga({ exercicio: esteira, series }, alvo), null);
  });

  it('sem reps-alvo, repete a última carga em vez de subir no escuro', () => {
    const h = { exercicio: exercicio(), series: tres() };
    assert.deepEqual(sugerirCarga(h, { seriesAlvo: 3, repsAlvoMin: null }), kg(40000));
  });

  it('olha só a ÚLTIMA sessão: a semana retrasada não abaixa nem sobe a sugestão de hoje', () => {
    const antiga = tres({ sessaoId: 'antiga', carga: kg(30000), repeticoes: 3 }).map((s, i) => ({
      ...s,
      id: `v${i}`,
      concluidaEm: 100 + i,
    }));
    const h = { exercicio: exercicio(), series: [...antiga, ...tres()] };
    assert.deepEqual(sugerirCarga(h, alvo), kg(42500));
  });
});

describe('formatarVolumeNaUnidade', () => {
  it('kg passa por formatarVolume; placa tem texto próprio, SEM til', () => {
    // Sem til de propósito: placa·rep é exato NA ESCALA do exercício. O que ele
    // não é, é somável com o de outro exercício.
    assert.equal(formatarVolumeNaUnidade({ valor: 720_000, unidade: 'kg' }), '720 kg·rep');
    assert.equal(formatarVolumeNaUnidade({ valor: 108, unidade: 'placa' }), '108 placa·rep');
  });

  it('placa no singular também escreve "placa·rep" — é unidade, não contagem', () => {
    assert.equal(formatarVolumeNaUnidade({ valor: 1, unidade: 'placa' }), '1 placa·rep');
  });
});

describe('progressaoDoExercicio', () => {
  const sessao = (sessaoId: string, inicio: number, cargas: readonly number[]) =>
    cargas.map((gramas, i) => serie({ id: `${sessaoId}-${i}`, sessaoId, indice: i, carga: kg(gramas), concluidaEm: inicio + i }));

  it('4×10 num dia viram UM ponto, com a melhor carga da sessão', () => {
    const h = { exercicio: exercicio(), series: sessao('s1', 1000, [40000, 42500, 40000, 40000]) };
    const pontos = progressaoDoExercicio(h);

    assert.equal(pontos.length, 1, 'quatro séries, um ponto');
    assert.deepEqual(pontos[0], {
      sessaoId: 's1',
      // O INÍCIO da sessão, não a última série: é a data que a lista imprime.
      instante: 1000,
      melhorCarga: kg(42500),
      repeticoes: 40,
      duracaoS: 0,
      series: 4,
    });
  });

  it('ordena por instante mesmo com a lista embaralhada', () => {
    const h = {
      exercicio: exercicio(),
      series: [...sessao('s3', 3000, [45000]), ...sessao('s1', 1000, [40000]), ...sessao('s2', 2000, [42500])],
    };
    assert.deepEqual(
      progressaoDoExercicio(h).map((p) => p.sessaoId),
      ['s1', 's2', 's3']
    );
  });

  it('AQUECIMENTO fora: senão a curva sobe no dia em que ele só aqueceu mais', () => {
    const series = [
      serie({ id: 'a', indice: 0, tipo: 'aquecimento', carga: kg(60000), repeticoes: 15 }),
      serie({ id: 'b', indice: 1, carga: kg(40000), repeticoes: 10 }),
    ];
    const pontos = progressaoDoExercicio({ exercicio: exercicio(), series });

    assert.equal(pontos.length, 1);
    assert.deepEqual(pontos[0].melhorCarga, kg(40000), 'os 60 kg de aquecimento não são o pico');
    assert.equal(pontos[0].series, 1);
    assert.equal(pontos[0].repeticoes, 10);
  });

  it('descarta série de unidade INCOMPATÍVEL em vez de compará-la (5 placas > 42500 g)', () => {
    // A guarda de runtime: sem ela, `valorDaCarga` compararia 5 com 42500 e a
    // placa nunca seria o pico — mas ela também não pode ENTRAR como pico.
    const series = [
      serie({ id: 'a', indice: 0, carga: kg(42500) }),
      serie({ id: 'b', indice: 1, carga: placa(5) }),
    ];
    const pontos = progressaoDoExercicio({ exercicio: exercicio(), series });

    assert.deepEqual(pontos[0].melhorCarga, kg(42500));
    // A série continua CONTADA (ela aconteceu); só não vira carga.
    assert.equal(pontos[0].series, 2);
  });

  it('exercício sem carga soma repetição e duração, com melhorCarga null', () => {
    const esteira = exercicio({ id: 'ex-esteira', tipoMedicao: 'tempo', incremento: null });
    const series = [
      serie({ id: 'a', exercicioId: 'ex-esteira', carga: null, repeticoes: null, duracaoS: 600 }),
      serie({ id: 'b', exercicioId: 'ex-esteira', indice: 1, carga: null, repeticoes: null, duracaoS: 300 }),
    ];
    const pontos = progressaoDoExercicio({ exercicio: esteira, series });

    assert.equal(pontos[0].melhorCarga, null);
    assert.equal(pontos[0].duracaoS, 900);
    assert.equal(pontos[0].repeticoes, 0);
  });

  it('histórico vazio e histórico só de aquecimento devolvem lista vazia', () => {
    assert.deepEqual(progressaoDoExercicio({ exercicio: exercicio(), series: [] }), []);
    assert.deepEqual(
      progressaoDoExercicio({ exercicio: exercicio(), series: [serie({ tipo: 'aquecimento' })] }),
      []
    );
  });

  it('não muta a entrada', () => {
    const series = sessao('s1', 1000, [40000, 42500]);
    const copia = structuredClone(series);
    progressaoDoExercicio({ exercicio: exercicio(), series });
    assert.deepEqual(series, copia);
  });
});

describe('valorDaProgressao', () => {
  const ponto = { sessaoId: 's1', instante: 1000, melhorCarga: kg(42500), repeticoes: 40, duracaoS: 0, series: 4 };

  it('em kg é a carga em GRAMA CRUA — a escala do próprio exercício, nunca convertida', () => {
    assert.equal(valorDaProgressao(ponto, exercicio()), 42500);
  });

  it('em placa é o número de placas, e calibrar NÃO muda a escala do gráfico', () => {
    const semCalibrar = { ...remadaAlta };
    const calibrada = exercicio({ ...remadaAlta, gramasPorPlaca: 5000 });
    const p = { ...ponto, melhorCarga: placa(5) };

    assert.equal(valorDaProgressao(p, semCalibrar), 5);
    assert.equal(valorDaProgressao(p, calibrada), 5, 'a curva do exercício continua em placa');
  });

  it('peso corporal progride em REPETIÇÃO; tempo, em segundo', () => {
    const abdominal = exercicio({ tipoMedicao: 'peso_corporal', incremento: null });
    const esteira = exercicio({ tipoMedicao: 'tempo', incremento: null });
    const p = { ...ponto, melhorCarga: null, repeticoes: 48, duracaoS: 600 };

    assert.equal(valorDaProgressao(p, abdominal), 48);
    assert.equal(valorDaProgressao(p, esteira), 600);
  });

  it('exercício com carga e sessão sem carga vale 0 — o ponto existe, o buraco não', () => {
    assert.equal(valorDaProgressao({ ...ponto, melhorCarga: null }, exercicio()), 0);
  });
});
