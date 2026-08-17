/**
 * Corpo: IMC, faixa de peso normal, progresso rumo ao objetivo e estatística de
 * período sobre peso e medidas.
 *
 * Aritmética inteira, como em `carga.ts` e pela mesma razão: peso em **gramas**,
 * altura em **milímetros**, IMC em **centésimos** (2474 = 24,74). Nenhum float
 * atravessa a fronteira deste módulo.
 *
 * A decisão que organiza o arquivo é `Ritmo`. A tela de referência que o
 * Henrique usava anuncia "+1,8 kg por semana · Muito rápido" extrapolando DUAS
 * pesagens separadas por seis dias — um número que não mede nada e assusta.
 * Aqui a tendência é união discriminada: no ramo insuficiente o campo
 * `porSemana` **não existe**, então a UI não consegue imprimi-lo nem com `?? 0`.
 *
 * Só depende de `datas.ts` (o tipo `Ponto`). Fica inteiramente fora da DAG de
 * carga: peso corporal é grama e medida é milímetro, sem ambiguidade de unidade.
 */

import type { ParteCorpo } from '../db/schema.ts';
import type { Ponto } from './datas.ts';

const MS_DIA = 24 * 60 * 60 * 1000;
const MS_SEMANA = 7 * MS_DIA;

// ── IMC ────────────────────────────────────────────────────────────────────

/** Piso da faixa "normal" da OMS, em centésimos: 18,50. */
export const IMC_NORMAL_MIN_CENT = 1850;
/** Teto da faixa "normal", inclusive: 24,99. A partir de 25,00 é sobrepeso. */
export const IMC_NORMAL_MAX_CENT = 2499;

/** 1,00 m e 2,50 m — os mesmos limites do `ck_perfil_valores` no schema. */
export const ALTURA_MIN_MM = 1000;
export const ALTURA_MAX_MM = 2500;

export type CategoriaImc =
  | 'abaixo_do_peso'
  | 'normal'
  | 'sobrepeso'
  | 'obesidade_1'
  | 'obesidade_2'
  | 'obesidade_3';

/** `centesimos`: 2474 = 24,74. Inteiro pela mesma razão que carga é grama. */
export type Imc = { centesimos: number; categoria: CategoriaImc };

/**
 * Tabela única de cortes: `centesimos < teto` ⇒ categoria. `faixaPesoNormal` sai
 * das MESMAS duas constantes, e é por isso que faixa e categoria não podem se
 * contradizer — não há um segundo lugar onde 18,5 esteja escrito.
 */
const CORTES_IMC: readonly (readonly [teto: number, categoria: CategoriaImc])[] = [
  [IMC_NORMAL_MIN_CENT, 'abaixo_do_peso'],
  [IMC_NORMAL_MAX_CENT + 1, 'normal'],
  [3000, 'sobrepeso'],
  [3500, 'obesidade_1'],
  [4000, 'obesidade_2'],
];

export function categoriaDoImc(centesimos: number): CategoriaImc {
  for (const [teto, categoria] of CORTES_IMC) {
    if (centesimos < teto) return categoria;
  }
  return 'obesidade_3';
}

/**
 * IMC = kg / m². Em inteiro: `pesoG * 100000 / alturaMm²` já sai em centésimos,
 * sem passar por metro nem por quilo — 78400 g e 1780 mm dão 2474.
 *
 * Devolve `null` sem altura E com altura fora da faixa física: digitar 178
 * achando que o campo é centímetro daria IMC 2474000, e um número absurdo na
 * tela é pior que um espaço vazio pedindo a altura.
 */
export function calcularImc(pesoG: number, alturaMm: number | null): Imc | null {
  if (alturaMm === null || !alturaValida(alturaMm)) return null;
  if (pesoG <= 0) return null;

  const centesimos = Math.round((pesoG * 100000) / (alturaMm * alturaMm));
  return { centesimos, categoria: categoriaDoImc(centesimos) };
}

