/**
 * Schema do banco local. Convenções em `.claude/skills/dados-locais`:
 * id texto (UUID do aparelho), instantes em epoch ms UTC, soft delete por
 * `arquivado_em`, cargas e medidas em inteiro (ver `treino-domain`).
 *
 * A decisão que organiza este arquivo: **a coluna onde o número mora é o
 * discriminante da unidade**. `carga_g` nunca contém placa, `carga_placas`
 * nunca contém quilo. Consequência prática: um `sum(carga_g * repeticoes)`
 * escrito às pressas continua certo, ignorando as placas — que é exatamente o
 * que se quer, já que somar "5 placas" com "42,5 kg" não significa nada.
 */

import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Unidade e tipo de medição são a mesma coisa, de propósito: uma coluna
 * `unidade` ao lado permitiria o estado impossível `peso_corporal` + `placa`.
 */
export const TIPOS_MEDICAO = [
  'carga_kg',
  'carga_placa',
  'peso_corporal',
  'tempo',
  'distancia',
] as const;
export type TipoMedicao = (typeof TIPOS_MEDICAO)[number];

/** Aquecimento não conta em volume nem em recorde. Ver `treino-domain`. */
export const TIPOS_SERIE = ['aquecimento', 'valida', 'falha'] as const;
export type TipoSerie = (typeof TIPOS_SERIE)[number];

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

/** Contrato das chaves de `preferencias`, num lugar só — string solta em dois arquivos é bug de update. */
export const PREF_SEED_VERSAO = 'seed_versao';
export const PREF_ULTIMO_TREINO = 'ultimo_treino';
/** Instante do último backup exportado — o que a abertura do app usa no aviso. */
export const PREF_ULTIMO_BACKUP = 'ultimo_backup';

const id = () => text('id').primaryKey();
const criadoEm = () => integer('criado_em').notNull();
const atualizadoEm = () => integer('atualizado_em').notNull();
/** Soft delete: apagar exercício apagaria o histórico de séries dele. */
const arquivadoEm = () => integer('arquivado_em');

