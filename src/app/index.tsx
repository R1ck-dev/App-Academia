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
 *
 * O voltar do aparelho é tratado AQUI, num ponto só, porque backup, ficha,
 * resumo e execução são estado deste arquivo e não pilha de navegação — um
 * listener por tela disputaria a ordem de registro. Sair da execução por ele
 * NÃO finaliza: `minimizada` guarda a sessão que continua aberta, e a abertura
 * oferece voltar para ela. Finalizar é sempre toque explícito.
 */

import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TelaDeBackup } from '@/components/backup-tela';
import { TelaDaFicha } from '@/components/ficha-tela';
import { useConsulta } from '@/components/progresso-consulta';
import { ResumoDaSessao } from '@/components/treino-resumo';
import { TelaSessao } from '@/components/treino-sessao';
import { useSeriesDaSessao, useSessaoEmAndamento } from '@/components/treino-dados';
import { letraDoTreino } from '@/components/treino-texto';
import { useVoltarDoAparelho } from '@/components/voltar-do-aparelho';
import { alvo, cor, espaco, margem, raio, tipo } from '@/constants/tema';
import { descartarSessaoVazia, finalizarSessao, iniciarSessao } from '@/db/mutations';
import { ultimoBackupEm } from '@/db/exportar';
import { resumoDosTreinos, type ResumoDeTreino } from '@/db/queries';
import type { Sessao } from '@/db/schema';
import {
  diaLocal,
  diasEntreDias,
  formatarHora,
  rotuloDeQuandoFoi,
  rotuloDoDiaLongo,
} from '@/dominio/datas';

type Destino = { tipo: 'backup' } | { tipo: 'ficha'; ficha: ResumoDeTreino } | null;

export default function TreinoDeHoje() {
  const sessao = useSessaoEmAndamento();
  const [resumoDe, setResumoDe] = useState<string | null>(null);
  const [retomada, setRetomada] = useState<string | null>(null);
  const [minimizada, setMinimizada] = useState<string | null>(null);
  const [destino, setDestino] = useState<Destino>(null);

  const deHoje = sessao !== undefined && diaLocal(sessao.iniciadaEm) === diaLocal(Date.now());
  const executando =
    sessao !== undefined && (deHoje || retomada === sessao.id) && minimizada !== sessao.id;

  function sair(sessaoId: string) {
    setRetomada(null);
    // Nenhuma série registrada é engano de dedo, não treino: a sessão some, e
    // com ela o bloqueio de `uq_sessao_aberta` que impediria começar a certa.
    // Com série, ela fica aberta e a abertura oferece voltar.
    if (!descartarSessaoVazia(sessaoId)) setMinimizada(sessaoId);
  }

  useVoltarDoAparelho(
    destino !== null
      ? () => setDestino(null)
      : resumoDe !== null
        ? () => setResumoDe(null)
        : executando
          ? () => sair(sessao.id)
          : null
  );

  // Ficha e backup são as duas telas de "em casa, sentado". Elas vivem DENTRO da
  // aba Treino, e não como abas próprias, porque uma aba a mais na barra
  // competiria por espaço com o que ele abre três vezes por semana.
  if (destino?.tipo === 'backup') {
    return <TelaDeBackup aoVoltar={() => setDestino(null)} />;
  }
  if (destino?.tipo === 'ficha') {
    return (
      <TelaDaFicha
        treinoId={destino.ficha.id}
        nome={destino.ficha.nome}
        descricao={destino.ficha.descricao}
        aoVoltar={() => setDestino(null)}
      />
    );
  }

  if (resumoDe !== null) {
    return <ResumoDaSessao sessaoId={resumoDe} aoConcluir={() => setResumoDe(null)} />;
  }

  if (executando) {
    return (
      <TelaSessao
        sessaoId={sessao.id}
        aoFinalizar={(id) => {
          setRetomada(null);
          setMinimizada(null);
          setResumoDe(id);
        }}
      />
    );
  }

  return (
    <Abertura
      aberta={sessao}
      deHoje={deHoje}
      aoContinuar={() => {
        if (sessao === undefined) return;
        setMinimizada(null);
        setRetomada(sessao.id);
      }}
      aoFinalizar={(id) => {
        setMinimizada(null);
        setResumoDe(id);
      }}
      aoAbrirBackup={() => setDestino({ tipo: 'backup' })}
      aoEditarFicha={(ficha) => setDestino({ tipo: 'ficha', ficha })}
    />
  );
}

/**
 * "Bora treinar": os três cartões, e — quando existe — a sessão aberta,
 * resolvida ANTES da escolha do dia. Ela vem depois dos cartões na tela porque
 * começar um treino novo é o caso comum; ela vem antes na cabeça dele porque é
 * a pendência.
 */