function alturaValida(alturaMm: number): boolean {
  return Number.isFinite(alturaMm) && alturaMm >= ALTURA_MIN_MM && alturaMm <= ALTURA_MAX_MM;
}

// ── Faixa de peso ──────────────────────────────────────────────────────────

export type FaixaPeso = { minimoG: number; maximoG: number };

/** O peso exato, em gramas fracionários, antes de qualquer arredondamento. */
function pesoExatoParaImc(centesimosImc: number, alturaMm: number): number {
  return (centesimosImc * alturaMm * alturaMm) / 100000;
}

/** Peso que dá o IMC pedido nesta altura, em gramas. Inverso de `calcularImc`. */
export function pesoParaImc(centesimosImc: number, alturaMm: number): number {
  return Math.round(pesoExatoParaImc(centesimosImc, alturaMm));
}

/**
 * A tela mostra peso com uma casa decimal (`78,4 kg`), então a faixa é
 * arredondada para 100 g — senão ela anunciaria "58,6 kg" e 58,6 kg exibido
 * classificaria como abaixo do peso.
 */
const PASSO_EXIBICAO_G = 100;

/**
 * Intervalo de peso que cai na categoria 'normal' para esta altura.
 *
 * Arredondamento DIRECIONADO — mínimo para cima, máximo para baixo — porque as
 * duas pontas da faixa precisam elas mesmas classificar como 'normal'. Arredondar
 * ao mais próximo colocaria a ponta fora da própria faixa que ela anuncia, e o
 * teste de propriedade sobre 51 alturas existe exatamente para travar isso.
 */
export function faixaPesoNormal(alturaMm: number | null): FaixaPeso | null {
  if (alturaMm === null || !alturaValida(alturaMm)) return null;

  const minimoExato = pesoExatoParaImc(IMC_NORMAL_MIN_CENT, alturaMm);
  const maximoExato = pesoExatoParaImc(IMC_NORMAL_MAX_CENT, alturaMm);

  return {
    minimoG: Math.ceil(minimoExato / PASSO_EXIBICAO_G) * PASSO_EXIBICAO_G,
    maximoG: Math.floor(maximoExato / PASSO_EXIBICAO_G) * PASSO_EXIBICAO_G,
  };
}

// ── Entrada e saída ────────────────────────────────────────────────────────

export type ResultadoAltura = { ok: true; milimetros: number } | { ok: false; erro: string };

/**
 * Aceita o que ele digita de fato: "1,78", "1.78", "178", "178 cm", "1,78 m".
 *
 * O SUFIXO manda quando existe; sem sufixo, a vírgula é que decide — quem
 * escreve decimal está falando em metro, quem escreve inteiro está falando em
 * centímetro. É o que faz "178,5 cm" virar 1785 em vez de ser recusado por
 * parecer 178 metros.
 *
 * Não reaproveita `ResultadoParse` de `carga.ts` de propósito: altura não tem
 * unidade discriminante e o acoplamento só serviria para arrastar `carga.ts`
 * para dentro da tela de corpo.
 */
export function parseAltura(entrada: string): ResultadoAltura {
  const texto = entrada.trim().toLowerCase();
  if (!texto) return { ok: false, erro: 'Informe a altura.' };

  const { numero, fator } = separarSufixo(texto);
  const limpo = numero.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(limpo)) return { ok: false, erro: 'Altura inválida.' };

  const escala = fator ?? (limpo.includes('.') ? 1000 : 10);
  const milimetros = Math.round(Number(limpo) * escala);

  if (!alturaValida(milimetros)) {
    return {
      ok: false,
      erro: `Altura entre ${formatarAltura(ALTURA_MIN_MM)} m e ${formatarAltura(ALTURA_MAX_MM)} m.`,
    };
  }
  return { ok: true, milimetros };
}

