/**
 * O teste que faltava existir.
 *
 * A reatividade da tela dependia do listener nativo do expo-sqlite, que a suíte
 * não enxerga — e por isso 337 testes verdes conviveram com um app onde iniciar
 * um treino gravava a sessão e a tela não saía do lugar. Aqui o gatilho é código
 * nosso, então o `node --test` cobre exatamente o que o aparelho executa.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';

import { kg, placa } from '../dominio/carga.ts';
import { criarBancoDeTeste } from './banco-de-teste.ts';
import {
  arquivarExercicio,
  criarExercicio,
  criarTreino,
  desfazerSerie,
  finalizarSessao,
  iniciarSessao,
  registrarMedida,
  registrarPesagem,
  registrarSerie,
  salvarAltura,
} from './mutations.ts';
import { listarExercicios, sessaoEmAndamento } from './queries.ts';
import { anunciarEscrita, assinarEscritas, reiniciarSinal, versaoDasEscritas } from './sinal.ts';

beforeEach(() => {
  criarBancoDeTeste();
  reiniciarSinal();
});

describe('o sinal em si', () => {
  it('a versão só cresce, e é número — useSyncExternalStore compara por identidade', () => {
    const antes = versaoDasEscritas();
    anunciarEscrita();
    assert.equal(typeof versaoDasEscritas(), 'number');
    assert.ok(versaoDasEscritas() > antes);
  });

  it('avisa todos os assinantes e para de avisar quem cancelou', () => {
    let a = 0;
    let b = 0;
    const cancelarA = assinarEscritas(() => a++);
    assinarEscritas(() => b++);

    anunciarEscrita();
    assert.deepEqual([a, b], [1, 1]);

    cancelarA();
    anunciarEscrita();
    assert.deepEqual([a, b], [1, 2]);
  });

  it('um assinante que se desinscreve durante o aviso não quebra o laço', () => {
    // É o que a tela faz ao desmontar no meio de uma escrita: sem a cópia do
    // Set em `anunciarEscrita`, isto seria mutação durante iteração.
    let avisos = 0;
    const cancelar = assinarEscritas(() => {
      avisos++;
      cancelar();
    });
    assinarEscritas(() => avisos++);

    anunciarEscrita();
    assert.equal(avisos, 2);
  });
});

describe('toda escrita avisa a tela', () => {
  /** Conta quantos avisos uma operação dispara. Um é o esperado; zero é o bug. */
  function avisosDe(operacao: () => void): number {
    let avisos = 0;
    const cancelar = assinarEscritas(() => avisos++);
    try {
      operacao();
    } finally {
      cancelar();
    }
    return avisos;
  }

  it('escrita direta avisa (criarExercicio, criarTreino, salvarAltura)', () => {
    assert.ok(avisosDe(() => criarExercicio({ nome: 'Supino', tipoMedicao: 'carga_kg' })) > 0);
    assert.ok(avisosDe(() => criarTreino({ nome: 'Treino A' })) > 0);
    assert.ok(avisosDe(() => salvarAltura(1700)) > 0);
  });

  it('escrita em transação avisa — é o caso de iniciarSessao, que quebrou no celular', () => {
    assert.ok(avisosDe(() => iniciarSessao({ nome: 'Treino A' })) > 0);
  });

  it('registrar e desfazer série avisam', () => {
    const ex = criarExercicio({ nome: 'Peck Dorsal', tipoMedicao: 'carga_placa' });
    const r = iniciarSessao({ nome: 'Treino A' });
    assert.ok(r.ok);

    let serieId = '';
    assert.ok(
      avisosDe(() => {
        serieId = registrarSerie({
          sessaoId: r.sessaoId,
          exercicioId: ex,
          indice: 0,
          carga: placa(5),
          repeticoes: 10,
        });
      }) > 0
    );
    assert.ok(avisosDe(() => desfazerSerie(serieId)) > 0);
    assert.ok(avisosDe(() => finalizarSessao(r.sessaoId)) > 0);
  });

  it('corpo avisa (pesagem, medida) e arquivar avisa', () => {
    const ex = criarExercicio({ nome: 'Remada', tipoMedicao: 'carga_kg' });
    assert.ok(avisosDe(() => registrarPesagem({ pesoG: 78400 })) > 0);
    assert.ok(avisosDe(() => registrarMedida({ parte: 'braco_direito', valorMm: 385 })) > 0);
    assert.ok(avisosDe(() => arquivarExercicio(ex)) > 0);
  });

  it('transação que falha NÃO avisa — a tela não pode reler o que sofreu rollback', () => {
    const supino = criarExercicio({ nome: 'Supino Inclinado', tipoMedicao: 'carga_kg' });
    const r = iniciarSessao({ nome: 'Treino C' });
    assert.ok(r.ok);

    const avisos = avisosDe(() => {
      assert.throws(() =>
        // Placa em exercício de kg: `registrarSerie` recusa dentro da transação.
        registrarSerie({
          sessaoId: r.sessaoId,
          exercicioId: supino,
          indice: 0,
          carga: placa(5),
          repeticoes: 10,
        })
      );
    });
    assert.equal(avisos, 0);
  });

  it('leitura não avisa — senão a tela reagiria a si mesma, em laço', () => {
    criarExercicio({ nome: 'Rosca', tipoMedicao: 'carga_kg' });
    const antes = versaoDasEscritas();
    listarExercicios();
    sessaoEmAndamento();
    assert.equal(versaoDasEscritas(), antes);
  });
});

describe('a regra vale para as mutations que ainda não existem', () => {
  /**
   * Teste estrutural sobre o FONTE, não sobre o comportamento. Existe porque o
   * modo de falhar aqui é omissão: alguém escreve a mutation nº 29, esquece o
   * aviso, todos os testes passam e a tela para de atualizar só naquele fluxo —
   * exatamente o bug que este arquivo veio consertar.
   */
  it('toda mutation exportada avisa, direta ou via db.transaction', () => {
    const fonte = readFileSync(join(import.meta.dirname, 'mutations.ts'), 'utf8');
    const linhas = fonte.split('\n');

    const inicios: { linha: number; nome: string }[] = [];
    linhas.forEach((l, i) => {
      const m = l.match(/^export function (\w+)/);
      if (m) inicios.push({ linha: i, nome: m[1] });
    });
    assert.ok(inicios.length >= 28, 'esperava encontrar as mutations no fonte');

    const semAviso = inicios.filter((f, k) => {
      const fim = k + 1 < inicios.length ? inicios[k + 1].linha : linhas.length;
      const corpo = linhas.slice(f.linha, fim).join('\n');
      const escreve = /\.run\(\)/.test(corpo) || /db\.transaction\(/.test(corpo);
      if (!escreve) return false; // delega para outra mutation, que avisa
      return !/anunciarEscrita\(\)/.test(corpo) && !/db\.transaction\(/.test(corpo);
    });

    assert.deepEqual(
      semAviso.map((f) => f.nome),
      [],
      'estas mutations escrevem sem avisar a tela — a lista não vai atualizar sozinha'
    );
  });
});
