# Prompts para o Claude Design — app de academia

- **Data:** 2026-08-17
- **Formato:** um **prompt-mestre** (cola uma vez, no início da sessão) + **um prompt por tela** +
  uma revisão de conjunto no fim.
- **Entregável pedido:** componentes React Native `.tsx` prontos para integrar, sem acesso a banco.

## Como usar

1. Cole o **Prompt 0** e espere ele confirmar que entendeu. Não peça tela nenhuma antes disso.
2. Cole o **Anexo de contratos** junto com o primeiro prompt de tela.
3. Ordem sugerida: **Executar → Abrir o app → Resumo → Histórico → Corpo → Ficha → Calibrar →
   Backup**. Executar primeiro porque é a tela que decide o projeto; Abrir o app em segundo porque
   é a que fixa a linguagem visual do resto.
4. No fim, cole o **Prompt Z** (revisão de conjunto).
5. Me traga os arquivos e eu ligo aos dados.

> **A regra que estes prompts seguem:** nenhum deles descreve como o app está desenhado hoje. Eles
> dizem o que cada tela precisa **fazer** e **quais dados existem**. Hierarquia, layout, navegação e
> até quais telas existem são decisão do especialista. Contar como está hoje ancora a resposta e
> perde justamente o que se está indo buscar — a UI atual é andaime, foi escrita para provar a
> camada de dados, não para ser bonita.

---

## O sistema em uma página (referência minha — não é para colar)

**Camadas.** `src/dominio/` é puro (sem React, sem SQLite): carga, execução, volume, recordes,
corpo, datas. `src/db/` tem schema, queries, mutations e a reatividade. `src/app/` e
`src/components/` só compõem. 362 testes rodam contra SQLite de verdade, sem simulador.

**Banco (9 tabelas).** `exercicios`, `treinos`, `treino_exercicios`, `sessoes`, `series`,
`pesagens`, `medidas`, `perfil`, `preferencias`. Três invariantes são trava do próprio SQLite:
a mistura de unidade na série (CHECK), no máximo uma sessão aberta no banco inteiro (índice único
sobre constante) e a unicidade de `(sessao, exercicio, indice)`.

**O que existe hoje.** Escolher treino → executar → resumo; histórico (sessões, progressão por
exercício, recordes); corpo (peso, objetivo, IMC, estatística, medidas). Seed com os 3 treinos e
24 exercícios reais dele.

**O que não existe.** Backup/exportação, edição de ficha e catálogo pela UI (as mutations existem
e são testadas, faltam telas), e calibração de placa (idem). Os três entram nos Prompts 6, 7 e 8.

---

## Prompt 0 — Contexto (colar uma vez)

````text
Você é o especialista de design de produto e interface deste app. Eu cuido da camada de
dados e da integração; você decide tudo que o usuário vê e como ele interage.

## O produto

Um hub de academia. Um único usuário, um único aparelho Android, sem servidor, sem login,
sem rede — os dados vivem em SQLite no próprio celular.

O usuário é o Henrique, 20 anos. Ele treina num ABC e hoje o "app" dele é o **bloco de
notas do celular**, com as três fichas escritas assim:

  Remada Alta c/ Barra - 4x10 / 5 Placas
  Rosca Martelo Polia - 4x10 / 5kg
  Abdominal Supra Solo - 4x12

Para peso corporal ele usa o Weight Fit, e a crítica dele a esse app é literal: **"tem
informações demais"**.

O critério de sucesso do projeto é uma frase só: **ele parar de abrir o bloco de notas
durante o treino**.

## O contexto físico manda no desenho

O app é usado **de pé, entre séries, com uma mão, o celular suado, às vezes no subsolo sem
sinal, com 40 segundos de descanso correndo**. Isso não é detalhe de UX, é requisito:

- Registrar uma série tem que caber em **um toque** no caso comum.
- A informação é lida **de relance**, não estudada.
- Errar um toque não pode custar caro nem exigir menu para desfazer.
- A luz varia muito: sol na janela do fundo, luz fraca no subsolo. Hoje o app é escuro
  fixo; trocar isso é decisão sua, desde que funcione nas duas situações.

## As perguntas que ele precisa responder, em ordem de importância

1. Registrar a série que acabei de fazer, agora.
2. Qual é a próxima série — carga e repetições — e quanto falta para acabar.
3. Estou evoluindo neste exercício?
4. Como está meu peso em relação ao objetivo?
5. O que eu treinei nas últimas semanas?

## Regras de domínio que o design não pode quebrar

Estas não são preferências. Quebrar qualquer uma produz um número **plausível e errado** —
o pior tipo de erro aqui, porque ele só descobre semanas depois, olhando um gráfico que
mentiu, e a partir daí não confia em mais nada.

1. **Carga tem unidade, e a unidade é do exercício: placa ou kg.** "5 placas" é a POSIÇÃO
   do pino, não massa. Cinco placas na remada alta e cinco no peck deck são cargas
   diferentes. Nunca compare, some ou converta entre as duas. E a tela **nunca pergunta**
   "kg ou placa": o exercício já sabe. 13 dos 24 exercícios dele são em placa.
