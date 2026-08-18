/**
 * tema.ts — tokens da direção Organic aprovada para o app de academia.
 * Um único lugar para cor, tipo, espaço, raio e alvo de toque.
 * Não escreva hex nem px soltos nas telas; leia daqui.
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

  /** Terracota — AÇÃO. Só botão primário, curva, controle de aumentar. */
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

/** Tamanho / entrelinha em px. RN usa lineHeight absoluto. */
export const tipo = {
  numeroGrande: { fontFamily: fonte.display, fontSize: 84, lineHeight: 76 },
  tituloDeTela: { fontFamily: fonte.display, fontSize: 34, lineHeight: 35 },
  tituloDeTelaGrande: { fontFamily: fonte.display, fontSize: 40, lineHeight: 41 },
  nomeDoExercicio: { fontFamily: fonte.display, fontSize: 30, lineHeight: 32 },
  numeroMedio: { fontFamily: fonte.display, fontSize: 44, lineHeight: 46 },
  rotuloPrimario: { fontFamily: fonte.display, fontSize: 25, lineHeight: 28 },
  kicker: { fontFamily: fonte.corpoForte, fontSize: 11, lineHeight: 11, letterSpacing: 1.8, textTransform: 'uppercase' as const },
  itemForte: { fontFamily: fonte.corpoForte, fontSize: 17, lineHeight: 20 },
  rotuloForte: { fontFamily: fonte.corpoForte, fontSize: 14, lineHeight: 19 },
  corpo: { fontFamily: fonte.corpo, fontSize: 14, lineHeight: 21 },
  corpoMenor: { fontFamily: fonte.corpo, fontSize: 13, lineHeight: 20 },
  meta: { fontFamily: fonte.corpo, fontSize: 12, lineHeight: 18 },
} as const;

/** Escala do Organic (densidade 1.10×). */
export const espaco = { um: 4.4, dois: 8.8, tres: 13.2, quatro: 17.6, seis: 26.4, oito: 35.2 } as const;

/** Margens laterais usadas de fato. */
export const margem = { conteudo: 24, listaDeCartoes: 20 } as const;

export const raio = { pilula: 999, contêiner: 28, linhaDeLista: 24, folha: 34 } as const;

/** Nada abaixo de 44 no caminho do treino. */
export const alvo = {
  registrar: 96,
  aquecimento: 96,
  passoDeCarga: 70,
  passoDeReps: { largura: 44, altura: 40 },
  botaoSecundario: 52,
  botaoCompacto: 42,
  chip: 34,
  /** Cápsula da régua de séries; a largura é flex: 1. */
  capsulaDeSerie: 54,
} as const;

export const movimento = {
  /** O número da série voando até a fila de chips. */
  voo: { duracaoMs: 540, deslocamentoY: 232, escalaFinal: 0.22, easing: [0.4, 0, 0.2, 1] as const },
  descansoS: 90,
} as const;

export const grafico = {
  largura: 350,
  altura: 132,
  grade: cor.borda,
  gradeEspessura: 2,
  curva: cor.acao,
  curvaEspessura: 4,
  pontoRaio: 7,
  pontoPreenchimento: cor.fundo,
  /** Rótulos são texto comum posicionado sobre o SVG, não <text> dentro dele. */
  rotuloEixo: { cor: cor.textoTerciario, tamanho: 11 },
  rotuloData: { cor: cor.textoTerciario, tamanho: 10.5 },
} as const;

export const tema = { cor, fonte, tipo, espaco, margem, raio, alvo, movimento, grafico };
export default tema;
