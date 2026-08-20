/**
 * As folhas de digitar da aba Corpo: peso, altura, objetivo e medida.
 *
 * Quatro entradas com a mesma forma — um número, uma unidade, um botão — e por
 * isso um componente só, parametrizado. O que muda entre elas é a validação, e
 * essa vem inteira do domínio (`parseKg`, `parseAltura`, `parseCentimetros`):
 * a folha nunca decide se 300 kg é plausível, ela só mostra a frase que o
 * domínio devolveu.
 *
 * Folha e não tela: registrar a pesagem da manhã é o gesto frequente aqui, e
 * navegar para uma tela e voltar por causa de um número seria atrito puro.
 */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { cor, espaco, margem, raio, sombraDaFolha, tipo } from '@/constants/tema';
import {
  definirObjetivoPeso,
  registrarMedida,
  registrarPesagem,
  salvarAltura,
} from '@/db/mutations';
import { PARTES_CORPO, type ParteCorpo } from '@/db/schema';
import { parseAltura, parseCentimetros, rotuloDaParte } from '@/dominio/corpo';
import { parseKg } from '@/dominio/carga';

type Resultado = { ok: true; valor: number } | { ok: false; erro: string };

function FolhaDeCampo({
  titulo,
  nota,
  sufixo,
  placeholder,
  inicial,
  interpretar,
  gravar,
  aoFechar,
  children,
}: {
  titulo: string;
  nota?: string;
  sufixo: string;
  placeholder: string;
  inicial?: string;
  interpretar: (texto: string) => Resultado;
  gravar: (valor: number) => void;
  aoFechar: () => void;
  children?: React.ReactNode;
}) {
  const [texto, setTexto] = useState(inicial ?? '');
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    const r = interpretar(texto);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    gravar(r.valor);
    aoFechar();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={aoFechar}>
      <View style={estilos.fundo}>
        <Pressable style={estilos.area} onPress={aoFechar} />
        <View style={estilos.folha}>
          <Text style={estilos.titulo}>{titulo}</Text>
          {nota ? <Text style={estilos.nota}>{nota}</Text> : null}

          {children}

          <View style={estilos.campoCaixa}>
            <TextInput
              style={estilos.campo}
              value={texto}
              onChangeText={(t) => {
                setTexto(t);
                setErro(null);
              }}
              onSubmitEditing={salvar}
              placeholder={placeholder}
              placeholderTextColor={cor.textoDesligado}
              keyboardType="decimal-pad"
              returnKeyType="done"
              autoFocus
              selectTextOnFocus
            />
            <Text style={estilos.sufixo}>{sufixo}</Text>
          </View>
          {erro === null ? null : <Text style={estilos.erro}>{erro}</Text>}

          <Pressable
            style={({ pressed }) => [estilos.salvar, pressed && estilos.salvarTocado]}
            onPress={salvar}
          >
            <Text style={estilos.salvarTexto}>Salvar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function FolhaDePeso({ aoFechar }: { aoFechar: () => void }) {
  return (
    <FolhaDeCampo
      titulo="Registrar peso"
      sufixo="kg"
      placeholder="78,4"
      interpretar={(t) => {
        const r = parseKg(t);
        return r.ok ? { ok: true, valor: r.gramas } : { ok: false, erro: r.erro };
      }}
      gravar={(gramas) => registrarPesagem({ pesoG: gramas })}
      aoFechar={aoFechar}
    />
  );
}

export function FolhaDeAltura({
  alturaMm,
  aoFechar,
}: {
  alturaMm: number | null;
  aoFechar: () => void;
}) {
  return (
    <FolhaDeCampo
      titulo="Sua altura"
      nota="Sem altura não há IMC."
      sufixo="m"
      placeholder="1,75"
      inicial={alturaMm === null ? '' : String(alturaMm / 1000)}
      interpretar={(t) => {
        const r = parseAltura(t);
        return r.ok ? { ok: true, valor: r.milimetros } : { ok: false, erro: r.erro };
      }}
      gravar={salvarAltura}
      aoFechar={aoFechar}
    />
  );
}

export function FolhaDeObjetivo({ aoFechar }: { aoFechar: () => void }) {
  return (
    <FolhaDeCampo
      titulo="Um objetivo de peso"
      // A partida fica gravada junto: sem ela o app sabe quanto falta, e não
      // quanto do caminho já foi feito (`progressoObjetivo.percentual`).
      nota="O peso de hoje vira a partida da conta."
      sufixo="kg"
      placeholder="75"
      interpretar={(t) => {
        const r = parseKg(t);
        return r.ok ? { ok: true, valor: r.gramas } : { ok: false, erro: r.erro };
      }}
      gravar={(gramas) => definirObjetivoPeso(gramas)}
      aoFechar={aoFechar}
    />
  );
}

export function FolhaDeMedida({ aoFechar }: { aoFechar: () => void }) {
  const [parte, setParte] = useState<ParteCorpo>(PARTES_CORPO[0]);

  return (
    <FolhaDeCampo
      titulo="Medida com a trena"
      sufixo="cm"
      placeholder="38,5"
      interpretar={(t) => {
        const r = parseCentimetros(t);
        return r.ok ? { ok: true, valor: r.milimetros } : { ok: false, erro: r.erro };
      }}
      gravar={(milimetros) => registrarMedida({ parte, valorMm: milimetros })}
      aoFechar={aoFechar}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.partes}
      >
        {PARTES_CORPO.map((p) => {
          const ativo = p === parte;
          return (
            <Pressable
              key={p}
              onPress={() => setParte(p)}
              style={[estilos.parte, ativo && estilos.parteAtiva]}
            >
              <Text style={ativo ? estilos.parteTextoAtivo : estilos.parteTexto}>
                {rotuloDaParte(p)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </FolhaDeCampo>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(46,43,37,0.5)', justifyContent: 'flex-end' },
  area: { flex: 1 },
  folha: {
    backgroundColor: cor.superficieElevada,
    borderTopLeftRadius: raio.folha,
    borderTopRightRadius: raio.folha,
    paddingHorizontal: margem.conteudo,
    paddingTop: espaco.seis,
    paddingBottom: espaco.oito,
    gap: espaco.dois,
    ...sombraDaFolha,
  },
  titulo: {
    fontFamily: tipo.nomeDoExercicio.fontFamily,
    fontSize: 26,
    lineHeight: 29,
    color: cor.texto,
  },
  nota: { ...tipo.corpoMenor, color: cor.textoSecundario },
  campoCaixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.dois,
    height: 62,
    paddingHorizontal: espaco.quatro,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    backgroundColor: cor.fundo,
    marginTop: espaco.dois,
  },
  campo: { flex: 1, fontFamily: tipo.numeroPequeno.fontFamily, fontSize: 24, color: cor.texto },
  sufixo: { ...tipo.corpo, color: cor.textoTerciario },
  erro: { ...tipo.corpoMenor, color: cor.acaoTexto },
  salvar: {
    height: 56,
    borderRadius: raio.pilula,
    backgroundColor: cor.acao,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: espaco.dois,
  },
  salvarTocado: { backgroundColor: cor.acaoPressionada },
  salvarTexto: { ...tipo.rotuloPrimario, fontSize: 21, color: cor.sobreAcao },
  partes: { gap: 7, paddingVertical: espaco.dois },
  parte: {
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.infoBorda,
    paddingHorizontal: espaco.tres,
    paddingVertical: 6,
  },
  parteAtiva: { backgroundColor: cor.info, borderColor: cor.info },
  parteTexto: { ...tipo.rotuloCompacto, color: cor.infoTintaTexto },
  parteTextoAtivo: { ...tipo.rotuloCompacto, color: cor.sobreAcao },
});
