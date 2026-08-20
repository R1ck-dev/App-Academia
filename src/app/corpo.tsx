/**
 * Aba Corpo: peso, objetivo, IMC, tendência e medidas.
 *
 * A tela só orquestra. Cada consulta vem de `queries.ts` e cada número vem de
 * `dominio/corpo.ts` — não há `if` sobre peso, altura ou objetivo aqui, e é o que
 * mantém a conta testável fora do aparelho.
 *
 * **Ela começa vazia, e isso é o estado real.** O desenho trata o vazio como
 * caso de primeira classe: um convite por dado que falta, e uma frase dizendo
 * quando a tendência aparece. Não existe lugar reservado esperando um número —
 * é a correção deliberada do app que ele usava, que extrapola "+1,8 kg por
 * semana · Muito rápido" de duas pesagens em seis dias.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnelDoObjetivo, AnelVazio, LinhaDoPeso } from '@/components/corpo-anel';
import {
  FolhaDeAltura,
  FolhaDeMedida,
  FolhaDeObjetivo,
  FolhaDePeso,
} from '@/components/corpo-folhas';
import { useConsulta } from '@/components/progresso-consulta';
import { Tela } from '@/components/tela';
import { alvo, cor, espaco, margem, raio, tipo } from '@/constants/tema';
import { historicoMedidas, historicoPeso, obterPerfil } from '@/db/queries';
import { PARTES_CORPO, type Medida } from '@/db/schema';
import { formatarMedida, formatarPeso } from '@/dominio/carga';
import {
  calcularImc,
  estatisticaDaSerie,
  faixaPesoNormal,
  formatarAltura,
  formatarImc,
  formatarVariacao,
  pesoAtual,
  progressoObjetivo,
  rotuloCategoria,
  rotuloDaParte,
  type Ritmo,
} from '@/dominio/corpo';
import { mediaMovel, type Ponto } from '@/dominio/datas';

type Folha = 'peso' | 'altura' | 'objetivo' | 'medida' | null;

export default function Corpo() {
  const [folha, setFolha] = useState<Folha>(null);

  // Uma releitura por escrita, não uma por render: as três consultas são
  // síncronas e locais, mas rodá-las a cada toque de tecla faria o campo engasgar.
  const dados = useConsulta('Corpo', () => ({
    perfil: obterPerfil(),
    pesagens: historicoPeso(),
    medidas: historicoMedidas(),
  }));

  const atual = pesoAtual(dados.pesagens);
  const pontos: Ponto[] = dados.pesagens.map((p) => ({ instante: p.medidoEm, valor: p.pesoG }));

  return (
    <Tela titulo="Corpo">
      <ScrollView style={estilos.expandir} contentContainerStyle={estilos.rolagem}>
        {atual === null ? (
          <CorpoVazio aoAbrir={setFolha} />
        ) : (
          <CorpoComDados
            pesoAtualG={atual.pesoG}
            pontos={pontos}
            alturaMm={dados.perfil?.alturaMm ?? null}
            objetivoG={dados.perfil?.pesoObjetivoG ?? null}
            inicialG={dados.perfil?.pesoInicialG ?? null}
            medidas={dados.medidas}
            aoAbrir={setFolha}
          />
        )}
      </ScrollView>

      <Pressable
        style={({ pressed }) => [estilos.registrar, pressed && estilos.registrarTocado]}
        onPress={() => setFolha('peso')}
      >
        <Text style={estilos.registrarTexto}>Registrar peso</Text>
      </Pressable>

      {folha === 'peso' ? <FolhaDePeso aoFechar={() => setFolha(null)} /> : null}
      {folha === 'altura' ? (
        <FolhaDeAltura alturaMm={dados.perfil?.alturaMm ?? null} aoFechar={() => setFolha(null)} />
      ) : null}
      {folha === 'objetivo' ? <FolhaDeObjetivo aoFechar={() => setFolha(null)} /> : null}
      {folha === 'medida' ? <FolhaDeMedida aoFechar={() => setFolha(null)} /> : null}
    </Tela>
  );
}

function CorpoVazio({ aoAbrir }: { aoAbrir: (f: Folha) => void }) {
  return (
    <View style={estilos.conteudo}>
      <View style={estilos.cabecalhoDoPeso}>
        <AnelVazio />
        <View style={estilos.pesoTextos}>
          <Text style={estilos.pesoAusente}>— kg</Text>
          <Text style={estilos.pesoDetalhe}>Nenhuma pesagem ainda</Text>
        </View>
      </View>

      <View style={estilos.convites}>
        <Convite texto="Sua altura" acao="informar" aoTocar={() => aoAbrir('altura')} />
        <Text style={estilos.notaDoConvite}>Sem altura não há IMC.</Text>
        <Convite texto="Um objetivo de peso" acao="definir" aoTocar={() => aoAbrir('objetivo')} />
        <Convite texto="Medidas com a trena" acao="medir" aoTocar={() => aoAbrir('medida')} />
      </View>

      <Text style={estilos.rodape}>
        Tendência do peso: aparece com 4 pesagens em 14 dias. Antes disso não existe número
        honesto, então não existe lugar reservado para um.
      </Text>
    </View>
  );
}

function CorpoComDados({
  pesoAtualG,
  pontos,
  alturaMm,
  objetivoG,
  inicialG,
  medidas,
  aoAbrir,
}: {
  pesoAtualG: number;
  pontos: readonly Ponto[];
  alturaMm: number | null;
  objetivoG: number | null;
  inicialG: number | null;
  medidas: readonly Medida[];
  aoAbrir: (f: Folha) => void;
}) {
  const progresso =
    objetivoG === null
      ? null
      : progressoObjetivo(pesoAtualG, { pesoObjetivoG: objetivoG, pesoInicialG: inicialG });
  const media = mediaMovel([...pontos]);
  const mediaAtual = media.length === 0 ? null : media[media.length - 1].valor;
  const estatistica = estatisticaDaSerie(pontos);
  const imc = calcularImc(pesoAtualG, alturaMm);
  const faixa = faixaPesoNormal(alturaMm);

  return (
    <View style={estilos.conteudo}>
      <View style={estilos.cabecalhoDoPeso}>
        <AnelDoObjetivo percentual={progresso?.percentual ?? null} />
        <View style={estilos.pesoTextos}>
          <Text style={estilos.peso}>{formatarPeso(pesoAtualG)}</Text>
          {mediaAtual === null ? null : (
            <Text style={estilos.pesoDetalhe}>média de 7 dias: {formatarPeso(mediaAtual)}</Text>
          )}
          {progresso === null ? (
            <Pressable onPress={() => aoAbrir('objetivo')} hitSlop={8}>
              <Text style={estilos.acaoLeve}>definir um objetivo</Text>
            </Pressable>
          ) : (
            <Text style={estilos.acaoLeve}>{textoDoObjetivo(progresso.faltaG, progresso.alcancado)}</Text>
          )}
        </View>
      </View>

      <LinhaDoPeso pesagens={pontos} media={media} />
      {pontos.length < 2 ? null : (
        <Text style={estilos.legendaDaLinha}>
          linha fina: cada pesagem · grossa: média de 7 dias
        </Text>
      )}

      <View style={estilos.leituras}>
        <Leitura
          rotulo={estatistica === null ? 'Tendência' : `Tendência (${estatistica.dias} dias)`}
          valor={textoDaTendencia(estatistica?.ritmo ?? null)}
        />
        {alturaMm === null ? (
          <Leitura rotulo="IMC" valor="sem altura" aoTocar={() => aoAbrir('altura')} />
        ) : (
          <Leitura
            rotulo={`IMC (${formatarAltura(alturaMm)} m)`}
            valor={imc === null ? '—' : `${formatarImc(imc.centesimos)} · ${rotuloCategoria(imc.categoria)}`}
          />
        )}
        {faixa === null ? null : (
          <Leitura
            rotulo="Faixa normal"
            valor={`${formatarPeso(faixa.minimoG)} – ${formatarPeso(faixa.maximoG)}`}
          />
        )}
      </View>

      <View style={estilos.medidas}>
        {ultimaMedidaPorParte(medidas).map((m) => (
          <View key={m.parte} style={estilos.chipDeMedida}>
            <Text style={estilos.chipDeMedidaTexto}>
              {rotuloDaParte(m.parte).toLowerCase()} {formatarMedida(m.valorMm)}
            </Text>
          </View>
        ))}
        <Pressable style={estilos.chipDeMedidaVazio} onPress={() => aoAbrir('medida')}>
          <Text style={estilos.chipDeMedidaVazioTexto}>
            {ultimaMedidaPorParte(medidas).length} de {PARTES_CORPO.length} partes
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Convite({
  texto,
  acao,
  aoTocar,
}: {
  texto: string;
  acao: string;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [estilos.convite, pressed && estilos.conviteTocado]}
      onPress={aoTocar}
    >
      <Text style={estilos.conviteTexto}>{texto}</Text>
      <Text style={estilos.conviteAcao}>{acao}</Text>
    </Pressable>
  );
}

function Leitura({
  rotulo,
  valor,
  aoTocar,
}: {
  rotulo: string;
  valor: string;
  aoTocar?: () => void;
}) {
  const conteudo = (
    <>
      <Text style={estilos.leituraRotulo}>{rotulo}</Text>
      <Text style={aoTocar ? estilos.leituraAcao : estilos.leituraValor}>{valor}</Text>
    </>
  );
  if (aoTocar === undefined) return <View style={estilos.leitura}>{conteudo}</View>;
  return (
    <Pressable style={estilos.leitura} onPress={aoTocar}>
      {conteudo}
    </Pressable>
  );
}

// ── Texto ──────────────────────────────────────────────────────────────────

function textoDoObjetivo(faltaG: number, alcancado: boolean): string {
  if (alcancado) return 'objetivo alcançado';
  return `faltam ${formatarPeso(faltaG)}`;
}

/**
 * O `if` que este app existe para ter: com `suficiente: false` o campo
 * `porSemana` NEM EXISTE no tipo, então não há como imprimir um número que a
 * amostra não sustenta.
 */
