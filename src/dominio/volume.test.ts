import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kg } from './carga.ts';
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
  ...p,
});

const exercicio = (p: Partial<Exercicio> = {}): Exercicio => ({
  id: 'ex-supino',
  nome: 'Supino Inclinado',
  grupoMuscular: 'peito',
  tipoMedicao: 'carga_kg',
  incremento: kg(2500),
  arquivadoEm: null,
  ...p,
});

const remadaAlta = exercicio({
  id: 'ex-remada',
  nome: 'Remada Alta',
  grupoMuscular: 'costas',
});

const abdominal = exercicio({
  id: 'ex-abdominal',
  nome: 'Abdominal Supra Solo',
  grupoMuscular: 'core',
  tipoMedicao: 'peso_corporal',
  incremento: null,
});

describe('volumeDaSerie', () => {
  it('multiplica carga por repetições', () => {
    assert.deepEqual(volumeDaSerie(serie()), { conta: true, gramasReps: 400000 });
  });

  it('aquecimento fica de fora — senão o gráfico sobe quando só se aqueceu mais', () => {
    assert.deepEqual(volumeDaSerie(serie({ tipo: 'aquecimento', carga: kg(20000) })), {
      conta: false,
      motivo: 'aquecimento',
    });
  });

  it('série levada à falha conta', () => {
    assert.equal(volumeDaSerie(serie({ tipo: 'falha' })).conta, true);
  });

  it('peso corporal sai como sem_carga', () => {
    assert.deepEqual(volumeDaSerie(serie({ carga: null, repeticoes: 20 })), {
      conta: false,
      motivo: 'sem_carga',
    });
  });

  it('esteira (sem carga e sem repetição) sai como sem_repeticoes, não sem_carga', () => {
    // A ORDEM dos testes é o que separa os dois: se `sem_carga` viesse antes, a
    // frase do resumo chamaria a corrida de "série sem carga".
    const corrida = serie({ carga: null, repeticoes: null, duracaoS: 600 });
    assert.deepEqual(volumeDaSerie(corrida), { conta: false, motivo: 'sem_repeticoes' });
  });

  it('contaNoVolume separa aquecimento de valida e falha', () => {
    assert.equal(contaNoVolume(serie()), true);
    assert.equal(contaNoVolume(serie({ tipo: 'falha' })), true);
    assert.equal(contaNoVolume(serie({ tipo: 'aquecimento' })), false);
  });
});

