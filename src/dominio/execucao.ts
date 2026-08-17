/**
 * O "um toque": decidir, ANTES de o dedo encostar na tela, qual carga, quantas
 * repetições e qual índice a próxima série vem preenchida — e quando o exercício
 * e a sessão acabaram.
 *
 * É decisão de DADOS, não de UI. No componente viraria `if` sobre carga dentro
 * de `src/app/`, que `projeto-academia` proíbe, e ficaria sem teste. Aqui é puro:
 * recebe o que o banco leu, devolve o que a tela desenha e o que `confirmarSerie`
 * grava, sem saber que SQLite existe.
 *
 * As duas cadeias de prefill são SEPARADAS de propósito e apontam para lados
 * opostos: **carga** sobe pelo que ele fez (histórico primeiro), **repetição** é o
 * alvo a bater (plano primeiro). Herdar repetição do histórico faria o app abaixar
 * a régua sozinho — `treino-domain`:85.
 */

import type { TipoSerie } from '../db/schema.ts';
import { valorDaCarga, type Carga } from './carga.ts';
import { cargaCompativel, medidoPorTempo, temCarga, type Exercicio } from './exercicio.ts';
import type { HistoricoDoExercicio } from './recordes.ts';
import { contaNoVolume, sugerirCarga, type Alvo, type SerieExecutada } from './volume.ts';

/**
 * De onde veio o número grande da tela. Não é enfeite: é o que permite o teste
 * afirmar QUAL regra disparou e a UI escrever "igual à semana passada" em vez de
 * "da ficha".
 */
export type OrigemCarga =
  /** 1: última série com carga deste exercício NESTA sessão. */
  | 'ajuste_de_hoje'
  /** 2: a série de MESMO ÍNDICE na última sessão em que o exercício apareceu. */
  | 'mesmo_indice_sessao_anterior'
  /** 3: `carga_alvo` da ficha — a semente do seed, que vale na estreia. */
  | 'plano'
  /** 4: não há de onde tirar. O botão vira "Informar carga". */
  | 'sem_referencia';

export type OrigemReps = 'plano' | 'mesmo_indice_sessao_anterior' | 'sem_referencia';

/** Um item da ficha, já com o exercício resolvido. É o PLANO, nunca o realizado. */
export type ItemDoPlano = {
  readonly itemId: string;
  readonly exercicio: Exercicio;
  readonly ordem: number;
  readonly seriesAlvo: number;
  readonly repsAlvoMin: number | null;
  readonly repsAlvoMax: number | null;
  readonly cargaAlvo: Carga | null;
  readonly duracaoAlvoS: number | null;
  readonly descansoS: number;
};

/**
 * O payload pronto do um-toque: `confirmarSerie(sessaoId, s)` grava isto sem a
 * tela montar nada. `rir` não existe aqui de propósito — perguntar RIR entre
 * séries é o campo que faz o app perder para o bloco de notas.
 */
export type SerieSugerida = {
  readonly exercicioId: string;
  readonly indice: number;
  readonly tipo: TipoSerie;
  readonly carga: Carga | null;
  readonly repeticoes: number | null;
  readonly duracaoS: number | null;
  readonly origemCarga: OrigemCarga;
  readonly origemReps: OrigemReps;
};

/**
 * Conta sobre TODAS as séries, inclusive as arquivadas: `uq_series_sessao_exercicio_indice`
 * não filtra `arquivado_em`, então `indice = feitas.length` estoura o UNIQUE
 * assim que ele desfizer uma série e registrar de novo — bug que só aparece na
 * academia, com 40 segundos correndo.
 *
 * Por isso é `maior + 1` e não `quantidade`: o índice é a identidade estável do
 * slot, e buraco no meio (ele apagou a série 1) continua sendo buraco.
 */
export function proximoIndice(indicesOcupados: readonly number[]): number {
  let maior = -1;
  for (const indice of indicesOcupados) {
    if (indice > maior) maior = indice;
  }
  return maior + 1;
}

