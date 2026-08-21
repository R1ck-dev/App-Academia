/**
 * Aba Histórico: as sessões recentes e a progressão de carga por exercício.
 *
 * Duas perguntas diferentes, dois modos: "o que eu treinei" (sessões) e "estou
 * evoluindo neste exercício" (chips → série temporal). Empilhar as duas numa
 * rolagem só faria a segunda começar depois de vinte sessões.
 *
 * A tela só orquestra: consulta vem de `queries.ts`, recorde e agrupamento vêm
 * do domínio. E é daqui — do histórico da própria máquina — que sai o convite
 * para calibrar a placa: nunca durante o treino, nunca num menu de ajustes.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/progresso-base';
import { useConsulta } from '@/components/progresso-consulta';
import { ChipsDeExercicio, ProgressoDoExercicio } from '@/components/progresso-exercicios';
import { ProgressoSessoes } from '@/components/progresso-sessoes';
import { Tela } from '@/components/tela';
import { cor, espaco, margem, tipo } from '@/constants/tema';
import { historicoDoExercicio, listarExercicios, sessoesFinalizadas } from '@/db/queries';

/** O histórico é para olhar, não para rolar: além disso é arqueologia. */
const SESSOES_NA_LISTA = 30;
/** Séries do exercício: ~4 por sessão, então 200 cobrem um ano de treino dele. */
const SERIES_NO_DETALHE = 200;

type Modo = 'sessoes' | 'exercicios';

export default function Historico() {
  const [modo, setModo] = useState<Modo>('sessoes');
  const [exercicioId, setExercicioId] = useState<string | null>(null);

  const dados = useConsulta('Historico', () => ({
    sessoes: sessoesFinalizadas(SESSOES_NA_LISTA),
    exercicios: listarExercicios(),
  }));

  // O primeiro exercício do catálogo abre por padrão: uma tela de chips sem nada
  // embaixo obrigaria um toque só para começar a ler.
  const escolhido = exercicioId ?? dados.exercicios[0]?.id ?? null;

  const detalhe = useConsulta(`Historico:detalhe:${escolhido}`, () =>
    escolhido === null ? null : historicoDoExercicio(escolhido, SERIES_NO_DETALHE)
  );

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

      {modo === 'exercicios' && dados.exercicios.length > 0 ? (
        <ChipsDeExercicio
          exercicios={dados.exercicios}
          escolhido={escolhido}
          aoEscolher={setExercicioId}
        />
      ) : null}

      <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.conteudo}>
        {modo === 'sessoes' ? (
          <ProgressoSessoes sessoes={dados.sessoes} />
        ) : detalhe === null ? (
          // O catálogo começa vazio, então esta é a PRIMEIRA coisa que ele vê
          // nesta aba. Uma tela em branco pareceria defeito.
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTitulo}>Nenhum exercício ainda</Text>
            <Text style={estilos.vazioTexto}>
              Monte um treino na aba Treino e crie os exercícios dele. A evolução de cada um aparece
              aqui a partir da primeira série registrada.
            </Text>
          </View>
        ) : (
          <ProgressoDoExercicio historico={detalhe} />
        )}
      </ScrollView>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', gap: espaco.dois, paddingHorizontal: margem.conteudo },
  rolagem: { flex: 1 },
  conteudo: { paddingBottom: espaco.oito },
  vazio: { paddingHorizontal: margem.conteudo, paddingTop: espaco.oito, gap: espaco.dois },
  vazioTitulo: { ...tipo.itemForte, color: cor.texto },
  vazioTexto: { ...tipo.corpoMenor, color: cor.textoSecundario },
});
