import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import migrations from '@/../drizzle/migrations';
import { cores, espaco, fonte } from '@/constants/tema';
import { db } from '@/db/client';

/**
 * Segura a UI até o banco estar utilizável.
 *
 * Renderizar uma tela que consulta tabela ainda não migrada é crash na primeira
 * execução — e como não há servidor, o banco do aparelho é o único exemplar dos
 * treinos. Por isso a falha aqui não pode virar tela branca: se a migration
 * quebrar, é preciso ver o que aconteceu e ter uma saída, não um app que
 * simplesmente não abre com o histórico preso dentro.
 */
export function ProvedorBanco({ children }: { children: React.ReactNode }) {
  const { success, error } = useMigrations(db, migrations);

  if (error) return <TelaErro erro={error} />;

  if (!success) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={cores.destaque} />
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
    backgroundColor: cores.fundo,
    gap: espaco.lg,
  },
  carregando: { color: cores.textoFraco, fontSize: fonte.corpo },
  erroArea: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: cores.fundo,
    padding: espaco.lg,
    gap: espaco.md,
  },
  erroTitulo: { color: cores.texto, fontSize: fonte.titulo, fontWeight: '600' },
  erroTexto: { color: cores.textoFraco, fontSize: fonte.corpo, lineHeight: 22 },
  erroCaixa: { borderWidth: 1, borderColor: cores.alerta, padding: espaco.md },
  erroDetalhe: { color: cores.alerta, fontSize: 12, fontFamily: 'monospace' },
});