2. **Nunca converta placa em quilo por chute.** Cada exercício pode ter um
   `gramasPorPlaca` — e o normal é ser desconhecido (`null`). Quando existe, todo número
   derivado dele aparece com til: "5 placas (~25 kg)", nunca o quilo seco. Alavanca e
   roldana não são proporcionais; o til é a honestidade da conta.
3. **Plano ≠ realizado.** "Treino" é a ficha (4×10 com 5 placas); "sessão" é o que ele fez
   hoje. A ficha **nunca** se atualiza sozinha a partir do que foi feito — só por toque
   explícito, com os dois números visíveis. Progressão automática vira laço que não
   converge: subiu a carga → não bateu as reps → desceu a carga → bateu → subiu de novo.
4. **A carga da próxima série vem do histórico; a repetição vem do plano.** As duas
   cadeias apontam para lados opostos de propósito. Carga do histórico é o que faz a
   progressão aparecer sozinha. Repetição do histórico faria o app **abaixar a régua**: ele
   fez 8 quando o alvo era 10, e no treino seguinte o app pediria 8.
5. **Aquecimento não conta.** Nem no volume, nem no recorde, nem no alvo de séries. Sem
   isso a curva sobe no dia em que ele só aqueceu mais.
6. **Volume só soma o que é somável, e o que ficou de fora é nomeado.** Abdominal (peso
   corporal), esteira (tempo) e placa não calibrada saem da conta — mas a tela diz quais,
   com nome. "1.550 kg·rep" sem dizer que o abdominal ficou de fora é um número que parece
   completo e não é.
7. **Peso corporal tem carga nula, nunca zero.** Zero significaria "levantou zero quilo".
8. **Estatística com poucos pontos não vira número.** A tendência de peso exige no mínimo
   4 pesagens e 14 dias; abaixo disso a tela escreve o motivo em vez do número. Isto é uma
   correção deliberada do Weight Fit, que mostra "+1,8 kg por semana · Muito rápido"
   extrapolado de duas pesagens em seis dias. Copiar aquilo seria copiar o defeito.
9. **Números são inteiros na menor unidade:** gramas (42500 = 42,5 kg), milímetros,
   centésimos de IMC, segundos. Nunca float, nunca `toFixed`. Sempre formate chamando as
   funções que eu forneço.

## Restrições técnicas

- Expo SDK 57, React Native 0.86.2, React 19.2.3, TypeScript strict, React Compiler ligado.
- Expo Router (roteamento por arquivos). A navegação hoje é por abas nativas, mas isso é
  decisão sua, não restrição.
- Estilo com `StyleSheet.create` do React Native.
- Alvo real: Android, uso com uma mão, na vertical. iOS não existe hoje.
- **Offline total.** Nenhuma fonte, imagem ou ícone pode vir da rede.
- **Bibliotecas disponíveis:** react-native-svg 15.15, react-native-reanimated 4.5,
  react-native-gesture-handler, react-native-safe-area-context, react-native-screens,
  expo-haptics, expo-image, expo-symbols, expo-glass-effect, @expo/ui, expo-keep-awake,
  expo-file-system, expo-sharing, expo-document-picker.
- **Não instaladas:** nenhuma biblioteca de ícones vetoriais além do expo-symbols, nenhum
  design system, nenhum utilitário de estilo tipo Tailwind/NativeWind. Você **pode** pedir
  para instalar — diga qual e por quê, e eu instalo.

## O que é você quem decide — liberdade total

Paleta, tipografia, escala de espaçamento, densidade, cantos, sombras, hierarquia visual,
ícones, microinterações, animações, estados vazios e de erro.

E também, explicitamente: **a estrutura de navegação e quais telas existem**. Se você achar
que duas telas deviam ser uma, ou que uma devia virar três, ou que abas não são o certo —
proponha. Eu listo as telas como inventário de funcionalidade, não como planta baixa.

## O que eu preciso receber de volta

- Arquivos `.tsx` completos, com `StyleSheet.create` no próprio arquivo.
- Um arquivo de tema centralizando os tokens (cores, espaçamento, tipografia, raios, alvos
  de toque).
- **Componentes de apresentação puros**: recebem tudo por props tipadas, sem consultar banco
  nem chamar hook de dados. Eu ligo os dados depois. Estado só de UI (campo em edição, aba
  selecionada, ajuste da série antes de confirmar) pode ficar dentro.
- Textos em **português do Brasil**. Nomes de componentes, props e variáveis também em
  português — é a convenção deste repositório (`CartaoDoExercicio`, `cargaAlvo`,
  `seriesFaltando`).

## Como vamos trabalhar

Vou te mandar uma tela por vez, com o contrato de dados dela. Comece confirmando que
entendeu o produto e me diga, antes de desenhar qualquer coisa, **qual é a sua leitura do
problema de design central deste app** — quero saber se você viu o mesmo que eu vi.
````

---

