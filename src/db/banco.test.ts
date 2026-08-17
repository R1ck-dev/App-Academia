/**
 * O teste de encaixe: migration real, escrita pelas mutations, leitura pelas
 * queries, conta pelo domínio — tudo contra SQLite de verdade.
 *
 * Os outros arquivos de `src/db` provam cada camada isolada (`mutations.test.ts`
 * escreve e lê por SQL cru, `queries.test.ts` monta fixture por `db.insert`).
 * Aqui nada é atalho: se `colunasDaCarga` gravar na coluna que `cargaDaLinha` não
 * lê, é este arquivo que cai — e é a única prova de que as duas pontas combinam.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { kg, placa } from '../dominio/carga.ts';
import { calcularImc } from '../dominio/corpo.ts';
import { proximoIndice } from '../dominio/execucao.ts';
import { volumeDaSessao } from '../dominio/volume.ts';
import { criarBancoDeTeste, type BancoDeTeste } from './banco-de-teste.ts';
import { agora } from './conexao.ts';
import {
  arquivarExercicio,
  arquivarPesagem,
  calibrarPlaca,
  criarExercicio,
  desfazerSerie,
  finalizarSessao,
  iniciarSessao,
  registrarMedida,
  registrarPesagem,
  registrarSerie,
  salvarAltura,
} from './mutations.ts';
import {
  historicoDoExercicio,
  historicoMedidas,
  historicoPeso,
  indicesOcupados,
  listarExercicios,
  obterPerfil,
  seriesDaSessao,
  seriesDaSessaoComExercicio,
  sessaoEmAndamento,
  ultimaPesagem,
} from './queries.ts';

const DIA = 24 * 60 * 60 * 1000;

let banco: BancoDeTeste;

beforeEach(() => {
  banco = criarBancoDeTeste();
});

/** `iniciarSessao` devolve resultado, não id: o caminho feliz vira uma linha só. */
function abrirSessao(nome: string, treinoId?: string): string {
  const r = iniciarSessao({ nome, treinoId });
  assert.ok(r.ok, `esperava abrir a sessão ${nome}`);
  return r.sessaoId;
}

function contar(tabela: string): number {
  const linha = banco.bruto.prepare(`select count(*) as n from ${tabela}`).get() as { n: number };
  return linha.n;
}

describe('migration inicial', () => {
  it('cria as nove tabelas do schema', () => {
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
      'perfil',
      'pesagens',
      'medidas',
      'preferencias',
    ]) {
      assert.ok(tabelas.includes(esperada), `faltou a tabela ${esperada}`);
    }
  });
});

describe('as travas que são do banco', () => {
  it('o CHECK barra a série com as DUAS cargas — a mistura de unidade não chega a existir', () => {
    const ex = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrirSessao('Treino A');

    // Insert CRU, por fora das mutations: o que está sob teste aqui é o SQLite,
    // não a validação de aplicação.
    assert.throws(
      () =>
        banco.bruto.exec(`insert into series
          (id, sessao_id, exercicio_id, indice, tipo, carga_g, carga_placas, repeticoes, concluida_em, criado_em, atualizado_em)
          values ('serie-torta', '${sessao}', '${ex}', 0, 'valida', 40000, 5, 10, 1, 1, 1)`),
      /ck_series_uma_unidade/
    );
    assert.equal(contar('series'), 0);
  });

  it('o CHECK barra exercício de placa com incremento em gramas', () => {
    assert.throws(
      () =>
        banco.bruto.exec(`insert into exercicios
          (id, nome, tipo_medicao, incremento_g, criado_em, atualizado_em)
          values ('ex-torto', 'Remada Alta', 'carga_placa', 2500, 1, 1)`),
      /ck_exercicios_incremento/
    );
    assert.equal(contar('exercicios'), 0);
  });

  it('o índice parcial barra a segunda sessão aberta, e volta a aceitar depois de finalizar', () => {
    const primeira = abrirSessao('Treino A');

    // Pela mutation: fluxo normal, com caminho limpo para a tela.
    const segunda = iniciarSessao({ nome: 'Treino B' });
    assert.deepEqual(segunda, { ok: false, jaAberta: primeira });

    // Pelo banco: nem um bug de tela consegue criar a segunda.
    assert.throws(
      () =>
        banco.bruto.exec(`insert into sessoes
          (id, nome, iniciada_em, criado_em, atualizado_em)
          values ('sessao-fantasma', 'Treino B', 1, 1, 1)`),
      /uq_sessao_aberta/
    );
    assert.equal(contar('sessoes'), 1);

    banco.avancarRelogio(60 * 60 * 1000);
    finalizarSessao(primeira);
    const terceira = abrirSessao('Treino B');
    assert.notEqual(terceira, primeira);
    assert.equal(sessaoEmAndamento()?.id, terceira);
  });

  it('refinalizar não reescreve o instante da primeira vez', () => {
    const sessao = abrirSessao('Treino A');
    banco.avancarRelogio(60 * 60 * 1000);
    finalizarSessao(sessao);

    const primeiroFim = banco.bruto
      .prepare('select finalizada_em from sessoes where id = ?')
      .get(sessao) as { finalizada_em: number };

    banco.avancarRelogio(3 * 60 * 60 * 1000);
    finalizarSessao(sessao);

    const depois = banco.bruto
      .prepare('select finalizada_em from sessoes where id = ?')
      .get(sessao) as { finalizada_em: number };
    assert.equal(depois.finalizada_em, primeiroFim.finalizada_em);
  });
});

