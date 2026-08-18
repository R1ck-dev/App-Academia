import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  agruparPorDia,
  diaLocal,
  formatarData,
  formatarDataComAno,
  formatarDataHora,
  formatarDuracao,
  formatarHora,
  formatarRelogio,
  diasEntreDias,
  mediaMovel,
  rotuloDeQuandoFoi,
  rotuloDoDiaLongo,
  type Ponto,
} from './datas.ts';

/**
 * Instantes montados com `new Date(a, m, d, h, min)`, que é o construtor LOCAL:
 * o módulo inteiro fala fuso do aparelho de propósito, e um teste em UTC
 * passaria em Brasília e falharia em qualquer máquina a leste de Greenwich.
 */
const local = (ano: number, mes: number, dia: number, hora = 0, minuto = 0): number =>
  new Date(ano, mes - 1, dia, hora, minuto).getTime();

const MS_DIA = 24 * 60 * 60 * 1000;

describe('diaLocal', () => {
  it('usa o fuso do aparelho, não UTC', () => {
    assert.equal(diaLocal(local(2026, 8, 16, 14, 30)), '2026-08-16');
  });

  it('23h40 e 00h20 são dias DIFERENTES — a pegadinha do treino da virada', () => {
    const comecou = local(2026, 8, 16, 23, 40);
    assert.equal(diaLocal(comecou), '2026-08-16');
    assert.equal(diaLocal(comecou + 40 * 60 * 1000), '2026-08-17');
  });

  it('zero à esquerda em mês e dia, para a chave ordenar como texto', () => {
    assert.equal(diaLocal(local(2026, 1, 5)), '2026-01-05');
    // A ordenação alfabética das chaves TEM que ser a cronológica: é o que
    // permite agrupar e listar sem reconverter para Date.
    assert.ok(diaLocal(local(2026, 1, 5)) < diaLocal(local(2026, 10, 5)));
  });
});

describe('agruparPorDia', () => {
  it('junta o que caiu no mesmo dia local e separa o que virou a meia-noite', () => {
    const sessoes = [
      { id: 'a', em: local(2026, 8, 16, 8, 0) },
      { id: 'b', em: local(2026, 8, 16, 23, 40) },
      { id: 'c', em: local(2026, 8, 17, 0, 20) },
    ];
    const grupos = agruparPorDia(sessoes, (s) => s.em);

    assert.deepEqual([...grupos.keys()], ['2026-08-16', '2026-08-17']);
    assert.deepEqual(
      grupos.get('2026-08-16')!.map((s) => s.id),
      ['a', 'b']
    );
    assert.deepEqual(
      grupos.get('2026-08-17')!.map((s) => s.id),
      ['c']
    );
  });

  it('lista vazia devolve mapa vazio, não um dia com zero itens', () => {
    assert.equal(agruparPorDia([], () => 0).size, 0);
  });
});

describe('mediaMovel', () => {
  it('suaviza o serrote: o pico de 2 kg num dia não vira 2 kg na curva', () => {
    const base = local(2026, 8, 1);
    const pontos: Ponto[] = [
      { instante: base, valor: 78000 },
      { instante: base + MS_DIA, valor: 78100 },
      { instante: base + 2 * MS_DIA, valor: 78000 },
      // O dia da feijoada: 2 kg de água a mais.
      { instante: base + 3 * MS_DIA, valor: 80000 },
    ];
    const suave = mediaMovel(pontos, 7);

    // O bruto pularia 78000 -> 80000; a média chega a 78525 e a curva não mente
    // "engordou 2 kg num dia".
    assert.equal(suave[3].valor, 78525);
    assert.ok(suave[3].valor < 79000);
    // O instante NÃO é suavizado: a data continua sendo a da pesagem.
    assert.equal(suave[3].instante, base + 3 * MS_DIA);
  });

  it('a janela esquece o que ficou para trás dela', () => {
    const base = local(2026, 8, 1);
    const pontos: Ponto[] = [
      { instante: base, valor: 90000 },
      // 30 dias depois: fora de qualquer janela de 7 dias.
      { instante: base + 30 * MS_DIA, valor: 78000 },
      { instante: base + 31 * MS_DIA, valor: 78200 },
    ];
    const suave = mediaMovel(pontos, 7);

    assert.equal(suave[1].valor, 78000, 'os 90 kg de um mês atrás não entram');
    assert.equal(suave[2].valor, 78100);
  });

  it('não depende da ordem da lista nem a modifica', () => {
    const base = local(2026, 8, 1);
    const embaralhado: Ponto[] = [
      { instante: base + MS_DIA, valor: 78100 },
      { instante: base, valor: 78000 },
    ];
    const copia = structuredClone(embaralhado);

    const suave = mediaMovel(embaralhado, 7);
    assert.deepEqual(
      suave.map((p) => p.instante),
      [base, base + MS_DIA]
    );
    assert.deepEqual(embaralhado, copia, 'a entrada não pode ser reordenada no lugar');
  });

  it('um ponto só é ele mesmo', () => {
    assert.deepEqual(mediaMovel([{ instante: 1000, valor: 78400 }], 7), [
      { instante: 1000, valor: 78400 },
    ]);
  });

  it('devolve INTEIRO: o valor volta para grama, a mesma escala que entrou', () => {
    const base = local(2026, 8, 1);
    const suave = mediaMovel(
      [
        { instante: base, valor: 78000 },
        { instante: base + MS_DIA, valor: 78001 },
      ],
      7
    );
    assert.ok(Number.isInteger(suave[1].valor));
  });
});