export function sugerirProximaSerie(entrada: {
  readonly item: ItemDoPlano;
  readonly feitasHoje: readonly SerieExecutada[];
  readonly sessaoAnterior: readonly SerieExecutada[] | null;
  readonly indicesOcupados: readonly number[];
}): SerieSugerida | null {
  const { item } = entrada;
  const exercicioId = item.exercicio.id;

  // Filtra por exercício nas duas listas: quem chama pode passar a sessão
  // inteira, e uma carga do exercício vizinho é justamente o erro que a
  // separação de unidades existe para impedir.
  const feitasHoje = doExercicio(entrada.feitasHoje, exercicioId);
  const anteriores = doExercicio(entrada.sessaoAnterior ?? [], exercicioId);

  const indice = proximoIndice(entrada.indicesOcupados);
  // A série de MESMO ÍNDICE, e não a última: é o que reproduz a queda por fadiga
  // na posição certa (6,6,5,5 volta como 6,6,5,5) em vez de espalhar a última
  // pela primeira, que é catraca para baixo.
  const naMesmaPosicao = anteriores.find((s) => s.indice === indice) ?? null;

  return {
    exercicioId,
    indice,
    // Sempre 'valida'. Aquecimento é toque longo na tela: é decisão do dedo, não
    // do histórico.
    tipo: 'valida',
    ...resolverCarga(item, feitasHoje, naMesmaPosicao),
    ...resolverEsforco(item, naMesmaPosicao),
  };
}

type CargaResolvida = { readonly carga: Carga | null; readonly origemCarga: OrigemCarga };

function resolverCarga(
  item: ItemDoPlano,
  feitasHoje: readonly SerieExecutada[],
  naMesmaPosicao: SerieExecutada | null
): CargaResolvida {
  const ex = item.exercicio;
  // Abdominal e esteira não têm carga nenhuma: a ausência é o valor certo, e a
  // tela sabe disso por `temCarga`, não pela origem.
  if (!temCarga(ex.tipoMedicao)) return { carga: null, origemCarga: 'sem_referencia' };

  // Degrau 1 — o que faz "um toque" significar "repita o que eu acabei de fazer".
  // Aquecimento fica de fora: é mais leve por definição, e herdá-lo baixaria a
  // carga de trabalho sozinho. Mesmo critério de `contaNoVolume`.
  const ajusteDeHoje = ultimaComCarga(feitasHoje.filter(contaNoVolume), ex);
  if (ajusteDeHoje !== null) return { carga: ajusteDeHoje, origemCarga: 'ajuste_de_hoje' };

  // Degrau 2 — mesma posição na sessão anterior. A carga em `const` para o
  // predicado de `aceita` narrar a variável, e não uma expressão descartada.
  const naPosicao = naMesmaPosicao?.carga ?? null;
  if (aceita(ex, naPosicao)) {
    return { carga: naPosicao, origemCarga: 'mesmo_indice_sessao_anterior' };
  }

  // Degrau 3 — a ficha. É a estreia do exercício, e é o que o seed semeia.
  if (aceita(ex, item.cargaAlvo)) return { carga: item.cargaAlvo, origemCarga: 'plano' };

  // Degrau 4 — o teclado.
  return { carga: null, origemCarga: 'sem_referencia' };
}

type EsforcoResolvido = {
  readonly repeticoes: number | null;
  readonly duracaoS: number | null;
  readonly origemReps: OrigemReps;
};

/**
 * Repetição OU duração — nunca as duas. Esteira mede tempo; todo o resto mede
 * repetição, inclusive peso corporal (o abdominal do Treino A é 4×12).
 *
 * A cadeia é invertida em relação à carga: PLANO primeiro. A linha da ficha diz
 * 10 e ele fez 8 na semana passada; sugerir 8 seria o app aceitando a queda como
 * novo normal.
 */
