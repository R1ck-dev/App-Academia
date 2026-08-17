/**
 * O catálogo e as três fichas do Henrique, transcritos do bloco de notas dele.
 *
 * Arquivo **puro**: nenhum import de `conexao.ts`, nenhuma escrita, nenhum nome
 * de coluna. Só `seed.ts` conhece `carga_alvo_g`/`carga_alvo_placas` — aqui os
 * valores são NEUTROS, na unidade do próprio exercício. Se as colunas mudarem de
 * nome, muda um arquivo, não 24 registros.
 *
 * Os ids são slugs e não `novoId()`. É o que torna o seed idempotente por
 * natureza (o `onConflictDoNothing` tem em que conflitar) e o que permite
 * depurar por adb lendo o SQLite. **Id de seed é para sempre**: mudar
 * `seed-ex-peck-deck` depois de instalado cria um segundo Peck Deck com o
 * histórico dividido, e o snapshot em `seed-dados.test.ts` é a única defesa.
 */

import type { TipoMedicao } from './schema.ts';

/** Sobe de 1 para 2 quando o conteúdo do seed mudar. É o portão. */
export const SEED_VERSAO = 1;

export type ExercicioSeed = {
  /** Estável para sempre: 'seed-ex-remada-alta-barra'. Nunca mude. */
  id: string;
  nome: string;
  grupoMuscular: string;
  equipamento: string;
  tipoMedicao: TipoMedicao;
  /**
   * Na unidade do próprio exercício: gramas em `carga_kg`, placas em
   * `carga_placa`. Null exatamente quando `tipoMedicao` não é `carga_*`.
   */
  incremento: number | null;
};

export type ItemSeed = {
  id: string;
  exercicioId: string;
  ordem: number;
  seriesAlvo: number;
  repsAlvoMin: number | null;
  repsAlvoMax: number | null;
  /** Na unidade do exercício. É o número que o um-toque pré-preenche na estreia. */
  cargaAlvo: number | null;
  /** Esteira: 600. Null no resto. */
  duracaoAlvoS: number | null;
  descansoS: number;
};

export type TreinoSeed = {
  id: string;
  nome: string;
  descricao: string;
  ordem: number;
  itens: ItemSeed[];
};

/**
 * Incremento por tipo de equipamento — o menor degrau EXECUTÁVEL naquele
 * aparelho, não o menor número representável: stack de placas anda de 1 em 1,
 * halter de academia de 1 kg em 1 kg, barra e máquina marcada em kg de 2,5 kg
 * (o par de anilhas de 1,25). É chute informado e ele vai corrigir no primeiro
 * treino de cada exercício.
 */
const INC_PLACA = 1;
const INC_HALTER = 1000;
const INC_BARRA = 2500;

const DESCANSO_PADRAO = 90;