/** Catálogo. Existe fora de qualquer treino, e é quem define a unidade. */
export const exercicios = sqliteTable(
  'exercicios',
  {
    id: id(),
    nome: text('nome').notNull(),
    grupoMuscular: text('grupo_muscular'),
    equipamento: text('equipamento'),
    /** Sem default: criar exercício sem saber a unidade é impossível na origem. */
    tipoMedicao: text('tipo_medicao').$type<TipoMedicao>().notNull(),
    /** Menor salto possível. Exatamente um dos dois, conforme o tipo. */
    incrementoG: integer('incremento_g'),
    incrementoPlacas: integer('incremento_placas'),
    /**
     * Quanto pesa uma placa desta máquina, quando ele descobrir. NULL = não sei.
     * Preenchido, todo o histórico ganha equivalente em kg na LEITURA — nenhuma
     * linha de `series` é reescrita, então calibrar não perde nem falsifica dado.
     */
    gramasPorPlaca: integer('gramas_por_placa'),
    observacao: text('observacao'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
    arquivadoEm: arquivadoEm(),
  },
  (t) => [
    index('idx_exercicios_nome').on(t.nome),
    check(
      'ck_exercicios_tipo',
      sql`${t.tipoMedicao} in ('carga_kg', 'carga_placa', 'peso_corporal', 'tempo', 'distancia')`
    ),
    check(
      'ck_exercicios_incremento',
      sql`(${t.tipoMedicao} = 'carga_kg' and ${t.incrementoG} > 0 and ${t.incrementoPlacas} is null)
       or (${t.tipoMedicao} = 'carga_placa' and ${t.incrementoPlacas} between 1 and 5 and ${t.incrementoG} is null)
       or (${t.tipoMedicao} in ('peso_corporal', 'tempo', 'distancia') and ${t.incrementoG} is null and ${t.incrementoPlacas} is null)`
    ),
    check(
      'ck_exercicios_placa',
      sql`${t.gramasPorPlaca} is null or (${t.tipoMedicao} = 'carga_placa' and ${t.gramasPorPlaca} > 0)`
    ),
  ]
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

/**
 * Itens da ficha. As cargas-alvo são o que torna o "um toque" possível na
 * estreia de cada exercício: sem elas, a primeira sessão exige digitar tudo.
 */
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
    cargaAlvoG: integer('carga_alvo_g'),
    cargaAlvoPlacas: integer('carga_alvo_placas'),
    /** "Esteira — 10 minutos" = 600. Sem isto o item vira mudo. */
    duracaoAlvoS: integer('duracao_alvo_s'),
    descansoS: integer('descanso_s').notNull().default(90),
    observacao: text('observacao'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
    arquivadoEm: arquivadoEm(),
  },
  (t) => [
    index('idx_treino_exercicios_treino').on(t.treinoId, t.ordem),
    check('ck_te_uma_unidade', sql`${t.cargaAlvoG} is null or ${t.cargaAlvoPlacas} is null`),
    check(
      'ck_te_carga_positiva',
      sql`(${t.cargaAlvoG} is null or ${t.cargaAlvoG} > 0) and (${t.cargaAlvoPlacas} is null or ${t.cargaAlvoPlacas} > 0)`
    ),
    check('ck_te_series_alvo', sql`${t.seriesAlvo} > 0`),
    check(
      'ck_te_reps_faixa',
      sql`${t.repsAlvoMin} is null or ${t.repsAlvoMax} is null or ${t.repsAlvoMax} >= ${t.repsAlvoMin}`
    ),
    check('ck_te_duracao', sql`${t.duracaoAlvoS} is null or ${t.duracaoAlvoS} > 0`),
  ]
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
  (t) => [
    index('idx_sessoes_iniciada').on(t.iniciadaEm),
    /**
     * Índice único sobre a constante 1, filtrado: no máximo UMA sessão aberta no
     * banco inteiro. Duas sessões abertas hoje passariam despercebidas, porque
     * ler "a sessão em andamento" com `.get()` simplesmente esconde a segunda.
     */
    uniqueIndex('uq_sessao_aberta')
      .on(sql`1`)
      .where(sql`${t.finalizadaEm} is null and ${t.arquivadoEm} is null`),
    check(
      'ck_sessoes_intervalo',
      sql`${t.finalizadaEm} is null or ${t.finalizadaEm} >= ${t.iniciadaEm}`
    ),
  ]
);

/**
 * A série executada — a tabela que mais cresce e a que responde "estou
 * evoluindo?". Exatamente uma das duas cargas é preenchida, ou nenhuma
 * (peso corporal, tempo).
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
    cargaPlacas: integer('carga_placas'),
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
    // Não é parcial de propósito: o índice é a identidade estável do slot, então
    // desfazer uma série não libera o número para uma segunda "3ª série".
    uniqueIndex('uq_series_sessao_exercicio_indice').on(t.sessaoId, t.exercicioId, t.indice),
    // O índice do histórico de evolução: "todas as séries deste exercício no tempo".
    index('idx_series_exercicio').on(t.exercicioId, t.concluidaEm),
    check('ck_series_uma_unidade', sql`${t.cargaG} is null or ${t.cargaPlacas} is null`),
    check(
      'ck_series_carga_positiva',
      sql`(${t.cargaG} is null or ${t.cargaG} > 0) and (${t.cargaPlacas} is null or ${t.cargaPlacas} > 0)`
    ),
    check('ck_series_tipo', sql`${t.tipo} in ('aquecimento', 'valida', 'falha')`),
    check('ck_series_rir', sql`${t.rir} is null or (${t.rir} between 0 and 5)`),
    check('ck_series_reps', sql`${t.repeticoes} is null or ${t.repeticoes} > 0`),
    check('ck_series_duracao', sql`${t.duracaoS} is null or ${t.duracaoS} > 0`),
    check('ck_series_indice', sql`${t.indice} >= 0`),
  ]
);

/**
 * Configuração de linha única. Altura e objetivo entram em divisão e
 * multiplicação — guardá-los como texto em `preferencias` permitiria gravar
 * "1,78" onde se espera 1780, erro que não aparece na escrita e sim como
 * IMC 561 na tela.
 */
export const perfil = sqliteTable(
  'perfil',
  {
    id: text('id').primaryKey().default('unico'),
    alturaMm: integer('altura_mm'),
    pesoObjetivoG: integer('peso_objetivo_g'),
    /** Copiado quando o objetivo é definido: progresso sem ponto de partida é chute. */
    pesoInicialG: integer('peso_inicial_g'),
    objetivoDefinidoEm: integer('objetivo_definido_em'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    check('ck_perfil_linha_unica', sql`${t.id} = 'unico'`),
    check(
      'ck_perfil_valores',
      sql`(${t.alturaMm} is null or ${t.alturaMm} between 1000 and 2500)
      and (${t.pesoObjetivoG} is null or ${t.pesoObjetivoG} > 0)
      and (${t.pesoInicialG} is null or ${t.pesoInicialG} > 0)`
    ),
  ]
);

/**
 * Peso corporal, em gramas. Sem coluna de IMC: IMC é derivado de peso × altura,
 * e congelá-lo aqui deixaria todo o histórico errado no dia em que a altura for
 * corrigida.
 */
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
  (t) => [index('idx_pesagens_medido').on(t.medidoEm), check('ck_pesagens_peso', sql`${t.pesoG} > 0`)]
);

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
  (t) => [
    index('idx_medidas_parte').on(t.parte, t.medidoEm),
    check('ck_medidas_valor', sql`${t.valorMm} > 0`),
  ]
);

/** Estado do app, sem semântica de negócio: chaves nascem e morrem sem migration. */
export const preferencias = sqliteTable('preferencias', {
  chave: text('chave').primaryKey(),
  valor: text('valor').notNull(),
  atualizadoEm: atualizadoEm(),
});

export type Exercicio = typeof exercicios.$inferSelect;
export type Treino = typeof treinos.$inferSelect;
export type TreinoExercicio = typeof treinoExercicios.$inferSelect;
export type Sessao = typeof sessoes.$inferSelect;
export type Serie = typeof series.$inferSelect;
export type Perfil = typeof perfil.$inferSelect;
export type Pesagem = typeof pesagens.$inferSelect;
export type Medida = typeof medidas.$inferSelect;
