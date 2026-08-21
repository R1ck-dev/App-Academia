/**
 * A ficha e o catálogo — **uma tela só**, e é a decisão do handoff que mais
 * economiza navegação: a ficha é a lista, o catálogo é a folha que sobe. As
 * propriedades do exercício se editam onde você encontra o exercício.
 *
 * O contexto de uso é o oposto da execução: em casa, sentado, uma vez a cada
 * poucas semanas. Por isso aqui cabe formulário, e lá não cabia nem um campo.
 *
 * A decisão mais cara desta tela é o **tipo de medição** — ele diz se o
 * exercício tem carga. Trocá-lo num exercício com histórico deixaria séries sem
 * a carga que o tipo novo exige, e `alterarTipoMedicao` recusa quando já existe
 * série.
 *
 * O catálogo começa VAZIO, de propósito: escolher entre 24 nomes prontos era
 * mais lento do que digitar o nome da máquina que ele tem na frente. Por isso a
 * folha abre direto no modo de criação enquanto não houver exercício nenhum.
 */

import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Folha } from '@/components/folha';
import { useConsulta } from '@/components/progresso-consulta';
import { alvo as alvoDeToque, cor, espaco, margem, raio, tipo } from '@/constants/tema';
import {
  arquivarTreino,
  atualizarItemDoTreino,
  criarExercicio,
  definirCargaAlvo,
  definirItemDoTreino,
  editarTreino,
  removerItemDoTreino,
  reordenarItensDoTreino,
} from '@/db/mutations';
import { itensDoTreino, listarExercicios } from '@/db/queries';
import { TIPOS_MEDICAO, type TipoMedicao } from '@/db/schema';
import { formatarCarga, parseCarga } from '@/dominio/carga';
import { formatarDuracao } from '@/dominio/datas';
import { rotuloDoTipoMedicao, temCarga, type Exercicio } from '@/dominio/exercicio';
import type { ItemDoPlano } from '@/dominio/execucao';