function resolverEsforco(item: ItemDoPlano, naMesmaPosicao: SerieExecutada | null): EsforcoResolvido {
  if (medidoPorTempo(item.exercicio.tipoMedicao)) {
    if (item.duracaoAlvoS !== null) {
      return { repeticoes: null, duracaoS: item.duracaoAlvoS, origemReps: 'plano' };
    }
    if (naMesmaPosicao?.duracaoS != null) {
      return {
        repeticoes: null,
        duracaoS: naMesmaPosicao.duracaoS,
        origemReps: 'mesmo_indice_sessao_anterior',
      };
    }
    return { repeticoes: null, duracaoS: null, origemReps: 'sem_referencia' };
  }

  // `repsAlvoMax ?? repsAlvoMin`: numa faixa "8–12", o alvo a bater é o topo.
  const doPlano = item.repsAlvoMax ?? item.repsAlvoMin;
  if (doPlano !== null) return { repeticoes: doPlano, duracaoS: null, origemReps: 'plano' };

  if (naMesmaPosicao?.repeticoes != null) {
    return {
      repeticoes: naMesmaPosicao.repeticoes,
      duracaoS: null,
      origemReps: 'mesmo_indice_sessao_anterior',
    };
  }
  return { repeticoes: null, duracaoS: null, origemReps: 'sem_referencia' };
}

export type ItemDaSessao = ItemDoPlano & {
  readonly feitas: readonly SerieExecutada[];
  /** Só 'valida' e 'falha': aquecer duas vezes não completa o exercício. */
  readonly contamParaAlvo: number;
  readonly faltam: number;
  readonly completo: boolean;
  /** Na prática nunca null: série extra além do alvo continua sendo 1 toque. */
  readonly proxima: SerieSugerida | null;
};

export type PlanoDaSessao = {
  readonly sessao: { id: string; nome: string; iniciadaEm: number; treinoId: string | null };
  readonly itens: readonly ItemDaSessao[];
  readonly seriesFeitas: number;
  readonly seriesAlvo: number;
  readonly seriesFaltando: number;
  /** O cartão aberto: o primeiro item com `faltam > 0`. */
  readonly itemAtual: ItemDaSessao | null;
};

/**
 * Tudo derivado do banco por função pura — fechar e reabrir o app não zera nem
 * duplica nada, porque não existe estado de sessão em memória para se perder.
 */
export function montarPlanoDaSessao(entrada: {
  sessao: PlanoDaSessao['sessao'];
  itens: readonly ItemDoPlano[];
  feitas: readonly SerieExecutada[];
  anteriores: ReadonlyMap<string, readonly SerieExecutada[]>;
  indicesOcupados: ReadonlyMap<string, readonly number[]>;
}): PlanoDaSessao {
  const porExercicio = agruparPorExercicio(entrada.feitas);

  const itens: ItemDaSessao[] = [...entrada.itens]
    .sort((a, b) => a.ordem - b.ordem)
    .map((item) => {
      const feitas = porExercicio.get(item.exercicio.id) ?? [];
      const contamParaAlvo = feitas.filter(contaNoVolume).length;
      const faltam = Math.max(0, item.seriesAlvo - contamParaAlvo);
      return {
        ...item,
        feitas,
        contamParaAlvo,
        faltam,
        completo: faltam === 0,
        proxima: sugerirProximaSerie({
          item,
          feitasHoje: feitas,
          sessaoAnterior: entrada.anteriores.get(item.exercicio.id) ?? null,
          // Sem o mapa, cair nos índices das séries VIVAS reabriria o bug do
          // UNIQUE com soft delete; é o menor erro possível, mas quem chama
          // deve passar `indicesOcupados`, que inclui as arquivadas.
          indicesOcupados:
            entrada.indicesOcupados.get(item.exercicio.id) ?? feitas.map((s) => s.indice),
        }),
      };
    });

  return {
    sessao: entrada.sessao,
    itens,
    seriesFeitas: somar(itens, (i) => i.contamParaAlvo),
    seriesAlvo: somar(itens, (i) => i.seriesAlvo),
    // Soma dos `faltam` de cada item, e não `alvo - feitas`: série extra num
    // exercício não paga a série que falta em outro.
    seriesFaltando: somar(itens, (i) => i.faltam),
    itemAtual: itens.find((i) => i.faltam > 0) ?? null,
  };
}

