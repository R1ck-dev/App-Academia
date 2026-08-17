/**
 * A aba Treino: escolher o treino do dia, ou cair direto na sessão em andamento.
 *
 * Este arquivo só COMPÕE — quem decide o que aparece é `sessaoEmAndamento()` e o
 * domínio. Não há aqui `if` sobre carga, repetição ou índice: isso mora em
 * `src/dominio/execucao.ts`, com teste.
 *
 * Retomar custa ZERO toque: com uma sessão de HOJE aberta, a aba já abre na tela
 * de execução. A exceção é a sessão esquecida aberta de outro dia, que ganha uma
 * escolha explícita — começar hoje dentro da sessão de ontem estragaria o
 * agrupamento por dia, e fechá-la sozinho seria fabricar um horário de término.
 */

import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Tela, Vazio } from '@/components/tela';
import { useSeriesDaSessao, useSessaoEmAndamento, useTreinos } from '@/components/treino-dados';
import { ResumoDaSessao } from '@/components/treino-resumo';
import { TelaSessao } from '@/components/treino-sessao';
import { ALVO_TOQUE, cores, espaco, fonte } from '@/constants/tema';
import { finalizarSessao, iniciarSessao } from '@/db/mutations';
import type { Sessao, Treino } from '@/db/schema';
import { diaLocal, formatarDataHora, formatarHora } from '@/dominio/datas';

export default function TreinoDeHoje() {
  const sessao = useSessaoEmAndamento();
  const [resumoDe, setResumoDe] = useState<string | null>(null);
  const [retomada, setRetomada] = useState<string | null>(null);

  if (resumoDe !== null) {
    return <ResumoDaSessao sessaoId={resumoDe} aoConcluir={() => setResumoDe(null)} />;
  }

  if (sessao !== undefined) {
    const deHoje = diaLocal(sessao.iniciadaEm) === diaLocal(Date.now());
    if (deHoje || retomada === sessao.id) {
      return (
        <TelaSessao
          sessaoId={sessao.id}
          aoFinalizar={(id) => {
            setRetomada(null);
            setResumoDe(id);
          }}
        />
      );
    }
    return (
      <SessaoEsquecida
        sessao={sessao}
        aoRetomar={() => setRetomada(sessao.id)}
        aoFinalizar={(id) => setResumoDe(id)}
      />
    );
  }

  return <EscolhaDoTreino />;
}

function EscolhaDoTreino() {
  const fichas = useTreinos();

  function iniciar(ficha: Treino) {
    // O nome é COPIADO para a sessão pela mutation: renomear a ficha depois não
    // pode reescrever o histórico.
    const r = iniciarSessao({ nome: ficha.nome, treinoId: ficha.id });
    if (!r.ok) {
      Alert.alert('Já existe um treino em andamento', 'Volte para esta aba para retomá-lo.');
    }
  }

  if (fichas.length === 0) {
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
      <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.lista}>
        {fichas.map((ficha) => (
          <Pressable key={ficha.id} style={estilos.ficha} onPress={() => iniciar(ficha)}>
            <Text style={estilos.fichaNome}>{ficha.nome}</Text>
            {ficha.descricao === null ? null : (
              <Text style={estilos.fichaDescricao}>{ficha.descricao}</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </Tela>
  );
}

/**
 * A sessão de ontem que ficou aberta. Duas saídas, ambas honestas: continuar
 * dentro dela, ou fechá-la no horário da ÚLTIMA série — que é o último instante
 * sobre o qual existe dado, e não um término inventado.
 */
function SessaoEsquecida({
  sessao,
  aoRetomar,
  aoFinalizar,
}: {
  sessao: Sessao;
  aoRetomar: () => void;
  aoFinalizar: (sessaoId: string) => void;
}) {
  const feitas = useSeriesDaSessao(sessao.id);
  const ultimoInstante = feitas.reduce(
    (maior, serie) => Math.max(maior, serie.concluidaEm),
    sessao.iniciadaEm
  );

  function finalizar() {
    finalizarSessao(sessao.id, ultimoInstante);
    aoFinalizar(sessao.id);
  }

  return (
    <Tela titulo="Treino">
      <View style={estilos.aviso}>
        <Text style={estilos.avisoTitulo}>{sessao.nome} continua aberto</Text>
        <Text style={estilos.avisoTexto}>
          Começou em {formatarDataHora(sessao.iniciadaEm)}, com {feitas.length}{' '}
          {feitas.length === 1 ? 'série registrada' : 'séries registradas'}.
        </Text>
      </View>

      <Pressable style={estilos.principal} onPress={aoRetomar}>
        <Text style={estilos.principalTexto}>Continuar este treino</Text>
      </Pressable>

      <Pressable style={estilos.secundario} onPress={finalizar}>
        <Text style={estilos.secundarioTexto}>
          Finalizar às {formatarHora(ultimoInstante)} (última série)
        </Text>
      </Pressable>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  rolagem: { flex: 1 },
  lista: { gap: espaco.md, paddingBottom: espaco.xl },
  ficha: {
    backgroundColor: cores.superficie,
    borderRadius: 14,
    padding: espaco.md,
    minHeight: ALVO_TOQUE + 24,
    justifyContent: 'center',
    gap: espaco.xs,
  },
  fichaNome: { color: cores.texto, fontSize: fonte.titulo, fontWeight: '700' },
  fichaDescricao: { color: cores.textoFraco, fontSize: fonte.legenda },
  aviso: { backgroundColor: cores.superficie, borderRadius: 14, padding: espaco.md, gap: espaco.xs },
  avisoTitulo: { color: cores.texto, fontSize: fonte.corpo, fontWeight: '700' },
  avisoTexto: { color: cores.textoFraco, fontSize: fonte.legenda, lineHeight: 20 },
  principal: {
    minHeight: ALVO_TOQUE + 16,
    borderRadius: 14,
    backgroundColor: cores.destaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principalTexto: { color: cores.fundo, fontSize: fonte.corpo, fontWeight: '700' },
  secundario: {
    minHeight: ALVO_TOQUE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secundarioTexto: { color: cores.textoFraco, fontSize: fonte.corpo },
});
