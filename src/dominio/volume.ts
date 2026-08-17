/**
 * Volume: quanto esforço houve numa sessão e — igualmente importante — quanto
 * NÃO entrou na conta.
 *
 * A regra que organiza o arquivo inteiro: **volume nunca mistura placa com
 * quilo**. Placa é posição de pino, não peso; somar `5` com `42500` produz um
 * número que parece certo e não significa nada. Por isso nenhuma função daqui
 * devolve um `number` solto de volume de sessão — `VolumeDaSessao` carrega o
 * total em grama·rep MAIS a contagem nomeada do que ficou de fora, de modo que a
 * tela seja obrigada a dizer "e mais 3 exercícios em placa" em vez de imprimir um
 * total mentiroso.
 *
 * Puro: recebe dado, devolve dado. Sem React, sem SQLite.
 */

import type { TipoMedicao, TipoSerie } from '../db/schema.ts';
import {
  cargaEmGramas,
  formatarVolume,
  proximaCarga,
  valorDaCarga,
  type Carga,
  type Unidade,
} from './carga.ts';
import {
  cargaCompativel,
  incrementoPadrao,
  temCarga,
  unidadeDoTipo,
  type Exercicio,
} from './exercicio.ts';

export type SerieExecutada = {
  readonly id: string;
  readonly sessaoId: string;
  readonly exercicioId: string;
  readonly indice: number;
  readonly tipo: TipoSerie;
  readonly carga: Carga | null;
  readonly repeticoes: number | null;
  readonly duracaoS: number | null;
  readonly rir: number | null;
  readonly concluidaEm: number;
};

/**
 * O contêiner que impede array misto: um exercício ⇒ uma unidade. Mora aqui, e
 * não em `recordes.ts` como o spec escreveu, porque `volumeDoExercicio` e
 * `sugerirCarga` já o recebem — declará-lo lá criaria o ciclo
 * volume↔recordes que o desenho existe para eliminar. `recordes.ts` reexporta.
 */
export type HistoricoDoExercicio = {
  readonly exercicio: Exercicio;
  /** Ordenadas por `concluidaEm` asc. As funções daqui não confiam nisso. */
  readonly series: readonly SerieExecutada[];
};

/** Aquecimento não é esforço a contabilizar — só infla o gráfico. */
export const contaNoVolume = (s: SerieExecutada): boolean => s.tipo !== 'aquecimento';

export type MotivoForaDoVolume =
  | 'aquecimento'
  | 'sem_carga'
  | 'sem_repeticoes'
  | 'placa_sem_calibracao';

export type ResultadoVolume =
  | {
      readonly conta: true;
      readonly gramasReps: number;
      /**
       * `true` quando o número veio de `gramasPorPlaca`. A conversão assume que a
       * resistência é proporcional ao número de placas, o que alavanca e roldana
       * não garantem — a tela escreve "~" e não um número seco.
       */
      readonly aproximado: boolean;
    }
  | { readonly conta: false; readonly motivo: MotivoForaDoVolume };

/**
 * `gramasPorPlaca` null ⇒ a placa fica de fora, com motivo próprio. É a decisão
 * do dia 1: nada de converter placa em quilo por chute.
 *
 * A ORDEM dos testes é o que separa abdominal de esteira: peso corporal tem
 * repetição e não tem carga (`sem_carga`); esteira não tem nem uma nem outra, e
 * precisa cair em `sem_repeticoes`, senão a frase do resumo chamaria a corrida de
 * "série sem carga".
 */
export function volumeDaSerie(s: SerieExecutada, gramasPorPlaca: number | null): ResultadoVolume {
  if (!contaNoVolume(s)) return { conta: false, motivo: 'aquecimento' };
  if (s.repeticoes === null || s.repeticoes <= 0) return { conta: false, motivo: 'sem_repeticoes' };
  if (s.carga === null) return { conta: false, motivo: 'sem_carga' };

  const gramas = cargaEmGramas(s.carga, gramasPorPlaca);
  if (gramas === null) return { conta: false, motivo: 'placa_sem_calibracao' };

  return { conta: true, gramasReps: gramas * s.repeticoes, aproximado: s.carga.unidade === 'placa' };
}

