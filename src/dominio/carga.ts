/**
 * Carga com a unidade **dentro do valor**, nunca ao lado dele.
 *
 * Duas unidades convivem na academia do Henrique: quilo (`42500` = 42,5 kg, em
 * grama inteira porque `0.1 + 0.2 !== 0.3` e anilha anda de 0,25 kg em 0,25 kg)
 * e placa ("o pino na 5ª placa"), que é um número de posição, não um peso.
 *
 * Somar as duas não significa nada. Por isso `Carga` é união discriminada com
 * campos de nomes DIFERENTES (`gramas` vs `placas`): extrair o payload errado
 * não compila, em vez de somar 5 com 42500 e ninguém notar.
 */

export const UNIDADES = ['kg', 'placa'] as const;
export type Unidade = (typeof UNIDADES)[number];

/**
 * Os nomes de campo são diferentes de propósito. Com `valor` nos dois ramos,
 * `c.valor` compilaria em cima da união e a proteção evaporaria.
 */
export type CargaKg = { readonly unidade: 'kg'; readonly gramas: number };
export type CargaPlaca = { readonly unidade: 'placa'; readonly placas: number };
export type Carga = CargaKg | CargaPlaca;
export type CargaDe<U extends Unidade> = Extract<Carga, { unidade: U }>;

/** Menor degrau real: meia anilha na barra, uma placa no pino. */
export const INCREMENTO_PADRAO: Readonly<Record<Unidade, number>> = { kg: 2500, placa: 1 };

/** Teto de digitação e de `proximaCarga`: 1000 kg, ou a última placa da coluna. */
export const MAXIMO_CARGA: Readonly<Record<Unidade, number>> = { kg: 1_000_000, placa: 30 };

export function kg(gramas: number): CargaKg {
  return { unidade: 'kg', gramas };
}

export function placa(placas: number): CargaPlaca {
  return { unidade: 'placa', placas };
}

export function criarCarga(unidade: Unidade, valor: number): Carga {
  return unidade === 'kg' ? kg(valor) : placa(valor);
}

/** O número cru, para persistir e testar. Fora daqui ele não circula sozinho. */
export function valorDaCarga(c: Carga): number {
  return c.unidade === 'kg' ? c.gramas : c.placas;
}

// ── As colunas cruas ────────────────────────────────────────────────────────
// `cargaDaLinha` e `colunasDaCarga` são os ÚNICOS dois pontos do código que
// enxergam `carga_g`/`carga_placas`. Quem lê ou grava série, item de ficha ou
// incremento passa por aqui — é o que mantém a XOR do banco e a união do
// TypeScript falando a mesma língua.

export type LinhaDeCarga = { cargaG: number | null; cargaPlacas: number | null };

export function cargaDaLinha(linha: LinhaDeCarga): Carga | null {
  // `cargaG` primeiro porque é a coluna que qualquer query ingênua já soma; as
  // duas preenchidas ao mesmo tempo é estado que o CHECK `ck_*_uma_unidade`
  // impede de existir no banco.
  if (linha.cargaG !== null) return kg(linha.cargaG);
  if (linha.cargaPlacas !== null) return placa(linha.cargaPlacas);
  return null;
}

export function colunasDaCarga(carga: Carga | null): LinhaDeCarga {
  if (carga === null) return { cargaG: null, cargaPlacas: null };
  return carga.unidade === 'kg'
    ? { cargaG: carga.gramas, cargaPlacas: null }
    : { cargaG: null, cargaPlacas: carga.placas };
}

// ── Entrada ────────────────────────────────────────────────────────────────

export type ResultadoParse = { ok: true; carga: Carga } | { ok: false; erro: string };

/**
 * Parse na unidade que o exercício já definiu — a tela nunca pergunta "kg ou
 * placa?", porque o catálogo respondeu isso quando o exercício nasceu.
 */
export function parseCarga(entrada: string, unidade: Unidade): ResultadoParse {
  if (unidade === 'kg') {
    const r = parseKg(entrada);
    return r.ok ? { ok: true, carga: kg(r.gramas) } : r;
  }
  return parsePlaca(entrada);
}

function parsePlaca(entrada: string): ResultadoParse {
  const limpo = entrada.trim().replace(/placas?$/i, '').trim().replace(',', '.');
  if (!limpo) return { ok: false, erro: 'Informe a carga.' };
  // Decimal é o erro previsível de quem acabou de digitar "42,5" no exercício
  // anterior: merece a mensagem que explica, não o "inválida" genérico.
  if (/^\d+\.\d+$/.test(limpo)) return { ok: false, erro: 'Placa é número inteiro.' };
  if (!/^\d+$/.test(limpo)) return { ok: false, erro: 'Carga inválida.' };

  const placas = Number(limpo);
  if (placas <= 0) return { ok: false, erro: 'A carga precisa ser maior que zero.' };
  if (placas > MAXIMO_CARGA.placa) {
    return { ok: false, erro: `Máximo de ${MAXIMO_CARGA.placa} placas.` };
  }
  return { ok: true, carga: placa(placas) };
}

/**
 * Pesagem corporal fala kg e só kg — não há ambiguidade de unidade numa
 * balança. Devolve gramas, não `Carga`, e é o motor de `parseCarga(_, 'kg')`.
 *
 * Aceita o que o Henrique digita de fato: "42,5", "42.5", "42", " 42,5 kg".
 * Devolve erro em vez de NaN — NaN silencioso vira NULL no banco e some.
 */
