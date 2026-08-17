/**
 * IMC, categoria e faixa de peso normal — e o campo de altura, que é o que falta
 * para os três existirem.
 *
 * Sem altura a tela PEDE a altura em vez de mostrar espaço vazio: `calcularImc`
 * devolve `null` e é a única coisa que o Henrique pode fazer a respeito.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Aviso, Botao, CampoNumero, Cartao, Numero } from '@/components/progresso-base';
import { cores, espaco, fonte } from '@/constants/tema';
import { salvarAltura } from '@/db/mutations';
import type { Perfil } from '@/db/schema';
import { formatarPeso } from '@/dominio/carga';
import {
  calcularImc,
  faixaPesoNormal,
  formatarAltura,
  formatarImc,
  parseAltura,
  rotuloCategoria,
} from '@/dominio/corpo';

export function CorpoImc({
  perfil,
  pesoAtualG,
}: {
  perfil: Perfil | undefined;
  pesoAtualG: number | null;
}) {
  const alturaMm = perfil?.alturaMm ?? null;
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    const r = parseAltura(texto);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    salvarAltura(r.milimetros);
    setTexto('');
    setErro(null);
    setEditando(false);
  }

  const pedindoAltura = alturaMm === null || editando;

  if (pedindoAltura) {
    return (
      <Cartao titulo="IMC">
        <Text style={estilos.texto}>
          {alturaMm === null
            ? 'Informe sua altura para o IMC aparecer.'
            : `Altura atual: ${formatarAltura(alturaMm)} m.`}
        </Text>
        <CampoNumero
          rotulo="Altura"
          valor={texto}
          aoMudar={(t) => {
            setTexto(t);
            setErro(null);
          }}
          aoConfirmar={salvar}
          textoBotao="Salvar"
          placeholder="1,78"
          sufixo="m"
          erro={erro}
        />
        {alturaMm === null ? null : (
          <Botao texto="Cancelar" tipo="secundario" aoTocar={() => setEditando(false)} />
        )}
      </Cartao>
    );
  }

  const imc = pesoAtualG === null ? null : calcularImc(pesoAtualG, alturaMm);
  const faixa = faixaPesoNormal(alturaMm);

  return (
    <Cartao titulo="IMC">
      {imc === null ? (
        <Aviso texto="Registre uma pesagem para o IMC aparecer." />
      ) : (
        <Numero valor={formatarImc(imc.centesimos)} detalhe={rotuloCategoria(imc.categoria)} />
      )}

      <View style={estilos.rodape}>
        <Text style={estilos.legenda}>
          {faixa === null
            ? ''
            : `Peso normal para ${formatarAltura(alturaMm)} m: ${formatarPeso(faixa.minimoG)}–${formatarPeso(faixa.maximoG)} kg`}
        </Text>
        <Botao texto="Alterar altura" tipo="secundario" aoTocar={() => setEditando(true)} />
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  texto: { color: cores.textoFraco, fontSize: fonte.corpo },
  legenda: { color: cores.textoFraco, fontSize: fonte.legenda, flex: 1 },
  rodape: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
});
