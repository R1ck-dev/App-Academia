/**
 * O caminho raro: digitar a carga em vez de andar de um incremento por toque.
 *
 * Serve dois casos — a estreia sem referência nenhuma (`sem_referencia`, quando
 * o botão vira "Informar carga") e o salto grande, em que somar de 1 em 1 placa
 * custaria mais toques que digitar. Não valida nada por conta própria:
 * `parseCarga` já sabe recusar "5,5" numa máquina de placa com a frase certa.
 */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ALVO_TOQUE, cores, espaco, fonte } from '@/constants/tema';
import { formatarNumeroDaCarga, parseCarga, type Carga, type Unidade } from '@/dominio/carga';

export function TecladoDeCarga({
  visivel,
  unidade,
  inicial,
  aoConfirmar,
  aoCancelar,
}: {
  visivel: boolean;
  unidade: Unidade;
  inicial: Carga | null;
  aoConfirmar: (carga: Carga) => void;
  aoCancelar: () => void;
}) {
  const [texto, setTexto] = useState(() => (inicial === null ? '' : formatarNumeroDaCarga(inicial)));
  const [erro, setErro] = useState<string | null>(null);

  function confirmar() {
    const r = parseCarga(texto, unidade);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setErro(null);
    aoConfirmar(r.carga);
  }

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoCancelar}>
      <View style={estilos.fundo}>
        <View style={estilos.caixa}>
          <Text style={estilos.titulo}>
            Carga em {unidade === 'kg' ? 'quilos' : 'placas'}
          </Text>
          <TextInput
            style={estilos.entrada}
            value={texto}
            onChangeText={(t) => {
              setTexto(t);
              setErro(null);
            }}
            // `decimal-pad` mesmo em placa: o teclado numérico do Android não tem
            // como recusar a vírgula, e quem recusa com a frase que explica é o
            // `parseCarga`.
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            placeholder={unidade === 'kg' ? '42,5' : '5'}
            placeholderTextColor={cores.textoFraco}
            onSubmitEditing={confirmar}
          />
          {erro === null ? null : <Text style={estilos.erro}>{erro}</Text>}
          <View style={estilos.botoes}>
            <Pressable style={[estilos.botao, estilos.secundario]} onPress={aoCancelar}>
              <Text style={estilos.botaoTexto}>Cancelar</Text>
            </Pressable>
            <Pressable style={[estilos.botao, estilos.primario]} onPress={confirmar}>
              <Text style={[estilos.botaoTexto, estilos.botaoTextoPrimario]}>Usar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'center',
    padding: espaco.lg,
  },
  caixa: {
    backgroundColor: cores.superficie,
    borderRadius: 16,
    padding: espaco.lg,
    gap: espaco.md,
  },
  titulo: { color: cores.texto, fontSize: fonte.corpo, fontWeight: '600' },
  entrada: {
    color: cores.texto,
    fontSize: fonte.numero,
    backgroundColor: cores.superficieAlta,
    borderRadius: 12,
    paddingHorizontal: espaco.md,
    paddingVertical: espaco.sm,
    textAlign: 'center',
  },
  erro: { color: cores.alerta, fontSize: fonte.legenda },
  botoes: { flexDirection: 'row', gap: espaco.sm },
  botao: {
    flex: 1,
    minHeight: ALVO_TOQUE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  secundario: { backgroundColor: cores.superficieAlta },
  primario: { backgroundColor: cores.destaque },
  botaoTexto: { color: cores.texto, fontSize: fonte.corpo, fontWeight: '600' },
  botaoTextoPrimario: { color: cores.fundo },
});