export type SerieComExercicio = SerieExecutada & {
  readonly exercicioNome: string;
  readonly tipoMedicao: TipoMedicao;
  readonly gramasPorPlaca: number | null;
};

export type ExercicioForaDaSoma = {
  readonly id: string;
  readonly nome: string;
  readonly motivo: MotivoForaDoVolume;
  readonly series: number;
};

export type VolumeDaSessao = {
  readonly gramasReps: number;
  readonly seriesSomadas: number;
  readonly seriesAquecimento: number;
  readonly seriesEmPlacaSemCalibracao: number;
  /** Peso corporal: tem repetição, não tem carga. */
  readonly seriesSemCarga: number;
  /** Tempo e distância: esteira, prancha. */
  readonly seriesSemRepeticoes: number;
  /**
   * Quantas das somadas vieram de placa convertida, e quanto do total elas
   * representam. Sem estes dois a tela imprimiria "1550 kg·rep" com a mesma cara
   * de exatidão de um total só de anilha. Ver `ResultadoVolume.aproximado`.
   */
  readonly seriesAproximadas: number;
  readonly gramasRepsAproximados: number;
  /** Nomeado, para a UI não inventar texto nem contar abdominal como placa. */
  readonly foraDaSoma: readonly ExercicioForaDaSoma[];
};

export function volumeDaSessao(series: readonly SerieComExercicio[]): VolumeDaSessao {
  let gramasReps = 0;
  let seriesSomadas = 0;
  let seriesAquecimento = 0;
  let seriesEmPlacaSemCalibracao = 0;
  let seriesSemCarga = 0;
  let seriesSemRepeticoes = 0;
  let seriesAproximadas = 0;
  let gramasRepsAproximados = 0;

  // Chave por exercício E motivo: o mesmo exercício pode ter 1 aquecimento e 4
  // séries em placa sem calibração, e fundir os dois num item só apagaria a
  // distinção que estes contadores existem para preservar.
  const fora = new Map<string, { id: string; nome: string; motivo: MotivoForaDoVolume; series: number }>();

  for (const s of series) {
    const r = volumeDaSerie(s, s.gramasPorPlaca);

    if (r.conta) {
      gramasReps += r.gramasReps;
      seriesSomadas += 1;
      if (r.aproximado) {
        seriesAproximadas += 1;
        gramasRepsAproximados += r.gramasReps;
      }
      continue;
    }

    if (r.motivo === 'aquecimento') seriesAquecimento += 1;
    else if (r.motivo === 'placa_sem_calibracao') seriesEmPlacaSemCalibracao += 1;
    else if (r.motivo === 'sem_carga') seriesSemCarga += 1;
    else seriesSemRepeticoes += 1;

    const chave = `${s.exercicioId}|${r.motivo}`;
    const item = fora.get(chave);
    if (item) item.series += 1;
    else fora.set(chave, { id: s.exercicioId, nome: s.exercicioNome, motivo: r.motivo, series: 1 });
  }

  return {
    gramasReps,
    seriesSomadas,
    seriesAquecimento,
    seriesEmPlacaSemCalibracao,
    seriesSemCarga,
    seriesSemRepeticoes,
    seriesAproximadas,
    gramasRepsAproximados,
    foraDaSoma: [...fora.values()],
  };
}

/**
 * Volume DENTRO de um exercício, na escala dele: grama·rep em kg, placa·rep em
 * placa. Nunca somável entre exercícios — daí a unidade viajar junto do número,
 * em vez de um `number` que a próxima função somaria sem perguntar.
 */
export type VolumeNaUnidade = { readonly valor: number; readonly unidade: Unidade };

