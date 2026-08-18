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
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConsulta } from '@/components/progresso-consulta';
import { ResumoDaSessao } from '@/components/treino-resumo';
import { TelaSessao } from '@/components/treino-sessao';
import { useSeriesDaSessao, useSessaoEmAndamento } from '@/components/treino-dados';
import { letraDoTreino } from '@/components/treino-texto';
import { alvo, cor, espaco, margem, raio, tipo } from '@/constants/tema';
import { finalizarSessao, iniciarSessao } from '@/db/mutations';
import { resumoDosTreinos, type ResumoDeTreino } from '@/db/queries';
import type { Sessao } from '@/db/schema';
import { diaLocal, formatarHora, rotuloDeQuandoFoi, rotuloDoDiaLongo } from '@/dominio/datas';

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
  }

  return (
    <Abertura
      esquecida={sessao}
      aoRetomar={() => sessao !== undefined && setRetomada(sessao.id)}
      aoFinalizar={(id) => setResumoDe(id)}
    />
  );
}

/**
 * "Bora treinar": os três cartões, e — quando existe — a sessão de ontem que
 * ficou aberta, resolvida ANTES da escolha do dia. Ela vem depois dos cartões
 * na tela porque começar um treino novo é o caso comum; ela vem antes na cabeça
 * dele porque é a pendência.
 */
