/**
 * Medidas corporais: registrar uma circunferência e ver a série daquela parte.
 *
 * A parte escolhida manda nas duas coisas ao mesmo tempo — no que é registrado e
 * no que é exibido —, então trocar de parte não custa um segundo seletor. O lado
 * é sempre explícito ("braço direito", nunca "braço"): medir alternando o lado
 * torna a série temporal inútil, e o vocabulário fixo de `PARTES_CORPO` existe
 * para isso.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Aviso, Barras, CampoNumero, Cartao, Chip, Estatistica } from '@/components/progresso-base';
import { espaco } from '@/constants/tema';
import { registrarMedida } from '@/db/mutations';
import { PARTES_CORPO, type Medida, type ParteCorpo } from '@/db/schema';
import { formatarMedida } from '@/dominio/carga';
import {
  estatisticaDaMedida,
  formatarVariacaoDaMedida,
  parseCentimetros,
  rotuloDaParte,
} from '@/dominio/corpo';
import { formatarData } from '@/dominio/datas';

export function CorpoMedidas({ medidas }: { medidas: readonly Medida[] }) {
  const [parte, setParte] = useState<ParteCorpo>(PARTES_CORPO[0]);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const daParte = medidas.filter((m) => m.parte === parte);
  const estatistica = estatisticaDaMedida(daParte);

  function registrar() {
    const r = parseCentimetros(texto);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    registrarMedida({ parte, valorMm: r.milimetros });
    setTexto('');
    setErro(null);
  }

  return (
    <Cartao titulo="Medidas">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips}>
        {PARTES_CORPO.map((p) => (
          <Chip key={p} texto={rotuloDaParte(p)} ativo={p === parte} aoTocar={() => setParte(p)} />
        ))}
      </ScrollView>

      <CampoNumero
        rotulo={rotuloDaParte(parte)}
        valor={texto}
        aoMudar={(t) => {
          setTexto(t);
          setErro(null);
        }}
        aoConfirmar={registrar}
        textoBotao="Registrar"
        placeholder="38,5"
        sufixo="cm"
        erro={erro}
      />

      {estatistica === null ? (
        <Aviso texto={`Sem medida de ${rotuloDaParte(parte).toLowerCase()} registrada.`} />
      ) : (
        <>
          <View style={estilos.grade}>
            <Estatistica
              rotulo="Atual"
              valor={`${formatarMedida(estatistica.ultimo.valor)} cm`}
              detalhe={formatarData(estatistica.ultimo.instante)}
            />
            <Estatistica
              rotulo="Mudança"
              valor={`${formatarVariacaoDaMedida(estatistica.mudanca)} cm`}
              detalhe={`${estatistica.pontos} medidas desde ${formatarData(estatistica.primeiro.instante)}`}
            />
          </View>
          <Barras
            valores={daParte.map((m) => m.valorMm)}
            inicio={formatarData(estatistica.primeiro.instante)}
            fim={formatarData(estatistica.ultimo.instante)}
          />
        </>
      )}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  chips: { gap: espaco.sm, paddingRight: espaco.sm },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
});
