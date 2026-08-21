/**
 * Carga em quilo, sempre em **grama inteira** (`42500` = 42,5 kg), porque
 * `0.1 + 0.2 !== 0.3` e anilha anda de 0,25 kg em 0,25 kg.
 *
 * Já existiu aqui uma segunda unidade — "placa", o número do pino na coluna da
 * máquina — e com ela uma união discriminada, calibração e conversão aproximada.
 * Saiu em 21/08/2026: placa só vira peso depois de calibrada, nenhuma máquina
 * dele estava calibrada, e o resultado era volume que não somava e 1RM que não
 * existia. Anotar o quilo estampado na máquina resolve o mesmo problema sem
 * carregar uma unidade que não é peso.
 *
 * `Carga` continua sendo um registro, e não um `number` solto, porque grama e
 * quilo se confundem com facilidade: `kg(42500)` não se troca por `42500` sem o
 * compilador reclamar.
 */

export type Carga = { readonly gramas: number };

/** Menor degrau real: meia anilha na barra. */
export const INCREMENTO_PADRAO = 2500;

/** Teto de digitação e de `proximaCarga`. */
export const MAXIMO_CARGA = 1_000_000;

export function kg(gramas: number): Carga {
  return { gramas };
}

// ── A coluna crua ──────────────────────────────────────────────────────────
// `cargaDaLinha` e `colunasDaCarga` são os ÚNICOS dois pontos do código que
// enxergam `carga_g`. Quem lê ou grava série, item de ficha ou incremento passa
// por aqui — é o que mantém "não se aplica" (`NULL`) distinto de "zero quilo".

export type LinhaDeCarga = { cargaG: number | null };

export function cargaDaLinha(linha: LinhaDeCarga): Carga | null {
  return linha.cargaG === null ? null : kg(linha.cargaG);
}

export function colunasDaCarga(carga: Carga | null): LinhaDeCarga {
  return { cargaG: carga === null ? null : carga.gramas };
}

// ── Entrada ────────────────────────────────────────────────────────────────

export type ResultadoParse = { ok: true; carga: Carga } | { ok: false; erro: string };

export function parseCarga(entrada: string): ResultadoParse {
  const r = parseKg(entrada);
  return r.ok ? { ok: true, carga: kg(r.gramas) } : r;
}

/**
 * Devolve gramas, não `Carga`, porque também é o parse da balança — pesagem
 * corporal fala kg e não é carga de exercício.
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
  if (gramas > MAXIMO_CARGA) return { ok: false, erro: 'Carga acima de 1000 kg.' };
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
  return `${formatarNumeroDaCarga(c)} kg`;
}

/** O dígito grande da tela de execução, sem unidade ao lado. */
export function formatarNumeroDaCarga(c: Carga): string {
  return formatarGramas(c.gramas);
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

/** Sobe um degrau. A decisão de subir é de `volume.ts`; o tamanho do degrau, do exercício. */
export function proximaCarga(a: Carga, inc: Carga): Carga {
  return kg(Math.min(a.gramas + inc.gramas, MAXIMO_CARGA));
}

/**
 * Desce um degrau — só por toque explícito dele, nunca por sugestão do app.
 * O piso é o próprio incremento: carga zero não é persistível (`CHECK carga > 0`).
 */
export function cargaAnterior(a: Carga, inc: Carga): Carga {
  return kg(Math.max(a.gramas - inc.gramas, inc.gramas));
}

/** Negativo, zero ou positivo — serve de comparador de ordenação. */
export function compararCarga(a: Carga, b: Carga): number {
  return a.gramas - b.gramas;
}
