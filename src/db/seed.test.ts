/**
 * O seed contra SQLite de verdade: as migrations reais, os CHECKs reais, a
 * transação real. Um mock diria que a idempotência funciona; só o banco discorda.
 *
 * As leituras aqui são SQL cru de propósito. O que está sob teste é o seed, não
 * `queries.ts` — e escrever a asserção contra a tabela é o que prova que a carga
 * caiu na COLUNA certa (`carga_alvo_placas` vs `carga_alvo_g`), que é a decisão
 * que o desenho inteiro protege.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { criarBancoDeTeste, type BancoDeTeste } from './banco-de-teste.ts';
import { aplicarSeed, versaoDoSeedAplicada } from './seed.ts';

let banco: BancoDeTeste;

beforeEach(() => {
  banco = criarBancoDeTeste();
});

function contar(tabela: string): number {
  const linha = banco.bruto.prepare(`select count(*) as n from ${tabela}`).get() as { n: number };
  return linha.n;
}

function marcaDeVersao(): string | undefined {
  const linha = banco.bruto
    .prepare("select valor from preferencias where chave = 'seed_versao'")
    .get() as { valor: string } | undefined;
  return linha?.valor;
}

/** O spread não é enfeite: `node:sqlite` devolve objeto sem protótipo, e
 *  `deepEqual` estrito recusa comparar isso com um literal. */
function umaLinha<T>(sql: string): T {
  return { ...banco.bruto.prepare(sql).get() } as T;
}

describe('primeiro boot', () => {
  it('semeia 24 exercícios, 3 treinos e 24 itens numa passada', () => {
    const r = aplicarSeed();

    assert.deepEqual(r, {
      aplicado: true,
      versao: 1,
      exercicios: 24,
      treinos: 3,
      itens: 24,
    });
    assert.equal(contar('exercicios'), 24);
    assert.equal(contar('treinos'), 3);
    assert.equal(contar('treino_exercicios'), 24);
  });

  it('deixa os treinos na ordem em que a aba Treino vai listá-los', () => {
    aplicarSeed();

    const nomes = banco.bruto
      .prepare('select nome from treinos order by ordem asc')
      .all()
      .map((l) => (l as { nome: string }).nome);
    assert.deepEqual(nomes, ['Treino A', 'Treino B', 'Treino C']);

    const itens = banco.bruto
      .prepare("select exercicio_id from treino_exercicios where treino_id = 'seed-tr-a' order by ordem asc")
      .all()
      .map((l) => (l as { exercicio_id: string }).exercicio_id);
    assert.equal(itens[0], 'seed-ex-remada-alta-barra');
    assert.equal(itens[7], 'seed-ex-abdominal-supra-solo');
  });

  it('grava cada carga na COLUNA da unidade dela, nunca na outra', () => {
    aplicarSeed();

    const remada = umaLinha<{ carga_alvo_g: number | null; carga_alvo_placas: number | null }>(
      "select carga_alvo_g, carga_alvo_placas from treino_exercicios where exercicio_id = 'seed-ex-remada-alta-barra'"
    );
    assert.deepEqual(remada, { carga_alvo_g: null, carga_alvo_placas: 5 });

    const leg = umaLinha<{ carga_alvo_g: number | null; carga_alvo_placas: number | null }>(
      "select carga_alvo_g, carga_alvo_placas from treino_exercicios where exercicio_id = 'seed-ex-seated-leg-press'"
    );
    assert.deepEqual(leg, { carga_alvo_g: 20000, carga_alvo_placas: null });

    // Nenhuma linha com as duas cargas e nenhum incremento fora da coluna certa —
    // é o mesmo invariante dos CHECKs, conferido pelo lado dos dados.
    assert.equal(
      contar('treino_exercicios where carga_alvo_g is not null and carga_alvo_placas is not null'),
      0
    );
    assert.equal(
      contar("exercicios where tipo_medicao = 'carga_placa' and incremento_g is not null"),
      0
    );
    assert.equal(
      contar("exercicios where tipo_medicao = 'carga_kg' and incremento_placas is not null"),
      0
    );
  });

  it('semeia a Esteira com duração-alvo e sem carga nem reps', () => {
    aplicarSeed();

    const esteira = umaLinha<{
      series_alvo: number;
      duracao_alvo_s: number | null;
      reps_alvo_min: number | null;
      carga_alvo_g: number | null;
      carga_alvo_placas: number | null;
    }>(
      "select series_alvo, duracao_alvo_s, reps_alvo_min, carga_alvo_g, carga_alvo_placas from treino_exercicios where exercicio_id = 'seed-ex-esteira'"
    );
    assert.deepEqual(esteira, {
      series_alvo: 1,
      duracao_alvo_s: 600,
      reps_alvo_min: null,
      carga_alvo_g: null,
      carga_alvo_placas: null,
    });
  });

  it('nenhum exercício nasce calibrado', () => {
    aplicarSeed();
    assert.equal(contar('exercicios where gramas_por_placa is not null'), 0);
  });

  it('marca a versão aplicada em preferencias', () => {
    assert.equal(versaoDoSeedAplicada(), 0);
    assert.equal(marcaDeVersao(), undefined);

    aplicarSeed();

    assert.equal(marcaDeVersao(), '1');
    assert.equal(versaoDoSeedAplicada(), 1);
  });
});

