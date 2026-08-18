/**
 * Átomos visuais das duas telas de leitura — Corpo e Histórico.
 *
 * Nenhuma regra de negócio nem formatação mora aqui: estes componentes recebem
 * TEXTO já formatado pelo domínio (`formatarPeso`, `formatarCarga`,
 * `formatarVariacao`, `formatarData`) e decidem só onde o pixel cai.
 *
 * O layout definitivo é do Claude Design; o que se compromete aqui é a
 * hierarquia (o número grande é o dado, o resto é contexto) e o alvo de toque.
 */

import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ALVO_TOQUE, cores, espacoLegado as espaco, tamanho as fonte } from '@/constants/tema';

export function Cartao({
  titulo,
  children,
}: {
  titulo?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={estilos.cartao}>
      {titulo ? <Text style={estilos.cartaoTitulo}>{titulo}</Text> : null}
      {children}
    </View>
  );
}

/** O dado principal do cartão: grande o bastante para ser lido de relance. */
export function Numero({
  valor,
  unidade,
  detalhe,
}: {
  valor: string;
  unidade?: string;
  detalhe?: string;
}) {
  return (
    <View>
      <View style={estilos.numeroLinha}>
        <Text style={estilos.numero}>{valor}</Text>
        {unidade ? <Text style={estilos.numeroUnidade}>{unidade}</Text> : null}
      </View>
      {detalhe ? <Text style={estilos.legenda}>{detalhe}</Text> : null}
    </View>
  );
}

/** Um dos números de estatística: rótulo em cima, valor grande, contexto embaixo. */
export function Estatistica({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <View style={estilos.estatistica}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Text style={estilos.estatisticaValor}>{valor}</Text>
      {detalhe ? <Text style={estilos.legenda}>{detalhe}</Text> : null}
    </View>
  );
}

export function Botao({
  texto,
  aoTocar,
  tipo = 'principal',
  desabilitado = false,
}: {
  texto: string;
  aoTocar: () => void;
  tipo?: 'principal' | 'secundario';
  desabilitado?: boolean;
}) {
  const principal = tipo === 'principal';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={desabilitado}
      onPress={aoTocar}
      style={({ pressed }) => [
        estilos.botao,
        principal ? estilos.botaoPrincipal : estilos.botaoSecundario,
        (pressed || desabilitado) && estilos.botaoApagado,
      ]}
    >
      <Text style={principal ? estilos.botaoTextoPrincipal : estilos.botaoTextoSecundario}>
        {texto}
      </Text>
    </Pressable>
  );
}

/**
 * Campo numérico com o botão ao lado e confirmação pelo teclado
 * (`onSubmitEditing`): registrar uma pesagem é digitar e confirmar, sem procurar
 * botão com o polegar depois de descer o teclado.
 */
export function CampoNumero({
  rotulo,
  valor,
  aoMudar,
  aoConfirmar,
  textoBotao,
  placeholder,
  sufixo,
  erro,
}: {
  rotulo?: string;
  valor: string;
  aoMudar: (texto: string) => void;
  aoConfirmar: () => void;
  textoBotao: string;
  placeholder?: string;
  sufixo?: string;
  erro?: string | null;
}) {
  return (
    <View style={estilos.campoBloco}>
      {rotulo ? <Text style={estilos.rotulo}>{rotulo}</Text> : null}
      <View style={estilos.linha}>
        <View style={estilos.campoCaixa}>
          <TextInput
            style={estilos.campo}
            value={valor}
            onChangeText={aoMudar}
            onSubmitEditing={aoConfirmar}
            placeholder={placeholder}
            placeholderTextColor={cores.textoFraco}
            keyboardType="decimal-pad"
            returnKeyType="done"
            inputMode="decimal"
          />
          {sufixo ? <Text style={estilos.campoSufixo}>{sufixo}</Text> : null}
        </View>
        <Botao texto={textoBotao} aoTocar={aoConfirmar} />
      </View>
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </View>
  );
}

export function Chip({
  texto,
  ativo,
  aoTocar,
}: {
  texto: string;
  ativo: boolean;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      onPress={aoTocar}
      style={[estilos.chip, ativo && estilos.chipAtivo]}
    >
      <Text style={ativo ? estilos.chipTextoAtivo : estilos.chipTexto}>{texto}</Text>
    </Pressable>
  );
}

/**
 * Barra de progresso. `percentual` null é estado próprio — barra vazia e barra
 * cheia mentem igual quando não se sabe de onde se partiu (ver
 * `progressoObjetivo`).
 */
export function Barra({ percentual }: { percentual: number | null }) {
  if (percentual === null) return <View style={estilos.barraFundo} />;
  return (
    <View style={estilos.barraFundo}>
      <View style={[estilos.barraCheia, { width: `${Math.min(100, Math.max(0, percentual))}%` }]} />
    </View>
  );
}

/** Piso de altura para uma série sem variação continuar visível como série. */
const ALTURA_MINIMA_PCT = 6;

/**
 * Série temporal em barras. Escala entre o MÍNIMO e o MÁXIMO do próprio
 * recorte, não a partir de zero: peso corporal entre 78 e 80 kg com eixo em zero
 * vira uma linha reta, e é justamente a variação que a tela existe para mostrar.
 * Por isso a legenda embaixo traz as duas pontas — barra alta sozinha não diz
 * quanto.
 */
