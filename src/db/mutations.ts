/**
 * Toda escrita passa por aqui — nunca direto da tela. É o que mantém
 * `atualizado_em`, soft delete e as invariantes num lugar só.
 *
 * As transações são **síncronas** com `.run()` explícito: callback `async` no
 * driver do Expo não faz rollback (ver `dados-locais`).
 *
 * ## A trava que o banco não pode dar
 *
 * `CHECK` do SQLite não aceita subquery, então **nada** no banco liga
 * `series.carga_placas` ao `tipo_medicao` do exercício, e nada nos tipos pode
 * ligar, porque `exercicioId` é uma `string`. Sem `cargaCompativel` aqui dentro,
 * `registrarSerie({ exercicioId: peckDorsal, carga: kg(40000) })` gravaria quilo
 * num exercício de placa e o histórico passaria a ter duas unidades.
 *
 * Isto é garantia de APLICAÇÃO, declarada como tal, e é por isso que ela tem
 * teste próprio em `mutations.test.ts`.
 */

import { and, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import {
  colunasDaCarga,
  cargaDaLinha,
  formatarCarga,
  INCREMENTO_PADRAO,
  type Carga,
} from '../dominio/carga.ts';
import type { SerieSugerida } from '../dominio/execucao.ts';
import {
  cargaCompativel,
  incrementoPadrao,
  unidadeDoTipo,
  type Exercicio as ExercicioDoDominio,
} from '../dominio/exercicio.ts';
import { agora, db, novoId, type Banco } from './conexao.ts';
import { anunciarEscrita } from './sinal.ts';
import {
  exercicios,
  medidas,
  perfil,
  pesagens,
  preferencias,
  series,
  sessoes,
  treinoExercicios,
  treinos,
  type ParteCorpo,
  type TipoMedicao,
  type TipoSerie,
} from './schema.ts';

/** A transação síncrona, como o driver do aparelho a entrega. */
type Escrita = Parameters<Parameters<Banco['transaction']>[0]>[0];

/** `perfil` é linha única por CHECK: o id é constante, não dado. */
const ID_PERFIL = 'unico';

// ── Leitura interna ────────────────────────────────────────────────────────
// Mutations leem DENTRO da própria transação — ler por `queries.ts` deixaria a
// validação fora do BEGIN e é justamente o que a trava não pode aceitar.

/**
 * Não filtra `arquivado_em`: corrigir uma série de exercício arquivado continua
 * precisando saber a unidade dele.
 */
/**
 * O maior índice já usado + 1, dentro da transação que vai gravar.
 *
 * NÃO filtra `arquivado_em`: o UNIQUE também não filtra, então uma série
 * desfeita continua ocupando o slot dela. Contar só as visíveis recolidiria no
 * número da série desfeita — é `maior + 1`, nunca `quantidade`.
 */
function proximoIndiceNaTransacao(tx: Escrita, sessaoId: string, exercicioId: string): number {
  const linha = tx
    .select({ maior: sql<number | null>`max(${series.indice})` })
    .from(series)
    .where(and(eq(series.sessaoId, sessaoId), eq(series.exercicioId, exercicioId)))
    .get();
  return (linha?.maior ?? -1) + 1;
}

function lerExercicio(tx: Escrita, exercicioId: string): ExercicioDoDominio {
  const linha = tx.select().from(exercicios).where(eq(exercicios.id, exercicioId)).get();
  if (!linha) throw new Error(`Exercício ${exercicioId} não encontrado.`);
  return {
    id: linha.id,
    nome: linha.nome,
    grupoMuscular: linha.grupoMuscular,
    tipoMedicao: linha.tipoMedicao,
    incremento: cargaDaLinha({ cargaG: linha.incrementoG, cargaPlacas: linha.incrementoPlacas }),
    gramasPorPlaca: linha.gramasPorPlaca,
    arquivadoEm: linha.arquivadoEm,
  };
}

function descrever(c: Carga | null): string {
  return c === null ? 'sem carga' : formatarCarga(c);
}

/** A trava do risco nº 1, com a mensagem que diz o que estava errado. */
function exigirCargaCompativel(ex: ExercicioDoDominio, carga: Carga | null): void {
  if (cargaCompativel(ex, carga)) return;
  throw new Error(
    `Carga incompatível com "${ex.nome}" (${ex.tipoMedicao}): recebi ${descrever(carga)}.`
  );
}

/**
 * Carga de PLANO aceita `null` — item de ficha sem carga-alvo é legítimo (a
 * estreia cai no teclado). Carga de SÉRIE não: por isso são duas conferências.
 */
function exigirCargaAlvoCompativel(ex: ExercicioDoDominio, carga: Carga | null): void {
  if (carga === null) return;
  const u = unidadeDoTipo(ex.tipoMedicao);
  if (u !== null && carga.unidade === u) return;
  throw new Error(
    `Carga-alvo incompatível com "${ex.nome}" (${ex.tipoMedicao}): recebi ${descrever(carga)}.`
  );
}

/**
 * O `ck_exercicios_incremento` já barra o par incoerente, mas com uma mensagem
 * de SQLite. Conferir aqui é o que devolve o nome do exercício e a unidade.
 */
function exigirIncrementoCompativel(tipo: TipoMedicao, incremento: Carga | null): void {
  const u = unidadeDoTipo(tipo);
  if (u === null) {
    if (incremento === null) return;
    throw new Error(`Exercício de ${tipo} não tem incremento: recebi ${descrever(incremento)}.`);
  }
  if (incremento !== null && incremento.unidade === u) return;
  throw new Error(`Incremento de ${tipo} tem que ser em ${u}: recebi ${descrever(incremento)}.`);
}

// ── CATÁLOGO ───────────────────────────────────────────────────────────────

export function criarExercicio(dados: {
  nome: string;
  /** Obrigatório: escolher a unidade não é opcional, e é o exercício quem decide. */
  tipoMedicao: TipoMedicao;
  incremento?: Carga | null;
  gramasPorPlaca?: number | null;
  grupoMuscular?: string;
  equipamento?: string;
  observacao?: string;
}): string {
  const incremento =
    dados.incremento === undefined ? incrementoPadrao(dados.tipoMedicao) : dados.incremento;
  exigirIncrementoCompativel(dados.tipoMedicao, incremento);

  const gramasPorPlaca = dados.gramasPorPlaca ?? null;
  if (gramasPorPlaca !== null && dados.tipoMedicao !== 'carga_placa') {
    throw new Error(`Só exercício de placa tem gramas por placa; ${dados.nome} é ${dados.tipoMedicao}.`);
  }

  const colunas = colunasDaCarga(incremento);
  const id = novoId();
  const instante = agora();
  db.insert(exercicios)
    .values({
      id,
      nome: dados.nome,
      grupoMuscular: dados.grupoMuscular,
      equipamento: dados.equipamento,
      observacao: dados.observacao,
      tipoMedicao: dados.tipoMedicao,
      incrementoG: colunas.cargaG,
      incrementoPlacas: colunas.cargaPlacas,
      gramasPorPlaca,
      criadoEm: instante,
      atualizadoEm: instante,
    })
    .run();
  anunciarEscrita();
  return id;
}

/**
 * `tipoMedicao` não está aqui de propósito: mudar a unidade de um exercício com
 * histórico é `alterarTipoMedicao`, que sabe recusar.
 */
export function editarExercicio(
  exercicioId: string,
  dados: Partial<{
    nome: string;
    grupoMuscular: string;
    equipamento: string;
    incremento: Carga | null;
    observacao: string;
  }>
): void {
  const instante = agora();
  db.transaction((tx) => {
    const campos: Partial<typeof exercicios.$inferInsert> = { atualizadoEm: instante };
    if (dados.nome !== undefined) campos.nome = dados.nome;
    if (dados.grupoMuscular !== undefined) campos.grupoMuscular = dados.grupoMuscular;
    if (dados.equipamento !== undefined) campos.equipamento = dados.equipamento;
    if (dados.observacao !== undefined) campos.observacao = dados.observacao;
    // `in` e não `!== undefined`: `{ incremento: null }` é um pedido explícito.
    if ('incremento' in dados) {
      const ex = lerExercicio(tx, exercicioId);
      const incremento = dados.incremento ?? null;
      exigirIncrementoCompativel(ex.tipoMedicao, incremento);
      const colunas = colunasDaCarga(incremento);
      campos.incrementoG = colunas.cargaG;
      campos.incrementoPlacas = colunas.cargaPlacas;
    }
    tx.update(exercicios).set(campos).where(eq(exercicios.id, exercicioId)).run();
  });
}

/**
 * Soft delete: apagar o exercício apagaria o histórico de séries dele, que é
 * justamente o dado que o app existe para acumular.
 */
export function arquivarExercicio(exercicioId: string): void {
  const instante = agora();
  db.update(exercicios)
    .set({ arquivadoEm: instante, atualizadoEm: instante })
    .where(and(eq(exercicios.id, exercicioId), isNull(exercicios.arquivadoEm)))
    .run();
  anunciarEscrita();
}

/**
 * O dia da descoberta ("a placa pesa 5 kg"): UPDATE de UMA linha, e nenhuma
 * linha de `series` é tocada. A conversão acontece na leitura, então o histórico
 * inteiro ganha equivalente em kg retroativamente — e `null` volta a "não sei"
 * sem falsificar nada.
 */
export function calibrarPlaca(
  exercicioId: string,
  gramasPorPlaca: number | null
): { ok: true } | { ok: false; motivo: 'nao_e_placa' } {
  if (gramasPorPlaca !== null && gramasPorPlaca <= 0) {
    throw new Error('Gramas por placa tem que ser maior que zero, ou null para descalibrar.');
  }
  const instante = agora();
  return db.transaction((tx) => {
    const ex = lerExercicio(tx, exercicioId);
    if (ex.tipoMedicao !== 'carga_placa') return { ok: false as const, motivo: 'nao_e_placa' as const };
    tx.update(exercicios)
      .set({ gramasPorPlaca, atualizadoEm: instante })
      .where(eq(exercicios.id, exercicioId))
      .run();
    return { ok: true as const };
  });
}

/**
 * Recusa se já existir QUALQUER série, inclusive arquivada: a unidade do
 * histórico não muda sob os pés de quem já gravou.
 *
 * Ajusta o incremento junto (o `ck_exercicios_incremento` exige o par coerente)
 * e LIMPA a carga-alvo das fichas que ficariam na unidade errada — deixá-la ali
 * faria o prefill devolver uma carga que `registrarSerie` recusa na academia.
 */
export function alterarTipoMedicao(
  exercicioId: string,
  tipo: TipoMedicao
): { ok: true } | { ok: false; motivo: 'tem_series'; series: number } {
  const instante = agora();
  return db.transaction((tx) => {
    const ex = lerExercicio(tx, exercicioId);
    const [total] = tx
      .select({ quantas: count() })
      .from(series)
      .where(eq(series.exercicioId, exercicioId))
      .all();
    if (total && total.quantas > 0) {
      return { ok: false as const, motivo: 'tem_series' as const, series: total.quantas };
    }

    const u = unidadeDoTipo(tipo);
    // Mantém o incremento quando a unidade sobrevive à troca; senão, o padrão.
    const incremento =
      ex.incremento !== null && u !== null && ex.incremento.unidade === u
        ? ex.incremento
        : incrementoPadrao(tipo);
    const colunas = colunasDaCarga(incremento);

    tx.update(exercicios)
      .set({
        tipoMedicao: tipo,
        incrementoG: colunas.cargaG,
        incrementoPlacas: colunas.cargaPlacas,
        gramasPorPlaca: tipo === 'carga_placa' ? ex.gramasPorPlaca : null,
        atualizadoEm: instante,
      })
      .where(eq(exercicios.id, exercicioId))
      .run();

    tx.update(treinoExercicios)
      .set({
        cargaAlvoG: u === 'kg' ? treinoExercicios.cargaAlvoG : null,
        cargaAlvoPlacas: u === 'placa' ? treinoExercicios.cargaAlvoPlacas : null,
        atualizadoEm: instante,
      })
      .where(eq(treinoExercicios.exercicioId, exercicioId))
      .run();

    return { ok: true as const };
  });
}

/**
 * O outro 10% da pergunta de seis meses: "quero DIGITAR em kg de agora em
 * diante". É LOSSY e irreversível — reescreve `series` e `carga_alvo` —, exige
 * calibração e só existe no sentido placa → kg, porque kg → placa não acontece
 * na vida real e seria caminho sem uso.
 *
 * Quem só quer VER em kg usa `calibrarPlaca`, que não toca em série nenhuma.
 */
export function converterExercicioParaKg(
  exercicioId: string
):
  | { ok: true; seriesConvertidas: number }
  | { ok: false; motivo: 'sem_calibracao' | 'nao_e_placa' } {
  const instante = agora();
  return db.transaction((tx) => {
    const ex = lerExercicio(tx, exercicioId);
    if (ex.tipoMedicao !== 'carga_placa') return { ok: false as const, motivo: 'nao_e_placa' as const };
    const gramasPorPlaca = ex.gramasPorPlaca;
    if (gramasPorPlaca === null || gramasPorPlaca <= 0) {
      return { ok: false as const, motivo: 'sem_calibracao' as const };
    }

    // Conta ANTES de converter: depois do UPDATE não há mais o que contar.
    // Inclui as arquivadas, que também guardam placa e também precisam migrar.
    const [total] = tx
      .select({ quantas: count() })
      .from(series)
      .where(and(eq(series.exercicioId, exercicioId), isNotNull(series.cargaPlacas)))
      .all();

    tx.update(series)
      .set({
        cargaG: sql`${series.cargaPlacas} * ${gramasPorPlaca}`,
        cargaPlacas: null,
        atualizadoEm: instante,
      })
      .where(and(eq(series.exercicioId, exercicioId), isNotNull(series.cargaPlacas)))
      .run();

    tx.update(treinoExercicios)
      .set({
        cargaAlvoG: sql`${treinoExercicios.cargaAlvoPlacas} * ${gramasPorPlaca}`,
        cargaAlvoPlacas: null,
        atualizadoEm: instante,
      })
      .where(
        and(
          eq(treinoExercicios.exercicioId, exercicioId),
          isNotNull(treinoExercicios.cargaAlvoPlacas)
        )
      )
      .run();

    const incremento = ex.incremento;
    const incrementoG =
      incremento !== null && incremento.unidade === 'placa'
        ? incremento.placas * gramasPorPlaca
        : INCREMENTO_PADRAO.kg;

    tx.update(exercicios)
      .set({
        tipoMedicao: 'carga_kg',
        incrementoG,
        incrementoPlacas: null,
        // `ck_exercicios_placa` só admite gramas por placa em `carga_placa`, e
        // não há mais placa nenhuma para converter.
        gramasPorPlaca: null,
        atualizadoEm: instante,
      })
      .where(eq(exercicios.id, exercicioId))
      .run();

    return { ok: true as const, seriesConvertidas: total?.quantas ?? 0 };
  });
}

// ── FICHA ──────────────────────────────────────────────────────────────────

export function criarTreino(dados: { nome: string; descricao?: string; ordem?: number }): string {
  const id = novoId();
  const instante = agora();
  db.insert(treinos)
    .values({ id, criadoEm: instante, atualizadoEm: instante, ...dados })
    .run();
  anunciarEscrita();
  return id;
}

export function arquivarTreino(treinoId: string): void {
  const instante = agora();
  db.update(treinos)
    .set({ arquivadoEm: instante, atualizadoEm: instante })
    .where(and(eq(treinos.id, treinoId), isNull(treinos.arquivadoEm)))
    .run();
  anunciarEscrita();
}

/**
 * Insere um item na ficha. Não é upsert de propósito: bi-set e drop-set repetem
 * o mesmo exercício no mesmo treino, e por isso não existe UNIQUE
 * (treino_id, exercicio_id) para um upsert se apoiar.
 */
export function definirItemDoTreino(dados: {
  treinoId: string;
  exercicioId: string;
  ordem: number;
  seriesAlvo: number;
  repsAlvoMin?: number | null;
  repsAlvoMax?: number | null;
  cargaAlvo?: Carga | null;
  duracaoAlvoS?: number | null;
  descansoS?: number;
  observacao?: string;
}): string {
  const id = novoId();
  const instante = agora();
  const cargaAlvo = dados.cargaAlvo ?? null;

  db.transaction((tx) => {
    const ex = lerExercicio(tx, dados.exercicioId);
    exigirCargaAlvoCompativel(ex, cargaAlvo);
    const colunas = colunasDaCarga(cargaAlvo);
    tx.insert(treinoExercicios)
      .values({
        id,
        treinoId: dados.treinoId,
        exercicioId: dados.exercicioId,
        ordem: dados.ordem,
        seriesAlvo: dados.seriesAlvo,
        repsAlvoMin: dados.repsAlvoMin ?? null,
        repsAlvoMax: dados.repsAlvoMax ?? null,
        cargaAlvoG: colunas.cargaG,
        cargaAlvoPlacas: colunas.cargaPlacas,
        duracaoAlvoS: dados.duracaoAlvoS ?? null,
        descansoS: dados.descansoS,
        observacao: dados.observacao,
        criadoEm: instante,
        atualizadoEm: instante,
      })
      .run();
  });
  return id;
}

/** Sem `cargaAlvo`: carga na ficha só muda por `definirCargaAlvo`, que é uma decisão. */
export function atualizarItemDoTreino(
  itemId: string,
  dados: Partial<{
    ordem: number;
    seriesAlvo: number;
    repsAlvoMin: number | null;
    repsAlvoMax: number | null;
    duracaoAlvoS: number | null;
    descansoS: number;
    observacao: string;
  }>
): void {
  const campos: Partial<typeof treinoExercicios.$inferInsert> = { atualizadoEm: agora() };
  if (dados.ordem !== undefined) campos.ordem = dados.ordem;
  if (dados.seriesAlvo !== undefined) campos.seriesAlvo = dados.seriesAlvo;
  if (dados.repsAlvoMin !== undefined) campos.repsAlvoMin = dados.repsAlvoMin;
  if (dados.repsAlvoMax !== undefined) campos.repsAlvoMax = dados.repsAlvoMax;
  if (dados.duracaoAlvoS !== undefined) campos.duracaoAlvoS = dados.duracaoAlvoS;
  if (dados.descansoS !== undefined) campos.descansoS = dados.descansoS;
  if (dados.observacao !== undefined) campos.observacao = dados.observacao;
  db.update(treinoExercicios).set(campos).where(eq(treinoExercicios.id, itemId)).run();
  anunciarEscrita();
}

/**
 * O ÚNICO caminho que escreve carga na ficha, e é sempre ação explícita dele no
 * resumo da sessão — nunca efeito colateral de ter treinado. Plano ≠ realizado:
 * se editar a carga no meio do treino reescrevesse a ficha, um dia ruim viraria
 * o novo plano em silêncio.
 */
export function definirCargaAlvo(itemId: string, carga: Carga | null): void {
  const instante = agora();
  db.transaction((tx) => {
    const item = tx
      .select({ exercicioId: treinoExercicios.exercicioId })
      .from(treinoExercicios)
      .where(eq(treinoExercicios.id, itemId))
      .get();
    if (!item) throw new Error(`Item de treino ${itemId} não encontrado.`);
    exigirCargaAlvoCompativel(lerExercicio(tx, item.exercicioId), carga);
    const colunas = colunasDaCarga(carga);
    tx.update(treinoExercicios)
      .set({ cargaAlvoG: colunas.cargaG, cargaAlvoPlacas: colunas.cargaPlacas, atualizadoEm: instante })
      .where(eq(treinoExercicios.id, itemId))
      .run();
  });
}

export function removerItemDoTreino(itemId: string): void {
  const instante = agora();
  db.update(treinoExercicios)
    .set({ arquivadoEm: instante, atualizadoEm: instante })
    .where(and(eq(treinoExercicios.id, itemId), isNull(treinoExercicios.arquivadoEm)))
    .run();
  anunciarEscrita();
}

/**
 * Uma transação só: reordenar pela metade deixaria dois itens na mesma posição.
 * Sem UNIQUE em (treino_id, ordem) justamente para isto não precisar de valor
 * temporário — o swap em duas etapas seria custo alto para um problema visual.
 */
export function reordenarItensDoTreino(treinoId: string, idsNaOrdem: string[]): void {
  const instante = agora();
  db.transaction((tx) => {
    idsNaOrdem.forEach((itemId, ordem) => {
      tx.update(treinoExercicios)
        .set({ ordem, atualizadoEm: instante })
        .where(and(eq(treinoExercicios.id, itemId), eq(treinoExercicios.treinoId, treinoId)))
        .run();
    });
  });
}

// ── SESSÃO ─────────────────────────────────────────────────────────────────

/**
 * Copia o nome da ficha: renomeá-la depois não pode reescrever o histórico.
 *
 * Devolve resultado em vez de lançar porque "já tem treino aberto" é fluxo
 * normal (a sessão de ontem esquecida aberta), e a tela precisa de caminho
 * limpo para oferecer Retomar/Finalizar. A garantia final continua sendo do
 * banco: `uq_sessao_aberta` barra a segunda mesmo com bug de tela.
 */
export function iniciarSessao(dados: {
  nome: string;
  treinoId?: string;
}): { ok: true; sessaoId: string } | { ok: false; jaAberta: string } {
  const id = novoId();
  const instante = agora();
  return db.transaction((tx) => {
    const aberta = tx
      .select({ id: sessoes.id })
      .from(sessoes)
      .where(and(isNull(sessoes.finalizadaEm), isNull(sessoes.arquivadoEm)))
      .get();
    if (aberta) return { ok: false as const, jaAberta: aberta.id };

    tx.insert(sessoes)
      .values({
        id,
        nome: dados.nome,
        treinoId: dados.treinoId,
        iniciadaEm: instante,
        criadoEm: instante,
        atualizadoEm: instante,
      })
      .run();
    return { ok: true as const, sessaoId: id };
  });
}

/**
 * `quando` existe para "finalizar às 20h05 da última série" na sessão que ficou
 * aberta desde ontem — fabricar `agora()` ali inventaria uma hora de treino.
 * O `isNull(finalizadaEm)` é o que impede refinalizar de sobrescrever o
 * instante verdadeiro; o `ck_sessoes_intervalo` impede término antes do início.
 */
export function finalizarSessao(sessaoId: string, quando?: number): void {
  const instante = agora();
  db.update(sessoes)
    .set({ finalizadaEm: quando ?? instante, atualizadoEm: instante })
    .where(and(eq(sessoes.id, sessaoId), isNull(sessoes.finalizadaEm)))
    .run();
  anunciarEscrita();
}

/** Finalizou sem querer no meio do treino. `uq_sessao_aberta` recusa se já houver outra aberta. */
export function reabrirSessao(sessaoId: string): void {
  const instante = agora();
  db.update(sessoes)
    .set({ finalizadaEm: null, atualizadoEm: instante })
    .where(and(eq(sessoes.id, sessaoId), isNull(sessoes.arquivadoEm)))
    .run();
  anunciarEscrita();
}

/**
 * Abriu o treino errado e saiu antes de registrar qualquer coisa.
 *
 * Apaga de verdade, sem `arquivadoEm`: sessão sem uma série sequer não é
 * histórico, é engano — e deixá-la aberta ainda BLOQUEARIA começar o treino
 * certo, porque `uq_sessao_aberta` só admite uma aberta por vez.
 *
 * Recusa (devolvendo `false`) se existir qualquer série apontando para ela,
 * **inclusive desfeita**: a série arquivada continua sendo linha no banco com
 * FK para a sessão, e o registro de que aquele treino existiu. Quem chama trata
 * o `false` como "esta ainda vale, deixe aberta".
 */
export function descartarSessaoVazia(sessaoId: string): boolean {
  return db.transaction((tx) => {
    const alguma = tx
      .select({ id: series.id })
      .from(series)
      .where(eq(series.sessaoId, sessaoId))
      .get();
    if (alguma) return false;
    tx.delete(sessoes).where(eq(sessoes.id, sessaoId)).run();
    return true;
  });
}

// ── SÉRIE ──────────────────────────────────────────────────────────────────

/**
 * Peça `indice: PROXIMO_INDICE` para deixar o banco decidir o número da série.
 * Índice explícito existe para o teste montar um cenário exato; a UI não deve
 * usá-lo, porque o número que ela tem é sempre do render anterior.
 */
export const PROXIMO_INDICE = -1;

/**
 * `carga` é obrigatória e não aceita `number`: opcional deixaria esquecer,
 * `number` não diz a unidade e um `cargaG` convidaria a passar 5 placas. `null`
 * é resposta válida e explícita — peso corporal, tempo, distância.
 *
 * Valida contra o exercício lido na MESMA transação e lança se divergir.
 */
export function registrarSerie(dados: {
  sessaoId: string;
  exercicioId: string;
  /** Número fixo, ou `PROXIMO_INDICE` para calcular dentro da transação. */
  indice: number;
  tipo?: TipoSerie;
  carga: Carga | null;
  repeticoes?: number | null;
  duracaoS?: number | null;
  rir?: number | null;
  concluidaEm?: number;
}): string {
  const id = novoId();
  const instante = agora();
  const colunas = colunasDaCarga(dados.carga);

  db.transaction((tx) => {
    exigirCargaCompativel(lerExercicio(tx, dados.exercicioId), dados.carga);

    // Ler o índice aqui, e não antes, é o que fecha a janela entre decidir e
    // gravar. Conta as ARQUIVADAS porque o UNIQUE também não as filtra: desfazer
    // a série 3 e registrar de novo tem que ir para a 4, não recolidir na 3.
    const indice =
      dados.indice === PROXIMO_INDICE
        ? proximoIndiceNaTransacao(tx, dados.sessaoId, dados.exercicioId)
        : dados.indice;

    tx.insert(series)
      .values({
        id,
        sessaoId: dados.sessaoId,
        exercicioId: dados.exercicioId,
        indice,
        tipo: dados.tipo,
        cargaG: colunas.cargaG,
        cargaPlacas: colunas.cargaPlacas,
        repeticoes: dados.repeticoes ?? null,
        duracaoS: dados.duracaoS ?? null,
        rir: dados.rir ?? null,
        concluidaEm: dados.concluidaEm ?? instante,
        criadoEm: instante,
        atualizadoEm: instante,
      })
      .run();

    tx.update(sessoes).set({ atualizadoEm: instante }).where(eq(sessoes.id, dados.sessaoId)).run();
  });
  return id;
}

/**
 * O UM TOQUE. Recebe pronto o objeto que `sugerirProximaSerie` montou: a tela
 * não escolhe carga, nem repetição, nem índice — se escolhesse, a regra viraria
 * `if` dentro de `src/app/` e ficaria sem teste.
 */
/**
 * O caminho do um-toque. Ignora `sugerida.indice` **de propósito**.
 *
 * O índice que a tela carrega foi calculado no render anterior; entre o toque e
 * o redesenho ele está velho. Dois toques rápidos mandavam o mesmo número, o
 * segundo batia no `uq_series_sessao_exercicio_indice` e o Henrique via um erro
 * de SQL no meio do treino (17/08/2026, primeira sessão real).
 *
 * Aqui o índice é lido e usado na MESMA transação, então não existe janela entre
 * decidir e gravar. O UNIQUE continua como rede — mas deixa de ser alcançável
 * por tela desatualizada, que é o único jeito de o Henrique encostar nele.
 *
 * Este é o par do `ultimoRegistro` na tela: aqui o índice nunca colide; lá o
 * toque repetido não vira série fantasma.
 */
export function confirmarSerie(sessaoId: string, sugerida: SerieSugerida): string {
  return registrarSerie({
    sessaoId,
    exercicioId: sugerida.exercicioId,
    indice: PROXIMO_INDICE,
    tipo: sugerida.tipo,
    carga: sugerida.carga,
    repeticoes: sugerida.repeticoes,
    duracaoS: sugerida.duracaoS,
  });
}

/** Toque no chip da série já gravada. Revalida a unidade: corrigir também pode errar. */
export function corrigirSerie(
  serieId: string,
  dados: Partial<{
    carga: Carga | null;
    repeticoes: number | null;
    duracaoS: number | null;
    rir: number | null;
    tipo: TipoSerie;
  }>
): void {
  const instante = agora();
  db.transaction((tx) => {
    const linha = tx
      .select({ exercicioId: series.exercicioId })
      .from(series)
      .where(eq(series.id, serieId))
      .get();
    if (!linha) throw new Error(`Série ${serieId} não encontrada.`);

    const campos: Partial<typeof series.$inferInsert> = { atualizadoEm: instante };
    if ('carga' in dados) {
      const carga = dados.carga ?? null;
      exigirCargaCompativel(lerExercicio(tx, linha.exercicioId), carga);
      const colunas = colunasDaCarga(carga);
      campos.cargaG = colunas.cargaG;
      campos.cargaPlacas = colunas.cargaPlacas;
    }
    if (dados.repeticoes !== undefined) campos.repeticoes = dados.repeticoes;
    if (dados.duracaoS !== undefined) campos.duracaoS = dados.duracaoS;
    if (dados.rir !== undefined) campos.rir = dados.rir;
    if (dados.tipo !== undefined) campos.tipo = dados.tipo;

    tx.update(series).set(campos).where(eq(series.id, serieId)).run();
  });
}

/**
 * Soft delete: a linha continua no SQLite e o índice segue OCUPADO, porque
 * `uq_series_sessao_exercicio_indice` não filtra `arquivado_em` de propósito —
 * o índice é a identidade estável do slot. Por isso o próximo índice se calcula
 * contando as arquivadas (`proximoIndice`), e não por `feitas.length`.
 */
export function desfazerSerie(serieId: string): void {
  const instante = agora();
  db.update(series)
    .set({ arquivadoEm: instante, atualizadoEm: instante })
    .where(and(eq(series.id, serieId), isNull(series.arquivadoEm)))
    .run();
  anunciarEscrita();
}

// ── CORPO E PREFERÊNCIAS ───────────────────────────────────────────────────

/**
 * `medidoEm` injetável é requisito de uso real — ele pesa em jejum e registra à
 * noite — antes de ser conveniência de teste.
 *
 * Preencher `peso_inicial_g` aqui é o que salva o caso "definiu a meta antes da
 * primeira pesagem": sem isso o percentual de progresso fica `null` para sempre
 * e ele não vai adivinhar por quê.
 */
export function registrarPesagem(dados: {
  pesoG: number;
  medidoEm?: number;
  observacao?: string;
}): string {
  const id = novoId();
  const instante = agora();
  db.transaction((tx) => {
    tx.insert(pesagens)
      .values({
        id,
        pesoG: dados.pesoG,
        observacao: dados.observacao,
        medidoEm: dados.medidoEm ?? instante,
        criadoEm: instante,
        atualizadoEm: instante,
      })
      .run();

    tx.update(perfil)
      .set({ pesoInicialG: dados.pesoG, atualizadoEm: instante })
      .where(
        and(
          eq(perfil.id, ID_PERFIL),
          isNotNull(perfil.pesoObjetivoG),
          isNull(perfil.pesoInicialG)
        )
      )
      .run();
  });
  return id;
}

export function registrarMedida(dados: {
  parte: ParteCorpo;
  valorMm: number;
  medidoEm?: number;
  observacao?: string;
}): string {
  const id = novoId();
  const instante = agora();
  db.insert(medidas)
    .values({
      id,
      parte: dados.parte,
      valorMm: dados.valorMm,
      observacao: dados.observacao,
      medidoEm: dados.medidoEm ?? instante,
      criadoEm: instante,
      atualizadoEm: instante,
    })
    .run();
  anunciarEscrita();
  return id;
}

/** Dedo errado na balança é o erro mais comum da aba Corpo. */
export function arquivarPesagem(pesagemId: string): void {
  const instante = agora();
  db.update(pesagens)
    .set({ arquivadoEm: instante, atualizadoEm: instante })
    .where(and(eq(pesagens.id, pesagemId), isNull(pesagens.arquivadoEm)))
    .run();
  anunciarEscrita();
}

export function arquivarMedida(medidaId: string): void {
  const instante = agora();
  db.update(medidas)
    .set({ arquivadoEm: instante, atualizadoEm: instante })
    .where(and(eq(medidas.id, medidaId), isNull(medidas.arquivadoEm)))
    .run();
  anunciarEscrita();
}

/** Upsert na linha única de `perfil`: ela nasce no primeiro dado gravado. */
export function salvarAltura(alturaMm: number): void {
  const instante = agora();
  db.insert(perfil)
    .values({ id: ID_PERFIL, alturaMm, criadoEm: instante, atualizadoEm: instante })
    .onConflictDoUpdate({ target: perfil.id, set: { alturaMm, atualizadoEm: instante } })
    .run();
  anunciarEscrita();
}

/**
 * `pesoInicialG` omitido copia a última pesagem — percentual de progresso sem
 * ponto de partida é chute, e a partida certa é o peso do dia em que ele
 * decidiu a meta, não a primeira pesagem de dois anos atrás.
 */
export function definirObjetivoPeso(pesoObjetivoG: number, pesoInicialG?: number): void {
  const instante = agora();
  db.transaction((tx) => {
    let inicial = pesoInicialG ?? null;
    if (inicial === null) {
      const ultima = tx
        .select({ pesoG: pesagens.pesoG })
        .from(pesagens)
        .where(isNull(pesagens.arquivadoEm))
        .orderBy(desc(pesagens.medidoEm))
        .get();
      inicial = ultima?.pesoG ?? null;
    }
    tx.insert(perfil)
      .values({
        id: ID_PERFIL,
        pesoObjetivoG,
        pesoInicialG: inicial,
        objetivoDefinidoEm: instante,
        criadoEm: instante,
        atualizadoEm: instante,
      })
      .onConflictDoUpdate({
        target: perfil.id,
        set: {
          pesoObjetivoG,
          pesoInicialG: inicial,
          objetivoDefinidoEm: instante,
          atualizadoEm: instante,
        },
      })
      .run();
  });
}

/** Configuração não se arquiva, se limpa: a partida vai junto, senão mentiria na próxima meta. */
export function limparObjetivoPeso(): void {
  const instante = agora();
  db.update(perfil)
    .set({
      pesoObjetivoG: null,
      pesoInicialG: null,
      objetivoDefinidoEm: null,
      atualizadoEm: instante,
    })
    .where(eq(perfil.id, ID_PERFIL))
    .run();
  anunciarEscrita();
}

/** Chaves em `PREF_*` no schema: string solta em dois arquivos é bug de update. */
export function definirPreferencia(chave: string, valor: string): void {
  const instante = agora();
  db.insert(preferencias)
    .values({ chave, valor, atualizadoEm: instante })
    .onConflictDoUpdate({ target: preferencias.chave, set: { valor, atualizadoEm: instante } })
    .run();
  anunciarEscrita();
}