function Abertura({
  esquecida,
  aoRetomar,
  aoFinalizar,
}: {
  esquecida: Sessao | undefined;
  aoRetomar: () => void;
  aoFinalizar: (sessaoId: string) => void;
}) {
  const fichas = useConsulta('Abertura', resumoDosTreinos);
  const agora = Date.now();

  function iniciar(ficha: ResumoDeTreino) {
    // O nome é COPIADO para a sessão pela mutation: renomear a ficha depois não
    // pode reescrever o histórico.
    const r = iniciarSessao({ nome: ficha.nome, treinoId: ficha.id });
    if (!r.ok) {
      Alert.alert('Já existe um treino em andamento', 'Resolva a sessão aberta antes de começar.');
    }
  }

  return (
    <SafeAreaView style={estilos.area} edges={['top', 'left', 'right']}>
      <View style={estilos.cabecalho}>
        <Text style={estilos.kicker}>{rotuloDoDiaLongo(agora)}</Text>
        <Text style={estilos.titulo}>Bora treinar</Text>
      </View>

      <ScrollView contentContainerStyle={estilos.rolagem}>
        {fichas.length === 0 ? (
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTexto}>Nenhum treino montado ainda.</Text>
          </View>
        ) : (
          <View style={estilos.lista}>
            {fichas.map((ficha) => (
              <CartaoDoTreino
                key={ficha.id}
                ficha={ficha}
                agora={agora}
                aoTocar={() => iniciar(ficha)}
              />
            ))}
          </View>
        )}

        {esquecida === undefined ? null : (
          <SessaoEsquecida sessao={esquecida} aoRetomar={aoRetomar} aoFinalizar={aoFinalizar} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CartaoDoTreino({
  ficha,
  agora,
  aoTocar,
}: {
  ficha: ResumoDeTreino;
  agora: number;
  aoTocar: () => void;
}) {
  const exercicios = `${ficha.exercicios} ${ficha.exercicios === 1 ? 'exercício' : 'exercícios'}`;
  return (
    <Pressable style={({ pressed }) => [estilos.cartao, pressed && estilos.cartaoTocado]} onPress={aoTocar}>
      <View style={estilos.letra}>
        <Text style={estilos.letraTexto}>{letraDoTreino(ficha.nome)}</Text>
      </View>
      <View style={estilos.cartaoCorpo}>
        {/* A descrição é o título: "Costas, bíceps e ombros" diz mais que "Treino A",
            e a letra no círculo já identifica qual é. */}
        <Text style={estilos.cartaoNome}>{ficha.descricao ?? ficha.nome}</Text>
        <Text style={estilos.cartaoConta}>{exercicios}</Text>
      </View>
      <Text style={estilos.cartaoQuando}>{rotuloDeQuandoFoi(ficha.ultimaSessaoEm, agora)}</Text>
    </Pressable>
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
    <View style={estilos.aviso}>
      <Text style={estilos.avisoTitulo}>Sessão de outro dia ficou aberta</Text>
      <Text style={estilos.avisoTexto}>
        {sessao.nome} · {feitas.length} {feitas.length === 1 ? 'série' : 'séries'} · última às{' '}
        {formatarHora(ultimoInstante)}
      </Text>
      <View style={estilos.avisoBotoes}>
        <Pressable
          style={({ pressed }) => [estilos.infoCheio, pressed && estilos.infoCheioTocado]}
          onPress={aoRetomar}
        >
          <Text style={estilos.infoCheioTexto}>Continuar nela</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [estilos.infoContorno, pressed && estilos.infoContornoTocado]}
          onPress={finalizar}
        >
          <Text style={estilos.infoContornoTexto}>Fechar às {formatarHora(ultimoInstante)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { flex: 1, backgroundColor: cor.fundo },
  cabecalho: { paddingHorizontal: margem.conteudo, paddingTop: espaco.quatro, gap: espaco.dois },
  kicker: { ...tipo.kicker, color: cor.infoKicker },
  titulo: { ...tipo.tituloDeTelaGrande, color: cor.texto },
  rolagem: { paddingTop: espaco.seis, paddingBottom: espaco.oito },
  lista: { paddingHorizontal: margem.listaDeCartoes, gap: espaco.tres },

  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.quatro,
    padding: espaco.quatro,
    borderRadius: raio.container,
    backgroundColor: cor.superficie,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cartaoTocado: { borderColor: cor.acao, backgroundColor: cor.acaoTinta },
  letra: {
    width: 58,
    height: 58,
    borderRadius: raio.pilula,
    backgroundColor: cor.textoDesligado,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letraTexto: { fontFamily: tipo.numeroMedio.fontFamily, fontSize: 26, color: cor.sobreAcao },
  cartaoCorpo: { flex: 1, minWidth: 0, gap: 3 },
  cartaoNome: { ...tipo.itemForte, color: cor.texto },
  cartaoConta: { ...tipo.meta, fontSize: 12.5, color: cor.textoSecundario },
  cartaoQuando: { ...tipo.metaMenor, color: cor.textoTerciario },

  aviso: {
    marginTop: espaco.seis,
    marginHorizontal: margem.conteudo,
    padding: espaco.quatro,
    borderRadius: raio.container,
    backgroundColor: cor.infoTinta,
    gap: espaco.um,
  },
  avisoTitulo: { ...tipo.rotuloForte, color: cor.texto },
  avisoTexto: { ...tipo.meta, fontSize: 12.5, color: cor.infoTintaTexto },
  avisoBotoes: { flexDirection: 'row', gap: espaco.dois, marginTop: espaco.dois },
  infoCheio: {
    height: alvo.botaoCompacto,
    paddingHorizontal: espaco.quatro,
    borderRadius: raio.pilula,
    backgroundColor: cor.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCheioTocado: { backgroundColor: cor.infoPressionada },
  infoCheioTexto: { ...tipo.corpoMenor, fontSize: 13.5, color: cor.sobreAcao },
  infoContorno: {
    height: alvo.botaoCompacto,
    paddingHorizontal: espaco.quatro,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.infoBorda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContornoTocado: { backgroundColor: cor.infoTinta },
  infoContornoTexto: { ...tipo.corpoMenor, fontSize: 13.5, color: cor.infoTintaTextoForte },

  vazio: { paddingHorizontal: margem.conteudo, paddingTop: espaco.seis },
  vazioTexto: { ...tipo.corpo, color: cor.textoSecundario },
});
