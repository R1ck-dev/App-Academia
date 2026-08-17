import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PARTES_CORPO } from '../db/schema.ts';
import { formatarMedida } from './carga.ts';
import type { Ponto } from './datas.ts';
import {
  ALTURA_MAX_MM,
  ALTURA_MIN_MM,
  calcularImc,
  categoriaDoImc,
  estatisticaDaMedida,
  estatisticaDaSerie,
  estatisticaDoPeso,
  faixaPesoNormal,
  filtrarPeriodo,
  formatarAltura,
  formatarImc,
  formatarVariacao,
  formatarVariacaoDaMedida,
  IMC_NORMAL_MAX_CENT,
  IMC_NORMAL_MIN_CENT,
  MIN_DIAS_PARA_RITMO,
  MIN_PESAGENS_PARA_RITMO,
  parseAltura,
  parseCentimetros,
  periodoDeDias,
  pesoAtual,
  pesoParaImc,
  progressoObjetivo,
  ritmoSemanal,
  rotuloCategoria,
  rotuloDaParte,
} from './corpo.ts';

const MS_DIA = 24 * 60 * 60 * 1000;
const MS_SEMANA = 7 * MS_DIA;
/** Relógio congelado: teste de série temporal com `Date.now()` quebra sozinho. */
const T0 = Date.UTC(2026, 0, 1, 8, 0, 0);

const pontosACada = (intervaloMs: number, valores: number[]): Ponto[] =>
  valores.map((valor, i) => ({ instante: T0 + i * intervaloMs, valor }));

const pesagensACada = (intervaloMs: number, pesos: number[]) =>
  pesos.map((pesoG, i) => ({ medidoEm: T0 + i * intervaloMs, pesoG }));

describe('IMC', () => {
  it('78,4 kg em 1,78 m dá 24,74 e cai em peso normal', () => {
    assert.deepEqual(calcularImc(78400, 1780), { centesimos: 2474, categoria: 'normal' });
    assert.equal(formatarImc(2474), '24,7');
  });

  it('sem altura não há IMC — a tela pede a altura em vez de inventar número', () => {
    assert.equal(calcularImc(78400, null), null);
  });

  it('altura 178 (centímetro digitado no campo de milímetro) devolve null, não IMC 247400', () => {
    assert.equal(calcularImc(78400, 178), null);
    assert.equal(calcularImc(78400, ALTURA_MIN_MM - 1), null);
    assert.equal(calcularImc(78400, ALTURA_MAX_MM + 1), null);
  });

  it('peso não positivo não vira IMC', () => {
    assert.equal(calcularImc(0, 1780), null);
    assert.equal(calcularImc(-1000, 1780), null);
  });

  it('as fronteiras da categoria são exatamente as constantes exportadas', () => {
    assert.equal(categoriaDoImc(IMC_NORMAL_MIN_CENT - 1), 'abaixo_do_peso');
    assert.equal(categoriaDoImc(IMC_NORMAL_MIN_CENT), 'normal');
    assert.equal(categoriaDoImc(IMC_NORMAL_MAX_CENT), 'normal');
    assert.equal(categoriaDoImc(IMC_NORMAL_MAX_CENT + 1), 'sobrepeso');
  });

  it('cobre a escala inteira, de abaixo do peso a obesidade grau 3', () => {
    assert.equal(categoriaDoImc(1700), 'abaixo_do_peso');
    assert.equal(categoriaDoImc(2200), 'normal');
    assert.equal(categoriaDoImc(2999), 'sobrepeso');
    assert.equal(categoriaDoImc(3000), 'obesidade_1');
    assert.equal(categoriaDoImc(3499), 'obesidade_1');
    assert.equal(categoriaDoImc(3500), 'obesidade_2');
    assert.equal(categoriaDoImc(3999), 'obesidade_2');
    assert.equal(categoriaDoImc(4000), 'obesidade_3');
  });

  it('rótulo de categoria existe para as seis, sem cair em undefined', () => {
    assert.equal(rotuloCategoria('normal'), 'Peso normal');
    assert.equal(rotuloCategoria('abaixo_do_peso'), 'Abaixo do peso');
    assert.equal(rotuloCategoria('sobrepeso'), 'Sobrepeso');
    assert.equal(rotuloCategoria('obesidade_1'), 'Obesidade grau 1');
    assert.equal(rotuloCategoria('obesidade_2'), 'Obesidade grau 2');
    assert.equal(rotuloCategoria('obesidade_3'), 'Obesidade grau 3');
  });
});

