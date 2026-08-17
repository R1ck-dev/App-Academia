/**
 * Leituras. Toda consulta filtra `arquivado_em IS NULL` — esquecer isso é o jeito
 * mais fácil de fazer um exercício apagado voltar a aparecer no histórico.
 *
 * TRÊS EXCEÇÕES, todas deliberadas e comentadas no lugar: `obterExercicio` e
 * `historicoDoExercicio` (soft delete existe justamente para o histórico do
 * exercício arquivado sobreviver), o join de `seriesDaSessaoComExercicio` (o
 * volume de uma sessão de ontem não pode encolher porque ele arquivou o
 * exercício hoje) e `indicesOcupados` (o UNIQUE do banco também não filtra).
 *
 * É AQUI que `carga_g`/`carga_placas` deixam de existir: `cargaDaLinha` é
 * aplicada uma vez por consulta e o domínio só recebe `Carga`. Nenhuma função
 * daqui para cima sabe em qual coluna o número estava.
 */

import { and, asc, desc, eq, gte, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm';

import { cargaDaLinha } from '../dominio/carga.ts';
import type { Exercicio } from '../dominio/exercicio.ts';
import { montarPlanoDaSessao, type ItemDoPlano, type PlanoDaSessao } from '../dominio/execucao.ts';
import type { HistoricoDoExercicio } from '../dominio/recordes.ts';
import type { SerieComExercicio, SerieExecutada } from '../dominio/volume.ts';
import { db } from './conexao.ts';
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
  type Medida,
  type ParteCorpo,
  type Perfil,
  type Pesagem,
  type Sessao,
  type Treino,
} from './schema.ts';

/** `LIMIT` negativo no SQLite significa "sem teto" — evita duplicar cada consulta. */
const SEM_LIMITE = -1;

/** Mesmo default da coluna `descanso_s`: sessão avulsa não tem ficha de onde herdar. */
const DESCANSO_AVULSO_S = 90;

// ── Mapeamento coluna -> domínio ───────────────────────────────────────────

function paraExercicio(l: typeof exercicios.$inferSelect): Exercicio {
  return {
    id: l.id,
    nome: l.nome,
    grupoMuscular: l.grupoMuscular,
    tipoMedicao: l.tipoMedicao,
    // O par incremento_g/incremento_placas é a MESMA XOR de series.carga_*, e por
    // isso usa o MESMO leitor: um segundo jeito de decidir unidade é um segundo
    // lugar para errar.
    incremento: cargaDaLinha({ cargaG: l.incrementoG, cargaPlacas: l.incrementoPlacas }),
    gramasPorPlaca: l.gramasPorPlaca,
    arquivadoEm: l.arquivadoEm,
  };
}

function paraSerie(l: typeof series.$inferSelect): SerieExecutada {
  return {
    id: l.id,
    sessaoId: l.sessaoId,
    exercicioId: l.exercicioId,
    indice: l.indice,
    tipo: l.tipo,
    carga: cargaDaLinha(l),
    repeticoes: l.repeticoes,
    duracaoS: l.duracaoS,
    rir: l.rir,
    concluidaEm: l.concluidaEm,
  };
}

// ── Catálogo ──────────────────────────────────────────────────────────────

export function listarExercicios(): Exercicio[] {
  return db
    .select()
    .from(exercicios)
    .where(isNull(exercicios.arquivadoEm))
    .orderBy(asc(exercicios.nome))
    .all()
    .map(paraExercicio);
}

/**
 * NÃO filtra `arquivado_em`: quem pergunta por um exercício pelo id já tem o id
 * na mão — veio de uma série gravada. Devolver `undefined` para um exercício
 * arquivado apagaria da tela o histórico que o soft delete existe para preservar.
 */
export function obterExercicio(id: string): Exercicio | undefined {
  const linha = db.select().from(exercicios).where(eq(exercicios.id, id)).get();
  return linha === undefined ? undefined : paraExercicio(linha);
}

export function listarTreinos(): Treino[] {
  return db
    .select()
    .from(treinos)
    .where(isNull(treinos.arquivadoEm))
    .orderBy(asc(treinos.ordem), asc(treinos.nome))
    .all();
}

