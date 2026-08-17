/**
 * Agrupamento por dia e média móvel.
 *
 * A pegadinha: treino que começa 23h40 e termina 0h20 são duas datas diferentes.
 * O dia usado é o **fuso local do aparelho** sobre o **instante de início** — é o
 * que corresponde ao que o Henrique chama de "o treino de ontem".
 */

/** "2026-08-16" no fuso local. Chave de agrupamento, não de exibição. */
export function diaLocal(instante: number): string {
  const d = new Date(instante);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
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