## Anexo — contratos de dados (colar junto com a primeira tela)

````text
## Os tipos que as telas recebem

Instantes são `number` (epoch ms). Carga é sempre este par discriminado — nunca um número
solto, porque um número solto perde a unidade e vira soma errada:

type Unidade = 'kg' | 'placa';
type Carga =
  | { unidade: 'kg';    gramas: number }    // 42500 = 42,5 kg
  | { unidade: 'placa'; placas: number };   // 5 = quinta posição do pino

type TipoMedicao = 'carga_kg' | 'carga_placa' | 'peso_corporal' | 'tempo' | 'distancia';
type TipoSerie   = 'aquecimento' | 'valida' | 'falha';

type Exercicio = {
  id: string;
  nome: string;
  grupoMuscular: string | null;
  tipoMedicao: TipoMedicao;
  incremento: Carga | null;        // o degrau do "+"/"−" NAQUELE aparelho
  gramasPorPlaca: number | null;   // null = não sei quanto pesa a placa
  arquivadoEm: number | null;
};

### Execução

type ItemDaSessao = {
  itemId: string;
  exercicio: Exercicio;
  ordem: number;
  seriesAlvo: number;              // 4 no caso comum; 0 = exercício fora da ficha
  repsAlvoMin: number | null;      // hoje min = max: a ficha diz um alvo exato
  repsAlvoMax: number | null;
  cargaAlvo: Carga | null;
  duracaoAlvoS: number | null;     // 600 na esteira; null no resto
  descansoS: number;               // 90
  feitas: SerieExecutada[];        // o que já foi registrado hoje, em ordem
  contamParaAlvo: number;          // só 'valida' e 'falha'
  faltam: number;
  completo: boolean;
  proxima: SerieSugerida | null;   // já vem pronta; a tela não calcula nada
};

type SerieSugerida = {
  exercicioId: string;
  indice: number;
  tipo: TipoSerie;
  carga: Carga | null;
  repeticoes: number | null;
  duracaoS: number | null;
  origemCarga: 'ajuste_de_hoje' | 'mesmo_indice_sessao_anterior' | 'plano' | 'sem_referencia';
  origemReps:  'plano' | 'mesmo_indice_sessao_anterior' | 'sem_referencia';
};

type SerieExecutada = {
  id: string; sessaoId: string; exercicioId: string;
  indice: number; tipo: TipoSerie;
  carga: Carga | null; repeticoes: number | null; duracaoS: number | null;
  rir: number | null;              // quase sempre null: não perguntamos
  concluidaEm: number;
};

type PlanoDaSessao = {
  sessao: { id: string; nome: string; iniciadaEm: number; treinoId: string | null };
  itens: ItemDaSessao[];           // já ordenados
  seriesFeitas: number;
  seriesAlvo: number;
  seriesFaltando: number;
  itemAtual: ItemDaSessao | null;  // o primeiro que ainda tem série faltando
};

`origemCarga` não é enfeite: é o que permite a tela escrever "igual à semana passada"
(mesmo_indice_sessao_anterior) em vez de "da ficha" (plano), ou abrir direto o teclado
quando não há de onde tirar (sem_referencia).

### Fim do treino

type VolumeDaSessao = {
  gramasReps: number;              // a soma, só do que é somável
  seriesSomadas: number;
  seriesAquecimento: number;
  seriesEmPlacaSemCalibracao: number;
  seriesSemCarga: number;          // peso corporal
  seriesSemRepeticoes: number;     // esteira
  seriesAproximadas: number;       // quantas vieram de placa convertida
  gramasRepsAproximados: number;   // quanto do total veio dali → o gancho do "~"
  foraDaSoma: { id: string; nome: string; series: number;
                motivo: 'aquecimento'|'sem_carga'|'sem_repeticoes'|'placa_sem_calibracao' }[];
};

type Divergencia = {              // "você fez 6 placas, a ficha diz 5"
  itemId: string; nome: string;
  noPlano: Carga | null;
  sugerida: Carga;
};

type Recordes = {
  maiorCarga: Carga | null;
  maior1RM: { carga: { unidade: 'kg'; gramas: number }; confiavel: boolean } | null;
  maiorVolumeSessao: { valor: number; unidade: Unidade } | null;
  maiorReps: number | null;
  maiorRepsNaCarga: Carga | null;
  totalDeSeries: number;
  umRMAproximado: boolean;         // veio de conversão → escreve "~"
};

`maior1RM.confiavel` é falso acima de ~12 repetições: a fórmula de Epley erra feio ali.

### Histórico

type ResumoDeSessao = {
  id: string; nome: string;
  iniciadaEm: number; finalizadaEm: number | null;
  totalSeries: number;             // TODAS, aquecimento incluído
  gramasReps: number;
  gramasRepsAproximados: number;
};

type PontoDeProgressao = {         // UMA SESSÃO, não uma série. 4×10 = 1 ponto.
  sessaoId: string;
  instante: number;
  melhorCarga: Carga | null;
  repeticoes: number;              // soma do dia
  duracaoS: number;
  series: number;
};