/**
 * A ficha pronta para executar: item + exercício, na ordem da ficha.
 *
 * Filtra exercício arquivado junto com item arquivado — o item existe para ser
 * executado hoje, e arquivar o exercício é dizer "não faço mais isso". O
 * histórico dele continua inteiro em `historicoDoExercicio`.
 */
export function itensDoTreino(treinoId: string): ItemDoPlano[] {
  return db
    .select({ item: treinoExercicios, exercicio: exercicios })
    .from(treinoExercicios)
    .innerJoin(exercicios, eq(exercicios.id, treinoExercicios.exercicioId))
    .where(
      and(
        eq(treinoExercicios.treinoId, treinoId),
        isNull(treinoExercicios.arquivadoEm),
        isNull(exercicios.arquivadoEm)
      )
    )
    // Sem UNIQUE em (treino_id, ordem): dois itens podem empatar, e o id desempata
    // de forma estável para a lista não trocar de ordem entre dois renders.
    .orderBy(asc(treinoExercicios.ordem), asc(treinoExercicios.id))
    .all()
    .map(({ item, exercicio }) => ({
      itemId: item.id,
      exercicio: paraExercicio(exercicio),
      ordem: item.ordem,
      seriesAlvo: item.seriesAlvo,
      repsAlvoMin: item.repsAlvoMin,
      repsAlvoMax: item.repsAlvoMax,
      cargaAlvo: cargaDaLinha({ cargaG: item.cargaAlvoG, cargaPlacas: item.cargaAlvoPlacas }),
      duracaoAlvoS: item.duracaoAlvoS,
      descansoS: item.descansoS,
    }));
}

// ── Sessão em andamento ───────────────────────────────────────────────────

/** A sessão aberta, se houver. `uq_sessao_aberta` garante que só existe uma. */
export function sessaoEmAndamento(): Sessao | undefined {
  return db
    .select()
    .from(sessoes)
    .where(and(isNull(sessoes.finalizadaEm), isNull(sessoes.arquivadoEm)))
    .orderBy(desc(sessoes.iniciadaEm))
    .get();
}

/**
 * Ordem cronológica, não por índice: numa sessão os índices reiniciam a cada
 * exercício, então ordenar só por `indice` embaralharia o que aconteceu antes.
 * O índice desempata o relógio congelado do teste dentro do mesmo exercício.
 */
export function seriesDaSessao(sessaoId: string): SerieExecutada[] {
  return db
    .select()
    .from(series)
    .where(and(eq(series.sessaoId, sessaoId), isNull(series.arquivadoEm)))
    .orderBy(asc(series.concluidaEm), asc(series.indice))
    .all()
    .map(paraSerie);
}

/**
 * O que `volumeDaSessao` precisa: a série com a unidade e a calibração do
 * exercício ao lado. O join NÃO filtra exercício arquivado — arquivar hoje não
 * pode diminuir o volume de uma sessão de ontem.
 */
export function seriesDaSessaoComExercicio(sessaoId: string): SerieComExercicio[] {
  return db
    .select({ serie: series, exercicio: exercicios })
    .from(series)
    .innerJoin(exercicios, eq(exercicios.id, series.exercicioId))
    .where(and(eq(series.sessaoId, sessaoId), isNull(series.arquivadoEm)))
    .orderBy(asc(series.concluidaEm), asc(series.indice))
    .all()
    .map(({ serie, exercicio }) => ({
      ...paraSerie(serie),
      exercicioNome: exercicio.nome,
      tipoMedicao: exercicio.tipoMedicao,
      gramasPorPlaca: exercicio.gramasPorPlaca,
    }));
}

/**
 * Todos os índices já usados neste (sessão, exercício), **incluindo as séries
 * arquivadas**.
 *
 * É feio de propósito: `uq_series_sessao_exercicio_indice` não filtra
 * `arquivado_em`, então desfazer a 3ª série e registrar de novo com
 * `indice = feitas.length` estoura o UNIQUE. O índice é a identidade estável do
 * slot; quem conta para o próximo índice tem que enxergar o que foi desfeito.
 */
