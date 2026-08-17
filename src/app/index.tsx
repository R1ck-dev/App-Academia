import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { isNull } from 'drizzle-orm';
import { StyleSheet, Text } from 'react-native';

import { Tela, Vazio } from '@/components/tela';
import { cores, espaco, fonte } from '@/constants/tema';
import { db } from '@/db/client';
import { treinos } from '@/db/schema';

export default function TreinoDeHoje() {
  const { data: fichas } = useLiveQuery(
    db.select().from(treinos).where(isNull(treinos.arquivadoEm))
  );

  if (!fichas?.length) {
    return (
      <Tela titulo="Treino">
        <Vazio
          mensagem="Nenhum treino montado ainda."
          acao="Monte o Treino A para começar a registrar cargas."
        />
      </Tela>
    );
  }

  return (
    <Tela titulo="Treino">
      {fichas.map((ficha) => (
        <Text key={ficha.id} style={estilos.ficha}>
          {ficha.nome}
        </Text>
      ))}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  ficha: {
    color: cores.texto,
    fontSize: fonte.corpo,
    backgroundColor: cores.superficie,
    borderRadius: 12,
    padding: espaco.md,
  },
});