describe('a trava que é das mutations', () => {
  it('gravar placa num exercício de kg LANÇA, e nada é escrito', () => {
    const supino = criarExercicio({ nome: 'Supino Inclinado Barra', tipoMedicao: 'carga_kg' });
    const sessao = abrirSessao('Treino A');

    assert.throws(
      () => registrarSerie({ sessaoId: sessao, exercicioId: supino, indice: 0, carga: placa(5), repeticoes: 10 }),
      /incompatível/i
    );
    assert.equal(contar('series'), 0);
  });

  it('gravar kg num exercício de placa LANÇA — o CHECK do SQLite não alcança isso', () => {
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrirSessao('Treino A');

    assert.throws(
      () => registrarSerie({ sessaoId: sessao, exercicioId: peck, indice: 0, carga: kg(40000), repeticoes: 10 }),
      /incompatível/i
    );
    assert.equal(contar('series'), 0);
  });
});

describe('sessão de treino', () => {
  it('a carga vai para a coluna da unidade e volta como Carga da mesma unidade', () => {
    const supino = criarExercicio({ nome: 'Supino Inclinado Barra', tipoMedicao: 'carga_kg' });
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const sessao = abrirSessao('Treino A');

    // O relógio anda entre as séries: `seriesDaSessao` devolve na ordem em que as
    // coisas aconteceram, e num treino o índice reinicia a cada exercício.
    registrarSerie({ sessaoId: sessao, exercicioId: supino, indice: 0, tipo: 'aquecimento', carga: kg(20000), repeticoes: 15 });
    banco.avancarRelogio(2 * 60 * 1000);
    registrarSerie({ sessaoId: sessao, exercicioId: supino, indice: 1, carga: kg(40000), repeticoes: 10 });
    banco.avancarRelogio(2 * 60 * 1000);
    registrarSerie({ sessaoId: sessao, exercicioId: peck, indice: 0, carga: placa(5), repeticoes: 12 });

    const colunas = (
      banco.bruto
        .prepare('select carga_g, carga_placas from series order by exercicio_id, indice')
        .all() as { carga_g: number | null; carga_placas: number | null }[]
      // `node:sqlite` devolve objeto sem protótipo; o spread o normaliza para o
      // `deepEqual` estrito não reprovar por causa do protótipo.
    ).map((l) => ({ ...l }));
    // `carga_g` NUNCA contém placa: é o que mantém correto qualquer `sum(carga_g)`.
    assert.deepEqual(colunas, [
      { carga_g: 20000, carga_placas: null },
      { carga_g: 40000, carga_placas: null },
      { carga_g: null, carga_placas: 5 },
    ]);

    const lidas = seriesDaSessao(sessao);
    assert.equal(lidas.length, 3);
    assert.deepEqual(
      lidas.map((s) => s.carga),
      [kg(20000), kg(40000), placa(5)]
    );
  });

  it('série sem carga (peso corporal) grava null nas DUAS colunas, não zero', () => {
    const barra = criarExercicio({ nome: 'Abdominal Supra Solo', tipoMedicao: 'peso_corporal' });
    const sessao = abrirSessao('Treino A');
    registrarSerie({ sessaoId: sessao, exercicioId: barra, indice: 0, carga: null, repeticoes: 12 });

    const bruta = banco.bruto.prepare('select carga_g, carga_placas from series').get() as {
      carga_g: number | null;
      carga_placas: number | null;
    };
    assert.deepEqual({ ...bruta }, { carga_g: null, carga_placas: null });
    assert.equal(seriesDaSessao(sessao)[0].carga, null);
  });

  it('recusa duas séries com o mesmo índice — o duplo toque no botão', () => {
    const ex = criarExercicio({ nome: 'Remada Alta', tipoMedicao: 'carga_placa' });
    const sessao = abrirSessao('Treino A');
    registrarSerie({ sessaoId: sessao, exercicioId: ex, indice: 0, carga: placa(5), repeticoes: 10 });

    assert.throws(() =>
      registrarSerie({ sessaoId: sessao, exercicioId: ex, indice: 0, carga: placa(5), repeticoes: 10 })
    );
    assert.equal(contar('series'), 1);
  });

  it('desfazer a série 2 e registrar de novo não estoura o UNIQUE', () => {
    const ex = criarExercicio({ nome: 'Remada Alta', tipoMedicao: 'carga_placa' });
    const sessao = abrirSessao('Treino A');
    registrarSerie({ sessaoId: sessao, exercicioId: ex, indice: 0, carga: placa(5), repeticoes: 10 });
    registrarSerie({ sessaoId: sessao, exercicioId: ex, indice: 1, carga: placa(5), repeticoes: 10 });
    const terceira = registrarSerie({ sessaoId: sessao, exercicioId: ex, indice: 2, carga: placa(5), repeticoes: 8 });

    desfazerSerie(terceira);

    // `feitas.length` daria 2 — e 2 já está ocupado pela série desfeita, porque o
    // UNIQUE não filtra `arquivado_em`. Só `indicesOcupados` enxerga isso.
    assert.deepEqual(seriesDaSessao(sessao).length, 2);
    assert.deepEqual(indicesOcupados(sessao, ex), [0, 1, 2]);
    const indice = proximoIndice(indicesOcupados(sessao, ex));
    assert.equal(indice, 3);

    registrarSerie({ sessaoId: sessao, exercicioId: ex, indice, carga: placa(6), repeticoes: 10 });
    assert.equal(seriesDaSessao(sessao).length, 3);
    assert.equal(contar('series'), 4);
  });
});

