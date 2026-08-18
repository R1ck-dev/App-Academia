/**
 * Peso atual, registro de pesagem e as últimas pesagens com desfazer.
 *
 * "Dedo errado na balança" é o erro mais comum da aba Corpo — por isso a lista
 * recente existe e cada linha tem `arquivarPesagem` a um toque, em vez de a
 * correção exigir apagar e digitar de novo.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Botao, CampoNumero, Cartao, ItemLista, Numero } from '@/components/progresso-base';
import { cores, espacoLegado as espaco, tamanho as fonte } from '@/constants/tema';
import type { Pesagem } from '@/db/schema';
import { arquivarPesagem, registrarPesagem } from '@/db/mutations';
import { formatarPeso, parseKg } from '@/dominio/carga';
import { formatarData } from '@/dominio/datas';
import { pesoAtual } from '@/dominio/corpo';

/** Quantas pesagens ficam à mão para corrigir. Além disso é histórico, não conserto. */
const RECENTES = 5;

export function CorpoPeso({ pesagens }: { pesagens: readonly Pesagem[] }) {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const atual = pesoAtual(pesagens);
  const recentes = [...pesagens].sort((a, b) => b.medidoEm - a.medidoEm).slice(0, RECENTES);

  function registrar() {
    const r = parseKg(texto);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    registrarPesagem({ pesoG: r.gramas });
    setTexto('');
    setErro(null);
  }

  return (
    <Cartao titulo="Peso">
      {atual === null ? (
        <Text style={estilos.vazio}>Nenhuma pesagem registrada ainda.</Text>
      ) : (
        <Numero
          valor={formatarPeso(atual.pesoG)}
          unidade="kg"
          detalhe={`medido em ${formatarData(atual.medidoEm)}`}
        />
      )}

      <CampoNumero
        valor={texto}
        aoMudar={(t) => {
          setTexto(t);
          setErro(null);
        }}
        aoConfirmar={registrar}
        textoBotao="Registrar"
        placeholder="78,4"
        sufixo="kg"
        erro={erro}
      />

      {recentes.length > 0 ? (
        <View style={estilos.lista}>
          {recentes.map((p) => (
            <ItemLista
              key={p.id}
              titulo={formatarPeso(p.pesoG) + ' kg'}
              detalhe={formatarData(p.medidoEm)}
              acao={
                <Botao texto="Desfazer" tipo="secundario" aoTocar={() => arquivarPesagem(p.id)} />
              }
            />
          ))}
        </View>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  vazio: { color: cores.textoFraco, fontSize: fonte.corpo },
  lista: { marginTop: espaco.sm },
});
