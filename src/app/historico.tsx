/**
 * Aba Histórico: as sessões recentes e a progressão de carga por exercício.
 *
 * Duas perguntas diferentes, dois modos: "o que eu treinei" (sessões) e "estou
 * evoluindo neste exercício" (lista de exercícios → série temporal). Empilhar as
 * duas numa rolagem só faria a segunda começar depois de vinte sessões.
 *
 * A tela só orquestra: consulta vem de `queries.ts`, recorde e agrupamento vêm do
 * domínio.
 */

import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/progresso-base';
import { useSinalDeEscrita } from '@/components/progresso-consulta';
import { ProgressoDoExercicio, ProgressoExercicios } from '@/components/progresso-exercicios';
import { ProgressoSessoes } from '@/components/progresso-sessoes';
import { Tela } from '@/components/tela';
import { espaco } from '@/constants/tema';
import { historicoDoExercicio, listarExercicios, sessoesFinalizadas } from '@/db/queries';
import { exercicios, series, sessoes } from '@/db/schema';

/** O histórico é para olhar, não para rolar: além disso é arqueologia. */
const SESSOES_NA_LISTA = 30;
/** Séries do exercício: ~4 por sessão, então 200 cobrem um ano de treino dele. */
const SERIES_NO_DETALHE = 200;

type Modo = 'sessoes' | 'exercicios';

export default function Historico() {
  const sinal = useSinalDeEscrita([series, sessoes, exercicios]);
  const [modo, setModo] = useState<Modo>('sessoes');
  const [exercicioId, setExercicioId] = useState<string | null>(null);

  const dados = useMemo(
    () => ({
      sessoes: sessoesFinalizadas(SESSOES_NA_LISTA),
      exercicios: listarExercicios(),
    }),
    [sinal]
  );

  // Consultado à parte: o detalhe é de UM exercício e só existe quando há um
  // escolhido — carregá-lo junto da lista seria 24 históricos por render.
  const detalhe = useMemo(
    () => (exercicioId === null ? null : historicoDoExercicio(exercicioId, SERIES_NO_DETALHE)),
    [sinal, exercicioId]
  );

  if (detalhe !== null) {
    return (
      <Tela titulo={detalhe.exercicio.nome}>
        <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.conteudo}>
          <ProgressoDoExercicio historico={detalhe} aoVoltar={() => setExercicioId(null)} />
        </ScrollView>
      </Tela>
    );
  }

  return (
    <Tela titulo="Histórico">
      <View style={estilos.chips}>
        <Chip texto="Sessões" ativo={modo === 'sessoes'} aoTocar={() => setModo('sessoes')} />
        <Chip
          texto="Exercícios"
          ativo={modo === 'exercicios'}
          aoTocar={() => setModo('exercicios')}
        />
      </View>

      <ScrollView contentContainerStyle={estilos.conteudo}>
        {modo === 'sessoes' ? (
          <ProgressoSessoes sessoes={dados.sessoes} />
        ) : (
          <ProgressoExercicios exercicios={dados.exercicios} aoEscolher={setExercicioId} />
        )}
      </ScrollView>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', gap: espaco.sm },
  // Sem `flex: 1` a ScrollView cresce com o conteúdo e para de rolar dentro da
  // coluna da `Tela` — a 30ª sessão fica inalcançável.
  rolagem: { flex: 1 },
  conteudo: { gap: espaco.md, paddingBottom: espaco.xl },
});
