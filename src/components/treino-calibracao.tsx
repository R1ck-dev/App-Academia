/**
 * Calibrar a placa: dizer ao app quanto pesa UMA placa daquela máquina.
 *
 * O conceito que o desenho precisa carregar, e que a folha diz em uma linha:
 * **nada é reescrito**. Nenhuma série muda. A calibração é uma crença revisável
 * sobre a máquina, aplicada na LEITURA — por isso pode ser corrigida depois e o
 * histórico inteiro se corrige junto, e por isso o gráfico continua em placas.
 *
 * A conversão é aproximada porque alavanca e roldana não garantem que a
 * resistência seja proporcional ao número de placas. Daí o til em todo número
 * derivado dela, sem uma justificativa ao lado — o til é a justificativa.
 *
 * Mora no histórico daquela máquina, nunca durante o treino: ele não vai
 * procurar isto num menu, vai topar com isso no dia em que estiver olhando a
 * progressão da Cadeira Extensora.
 */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { cor, espaco, margem, raio, sombraDaFolha, tipo } from '@/constants/tema';
import { calibrarPlaca } from '@/db/mutations';
import { formatarPeso } from '@/dominio/carga';
import { calibrado, type Exercicio } from '@/dominio/exercicio';

/**
 * Os quatro pesos de placa que existem numa academia comum. Não é campo livre
 * de propósito: digitar "5" com o teclado numérico custa mais toques que tocar
 * em "5 kg", e a etiqueta da máquina quase nunca traz um valor fora destes.
 */
const PESOS_COMUNS_G = [2500, 5000, 7500, 10000] as const;

export function FolhaDeCalibracao({
  exercicio,
  aoFechar,
}: {
  exercicio: Exercicio;
  aoFechar: () => void;
}) {
  function escolher(gramas: number | null) {
    calibrarPlaca(exercicio.id, gramas);
    aoFechar();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={aoFechar}>
      <View style={estilos.fundo}>
        <Pressable style={estilos.area} onPress={aoFechar} />
        <View style={estilos.folha}>
          <Text style={estilos.titulo}>Quanto pesa cada placa?</Text>
          <Text style={estilos.texto}>Está na etiqueta da máquina.</Text>

          <View style={estilos.opcoes}>
            {PESOS_COMUNS_G.map((gramas) => {
              const ativo = exercicio.gramasPorPlaca === gramas;
              return (
                <Pressable
                  key={gramas}
                  style={[estilos.opcao, ativo && estilos.opcaoAtiva]}
                  onPress={() => escolher(gramas)}
                >
                  <Text style={ativo ? estilos.opcaoTextoAtivo : estilos.opcaoTexto}>
                    {formatarPeso(gramas)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={estilos.acoes}>
            <Pressable style={estilos.naoSei} onPress={aoFechar}>
              <Text style={estilos.naoSeiTexto}>Não sei</Text>
            </Pressable>
            {calibrado(exercicio) ? (
              <Pressable style={estilos.descalibrar} onPress={() => escolher(null)}>
                <Text style={estilos.descalibrarTexto}>descalibrar</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(46,43,37,0.5)', justifyContent: 'flex-end' },
  area: { flex: 1 },
  folha: {
    backgroundColor: cor.superficieElevada,
    borderTopLeftRadius: raio.folha,
    borderTopRightRadius: raio.folha,
    paddingHorizontal: margem.conteudo,
    paddingTop: espaco.seis,
    paddingBottom: espaco.oito,
    gap: espaco.dois,
    ...sombraDaFolha,
  },
  titulo: {
    fontFamily: tipo.nomeDoExercicio.fontFamily,
    fontSize: 26,
    lineHeight: 29,
    color: cor.texto,
  },
  texto: { ...tipo.corpoMenor, color: cor.textoSecundario },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.dois, marginTop: espaco.tres },
  opcao: {
    flexGrow: 1,
    flexBasis: 74,
    height: 56,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcaoAtiva: { backgroundColor: cor.info, borderColor: cor.info },
  opcaoTexto: { ...tipo.rotuloForte, fontSize: 16, color: cor.texto },
  opcaoTextoAtivo: { ...tipo.rotuloForte, fontSize: 16, color: cor.sobreAcao },
  acoes: { flexDirection: 'row', gap: espaco.dois, marginTop: espaco.tres },
  naoSei: {
    flex: 1,
    height: 52,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  naoSeiTexto: { ...tipo.rotuloForte, fontSize: 15, color: cor.textoSecundario },
  descalibrar: { height: 52, paddingHorizontal: espaco.quatro, justifyContent: 'center' },
  descalibrarTexto: { ...tipo.rotuloCompacto, fontSize: 13.5, color: cor.acaoTexto },
});