/**
 * INSTANTE de término, nunca soma de ticks: o JS é suspenso em background e um
 * contador que soma ticks atrasa exatamente o tempo em que a tela ficou apagada
 * (`projeto-academia` § Cronômetro). Voltar 3 minutos depois mostra "descanso
 * terminado", não um contador atrasado.
 */
export function fimDoDescanso(ultima: SerieExecutada | null, descansoS: number): number | null {
  if (ultima === null) return null;
  return ultima.concluidaEm + descansoS * 1000;
}

/**
 * Alimenta os botões "Atualizar ficha" do resumo. NUNCA aplicado sozinho: a
 * ficha só muda por toque explícito, com os dois números visíveis — plano ≠
 * realizado, e progressão automática vira loop que não converge.
 */
export type Divergencia = {
  readonly itemId: string;
  readonly nome: string;
  readonly noPlano: Carga | null;
  readonly sugerida: Carga;
};

export function divergenciasDoPlano(p: PlanoDaSessao): readonly Divergencia[] {
  const divergencias: Divergencia[] = [];
  for (const item of p.itens) {
    // Sem alvo não há plano do qual divergir. `ck_te_series_alvo` garante que
    // todo item de ficha tem `series_alvo > 0`, então zero identifica a sessão
    // avulsa — cujo item não tem linha em `treino_exercicios` para atualizar.
    if (item.seriesAlvo <= 0) continue;
    const historico: HistoricoDoExercicio = { exercicio: item.exercicio, series: item.feitas };
    const alvo: Alvo = { seriesAlvo: item.seriesAlvo, repsAlvoMin: item.repsAlvoMin };
    const sugerida = sugerirCarga(historico, alvo);
    if (sugerida === null || igual(sugerida, item.cargaAlvo)) continue;
    divergencias.push({
      itemId: item.itemId,
      nome: item.exercicio.nome,
      noPlano: item.cargaAlvo,
      sugerida,
    });
  }
  return divergencias;
}

// ── Apoio ──────────────────────────────────────────────────────────────────

function doExercicio(
  series: readonly SerieExecutada[],
  exercicioId: string
): readonly SerieExecutada[] {
  return series.filter((s) => s.exercicioId === exercicioId);
}

/**
 * A carga do banco pode ter ficado incompatível com o exercício — ele cadastrou
 * em kg, treinou, e depois converteu a máquina para placa. Descer um degrau na
 * cadeia é melhor do que oferecer um toque que `registrarSerie` vai recusar.
 */
function aceita(ex: Exercicio, c: Carga | null): c is Carga {
  return c !== null && cargaCompativel(ex, c);
}

function ultimaComCarga(series: readonly SerieExecutada[], ex: Exercicio): Carga | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const c = series[i].carga;
    if (aceita(ex, c)) return c;
  }
  return null;
}

/** Ordenadas por conclusão: "a última que eu fiz" precisa ser mesmo a última. */
function agruparPorExercicio(
  series: readonly SerieExecutada[]
): Map<string, readonly SerieExecutada[]> {
  const grupos = new Map<string, SerieExecutada[]>();
  for (const s of series) {
    const atual = grupos.get(s.exercicioId);
    if (atual) atual.push(s);
    else grupos.set(s.exercicioId, [s]);
  }
  for (const lista of grupos.values()) {
    lista.sort((a, b) => a.concluidaEm - b.concluidaEm || a.indice - b.indice);
  }
  return grupos;
}

function somar<T>(itens: readonly T[], de: (item: T) => number): number {
  return itens.reduce((total, item) => total + de(item), 0);
}

function igual(a: Carga, b: Carga | null): boolean {
  return b !== null && a.unidade === b.unidade && valorDaCarga(a) === valorDaCarga(b);
}