describe('volume ponta a ponta', () => {
  /** Sessão mista: kg, placa sem calibração, peso corporal e esteira. */
  function sessaoMista() {
    const supino = criarExercicio({ nome: 'Supino Inclinado Barra', tipoMedicao: 'carga_kg' });
    const peck = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const abdominal = criarExercicio({ nome: 'Abdominal Supra Solo', tipoMedicao: 'peso_corporal' });
    const esteira = criarExercicio({ nome: 'Esteira', tipoMedicao: 'tempo' });
    const sessao = abrirSessao('Treino A');

    registrarSerie({ sessaoId: sessao, exercicioId: supino, indice: 0, tipo: 'aquecimento', carga: kg(20000), repeticoes: 15 });
    registrarSerie({ sessaoId: sessao, exercicioId: supino, indice: 1, carga: kg(40000), repeticoes: 10 });
    registrarSerie({ sessaoId: sessao, exercicioId: peck, indice: 0, carga: placa(5), repeticoes: 10 });
    registrarSerie({ sessaoId: sessao, exercicioId: peck, indice: 1, carga: placa(5), repeticoes: 10 });
    registrarSerie({ sessaoId: sessao, exercicioId: abdominal, indice: 0, carga: null, repeticoes: 12 });
    registrarSerie({ sessaoId: sessao, exercicioId: esteira, indice: 0, carga: null, duracaoS: 600 });

    return { sessao, supino, peck, abdominal, esteira };
  }

  it('soma só o que é kg e diz, nomeando, o que ficou de fora', () => {
    const { sessao, peck, abdominal, esteira } = sessaoMista();

    const series = seriesDaSessaoComExercicio(sessao);
    const v = volumeDaSessao(series);

    assert.equal(v.gramasReps, 40000 * 10);
    assert.equal(v.seriesSomadas, 1);
    assert.equal(v.seriesAquecimento, 1);
    assert.equal(v.seriesEmPlacaSemCalibracao, 2);
    assert.equal(v.seriesSemCarga, 1);
    assert.equal(v.seriesSemRepeticoes, 1);
    // Nada some em silêncio: os quatro motivos mais as somadas fecham com o total.
    assert.equal(
      v.seriesSomadas +
        v.seriesAquecimento +
        v.seriesEmPlacaSemCalibracao +
        v.seriesSemCarga +
        v.seriesSemRepeticoes,
      series.length
    );

    const motivos = Object.fromEntries(v.foraDaSoma.map((f) => [f.id, f.motivo]));
    assert.equal(motivos[peck], 'placa_sem_calibracao');
    // Abdominal e esteira NUNCA no balde das placas — é a frase do resumo.
    assert.equal(motivos[abdominal], 'sem_carga');
    assert.equal(motivos[esteira], 'sem_repeticoes');
  });

  it('calibrar a placa muda o bucket sem reescrever uma linha de série', () => {
    const { sessao, peck } = sessaoMista();

    const antes = banco.bruto
      .prepare('select id, carga_g, carga_placas, atualizado_em from series order by id')
      .all();

    assert.deepEqual(calibrarPlaca(peck, 5000), { ok: true });

    const depois = banco.bruto
      .prepare('select id, carga_g, carga_placas, atualizado_em from series order by id')
      .all();
    assert.deepEqual(depois, antes, 'calibrar não pode tocar em `series`');

    const v = volumeDaSessao(seriesDaSessaoComExercicio(sessao));
    assert.equal(v.gramasReps, 40000 * 10 + 2 * (5 * 5000 * 10));
    assert.equal(v.seriesEmPlacaSemCalibracao, 0);
    assert.equal(v.seriesSomadas, 3);
    // As duas convertidas entram MARCADAS: a conversão é crença, não medição.
    assert.equal(v.seriesAproximadas, 2);
    assert.equal(v.gramasRepsAproximados, 2 * (5 * 5000 * 10));
  });
});