describe('faixa de peso normal', () => {
  it('1,78 m dá 58,7 kg a 79,1 kg', () => {
    assert.deepEqual(faixaPesoNormal(1780), { minimoG: 58700, maximoG: 79100 });
  });

  it('sem altura não há faixa', () => {
    assert.equal(faixaPesoNormal(null), null);
    assert.equal(faixaPesoNormal(178), null);
  });

  it('pesoParaImc é o inverso de calcularImc', () => {
    const peso = pesoParaImc(2474, 1780);
    assert.equal(calcularImc(peso, 1780)?.centesimos, 2474);
  });

  it('PROPRIEDADE: as duas pontas da faixa classificam como normal em 51 alturas', () => {
    // Este é o teste que impede faixa e categoria de se contradizerem. Sem o
    // arredondamento direcionado (mínimo para cima, máximo para baixo) ele
    // encontra alturas em que a tela anuncia um peso que ela própria chamaria de
    // "abaixo do peso" um segundo depois.
    for (let alturaMm = 1500; alturaMm <= 2000; alturaMm += 10) {
      const faixa = faixaPesoNormal(alturaMm);
      assert.ok(faixa, `sem faixa em ${alturaMm} mm`);

      const noMinimo = calcularImc(faixa.minimoG, alturaMm);
      const noMaximo = calcularImc(faixa.maximoG, alturaMm);
      assert.equal(noMinimo?.categoria, 'normal', `mínimo fora da faixa em ${alturaMm} mm`);
      assert.equal(noMaximo?.categoria, 'normal', `máximo fora da faixa em ${alturaMm} mm`);
      assert.ok(faixa.minimoG < faixa.maximoG);
    }
  });

  it('PROPRIEDADE: a faixa é justa — no máximo 100 g de folga em cada ponta', () => {
    // O par do teste acima. Sozinho, "as pontas classificam como normal" seria
    // satisfeito por uma faixa encolhida (58,7–79,0), que esconderia peso normal
    // de fora dela. Aqui a folga é exatamente o passo de exibição, nunca mais.
    for (let alturaMm = 1500; alturaMm <= 2000; alturaMm += 10) {
      const faixa = faixaPesoNormal(alturaMm);
      assert.ok(faixa);

      const limiteMin = pesoParaImc(IMC_NORMAL_MIN_CENT, alturaMm);
      const limiteMax = pesoParaImc(IMC_NORMAL_MAX_CENT, alturaMm);
      assert.ok(faixa.minimoG >= limiteMin - 1 && faixa.minimoG < limiteMin + 100, `${alturaMm} mm`);
      assert.ok(faixa.maximoG <= limiteMax + 1 && faixa.maximoG > limiteMax - 100, `${alturaMm} mm`);
    }
  });
});

describe('parseAltura', () => {
  it('aceita as cinco formas que ele digita de fato', () => {
    for (const entrada of ['1,78', '1.78', '178', '178 cm', '1,78 m']) {
      assert.deepEqual(parseAltura(entrada), { ok: true, milimetros: 1780 }, entrada);
    }
  });

  it('o sufixo manda quando existe: "178,5 cm" é 1785, não 178 metros', () => {
    assert.deepEqual(parseAltura('178,5 cm'), { ok: true, milimetros: 1785 });
    assert.deepEqual(parseAltura('1780 mm'), { ok: true, milimetros: 1780 });
    assert.deepEqual(parseAltura(' 1,80 M '), { ok: true, milimetros: 1800 });
  });

  it('recusa lixo em vez de devolver NaN', () => {
    assert.equal(parseAltura('').ok, false);
    assert.equal(parseAltura('   ').ok, false);
    assert.equal(parseAltura('abc').ok, false);
    assert.equal(parseAltura('-178').ok, false);
  });

  it('recusa fora da faixa física, que é o dedo errado mais comum', () => {
    assert.equal(parseAltura('0').ok, false);
    assert.equal(parseAltura('300').ok, false); // 3 metros
    assert.equal(parseAltura('17,8').ok, false); // vírgula no lugar errado
  });

  it('a mensagem de erro de faixa diz os limites em vez de "inválido"', () => {
    const r = parseAltura('300');
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.erro, 'Altura entre 1,00 m e 2,50 m.');
  });

  it('ida e volta com formatarAltura não perde valor', () => {
    // Múltiplos de 10 mm: `formatarAltura` mostra duas casas em metro, então
    // 1 cm é a resolução que a tela tem para devolver.
    for (const mm of [1000, 1650, 1780, 1800, 2500]) {
      const r = parseAltura(`${formatarAltura(mm)} m`);
      assert.deepEqual(r, { ok: true, milimetros: mm });
    }
  });
});

