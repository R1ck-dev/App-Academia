/**
 * Objetivo de peso: quanto falta, a barra de progresso e a definição da meta.
 *
 * A barra só enche com percentual REAL — `progressoObjetivo` devolve `null`
 * quando não há peso de partida, e barra em 0% mente tanto quanto barra em 100%.
 * Nesse caso a tela diz o que falta para o percentual existir, em vez de desenhar
 * uma barra vazia que parece medição.
 */

import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Aviso, Barra, Botao, CampoNumero, Cartao, Numero } from '@/components/progresso-base';
import { cores, fonte } from '@/constants/tema';
import { definirObjetivoPeso, limparObjetivoPeso } from '@/db/mutations';
import type { Perfil } from '@/db/schema';
import { formatarPeso, parseKg } from '@/dominio/carga';
import { progressoObjetivo, type ProgressoObjetivo } from '@/dominio/corpo';

export function CorpoObjetivo({
  perfil,
  pesoAtualG,
}: {
  perfil: Perfil | undefined;
  pesoAtualG: number | null;
}) {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const objetivoG = perfil?.pesoObjetivoG ?? null;

  function definir() {
    const r = parseKg(texto);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    definirObjetivoPeso(r.gramas);
    setTexto('');
    setErro(null);
  }

  if (objetivoG === null) {
    return (
      <Cartao titulo="Objetivo">
        <Text style={estilos.texto}>Sem objetivo de peso definido.</Text>
        <CampoNumero
          valor={texto}
          aoMudar={(t) => {
            setTexto(t);
            setErro(null);
          }}
          aoConfirmar={definir}
          textoBotao="Definir"
          placeholder="75"
          sufixo="kg"
          erro={erro}
        />
      </Cartao>
    );
  }

  const partidaG = perfil?.pesoInicialG ?? null;
  const progresso =
    pesoAtualG === null
      ? null
      : progressoObjetivo(pesoAtualG, { pesoObjetivoG: objetivoG, pesoInicialG: partidaG });

  return (
    <Cartao titulo="Objetivo">
      <Numero
        valor={formatarPeso(objetivoG)}
        unidade="kg"
        detalhe={progresso === null ? undefined : frase(progresso)}
      />

      {progresso === null ? (
        <Aviso texto="Registre uma pesagem para acompanhar o progresso." />
      ) : (
        <>
          <Barra percentual={progresso.percentual} />
          {progresso.percentual === null || partidaG === null ? (
            <Aviso texto="Sem peso de partida: defina o objetivo de novo depois de uma pesagem para o percentual passar a existir." />
          ) : (
            <Text style={estilos.legenda}>
              {progresso.percentual}% do caminho, partindo de {formatarPeso(partidaG)} kg
            </Text>
          )}
        </>
      )}

      <Botao texto="Remover objetivo" tipo="secundario" aoTocar={limparObjetivoPeso} />
    </Cartao>
  );
}

/**
 * A direção vem do domínio, não do peso de hoje: quem partiu de 82 kg rumo a 75 e
 * hoje está em 74 continua "perdendo", e a frase não pode inverter no dia bom.
 */
function frase(p: ProgressoObjetivo): string {
  if (p.alcancado) return 'objetivo alcançado';
  const falta = `${formatarPeso(p.faltaG)} kg`;
  if (p.direcao === 'perder') return `faltam ${falta} para perder`;
  if (p.direcao === 'ganhar') return `faltam ${falta} para ganhar`;
  return `${falta} fora da meta`;
}

const estilos = StyleSheet.create({
  texto: { color: cores.textoFraco, fontSize: fonte.corpo },
  legenda: { color: cores.textoFraco, fontSize: fonte.legenda },
});
