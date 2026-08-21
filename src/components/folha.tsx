/**
 * A folha que sobe do rodapé, e o motivo de ela existir num arquivo só.
 *
 * ## O bug que ela conserta
 *
 * Toda folha do app é ancorada em `justifyContent: 'flex-end'`, e o teclado do
 * Android subia POR CIMA dela: o campo sumia, o botão "Salvar" ficava
 * inalcançável, e o toque para dispensar o teclado caía no backdrop — que
 * fechava a folha **descartando o que tinha sido digitado, sem aviso**. Era essa
 * a explicação de "peso e altura não salvam na primeira vez".
 *
 * A causa é o edge-to-edge, obrigatório desde o SDK 54: o Android passa a
 * IGNORAR `adjustResize`, então a janela não encolhe mais quando o teclado
 * aparece. O React Native ainda chama `setSoftInputMode(ADJUST_RESIZE)` no
 * Dialog do `Modal`, mas a chamada virou no-op — nada acontece, e nada avisa.
 * Quem quiser fugir do teclado tem que consultar a altura dele e sair da frente.
 *
 * ## As três decisões
 *
 * 1. **O backdrop não descarta com o teclado aberto.** Ele fecha o teclado
 *    primeiro; fechar a folha exige um segundo toque, agora com o conteúdo à
 *    vista. Perder o que foi digitado nunca pode ser o efeito de um toque só.
 * 2. **O conteúdo rola.** A folha do item da ficha tem cinco campos e não cabe
 *    em tela pequena com o teclado aberto. `maxHeight` sem rolagem cortaria o
 *    botão em vez de deixá-lo alcançável.
 * 3. **`keyboardDidShow`, não `keyboardWillShow`, no Android** — o `will` só
 *    existe no iOS, e ouvir os dois faria a folha pular duas vezes.
 */

import { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { cor, espaco, margem, raio, sombraDaFolha } from '@/constants/tema';

/**
 * A altura que o teclado ocupa agora, em pixels independentes de densidade, ou
 * zero quando ele está fechado. É o número que tira a folha da frente dele.
 */
export function useAlturaDoTeclado(): number {
  const [altura, setAltura] = useState(0);

  useEffect(() => {
    // O iOS tem os eventos `will*`, que acompanham a animação; o Android só tem
    // os `did*`. Ouvir os quatro faria o iOS reagir duas vezes ao mesmo teclado.
    const aoAbrir = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const aoFechar = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const abriu = Keyboard.addListener(aoAbrir, (e) => setAltura(e.endCoordinates.height));
    const fechou = Keyboard.addListener(aoFechar, () => setAltura(0));
    return () => {
      abriu.remove();
      fechou.remove();
    };
  }, []);

  return altura;
}

export function Folha({ aoFechar, children }: { aoFechar: () => void; children: React.ReactNode }) {
  const alturaDoTeclado = useAlturaDoTeclado();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={aoFechar}>
      <View style={estilos.fundo}>
        <Pressable
          style={estilos.area}
          onPress={() => (alturaDoTeclado > 0 ? Keyboard.dismiss() : aoFechar())}
        />
        <View style={[estilos.folha, { paddingBottom: espaco.oito + alturaDoTeclado }]}>
          <ScrollView
            // `handled` para o toque em "Salvar" chegar ao botão em vez de ser
            // consumido só para fechar o teclado — seria um toque desperdiçado
            // exatamente onde ele custa mais.
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={estilos.conteudo}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(46,43,37,0.5)', justifyContent: 'flex-end' },
  area: { flex: 1 },
  folha: {
    // Teto para a folha nunca virar tela cheia sem borda: o fundo escurecido
    // acima dela é o que diz "isto fecha e você volta para onde estava".
    maxHeight: '86%',
    backgroundColor: cor.superficieElevada,
    borderTopLeftRadius: raio.folha,
    borderTopRightRadius: raio.folha,
    ...sombraDaFolha,
  },
  conteudo: {
    paddingHorizontal: margem.conteudo,
    paddingTop: espaco.seis,
    gap: espaco.dois,
  },
});