describe('formatarVariacao', () => {
  it('carrega o sinal, e o menos é o de verdade (U+2212)', () => {
    assert.equal(formatarVariacao(1400), '+1,4');
    assert.equal(formatarVariacao(-600), '−0,6');
  });

  it('zero não ganha sinal, e ruído de 40 g não vira "−0,0"', () => {
    assert.equal(formatarVariacao(0), '0,0');
    assert.equal(formatarVariacao(-40), '0,0');
    assert.equal(formatarVariacao(40), '0,0');
  });
});

describe('progresso rumo ao objetivo', () => {
  const perder = { pesoObjetivoG: 75000, pesoInicialG: 82000 };

  it('82 kg rumo a 75, hoje em 78: faltam 3 kg e 57% do caminho', () => {
    assert.deepEqual(progressoObjetivo(78000, perder), {
      direcao: 'perder',
      faltaG: 3000,
      alcancado: false,
      percentual: 57,
    });
  });

  it('bateu a meta: falta 0, alcançado, 100%', () => {
    assert.deepEqual(progressoObjetivo(75000, perder), {
      direcao: 'perder',
      faltaG: 0,
      alcancado: true,
      percentual: 100,
    });
  });

  it('passar da meta não vira falta negativa nem mais de 100%', () => {
    const p = progressoObjetivo(72000, perder);
    assert.equal(p.faltaG, 0);
    assert.equal(p.alcancado, true);
    assert.equal(p.percentual, 100);
    // A direção continua vindo da PARTIDA: cruzar a meta não vira "ganhar".
    assert.equal(p.direcao, 'perder');
  });

  it('engordar em vez de emagrecer trava o percentual em 0, não em negativo', () => {
    const p = progressoObjetivo(85000, perder);
    assert.equal(p.percentual, 0);
    assert.equal(p.faltaG, 10000);
  });

  it('quase lá mostra 99, nunca 100 — barra cheia é só de quem bateu', () => {
    // 99,6% do caminho. Arredondando daria 100 com 30 g ainda faltando.
    assert.equal(progressoObjetivo(75030, perder).percentual, 99);
  });

  it('sem partida registrada o percentual é null, não 0', () => {
    const p = progressoObjetivo(78000, { pesoObjetivoG: 75000, pesoInicialG: null });
    assert.equal(p.percentual, null);
    assert.equal(p.direcao, 'perder');
    assert.equal(p.faltaG, 3000);
  });

  it('partida igual ao objetivo não tem percurso para medir', () => {
    const p = progressoObjetivo(78000, { pesoObjetivoG: 75000, pesoInicialG: 75000 });
    assert.equal(p.percentual, null);
    assert.equal(p.direcao, 'manter');
    assert.equal(p.faltaG, 3000);
  });

  it('ganhar peso usa a mesma conta com os sinais invertidos', () => {
    const ganhar = { pesoObjetivoG: 75000, pesoInicialG: 70000 };
    const p = progressoObjetivo(72000, ganhar);
    assert.equal(p.direcao, 'ganhar');
    assert.equal(p.faltaG, 3000);
    assert.equal(p.percentual, 40);
  });
});

