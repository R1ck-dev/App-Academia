/**
 * A moldura comum: área segura, fundo creme, e o cabeçalho kicker + título.
 *
 * O kicker em sálvia acima de um título em Caprasimo é a assinatura do sistema
 * — a mesma abertura em toda tela que não é a de execução, que tem cabeçalho
 * próprio porque lá o espaço vertical é do número.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cor, espaco, margem, tipo } from '@/constants/tema';

export function Tela({
  titulo,
  kicker,
  children,
}: {
  titulo: string;
  kicker?: string;
  children?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={estilos.area} edges={['top', 'left', 'right']}>
      <View style={estilos.cabecalho}>
        {kicker === undefined ? null : <Text style={estilos.kicker}>{kicker}</Text>}
        <Text style={estilos.titulo}>{titulo}</Text>
      </View>
      {children}
    </SafeAreaView>
  );
}

/** Estado vazio: diz o que fazer, não só que não há nada. */
export function Vazio({ mensagem, acao }: { mensagem: string; acao?: string }) {
  return (
    <View style={estilos.vazio}>
      <Text style={estilos.vazioTexto}>{mensagem}</Text>
      {acao ? <Text style={estilos.vazioAcao}>{acao}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { flex: 1, backgroundColor: cor.fundo },
  cabecalho: {
    paddingHorizontal: margem.conteudo,
    paddingTop: espaco.tres,
    paddingBottom: espaco.quatro,
    gap: espaco.dois,
  },
  kicker: { ...tipo.kicker, color: cor.infoKicker },
  titulo: { ...tipo.tituloDeTela, color: cor.texto },
  vazio: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: espaco.dois,
    paddingHorizontal: margem.conteudo,
  },
  vazioTexto: { ...tipo.corpo, color: cor.textoSecundario, textAlign: 'center' },
  vazioAcao: { ...tipo.rotuloForte, color: cor.acaoTexto, textAlign: 'center' },
});
