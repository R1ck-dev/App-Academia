/**
 * A régua de séries: uma cápsula por série do exercício, e é ELA que comunica
 * progresso — não uma frase.
 *
 * Três estados, e a diferença entre eles é a única informação que a tela dá de
 * relance, entre uma série e outra: **feita** (cheia), **aquecimento**
 * (tracejada em sálvia, porque não conta para o alvo) e **a fazer** (tracejada
 * em cinza, mostrando a carga prevista). Registrar preenche a próxima
 * tracejada; desfazer devolve.
 *
 * As cápsulas têm largura igual (`flex: 1`): quatro respiram, e é o caso da
 * ficha inteira dele. Acima de seis a tipografia precisaria encolher — anotado
 * na revisão de conjunto do handoff, e ainda não é o caso.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alvo, cor, espaco, margem, raio, tipo } from '@/constants/tema';
import { formatarNumeroDaCarga, type Carga } from '@/dominio/carga';
import { formatarDuracao } from '@/dominio/datas';
import { temCarga } from '@/dominio/exercicio';
import type { ItemDaSessao } from '@/dominio/execucao';
import type { SerieExecutada } from '@/dominio/volume';
import type { TipoMedicao } from '@/db/schema';

type Conteudo = { principal: string; sub: string };

/**
 * O que cabe numa cápsula de 54 px: a grandeza do exercício em cima, a segunda
 * embaixo. Carga sem repetição (peso corporal) mostra a repetição como número
 * principal — senão a cápsula ficaria vazia num exercício que ele fez.
 */
function conteudoDa(
  esforco: { carga: Carga | null; repeticoes: number | null; duracaoS: number | null },
  tipoMedicao: TipoMedicao
): Conteudo {
  if (temCarga(tipoMedicao) && esforco.carga !== null) {
    return {
      principal: formatarNumeroDaCarga(esforco.carga),
      sub: esforco.repeticoes === null ? '' : String(esforco.repeticoes),
    };
  }
  if (esforco.duracaoS !== null) return { principal: formatarDuracao(esforco.duracaoS), sub: '' };
  if (esforco.repeticoes !== null) return { principal: String(esforco.repeticoes), sub: 'reps' };
  return { principal: '—', sub: '' };
}

export function ReguaDeSeries({
  item,
  aoDesfazer,
}: {
  item: ItemDaSessao;
  aoDesfazer: (serie: SerieExecutada) => void;
}) {
  const ultima = item.feitas.length === 0 ? null : item.feitas[item.feitas.length - 1];
  // Exercício fora da ficha não tem alvo a bater; dizer "0 séries" o
  // transformaria numa dívida que ele nunca contraiu.
  const contador =
    item.seriesAlvo > 0
      ? `${item.contamParaAlvo} de ${item.seriesAlvo} feitas${item.faltam > 0 ? ` · faltam ${item.faltam}` : ''}`
      : `${item.feitas.length} ${item.feitas.length === 1 ? 'série feita' : 'séries feitas'} · fora da ficha`;

  const aFazer = Array.from({ length: item.faltam }, (_, i) => i);
  const prevista = item.proxima;

  return (
    <View style={estilos.bloco}>
      <View style={estilos.linhaDoContador}>
        <Text style={estilos.contador}>{contador}</Text>
        {ultima === null ? null : (
          <Pressable onPress={() => aoDesfazer(ultima)} hitSlop={12}>
            <Text style={estilos.desfazer}>desfazer última</Text>
          </Pressable>
        )}
      </View>

      <View style={estilos.capsulas}>
        {item.feitas.map((serie) => {
          const conteudo = conteudoDa(serie, item.exercicio.tipoMedicao);
          const aquecimento = serie.tipo === 'aquecimento';
          return (
            <View
              key={serie.id}
              style={[estilos.capsula, aquecimento ? estilos.capsulaAquecimento : estilos.capsulaFeita]}
            >
              <Text style={[estilos.principal, aquecimento && estilos.principalAquecimento]}>
                {conteudo.principal}
              </Text>
              <Text style={[estilos.sub, aquecimento && estilos.subAquecimento]}>
                {aquecimento ? 'aquec' : conteudo.sub}
              </Text>
            </View>
          );
        })}

        {aFazer.map((i) => {
          const conteudo =
            prevista === null
              ? { principal: '—', sub: '' }
              : conteudoDa(prevista, item.exercicio.tipoMedicao);
          return (
            <View key={`a-fazer-${i}`} style={[estilos.capsula, estilos.capsulaAFazer]}>
              <Text style={[estilos.principal, estilos.principalFantasma]}>{conteudo.principal}</Text>
              <Text style={[estilos.sub, estilos.subFantasma]}>{conteudo.sub}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { paddingHorizontal: margem.conteudo, paddingTop: espaco.quatro, gap: espaco.dois },
  linhaDoContador: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: espaco.dois,
  },
  contador: { ...tipo.rotuloCompacto, color: cor.texto },
  desfazer: { ...tipo.rotuloCompacto, color: cor.acaoTexto },
  capsulas: { flexDirection: 'row', gap: 7, minHeight: alvo.capsulaDeSerie },
  capsula: {
    flex: 1,
    minWidth: 0,
    height: alvo.capsulaDeSerie,
    borderRadius: raio.pilula,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  capsulaFeita: { backgroundColor: cor.superficie },
  capsulaAquecimento: { borderWidth: 2, borderStyle: 'dashed', borderColor: cor.infoBorda },
  capsulaAFazer: { borderWidth: 2, borderStyle: 'dashed', borderColor: cor.bordaFantasma },
  principal: { ...tipo.numeroPequeno, color: cor.texto },
  principalAquecimento: { color: cor.infoTintaTexto },
  principalFantasma: { color: cor.textoFantasma },
  sub: { fontFamily: tipo.meta.fontFamily, fontSize: 10.5, lineHeight: 12, color: cor.textoTerciario },
  subAquecimento: { color: cor.infoKicker },
  subFantasma: { color: cor.textoFantasma },
});