export function volumeDoExercicio(h: HistoricoDoExercicio): VolumeNaUnidade | null {
  const unidade = unidadeDoTipo(h.exercicio.tipoMedicao);
  if (unidade === null) return null;

  let valor = 0;
  let contou = false;
  for (const s of h.series) {
    if (!contaNoVolume(s)) continue;
    if (s.repeticoes === null || s.repeticoes <= 0) continue;
    // Guarda de runtime: o contêiner promete uma unidade só, mas quem o monta lê
    // do banco, e `exercicioId` é uma string que nenhum tipo consegue amarrar.
    if (s.carga === null || !cargaCompativel(h.exercicio, s.carga)) continue;
    valor += valorDaCarga(s.carga) * s.repeticoes;
    contou = true;
  }
  return contou ? { valor, unidade } : null;
}

/**
 * "108 placa·rep" — o par de `formatarVolume`, que só sabe escrever o ramo kg.
 *
 * Volume em placa NÃO leva "~": o número é exato NA ESCALA do exercício. O que
 * ele não é, é somável com o de outro exercício — e é justamente por isso que
 * `VolumeNaUnidade` carrega a unidade em vez de devolver um `number`.
 */
export function formatarVolumeNaUnidade(v: VolumeNaUnidade): string {
  return v.unidade === 'kg' ? formatarVolume(v.valor) : `${v.valor} placa·rep`;
}

// ── Progressão ─────────────────────────────────────────────────────────────

/**
 * Um ponto do gráfico "estou evoluindo?": UMA SESSÃO, não uma série. 4×10 num
 * dia são quatro linhas no banco e um ponto na curva.
 */
export type PontoDeProgressao = {
  readonly sessaoId: string;
  /** O início da sessão dentro deste exercício — o menor `concluidaEm` do grupo. */
  readonly instante: number;
  readonly melhorCarga: Carga | null;
  readonly repeticoes: number;
  readonly duracaoS: number;
  readonly series: number;
};

/**
 * A série temporal do exercício, em ordem cronológica.
 *
 * Aquecimento fica de fora pelo mesmo motivo que fica fora do volume: senão a
 * curva SOBE no dia em que ele só aqueceu mais. `cargaCompativel` é a guarda de
 * runtime da linha que o banco não amarra — série de outra unidade não entra na
 * comparação, porque `valorDaCarga` compararia 5 com 42500.
 */
export function progressaoDoExercicio(h: HistoricoDoExercicio): PontoDeProgressao[] {
  const porSessao = new Map<string, { -readonly [K in keyof PontoDeProgressao]: PontoDeProgressao[K] }>();

  for (const s of h.series) {
    if (!contaNoVolume(s)) continue;

    const ponto = porSessao.get(s.sessaoId) ?? {
      sessaoId: s.sessaoId,
      instante: s.concluidaEm,
      melhorCarga: null,
      repeticoes: 0,
      duracaoS: 0,
      series: 0,
    };

    ponto.series += 1;
    ponto.repeticoes += s.repeticoes ?? 0;
    ponto.duracaoS += s.duracaoS ?? 0;
    ponto.instante = Math.min(ponto.instante, s.concluidaEm);
    if (
      s.carga !== null &&
      cargaCompativel(h.exercicio, s.carga) &&
      (ponto.melhorCarga === null || valorDaCarga(s.carga) > valorDaCarga(ponto.melhorCarga))
    ) {
      ponto.melhorCarga = s.carga;
    }

    porSessao.set(s.sessaoId, ponto);
  }

  return [...porSessao.values()].sort((a, b) => a.instante - b.instante);
}

/**
 * A grandeza que PROGRIDE em cada tipo de exercício — a decisão que o gráfico
 * desenha. Em exercício com carga é a carga (no valor cru da unidade dele, nunca
 * convertida); em peso corporal é a repetição; em tempo e distância, o segundo.
 *
 * Zero quando não há carga na sessão: o ponto existe (houve série) e omiti-lo
 * abriria um buraco na curva sem dizer por quê.
 */