function Abertura({
  aberta,
  deHoje,
  aoContinuar,
  aoFinalizar,
  aoAbrirBackup,
  aoEditarFicha,
}: {
  aberta: Sessao | undefined;
  deHoje: boolean;
  aoContinuar: () => void;
  aoFinalizar: (sessaoId: string) => void;
  aoAbrirBackup: () => void;
  aoEditarFicha: (ficha: ResumoDeTreino) => void;
}) {
  const fichas = useConsulta('Abertura', resumoDosTreinos);
  const ultimoBackup = useConsulta('Abertura:backup', ultimoBackupEm);
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

      <ScrollView style={estilos.area} contentContainerStyle={estilos.rolagem}>
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
                aoEditar={() => aoEditarFicha(ficha)}
              />
            ))}
          </View>
        )}

        {aberta === undefined ? null : (
          <SessaoAberta
            sessao={aberta}
            deHoje={deHoje}
            aoContinuar={aoContinuar}
            aoFinalizar={aoFinalizar}
          />
        )}
      </ScrollView>

      {/* O lembrete de backup mora AQUI, antes de começar, em uma linha —
          nunca no resumo do treino e nunca em vermelho. Alarme toda abertura
          ensina a ignorar alarme. */}
      <View style={estilos.rodape}>
        {fichas.length === 0 ? (
          <View />
        ) : (
          <Pressable onPress={() => aoEditarFicha(fichas[0])} hitSlop={10}>
            <Text style={estilos.rodapeAcao}>Editar fichas</Text>
          </Pressable>
        )}
        <Pressable style={estilos.rodapeBackup} onPress={aoAbrirBackup} hitSlop={10}>
          <Text style={estilos.rodapeTexto}>{textoDoBackup(ultimoBackup, agora)}</Text>
          <Text style={estilos.rodapeAcao}>Exportar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function CartaoDoTreino({
  ficha,
  agora,
  aoTocar,
  aoEditar,
}: {
  ficha: ResumoDeTreino;
  agora: number;
  aoTocar: () => void;
  aoEditar: () => void;
}) {
  const exercicios = `${ficha.exercicios} ${ficha.exercicios === 1 ? 'exercício' : 'exercícios'}`;
  return (
    <Pressable
      style={({ pressed }) => [estilos.cartao, pressed && estilos.cartaoTocado]}
      onPress={aoTocar}
      // Toque longo abre a ficha daquele treino: editar é raro e não pode
      // disputar o toque com começar a treinar, que é o motivo da tela existir.
      onLongPress={aoEditar}
    >
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
 * A sessão que continua aberta, em dois casos que merecem palavras diferentes.
 *
 * A de HOJE é o treino que ele deixou de lado pelo voltar do aparelho: nada
 * está errado, ele só saiu para olhar outra coisa. Finalizar ali usa o instante
 * de agora, porque é agora.
 *
 * A de OUTRO DIA é a que ele esqueceu aberta. Ali finalizar usa o horário da
 * ÚLTIMA série — o último instante sobre o qual existe dado. Carimbar "agora"
 * numa sessão de ontem inventaria um treino de dezoito horas.
 */
function SessaoAberta({
  sessao,
  deHoje,
  aoContinuar,
  aoFinalizar,
}: {
  sessao: Sessao;
  deHoje: boolean;
  aoContinuar: () => void;
  aoFinalizar: (sessaoId: string) => void;
}) {
  const feitas = useSeriesDaSessao(sessao.id);
  const ultimoInstante = feitas.reduce(
    (maior, serie) => Math.max(maior, serie.concluidaEm),
    sessao.iniciadaEm
  );
  const series = `${feitas.length} ${feitas.length === 1 ? 'série' : 'séries'}`;

  function finalizar() {
    finalizarSessao(sessao.id, deHoje ? undefined : ultimoInstante);
    aoFinalizar(sessao.id);
  }

  return (
    <View style={estilos.aviso}>
      <Text style={estilos.avisoTitulo}>
        {deHoje ? 'Treino em andamento' : 'Sessão de outro dia ficou aberta'}
      </Text>
      <Text style={estilos.avisoTexto}>
        {sessao.nome} · {series} ·{' '}
        {deHoje
          ? `começou às ${formatarHora(sessao.iniciadaEm)}`
          : `última às ${formatarHora(ultimoInstante)}`}
      </Text>
      <View style={estilos.avisoBotoes}>
        <Pressable
          style={({ pressed }) => [estilos.infoCheio, pressed && estilos.infoCheioTocado]}
          onPress={aoContinuar}
        >
          <Text style={estilos.infoCheioTexto}>
            {deHoje ? 'Voltar ao treino' : 'Continuar nela'}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [estilos.infoContorno, pressed && estilos.infoContornoTocado]}
          onPress={finalizar}
        >
          <Text style={estilos.infoContornoTexto}>
            {deHoje ? 'Finalizar agora' : `Fechar às ${formatarHora(ultimoInstante)}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * "Último backup há 47 dias" — e nada quando é recente. A linha só aparece
 * quando começa a importar; presente sempre, viraria papel de parede.
 */
function textoDoBackup(ultimo: number | null, agora: number): string {
  if (ultimo === null) return 'Nenhum backup ainda';
  const dias = diasEntreDias(ultimo, agora);
  if (dias <= 0) return 'Backup feito hoje';
  return `Último backup ${rotuloDeQuandoFoi(ultimo, agora)}`;
}

const estilos = StyleSheet.create({
  area: { flex: 1, backgroundColor: cor.fundo },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.tres,
    paddingHorizontal: margem.conteudo,
    paddingBottom: espaco.seis,
    paddingTop: espaco.dois,
  },
  rodapeBackup: { flexDirection: 'row', alignItems: 'center', gap: espaco.dois },
  rodapeTexto: { ...tipo.meta, color: cor.textoTerciario },
  rodapeAcao: { ...tipo.rotuloCompacto, fontSize: 13, color: cor.acaoTexto },
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