export const EXERCICIOS_INICIAIS: readonly ExercicioSeed[] = [
  // ── Treino A ──────────────────────────────────────────────────────────────
  {
    id: 'seed-ex-remada-alta-barra',
    nome: 'Remada Alta c/ Barra',
    grupoMuscular: 'Costas',
    equipamento: 'Polia',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-remada-baixa-barra',
    nome: 'Remada Baixa c/ Barra',
    grupoMuscular: 'Costas',
    equipamento: 'Polia',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-peck-dorsal',
    nome: 'Peck Dorsal',
    grupoMuscular: 'Costas',
    equipamento: 'Máquina',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-facepull',
    nome: 'Facepull',
    grupoMuscular: 'Ombros',
    equipamento: 'Polia',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-rosca-martelo-polia',
    nome: 'Rosca Martelo Polia',
    grupoMuscular: 'Bíceps',
    equipamento: 'Polia',
    tipoMedicao: 'carga_kg',
    incremento: INC_BARRA,
  },
  {
    id: 'seed-ex-rosca-direta-polia',
    nome: 'Rosca Direta Polia',
    grupoMuscular: 'Bíceps',
    equipamento: 'Polia',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-elevacao-lateral-halter',
    nome: 'Elevação Lateral c/ Halter',
    grupoMuscular: 'Ombros',
    equipamento: 'Halter',
    tipoMedicao: 'carga_kg',
    incremento: INC_HALTER,
  },
  {
    id: 'seed-ex-abdominal-supra-solo',
    nome: 'Abdominal Supra Solo',
    grupoMuscular: 'Abdômen',
    equipamento: 'Solo',
    tipoMedicao: 'peso_corporal',
    incremento: null,
  },

  // ── Treino B ──────────────────────────────────────────────────────────────
  {
    id: 'seed-ex-seated-leg-press',
    nome: 'Seated Leg Press',
    grupoMuscular: 'Pernas',
    equipamento: 'Máquina',
    tipoMedicao: 'carga_kg',
    incremento: INC_BARRA,
  },
  {
    id: 'seed-ex-smith-press',
    nome: 'Smith Press',
    grupoMuscular: 'Pernas',
    equipamento: 'Smith',
    tipoMedicao: 'carga_kg',
    incremento: INC_BARRA,
  },
  {
    id: 'seed-ex-cadeira-extensora',
    nome: 'Cadeira Extensora',
    grupoMuscular: 'Pernas',
    equipamento: 'Máquina',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-cadeira-flexora',
    nome: 'Cadeira Flexora',
    grupoMuscular: 'Pernas',
    equipamento: 'Máquina',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-leg-press',
    nome: 'Leg Press',
    grupoMuscular: 'Pernas',
    equipamento: 'Máquina',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-panturrilha',
    nome: 'Panturrilha',
    grupoMuscular: 'Panturrilha',
    equipamento: 'Máquina',
    tipoMedicao: 'carga_kg',
    incremento: INC_BARRA,
  },
  {
    // O bloco de notas diz "Abdutura"; o nome do aparelho é Cadeira Abdutora, e
    // ele confirmou. O id nasce com o nome certo porque nome se edita depois e id não.
    id: 'seed-ex-cadeira-abdutora',
    nome: 'Cadeira Abdutora',
    grupoMuscular: 'Pernas',
    equipamento: 'Máquina',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-esteira',
    nome: 'Esteira',
    grupoMuscular: 'Cardio',
    equipamento: 'Esteira',
    tipoMedicao: 'tempo',
    incremento: null,
  },

  // ── Treino C ──────────────────────────────────────────────────────────────
  {
    id: 'seed-ex-supino-inclinado-barra',
    nome: 'Supino Inclinado Barra',
    grupoMuscular: 'Peito',
    equipamento: 'Barra',
    tipoMedicao: 'carga_kg',
    incremento: INC_BARRA,
  },
  {
    id: 'seed-ex-supino-maquina',
    nome: 'Supino Máquina',
    grupoMuscular: 'Peito',
    equipamento: 'Máquina',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-peck-deck',
    nome: 'Peck Deck',
    grupoMuscular: 'Peito',
    equipamento: 'Máquina',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-paralela-articulada',
    nome: 'Paralela Articulada',
    grupoMuscular: 'Tríceps',
    equipamento: 'Máquina',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-desenvolvimento-articulado',
    nome: 'Desenvolvimento Articulado',
    grupoMuscular: 'Ombros',
    equipamento: 'Máquina',
    tipoMedicao: 'carga_placa',
    incremento: INC_PLACA,
  },
  {
    id: 'seed-ex-elevacao-frontal-halteres',
    nome: 'Elevação Frontal c/ Halteres',
    grupoMuscular: 'Ombros',
    equipamento: 'Halter',
    tipoMedicao: 'carga_kg',
    incremento: INC_HALTER,
  },
  {
    id: 'seed-ex-triceps-frances-halter',
    nome: 'Tríceps Francês Halter',
    grupoMuscular: 'Tríceps',
    equipamento: 'Halter',
    tipoMedicao: 'carga_kg',
    incremento: INC_HALTER,
  },
  {
    id: 'seed-ex-abdominal-infra-solo',
    nome: 'Abdominal Infra Solo',
    grupoMuscular: 'Abdômen',
    equipamento: 'Solo',
    tipoMedicao: 'peso_corporal',
    incremento: null,
  },
];

/**
 * Atalho para o caso comum da ficha dele: "4×10, alvo X". `repsAlvoMin` e
 * `repsAlvoMax` recebem o MESMO número de propósito — a ficha diz um alvo exato,
 * não uma faixa; a faixa existe na coluna para o dia em que ele escrever "8–12".
 */
function item(
  id: string,
  exercicioId: string,
  ordem: number,
  d: { seriesAlvo: number; reps: number | null; cargaAlvo: number | null; duracaoAlvoS?: number }
): ItemSeed {
  return {
    id,
    exercicioId,
    ordem,
    seriesAlvo: d.seriesAlvo,
    repsAlvoMin: d.reps,
    repsAlvoMax: d.reps,
    cargaAlvo: d.cargaAlvo,
    duracaoAlvoS: d.duracaoAlvoS ?? null,
    descansoS: DESCANSO_PADRAO,
  };
}