describe('soft delete', () => {
  it('exercício arquivado some do catálogo e mantém o histórico', () => {
    const ex = criarExercicio({ nome: 'Rosca Direta Polia', tipoMedicao: 'carga_placa' });
    const sessao = abrirSessao('Treino A');
    registrarSerie({ sessaoId: sessao, exercicioId: ex, indice: 0, carga: placa(3), repeticoes: 12 });

    arquivarExercicio(ex);

    assert.equal(listarExercicios().length, 0);
    const historico = historicoDoExercicio(ex);
    assert.ok(historico, 'o histórico do exercício arquivado continua existindo');
    assert.equal(historico.series.length, 1);
    assert.deepEqual(historico.series[0].carga, placa(3));
    assert.notEqual(historico.exercicio.arquivadoEm, null);
    assert.equal(contar('exercicios'), 1);
  });

  it('pesagem arquivada some do histórico e a linha continua no SQLite', () => {
    const primeira = registrarPesagem({ pesoG: 78400 });
    banco.avancarRelogio(DIA);
    registrarPesagem({ pesoG: 78100 });

    arquivarPesagem(primeira);

    assert.deepEqual(
      historicoPeso().map((p) => p.pesoG),
      [78100]
    );
    assert.equal(contar('pesagens'), 2);
  });
});

describe('corpo', () => {
  it('pesagem retroativa entra na posição cronológica, não na ordem em que foi digitada', () => {
    // O relógio injetado, lido de onde as mutations o leem: repetir o literal do
    // `banco-de-teste.ts` aqui seria um segundo lugar para errar a data.
    const inicio = agora();

    registrarPesagem({ pesoG: 78400 });
    banco.avancarRelogio(DIA);
    registrarPesagem({ pesoG: 78100 });
    // Lançada por último, medida três dias antes das outras duas.
    registrarPesagem({ pesoG: 79000, medidoEm: inicio - 3 * DIA });

    assert.deepEqual(
      historicoPeso().map((p) => p.pesoG),
      [79000, 78400, 78100]
    );
    // "O peso de hoje" é o de maior `medido_em`, não o gravado por último.
    assert.equal(ultimaPesagem()?.pesoG, 78100);
  });

  it('guarda medida na menor unidade, com a parte que veio no objeto', () => {
    registrarMedida({ parte: 'braco_direito', valorMm: 385 });
    const medidas = historicoMedidas();
    assert.equal(medidas.length, 1);
    assert.equal(medidas[0].parte, 'braco_direito');
    assert.equal(medidas[0].valorMm, 385);
  });

  it('ponta a ponta: altura no perfil + pesagem viram IMC pelo domínio', () => {
    salvarAltura(1780);
    registrarPesagem({ pesoG: 78400 });

    const perfil = obterPerfil();
    const pesagem = ultimaPesagem();
    assert.ok(perfil && pesagem);

    const imc = calcularImc(pesagem.pesoG, perfil.alturaMm);
    assert.deepEqual(imc, { centesimos: 2474, categoria: 'normal' });
  });
});