A grandeza que progride muda com o exercício: carga (em carga_kg/carga_placa), repetições
(peso corporal), segundos (tempo). Eu forneço `valorDaProgressao(ponto, exercicio)`.

### Corpo

type Perfil   = { alturaMm: number | null; pesoObjetivoG: number | null;
                  pesoInicialG: number | null; objetivoDefinidoEm: number | null };
type Pesagem  = { id: string; pesoG: number; medidoEm: number; nota: string | null };
type Medida   = { id: string; parte: ParteCorpo; valorMm: number; medidoEm: number };

type ParteCorpo = 'peito'|'cintura'|'quadril'|'braco_direito'|'braco_esquerdo'
                | 'coxa_direita'|'coxa_esquerda'|'panturrilha_direita'|'panturrilha_esquerda'
                | 'pescoco'|'antebraco_direito'|'antebraco_esquerdo';

type ProgressoObjetivo = { direcao: 'perder'|'ganhar'|'manter'; faltaG: number;
                           alcancado: boolean; percentual: number | null };

type Imc = { centesimos: number;   // 2234 = 22,34
             categoria: 'abaixo'|'normal'|'sobrepeso'|'obesidade_1'|'obesidade_2'|'obesidade_3' };

type Ritmo =
  | { suficiente: true;  porSemana: number; pontos: number; dias: number }
  | { suficiente: false; motivo: 'sem_dados'|'poucas_pesagens'|'periodo_curto';
      pontos: number; dias: number };

type EstatisticaSerie = {
  pontos: number; primeiro: Ponto; ultimo: Ponto; minimo: Ponto; maximo: Ponto;
  mudanca: number;    // último − primeiro, com sinal
  amplitude: number;  // máximo − mínimo
  dias: number; ritmo: Ritmo;
};

`Ritmo` é união discriminada de propósito: no ramo insuficiente o campo `porSemana` NÃO
EXISTE. Ler a tendência obriga a passar pelo `if` — é o que impede a tela de anunciar um
número inventado a partir de duas pesagens.

## Funções que já existem — não reimplemente

formatarCarga({unidade:'placa',placas:5})   → "5 placas"
formatarCarga({unidade:'kg',gramas:42500})  → "42,5 kg"
formatarNumeroDaCarga(c)                    → "5"      (só o número, para o display grande)
rotuloDaUnidade(c)                          → "placas" | "kg"
formatarCargaAproximada(c, gramasPorPlaca)  → "5 placas (~25 kg)"
formatarVolume(gramasReps)                  → "1.550 kg·rep"
formatarVolumeNaUnidade({valor,unidade})    → "108 placa·rep"
formatarPeso(78400)                         → "78,4 kg"
formatarMedida(385)                         → "38,5 cm"
formatarAltura(1750)                        → "1,75 m"
formatarImc(2234)                           → "22,34"
formatarVariacao(-1200)                     → "−1,2 kg"
formatarDuracao(600)                        → "10 min"
formatarRelogio(ms)                         → "1:23"   (cronômetro de descanso)
formatarData / formatarDataComAno / formatarHora / formatarDataHora

proximaCarga(carga, incremento) / cargaAnterior(carga, incremento)   → os botões + e −
parseCarga(texto, unidade) → { ok: true, carga } | { ok: false, erro }
estimar1RM(cargaKg, reps)  → { carga, confiavel } | null
progressoObjetivo(pesoAtualG, objetivo) · calcularImc(pesoG, alturaMm) · faixaPesoNormal(alturaMm)
ritmoSemanal(pontos) · estatisticaDoPeso(...) · mediaMovel(pontos, dias)
fimDoDescanso(ultimaSerie, descansoS) → INSTANTE de término (nunca soma de ticks: o JS é
                                        suspenso em background e o contador atrasaria)

## Os dados reais para os mocks — use estes, não valores genéricos

TREINO A — Costas, bíceps e ombros
  Remada Alta c/ Barra          4×10   5 placas
  Remada Baixa c/ Barra         4×10   5 placas
  Peck Dorsal                   4×10   4 placas
  Facepull                      3×10   2 placas     ← o único 3×10 da ficha inteira
  Rosca Martelo Polia           4×10   5 kg
  Rosca Direta Polia            4×10   3 placas
  Elevação Lateral c/ Halter    4×12   5 kg
  Abdominal Supra Solo          4×12   peso corporal (sem carga)

TREINO B — Pernas
  Seated Leg Press              4×10   20 kg
  Smith Press                   4×10   14 kg
  Cadeira Extensora             4×10   6 placas
  Cadeira Flexora               4×10   6 placas
  Leg Press                     4×10   4 placas
  Panturrilha                   4×10   20 kg
  Cadeira Abdutora              4×10   3 placas
  Esteira                       10 min (sem série, sem carga, sem repetição)

