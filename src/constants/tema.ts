/**
 * Tema escuro fixo: o app é usado na academia, muitas vezes com luz forte ou
 * pouca, e alternar tema é decisão que não paga o custo agora. Números grandes e
 * contraste alto porque a tela é lida de relance, entre séries.
 */

export const cores = {
  fundo: '#0B0D10',
  superficie: '#151A20',
  superficieAlta: '#1E252E',
  borda: '#2A323C',
  texto: '#F2F5F8',
  textoFraco: '#9AA5B1',
  destaque: '#4ADE80',
  alerta: '#F87171',
} as const;

export const espaco = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const fonte = {
  numero: 34,
  titulo: 22,
  corpo: 16,
  legenda: 13,
} as const;

/** Mínimo confortável para o dedo com o celular na mão, de pé. */
export const ALVO_TOQUE = 48;
