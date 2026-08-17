import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cores, espaco, fonte } from '@/constants/tema';

export function Tela({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <SafeAreaView style={estilos.area}>
      <Text style={estilos.titulo}>{titulo}</Text>
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
  area: { flex: 1, backgroundColor: cores.fundo, padding: espaco.lg, gap: espaco.md },
  titulo: { color: cores.texto, fontSize: fonte.titulo, fontWeight: '700' },
  vazio: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: espaco.sm },
  vazioTexto: { color: cores.textoFraco, fontSize: fonte.corpo, textAlign: 'center' },
  vazioAcao: { color: cores.destaque, fontSize: fonte.corpo, textAlign: 'center' },
});