TREINO C — Peito, ombros e tríceps
  Supino Inclinado Barra        4×10   10 kg
  Supino Máquina                4×10   6 placas
  Peck Deck                     4×10   5 placas
  Paralela Articulada           4×10   4 placas
  Desenvolvimento Articulado    4×10   2 placas
  Elevação Frontal c/ Halteres  4×12   4 kg
  Tríceps Francês Halter        4×10   6 kg
  Abdominal Infra Solo          4×12   peso corporal

Cinco casos que quebram layout ingênuo e PRECISAM aparecer nos seus mocks:

1. "5 placas", "20 kg", "12 reps sem carga" e "10 min" na MESMA lista de 8 exercícios.
2. "Elevação Frontal c/ Halteres" e "Desenvolvimento Articulado" — nomes longos, ao lado de
   um alvo ("4×12 · 4 kg") que não pode ser empurrado para fora da tela.
3. A esteira: sem carga, sem repetição, só duração. Os botões +/− dela mexem em minutos.
4. Um exercício com as 4 séries feitas e uma 5ª extra — o alvo foi batido e ele continuou.
5. O primeiro treino da vida: nenhuma série registrada em lugar nenhum, gráfico sem ponto,
   nenhum recorde. É o estado real de estreia e não pode parecer app quebrado.
````

---

## Prompt 1 — Executar o treino

> Comece por esta. É a tela que decide se o projeto dá certo.

````text
Tela: EXECUTAR O TREINO — registrar as séries enquanto ele treina.

É a razão de o app existir. Meta: **do bolso ao "série registrada" em um toque**, com uma
mão, de pé, com o descanso correndo.

## O que ela precisa permitir

Obrigatório, e nesta ordem de importância:
- Ver qual é a próxima série: qual exercício, qual carga, quantas repetições, a quantas
  séries está de terminar aquele exercício.
- **Confirmar essa série em UM toque.** A carga e a repetição já vêm decididas em
  `item.proxima` — a tela não calcula nada.
- Ajustar a carga para cima ou para baixo antes de confirmar, em degraus de
  `exercicio.incremento` (1 placa, 1 kg ou 2,5 kg, dependendo do aparelho).
- Ajustar as repetições, e a duração no caso da esteira.
- Digitar uma carga direto, quando o degrau não serve.
- Marcar a série como **aquecimento** — sem abrir menu e sem campo novo.
- Desfazer uma série registrada por engano.
- Ver quanto falta do descanso desde a última série.
- Finalizar o treino.

## Dados que a tela recebe

plano: PlanoDaSessao
onConfirmar: (sugerida: SerieSugerida, tipo: TipoSerie) => void
onDesfazer: (serieId: string) => void
onFinalizar: () => void

O ajuste local (carga/reps antes de confirmar) é estado seu, dentro do componente. Ele vale
para UMA série: assim que ela é gravada, o índice anda e a sugestão volta a mandar.

## Regras desta tela

- **Um toque é o orçamento do caso comum.** Ele repete a mesma carga da semana passada em
  quase toda série. Qualquer coisa que transforme isso em dois toques mata o app.
- `origemCarga` diz de onde veio o número, e a tela pode dizer isso em uma palavra:
  `mesmo_indice_sessao_anterior` = o que ele fez da última vez;
  `plano` = o que está escrito na ficha (é o caso da estreia);
  `ajuste_de_hoje` = ele mudou a carga há pouco, nesta sessão;
  `sem_referencia` = não há de onde tirar — aqui a ação principal é informar a carga.
- **Aquecimento precisa ser barato de marcar e visualmente distinto do resto.** Ele não
  conta para o alvo nem para o volume.
- **Desfazer é a rede de segurança do "um toque".** Um app que registra rápido erra rápido.
  Precisa ser óbvio e reversível sem susto.
- O descanso é derivado do INSTANTE de término (eu forneço `fimDoDescanso`), então voltar
  três minutos depois mostra "descanso concluído", não um contador atrasado.
- A tela fica acordada durante o treino. Bloquear e desbloquear com a mão suada a cada série
  é o atrito que manda ele de volta pro bloco de notas.
- Um exercício pode ter `seriesAlvo: 0` — é o exercício fora da ficha, feito de improviso.
  Não diga "0 séries", que o transformaria numa dívida que ele nunca contraiu.

## O que eu quero de você

O componente completo, e antes dele um parágrafo curto explicando **a decisão central** que
você tomou aqui. Em especial, responda com número: da tela aberta ao registro da série
seguinte de Remada Alta com 5 placas, quantos toques?
````

---

## Prompt 2 — Abrir o app

````text
Tela: ABRIR O APP — o primeiro toque do dia.

Três situações possíveis, e a tela precisa acertar qual é sem perguntar:

1. **Nenhuma sessão aberta.** Ele escolhe entre Treino A, B e C. É o caso normal.
2. **Sessão de HOJE aberta.** Ele já começou, saiu do app entre séries, e voltou. Retomar
   precisa custar ZERO toque — o app abre direto na execução.
3. **Sessão de outro dia esquecida aberta.** Ele treinou ontem e não finalizou. Este caso
   precisa de escolha explícita: continuar dentro dela ou fechá-la. Começar hoje dentro da
   sessão de ontem estragaria o agrupamento por dia, e fechá-la sozinho seria inventar um
   horário de término que ninguém observou.