// Uma sessão mista de verdade: 9 séries, três motivos de exclusão diferentes.
const sessaoMista = (): SerieComExercicio[] => [
  comExercicio({ id: 'a1', indice: 0, tipo: 'aquecimento', carga: kg(20000), repeticoes: 12 }),
  comExercicio({ id: 'a2', indice: 1 }),
  comExercicio({ id: 'a3', indice: 2 }),
  ...[0, 1, 2].map((i) =>
    comExercicio({
      id: `r${i}`,
      exercicioId: 'ex-remada',
      exercicioNome: 'Remada Alta',
      indice: i,
      carga: kg(25000),
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
  it('soma o que tem carga e os contadores fecham com o total de séries', () => {
    const series = sessaoMista();
    const v = volumeDaSessao(series);

    assert.equal(v.gramasReps, 800000 + 750000);
    assert.equal(v.seriesSomadas, 5);
    assert.equal(v.seriesAquecimento, 1);
    assert.equal(v.seriesSemCarga, 2);
    assert.equal(v.seriesSemRepeticoes, 1);

    // O total tem que fechar: uma série que sumisse de todos os buckets sairia
    // do relatório sem ninguém notar.
    const contados =
      v.seriesSomadas + v.seriesAquecimento + v.seriesSemCarga + v.seriesSemRepeticoes;
    assert.equal(contados, series.length);
  });

  it('foraDaSoma nomeia cada exercício com o motivo certo, sem juntar abdominal com esteira', () => {
    const v = volumeDaSessao(sessaoMista());

    assert.deepEqual(v.foraDaSoma, [
      { id: 'ex-supino', nome: 'Supino Inclinado', motivo: 'aquecimento', series: 1 },
      { id: 'ex-abdominal', nome: 'Abdominal Supra Solo', motivo: 'sem_carga', series: 2 },
      { id: 'ex-esteira', nome: 'Esteira', motivo: 'sem_repeticoes', series: 1 },
    ]);

    // A frase da UI: "e mais N exercícios sem carga" sai daqui, e conta 1, não 2.
    const semCarga = v.foraDaSoma.filter((f) => f.motivo === 'sem_carga');
    assert.equal(semCarga.length, 1);
  });

  it('não muta a entrada', () => {
    const series = sessaoMista();
    const antes = structuredClone(series);
    volumeDaSessao(series);
    assert.deepEqual(series, antes);
  });

  it('sessão vazia devolve zeros, não null', () => {
    const v = volumeDaSessao([]);
    assert.equal(v.gramasReps, 0);
    assert.equal(v.seriesSomadas, 0);
    assert.deepEqual(v.foraDaSoma, []);
  });
});

describe('volumeDoExercicio', () => {
  it('soma carga × repetições de todas as séries válidas', () => {
    const h = {
      exercicio: remadaAlta,
      series: [
        serie({ id: 'r0', exercicioId: 'ex-remada', carga: kg(25000), repeticoes: 10 }),
        serie({ id: 'r1', exercicioId: 'ex-remada', carga: kg(30000), repeticoes: 8, indice: 1 }),
      ],
    };
    assert.deepEqual(volumeDoExercicio(h), { valor: 25000 * 10 + 30000 * 8 });
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

  it('descarta carga gravada num exercício que não deveria ter carga', () => {
    const h = {
      exercicio: abdominal,
      series: [
        serie({ id: 'b0', exercicioId: 'ex-abdominal', carga: null, repeticoes: 20 }),
        // Só chega aqui se `registrarSerie` for burlada; ainda assim não entra.
        serie({ id: 'b1', exercicioId: 'ex-abdominal', carga: kg(40000), repeticoes: 10, indice: 1 }),
      ],
    };
    assert.equal(volumeDoExercicio(h), null);
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
  it('nenhuma tela divide por 1000 — a formatação mora aqui', () => {
    assert.equal(formatarVolumeNaUnidade({ valor: 720_000 }), '720 kg·rep');
    assert.equal(formatarVolumeNaUnidade({ valor: 0 }), '0 kg·rep');
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

  it('carga num exercício que não tem carga é descartada, mas a série continua contada', () => {
    // A guarda de runtime: só chega aqui dado que burlou `registrarSerie`, e
    // ainda assim ele não pode virar o pico da curva. A série aconteceu — some
    // do eixo da carga, não da contagem.
    const series = [
      serie({ id: 'a', exercicioId: 'ex-abdominal', indice: 0, carga: null, repeticoes: 20 }),
      serie({ id: 'b', exercicioId: 'ex-abdominal', indice: 1, carga: kg(42500), repeticoes: 20 }),
    ];
    const pontos = progressaoDoExercicio({ exercicio: abdominal, series });

    assert.equal(pontos[0].melhorCarga, null);
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

  it('em exercício com carga é a carga em GRAMA', () => {
    assert.equal(valorDaProgressao(ponto, exercicio()), 42500);
  });

  it('peso corporal progride em REPETIÇÃO; tempo, em segundo', () => {
    const esteira = exercicio({ tipoMedicao: 'tempo', incremento: null });
    const p = { ...ponto, melhorCarga: null, repeticoes: 48, duracaoS: 600 };

    assert.equal(valorDaProgressao(p, abdominal), 48);
    assert.equal(valorDaProgressao(p, esteira), 600);
  });

  it('exercício com carga e sessão sem carga vale 0 — o ponto existe, o buraco não', () => {
    assert.equal(valorDaProgressao({ ...ponto, melhorCarga: null }, exercicio()), 0);
  });
});
