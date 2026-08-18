# Handoff — app de academia (Henrique)

Pacote de design para integrar. Escrito para ser lido sozinho: quem não estava na conversa
consegue implementar só com este arquivo.

---

## 1. O que tem aqui dentro

| Arquivo | O que é |
| --- | --- |
| `Academia - fluxo v2.dc.html` | **A direção aprovada.** As 8 telas em Organic (creme/terracota), dispostas na ordem do fluxo e interativas, compartilhando uma sessão de mentira. |
| `Academia - telas.dc.html` | A primeira rodada, em Industry (aço sobre fundo escuro): protótipo navegável + 7 variações de mecanismo, hierarquia, navegação e tema claro. Referência de alternativas, não de estilo final. |
| `tema.ts` | Os tokens da direção aprovada, prontos para `StyleSheet` — é o "arquivo de tema centralizando os tokens" pedido no Prompt 0. |
| `revisao-de-conjunto.md` | As respostas do Prompt Z, incluindo o que quebra com um ano de dados e as dependências a instalar. |
| `support.js`, `_ds/` | O que os HTMLs precisam para abrir localmente. Abra o `.dc.html` direto no navegador. |

## 2. Sobre os arquivos de design

Os arquivos deste pacote são **referências de design feitas em HTML** — protótipos que mostram
aparência e comportamento pretendidos, não código de produção para copiar. A tarefa é
**recriar estas telas no ambiente do app** (Expo SDK 57 / React Native 0.86 / TypeScript strict,
`StyleSheet.create`, Expo Router), com os padrões que já existem no repositório.

Nada no HTML consulta banco. Cada tela é um **componente de apresentação puro**: recebe tudo por
props tipadas, e o estado interno é só de UI (ajuste da série antes de confirmar, aba selecionada,
folha aberta). É assim que os `.tsx` devem nascer.

## 3. Fidelidade

**Alta fidelidade.** Cores, tipografia, espaçamento, raios e alvos de toque são finais e estão
listados abaixo em valores exatos. Recrie fielmente. Onde o HTML e este README divergirem, este
README manda.

## 4. Tokens

Direção **Organic**. Fundo claro e quente; terracota é a única cor de ação; sálvia é a segunda voz
(aquecimento, calibração, informação secundária).

**Cor**

| Papel | Hex | Onde |
| --- | --- | --- |
| Fundo da tela | `#f5ead8` | toda tela |
| Superfície (cartão, faixa) | `#ebddc5` | cartões de treino, chips, blocos de leitura |
| Superfície elevada (folha) | `#f9f4ed` | folhas e diálogos |
| Texto | `#201e1d` | tudo |
| Texto secundário | `#645c50` | descrições |
| Texto terciário / meta | `#82796a` | datas, unidades, notas |
| Texto desligado | `#a19786` | valor ausente ("— kg") |
| Borda | `#dcd3c4` | botões secundários, campos |
| Borda fraca | `#c0b6a5` | tracejados |
| **Ação (terracota)** | `#c67139` | preenchimento de botão primário, curva, "+" |
| Terracota — texto sobre claro | `#8c491a` | links, números de destaque |
| Terracota — tinta clara | `#ffe1d0` | pílula de posição da série, aviso de backup |
| Terracota — contorno de atenção | `#f6a06b` | cartão de divergência da ficha |
| Terracota — texto sobre tinta | `#643312` | corpo dentro de `#ffe1d0` |
| **Sálvia (2ª voz)** | `#7a8a5e` | botões de calibrar/sessão de ontem |
| Sálvia — borda | `#aebf92` | círculo tracejado do aquecimento |
| Sálvia — tinta clara | `#e1eecc` | blocos de calibração, chips de medida |
| Sálvia — texto sobre tinta | `#56633f` / `#3d472b` | corpo dentro de `#e1eecc` |
| Sálvia — kicker | `#728157` | rótulos em caixa alta |
| Moldura do aparelho (mock) | `#2e2b25` | só no protótipo, não é UI |

Regra que não pode quebrar: **terracota é ação, sálvia é informação.** Nunca as duas no mesmo
componente pequeno.

**Tipografia** — duas famílias, empacotadas no app (ver dependências):