## Dados que a tela recebe

treinos: { id: string; nome: string; descricao: string | null }[]
sessaoAberta: { id: string; nome: string; iniciadaEm: number } | null
seriesDaSessaoAberta: SerieExecutada[]     // para dizer "com 12 séries registradas"
onIniciar: (treinoId: string) => void
onRetomar: () => void
onFinalizarNoUltimoInstante: (instante: number) => void   // fecha no horário da última série

Os três treinos: "Treino A — Costas, bíceps e ombros", "Treino B — Pernas",
"Treino C — Peito, ombros e tríceps". Ele faz sempre nessa rotação.

## Regras

- Só pode existir **uma** sessão aberta no app inteiro — o banco garante isso, a tela não
  precisa desempatar nada.
- Fechar a sessão esquecida registra o horário da ÚLTIMA SÉRIE como término, não "agora".
  É o último instante sobre o qual existe dado.
- O app pode estar completamente vazio (usuário novo, nenhum treino). Não deixe isso virar
  uma área em branco.

## O que eu quero de você

O componente, mais uma frase sobre o que você escolheu mostrar no caso 1 — a tela que ele
vê três vezes por semana pelo resto do ano.
````

---

## Prompt 3 — Resumo da sessão

````text
Tela: RESUMO — o que o treino de hoje foi, mostrado logo depois de finalizar.

É a única tela do app onde a FICHA pode mudar.

## Dados que a tela recebe

nome: string                       // "Treino A"
volume: VolumeDaSessao
recordes: { nome: string; carga: boolean; umRM: boolean; reps: boolean }[]
divergencias: Divergencia[]
onAtualizarFicha: (d: Divergencia) => void
onConcluir: () => void

## Regras

- **O volume não é um número solto.** `foraDaSoma` traz, com nome e motivo, o que não entrou
  na conta: o abdominal (peso corporal), a esteira (tempo), a máquina cuja placa não foi
  calibrada. Um "1.550 kg·rep" sozinho tem cara de total e não é.
- Se parte do volume veio de placa convertida (`gramasRepsAproximados > 0`), o número leva
  til. Não é preciosismo: a conversão assume que a resistência é proporcional ao número de
  placas, e alavanca e roldana não garantem isso.
- **Divergência é convite, nunca ação automática.** "Você fez 6 placas quatro vezes; a ficha
  diz 5" com os dois números visíveis e um toque para atualizar. Se o app subir a ficha
  sozinho, entra no laço que a regra 3 do contexto descreve.
- Recorde é a recompensa do dia e merece peso visual — mas ele pode bater três de uma vez, e
  três celebrações do mesmo tamanho não celebram nada.
- Treino sem recorde nenhum é o caso mais comum. Não invente troféu para preencher espaço.

## O que eu quero de você

O componente. Preste atenção em como o "atualizar ficha" se distingue do resto: é a única
coisa desta tela que muda dado, e um toque errado aqui reescreve o plano do próximo treino.
````

---

## Prompt 4 — Histórico e progressão

````text
Tela: HISTÓRICO — "o que eu treinei" e "estou evoluindo neste exercício".

Duas perguntas diferentes. A segunda é a que faz alguém continuar treinando.

## Dados que a tela recebe

sessoes: ResumoDeSessao[]                 // últimas 30, mais recente primeiro
exercicios: Exercicio[]                   // os 24
detalhe: { exercicio: Exercicio; series: SerieExecutada[] } | null
progressao: PontoDeProgressao[]           // já em ordem cronológica
recordes: Recordes | null
onEscolherExercicio: (id: string | null) => void

## Regras

- **Um ponto por SESSÃO, não por série.** 4×10 num dia são quatro linhas no banco e um ponto
  na curva.
- **A escala do gráfico é a unidade do exercício.** Placa e kg nunca no mesmo eixo, nunca no
  mesmo gráfico. Um exercício em placa progride de 4 para 5 placas; um em kg, de 20 000 para
  22 500 gramas. São mundos numéricos diferentes.
- Em peso corporal a grandeza que progride é a REPETIÇÃO; na esteira, o SEGUNDO. Eu forneço
  `valorDaProgressao(ponto, exercicio)` que devolve o número certo para cada caso.
- Aquecimento não entra na curva.
- Calibrar a placa **não muda a escala do gráfico** — a curva continua em placas. A
  conversão é leitura, não dado.
- Volume de exercícios diferentes não se soma. O total da sessão soma o que dá; o volume por
  exercício vem com a unidade colada no número ("108 placa·rep").
- Hoje ele tem UMA sessão registrada. Em um ano serão ~150, com 24 exercícios. A tela precisa
  fazer sentido nos dois extremos — e o extremo de hoje é "um ponto só", que não é gráfico.

## O que eu quero de você

O componente, incluindo o caso do exercício com um único ponto e o do exercício nunca feito.
Se você achar que gráfico ajuda, use — `react-native-svg` está instalado. Mas justifique: um
número bem colocado que ele lê de relance vale mais que uma curva bonita que ele não abre.
````

