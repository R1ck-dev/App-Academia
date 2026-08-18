/**
 * Aba Corpo: peso, objetivo, IMC, estatística do período e medidas.
 *
 * A tela só orquestra. Cada consulta vem de `queries.ts` e cada número vem de
 * `dominio/corpo.ts` — não há `if` sobre peso, altura ou objetivo aqui, e é o que
 * mantém a conta testável fora do aparelho.
 */

import { ScrollView, StyleSheet } from 'react-native';

import { CorpoEstatistica } from '@/components/corpo-estatistica';
import { CorpoImc } from '@/components/corpo-imc';
import { CorpoMedidas } from '@/components/corpo-medidas';
import { CorpoObjetivo } from '@/components/corpo-objetivo';
import { CorpoPeso } from '@/components/corpo-peso';
import { useConsulta } from '@/components/progresso-consulta';
import { Tela } from '@/components/tela';
import { espacoLegado as espaco } from '@/constants/tema';
import { historicoMedidas, historicoPeso, obterPerfil } from '@/db/queries';
import { pesoAtual } from '@/dominio/corpo';

export default function Corpo() {
  // Uma releitura por escrita, não uma por render: as três consultas são
  // síncronas e locais, mas rodá-las a cada toque de tecla do campo de peso
  // faria o teclado engasgar.
  const dados = useConsulta('Corpo', () => ({
    perfil: obterPerfil(),
    pesagens: historicoPeso(),
    medidas: historicoMedidas(),
  }));

  const atual = pesoAtual(dados.pesagens);

  return (
    <Tela titulo="Corpo">
      <ScrollView
        style={estilos.rolagem}
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <CorpoPeso pesagens={dados.pesagens} />
        <CorpoObjetivo perfil={dados.perfil} pesoAtualG={atual?.pesoG ?? null} />
        <CorpoImc perfil={dados.perfil} pesoAtualG={atual?.pesoG ?? null} />
        <CorpoEstatistica pesagens={dados.pesagens} />
        <CorpoMedidas medidas={dados.medidas} />
      </ScrollView>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  // Sem `flex: 1` a ScrollView cresce com o conteúdo dentro da coluna da `Tela` e
  // deixa de rolar: o cartão de medidas some embaixo da barra de abas.
  rolagem: { flex: 1 },
  conteudo: { gap: espaco.md, paddingBottom: espaco.xl },
});