export function indicesOcupados(sessaoId: string, exercicioId: string): number[] {
  return db
    .select({ indice: series.indice })
    .from(series)
    .where(and(eq(series.sessaoId, sessaoId), eq(series.exercicioId, exercicioId)))
    .orderBy(asc(series.indice))
    .all()
    .map((l) => l.indice);
}

/**
 * As séries deste exercício na ÚLTIMA sessão em que ele apareceu — a origem do
 * prefill por mesmo índice.
 *
 * `excetoSessaoId` é o que impede a sessão de hoje de ser "a última": sem ele, a
 * 1ª série de hoje se copiaria a si mesma.
 */
export function ultimaSessaoDoExercicio(
  exercicioId: string,
  excetoSessaoId?: string
): SerieExecutada[] {
  const ultima = db
    .select({ sessaoId: series.sessaoId })
    .from(series)
    .innerJoin(sessoes, eq(sessoes.id, series.sessaoId))
    .where(
      and(
        eq(series.exercicioId, exercicioId),
        isNull(series.arquivadoEm),
        isNull(sessoes.arquivadoEm),
        excetoSessaoId === undefined ? undefined : ne(series.sessaoId, excetoSessaoId)
      )
    )
    .orderBy(desc(series.concluidaEm))
    .get();

  if (ultima === undefined) return [];

  // Por índice: o degrau 2 do prefill casa série a série pela POSIÇÃO, então a
  // ordem aqui é a do slot, não a do relógio.
  return db
    .select()
    .from(series)
    .where(
      and(
        eq(series.sessaoId, ultima.sessaoId),
        eq(series.exercicioId, exercicioId),
        isNull(series.arquivadoEm)
      )
    )
    .orderBy(asc(series.indice))
    .all()
    .map(paraSerie);
}

/**
 * A tela de execução inteira numa chamada: ficha + o que já foi feito + a última
 * sessão de cada exercício, resolvido por `montarPlanoDaSessao`.
 *
 * São duas consultas por item em vez de um join só. É deliberado: o join que
 * traria "a última sessão de cada exercício" junto com a ficha precisa de janela
 * ou de subconsulta correlata, e o ganho seria invisível num banco local
 * síncrono com 8 itens — enquanto o custo seria a consulta mais difícil de ler
 * do app estar no caminho mais quente dele.
 */
export function planoDaSessao(sessaoId: string): PlanoDaSessao | null {
  const sessao = db
    .select()
    .from(sessoes)
    .where(and(eq(sessoes.id, sessaoId), isNull(sessoes.arquivadoEm)))
    .get();
  if (sessao === undefined) return null;

  // A ficha MAIS os exercícios que ele fez fora dela. Só a ficha esconderia as
  // séries do bi-set improvisado ou do aparelho ocupado — e `montarPlanoDaSessao`
  // não tem como inventar o item, porque `SerieExecutada` só carrega
  // `exercicioId`, sem nome nem `tipoMedicao`.
  const daFicha = sessao.treinoId === null ? [] : itensDoTreino(sessao.treinoId);
  const naFicha = new Set(daFicha.map((i) => i.exercicio.id));
  const ordemInicial = daFicha.reduce((maior, i) => Math.max(maior, i.ordem), -1) + 1;
  const itens = [...daFicha, ...itensSemFicha(sessaoId, naFicha, ordemInicial)];

  const anteriores = new Map<string, readonly SerieExecutada[]>();
  const ocupados = new Map<string, readonly number[]>();
  for (const item of itens) {
    const id = item.exercicio.id;
    // Bi-set e drop-set repetem o mesmo exercício na ficha, e o mapa é por
    // exercício: reconsultar seria só desperdício.
    if (anteriores.has(id)) continue;
    anteriores.set(id, ultimaSessaoDoExercicio(id, sessaoId));
    ocupados.set(id, indicesOcupados(sessaoId, id));
  }

  return montarPlanoDaSessao({
    sessao: {
      id: sessao.id,
      nome: sessao.nome,
      iniciadaEm: sessao.iniciadaEm,
      treinoId: sessao.treinoId,
    },
    itens,
    feitas: seriesDaSessao(sessaoId),
    anteriores,
    indicesOcupados: ocupados,
  });
}

