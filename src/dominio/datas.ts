/**
 * Tempo: agrupamento por dia, média móvel e o texto de data, hora e duração.
 *
 * A pegadinha do agrupamento: treino que começa 23h40 e termina 0h20 são duas
 * datas diferentes. O dia usado é o **fuso local do aparelho** sobre o
 * **instante de início** — é o que corresponde ao que o Henrique chama de "o
 * treino de ontem".
 *
 * Os formatadores moram aqui, e não em cada tela, pela mesma razão que
 * `formatarCarga` mora em `carga.ts`: duas telas com duas versões de "19h40"
 * divergem no dia em que uma delas for corrigida.
 */

function dois(n: number): string {
  return String(n).padStart(2, '0');
}

/** "2026-08-16" no fuso local. Chave de agrupamento, não de exibição. */
export function diaLocal(instante: number): string {
  const d = new Date(instante);
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

// ── Texto ──────────────────────────────────────────────────────────────────

/** "16/08". Sem ano: o histórico recente é de semanas, não de anos. */
export function formatarData(instante: number): string {
  const d = new Date(instante);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`;
}

/** "16/08/26" — o caso raro, quando a lista atravessa a virada do ano. */
export function formatarDataComAno(instante: number): string {
  const d = new Date(instante);
  return `${formatarData(instante)}/${String(d.getFullYear()).slice(-2)}`;
}

/** "19h40" — hora de treino, não timestamp. */
export function formatarHora(instante: number): string {
  const d = new Date(instante);
  return `${dois(d.getHours())}h${dois(d.getMinutes())}`;
}

/** "15/08 às 19h40". */
export function formatarDataHora(instante: number): string {
  return `${formatarData(instante)} às ${formatarHora(instante)}`;
}

const SEGUNDOS_POR_MINUTO = 60;

/** 600 -> "10 min" · 90 -> "1 min 30 s" · 45 -> "45 s". */
export function formatarDuracao(segundos: number): string {
  const minutos = Math.floor(segundos / SEGUNDOS_POR_MINUTO);
  const resto = segundos % SEGUNDOS_POR_MINUTO;
  if (minutos === 0) return `${resto} s`;
  if (resto === 0) return `${minutos} min`;
  return `${minutos} min ${resto} s`;
}

/**
 * O contador de descanso: "0:47". Recebe em MILISSEGUNDOS o que falta, já
 * calculado por `fimDoDescanso` — nunca uma soma de ticks, que atrasa
 * exatamente o tempo em que a tela ficou apagada.
 */
export function formatarRelogio(milissegundos: number): string {
  const total = Math.max(0, Math.ceil(milissegundos / 1000));
  const minutos = Math.floor(total / SEGUNDOS_POR_MINUTO);
  return `${minutos}:${dois(total % SEGUNDOS_POR_MINUTO)}`;
}

export type Ponto = { instante: number; valor: number };

/**
 * Média móvel de N dias sobre a série bruta.
 *
 * Existe porque peso corporal oscila por água, sal e horário: o gráfico ponto a
 * ponto vira serrote e sugere que se engordou 800 g num dia — o que não
 * aconteceu. O dado bruto continua guardado; isto é só a leitura.
 */
export function mediaMovel(pontos: Ponto[], dias = 7): Ponto[] {
  const ordenados = [...pontos].sort((a, b) => a.instante - b.instante);
  const janelaMs = dias * 24 * 60 * 60 * 1000;

  return ordenados.map((ponto, i) => {
    const inicio = ponto.instante - janelaMs;
    let soma = 0;
    let quantidade = 0;
    for (let j = i; j >= 0 && ordenados[j].instante >= inicio; j--) {
      soma += ordenados[j].valor;
      quantidade++;
    }
    return { instante: ponto.instante, valor: Math.round(soma / quantidade) };
  });
}

export function agruparPorDia<T>(itens: T[], instanteDe: (item: T) => number): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const dia = diaLocal(instanteDe(item));
    const atual = grupos.get(dia);
    if (atual) atual.push(item);
    else grupos.set(dia, [item]);
  }
  return grupos;
}
