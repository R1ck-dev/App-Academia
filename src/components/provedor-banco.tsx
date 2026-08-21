import { useFonts } from 'expo-font';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import migrations from '@/../drizzle/migrations';
import { FONTES } from '@/constants/fontes';
import { cor, espaco, margem, raio, tipo } from '@/constants/tema';
import { db } from '@/db/client';

/**
 * Segura a UI até o app estar utilizável: banco migrado e fontes carregadas.
 *
 * Renderizar uma tela que consulta tabela ainda não migrada é crash na primeira
 * execução — e como não há servidor, o banco do aparelho é o único exemplar dos
 * treinos. Por isso a falha aqui não pode virar tela branca: se a migration
 * quebrar, é preciso ver o que aconteceu e ter uma saída, não um app que
 * simplesmente não abre com o histórico preso dentro.
 *
 * As fontes entram no mesmo portão porque o desenho depende delas: sem
 * Caprasimo, o número de 84 px cai na fonte do sistema e a tela de execução
 * aparece por um instante com outra cara.
 *
 * Já houve um seed aqui, com 24 exercícios e três fichas prontas. Saiu em
 * 21/08/2026: escolher da lista pronta era mais lento do que digitar o nome do
 * exercício que ele tem na frente. O app abre vazio, e a abertura convida a
 * criar o primeiro treino.
 */
export function ProvedorBanco({ children }: { children: React.ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  const [fontesProntas] = useFonts(FONTES);

  if (error) return <TelaErro erro={error} />;

  if (!success || !fontesProntas) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={cor.acao} />
        <Text style={estilos.carregando}>Preparando seus dados…</Text>
      </View>
    );
  }

  return <>{children}</>;
}

function TelaErro({ erro }: { erro: Error }) {
  return (
    <ScrollView contentContainerStyle={estilos.erroArea}>
      <Text style={estilos.erroTitulo}>Não consegui abrir seus dados</Text>
      <Text style={estilos.erroTexto}>
        O banco do aplicativo não pôde ser preparado. Seus treinos continuam gravados no aparelho —
        não foram apagados.
      </Text>
      <Text style={estilos.erroTexto}>
        Feche e abra o aplicativo. Se continuar, anote a mensagem abaixo antes de reinstalar, porque
        reinstalar apaga os dados locais.
      </Text>
      <View style={estilos.erroCaixa}>
        <Text style={estilos.erroDetalhe} selectable>
          {erro.message}
        </Text>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cor.fundo,
    gap: espaco.seis,
  },
  // Sem `fontFamily`: esta é a única tela que pode aparecer ANTES de as fontes
  // carregarem, e pedir Caprasimo aqui daria texto invisível no pior momento.
  carregando: { fontSize: 14, color: cor.textoTerciario },
  erroArea: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: cor.fundo,
    padding: margem.conteudo,
    gap: espaco.quatro,
  },
  erroTitulo: { fontSize: 22, fontWeight: '700', color: cor.texto },
  erroTexto: { fontSize: 14, lineHeight: 22, color: cor.textoSecundario },
  erroCaixa: {
    borderWidth: 2,
    borderColor: cor.acaoContorno,
    borderRadius: raio.container,
    padding: espaco.quatro,
  },
  erroDetalhe: { ...tipo.meta, fontFamily: 'monospace', color: cor.acaoTexto },
});