/**
 * Os exercícios que apareceram nas séries e não estão na ficha, na ordem em que
 * apareceram: a sessão avulsa inteira (`jaNaFicha` vazio) ou o que ele improvisou
 * no meio de um treino com ficha.
 *
 * `seriesAlvo` 0 porque não há alvo a bater — o cartão mostra "Mais uma série" e
 * nunca fica "faltando". É também o que faz `divergenciasDoPlano` pular estes
 * itens, cujo `itemId` não existe em `treino_exercicios`.
 */
function itensSemFicha(
  sessaoId: string,
  jaNaFicha: ReadonlySet<string>,
  ordemInicial: number
): ItemDoPlano[] {
  const inicio = sql<number>`min(${series.concluidaEm})`;
  return db
    .select({ exercicio: exercicios })
    .from(series)
    .innerJoin(exercicios, eq(exercicios.id, series.exercicioId))
    .where(and(eq(series.sessaoId, sessaoId), isNull(series.arquivadoEm)))
    .groupBy(exercicios.id)
    .orderBy(asc(inicio))
    .all()
    .filter(({ exercicio }) => !jaNaFicha.has(exercicio.id))
    .map(({ exercicio }, i) => ({
      // Prefixo para nunca ser confundido com um id de `treino_exercicios`: não
      // existe ficha para este item, então não há o que "atualizar" nele.
      itemId: `avulso:${exercicio.id}`,
      exercicio: paraExercicio(exercicio),
      // Depois do último item da ficha: quem improvisou entra no fim da lista.
      ordem: ordemInicial + i,
      seriesAlvo: 0,
      repsAlvoMin: null,
      repsAlvoMax: null,
      cargaAlvo: null,
      duracaoAlvoS: null,
      descansoS: DESCANSO_AVULSO_S,
    }));
}

// ── Histórico e progressão ────────────────────────────────────────────────

/**
 * `limite` traz as MAIS RECENTES, devolvidas em ordem crescente: "as últimas 20
 * séries" é a pergunta da progressão, e um gráfico das 20 PRIMEIRAS de um ano
 * atrás não responde nada.
 */
export function seriesDoExercicio(exercicioId: string, limite?: number): SerieExecutada[] {
  return db
    .select()
    .from(series)
    .where(and(eq(series.exercicioId, exercicioId), isNull(series.arquivadoEm)))
    .orderBy(desc(series.concluidaEm), desc(series.indice))
    .limit(limite ?? SEM_LIMITE)
    .all()
    .reverse()
    .map(paraSerie);
}

/**
 * O contêiner do domínio: um exercício, uma unidade. É o que impede
 * `calcularRecordes` de receber um array com kg e placa misturados.
 *
 * NÃO filtra exercício arquivado, e isso é a regra do soft delete, não descuido:
 * arquivar o Facepull tira ele do catálogo e da ficha, mas o histórico das
 * séries que ele fez continua sendo verdade. Filtrar aqui devolveria `null` e
 * apagaria da tela exatamente o dado que `arquivado_em` existe para não perder.
 */
export function historicoDoExercicio(
  exercicioId: string,
  limite?: number
): HistoricoDoExercicio | null {
  const exercicio = obterExercicio(exercicioId);
  if (exercicio === undefined) return null;
  return { exercicio, series: seriesDoExercicio(exercicioId, limite) };
}

export type ResumoDeSessao = {
  id: string;
  nome: string;
  iniciadaEm: number;
  finalizadaEm: number | null;
  totalSeries: number;
  gramasReps: number;
  /**
   * Quanto de `gramasReps` veio de placa CONVERTIDA. É o gancho do til: a
   * conversão assume resistência proporcional ao número de placas, que alavanca
   * e roldana não garantem. O par existe aqui pelo mesmo motivo que
   * `VolumeDaSessao.gramasRepsAproximados` existe no domínio — sem ele a lista
   * imprime um número derivado de estimativa com cara de medição.
   */
  gramasRepsAproximados: number;
};

/** O volume de UMA série em grama·rep, ou NULL quando não dá para somar. */
const VOLUME_DA_SERIE = sql`case when ${series.tipo} <> 'aquecimento'
  then coalesce(${series.cargaG}, ${series.cargaPlacas} * ${exercicios.gramasPorPlaca}) * ${series.repeticoes}
end`;

