import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sugerirCarga, volumeDaSerie, volumeTotal, type SerieExecutada } from './volume.ts';

const serie = (p: Partial<SerieExecutada> = {}): SerieExecutada => ({
  tipo: 'valida',
  cargaG: 40000,
  repeticoes: 10,
  ...p,
});

describe('volume', () => {
  it('multiplica carga por repetições', () => {
    assert.equal(volumeDaSerie(serie()), 400000);
  });

  it('aquecimento não entra — senão o gráfico sobe quando só se aqueceu mais', () => {
    const series = [serie({ tipo: 'aquecimento', cargaG: 20000 }), serie()];
    assert.equal(volumeTotal(series), 400000);
  });

  it('série levada à falha conta', () => {
    assert.equal(volumeTotal([serie({ tipo: 'falha' })]), 400000);
  });

  it('série sem carga devolve null em vez de virar zero', () => {
    assert.equal(volumeDaSerie(serie({ cargaG: null })), null);
    assert.equal(volumeTotal([serie({ cargaG: null }), serie()]), 400000);
  });
});

describe('sugerirCarga', () => {
  const alvo = { seriesAlvo: 3, repsAlvoMin: 8 };

  it('sobe um incremento quando bateu todas as séries no alvo', () => {
    const anteriores = [serie(), serie(), serie()];
    assert.equal(sugerirCarga(anteriores, alvo), 42500);
  });

  it('mantém quando faltou repetição em alguma série', () => {
    const anteriores = [serie(), serie(), serie({ repeticoes: 6 })];
    assert.equal(sugerirCarga(anteriores, alvo), 40000);
  });

  it('mantém quando fez menos séries que o alvo', () => {
    assert.equal(sugerirCarga([serie(), serie()], alvo), 40000);
  });

  it('nunca reduz sozinha — reduzir é decisão do Henrique', () => {
    const anteriores = [serie({ repeticoes: 2 }), serie({ repeticoes: 1 }), serie({ repeticoes: 1 })];
    assert.equal(sugerirCarga(anteriores, alvo), 40000);
  });

  it('ignora o aquecimento ao decidir', () => {
    const anteriores = [serie({ tipo: 'aquecimento', cargaG: 20000, repeticoes: 15 }), serie(), serie(), serie()];
    assert.equal(sugerirCarga(anteriores, alvo), 42500);
  });

  it('sem histórico com carga, não sugere nada', () => {
    assert.equal(sugerirCarga([], alvo), null);
    assert.equal(sugerirCarga([serie({ cargaG: null })], alvo), null);
  });

  it('respeita incremento menor de halter', () => {
    assert.equal(sugerirCarga([serie(), serie(), serie()], alvo, 1250), 41250);
  });
});
