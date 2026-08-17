/**
 * Toda escrita passa por aqui — nunca direto da tela. É o que mantém
 * `atualizado_em`, soft delete e as invariantes de sessão num lugar só.
 *
 * As transações são **síncronas** com `.run()` explícito: callback `async` no
 * driver do Expo não faz rollback (ver `dados-locais`).
 */

import { and, eq, isNull } from 'drizzle-orm';

import { agora, db, novoId } from './conexao.ts';
import {
  exercicios,
  medidas,
  pesagens,
  series,
  sessoes,
  treinos,
  type ParteCorpo,
  type TipoMedicao,
  type TipoSerie,
} from './schema.ts';

export function criarExercicio(dados: {
  nome: string;
  grupoMuscular?: string;
  equipamento?: string;
  tipoMedicao?: TipoMedicao;
  incrementoG?: number;
}) {
  const id = novoId();
  const instante = agora();
  db.insert(exercicios)
    .values({ id, criadoEm: instante, atualizadoEm: instante, ...dados })
    .run();
  return id;
}

export function criarTreino(dados: { nome: string; descricao?: string; ordem?: number }) {
  const id = novoId();
  const instante = agora();
  db.insert(treinos)
    .values({ id, criadoEm: instante, atualizadoEm: instante, ...dados })
    .run();
  return id;
}

/** Copia o nome da ficha: renomeá-la depois não pode reescrever o histórico. */
export function iniciarSessao(dados: { nome: string; treinoId?: string }) {
  const id = novoId();
  const instante = agora();
  db.insert(sessoes)
    .values({
      id,
      nome: dados.nome,
      treinoId: dados.treinoId,
      iniciadaEm: instante,
      criadoEm: instante,
      atualizadoEm: instante,
    })
    .run();
  return id;
}

export function finalizarSessao(sessaoId: string) {
  const instante = agora();
  db.update(sessoes)
    .set({ finalizadaEm: instante, atualizadoEm: instante })
    .where(eq(sessoes.id, sessaoId))
    .run();
}

export function registrarSerie(dados: {
  sessaoId: string;
  exercicioId: string;
  indice: number;
  tipo?: TipoSerie;
  cargaG?: number | null;
  repeticoes?: number | null;
  duracaoS?: number | null;
  rir?: number | null;
}) {
  const id = novoId();
  const instante = agora();
  db.insert(series)
    .values({ id, concluidaEm: instante, criadoEm: instante, atualizadoEm: instante, ...dados })
    .run();
  return id;
}

export function registrarPesagem(pesoG: number, observacao?: string) {
  const id = novoId();
  const instante = agora();
  db.insert(pesagens)
    .values({ id, pesoG, observacao, medidoEm: instante, criadoEm: instante, atualizadoEm: instante })
    .run();
  return id;
}

export function registrarMedida(parte: ParteCorpo, valorMm: number) {
  const id = novoId();
  const instante = agora();
  db.insert(medidas)
    .values({ id, parte, valorMm, medidoEm: instante, criadoEm: instante, atualizadoEm: instante })
    .run();
  return id;
}

/**
 * Soft delete: apagar o exercício apagaria o histórico de séries dele, que é
 * justamente o dado que o app existe para acumular.
 */
export function arquivarExercicio(exercicioId: string) {
  const instante = agora();
  db.update(exercicios)
    .set({ arquivadoEm: instante, atualizadoEm: instante })
    .where(and(eq(exercicios.id, exercicioId), isNull(exercicios.arquivadoEm)))
    .run();
}