| Uso | Família | Tamanho / entrelinha |
| --- | --- | --- |
| Número grande (carga, reps, minutos) | Caprasimo 400 | 84 / 0.90 |
| Título de tela | Caprasimo 400 | 34–40 / 1.02 |
| Nome do exercício em execução | Caprasimo 400 | 30 / 1.06 |
| Volume, peso corporal | Caprasimo 400 | 40–44 / 1.05 |
| Rótulo de botão primário | Caprasimo 400 | 21–25 |
| Kicker (caixa alta) | Figtree 700 | 11 / 1, `letterSpacing 1.8` (≈.16em) |
| Título de item, rótulo forte | Figtree 700 | 14–17 / 1.2 |
| Corpo | Figtree 400 | 13–14.5 / 1.5–1.65 |
| Meta, nota, unidade | Figtree 400 | 11.5–12.5 / 1.5 |

Nunca use uma condensada nem uma geométrica: Caprasimo é a única voz de display.

**Espaço, raio, alvo**

- Passo de espaçamento: `4.4 · 8.8 · 13.2 · 17.6 · 26.4 · 35.2` (escala do Organic, densidade 1.10×).
  Na prática: 24 nas laterais de conteúdo, 20 nas laterais de listas de cartão, 8–12 entre cartões.
- Raio: **999** em botão, campo, chip e círculo; **28** em contêiner/cartão de leitura; **24** em
  linha de lista; **34** no topo da folha; nada de canto reto.
- Alvos de toque: **Registrar 96** de altura (largura restante), **Aquecimento 96×96** circular,
  **± carga 70×70** circular, **± reps 44×40**, botões secundários **42–52**, chips **30–34**.
  Nada abaixo de 44 no caminho do treino.
- Sombra: só na folha (`0 -12px 32px rgba(46,43,37,.14)`). O resto é plano — a hierarquia vem do
  raio e da cor.

## 5. As telas

Numeração igual à do protótipo. Tela = 390×844 (Android, retrato, uma mão, destro).

### 1. Abrir o app — `TelaDeAbertura`
**Faz:** escolher o treino do dia; retomar; resolver sessão esquecida.
**Layout:** barra de status 34; kicker sálvia + título Caprasimo 40 (pad 24); lista de 3 cartões
(pad lateral 20, gap 12) — cada cartão: pílula-círculo 58 com a letra (terracota quando é o
selecionado, `#a19786` quando não), nome do grupo Figtree 700 17, contagem 12.5 `#645c50`,
"há N dias" 11.5 à direita; raio 28, fundo `#ebddc5`, borda 2 transparente (`#c67139` no
selecionado, com fundo `#ffe1d0`).
**Sessão de ontem:** bloco `#e1eecc` raio 28 com dois botões pílula — "Continuar nela" (sálvia
cheia) e "Fechar às 19:34" (contorno sálvia). Fechar grava o **instante da última série**, nunca
"agora".
**Sessão de hoje:** o app **abre direto na execução** — zero toque. O cartão de retomada só existe
como caminho de volta.
**Rodapé:** "Último backup há 47 dias" + "Exportar" (`#8c491a`, 13 bold). Aparece só acima de 30
dias. É aqui que o lembrete de backup vive, não no resumo.
**Props:** `treinos`, `sessaoAberta`, `seriesDaSessaoAberta`, `onIniciar`, `onRetomar`,
`onFinalizarNoUltimoInstante`.

### 2. Executar — `TelaDeExecucao` (a tela que decide o projeto)
**Faz:** registrar a série em **um toque**.
**Layout, de cima para baixo:** nome do treino Figtree 700 16 + "N de M séries · tela acordada"
11.5; botão "Finalizar" pílula contorno 40 à direita. Trilha do treino: um círculo por exercício,
14 (18 no atual), preenchido terracota quando completo, contorno terracota + fundo `#ffe1d0` no
atual, contorno `#dcd3c4` nos futuros. Nome do exercício Caprasimo 30. Linha de contexto: pílula
`#ffe1d0`/`#8c491a` com "3ª de 4", depois a procedência em texto, depois o descanso.
**Controle:** `−` 70 circular contorno · número Caprasimo 84 centralizado + unidade 14.5 ·
`+` 70 circular **cheio de terracota** (o lado do polegar direito). Sob o número, a linha do til
quando a placa está calibrada.
**Reps:** faixa `#ebddc5` raio 28, "repetições 10" com ± 44×40. Não existe em esteira nem em peso
corporal.
**Régua de séries** (é o que comunica progresso, não texto): uma linha acima com o contador em
Figtree 700 12.5 — "2 de 4 feitas · faltam 2" — e "desfazer última" em `#8c491a` à direita, sempre
visível quando há algo a desfazer (sem contador de 5 s). Abaixo, uma cápsula por série do
exercício, `flex: 1` de largura igual, altura **54**, raio 999, empilhando a carga em Caprasimo 21
sobre a repetição em 10.5. Três estados:
- **feita** — fundo `#ebddc5`, número `#201e1d`, sub `#82796a`;
- **aquecimento** — transparente, borda 2 **tracejada** `#aebf92`, número `#56633f`, sub `#728157`
  escrito "aquec";