---

## Prompt 5 — Corpo

````text
Tela: CORPO — peso, objetivo, IMC, tendência do período e medidas.

O usuário usa o Weight Fit hoje e a crítica dele foi "informações demais". Esta tela é o
principal daquele app, sem o resto.

## Dados que a tela recebe

perfil: Perfil                          // alturaMm, pesoObjetivoG, pesoInicialG
pesagens: Pesagem[]                     // ordenadas por data
medidas: Medida[]
progresso: ProgressoObjetivo | null
imc: Imc | null
faixaNormal: { minimoG: number; maximoG: number } | null   // peso para IMC 18,5–24,9
estatistica: EstatisticaSerie | null    // do período escolhido
onRegistrarPeso: (pesoG: number, quando: number) => void
onRegistrarMedida: (parte: ParteCorpo, valorMm: number) => void
onDefinirObjetivo / onSalvarAltura / onArquivarPesagem

## Regras

- **Registrar uma pesagem é a ação frequente aqui** — de manhã, na balança, uma vez por dia.
  Todo o resto é leitura.
- **A direção do objetivo vem da PARTIDA, não do peso de hoje.** Quem saiu de 82 kg rumo a
  75 e hoje está em 74 continua num objetivo de "perder" — trocar para "ganhar" ao cruzar a
  meta inverteria a frase da tela justamente no dia bom. E `faltaG` nunca fica negativo.
- **A tendência só aparece com base.** `Ritmo` é união discriminada: quando
  `suficiente: false`, não existe número nenhum para mostrar, e o motivo
  (`poucas_pesagens`, `periodo_curto`) é o que a tela escreve. Este é o ponto onde o app se
  diferencia do Weight Fit, que extrapola "+1,8 kg/semana · Muito rápido" de duas pesagens
  em seis dias. Não desenhe um lugar de destaque que precise ser preenchido com algo.
- O IMC depende da altura, que pode não estar cadastrada. Sem altura não há IMC — e pedir a
  altura é um convite, não um erro.
- **Peso oscila 1–2 kg dentro do mesmo dia.** Uma pesagem isolada não é notícia; a média
  móvel de 7 dias é (eu forneço `mediaMovel`). O desenho precisa desencorajar a leitura
  ansiosa do ponto do dia.
- São 12 partes do corpo possíveis e ele mede poucas, esporadicamente. Um formulário com 12
  campos é o caminho para nenhuma medida registrada.
- Estado real de hoje: **nenhuma pesagem, nenhuma medida, sem altura, sem objetivo.** Esta
  tela começa 100% vazia e é assim que ele vai vê-la no primeiro dia.

## O que eu quero de você

O componente. Diga também qual informação você colocou no topo e por quê — a tela tem cinco
blocos candidatos e eles não cabem todos acima da dobra.
````

---

## Prompt 6 — Ficha e catálogo de exercícios

````text
Telas: EDITAR A FICHA e o CATÁLOGO DE EXERCÍCIOS.

Contexto de uso oposto ao da execução: isto se faz **em casa, sentado, sem pressa**, uma vez
a cada poucas semanas. Densidade e ritmo podem ser outros — e provavelmente devem.

## O que precisa ser possível

Na ficha (Treino A, B ou C):
- Ver os exercícios na ordem em que ele faz.
- Mudar séries, repetições, carga alvo, descanso e a ordem.
- Adicionar um exercício do catálogo; tirar um da ficha.
- Criar um treino novo, arquivar um que ele parou de fazer.

No catálogo:
- Criar um exercício: nome, grupo muscular e **como ele é medido** — placa, kg, peso
  corporal, tempo ou distância.
- Corrigir nome, grupo e o degrau do "+"/"−" (`incremento`).
- Arquivar um exercício sem apagar o histórico dele.

## Dados e ações

treinos / itensDoTreino / exercicios — os mesmos tipos do anexo.
onSalvarItem / onRemoverItem / onReordenar / onCriarExercicio / onEditarExercicio /
onArquivar — todas já existem e são testadas do meu lado.

## Regras

- **O tipo de medição é a decisão mais cara desta tela.** Ele define a unidade de tudo que
  for registrado depois. Mudar de placa para kg num exercício com histórico é conversão
  destrutiva e irreversível (e só é possível se a placa estiver calibrada). Precisa de aviso
  proporcional — sem virar burocracia no caso comum, que é criar um exercício novo.
- Arquivar não apaga: o histórico continua, o exercício some das listas. Isso precisa ficar
  claro na hora de arquivar, senão ele nunca limpa a lista com medo de perder dado.
- O mesmo exercício pode aparecer duas vezes na mesma ficha (bi-set).
- `seriesAlvo` é sempre maior que zero; `repsAlvoMin` e `repsAlvoMax` hoje recebem o mesmo
  número (a ficha diz "4×10", não "4×8–12"), mas a faixa existe para o dia em que ele
  escrever assim.