export const TREINOS_INICIAIS: readonly TreinoSeed[] = [
  {
    id: 'seed-tr-a',
    nome: 'Treino A',
    descricao: 'Costas, bíceps e ombros',
    ordem: 0,
    itens: [
      item('seed-te-a-01', 'seed-ex-remada-alta-barra', 0, { seriesAlvo: 4, reps: 10, cargaAlvo: 5 }),
      item('seed-te-a-02', 'seed-ex-remada-baixa-barra', 1, { seriesAlvo: 4, reps: 10, cargaAlvo: 5 }),
      item('seed-te-a-03', 'seed-ex-peck-dorsal', 2, { seriesAlvo: 4, reps: 10, cargaAlvo: 4 }),
      // O único 3×10 da ficha inteira.
      item('seed-te-a-04', 'seed-ex-facepull', 3, { seriesAlvo: 3, reps: 10, cargaAlvo: 2 }),
      item('seed-te-a-05', 'seed-ex-rosca-martelo-polia', 4, { seriesAlvo: 4, reps: 10, cargaAlvo: 5000 }),
      item('seed-te-a-06', 'seed-ex-rosca-direta-polia', 5, { seriesAlvo: 4, reps: 10, cargaAlvo: 3 }),
      item('seed-te-a-07', 'seed-ex-elevacao-lateral-halter', 6, { seriesAlvo: 4, reps: 12, cargaAlvo: 5000 }),
      // Peso corporal: carga NULL, nunca 0 — zero significaria "levantou zero".
      item('seed-te-a-08', 'seed-ex-abdominal-supra-solo', 7, { seriesAlvo: 4, reps: 12, cargaAlvo: null }),
    ],
  },
  {
    id: 'seed-tr-b',
    nome: 'Treino B',
    descricao: 'Pernas',
    ordem: 1,
    itens: [
      item('seed-te-b-01', 'seed-ex-seated-leg-press', 0, { seriesAlvo: 4, reps: 10, cargaAlvo: 20000 }),
      item('seed-te-b-02', 'seed-ex-smith-press', 1, { seriesAlvo: 4, reps: 10, cargaAlvo: 14000 }),
      item('seed-te-b-03', 'seed-ex-cadeira-extensora', 2, { seriesAlvo: 4, reps: 10, cargaAlvo: 6 }),
      item('seed-te-b-04', 'seed-ex-cadeira-flexora', 3, { seriesAlvo: 4, reps: 10, cargaAlvo: 6 }),
      item('seed-te-b-05', 'seed-ex-leg-press', 4, { seriesAlvo: 4, reps: 10, cargaAlvo: 4 }),
      item('seed-te-b-06', 'seed-ex-panturrilha', 5, { seriesAlvo: 4, reps: 10, cargaAlvo: 20000 }),
      item('seed-te-b-07', 'seed-ex-cadeira-abdutora', 6, { seriesAlvo: 4, reps: 10, cargaAlvo: 3 }),
      // Tempo: uma "série" de 10 minutos, sem repetição e sem carga. `seriesAlvo`
      // é 1 e não 0 porque o CHECK exige > 0 — e porque ele faz a esteira uma vez.
      item('seed-te-b-08', 'seed-ex-esteira', 7, {
        seriesAlvo: 1,
        reps: null,
        cargaAlvo: null,
        duracaoAlvoS: 600,
      }),
    ],
  },
  {
    id: 'seed-tr-c',
    nome: 'Treino C',
    descricao: 'Peito, ombros e tríceps',
    ordem: 2,
    itens: [
      item('seed-te-c-01', 'seed-ex-supino-inclinado-barra', 0, { seriesAlvo: 4, reps: 10, cargaAlvo: 10000 }),
      item('seed-te-c-02', 'seed-ex-supino-maquina', 1, { seriesAlvo: 4, reps: 10, cargaAlvo: 6 }),
      item('seed-te-c-03', 'seed-ex-peck-deck', 2, { seriesAlvo: 4, reps: 10, cargaAlvo: 5 }),
      item('seed-te-c-04', 'seed-ex-paralela-articulada', 3, { seriesAlvo: 4, reps: 10, cargaAlvo: 4 }),
      item('seed-te-c-05', 'seed-ex-desenvolvimento-articulado', 4, { seriesAlvo: 4, reps: 10, cargaAlvo: 2 }),
      item('seed-te-c-06', 'seed-ex-elevacao-frontal-halteres', 5, { seriesAlvo: 4, reps: 12, cargaAlvo: 4000 }),
      item('seed-te-c-07', 'seed-ex-triceps-frances-halter', 6, { seriesAlvo: 4, reps: 10, cargaAlvo: 6000 }),
      item('seed-te-c-08', 'seed-ex-abdominal-infra-solo', 7, { seriesAlvo: 4, reps: 12, cargaAlvo: null }),
    ],
  },
];