- **a fazer** — transparente, borda 2 **tracejada** `#d2c8b7`, número e sub `#bdb3a2`, mostrando a
  carga prevista.
Registrar preenche a próxima tracejada; desfazer devolve. Exercício fora da ficha (`seriesAlvo: 0`)
não tem cápsulas a fazer e o contador vira "3 séries feitas · fora da ficha".
**Ação:** círculo tracejado sálvia 96 "Aquec. / não conta" + botão pílula terracota 96 de altura,
"Registrar" Caprasimo 25 com subrótulo 12.5 dizendo **o que vai ser gravado** ("6 placas × 10").
O subrótulo é o extrato e a confirmação ao mesmo tempo.
**Estado interno de UI:** ajuste de carga/reps da série corrente. Morre quando a série é gravada.
**Props:** `plano: PlanoDaSessao`, `onConfirmar(sugerida, tipo)`, `onDesfazer(serieId)`,
`onFinalizar()`. A tela **não calcula nada**: carga e reps vêm de `item.proxima`.
**Palavras de procedência** (de `origemCarga`): `mesmo_indice_sessao_anterior` → "igual à semana
passada"; `plano` → "da ficha"; `ajuste_de_hoje` → "o que você fez hoje"; `sem_referencia` →
"primeira vez — informe a carga" (e o número vira `—`, o toque principal passa a ser digitar).
**Exercício fora da ficha** (`seriesAlvo: 0`): a pílula diz "fora da ficha · 2ª", nunca "0 séries".

### 3. Resumo — `TelaDeResumo`
**Faz:** fechar o dia; é a **única** tela onde a ficha muda.
**Layout:** kicker com treino e duração; "Terminado" Caprasimo 38; volume Caprasimo 44 em
`#8c491a` **com til quando qualquer parcela veio de placa convertida**; subtítulo com nº de séries
somadas e quanto veio da conversão.
**Fora da soma:** bloco `#ebddc5` raio 28, uma linha por exercício: nome à esquerda, "N× · motivo"
à direita (`aquecimento`, `peso corporal`, `só duração`, `placa sem calibração`). Sem sessão
registrada, escreve "Nada registrado ainda."; sem nada de fora, "Tudo entrou na conta."
**Divergência:** cartão com **contorno `#f6a06b` 2px** (o único contorno de atenção do app),
os dois números visíveis em negrito e um botão pílula terracota "Atualizar a ficha para 6 placas".
Depois de tocar, o botão vira estado `#e1eecc` "Ficha atualizada para 6 placas". Nunca automático.
As cargas são listadas como aconteceram ("6 placas em 2 séries, 8 placas em 1 série").
**Recorde:** círculo terracota 34 com ★ + uma linha. Sem recorde: "Nenhum recorde hoje."
**Props:** `nome`, `volume: VolumeDaSessao`, `recordes`, `divergencias: Divergencia[]`,
`onAtualizarFicha(d)`, `onConcluir()`.

### 4. Histórico — `TelaDeHistorico`
**Faz:** "estou evoluindo neste exercício" e "o que treinei".
**Layout:** título; fila de chips-pílula de exercício (selecionado = terracota cheio); nome
Caprasimo 26 + linha "medido em placa · 6 sessões · 23 séries"; gráfico; recordes; convite de
calibração.
**Gráfico:** 350×132 — 3 linhas de grade `#dcd3c4` 2px, polilinha terracota 4px com pontas
redondas, pontos = círculo r7 preenchido com o fundo e contorno terracota 4. **Os rótulos são
texto, não SVG:** coluna do eixo à esquerda (11px `#82796a`) e datas centradas sob cada ponto
(10.5px). Um ponto = **uma sessão**.
**A escala é a unidade do exercício** — nunca dois eixos no mesmo gráfico: carga em placas, carga
em kg, minutos na esteira, repetições em peso corporal. Calibrar **não** muda o eixo.
**Casos que precisam existir:** um único ponto → sem curva, só o número grande em bloco `#ebddc5`
com a data ("Uma sessão registrada, em 12/08"); nunca registrado → o alvo da ficha e nada mais.
**Recordes:** lista rótulo/valor; o que não existe naquela unidade aparece em `#82796a`
("1RM estimado — não existe em placa", "Volume — não se soma: sem carga e sem repetição").
**Props:** `sessoes`, `exercicios`, `detalhe`, `progressao`, `recordes`,
`onEscolherExercicio(id)`; use `valorDaProgressao(ponto, exercicio)` para o eixo.

