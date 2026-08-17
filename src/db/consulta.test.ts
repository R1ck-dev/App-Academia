/**
 * O contrato que `useSyncExternalStore` exige do lado de cá: mesmo valor
 * enquanto ninguém escreveu, valor novo depois de escrever.
 *
 * Devolver objeto novo a cada chamada daria laço infinito no React; devolver
 * sempre o mesmo congelaria a tela — que foi o bug de 17/08/2026. As duas
 * metades estão aqui.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { criarBancoDeTeste } from './banco-de-teste.ts';
import { esquecerConsultas, lerComCache } from './consulta.ts';
import { criarExercicio } from './mutations.ts';
import { listarExercicios } from './queries.ts';
import { anunciarEscrita, reiniciarSinal } from './sinal.ts';

beforeEach(() => {
  criarBancoDeTeste();
  reiniciarSinal();
  esquecerConsultas();
});

describe('lerComCache', () => {
  it('sem escrita, devolve o MESMO objeto — senão useSyncExternalStore entra em laço', () => {
    criarExercicio({ nome: 'Supino', tipoMedicao: 'carga_kg' });
    esquecerConsultas();

    const primeira = lerComCache('exercicios', listarExercicios);
    const segunda = lerComCache('exercicios', listarExercicios);

    assert.equal(primeira, segunda, 'a identidade tem que se manter entre renders');
  });

  it('depois de escrever, relê — é a metade que faltava no aparelho', () => {
    criarExercicio({ nome: 'Supino', tipoMedicao: 'carga_kg' });
    const antes = lerComCache('exercicios', listarExercicios);
    assert.equal(antes.length, 1);

    criarExercicio({ nome: 'Remada', tipoMedicao: 'carga_kg' });
    const depois = lerComCache('exercicios', listarExercicios);

    assert.equal(depois.length, 2);
    assert.notEqual(antes, depois);
  });

  it('só consulta de novo quando a versão muda — 3 leituras, 1 consulta', () => {
    let consultas = 0;
    const contar = () => {
      consultas++;
      return listarExercicios();
    };

    lerComCache('exercicios', contar);
    lerComCache('exercicios', contar);
    assert.equal(consultas, 1, 'a segunda leitura tinha que sair do cache');

    anunciarEscrita();
    lerComCache('exercicios', contar);
    assert.equal(consultas, 2);
  });

  it('chaves diferentes não se atropelam', () => {
    criarExercicio({ nome: 'Supino', tipoMedicao: 'carga_kg' });
    esquecerConsultas();

    const lista = lerComCache('exercicios', listarExercicios);
    const contagem = lerComCache('quantos', () => listarExercicios().length);

    assert.equal(lista.length, 1);
    assert.equal(contagem, 1);
    assert.equal(lerComCache('exercicios', listarExercicios), lista);
  });

  it('a versão nova sobrescreve a velha: uma entrada por chave, não um vazamento', () => {
    for (let i = 0; i < 50; i++) {
      criarExercicio({ nome: `Exercício ${i}`, tipoMedicao: 'carga_kg' });
      lerComCache('exercicios', listarExercicios);
    }
    // Se o cache crescesse por versão, cinquenta escritas deixariam cinquenta
    // listas vivas — e a lista de 50 exercícios seria a única correta.
    assert.equal(lerComCache('exercicios', listarExercicios).length, 50);
  });
});
