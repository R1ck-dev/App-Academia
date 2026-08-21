/**
 * O caminho raro: digitar a carga em vez de andar de um incremento por toque.
 *
 * Serve dois casos — a estreia sem referência nenhuma (`sem_referencia`, quando
 * o botão vira "Informar carga") e o salto grande, em que somar de 2,5 em 2,5 kg
 * custaria mais toques que digitar. Não valida nada por conta própria:
 * `parseCarga` já sabe recusar o que não é número, com a frase certa.
 *
 * Fica centralizada, e não ancorada no rodapé como as outras folhas, mas sofre
 * do MESMO problema de teclado — daí usar `useAlturaDoTeclado` de `folha.tsx`.
 */

import { useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAlturaDoTeclado } from '@/components/folha';
import { alvo, cor, espaco, margem, raio, tipo } from '@/constants/tema';
import { formatarNumeroDaCarga, parseCarga, type Carga } from '@/dominio/carga';

export function TecladoDeCarga({
  visivel,
  inicial,
  aoConfirmar,
  aoCancelar,
}: {
  visivel: boolean;
  inicial: Carga | null;
  aoConfirmar: (carga: Carga) => void;
  aoCancelar: () => void;
}) {
  const [texto, setTexto] = useState(() => (inicial === null ? '' : formatarNumeroDaCarga(inicial)));
  const [erro, setErro] = useState<string | null>(null);
  const alturaDoTeclado = useAlturaDoTeclado();

  function confirmar() {
    const r = parseCarga(texto);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setErro(null);
    aoConfirmar(r.carga);
  }

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoCancelar}>
      <Pressable
        style={[estilos.fundo, { paddingBottom: margem.conteudo + alturaDoTeclado }]}
        // Com o teclado aberto o toque fora fecha só o teclado: cancelar aqui
        // jogaria fora a carga digitada por causa de um toque de dispensar.
        onPress={() => (alturaDoTeclado > 0 ? Keyboard.dismiss() : aoCancelar())}
      >
        <Pressable style={estilos.caixa} onPress={() => {}}>
          <Text style={estilos.titulo}>Carga em quilos</Text>
          <TextInput
            style={estilos.entrada}
            value={texto}
            onChangeText={(t) => {
              setTexto(t);
              setErro(null);
            }}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            placeholder="42,5"
            placeholderTextColor={cor.textoDesligado}
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(46,43,37,0.42)',
    justifyContent: 'center',
    padding: margem.conteudo,
  },
  caixa: {
    backgroundColor: cor.superficieElevada,
    borderRadius: raio.folha,
    padding: espaco.seis,
    gap: espaco.quatro,
  },
  titulo: { ...tipo.itemForte, color: cor.texto },
  entrada: {
    ...tipo.numeroMedio,
    color: cor.texto,
    backgroundColor: cor.superficie,
    borderRadius: raio.container,
    paddingHorizontal: espaco.quatro,
    paddingVertical: espaco.tres,
    textAlign: 'center',
  },
  erro: { ...tipo.corpoMenor, color: cor.acaoTexto },
  botoes: { flexDirection: 'row', gap: espaco.dois },
  botao: {
    flex: 1,
    minHeight: alvo.botaoSecundario,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: raio.pilula,
  },
  secundario: { borderWidth: 2, borderColor: cor.borda },
  primario: { backgroundColor: cor.acao },
  botaoTexto: { ...tipo.rotuloForte, color: cor.texto },
  botaoTextoPrimario: { color: cor.sobreAcao },
});