### 5. Corpo — `TelaDeCorpo`
**Faz:** registrar pesagem (ação frequente); ler objetivo, IMC, tendência, medidas.
**Vazia (estado real de hoje):** círculo tracejado 96 vazio + "— kg" Caprasimo 34 em `#a19786` +
"Nenhuma pesagem ainda"; botão pílula terracota 74 "Registrar peso"; três convites em linhas
`#ebddc5` raio 28 (altura, objetivo, medidas) com a ação em `#8c491a`; e no rodapé, em 12px
`#82796a`: "A tendência aparece com 4 pesagens em 14 dias." **Não existe lugar reservado esperando
um número** — é a correção deliberada do Weight Fit.
**Cheia:** anel de progresso do objetivo (`stroke-width 12`, trilha `#dcd3c4`, arco terracota,
`stroke-linecap round`) ao lado do peso Caprasimo 40; sob ele "média de 7 dias" e "faltam 3,4 kg ·
de 82 para 75" — a direção vem da **partida**, e `faltaG` nunca fica negativo. Sparkline dupla:
fina `#dcd3c4` (cada pesagem) e grossa terracota (média de 7 dias), com a legenda "linha fina:
cada pesagem · grossa: média de 7 dias". Três linhas de leitura (tendência com nº de pesagens e dias, IMC com a altura,
faixa normal). Medidas como chips `#e1eecc` + chip contorno "3 de 12 partes" — nunca um
formulário de 12 campos.
**Props:** `perfil`, `pesagens`, `medidas`, `progresso`, `imc`, `faixaNormal`,
`estatistica`, `onRegistrarPeso`, `onRegistrarMedida`, `onDefinirObjetivo`, `onSalvarAltura`,
`onArquivarPesagem`. Com `ritmo.suficiente === false`, escreva o motivo; o `if` é obrigatório.