export function Barras({
  valores,
  inicio,
  fim,
}: {
  valores: readonly number[];
  inicio?: string;
  fim?: string;
}) {
  if (valores.length === 0) return null;

  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const amplitude = maximo - minimo;

  return (
    <View style={estilos.graficoBloco}>
      <View style={estilos.grafico}>
        {valores.map((valor, i) => {
          const proporcao = amplitude === 0 ? 1 : (valor - minimo) / amplitude;
          const altura = ALTURA_MINIMA_PCT + proporcao * (100 - ALTURA_MINIMA_PCT);
          return (
            <View
              key={i}
              style={[estilos.barraGrafico, { height: `${altura}%` as `${number}%` }]}
            />
          );
        })}
      </View>
      {inicio || fim ? (
        <View style={estilos.graficoLegenda}>
          <Text style={estilos.legenda}>{inicio ?? ''}</Text>
          <Text style={estilos.legenda}>{fim ?? ''}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** O que falta para o número existir, ou por que ele não é confiável. */
export function Aviso({ texto }: { texto: string }) {
  return <Text style={estilos.aviso}>{texto}</Text>;
}

export function ItemLista({
  titulo,
  detalhe,
  valor,
  valorDetalhe,
  aoTocar,
  acao,
}: {
  titulo: string;
  detalhe?: string;
  valor?: string;
  valorDetalhe?: string;
  aoTocar?: () => void;
  acao?: React.ReactNode;
}) {
  const conteudo = (
    <>
      <View style={estilos.itemTexto}>
        <Text style={estilos.itemTitulo}>{titulo}</Text>
        {detalhe ? <Text style={estilos.legenda}>{detalhe}</Text> : null}
      </View>
      {valor ? (
        <View style={estilos.itemValor}>
          <Text style={estilos.itemValorTexto}>{valor}</Text>
          {valorDetalhe ? <Text style={estilos.legenda}>{valorDetalhe}</Text> : null}
        </View>
      ) : null}
      {acao}
    </>
  );

  if (aoTocar === undefined) return <View style={estilos.item}>{conteudo}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={aoTocar}
      style={({ pressed }) => [estilos.item, pressed && estilos.itemTocado]}
    >
      {conteudo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: 12,
    padding: espaco.md,
    gap: espaco.sm,
  },
  cartaoTitulo: { color: cores.textoFraco, fontSize: fonte.legenda, textTransform: 'uppercase' },
  numeroLinha: { flexDirection: 'row', alignItems: 'baseline', gap: espaco.xs },
  numero: { color: cores.texto, fontSize: fonte.numero, fontWeight: '700' },
  numeroUnidade: { color: cores.textoFraco, fontSize: fonte.corpo },
  rotulo: { color: cores.textoFraco, fontSize: fonte.legenda },
  legenda: { color: cores.textoFraco, fontSize: fonte.legenda },
  estatistica: { flexGrow: 1, flexBasis: '45%', gap: 2 },
  estatisticaValor: { color: cores.texto, fontSize: fonte.titulo, fontWeight: '600' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  botao: {
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco.md,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoPrincipal: { backgroundColor: cores.destaque },
  botaoSecundario: { borderWidth: 1, borderColor: cores.borda },
  botaoApagado: { opacity: 0.6 },
  botaoTextoPrincipal: { color: cores.fundo, fontSize: fonte.corpo, fontWeight: '700' },
  botaoTextoSecundario: { color: cores.texto, fontSize: fonte.corpo },
  campoBloco: { gap: espaco.xs },
  campoCaixa: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.xs,
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco.md,
    borderRadius: 10,
    backgroundColor: cores.superficieAlta,
  },
  campo: { flex: 1, color: cores.texto, fontSize: fonte.corpo },
  campoSufixo: { color: cores.textoFraco, fontSize: fonte.corpo },
  erro: { color: cores.alerta, fontSize: fonte.legenda },
  chip: {
    minHeight: ALVO_TOQUE - 12,
    justifyContent: 'center',
    paddingHorizontal: espaco.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  chipAtivo: { backgroundColor: cores.destaque, borderColor: cores.destaque },
  chipTexto: { color: cores.textoFraco, fontSize: fonte.legenda },
  chipTextoAtivo: { color: cores.fundo, fontSize: fonte.legenda, fontWeight: '700' },
  barraFundo: {
    height: 8,
    borderRadius: 4,
    backgroundColor: cores.superficieAlta,
    overflow: 'hidden',
  },
  barraCheia: { height: 8, backgroundColor: cores.destaque },
  graficoBloco: { gap: espaco.xs },
  grafico: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  barraGrafico: { flex: 1, minWidth: 2, borderRadius: 2, backgroundColor: cores.destaque },
  graficoLegenda: { flexDirection: 'row', justifyContent: 'space-between' },
  aviso: { color: cores.textoFraco, fontSize: fonte.legenda, lineHeight: 18 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    minHeight: ALVO_TOQUE,
    paddingVertical: espaco.sm,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  itemTocado: { opacity: 0.6 },
  itemTexto: { flex: 1, gap: 2 },
  itemTitulo: { color: cores.texto, fontSize: fonte.corpo },
  itemValor: { alignItems: 'flex-end', gap: 2 },
  itemValorTexto: { color: cores.texto, fontSize: fonte.corpo, fontWeight: '600' },
});