export function valorDaProgressao(p: PontoDeProgressao, ex: Exercicio): number {
  if (temCarga(ex.tipoMedicao)) return p.melhorCarga === null ? 0 : valorDaCarga(p.melhorCarga);
  if (ex.tipoMedicao === 'peso_corporal') return p.repeticoes;
  return p.duracaoS;
}

export type Alvo = { readonly seriesAlvo: number; readonly repsAlvoMin: number | null };

/** `concluidaEm` empata sob o relógio congelado dos testes; `indice` desempata. */
function ordemDaSerie(a: SerieExecutada, b: SerieExecutada): number {
  return a.concluidaEm - b.concluidaEm || a.indice - b.indice;
}

/**
 * A sugestão olha a ÚLTIMA sessão, não o histórico inteiro: "bateu todas as
 * séries no alvo" só significa alguma coisa dentro de um dia. Com o histórico
 * todo, `validas.length >= seriesAlvo` seria verdade desde a segunda semana e
 * `every(reps >= min)` seria falso para sempre.
 */
function seriesDaUltimaSessao(h: HistoricoDoExercicio): readonly SerieExecutada[] {
  if (h.series.length === 0) return [];
  const ultima = h.series.reduce((mais, s) => (ordemDaSerie(s, mais) > 0 ? s : mais));
  return h.series.filter((s) => s.sessaoId === ultima.sessaoId);
}

/**
 * Os dois ramos escritos à mão porque `proximaCarga` é genérica com `NoInfer`:
 * é o narrow explícito que prova ao compilador — e a quem ler — que ninguém
 * somou 2500 gramas a cinco placas.
 */
function subirUmDegrau(atual: Carga, incremento: Carga): Carga {
  if (atual.unidade === 'kg' && incremento.unidade === 'kg') return proximaCarga(atual, incremento);
  if (atual.unidade === 'placa' && incremento.unidade === 'placa') {
    return proximaCarga(atual, incremento);
  }
  return atual;
}

/**
 * Sugestão de carga, deliberadamente burra e conservadora: bateu **todas** as
 * séries no mínimo de repetições, sobe um incremento; não bateu, mantém; **nunca
 * reduz** — reduzir é decisão do Henrique, não do app (`treino-domain`).
 *
 * Recebe o contêiner e não um array com incremento ao lado: o incremento vem do
 * MESMO exercício das séries, então "incremento na unidade errada" deixa de ser
 * um argumento que se possa passar e vira um estado que não existe.
 */
export function sugerirCarga(h: HistoricoDoExercicio, alvo: Alvo): Carga | null {
  const unidade = unidadeDoTipo(h.exercicio.tipoMedicao);
  if (unidade === null) return null;

  const validas = seriesDaUltimaSessao(h).filter(contaNoVolume);
  const comCarga = validas
    .filter((s) => s.carga !== null && cargaCompativel(h.exercicio, s.carga))
    .sort(ordemDaSerie);
  const ultima = comCarga[comCarga.length - 1];
  if (ultima === undefined || ultima.carga === null) return null;

  const repsAlvoMin = alvo.repsAlvoMin;
  if (repsAlvoMin === null) return ultima.carga;

  const bateuTudo =
    validas.length >= alvo.seriesAlvo &&
    validas.every((s) => (s.repeticoes ?? 0) >= repsAlvoMin);
  if (!bateuTudo) return ultima.carga;

  // O incremento é NOT NULL no banco para os dois tipos com carga (CHECK
  // `ck_exercicios_incremento`); o fallback existe para o contêiner montado à mão.
  const incremento = h.exercicio.incremento ?? incrementoPadrao(h.exercicio.tipoMedicao);
  if (incremento === null) return ultima.carga;
  return subirUmDegrau(ultima.carga, incremento);
}
