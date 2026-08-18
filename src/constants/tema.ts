/**
 * Os tokens da direção **Organic**, aprovada no handoff do Claude Design.
 *
 * Fundo claro e quente; **terracota é ação** (botão primário, curva, o "+");
 * **sálvia é informação** (aquecimento, calibração, aviso frio). As duas nunca
 * no mesmo componente pequeno — é a regra que dá sentido à cor neste app: se
 * terracota aparecer decorando, o dedo perde a referência de onde tocar.
 *
 * O tema escuro anterior existia porque a academia tem luz ruim. O desenho
 * aprovado inverte a aposta: contraste alto sobre creme lê melhor sob sol
 * direto, que é o caso real da janela do fundo.
 *
 * Não escreva hex nem px solto nas telas — leia daqui. Os valores são finais e
 * vieram medidos do protótipo; a escala de espaço é a do Organic (densidade
 * 1,10×), por isso os números quebrados.
 */

export const cor = {
  fundo: '#f5ead8',
  superficie: '#ebddc5',
  superficieElevada: '#f9f4ed',

  texto: '#201e1d',
  textoSecundario: '#645c50',
  textoTerciario: '#82796a',
  textoDesligado: '#a19786',
  /** Série ainda não feita: número e borda tracejada da cápsula vazia. */
  textoFantasma: '#bdb3a2',
  bordaFantasma: '#d2c8b7',

  borda: '#dcd3c4',
  bordaFraca: '#c0b6a5',

  /** Terracota — AÇÃO. Só botão primário, curva e controle de aumentar. */
  acao: '#c67139',
  acaoPressionada: '#b2622d',
  acaoTexto: '#8c491a',
  acaoTinta: '#ffe1d0',
  acaoTintaTexto: '#643312',
  acaoContorno: '#f6a06b',

  /** Sálvia — INFORMAÇÃO. Aquecimento, calibração, avisos frios. */
  info: '#7a8a5e',
  infoPressionada: '#728157',
  infoBorda: '#aebf92',
  infoTinta: '#e1eecc',
  infoTintaTexto: '#56633f',
  infoTintaTextoForte: '#3d472b',
  infoKicker: '#728157',

  /** Sobre preenchimento terracota ou sálvia. */
  sobreAcao: '#f9f4ed',
} as const;

export const fonte = {
  display: 'Caprasimo_400Regular',
  corpo: 'Figtree_400Regular',
  corpoForte: 'Figtree_700Bold',
} as const;

/**
 * Tamanho e entrelinha em px — o RN quer `lineHeight` absoluto, então os
 * multiplicadores do handoff já vêm resolvidos.
 *
 * Caprasimo é a ÚNICA voz de display. Nada de condensada nem geométrica: a
 * massa daquele número de 84 é metade do desenho da tela de execução.
 */
export const tipo = {
  numeroGrande: { fontFamily: fonte.display, fontSize: 84, lineHeight: 76 },
  tituloDeTela: { fontFamily: fonte.display, fontSize: 34, lineHeight: 35 },
  tituloDeTelaGrande: { fontFamily: fonte.display, fontSize: 40, lineHeight: 41 },
  nomeDoExercicio: { fontFamily: fonte.display, fontSize: 30, lineHeight: 32 },
  numeroMedio: { fontFamily: fonte.display, fontSize: 44, lineHeight: 46 },
  numeroPequeno: { fontFamily: fonte.display, fontSize: 21, lineHeight: 21 },
  rotuloPrimario: { fontFamily: fonte.display, fontSize: 25, lineHeight: 28 },
  kicker: {
    fontFamily: fonte.corpoForte,
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
  },
  itemForte: { fontFamily: fonte.corpoForte, fontSize: 17, lineHeight: 20 },
  rotuloForte: { fontFamily: fonte.corpoForte, fontSize: 14, lineHeight: 19 },
  rotuloCompacto: { fontFamily: fonte.corpoForte, fontSize: 12.5, lineHeight: 16 },
  corpo: { fontFamily: fonte.corpo, fontSize: 14, lineHeight: 21 },
  corpoMenor: { fontFamily: fonte.corpo, fontSize: 13, lineHeight: 20 },
  meta: { fontFamily: fonte.corpo, fontSize: 12, lineHeight: 18 },
  metaMenor: { fontFamily: fonte.corpo, fontSize: 11.5, lineHeight: 16 },
} as const;

/** Escala do Organic (densidade 1,10×). */
export const espaco = {
  um: 4.4,
  dois: 8.8,
  tres: 13.2,
  quatro: 17.6,
  seis: 26.4,
  oito: 35.2,
} as const;

/** Margens laterais usadas de fato — o conteúdo respira mais que a lista. */
export const margem = { conteudo: 24, listaDeCartoes: 20 } as const;

export const raio = { pilula: 999, container: 28, linhaDeLista: 24, folha: 34 } as const;

/** Nada abaixo de 44 no caminho do treino: é o dedo de pé, com a mão suada. */
export const alvo = {
  registrar: 96,
  aquecimento: 96,
  passoDeCarga: 70,
  passoDeReps: { largura: 44, altura: 40 },
  botaoSecundario: 52,
  botaoCompacto: 42,
  chip: 34,
  /** Cápsula da régua de séries; a largura é `flex: 1`. */
  capsulaDeSerie: 54,
} as const;

export const movimento = {
  /** O número da série voando até a régua. É a única animação do app. */
  voo: { duracaoMs: 540, deslocamentoY: 232, escalaFinal: 0.22 },
} as const;

/**
 * A sombra existe em um lugar só: a folha que sobe. No resto a hierarquia vem
 * do raio e da cor — empilhar sombra em fundo creme suja a tela inteira.
 */
export const sombraDaFolha = {
  shadowColor: '#2e2b25',
  shadowOpacity: 0.14,
  shadowRadius: 32,
  shadowOffset: { width: 0, height: -12 },
  elevation: 16,
} as const;

export const grafico = {
  altura: 132,
  grade: cor.borda,
  gradeEspessura: 2,
  curva: cor.acao,
  curvaEspessura: 4,
  pontoRaio: 7,
  pontoPreenchimento: cor.fundo,
} as const;

// ── Transição ──────────────────────────────────────────────────────────────
// As telas de Histórico e Corpo ainda têm o LAYOUT antigo; só a paleta mudou,
// para não existir uma aba escura dentro de um app creme. Estes apelidos somem
// quando elas forem redesenhadas — não use nenhum deles em código novo.

/** @deprecated Use `cor`. */
export const cores = {
  fundo: cor.fundo,
  superficie: cor.superficie,
  superficieAlta: cor.superficieElevada,
  borda: cor.borda,
  texto: cor.texto,
  textoFraco: cor.textoTerciario,
  destaque: cor.acao,
  /** O Organic não tem vermelho. Erro fala na tinta mais escura da ação. */
  alerta: cor.acaoTexto,
} as const;

/** @deprecated Use `tipo`, que traz família e entrelinha junto do tamanho. */
export const tamanho = { numero: 34, titulo: 22, corpo: 16, legenda: 13 } as const;

/** @deprecated Use `alvo`. */
export const ALVO_TOQUE = 48;

/** @deprecated Use `espaco` com as chaves da escala nova. */
export const espacoLegado = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