describe('ritmo semanal', () => {
  it('5 pesagens semanais caindo 500 g dão exatamente −500 g por semana', () => {
    const r = ritmoSemanal(pontosACada(MS_SEMANA, [80000, 79500, 79000, 78500, 78000]));
    assert.equal(r.suficiente, true);
    assert.equal(r.suficiente === true && r.porSemana, -500);
    assert.equal(r.pontos, 5);
    assert.equal(r.dias, 28);
  });

  it('DUAS pesagens não viram tendência — é o bug da tela de referência', () => {
    // "+1,8 kg por semana · Muito rápido" extrapolado de duas pesagens em 6 dias.
    // Aqui o tipo nem tem o campo para imprimir.
    const r = ritmoSemanal(pontosACada(6 * MS_DIA, [78000, 79600]));
    assert.deepEqual(r, { suficiente: false, motivo: 'poucas_pesagens', pontos: 2, dias: 6 });
    // @ts-expect-error `porSemana` não existe no ramo insuficiente, e é o ponto
    r.porSemana;
  });

  it('sem pesagem nenhuma o motivo é sem_dados', () => {
    assert.deepEqual(ritmoSemanal([]), { suficiente: false, motivo: 'sem_dados', pontos: 0, dias: 0 });
  });

  it('pesagens de sobra numa janela curta ainda é período curto', () => {
    const r = ritmoSemanal(pontosACada(18 * 60 * 60 * 1000, [78000, 78400, 77900, 78200, 77800]));
    assert.equal(r.suficiente, false);
    assert.equal(r.suficiente === false && r.motivo, 'periodo_curto');
    assert.equal(r.dias, 3);
  });

  it('as duas travas são exatamente as constantes exportadas', () => {
    const noLimite = pontosACada(
      (MIN_DIAS_PARA_RITMO / (MIN_PESAGENS_PARA_RITMO - 1)) * MS_DIA,
      [80000, 79800, 79600, 79400]
    );
    assert.equal(noLimite.length, MIN_PESAGENS_PARA_RITMO);
    const r = ritmoSemanal(noLimite);
    assert.equal(r.dias, MIN_DIAS_PARA_RITMO);
    assert.equal(r.suficiente, true);

    // Uma pesagem a menos, mesma janela: cai por quantidade.
    const menos = ritmoSemanal(noLimite.slice(1));
    assert.equal(menos.suficiente, false);
  });

  it('REGRESSÃO, não pontas: um churrasco na última pesagem não inverte a tendência', () => {
    // 6 pesagens caindo 300 g/semana, com +2 kg de água e sal na última.
    // A conta ingênua (último − primeiro) daria +100 g/semana e diria que engordou.
    const pontos = pontosACada(MS_SEMANA, [80000, 79700, 79400, 79100, 78800, 80500]);
    assert.equal((80500 - 80000) / 5, 100, 'a conta ingênua de fato mente aqui');

    const r = ritmoSemanal(pontos);
    assert.equal(r.suficiente, true);
    assert.ok(r.suficiente === true && r.porSemana < 0, 'a regressão tem que ver as seis');
  });

  it('não depende da ordem da lista de entrada', () => {
    const pontos = pontosACada(MS_SEMANA, [80000, 79500, 79000, 78500, 78000]);
    const embaralhados = [pontos[3], pontos[0], pontos[4], pontos[1], pontos[2]];
    assert.deepEqual(ritmoSemanal(embaralhados), ritmoSemanal(pontos));
  });
});

describe('período', () => {
  it('periodoDeDias fecha a janela no instante dado, sem Date.now() escondido', () => {
    const p = periodoDeDias(30, T0);
    assert.deepEqual(p, { de: T0 - 30 * MS_DIA, ate: T0 });
  });

  it('filtrarPeriodo corta as pontas e devolve ordenado', () => {
    const pontos: Ponto[] = [
      { instante: T0, valor: 3 },
      { instante: T0 - 90 * MS_DIA, valor: 1 },
      { instante: T0 - 10 * MS_DIA, valor: 2 },
      { instante: T0 + MS_DIA, valor: 4 },
    ];
    const janela = filtrarPeriodo(pontos, periodoDeDias(30, T0));
    assert.deepEqual(
      janela.map((p) => p.valor),
      [2, 3]
    );
  });

  it('sem período devolve tudo, ordenado', () => {
    const pontos: Ponto[] = [
      { instante: T0 + MS_DIA, valor: 2 },
      { instante: T0, valor: 1 },
    ];
    assert.deepEqual(
      filtrarPeriodo(pontos).map((p) => p.valor),
      [1, 2]
    );
  });
});