/** `fator` null = sem sufixo, e aí quem decide a escala é a vírgula. */
function separarSufixo(texto: string): { numero: string; fator: number | null } {
  // 'mm' antes de 'm', senão "1780 mm" perde só um 'm' e vira 1780 metros.
  if (texto.endsWith('mm')) return { numero: texto.slice(0, -2), fator: 1 };
  if (texto.endsWith('cm')) return { numero: texto.slice(0, -2), fator: 10 };
  if (texto.endsWith('m')) return { numero: texto.slice(0, -1), fator: 1000 };
  return { numero: texto, fator: null };
}

/** 1780 -> "1,78". Sempre duas casas: "1,8" para 1,80 m parece truncado. */
export function formatarAltura(milimetros: number): string {
  return (milimetros / 1000).toFixed(2).replace('.', ',');
}

/** 2474 -> "24,7". Uma casa: a segunda é ruído de balança. */
export function formatarImc(centesimos: number): string {
  return (centesimos / 100).toFixed(1).replace('.', ',');
}

export function rotuloCategoria(c: CategoriaImc): string {
  const rotulos: Readonly<Record<CategoriaImc, string>> = {
    abaixo_do_peso: 'Abaixo do peso',
    normal: 'Peso normal',
    sobrepeso: 'Sobrepeso',
    obesidade_1: 'Obesidade grau 1',
    obesidade_2: 'Obesidade grau 2',
    obesidade_3: 'Obesidade grau 3',
  };
  return rotulos[c];
}

/**
 * Variação com sinal explícito: 1400 -> "+1,4"; -600 -> "−0,6".
 *
 * O sinal sai do valor JÁ arredondado para a casa exibida, senão −40 g viraria
 * "−0,0" — um menos na frente de zero, que a tela lê como perda.
 * O menos é U+2212, não hífen: em fonte proporcional o hífen fica curto demais
 * e some ao lado do dígito.
 */
export function formatarVariacao(gramas: number): string {
  const decimos = Math.round(gramas / 100);
  const modulo = (Math.abs(decimos) / 10).toFixed(1).replace('.', ',');
  if (decimos > 0) return `+${modulo}`;
  if (decimos < 0) return `−${modulo}`;
  return modulo;
}

// ── Medida corporal ────────────────────────────────────────────────────────

export type ResultadoMedida = { ok: true; milimetros: number } | { ok: false; erro: string };

/**
 * Centímetro digitado -> milímetro inteiro, a escala de `valor_mm`.
 *
 * Irmã de `parseKg` e `parseAltura`, e separada das duas porque cada uma recusa
 * coisa diferente: `parseAltura('38,5 cm')` devolve 385 e então RECUSA por estar
 * fora de 1,00–2,50 m, que é a validação certa para altura e absurda para braço.
 * Recusa em vez de devolver NaN pela razão de sempre: NaN vira NULL no banco.
 */
export function parseCentimetros(entrada: string): ResultadoMedida {
  const limpo = entrada.trim().replace(/cm$/i, '').trim().replace(',', '.');
  if (!limpo) return { ok: false, erro: 'Informe a medida.' };
  if (!/^\d+(\.\d+)?$/.test(limpo)) return { ok: false, erro: 'Medida inválida.' };

  const milimetros = Math.round(Number(limpo) * 10);
  if (milimetros <= 0) return { ok: false, erro: 'A medida precisa ser maior que zero.' };
  return { ok: true, milimetros };
}

/**
 * "+1,5" / "−0,8" em centímetros. Mesmo menos U+2212 de `formatarVariacao`, e
 * duas diferenças que impedem reaproveitar aquela:
 *
 * 1. A escala. `formatarVariacao` divide por 1000 (grama -> quilo) e escreveria
 *    15 mm — 1,5 cm de braço — como "+0,0".
 * 2. Não há arredondamento a fazer. Uma casa decimal de centímetro É o
 *    milímetro, então todo valor não-nulo aparece; só o zero exato sai sem
 *    sinal. Na balança, ao contrário, uma casa de quilo esconde 40 g, e é de lá
 *    que vem o cuidado com o "−0,0".
 */
