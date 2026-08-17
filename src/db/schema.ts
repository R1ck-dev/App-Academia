/**
 * Schema do banco local. Convenções em `.claude/skills/dados-locais`:
 * id texto (UUID do aparelho), instantes em epoch ms UTC, soft delete por
 * `arquivado_em`, cargas e medidas em inteiro (ver `treino-domain`).
 */

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Como o exercício é medido. Volume e 1RM só fazem sentido em `carga_reps`;
 * nos outros a conta devolve null e a UI omite o número em vez de mostrar 0 kg.
 */
export const TIPOS_MEDICAO = ['carga_reps', 'peso_corporal', 'tempo', 'distancia'] as const;
export type TipoMedicao = (typeof TIPOS_MEDICAO)[number];

/** Aquecimento não conta em volume nem em recorde. Ver `treino-domain`. */
export const TIPOS_SERIE = ['aquecimento', 'valida', 'falha'] as const;
export type TipoSerie = (typeof TIPOS_SERIE)[number];

const id = () => text('id').primaryKey();
const criadoEm = () => integer('criado_em').notNull();
const atualizadoEm = () => integer('atualizado_em').notNull();
/** Soft delete: apagar exercício apagaria o histórico de séries dele. */
const arquivadoEm = () => integer('arquivado_em');

/** Catálogo. Existe fora de qualquer treino. */
export const exercicios = sqliteTable(
  'exercicios',
  {
    id: id(),
    nome: text('nome').notNull(),
    grupoMuscular: text('grupo_muscular'),
    equipamento: text('equipamento'),
    tipoMedicao: text('tipo_medicao').$type<TipoMedicao>().notNull().default('carga_reps'),
    /** Menor salto de carga possível neste exercício, em gramas (2,5 kg no padrão). */
    incrementoG: integer('incremento_g').notNull().default(2500),
    observacao: text('observacao'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
    arquivadoEm: arquivadoEm(),
  },
  (t) => [index('idx_exercicios_nome').on(t.nome)]
);

/** A ficha: "Treino A — Peito e tríceps". É o plano, não o realizado. */
export const treinos = sqliteTable('treinos', {
  id: id(),
  nome: text('nome').notNull(),
  descricao: text('descricao'),
  ordem: integer('ordem').notNull().default(0),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
  arquivadoEm: arquivadoEm(),
});

/** Itens da ficha, com os alvos que a tela de execução usa como sugestão. */
export const treinoExercicios = sqliteTable(
  'treino_exercicios',
  {
    id: id(),
    treinoId: text('treino_id')
      .notNull()
      .references(() => treinos.id),
    exercicioId: text('exercicio_id')
      .notNull()
      .references(() => exercicios.id),
    ordem: integer('ordem').notNull().default(0),
    seriesAlvo: integer('series_alvo').notNull().default(3),
    repsAlvoMin: integer('reps_alvo_min'),
    repsAlvoMax: integer('reps_alvo_max'),
    descansoS: integer('descanso_s').notNull().default(90),
    observacao: text('observacao'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
    arquivadoEm: arquivadoEm(),
  },
  (t) => [index('idx_treino_exercicios_treino').on(t.treinoId, t.ordem)]
);

/** Uma execução do treino num dia. É o realizado. */
export const sessoes = sqliteTable(
  'sessoes',
  {
    id: id(),
    /** Null quando a sessão foi avulsa, sem ficha. */
    treinoId: text('treino_id').references(() => treinos.id),
    /** Copiado na criação: renomear a ficha depois não pode reescrever o histórico. */
    nome: text('nome').notNull(),
    iniciadaEm: integer('iniciada_em').notNull(),
    finalizadaEm: integer('finalizada_em'),
    observacao: text('observacao'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
    arquivadoEm: arquivadoEm(),
  },
  (t) => [index('idx_sessoes_iniciada').on(t.iniciadaEm)]
);

/**
 * A série executada — a tabela que mais cresce e a que responde "estou evoluindo?".
 * `carga_g` é nullable de propósito: null = não se aplica (peso corporal),
 * 0 seria "levantou zero kg".
 */
export const series = sqliteTable(
  'series',
  {
    id: id(),
    sessaoId: text('sessao_id')
      .notNull()
      .references(() => sessoes.id),
    exercicioId: text('exercicio_id')
      .notNull()
      .references(() => exercicios.id),
    indice: integer('indice').notNull(),
    tipo: text('tipo').$type<TipoSerie>().notNull().default('valida'),
    cargaG: integer('carga_g'),
    repeticoes: integer('repeticoes'),
    duracaoS: integer('duracao_s'),
    /** Repetições em reserva, 0 a 5. Null = não anotado, que é diferente de falha (0). */
    rir: integer('rir'),
    concluidaEm: integer('concluida_em').notNull(),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
    arquivadoEm: arquivadoEm(),
  },
  (t) => [
    // Duas séries com o mesmo índice no mesmo exercício da mesma sessão é sempre
    // bug de gravação (duplo toque no botão), nunca fluxo válido.
    uniqueIndex('uq_series_sessao_exercicio_indice').on(t.sessaoId, t.exercicioId, t.indice),
    // O índice do histórico de evolução: "todas as séries deste exercício no tempo".
    index('idx_series_exercicio').on(t.exercicioId, t.concluidaEm),
  ]
);

/** Peso corporal, em gramas. Duas no mesmo dia é permitido — ver `treino-domain`. */
export const pesagens = sqliteTable(
  'pesagens',
  {
    id: id(),
    pesoG: integer('peso_g').notNull(),
    medidoEm: integer('medido_em').notNull(),
    observacao: text('observacao'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
    arquivadoEm: arquivadoEm(),
  },
  (t) => [index('idx_pesagens_medido').on(t.medidoEm)]
);

/**
 * Partes com lado explícito: medir "braço" sem lado torna a série temporal
 * inútil quando o lado medido alterna.
 */
export const PARTES_CORPO = [
  'peito',
  'cintura',
  'quadril',
  'ombros',
  'braco_direito',
  'braco_esquerdo',
  'antebraco_direito',
  'antebraco_esquerdo',
  'coxa_direita',
  'coxa_esquerda',
  'panturrilha_direita',
  'panturrilha_esquerda',
] as const;
export type ParteCorpo = (typeof PARTES_CORPO)[number];

/** Formato longo: adicionar uma parte nova não pode exigir migration de coluna. */
export const medidas = sqliteTable(
  'medidas',
  {
    id: id(),
    parte: text('parte').$type<ParteCorpo>().notNull(),
    valorMm: integer('valor_mm').notNull(),
    medidoEm: integer('medido_em').notNull(),
    observacao: text('observacao'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
    arquivadoEm: arquivadoEm(),
  },
  (t) => [index('idx_medidas_parte').on(t.parte, t.medidoEm)]
);

/** Chave-valor para preferências do app (unidade, tema, último treino aberto). */
export const preferencias = sqliteTable('preferencias', {
  chave: text('chave').primaryKey(),
  valor: text('valor').notNull(),
  atualizadoEm: atualizadoEm(),
});
