/**
 * A tela que impede o projeto de acabar mal.
 *
 * Não há servidor: **o banco dentro do celular é o único exemplar do histórico
 * dele**. Se o aparelho sumir, molhar ou for formatado sem backup, some junto o
 * registro de carga e de peso — que é justamente o que dá valor a este app
 * depois de seis meses de uso.
 *
 * O aviso diz o risco em NÚMERO ("desde então: 14 sessões e 9 pesagens que só
 * existem neste aparelho") em vez de vermelho de alarme. Um app que grita
 * vermelho toda abertura ensina o usuário a ignorar vermelho — e o lembrete de
 * verdade nem mora aqui, mora em uma linha na tela de abertura.
 *
 * Restaurar é a operação mais destrutiva do app e por isso é a que menos confia
 * no toque: escolher o arquivo apenas LÊ e valida; substituir o banco só
 * acontece depois de um diálogo que conta o que existe hoje.
 */

import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConsulta } from '@/components/progresso-consulta';
import { cor, espaco, margem, raio, tipo } from '@/constants/tema';
import { contarLinhas, restaurarBackup, type Backup } from '@/db/exportar-dados';
import { escolherBackup, exportarBackup, registrarBackupFeito, ultimoBackupEm } from '@/db/exportar';
import { formatarData, rotuloDeQuandoFoi } from '@/dominio/datas';

export function TelaDeBackup({ aoVoltar }: { aoVoltar: () => void }) {
  const [ocupado, setOcupado] = useState(false);

  const estado = useConsulta('Backup', () => ({
    ultimo: ultimoBackupEm(),
    contagem: contarLinhas(),
  }));

  async function exportar() {
    setOcupado(true);
    const r = await exportarBackup();
    setOcupado(false);
    if ('cancelado' in r) return;
    if (!r.ok) Alert.alert('Não deu para exportar', r.erro);
  }

  async function escolher() {
    setOcupado(true);
    const r = await escolherBackup();
    setOcupado(false);
    if ('cancelado' in r) return;
    if (!r.ok) {
      Alert.alert('Este arquivo não serve', r.erro);
      return;
    }
    confirmarRestauracao(r.backup, estado.contagem);
  }

  function confirmarRestauracao(backup: Backup, contagem: ReturnType<typeof contarLinhas>) {
    Alert.alert(
      'Restaurar apaga o que está aqui',
      `Neste aparelho existem ${contagem.sessoes} ${contagem.sessoes === 1 ? 'sessão' : 'sessões'} e ${contagem.pesagens} ${contagem.pesagens === 1 ? 'pesagem' : 'pesagens'}. Não há como voltar.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: () => {
            try {
              restaurarBackup(backup);
              // O aparelho passa a ter exatamente o conteúdo daquele arquivo,
              // então o backup mais recente é o próprio arquivo restaurado.
              registrarBackupFeito(backup.geradoEm);
              Alert.alert('Pronto', 'Seus dados foram restaurados.');
            } catch (e) {
              Alert.alert(
                'Não deu para restaurar',
                `Nada foi alterado. ${e instanceof Error ? e.message : String(e)}`
              );
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={estilos.area} edges={['top', 'left', 'right']}>
      <View style={estilos.cabecalho}>
        <View style={estilos.linhaDoTopo}>
          <Text style={estilos.titulo}>Backup</Text>
          <Pressable onPress={aoVoltar} hitSlop={12}>
            <Text style={estilos.voltar}>voltar</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={estilos.expandir} contentContainerStyle={estilos.conteudo}>
        <View style={estilos.aviso}>
          <Text style={estilos.avisoTitulo}>
            {estado.ultimo === null
              ? 'Nenhum backup ainda'
              : `Último backup: ${formatarData(estado.ultimo)}`}
          </Text>
          <Text style={estilos.avisoTexto}>{textoDoRisco(estado.ultimo, estado.contagem)}</Text>
        </View>

        <Pressable
          disabled={ocupado}
          style={({ pressed }) => [
            estilos.exportar,
            (pressed || ocupado) && estilos.exportarTocado,
          ]}
          onPress={exportar}
        >
          <Text style={estilos.exportarTexto}>Exportar tudo</Text>
        </Pressable>
      </ScrollView>

      <View style={estilos.rodape}>
        <Text style={estilos.rodapeTexto}>Restaurar substitui tudo neste aparelho.</Text>
        <Pressable
          disabled={ocupado}
          style={({ pressed }) => [estilos.restaurar, pressed && estilos.restaurarTocado]}
          onPress={escolher}
        >
          <Text style={estilos.restaurarTexto}>Restaurar de um arquivo</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** O risco em número, que é o que faz o aviso significar alguma coisa. */
function textoDoRisco(
  ultimo: number | null,
  contagem: { sessoes: number; pesagens: number }
): string {
  const conteudo = `${contagem.sessoes} ${contagem.sessoes === 1 ? 'sessão' : 'sessões'} e ${contagem.pesagens} ${contagem.pesagens === 1 ? 'pesagem' : 'pesagens'}`;
  if (ultimo === null) {
    return `Existem ${conteudo} que só existem neste aparelho. Se ele sumir, some junto.`;
  }
  return `${maiuscula(rotuloDeQuandoFoi(ultimo, Date.now()))}. Neste aparelho: ${conteudo}.`;
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const estilos = StyleSheet.create({
  /** A rolagem cede o espaço do rodapé fixo em vez de empurrá-lo para fora. */
  expandir: { flex: 1 },
  area: { flex: 1, backgroundColor: cor.fundo },
  cabecalho: { paddingHorizontal: margem.conteudo, paddingTop: espaco.tres },
  linhaDoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.dois,
  },
  titulo: { ...tipo.tituloDeTela, color: cor.texto },
  voltar: { ...tipo.rotuloCompacto, fontSize: 13, color: cor.acaoTexto },

  conteudo: { paddingHorizontal: margem.conteudo, paddingTop: espaco.seis },
  aviso: {
    padding: espaco.seis,
    borderRadius: raio.container,
    backgroundColor: cor.acaoTinta,
    gap: espaco.dois,
  },
  avisoTitulo: {
    fontFamily: tipo.numeroMedio.fontFamily,
    fontSize: 24,
    lineHeight: 27,
    color: cor.acaoTexto,
  },
  avisoTexto: { ...tipo.corpoMenor, color: cor.acaoTintaTexto },

  exportar: {
    height: 70,
    marginTop: espaco.quatro,
    borderRadius: raio.pilula,
    backgroundColor: cor.acao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportarTocado: { backgroundColor: cor.acaoPressionada },
  exportarTexto: { ...tipo.rotuloPrimario, fontSize: 21, color: cor.sobreAcao },

  rodape: {
    paddingHorizontal: margem.conteudo,
    paddingBottom: espaco.seis,
    gap: espaco.tres,
  },
  rodapeTexto: { ...tipo.corpoMenor, color: cor.textoSecundario },
  restaurar: {
    height: 52,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurarTocado: { backgroundColor: cor.acaoTinta },
  restaurarTexto: { ...tipo.rotuloForte, fontSize: 15, color: cor.texto },
});