export function formatarVariacaoDaMedida(milimetros: number): string {
  const modulo = (Math.abs(milimetros) / 10).toFixed(1).replace('.', ',');
  if (milimetros > 0) return `+${modulo}`;
  if (milimetros < 0) return `−${modulo}`;
  return modulo;
}

/**
 * O nome de exibição de cada parte. Mora junto do resto do vocabulário de corpo
 * porque `PARTES_CORPO` é uma união fechada: o `Record` completo faz o
 * compilador cobrar o rótulo no dia em que uma parte nova nascer — que era
 * exatamente o que não acontecia com a tabela solta dentro da tela.
 */
export function rotuloDaParte(p: ParteCorpo): string {
  const rotulos: Readonly<Record<ParteCorpo, string>> = {
    peito: 'Peito',
    cintura: 'Cintura',
    quadril: 'Quadril',
    ombros: 'Ombros',
    braco_direito: 'Braço D.',
    braco_esquerdo: 'Braço E.',
    antebraco_direito: 'Antebraço D.',
    antebraco_esquerdo: 'Antebraço E.',
    coxa_direita: 'Coxa D.',
    coxa_esquerda: 'Coxa E.',
    panturrilha_direita: 'Panturrilha D.',
    panturrilha_esquerda: 'Panturrilha E.',
  };
  return rotulos[p];
}

// ── Objetivo ───────────────────────────────────────────────────────────────

export type Objetivo = { pesoObjetivoG: number; pesoInicialG: number | null };
export type DirecaoObjetivo = 'perder' | 'ganhar' | 'manter';

export type ProgressoObjetivo = {
  direcao: DirecaoObjetivo;
  /** Sempre >= 0. Zero quando alcançado — não vira negativo ao passar da meta. */
  faltaG: number;
  alcancado: boolean;
  /** Inteiro 0..100. `null` quando não há partida confiável para medir contra. */
  percentual: number | null;
};

/**
 * A direção vem da PARTIDA, não do peso de hoje: quem saiu de 82 kg rumo a 75 e
 * hoje está em 74 continua num objetivo de 'perder' — trocar para 'ganhar' ao
 * cruzar a meta inverteria a frase da tela justamente no dia bom.
 *
 * Sem partida registrada, o peso atual faz as vezes dela; é o suficiente para a
 * direção, e não é o suficiente para o percentual (que fica `null`).
 */
export function progressoObjetivo(pesoAtualG: number, objetivo: Objetivo): ProgressoObjetivo {
  const { pesoObjetivoG, pesoInicialG } = objetivo;
  const referencia = pesoInicialG ?? pesoAtualG;

  const direcao: DirecaoObjetivo =
    pesoObjetivoG < referencia ? 'perder' : pesoObjetivoG > referencia ? 'ganhar' : 'manter';

  const distancia =
    direcao === 'perder'
      ? pesoAtualG - pesoObjetivoG
      : direcao === 'ganhar'
        ? pesoObjetivoG - pesoAtualG
        : Math.abs(pesoAtualG - pesoObjetivoG);
  const faltaG = Math.max(0, distancia);

  return {
    direcao,
    faltaG,
    alcancado: faltaG === 0,
    percentual: percentualDoObjetivo(pesoAtualG, pesoObjetivoG, pesoInicialG),
  };
}

/**
 * `null` — não 0, não 100 — quando falta a partida ou quando partida e meta
 * coincidem: barra em 0% mente tanto quanto barra em 100%, e é a única leitura
 * possível de "0/0".
 *
 * Truncar (e não arredondar) é deliberado: 99,6% do caminho tem que mostrar 99.
 * Barra cheia é reservada a quem bateu a meta.
 */
