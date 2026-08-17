/**
 * Carga em **grama inteira**, nunca float. `42500` = 42,5 kg.
 *
 * Anilha anda de 0,5 kg em 0,5 kg (1,25 kg em barra olímpica) e
 * `0.1 + 0.2 !== 0.3`: somar o volume de uma sessão em float acumula erro e o
 * histórico que deveria mostrar progressão passa a mostrar ruído.
 */

/** Incremento padrão de barra/máquina. Halter costuma ser 1250 (1,25 kg). */
export const INCREMENTO_PADRAO_G = 2500;

export type ResultadoParse = { ok: true; gramas: number } | { ok: false; erro: string };

/**
 * Aceita o que o Henrique digita de fato: "42,5", "42.5", "42", " 42,5 kg".
 * Devolve erro em vez de NaN — NaN silencioso vira NULL no banco e some.
 */
export function parseKg(entrada: string): ResultadoParse {
  const limpo = entrada.trim().replace(/kg$/i, '').trim().replace(',', '.');
  if (!limpo) return { ok: false, erro: 'Informe a carga.' };
  if (!/^\d+(\.\d+)?$/.test(limpo)) return { ok: false, erro: 'Carga inválida.' };

  const gramas = Math.round(Number(limpo) * 1000);
  if (gramas <= 0) return { ok: false, erro: 'A carga precisa ser maior que zero.' };
  if (gramas > 1_000_000) return { ok: false, erro: 'Carga acima de 1000 kg.' };
  return { ok: true, gramas };
}

/**
 * "42,5" — sem a unidade, que é responsabilidade do componente `Carga`.
 * Casas decimais só quando existem: 40000 vira "40", não "40,000".
 */
export function formatarKg(gramas: number): string {
  return (gramas / 1000)
    .toFixed(3)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
    .replace('.', ',');
}

/** Sobe um degrau de anilha. A decisão de subir é de `volume.ts`. */
export function proximaCarga(gramas: number, incrementoG = INCREMENTO_PADRAO_G): number {
  return gramas + incrementoG;
}

/** Peso corporal e medidas usam a mesma ideia: inteiro na menor unidade. */
export function formatarPeso(gramas: number): string {
  return (gramas / 1000).toFixed(1).replace('.', ',');
}

export function formatarMedida(milimetros: number): string {
  return (milimetros / 10).toFixed(1).replace('.', ',');
}