/**
 * A aba Histórico numa consulta só.
 *
 * `gramasReps` converte placa calibrada em grama e deixa a não-calibrada de fora
 * (o produto vira NULL e o `sum` o ignora), que é exatamente o critério de
 * `volumeDaSerie` — se a lista somasse a placa crua, abrir a sessão mostraria um
 * volume diferente do que a lista acabou de exibir.
 *
 * `totalSeries` conta TODAS as séries não arquivadas, aquecimento incluído: é
 * "quanto trabalho teve o dia", não a base do volume.
 */
export function sessoesFinalizadas(limite?: number): ResumoDeSessao[] {
  return db
    .select({
      id: sessoes.id,
      nome: sessoes.nome,
      iniciadaEm: sessoes.iniciadaEm,
      finalizadaEm: sessoes.finalizadaEm,
      totalSeries: sql<number>`count(${series.id})`.mapWith(Number),
      gramasReps: sql<number>`coalesce(sum(${VOLUME_DA_SERIE}), 0)`.mapWith(Number),
      // A MESMA expressão, restrita à coluna de placa: o que foi convertido é
      // exatamente o que mora em `carga_placas`.
      gramasRepsAproximados: sql<number>`coalesce(sum(case
        when ${series.cargaPlacas} is not null then ${VOLUME_DA_SERIE}
      end), 0)`.mapWith(Number),
    })
    .from(sessoes)
    .leftJoin(series, and(eq(series.sessaoId, sessoes.id), isNull(series.arquivadoEm)))
    .leftJoin(exercicios, eq(exercicios.id, series.exercicioId))
    .where(and(isNotNull(sessoes.finalizadaEm), isNull(sessoes.arquivadoEm)))
    .groupBy(sessoes.id)
    .orderBy(desc(sessoes.iniciadaEm))
    .limit(limite ?? SEM_LIMITE)
    .all();
}

// ── Corpo e preferências ──────────────────────────────────────────────────

/** `undefined` até o primeiro save. O CHECK `ck_perfil_linha_unica` garante a linha única. */
export function obterPerfil(): Perfil | undefined {
  return db.select().from(perfil).get();
}

/**
 * A pesagem de maior `medido_em`, que não é necessariamente a última gravada:
 * lançar à noite a pesagem da manhã é o uso normal, e ordenar por `criado_em`
 * faria uma correção retroativa virar "o peso de hoje".
 */
export function ultimaPesagem(): { id: string; pesoG: number; medidoEm: number } | undefined {
  return db
    .select({ id: pesagens.id, pesoG: pesagens.pesoG, medidoEm: pesagens.medidoEm })
    .from(pesagens)
    .where(isNull(pesagens.arquivadoEm))
    .orderBy(desc(pesagens.medidoEm))
    .get();
}

export function historicoPeso(p?: { de?: number; ate?: number }): Pesagem[] {
  return db
    .select()
    .from(pesagens)
    .where(
      and(
        isNull(pesagens.arquivadoEm),
        p?.de === undefined ? undefined : gte(pesagens.medidoEm, p.de),
        p?.ate === undefined ? undefined : lte(pesagens.medidoEm, p.ate)
      )
    )
    .orderBy(asc(pesagens.medidoEm))
    .all();
}

export function historicoMedidas(f?: {
  parte?: ParteCorpo;
  de?: number;
  ate?: number;
}): Medida[] {
  return db
    .select()
    .from(medidas)
    .where(
      and(
        isNull(medidas.arquivadoEm),
        f?.parte === undefined ? undefined : eq(medidas.parte, f.parte),
        f?.de === undefined ? undefined : gte(medidas.medidoEm, f.de),
        f?.ate === undefined ? undefined : lte(medidas.medidoEm, f.ate)
      )
    )
    .orderBy(asc(medidas.medidoEm))
    .all();
}

/** Acesso ao KV só por aqui, com a chave vinda das constantes de `schema.ts`. */
export function preferencia(chave: string): string | undefined {
  return db
    .select({ valor: preferencias.valor })
    .from(preferencias)
    .where(eq(preferencias.chave, chave))
    .get()?.valor;
}