function percentualDoObjetivo(
  pesoAtualG: number,
  pesoObjetivoG: number,
  pesoInicialG: number | null
): number | null {
  if (pesoInicialG === null) return null;
  const percurso = pesoInicialG - pesoObjetivoG;
  if (percurso === 0) return null;

  // Os sinais se cancelam: a mesma razão serve para perder e para ganhar peso.
  const razao = (pesoInicialG - pesoAtualG) / percurso;
  return Math.min(100, Math.max(0, Math.floor(razao * 100)));
}

// ── Ritmo ──────────────────────────────────────────────────────────────────

export const MIN_PESAGENS_PARA_RITMO = 4;
export const MIN_DIAS_PARA_RITMO = 14;

/**
 * União discriminada de propósito: no ramo insuficiente o campo `porSemana` NÃO
 * EXISTE. Ler a tendência exige passar pelo `if`, e é isso que impede a tela de
 * anunciar "+1,8 kg por semana" a partir de duas pesagens em seis dias.
 *
 * `porSemana` está na unidade da entrada: gramas por semana para peso,
 * milímetros por semana para medida.
 */
export type Ritmo =
  | { suficiente: true; porSemana: number; pontos: number; dias: number }
  | {
      suficiente: false;
      motivo: 'sem_dados' | 'poucas_pesagens' | 'periodo_curto';
      pontos: number;
      dias: number;
    };

/**
 * Inclinação por mínimos quadrados sobre (semanas, valor), não `(último −
 * primeiro) / semanas`.
 *
 * A diferença não é acadêmica: seis pesagens caindo 300 g por semana, com a
 * última tomada depois de um churrasco (+2 kg), dão +100 g/semana na conta das
 * pontas — o app diria que ele engordou. A regressão olha as seis e devolve
 * negativo, porque uma pesagem ruim é um ponto, não a conclusão.
 *
 * As duas travas (4 pesagens, 14 dias) vêm antes da conta: com menos que isso a
 * inclinação existe matematicamente e não significa nada.
 */
export function ritmoSemanal(pontos: readonly Ponto[]): Ritmo {
  const ordenados = [...pontos].sort((a, b) => a.instante - b.instante);
  const quantidade = ordenados.length;
  const dias = diasEntre(ordenados);

  if (quantidade === 0) return { suficiente: false, motivo: 'sem_dados', pontos: 0, dias: 0 };
  if (quantidade < MIN_PESAGENS_PARA_RITMO) {
    return { suficiente: false, motivo: 'poucas_pesagens', pontos: quantidade, dias };
  }
  if (dias < MIN_DIAS_PARA_RITMO) {
    return { suficiente: false, motivo: 'periodo_curto', pontos: quantidade, dias };
  }

  const inicio = ordenados[0].instante;
  const semanas = ordenados.map((p) => (p.instante - inicio) / MS_SEMANA);
  const mediaX = media(semanas);
  const mediaY = media(ordenados.map((p) => p.valor));

  let covariancia = 0;
  let variancia = 0;
  for (let i = 0; i < quantidade; i++) {
    const dx = semanas[i] - mediaX;
    covariancia += dx * (ordenados[i].valor - mediaY);
    variancia += dx * dx;
  }

  // Só acontece com todos os pontos no mesmo instante, que `dias` já barrou;
  // fica como guarda porque dividir por zero devolveria Infinity para a tela.
  if (variancia === 0) {
    return { suficiente: false, motivo: 'periodo_curto', pontos: quantidade, dias };
  }

  return {
    suficiente: true,
    porSemana: Math.round(covariancia / variancia),
    pontos: quantidade,
    dias,
  };
}

function media(valores: readonly number[]): number {
  let soma = 0;
  for (const v of valores) soma += v;
  return soma / valores.length;
}

/** Dias inteiros COMPLETOS entre o primeiro e o último ponto de uma lista ordenada. */
function diasEntre(ordenados: readonly Ponto[]): number {
  if (ordenados.length < 2) return 0;
  const span = ordenados[ordenados.length - 1].instante - ordenados[0].instante;
  return Math.floor(span / MS_DIA);
}