describe('estatística da série', () => {
  it('mudança, amplitude, mínimo e máximo com a data junto', () => {
    const pesagens = pesagensACada(MS_SEMANA, [80000, 81200, 79000, 79500, 78600]);
    const e = estatisticaDoPeso(pesagens);
    assert.ok(e);

    assert.equal(e.pontos, 5);
    assert.equal(e.mudanca, -1400); // 78600 − 80000
    assert.equal(e.amplitude, 2600); // 81200 − 78600
    assert.equal(e.minimo.valor, 78600);
    assert.equal(e.minimo.instante, T0 + 4 * MS_SEMANA);
    assert.equal(e.maximo.valor, 81200);
    assert.equal(e.maximo.instante, T0 + MS_SEMANA);
    assert.equal(e.primeiro.valor, 80000);
    assert.equal(e.ultimo.valor, 78600);
    assert.equal(e.dias, 28);
  });

  it('uma pesagem só: mudança 0, amplitude 0 e ritmo insuficiente', () => {
    const e = estatisticaDoPeso(pesagensACada(MS_SEMANA, [78400]));
    assert.ok(e);
    assert.equal(e.mudanca, 0);
    assert.equal(e.amplitude, 0);
    assert.equal(e.dias, 0);
    assert.deepEqual(e.primeiro, e.ultimo);
    assert.equal(e.ritmo.suficiente, false);
    assert.equal(e.ritmo.suficiente === false && e.ritmo.motivo, 'poucas_pesagens');
  });

  it('período sem pesagem devolve null, não zeros que parecem medição', () => {
    assert.equal(estatisticaDoPeso([]), null);
    const antiga = [{ medidoEm: T0 - 90 * MS_DIA, pesoG: 82000 }];
    assert.equal(estatisticaDoPeso(antiga, periodoDeDias(30, T0)), null);
  });

  it('a janela de 30 dias ignora a pesagem de 90 dias atrás', () => {
    const pesagens = [
      { medidoEm: T0 - 90 * MS_DIA, pesoG: 90000 },
      ...pesagensACada(7 * MS_DIA, [80000, 79500, 79000, 78500]).map((p) => ({
        medidoEm: p.medidoEm - 28 * MS_DIA,
        pesoG: p.pesoG,
      })),
    ];
    const e = estatisticaDoPeso(pesagens, periodoDeDias(30, T0));
    assert.ok(e);
    assert.equal(e.pontos, 4, 'a de 90 dias atrás ficou de fora');
    assert.equal(e.maximo.valor, 80000, 'senão o máximo seria os 90 kg de três meses atrás');
    assert.equal(e.ritmo.suficiente === true && e.ritmo.porSemana, -500);
  });

  it('no empate de valor, mínimo e máximo ficam com a data mais antiga', () => {
    const e = estatisticaDaSerie([
      { instante: T0, valor: 78000 },
      { instante: T0 + MS_DIA, valor: 78000 },
    ]);
    assert.ok(e);
    assert.equal(e.minimo.instante, T0);
    assert.equal(e.maximo.instante, T0);
  });

  it('medida corporal usa a mesma máquina, em milímetro', () => {
    const medidas = [
      { medidoEm: T0, valorMm: 385 },
      { medidoEm: T0 + MS_SEMANA, valorMm: 390 },
      { medidoEm: T0 + 2 * MS_SEMANA, valorMm: 388 },
    ];
    const e = estatisticaDaMedida(medidas);
    assert.ok(e);
    assert.equal(e.mudanca, 3);
    assert.equal(e.amplitude, 5);
    // Três pontos ainda não fazem tendência, mesmo em 14 dias.
    assert.equal(e.ritmo.suficiente, false);
  });
});

describe('pesoAtual', () => {
  it('devolve a pesagem mais recente, não a última da lista', () => {
    const pesagens = [
      { medidoEm: T0 + MS_DIA, pesoG: 78200 },
      { medidoEm: T0 + 5 * MS_DIA, pesoG: 77900 },
      { medidoEm: T0, pesoG: 78600 },
    ];
    assert.deepEqual(pesoAtual(pesagens), { medidoEm: T0 + 5 * MS_DIA, pesoG: 77900 });
  });

  it('duas no mesmo instante: fica a gravada por último', () => {
    const pesagens = [
      { medidoEm: T0, pesoG: 78600 },
      { medidoEm: T0, pesoG: 78400 },
    ];
    assert.equal(pesoAtual(pesagens)?.pesoG, 78400);
  });

  it('sem pesagem nenhuma devolve null', () => {
    assert.equal(pesoAtual([]), null);
  });
});