- Carga alvo é opcional e **nula** em peso corporal e esteira — nunca zero.

## O que eu quero de você

Os componentes. E me diga se você acha que ficha e catálogo são duas telas ou uma — eu não
tenho opinião formada, e a resposta muda o resto.
````

---

## Prompt 7 — Calibrar a placa

````text
Peça pequena, conceito grande: CALIBRAR A PLACA de uma máquina.

"5 placas" é a posição do pino. O app não sabe quanto isso pesa — e está tudo bem, porque
progressão em placa se mede em placas. Mas se um dia ele olhar a etiqueta da máquina e
descobrir que cada placa são 5 kg, informar isso faz o app passar a **ler** todo o histórico
daquele exercício também em quilos: "5 placas (~25 kg)".

O ponto que o desenho precisa carregar:

- **Nada é reescrito.** Nenhuma série muda. A calibração é uma crença revisável sobre a
  máquina, aplicada na leitura. Ele pode corrigir depois, e o histórico inteiro se corrige
  junto.
- **A conversão é aproximada e o til é obrigatório.** Alavanca e roldana não são
  proporcionais ao número de placas.
- **O gráfico de progressão continua em placas.** Calibrar não muda a escala do que ele
  acompanha; adiciona uma leitura.
- Isso vale para 13 dos 24 exercícios dele, e nenhum está calibrado hoje.

## Dados

exercicio: Exercicio                    // gramasPorPlaca: number | null
onCalibrar: (gramasPorPlaca: number | null) => void    // null descalibra

## O que eu quero de você

O componente — e, mais importante que ele: **onde no app este convite aparece**, sem virar
uma pergunta que atrapalha quem está treinando. Ele nunca vai procurar por isto num menu de
ajustes; ele vai topar com isso no dia em que estiver olhando o histórico daquela máquina.
````

---

## Prompt 8 — Backup

````text
Tela: BACKUP — exportar e restaurar os dados.

Esta é a tela que impede o projeto de acabar mal.

Não há servidor. **O banco dentro do celular é o único exemplar do histórico dele.** Se o
aparelho sumir, molhar ou for formatado sem backup, some junto todo o registro de carga e de
peso — que é exatamente o que dá valor ao app depois de seis meses de uso. E existe um caso
concreto e próximo: reinstalar o app em certas situações exige desinstalar antes, o que apaga
tudo.

## O que precisa ser possível

- Exportar tudo para um arquivo e compartilhar (`expo-file-system` + `expo-sharing`).
- Escolher um arquivo e restaurar (`expo-document-picker`).
- Saber, sem precisar pensar, **quando foi o último backup** e se ele está velho.

## Regras

- **O aviso precisa comunicar risco sem parecer alarme de bug.** Um app que grita vermelho
  toda vez que abre ensina o usuário a ignorar vermelho.
- Restaurar é destrutivo: substitui o que está no aparelho. Precisa de confirmação à altura,
  e precisa dizer o que vai acontecer com o que existe hoje.
- Exportar é a ação frequente (mensal, digamos); restaurar acontece uma vez na vida, num
  momento ruim — provavelmente com um celular novo na mão e sem paciência.

## O que eu quero de você

O componente, e a sua proposta de **onde o lembrete de fazer backup aparece** — porque uma
tela de backup que ele nunca abre não protege nada. O momento óbvio é logo depois de
finalizar um treino, mas aí compete com o resumo. Decida.
````

---

## Prompt Z — Revisão de conjunto (colar no fim)

````text
Você desenhou o app inteiro. Agora olhe para o conjunto e me responda, sem me poupar:

1. Onde a linguagem visual ficou inconsistente entre telas?
2. Qual tela ficou pior, e por quê?
3. Alguma tela não deveria existir, ou deveria ser fundida com outra?
4. Da tela de execução aberta ao "série registrada", quantos toques no caso comum? Dá para
   tirar mais um?
5. O que você desenhou que só funciona porque os dados de exemplo são poucos? Com um ano de
   treino — 150 sessões, 24 exercícios, 300 pesagens — o que quebra primeiro?
6. A distinção placa × kg aparece em quantos lugares do seu desenho? Em algum deles um
   usuário desatento somaria as duas?
7. Se você tivesse que apostar em **uma** coisa que vai fazer esse usuário desistir e voltar
   para o bloco de notas — o que seria?

Depois, me entregue o arquivo de tema consolidado e a lista de dependências que você quer
que eu instale, se houver.
````

---

## O que eu faço quando você me trouxer os arquivos

1. Ligo cada componente às queries e mutations reais (eles vêm sem acesso a banco, de propósito).
   Leitura na tela passa obrigatoriamente por `useConsulta` — ver `dados-locais`.
2. Rodo `npm run typecheck` e os 362 testes. A camada de dados não muda, então eles devem
   continuar verdes; se algum falhar, o design encostou em regra de negócio e eu volto a falar
   com você.
3. `npm run apk:instalar` e ele usa na academia.
4. O que não couber agora vira parágrafo na skill correspondente, não lista paralela.
