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

const DIAS_DA_SEMANA = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/**
 * "Segunda · 17 de agosto" — o cabeçalho de quem abre o app para treinar.
 *
 * Escrito à mão em vez de `toLocaleDateString`: o `Intl` do Hermes vem sem os
 * dados de locale em build de release, e a mesma chamada que devolve "segunda"
 * no simulador devolve "Monday" no aparelho.
 */
export function rotuloDoDiaLongo(instante: number): string {
  const d = new Date(instante);
  return `${DIAS_DA_SEMANA[d.getDay()]} · ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * Quantos dias LOCAIS separam os dois instantes.
 *
 * Conta a distância entre as datas, não entre os relógios: treinar às 22h de
 * ontem e olhar às 8h de hoje são 10 horas e **um** dia — `Math.floor` sobre a
 * diferença bruta responderia zero, e a tela diria "hoje" para o treino de
 * ontem.
 */
export function diasEntreDias(instante: number, agora: number): number {
  const de = new Date(instante);
  const ate = new Date(agora);
  const meiaNoiteDe = new Date(de.getFullYear(), de.getMonth(), de.getDate()).getTime();
  const meiaNoiteAte = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate()).getTime();
  return Math.round((meiaNoiteAte - meiaNoiteDe) / MS_DIA);
}

/**
 * "hoje" · "ontem" · "há 3 dias" · "nunca" — o que o cartão do treino mostra à
 * direita. Data futura (relógio do aparelho mexido) vira "hoje" em vez de "há
 * −2 dias".
 */
export function rotuloDeQuandoFoi(instante: number | null, agora: number): string {
  if (instante === null) return 'nunca';
  const dias = diasEntreDias(instante, agora);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
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