// ── Período e estatística ──────────────────────────────────────────────────

export type Periodo = { de?: number; ate?: number };

/** Unidade dos campos numéricos = unidade da entrada (g para peso, mm para medida). */
export type EstatisticaSerie = {
  pontos: number;
  primeiro: Ponto;
  ultimo: Ponto;
  minimo: Ponto;
  maximo: Ponto;
  /** ultimo.valor − primeiro.valor. O sinal importa. */
  mudanca: number;
  /** maximo.valor − minimo.valor: o quanto oscilou no período. */
  amplitude: number;
  dias: number;
  ritmo: Ritmo;
};

/** Devolve ORDENADO por instante: tudo daqui para baixo depende disso. */
export function filtrarPeriodo(pontos: readonly Ponto[], periodo?: Periodo): Ponto[] {
  const de = periodo?.de;
  const ate = periodo?.ate;
  return pontos
    .filter((p) => (de === undefined || p.instante >= de) && (ate === undefined || p.instante <= ate))
    .sort((a, b) => a.instante - b.instante);
}

/** "Últimos 30 dias" a partir de um instante dado — nunca de `Date.now()` implícito. */
export function periodoDeDias(dias: number, ate: number): Periodo {
  return { de: ate - dias * MS_DIA, ate };
}

/**
 * `null` quando o período não tem ponto nenhum: a tela mostra "sem pesagens no
 * período" em vez de zeros que parecem medição.
 */
export function estatisticaDaSerie(
  pontos: readonly Ponto[],
  periodo?: Periodo
): EstatisticaSerie | null {
  const janela = filtrarPeriodo(pontos, periodo);
  if (janela.length === 0) return null;

  let minimo = janela[0];
  let maximo = janela[0];
  for (const p of janela) {
    // Estritamente maior/menor: no empate fica o mais ANTIGO, porque "o mínimo
    // foi em 3 de março" tem que apontar o dia em que ele chegou lá.
    if (p.valor < minimo.valor) minimo = p;
    if (p.valor > maximo.valor) maximo = p;
  }

  const primeiro = janela[0];
  const ultimo = janela[janela.length - 1];

  return {
    pontos: janela.length,
    primeiro,
    ultimo,
    minimo,
    maximo,
    mudanca: ultimo.valor - primeiro.valor,
    amplitude: maximo.valor - minimo.valor,
    dias: diasEntre(janela),
    ritmo: ritmoSemanal(janela),
  };
}

/** Aceita a linha do banco direto — sem mapeamento na tela. */
export function estatisticaDoPeso(
  pesagens: readonly { medidoEm: number; pesoG: number }[],
  periodo?: Periodo
): EstatisticaSerie | null {
  return estatisticaDaSerie(
    pesagens.map((p) => ({ instante: p.medidoEm, valor: p.pesoG })),
    periodo
  );
}

export function estatisticaDaMedida(
  medidas: readonly { medidoEm: number; valorMm: number }[],
  periodo?: Periodo
): EstatisticaSerie | null {
  return estatisticaDaSerie(
    medidas.map((m) => ({ instante: m.medidoEm, valor: m.valorMm })),
    periodo
  );
}

/**
 * A pesagem mais recente. Empate no mesmo instante fica com a última da lista,
 * que é a gravada por último — duas pesagens no mesmo dia são permitidas e a
 * tela do dia mostra a segunda.
 */
export function pesoAtual(
  pesagens: readonly { medidoEm: number; pesoG: number }[]
): { medidoEm: number; pesoG: number } | null {
  let atual: { medidoEm: number; pesoG: number } | null = null;
  for (const p of pesagens) {
    if (atual === null || p.medidoEm >= atual.medidoEm) atual = p;
  }
  return atual;
}