describe('idempotência', () => {
  it('a segunda chamada não roda e não mexe em nada', () => {
    aplicarSeed();

    const r = aplicarSeed();

    assert.deepEqual(r, { aplicado: false, motivo: 'ja_aplicado', versao: 1 });
    assert.equal(contar('exercicios'), 24);
    assert.equal(contar('treinos'), 3);
    assert.equal(contar('treino_exercicios'), 24);
  });

  it('não duplica nada nem com a flag apagada — a defesa não depende dela', () => {
    aplicarSeed();
    // Simula o app morto entre o último insert e a gravação da preferência, e o
    // backup restaurado que já trazia o catálogo.
    banco.bruto.exec("delete from preferencias where chave = 'seed_versao'");

    const r = aplicarSeed();

    assert.deepEqual(r, { aplicado: true, versao: 1, exercicios: 0, treinos: 0, itens: 0 });
    assert.equal(contar('exercicios'), 24);
    assert.equal(contar('treinos'), 3);
    assert.equal(contar('treino_exercicios'), 24);
  });

  it('não ressuscita o exercício que ele arquivou', () => {
    aplicarSeed();
    banco.bruto.exec(
      "update exercicios set arquivado_em = 1, atualizado_em = 1 where id = 'seed-ex-facepull'"
    );
    banco.bruto.exec("delete from preferencias where chave = 'seed_versao'");

    aplicarSeed();

    const facepull = umaLinha<{ n: number; arquivado_em: number | null }>(
      "select count(*) as n, max(arquivado_em) as arquivado_em from exercicios where id = 'seed-ex-facepull'"
    );
    assert.equal(facepull.n, 1, 'arquivado + reseed criou uma cópia');
    assert.equal(facepull.arquivado_em, 1, 'o seed desarquivou o que ele arquivou');
    assert.equal(contar('exercicios'), 24);
  });

  it('não sobrescreve a edição dele — nome e incremento corrigidos sobrevivem', () => {
    aplicarSeed();
    banco.bruto.exec(
      "update exercicios set nome = 'Facepull na corda', incremento_placas = 2 where id = 'seed-ex-facepull'"
    );
    banco.bruto.exec("delete from preferencias where chave = 'seed_versao'");

    aplicarSeed();

    const ex = umaLinha<{ nome: string; incremento_placas: number }>(
      "select nome, incremento_placas from exercicios where id = 'seed-ex-facepull'"
    );
    assert.deepEqual(ex, { nome: 'Facepull na corda', incremento_placas: 2 });
  });
});

describe('transação', () => {
  it('falha no meio não deixa catálogo pela metade nem marca de versão', () => {
    // Aborta todo insert de item: os 24 exercícios e o Treino A já foram
    // gravados quando o primeiro item estoura, então ou o ROLLBACK acontece ou
    // o banco fica com catálogo sem ficha — e marcado como semeado.
    banco.bruto.exec(
      `create trigger falha_forcada before insert on treino_exercicios
       begin select raise(abort, 'falha forçada no meio do seed'); end`
    );

    assert.throws(() => aplicarSeed());

    assert.equal(contar('exercicios'), 0);
    assert.equal(contar('treinos'), 0);
    assert.equal(contar('treino_exercicios'), 0);
    assert.equal(marcaDeVersao(), undefined);
    assert.equal(versaoDoSeedAplicada(), 0);
  });

  it('depois do rollback, semear de novo funciona por inteiro', () => {
    banco.bruto.exec(
      `create trigger falha_forcada before insert on treino_exercicios
       begin select raise(abort, 'falha forçada'); end`
    );
    assert.throws(() => aplicarSeed());
    banco.bruto.exec('drop trigger falha_forcada');

    const r = aplicarSeed();

    assert.deepEqual(r, { aplicado: true, versao: 1, exercicios: 24, treinos: 3, itens: 24 });
    assert.equal(marcaDeVersao(), '1');
  });
});