### 6. Ficha e catálogo — `TelaDaFicha` + folha `FolhaDoItem` / `FolhaDoCatalogo`
**Uma tela, não duas.** A ficha é a lista; o catálogo é a folha que sobe. As propriedades do
exercício se editam onde você encontra o exercício.
**Layout:** kicker "Em casa, sentado"; título Caprasimo 30 com o nome longo do treino; linhas de
lista raio 24 fundo `#ebddc5`, com círculo de ordem 26, nome 14 (`text-wrap: pretty`, pode ter
duas linhas) e o alvo à direita em `#8c491a` 13 bold, `whiteSpace: nowrap` — **o alvo nunca é
empurrado fora da tela**; nomes longos ("Elevação Frontal c/ Halteres", "Desenvolvimento
Articulado") quebram, o alvo não. Último item: botão tracejado "+ adicionar do catálogo".
**Folha do item:** raio 34 no topo, 4 campos pílula (séries, repetições, carga alvo, descanso),
"Salvar" terracota + "Tirar da ficha" contorno, e a nota "Trocar a unidade de medição fica no
catálogo." — em exercício com histórico é conversão destrutiva, e é lá que ela vive, com o aviso à
altura. Carga alvo é **nula** em peso corporal e esteira, nunca zero.
**Props:** `treinos`, `itensDoTreino`, `exercicios`, `onSalvarItem`, `onRemoverItem`,
`onReordenar`, `onCriarExercicio`, `onEditarExercicio`, `onArquivar`.

### 7. Calibrar a placa — `FolhaDeCalibracao`
**Onde aparece:** no detalhe daquele exercício no histórico, como bloco sálvia `#e1eecc` —
"Sabe quanto pesa cada placa?". **Nunca durante o treino, nunca num menu de ajustes.**
**Folha:** título Caprasimo 26; uma linha dizendo onde achar o número ("Está na etiqueta da
máquina."); 4 pílulas de peso (2,5 / 5 / 7,5 / 10 kg) — a escolhida fica sálvia cheia; "Não sei" e
"descalibrar". O valor escolhido fica guardado (`gramasPorPlaca`), e é dele que sai a leitura
"6 placas (~30 kg)" no histórico e o "~30 kg" sob o número na execução — **sempre com o til, nunca
com uma justificativa ao lado**.
**Efeito:** o histórico inteiro daquele exercício ganha a leitura em kg, o resumo passa a contar
aquele volume como aproximado, **e o gráfico continua em placas.**
**Props:** `exercicio`, `onCalibrar(gramasPorPlaca: number | null)`.

### 8. Backup — `TelaDeBackup`
**Layout:** bloco `#ffe1d0` raio 28: "Último backup: 30/06" Caprasimo 24 em `#8c491a` + "Há 47
dias. Desde então: 14 sessões e 9 pesagens que só existem neste aparelho." — risco dito em número,
sem vermelho de alarme. "Exportar tudo" pílula terracota 70. No rodapé, a frase do que restaurar
faz + botão contorno.
**Diálogo de restauração:** raio 34, conta em negrito o que existe hoje ("151 sessões e 96
pesagens"), diz que substitui tudo e que não há como voltar; ações "Cancelar" (contorno) e
"Escolher arquivo" (terracota).

## 6. Interações e movimento

- **Registrar:** ao confirmar, o número grande **voa** até a fila de chips — `translateY(+232)` +
  `scale(0.22)` + `opacity 0`, **540 ms**, `cubic-bezier(.4, 0, .2, 1)`. É a única animação do
  app. Acompanhe com `expo-haptics` (impacto médio): ele não está olhando a tela quando toca.
- **Descanso:** derivado do **instante de término** (`fimDoDescanso`), nunca de soma de ticks —
  voltar 3 min depois mostra "descanso concluído". Exibição discreta, ao lado da série ("· descanso
  0:47"), sem barra e sem tomar a tela.
- **Tela acordada:** `expo-keep-awake` ativo durante a execução; a linha "tela acordada" no
  cabeçalho é a prova visível para o usuário.
- **Desfazer:** sempre disponível enquanto houver série na sessão; sem janela de tempo.
- **Estados de toque:** `:hover` não existe em Android. Use `activeOpacity`/`pressed` com um passo
  da rampa: terracota `#c67139` → `#b2622d` pressionado; contorno ganha fundo `#ffe1d0`; sálvia
  `#7a8a5e` → `#728157`.
- **Reordenar a ficha:** arraste, com `react-native-gesture-handler` (já instalado).

## 7. Estado

Só de UI, dentro de cada tela: ajuste local de carga/reps/duração antes de confirmar (vale para
UMA série), aba do histórico e exercício selecionado, folha aberta, campo em edição.
Tudo o mais vem por props e volta pelos callbacks. Nenhuma tela consulta banco.

No protótipo existem dois controles que **não** vão para o app: os botões "demo" de estado da tela
1 no arquivo Industry e o toque em "Registrar peso" que alterna a tela de corpo entre vazia e
cheia. São andaimes de demonstração.

## 8. Regras de domínio visíveis no design (checklist de integração)

1. Unidade é do exercício; a tela **nunca** pergunta "kg ou placa". ✔ telas 2, 3, 4, 6
2. Placa → kg só com `gramasPorPlaca`, sempre com til. ✔ telas 2, 4, 7
3. Plano ≠ realizado; a ficha só muda por toque explícito com os dois números visíveis. ✔ tela 3
4. Carga da próxima série vem do histórico; repetição vem do plano. ✔ tela 2
5. Aquecimento não conta — e é visualmente distinto (tracejado sálvia). ✔ telas 2, 3, 4
6. Volume só soma o somável, e o que ficou fora é nomeado. ✔ tela 3
7. Peso corporal tem carga nula, nunca zero. ✔ telas 2, 4, 6
8. Estatística com poucos pontos não vira número. ✔ telas 4, 5
9. Inteiros na menor unidade; formatação só pelas funções fornecidas. ✔ em todas

## 9. Assets

Nenhum. Sem ícones vetoriais, sem imagens, sem rede: a interface é tipografia, círculo e pílula.
Os únicos glifos são `−`, `+`, `★`, `→` e `≡`, todos de texto.

## 10. Voz do texto

Enxuta. A interface diz **o fato**, não o motivo do fato: "Nenhum recorde hoje.", "Sem altura não
há IMC.", "A tendência aparece com 4 pesagens em 14 dias.". Nenhuma tela explica a própria regra de
domínio, tranquiliza sobre o que não é destrutivo, nem comenta o resultado do usuário.

As três exceções, que ficam: **consequência de perda de dados** ("Neste aparelho existem 151
sessões e 96 pesagens. Não há como voltar.", "Restaurar substitui tudo neste aparelho.", o risco do
backup em número), **procedência da carga** na execução (é a razão de existir do app) e **o que
ficou fora da soma** no resumo, com o motivo em duas ou três palavras. Ao implementar, não
reintroduza microcópia de apoio: se uma frase explica por que a tela está certa, ela sai.

## 11. Arquivos do protótipo

- `Academia - fluxo v2.dc.html` — direção aprovada, 8 telas na ordem do fluxo (abra no navegador).
- `Academia - telas.dc.html` — rodada 1 (Industry) + variações `1b`…`1h`.