describe('parseCentimetros', () => {
  it('aceita o que ele digita: vírgula, ponto, inteiro e o sufixo', () => {
    assert.deepEqual(parseCentimetros('38,5'), { ok: true, milimetros: 385 });
    assert.deepEqual(parseCentimetros('38.5'), { ok: true, milimetros: 385 });
    assert.deepEqual(parseCentimetros('38'), { ok: true, milimetros: 380 });
    assert.deepEqual(parseCentimetros(' 38,5 cm '), { ok: true, milimetros: 385 });
    assert.deepEqual(parseCentimetros('38,5CM'), { ok: true, milimetros: 385 });
  });

  it('NÃO é parseAltura: 38,5 cm é um braço, não uma altura fora de faixa', () => {
    // A razão de existir uma segunda função. `parseAltura('38,5 cm')` calcula
    // 385 mm e então RECUSA por estar fora de 1,00–2,50 m — validação certa para
    // altura e absurda para circunferência.
    assert.equal(parseAltura('38,5 cm').ok, false);
    assert.deepEqual(parseCentimetros('38,5 cm'), { ok: true, milimetros: 385 });
  });

  it('recusa com mensagem em vez de devolver NaN, que viraria NULL no banco', () => {
    assert.deepEqual(parseCentimetros(''), { ok: false, erro: 'Informe a medida.' });
    assert.deepEqual(parseCentimetros('   '), { ok: false, erro: 'Informe a medida.' });
    assert.deepEqual(parseCentimetros('abc'), { ok: false, erro: 'Medida inválida.' });
    assert.deepEqual(parseCentimetros('-38'), { ok: false, erro: 'Medida inválida.' });
    assert.deepEqual(parseCentimetros('0'), {
      ok: false,
      erro: 'A medida precisa ser maior que zero.',
    });
  });

  it('arredonda para o milímetro: a coluna valor_mm é inteira e o CHECK exige > 0', () => {
    assert.deepEqual(parseCentimetros('38,54'), { ok: true, milimetros: 385 });
    assert.deepEqual(parseCentimetros('38,56'), { ok: true, milimetros: 386 });
    // 0,04 cm arredonda para 0 mm, e zero não é medida.
    assert.equal(parseCentimetros('0,04').ok, false);
  });

  it('ida e volta com formatarMedida', () => {
    for (const texto of ['38,5', '42,0', '105,3']) {
      const r = parseCentimetros(texto);
      assert.equal(r.ok, true);
      assert.equal(formatarMedida((r as { ok: true; milimetros: number }).milimetros), texto);
    }
  });
});

describe('formatarVariacaoDaMedida', () => {
  it('trabalha em MILÍMETRO, onde formatarVariacao (grama) escreveria "+0,0"', () => {
    assert.equal(formatarVariacaoDaMedida(15), '+1,5');
    // A prova de que as duas não são intercambiáveis: 15 é uma variação real de
    // 1,5 cm no braço e um arredondamento para zero na balança.
    assert.equal(formatarVariacao(15), '0,0');
  });

  it('usa o menos tipográfico U+2212, igual a formatarVariacao', () => {
    assert.equal(formatarVariacaoDaMedida(-8), '−0,8');
    assert.equal(formatarVariacaoDaMedida(-8).charCodeAt(0), 0x2212);
  });

  it('só o zero exato sai sem sinal, e nunca como "−0,0"', () => {
    assert.equal(formatarVariacaoDaMedida(0), '0,0');
    // Diferença deliberada em relação a `formatarVariacao`: uma casa de
    // centímetro É o milímetro, então 1 mm aparece em vez de virar zero. Na
    // balança, uma casa de quilo esconde 40 g e o "−0,0" precisa ser evitado.
    assert.equal(formatarVariacaoDaMedida(-1), '−0,1');
    assert.equal(formatarVariacaoDaMedida(1), '+0,1');
    assert.equal(formatarVariacao(-40), '0,0');
  });
});

describe('rotuloDaParte', () => {
  it('todas as 12 partes têm rótulo, e o lado é explícito', () => {
    for (const p of PARTES_CORPO) {
      assert.ok(rotuloDaParte(p).length > 0, `${p} sem rótulo`);
    }
    assert.equal(rotuloDaParte('braco_direito'), 'Braço D.');
    assert.equal(rotuloDaParte('braco_esquerdo'), 'Braço E.');
  });

  it('rótulos são únicos: dois chips com o mesmo texto seriam indistinguíveis', () => {
    const rotulos = PARTES_CORPO.map(rotuloDaParte);
    assert.equal(new Set(rotulos).size, PARTES_CORPO.length);
  });
});