function textoDaTendencia(ritmo: Ritmo | null): string {
  if (ritmo === null) return 'ainda sem pesagens';
  if (!ritmo.suficiente) {
    if (ritmo.motivo === 'poucas_pesagens') return `${ritmo.pontos} de 4 pesagens`;
    if (ritmo.motivo === 'periodo_curto') return `${ritmo.dias} de 14 dias`;
    return 'ainda sem pesagens';
  }
  return `${formatarVariacao(ritmo.porSemana)} por semana · ${ritmo.pontos} pesagens`;
}

/** Uma linha por parte MEDIDA, com o valor mais recente dela. */
function ultimaMedidaPorParte(medidas: readonly Medida[]): Medida[] {
  const porParte = new Map<string, Medida>();
  for (const m of medidas) {
    const atual = porParte.get(m.parte);
    if (atual === undefined || m.medidoEm > atual.medidoEm) porParte.set(m.parte, m);
  }
  return [...porParte.values()];
}

const estilos = StyleSheet.create({
  /** A rolagem cede o espaço do rodapé fixo em vez de empurrá-lo para fora. */
  expandir: { flex: 1 },
  rolagem: { paddingBottom: espaco.quatro },
  conteudo: { paddingHorizontal: margem.conteudo },

  cabecalhoDoPeso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.quatro,
    marginTop: espaco.tres,
  },
  pesoTextos: { flex: 1, minWidth: 0, gap: 3 },
  peso: { ...tipo.tituloDeTelaGrande, color: cor.texto },
  pesoAusente: { ...tipo.tituloDeTela, color: cor.textoDesligado },
  pesoDetalhe: { ...tipo.meta, fontSize: 12.5, color: cor.textoSecundario },
  acaoLeve: { ...tipo.meta, fontSize: 12.5, color: cor.acaoTexto },
  legendaDaLinha: { ...tipo.metaMenor, color: cor.textoTerciario },

  convites: { marginTop: espaco.seis, gap: espaco.dois },
  convite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.dois,
    paddingVertical: espaco.tres,
    paddingHorizontal: espaco.quatro,
    borderRadius: raio.container,
    backgroundColor: cor.superficie,
    minHeight: alvo.botaoSecundario,
  },
  conviteTocado: { backgroundColor: cor.acaoTinta },
  conviteTexto: { ...tipo.corpo, color: cor.texto },
  conviteAcao: { ...tipo.rotuloCompacto, fontSize: 13, color: cor.acaoTexto },
  notaDoConvite: { ...tipo.metaMenor, color: cor.textoTerciario, marginTop: -espaco.um },
  rodape: { ...tipo.meta, color: cor.textoTerciario, marginTop: espaco.oito },

  leituras: { marginTop: espaco.seis, gap: espaco.dois },
  leitura: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco.dois },
  leituraRotulo: { ...tipo.corpoMenor, fontSize: 13.5, color: cor.textoSecundario, flexShrink: 1 },
  leituraValor: { ...tipo.corpoMenor, fontSize: 13.5, color: cor.texto, textAlign: 'right' },
  leituraAcao: { ...tipo.corpoMenor, fontSize: 13.5, color: cor.acaoTexto, textAlign: 'right' },

  medidas: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: espaco.seis },
  chipDeMedida: {
    borderRadius: raio.pilula,
    backgroundColor: cor.infoTinta,
    paddingHorizontal: espaco.tres,
    paddingVertical: 6,
  },
  chipDeMedidaTexto: { ...tipo.meta, color: cor.infoTintaTextoForte },
  chipDeMedidaVazio: {
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.infoBorda,
    paddingHorizontal: espaco.tres,
    paddingVertical: 5,
  },
  chipDeMedidaVazioTexto: { ...tipo.meta, color: cor.infoTintaTexto },

  registrar: {
    height: 66,
    marginHorizontal: margem.listaDeCartoes,
    marginBottom: espaco.seis,
    borderRadius: raio.pilula,
    backgroundColor: cor.acao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registrarTocado: { backgroundColor: cor.acaoPressionada },
  registrarTexto: { ...tipo.rotuloPrimario, fontSize: 20, color: cor.sobreAcao },
});