describe('data e hora', () => {
  it('formatarData é dia/mês com zero à esquerda', () => {
    assert.equal(formatarData(local(2026, 8, 16)), '16/08');
    assert.equal(formatarData(local(2026, 1, 5)), '05/01');
  });

  it('formatarDataComAno traz só os dois últimos dígitos', () => {
    assert.equal(formatarDataComAno(local(2026, 8, 16)), '16/08/26');
  });

  it('formatarHora usa 24 h e o "h" no lugar dos dois-pontos', () => {
    assert.equal(formatarHora(local(2026, 8, 16, 19, 40)), '19h40');
    assert.equal(formatarHora(local(2026, 8, 16, 7, 5)), '07h05');
    assert.equal(formatarHora(local(2026, 8, 16, 0, 0)), '00h00');
  });

  it('formatarDataHora costura as duas', () => {
    assert.equal(formatarDataHora(local(2026, 8, 15, 19, 40)), '15/08 às 19h40');
  });
});

describe('formatarDuracao', () => {
  it('600 segundos é "10 min", e não "10 min 0 s"', () => {
    assert.equal(formatarDuracao(600), '10 min');
  });

  it('abaixo de um minuto imprime só segundos', () => {
    assert.equal(formatarDuracao(45), '45 s');
    assert.equal(formatarDuracao(0), '0 s');
  });

  it('minuto quebrado traz as duas partes', () => {
    assert.equal(formatarDuracao(90), '1 min 30 s');
    assert.equal(formatarDuracao(3661), '61 min 1 s');
  });
});

describe('formatarRelogio', () => {
  it('recebe MILISSEGUNDOS restantes e escreve m:ss', () => {
    assert.equal(formatarRelogio(47_000), '0:47');
    assert.equal(formatarRelogio(90_000), '1:30');
  });

  it('arredonda para CIMA: 0,4 s restante ainda é "0:01", nunca "0:00" antes da hora', () => {
    assert.equal(formatarRelogio(400), '0:01');
  });

  it('descanso estourado satura em 0:00 em vez de contar negativo', () => {
    // O caso real: ele voltou ao app 3 minutos depois com a tela apagada.
    assert.equal(formatarRelogio(-180_000), '0:00');
    assert.equal(formatarRelogio(0), '0:00');
  });
});

describe('rotuloDoDiaLongo', () => {
  it('escreve o dia da semana e o mês por extenso, em português', () => {
    // 17/08/2026 é uma segunda-feira.
    assert.equal(rotuloDoDiaLongo(new Date(2026, 7, 17, 18, 41).getTime()), 'Segunda · 17 de agosto');
    assert.equal(rotuloDoDiaLongo(new Date(2026, 0, 1, 8, 0).getTime()), 'Quinta · 1 de janeiro');
    assert.equal(rotuloDoDiaLongo(new Date(2026, 2, 8, 8, 0).getTime()), 'Domingo · 8 de março');
  });

  it('não depende de Intl — o Hermes em release não traz os dados de locale', () => {
    const texto = rotuloDoDiaLongo(new Date(2026, 11, 25, 12, 0).getTime());
    assert.equal(texto, 'Sexta · 25 de dezembro');
  });
});

describe('diasEntreDias e rotuloDeQuandoFoi', () => {
  const agora = new Date(2026, 7, 17, 8, 0).getTime();

  it('conta a distância entre DATAS, não entre relógios', () => {
    // 22h de ontem para 8h de hoje: dez horas, e um dia de distância.
    assert.equal(diasEntreDias(new Date(2026, 7, 16, 22, 0).getTime(), agora), 1);
    assert.equal(diasEntreDias(new Date(2026, 7, 17, 1, 0).getTime(), agora), 0);
    assert.equal(diasEntreDias(new Date(2026, 7, 10, 19, 0).getTime(), agora), 7);
  });

  it('atravessa a virada do mês', () => {
    assert.equal(diasEntreDias(new Date(2026, 6, 31, 19, 0).getTime(), agora), 17);
  });

  it('escreve hoje, ontem e há N dias', () => {
    assert.equal(rotuloDeQuandoFoi(new Date(2026, 7, 17, 1, 0).getTime(), agora), 'hoje');
    assert.equal(rotuloDeQuandoFoi(new Date(2026, 7, 16, 22, 0).getTime(), agora), 'ontem');
    assert.equal(rotuloDeQuandoFoi(new Date(2026, 7, 10, 19, 0).getTime(), agora), 'há 7 dias');
  });

  it('treino nunca feito é "nunca", não "há NaN dias"', () => {
    assert.equal(rotuloDeQuandoFoi(null, agora), 'nunca');
  });

  it('instante no futuro vira "hoje" — relógio do aparelho mexido não vira "há −2 dias"', () => {
    assert.equal(rotuloDeQuandoFoi(new Date(2026, 7, 19, 8, 0).getTime(), agora), 'hoje');
  });
});