export function parseKg(entrada: string): { ok: true; gramas: number } | { ok: false; erro: string } {
  const limpo = entrada.trim().replace(/kg$/i, '').trim().replace(',', '.');
  if (!limpo) return { ok: false, erro: 'Informe a carga.' };
  if (!/^\d+(\.\d+)?$/.test(limpo)) return { ok: false, erro: 'Carga inválida.' };

  const gramas = Math.round(Number(limpo) * 1000);
  if (gramas <= 0) return { ok: false, erro: 'A carga precisa ser maior que zero.' };
  if (gramas > MAXIMO_CARGA.kg) return { ok: false, erro: 'Carga acima de 1000 kg.' };
  return { ok: true, gramas };
}

// ── Saída ──────────────────────────────────────────────────────────────────

/** Casas decimais só quando existem: 40000 vira "40", não "40,000". */
function formatarGramas(gramas: number): string {
  return (gramas / 1000)
    .toFixed(3)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
    .replace('.', ',');
}

export function formatarCarga(c: Carga): string {
  return `${formatarNumeroDaCarga(c)} ${rotuloDaUnidade(c)}`;
}

/** O dígito grande da tela de execução, sem unidade ao lado. */
export function formatarNumeroDaCarga(c: Carga): string {
  return c.unidade === 'kg' ? formatarGramas(c.gramas) : String(c.placas);
}

/** Plural de verdade: "1 placas" na tela é o tipo de detalhe que denuncia app amador. */
export function rotuloDaUnidade(c: Carga): string {
  if (c.unidade === 'kg') return 'kg';
  return c.placas === 1 ? 'placa' : 'placas';
}

/**
 * "5 placas (~25 kg)" — o til é obrigatório: `gramasPorPlaca` assume que a
 * resistência é proporcional ao número de placas, o que alavanca e roldana não
 * garantem. Sem calibração, ou em kg, imprime a carga seca.
 */
export function formatarCargaAproximada(c: Carga, gramasPorPlaca: number | null): string {
  const texto = formatarCarga(c);
  if (c.unidade === 'kg') return texto;
  const gramas = cargaEmGramas(c, gramasPorPlaca);
  return gramas === null ? texto : `${texto} (~${formatarGramas(gramas)} kg)`;
}

/** g·rep -> "720 kg·rep". Existe para NENHUMA tela dividir por 1000. */
export function formatarVolume(gramasReps: number): string {
  return `${formatarGramas(gramasReps)} kg·rep`;
}

export function formatarPeso(gramas: number): string {
  return (gramas / 1000).toFixed(1).replace('.', ',');
}

export function formatarMedida(milimetros: number): string {
  return (milimetros / 10).toFixed(1).replace('.', ',');
}

// ── Aritmética ─────────────────────────────────────────────────────────────
// `NoInfer` no segundo parâmetro é OBRIGATÓRIO e some sem barulho: sem ele, U
// alarga para 'kg' | 'placa' a partir dos DOIS argumentos e `proximaCarga(placa(5),
// kg(2500))` compila — somando 2500 a cinco placas. Com ele, U vem só do primeiro
// e o par misto dá TS2345. `carga.test.ts` tem @ts-expect-error vigiando isso.

function comValor<U extends Unidade>(base: CargaDe<U>, valor: number): CargaDe<U> {
  return criarCarga((base as Carga).unidade, valor) as CargaDe<U>;
}

/** Sobe um degrau. A decisão de subir é de `volume.ts`; o tamanho do degrau, do exercício. */
export function proximaCarga<U extends Unidade>(a: CargaDe<U>, inc: NoInfer<CargaDe<U>>): CargaDe<U> {
  const teto = MAXIMO_CARGA[(a as Carga).unidade];
  return comValor(a, Math.min(valorDaCarga(a as Carga) + valorDaCarga(inc as Carga), teto));
}

/**
 * Desce um degrau — só por toque explícito dele, nunca por sugestão do app.
 * O piso é o próprio incremento: carga zero não é persistível (`CHECK carga > 0`)
 * e não existe "meia placa" na máquina.
 */
export function cargaAnterior<U extends Unidade>(a: CargaDe<U>, inc: NoInfer<CargaDe<U>>): CargaDe<U> {
  const passo = valorDaCarga(inc as Carga);
  return comValor(a, Math.max(valorDaCarga(a as Carga) - passo, passo));
}

/** Negativo, zero ou positivo — serve de comparador de ordenação. */
export function compararCarga<U extends Unidade>(a: CargaDe<U>, b: NoInfer<CargaDe<U>>): number {
  return valorDaCarga(a as Carga) - valorDaCarga(b as Carga);
}

/** Guarda de runtime, para dois valores que vieram do banco e não do compilador. */
export function mesmaUnidade(a: Carga, b: Carga): boolean {
  return a.unidade === b.unidade;
}

/**
 * A conversão acontece na LEITURA, nunca na escrita: `series` guarda o número
 * que ele leu na máquina, e o dia em que ele descobrir quanto pesa a placa custa
 * um UPDATE de uma linha — com o histórico inteiro ganhando kg retroativamente.
 *
 * `null` = placa sem calibração, que é diferente de zero.
 */
export function cargaEmGramas(c: Carga, gramasPorPlaca: number | null): number | null {
  if (c.unidade === 'kg') return c.gramas;
  if (gramasPorPlaca === null || gramasPorPlaca <= 0) return null;
  return c.placas * gramasPorPlaca;
}
