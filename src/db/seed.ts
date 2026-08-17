/**
 * Aplica o catálogo inicial no banco. Roda uma vez na vida do aparelho, no boot,
 * depois das migrations (ver `provedor-banco.tsx`).
 *
 * ## Idempotente por três mecanismos independentes, com papéis diferentes
 *
 * 1. **Portão** — não roda se `preferencias['seed_versao'] >= SEED_VERSAO`. Evita
 *    24 upserts em todo boot e, mais importante, RESPEITA A VONTADE DELE: se ele
 *    arquivar o Facepull, o seed v1 nunca mais roda e não o ressuscita.
 * 2. **Transação síncrona única** — os inserts e a marca da versão são o MESMO
 *    evento. Callback `async` aqui não faria rollback nenhum (ver `dados-locais`),
 *    e num seed de 51 inserts isso deixaria catálogo pela metade marcado como
 *    completo.
 * 3. **Ids fixos + `onConflictDoNothing`** — a rede para o que a flag não cobre:
 *    app morto entre o último insert e a gravação da preferência, ou backup
 *    restaurado que já continha o catálogo.
 *
 * ## Por que não passa por `mutations.ts`
 *
 * Desvio consciente da regra "toda escrita passa por mutations", declarado aqui:
 * as mutations geram id com `novoId()`, e o seed precisa dos ids em slug — sem
 * eles não há em que conflitar e reaplicar duplica o catálogo. `mutations.ts`
 * continua sendo o único caminho de escrita da UI.
 */

import { eq } from 'drizzle-orm';

import { criarCarga, colunasDaCarga, type Carga } from '../dominio/carga.ts';
import { unidadeDoTipo } from '../dominio/exercicio.ts';
import { agora, db } from './conexao.ts';
import {
  exercicios,
  preferencias,
  treinoExercicios,
  treinos,
  PREF_SEED_VERSAO,
  type TipoMedicao,
} from './schema.ts';
import { EXERCICIOS_INICIAIS, SEED_VERSAO, TREINOS_INICIAIS } from './seed-dados.ts';

export type ResultadoSeed =
  | { aplicado: false; motivo: 'ja_aplicado'; versao: number }
  | { aplicado: true; versao: number; exercicios: number; treinos: number; itens: number };

/** `0` quando nunca semeou — inclusive num banco recém-migrado. */
export function versaoDoSeedAplicada(): number {
  const linha = db
    .select({ valor: preferencias.valor })
    .from(preferencias)
    .where(eq(preferencias.chave, PREF_SEED_VERSAO))
    .get();

  if (!linha) return 0;
  const n = Number.parseInt(linha.valor, 10);
  // Valor ilegível é tratado como "nunca semeou": os ids fixos tornam reaplicar
  // inofensivo, enquanto confiar num NaN deixaria o catálogo faltando para sempre.
  return Number.isFinite(n) ? n : 0;
}

/**
 * O número neutro do seed vira `Carga` na unidade que o próprio exercício
 * declara. É aqui — e só aqui — que o seed encosta em unidade; `colunasDaCarga`
 * faz o resto e mantém a XOR das colunas verdadeira por construção.
 */
function cargaDoSeed(tipoMedicao: TipoMedicao, valor: number | null): Carga | null {
  const unidade = unidadeDoTipo(tipoMedicao);
  if (unidade === null || valor === null) return null;
  return criarCarga(unidade, valor);
}

export function aplicarSeed(): ResultadoSeed {
  const versaoAtual = versaoDoSeedAplicada();
  if (versaoAtual >= SEED_VERSAO) {
    return { aplicado: false, motivo: 'ja_aplicado', versao: versaoAtual };
  }

  const instante = agora();
  let inseridosExercicios = 0;
  let inseridosTreinos = 0;
  let inseridosItens = 0;

  db.transaction((tx) => {
    for (const ex of EXERCICIOS_INICIAIS) {
      const incremento = cargaDoSeed(ex.tipoMedicao, ex.incremento);
      const { cargaG, cargaPlacas } = colunasDaCarga(incremento);
      const r = tx
        .insert(exercicios)
        .values({
          id: ex.id,
          nome: ex.nome,
          grupoMuscular: ex.grupoMuscular,
          equipamento: ex.equipamento,
          tipoMedicao: ex.tipoMedicao,
          incrementoG: cargaG,
          incrementoPlacas: cargaPlacas,
          // Nenhum nasce calibrado: quanto pesa a placa é descoberta dele, não chute nosso.
          gramasPorPlaca: null,
          criadoEm: instante,
          atualizadoEm: instante,
        })
        .onConflictDoNothing()
        .run();
      inseridosExercicios += r.changes;
    }

    for (const treino of TREINOS_INICIAIS) {
      const r = tx
        .insert(treinos)
        .values({
          id: treino.id,
          nome: treino.nome,
          descricao: treino.descricao,
          ordem: treino.ordem,
          criadoEm: instante,
          atualizadoEm: instante,
        })
        .onConflictDoNothing()
        .run();
      inseridosTreinos += r.changes;

      for (const it of treino.itens) {
        const exercicio = EXERCICIOS_INICIAIS.find((e) => e.id === it.exercicioId);
        if (!exercicio) throw new Error(`Item ${it.id} aponta para exercício inexistente.`);

        const alvo = cargaDoSeed(exercicio.tipoMedicao, it.cargaAlvo);
        const { cargaG, cargaPlacas } = colunasDaCarga(alvo);
        const ri = tx
          .insert(treinoExercicios)
          .values({
            id: it.id,
            treinoId: treino.id,
            exercicioId: it.exercicioId,
            ordem: it.ordem,
            seriesAlvo: it.seriesAlvo,
            repsAlvoMin: it.repsAlvoMin,
            repsAlvoMax: it.repsAlvoMax,
            cargaAlvoG: cargaG,
            cargaAlvoPlacas: cargaPlacas,
            duracaoAlvoS: it.duracaoAlvoS,
            descansoS: it.descansoS,
            criadoEm: instante,
            atualizadoEm: instante,
          })
          .onConflictDoNothing()
          .run();
        inseridosItens += ri.changes;
      }
    }

    // `onConflictDoUpdate` e não `DoNothing`: o dia em que o SEED_VERSAO virar 2,
    // a chave já existe valendo '1' e um "do nothing" travaria o portão para sempre.
    tx.insert(preferencias)
      .values({ chave: PREF_SEED_VERSAO, valor: String(SEED_VERSAO), atualizadoEm: instante })
      .onConflictDoUpdate({
        target: preferencias.chave,
        set: { valor: String(SEED_VERSAO), atualizadoEm: instante },
      })
      .run();
  });

  return {
    aplicado: true,
    versao: SEED_VERSAO,
    exercicios: inseridosExercicios,
    treinos: inseridosTreinos,
    itens: inseridosItens,
  };
}
