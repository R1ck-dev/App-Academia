/**
 * Os três átomos que sobraram depois do redesenho: chip, aviso e linha de lista.
 *
 * Eram dez. Sete saíram junto com os cartões de Corpo que o handoff substituiu
 * por leitura corrida — número grande, cartão titulado, campo com botão ao lado,
 * barra de progresso. Quem ocupa o lugar deles hoje é o anel, a dupla linha do
 * peso e as folhas de digitar, todos desenhados para a direção Organic.
 *
 * Nenhuma regra de negócio nem formatação mora aqui: estes componentes recebem
 * TEXTO já formatado pelo domínio (`formatarPeso`, `formatarCarga`,
 * `formatarVariacao`, `formatarData`) e decidem só onde o pixel cai.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alvo, cor, espaco, raio, tipo } from '@/constants/tema';

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
}: {
  titulo: string;
  detalhe?: string;
  valor?: string;
  valorDetalhe?: string;
  aoTocar?: () => void;
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
  legenda: { ...tipo.meta, color: cor.textoTerciario },
  chip: {
    minHeight: alvo.chip,
    justifyContent: 'center',
    paddingHorizontal: espaco.quatro,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
  },
  chipAtivo: { backgroundColor: cor.acao, borderColor: cor.acao },
  chipTexto: { ...tipo.rotuloCompacto, color: cor.textoSecundario },
  chipTextoAtivo: { ...tipo.rotuloCompacto, color: cor.sobreAcao },
  aviso: { ...tipo.meta, color: cor.textoTerciario, paddingHorizontal: espaco.quatro },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.dois,
    minHeight: alvo.botaoSecundario,
    paddingVertical: espaco.dois,
    paddingHorizontal: espaco.quatro,
    borderRadius: raio.linhaDeLista,
    backgroundColor: cor.superficie,
  },
  itemTocado: { backgroundColor: cor.acaoTinta },
  itemTexto: { flex: 1, gap: 2 },
  itemTitulo: { ...tipo.corpo, color: cor.texto },
  itemValor: { alignItems: 'flex-end', gap: 2 },
  itemValorTexto: { ...tipo.rotuloForte, color: cor.acaoTexto },
});
