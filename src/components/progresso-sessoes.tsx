/**
 * As sessões finalizadas, mais recentes primeiro.
 *
 * O volume só aparece quando existe. Sessão inteira de abdominal e esteira soma
 * zero — e "0 kg·rep" ao lado de 24 séries seria uma mentira com cara de número.
 */

import { StyleSheet, View } from 'react-native';

import { Aviso, ItemLista } from '@/components/progresso-base';
import { espaco, margem } from '@/constants/tema';
import type { ResumoDeSessao } from '@/db/queries';
import { formatarVolume } from '@/dominio/carga';
import { formatarDataComAno, formatarHora } from '@/dominio/datas';

export function ProgressoSessoes({ sessoes }: { sessoes: readonly ResumoDeSessao[] }) {
  if (sessoes.length === 0) {
    return (
      <Aviso texto="Nenhuma sessão finalizada ainda. Termine um treino na aba Treino para ele aparecer aqui." />
    );
  }

  return (
    <View style={estilos.lista}>
      {sessoes.map((s) => (
        <ItemLista
          key={s.id}
          titulo={s.nome}
          detalhe={`${formatarDataComAno(s.iniciadaEm)} · ${formatarHora(s.iniciadaEm)}`}
          valor={`${s.totalSeries} ${s.totalSeries === 1 ? 'série' : 'séries'}`}
          valorDetalhe={textoDoVolume(s)}
        />
      ))}
    </View>
  );
}

function textoDoVolume(s: ResumoDeSessao): string {
  if (s.gramasReps === 0) return 'sem volume em kg';
  return formatarVolume(s.gramasReps);
}

const estilos = StyleSheet.create({
  lista: { gap: espaco.dois, paddingHorizontal: margem.listaDeCartoes, paddingTop: espaco.dois },
});