export function TelaDaFicha({
  treinoId,
  nome,
  descricao,
  aoVoltar,
}: {
  treinoId: string;
  nome: string;
  descricao: string | null;
  aoVoltar: () => void;
}) {
  const [itemAberto, setItemAberto] = useState<string | null>(null);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [renomeando, setRenomeando] = useState(false);

  const itens = useConsulta(`Ficha:${treinoId}`, () => itensDoTreino(treinoId));
  const emEdicao = itens.find((i) => i.itemId === itemAberto) ?? null;

  return (
    <SafeAreaView style={estilos.area} edges={['top', 'left', 'right']}>
      <View style={estilos.cabecalho}>
        <View style={estilos.linhaDoTopo}>
          <Text style={estilos.kicker}>Em casa, sentado</Text>
          <Pressable onPress={aoVoltar} hitSlop={12}>
            <Text style={estilos.voltar}>voltar</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setRenomeando(true)}>
          <Text style={estilos.titulo}>
            {nome}
            {descricao === null ? '' : ` — ${descricao}`}
          </Text>
        </Pressable>
        <Text style={estilos.sub}>toque no título para renomear · no exercício para editar</Text>
      </View>

      <ScrollView style={estilos.expandir} contentContainerStyle={estilos.lista}>
        {itens.length > 0 ? null : (
          <Text style={estilos.vazio}>
            Ficha vazia. Acrescente o primeiro exercício — o nome é o que estiver escrito na
            máquina.
          </Text>
        )}

        {itens.map((item, i) => (
          <Pressable
            key={item.itemId}
            style={({ pressed }) => [estilos.linha, pressed && estilos.linhaTocada]}
            onPress={() => setItemAberto(item.itemId)}
          >
            <View style={estilos.ordem}>
              <Text style={estilos.ordemTexto}>{i + 1}</Text>
            </View>
            <Text style={estilos.nomeDoItem}>{item.exercicio.nome}</Text>
            {/* `numberOfLines` no nome e nunca no alvo: nome longo quebra, o
                alvo não pode ser empurrado para fora da tela. */}
            <Text style={estilos.alvoDoItem} numberOfLines={1}>
              {textoDoAlvo(item)}
            </Text>
          </Pressable>
        ))}

        <Pressable
          style={({ pressed }) => [estilos.adicionar, pressed && estilos.adicionarTocado]}
          onPress={() => setCatalogoAberto(true)}
        >
          <Text style={estilos.adicionarTexto}>+ adicionar exercício</Text>
        </Pressable>

        <Pressable style={estilos.apagar} onPress={() => confirmarApagar(nome, treinoId, aoVoltar)}>
          <Text style={estilos.apagarTexto}>Apagar este treino</Text>
        </Pressable>
      </ScrollView>

      {emEdicao === null ? null : (
        <FolhaDoItem
          item={emEdicao}
          posicao={itens.findIndex((i) => i.itemId === emEdicao.itemId)}
          total={itens.length}
          aoMover={(direcao) => {
            const ids = itens.map((i) => i.itemId);
            const de = ids.indexOf(emEdicao.itemId);
            const para = de + direcao;
            if (para < 0 || para >= ids.length) return;
            [ids[de], ids[para]] = [ids[para], ids[de]];
            reordenarItensDoTreino(treinoId, ids);
          }}
          aoFechar={() => setItemAberto(null)}
        />
      )}

      {catalogoAberto ? (
        <FolhaDoCatalogo
          treinoId={treinoId}
          proximaOrdem={itens.length}
          jaNaFicha={itens.map((i) => i.exercicio.id)}
          aoFechar={() => setCatalogoAberto(false)}
        />
      ) : null}

      {renomeando ? (
        <FolhaDoTreino
          nome={nome}
          descricao={descricao}
          aoSalvar={(dados) => {
            editarTreino(treinoId, dados);
            setRenomeando(false);
          }}
          aoFechar={() => setRenomeando(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ── Folha do item ──────────────────────────────────────────────────────────

function FolhaDoItem({
  item,
  posicao,
  total,
  aoMover,
  aoFechar,
}: {
  item: ItemDoPlano;
  posicao: number;
  total: number;
  aoMover: (direcao: 1 | -1) => void;
  aoFechar: () => void;
}) {
  const ex = item.exercicio;
  const [series, setSeries] = useState(String(item.seriesAlvo));
  const [reps, setReps] = useState(item.repsAlvoMin === null ? '' : String(item.repsAlvoMin));
  const [carga, setCarga] = useState(item.cargaAlvo === null ? '' : String(valorDoTexto(item)));
  const [descanso, setDescanso] = useState(String(item.descansoS));
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    const numeroDeSeries = Number(series);
    if (!Number.isInteger(numeroDeSeries) || numeroDeSeries <= 0) {
      setErro('Séries tem que ser um número inteiro maior que zero.');
      return;
    }
    const numeroDeReps = reps.trim() === '' ? null : Number(reps);
    if (numeroDeReps !== null && (!Number.isInteger(numeroDeReps) || numeroDeReps <= 0)) {
      setErro('Repetições tem que ser um número inteiro maior que zero.');
      return;
    }
    const segundos = Number(descanso);
    if (!Number.isInteger(segundos) || segundos < 0) {
      setErro('Descanso em segundos, sem vírgula.');
      return;
    }

    // A carga passa por `definirCargaAlvo` e não por `atualizarItemDoTreino`: a
    // carga da ficha é decisão, e a mutation valida a unidade contra o exercício.
    if (temCarga(ex.tipoMedicao)) {
      if (carga.trim() === '') {
        definirCargaAlvo(item.itemId, null);
      } else {
        const r = parseCarga(carga);
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        definirCargaAlvo(item.itemId, r.carga);
      }
    }

    atualizarItemDoTreino(item.itemId, {
      seriesAlvo: numeroDeSeries,
      repsAlvoMin: numeroDeReps,
      repsAlvoMax: numeroDeReps,
      descansoS: segundos,
    });
    aoFechar();
  }

  function tirar() {
    Alert.alert('Tirar da ficha?', `${ex.nome} sai deste treino. O histórico dele continua.`, [
      { text: 'Manter', style: 'cancel' },
      {
        text: 'Tirar',
        style: 'destructive',
        onPress: () => {
          removerItemDoTreino(item.itemId);
          aoFechar();
        },
      },
    ]);
  }

  return (
    <Folha aoFechar={aoFechar}>
      <View style={estilos.linhaDoTopo}>
        <Text style={estilos.tituloDaFolha}>{ex.nome}</Text>
        <Pressable onPress={aoFechar} hitSlop={12}>
          <Text style={estilos.fechar}>fechar</Text>
        </Pressable>
      </View>
      <Text style={estilos.notaDaFolha}>{textoDoTipo(ex)}</Text>

      <View style={estilos.campos}>
        <Campo rotulo="Séries" valor={series} aoMudar={setSeries} />
        <Campo rotulo="Repetições" valor={reps} aoMudar={setReps} />
        {!temCarga(ex.tipoMedicao) ? null : (
          <Campo
            rotulo="Carga alvo (kg)"
            valor={carga}
            aoMudar={setCarga}
            placeholder="vazio = sem carga"
          />
        )}
        <Campo rotulo="Descanso (s)" valor={descanso} aoMudar={setDescanso} />
      </View>

      {erro === null ? null : <Text style={estilos.erro}>{erro}</Text>}

      <View style={estilos.mover}>
        <Pressable
          disabled={posicao === 0}
          style={[estilos.botaoDeMover, posicao === 0 && estilos.desabilitado]}
          onPress={() => aoMover(-1)}
        >
          <Text style={estilos.botaoDeMoverTexto}>↑ subir</Text>
        </Pressable>
        <Pressable
          disabled={posicao >= total - 1}
          style={[estilos.botaoDeMover, posicao >= total - 1 && estilos.desabilitado]}
          onPress={() => aoMover(1)}
        >
          <Text style={estilos.botaoDeMoverTexto}>↓ descer</Text>
        </Pressable>
      </View>

      <View style={estilos.acoesDaFolha}>
        <Pressable
          style={({ pressed }) => [estilos.salvar, pressed && estilos.salvarTocado]}
          onPress={salvar}
        >
          <Text style={estilos.salvarTexto}>Salvar</Text>
        </Pressable>
        <Pressable style={estilos.secundario} onPress={tirar}>
          <Text style={estilos.secundarioTexto}>Tirar da ficha</Text>
        </Pressable>
      </View>

    </Folha>
  );
}

// ── Folha do catálogo ──────────────────────────────────────────────────────

function FolhaDoCatalogo({
  treinoId,
  proximaOrdem,
  jaNaFicha,
  aoFechar,
}: {
  treinoId: string;
  proximaOrdem: number;
  jaNaFicha: readonly string[];
  aoFechar: () => void;
}) {
  const exercicios = useConsulta('Catalogo', listarExercicios);
  // Catálogo vazio abre direto em "criar": mostrar uma lista sem nada e obrigar
  // a um toque em "criar exercício novo" seria um passo que não decide nada.
  const [criando, setCriando] = useState(exercicios.length === 0);
  const [nome, setNome] = useState('');
  const [medida, setMedida] = useState<TipoMedicao>('carga_kg');
  const [series, setSeries] = useState('4');
  const [reps, setReps] = useState('10');
  const [carga, setCarga] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function adicionar(ex: Exercicio) {
    definirItemDoTreino({
      treinoId,
      exercicioId: ex.id,
      ordem: proximaOrdem,
      seriesAlvo: 4,
      repsAlvoMin: 10,
      repsAlvoMax: 10,
    });
    aoFechar();
  }

  /**
   * Cria e JÁ põe na ficha, com séries, repetições e carga. Antes entrava com
   * 4×10 fixo e sem carga — o que fazia a primeira série do exercício novo cair
   * em "sem referência" e exigir abrir a folha do item para completar.
   */
  function criar() {
    if (nome.trim() === '') {
      setErro('O exercício precisa de um nome.');
      return;
    }
    const numeroDeSeries = Number(series);
    if (!Number.isInteger(numeroDeSeries) || numeroDeSeries <= 0) {
      setErro('Séries tem que ser um número inteiro maior que zero.');
      return;
    }
    const numeroDeReps = reps.trim() === '' ? null : Number(reps);
    if (numeroDeReps !== null && (!Number.isInteger(numeroDeReps) || numeroDeReps <= 0)) {
      setErro('Repetições tem que ser um número inteiro maior que zero.');
      return;
    }
    // Carga em branco é legítima: a estreia cai no teclado da execução.
    let cargaAlvo = null;
    if (temCarga(medida) && carga.trim() !== '') {
      const r = parseCarga(carga);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      cargaAlvo = r.carga;
    }

    try {
      const id = criarExercicio({ nome: nome.trim(), tipoMedicao: medida });
      definirItemDoTreino({
        treinoId,
        exercicioId: id,
        ordem: proximaOrdem,
        seriesAlvo: numeroDeSeries,
        repsAlvoMin: numeroDeReps,
        repsAlvoMax: numeroDeReps,
        cargaAlvo,
      });
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Folha aoFechar={aoFechar}>
      <View style={estilos.linhaDoTopo}>
        <Text style={estilos.tituloDaFolha}>{criando ? 'Exercício novo' : 'Catálogo'}</Text>
        <Pressable onPress={aoFechar} hitSlop={12}>
          <Text style={estilos.fechar}>fechar</Text>
        </Pressable>
      </View>

      {criando ? (
        <>
          <Campo rotulo="Nome" valor={nome} aoMudar={setNome} teclado="default" />
          <Text style={estilos.notaDaFolha}>
            Como ele é medido — isto decide se ele tem carga, e não muda depois da primeira série.
          </Text>
          <View style={estilos.medidas}>
            {TIPOS_MEDICAO.map((t) => {
              const ativo = t === medida;
              return (
                <Pressable
                  key={t}
                  style={[estilos.medida, ativo && estilos.medidaAtiva]}
                  onPress={() => setMedida(t)}
                >
                  <Text style={ativo ? estilos.medidaTextoAtivo : estilos.medidaTexto}>
                    {rotuloDoTipoMedicao(t)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={estilos.campos}>
            <Campo rotulo="Séries" valor={series} aoMudar={setSeries} />
            <Campo rotulo="Repetições" valor={reps} aoMudar={setReps} />
            {!temCarga(medida) ? null : (
              <Campo
                rotulo="Carga alvo (kg)"
                valor={carga}
                aoMudar={setCarga}
                placeholder="vazio = pergunta na hora"
              />
            )}
          </View>

          {erro === null ? null : <Text style={estilos.erro}>{erro}</Text>}
          <View style={estilos.acoesDaFolha}>
            <Pressable style={estilos.salvar} onPress={criar}>
              <Text style={estilos.salvarTexto}>Criar e adicionar</Text>
            </Pressable>
            {exercicios.length === 0 ? null : (
              <Pressable style={estilos.secundario} onPress={() => setCriando(false)}>
                <Text style={estilos.secundarioTexto}>Ver o catálogo</Text>
              </Pressable>
            )}
          </View>
        </>
      ) : (
        <>
          {/* `View` e não `ScrollView`: a própria `Folha` já rola. Duas rolagens
              verticais aninhadas disputam o gesto no Android, e a de dentro
              ganha — deixando a de fora presa quando o dedo cai na lista. */}
          <View style={estilos.rolagemDoCatalogo}>
            {exercicios.map((ex) => (
              <Pressable
                key={ex.id}
                style={({ pressed }) => [estilos.linhaDoCatalogo, pressed && estilos.linhaTocada]}
                onPress={() => adicionar(ex)}
              >
                <Text style={estilos.nomeDoItem}>{ex.nome}</Text>
                <Text style={estilos.medidaDoCatalogo}>
                  {rotuloDoTipoMedicao(ex.tipoMedicao)}
                  {jaNaFicha.includes(ex.id) ? ' · já na ficha' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={estilos.salvar} onPress={() => setCriando(true)}>
            <Text style={estilos.salvarTexto}>Criar exercício novo</Text>
          </Pressable>
        </>
      )}
    </Folha>
  );
}

// ── Folha do treino ────────────────────────────────────────────────────────

/** Renomear a ficha. Não toca no histórico: `sessoes.nome` é cópia da abertura. */
function FolhaDoTreino({
  nome,
  descricao,
  aoSalvar,
  aoFechar,
}: {
  nome: string;
  descricao: string | null;
  aoSalvar: (dados: { nome: string; descricao: string | null }) => void;
  aoFechar: () => void;
}) {
  const [texto, setTexto] = useState(nome);
  const [detalhe, setDetalhe] = useState(descricao ?? '');
  const [erro, setErro] = useState<string | null>(null);

  return (
    <Folha aoFechar={aoFechar}>
      <View style={estilos.linhaDoTopo}>
        <Text style={estilos.tituloDaFolha}>Renomear treino</Text>
        <Pressable onPress={aoFechar} hitSlop={12}>
          <Text style={estilos.fechar}>fechar</Text>
        </Pressable>
      </View>
      <Text style={estilos.notaDaFolha}>
        As sessões já registradas guardam o nome antigo — renomear não reescreve o histórico.
      </Text>

      <Campo rotulo="Nome" valor={texto} aoMudar={setTexto} teclado="default" />
      <Campo
        rotulo="Descrição"
        valor={detalhe}
        aoMudar={setDetalhe}
        teclado="default"
        placeholder="Costas, bíceps e ombros"
      />

      {erro === null ? null : <Text style={estilos.erro}>{erro}</Text>}

      <Pressable
        style={({ pressed }) => [estilos.salvar, pressed && estilos.salvarTocado]}
        onPress={() => {
          if (texto.trim() === '') {
            setErro('O treino precisa de um nome.');
            return;
          }
          aoSalvar({ nome: texto.trim(), descricao: detalhe.trim() === '' ? null : detalhe.trim() });
        }}
      >
        <Text style={estilos.salvarTexto}>Salvar</Text>
      </Pressable>
    </Folha>
  );
}

/** Soft delete: as sessões já feitas continuam no histórico com o nome copiado. */
function confirmarApagar(nome: string, treinoId: string, aoVoltar: () => void) {
  Alert.alert('Apagar este treino?', `${nome} sai da lista. As sessões já feitas continuam no histórico.`, [
    { text: 'Manter', style: 'cancel' },
    {
      text: 'Apagar',
      style: 'destructive',
      onPress: () => {
        arquivarTreino(treinoId);
        aoVoltar();
      },
    },
  ]);
}

// ── Apoio ──────────────────────────────────────────────────────────────────

function Campo({
  rotulo,
  valor,
  aoMudar,
  placeholder,
  teclado = 'decimal-pad',
}: {
  rotulo: string;
  valor: string;
  aoMudar: (t: string) => void;
  placeholder?: string;
  teclado?: 'decimal-pad' | 'default';
}) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.campoRotulo}>{rotulo}</Text>
      <TextInput
        style={estilos.campoEntrada}
        value={valor}
        onChangeText={aoMudar}
        keyboardType={teclado}
        placeholder={placeholder}
        placeholderTextColor={cor.textoDesligado}
      />
    </View>
  );
}

/** O número da carga em quilo, para o campo abrir preenchido. */
function valorDoTexto(item: ItemDoPlano): string {
  const c = item.cargaAlvo;
  return c === null ? '' : String(c.gramas / 1000).replace('.', ',');
}

/** "4×10 · 20 kg" — o plano, do jeito que está escrito na ficha. */
function textoDoAlvo(item: ItemDoPlano): string {
  const partes: string[] = [];
  if (item.seriesAlvo > 0) {
    const reps = item.repsAlvoMax ?? item.repsAlvoMin;
    partes.push(reps === null ? `${item.seriesAlvo} séries` : `${item.seriesAlvo}×${reps}`);
  }
  if (item.cargaAlvo !== null) partes.push(formatarCarga(item.cargaAlvo));
  if (item.duracaoAlvoS !== null) partes.push(formatarDuracao(item.duracaoAlvoS));
  return partes.length === 0 ? 'sem alvo' : partes.join(' · ');
}

function textoDoTipo(ex: Exercicio): string {
  const medida = rotuloDoTipoMedicao(ex.tipoMedicao).toLowerCase();
  if (!temCarga(ex.tipoMedicao) || ex.incremento === null) return `medido em ${medida}`;
  return `medido em ${medida} · degrau de ${formatarCarga(ex.incremento)}`;
}

const estilos = StyleSheet.create({
  /** A rolagem cede o espaço do rodapé fixo em vez de empurrá-lo para fora. */
  expandir: { flex: 1 },
  area: { flex: 1, backgroundColor: cor.fundo },
  cabecalho: { paddingHorizontal: margem.conteudo, paddingTop: espaco.tres, gap: espaco.dois },
  linhaDoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.dois,
  },
  kicker: { ...tipo.kicker, color: cor.infoKicker },
  voltar: { ...tipo.rotuloCompacto, fontSize: 13, color: cor.acaoTexto },
  titulo: { ...tipo.nomeDoExercicio, color: cor.texto },
  sub: { ...tipo.meta, color: cor.textoTerciario },

  lista: {
    paddingHorizontal: margem.listaDeCartoes,
    paddingTop: espaco.quatro,
    paddingBottom: espaco.oito,
    gap: espaco.dois,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.tres,
    paddingVertical: espaco.tres,
    paddingHorizontal: espaco.quatro,
    borderRadius: raio.linhaDeLista,
    backgroundColor: cor.superficie,
    minHeight: alvoDeToque.botaoSecundario,
  },
  linhaTocada: { backgroundColor: cor.acaoTinta },
  ordem: {
    width: 26,
    height: 26,
    borderRadius: raio.pilula,
    backgroundColor: cor.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ordemTexto: { ...tipo.meta, color: cor.textoTerciario },
  nomeDoItem: { flex: 1, minWidth: 0, ...tipo.corpo, color: cor.texto },
  alvoDoItem: { ...tipo.rotuloCompacto, fontSize: 13, color: cor.acaoTexto },
  adicionar: {
    height: 50,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: cor.bordaFraca,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: espaco.um,
  },
  adicionarTocado: { backgroundColor: cor.acaoTinta },
  adicionarTexto: { ...tipo.rotuloForte, color: cor.textoSecundario },


  tituloDaFolha: {
    flex: 1,
    fontFamily: tipo.nomeDoExercicio.fontFamily,
    fontSize: 22,
    lineHeight: 25,
    color: cor.texto,
  },
  fechar: { ...tipo.rotuloCompacto, fontSize: 13, color: cor.acaoTexto },
  notaDaFolha: { ...tipo.metaMenor, color: cor.textoTerciario },

  campos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.tres, marginTop: espaco.tres },
  campo: { flexGrow: 1, flexBasis: '44%', gap: 5 },
  campoRotulo: { ...tipo.meta, color: cor.textoSecundario },
  campoEntrada: {
    height: 46,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    backgroundColor: cor.fundo,
    paddingHorizontal: espaco.quatro,
    ...tipo.corpo,
    fontSize: 15,
    color: cor.texto,
  },
  erro: { ...tipo.corpoMenor, color: cor.acaoTexto },

  mover: { flexDirection: 'row', gap: espaco.dois, marginTop: espaco.dois },
  botaoDeMover: {
    flex: 1,
    height: 42,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desabilitado: { opacity: 0.4 },
  botaoDeMoverTexto: { ...tipo.rotuloCompacto, color: cor.textoSecundario },

  acoesDaFolha: { flexDirection: 'row', gap: espaco.dois, marginTop: espaco.dois },
  salvar: {
    flex: 1,
    height: 52,
    borderRadius: raio.pilula,
    backgroundColor: cor.acao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  salvarTocado: { backgroundColor: cor.acaoPressionada },
  salvarTexto: { ...tipo.rotuloForte, fontSize: 15, color: cor.sobreAcao },
  secundario: {
    height: 52,
    paddingHorizontal: espaco.quatro,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secundarioTexto: { ...tipo.rotuloForte, color: cor.textoSecundario },

  rolagemDoCatalogo: { marginVertical: espaco.dois },
  vazio: { ...tipo.corpoMenor, color: cor.textoSecundario, paddingBottom: espaco.dois },
  apagar: { marginTop: espaco.seis, alignItems: 'center', paddingVertical: espaco.tres },
  apagarTexto: { ...tipo.rotuloCompacto, color: cor.textoTerciario },
  linhaDoCatalogo: {
    paddingVertical: espaco.tres,
    paddingHorizontal: espaco.quatro,
    borderRadius: raio.linhaDeLista,
    backgroundColor: cor.fundo,
    marginBottom: espaco.um,
    gap: 2,
  },
  medidaDoCatalogo: { ...tipo.metaMenor, color: cor.textoTerciario },
  medidas: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: espaco.dois },
  medida: {
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cor.borda,
    paddingHorizontal: espaco.tres,
    paddingVertical: 7,
  },
  medidaAtiva: { backgroundColor: cor.acao, borderColor: cor.acao },
  medidaTexto: { ...tipo.rotuloCompacto, color: cor.textoSecundario },
  medidaTextoAtivo: { ...tipo.rotuloCompacto, color: cor.sobreAcao },
});
