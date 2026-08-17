/**
 * A tela de execução: a ficha do dia, em ordem, com o botão que grava a próxima
 * série em UM toque.
 *
 * Não há estado de sessão em memória. Cada série é uma linha commitada, e a tela
 * inteira é `planoDaSessao(sessaoId)` — app morto, bateria acabada ou celular
 * reiniciado dão no mesmo: reabrir reconstrói tudo, inclusive o exercício em que
 * ele estava e o cronômetro de descanso.
 */

import { useKeepAwake } from 'expo-keep-awake';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CartaoDoExercicio } from '@/components/treino-cartao';
import { Tela, Vazio } from '@/components/tela';
import { usePlanoDaSessao } from '@/components/treino-dados';
import { ALVO_TOQUE, cores, espaco, fonte } from '@/constants/tema';
import { finalizarSessao } from '@/db/mutations';

export function TelaSessao({
  sessaoId,
  aoFinalizar,
}: {
  sessaoId: string;
  aoFinalizar: (sessaoId: string) => void;
}) {
  // A tela fica ligada durante o treino: bloquear o celular a cada série e
  // desbloquear com a mão suada é o atrito que manda ele de volta pro papel.
  useKeepAwake();
  const plano = usePlanoDaSessao(sessaoId);

  if (plano === null) {
    return (
      <Tela titulo="Treino">
        <Vazio mensagem="Esta sessão não existe mais." acao="Volte e escolha um treino." />
      </Tela>
    );
  }

  function finalizar() {
    if (plano === null) return;
    const faltando = plano.seriesFaltando;
    const encerrar = () => {
      finalizarSessao(sessaoId);
      aoFinalizar(sessaoId);
    };
    if (faltando === 0) {
      encerrar();
      return;
    }
    Alert.alert(
      'Finalizar assim?',
      `Ainda faltam ${faltando} ${faltando === 1 ? 'série' : 'séries'} do plano.`,
      [
        { text: 'Continuar treinando', style: 'cancel' },
        { text: 'Finalizar', style: 'destructive', onPress: encerrar },
      ]
    );
  }

  return (
    <Tela titulo={plano.sessao.nome}>
      <View style={estilos.cabecalho}>
        <Text style={estilos.contagem}>
          {plano.seriesFeitas} de {plano.seriesAlvo} séries
        </Text>
        <Text style={estilos.faltam}>
          {plano.seriesFaltando === 0 ? 'plano completo' : `faltam ${plano.seriesFaltando}`}
        </Text>
      </View>

      <ScrollView
        style={estilos.rolagem}
        contentContainerStyle={estilos.lista}
        keyboardShouldPersistTaps="handled"
      >
        {plano.itens.length === 0 ? (
          <Vazio
            mensagem="Esta sessão não tem exercícios."
            acao="Monte a ficha deste treino para registrar séries."
          />
        ) : (
          plano.itens.map((item) => (
            <CartaoDoExercicio
              // `itemId` e não o id do exercício: bi-set repete o mesmo exercício
              // na ficha, e duas linhas com a mesma key embaralham o estado local.
              key={item.itemId}
              sessaoId={sessaoId}
              item={item}
              atual={plano.itemAtual?.itemId === item.itemId}
            />
          ))
        )}

        <Pressable style={estilos.finalizar} onPress={finalizar}>
          <Text style={estilos.finalizarTexto}>Finalizar treino</Text>
        </Pressable>
      </ScrollView>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  contagem: { color: cores.texto, fontSize: fonte.corpo, fontWeight: '600' },
  faltam: { color: cores.textoFraco, fontSize: fonte.legenda },
  // A rolagem precisa de `flex: 1` explícito: sem ele o ScrollView cresce com o
  // conteúdo e a lista de 8 exercícios estoura a tela em vez de rolar.
  rolagem: { flex: 1 },
  lista: { gap: espaco.md, paddingBottom: espaco.xl },
  finalizar: {
    minHeight: ALVO_TOQUE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalizarTexto: { color: cores.texto, fontSize: fonte.corpo, fontWeight: '600' },
});
