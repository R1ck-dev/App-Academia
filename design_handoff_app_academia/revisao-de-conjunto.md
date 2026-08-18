# Revisão de conjunto (Prompt Z)

## 1. Onde a linguagem visual ficou inconsistente

O gráfico do histórico é o ponto fraco: é a única superfície do app com grade e linhas finas, num
sistema que fora dali só usa pílula, círculo e bloco arredondado. Ele funciona, mas denuncia que
foi desenhado depois. A segunda inconsistência é o peso da tipografia de display: Caprasimo a 84
na execução e a 26 no histórico parecem duas famílias diferentes de tão distintas em massa.

## 2. Qual tela ficou pior

**Resumo.** É a tela com mais coisas obrigatórias por metro quadrado (volume, o que ficou fora,
divergência, recorde) e com um dia cheio de divergências ela vira formulário. Hoje o protótipo
mostra uma divergência; com quatro, o "convite" passa a ser uma fila de decisões logo depois do
treino, que é exatamente quando ele tem menos paciência.

## 3. Alguma tela não deveria existir

Ficha e catálogo não são duas telas — o catálogo é uma folha dentro da ficha, e foi assim que
entreguei. E o Resumo não deveria ser uma tela separada da execução: seria melhor como a última
"página" da execução, sem transição de tela, porque hoje ele é o único momento em que o app
muda de contexto sem o usuário pedir.

## 4. Toques até "série registrada"

**Um**, no caso comum: a carga e a repetição já vêm decididas e o botão diz o que vai gravar. Não
dá para tirar mais um sem tirar a confirmação — e sem confirmação, o toque acidental grava. O que
dá para economizar é o caminho até a tela: com sessão de hoje aberta, o app abre direto na
execução, então o custo real do dia é abrir o app e tocar uma vez.

## 5. O que só funciona porque os dados de exemplo são poucos

- A régua de séries: 4 cápsulas de largura igual respiram, 6 apertam, e num exercício de 8 séries
  cada cápsula fica com ~36 px — a carga em Caprasimo 21 não caberia. Acima de 6, ela precisa
  encolher a tipografia ou virar duas fileiras.
- Os chips de exercício no histórico: 6 caber é fácil, **24 não**. Precisa de busca, e é o primeiro
  lugar que quebra com um ano de uso.
- A lista de sessões: 30 linhas rolam bem, ~150 pedem agrupamento por mês.
- A sparkline do corpo com 300 pesagens: sem reamostrar, vira um borrão. A média de 7 dias salva a
  leitura, a linha fina não.
- "Fora da soma" no resumo: com um treino inteiro em placa não calibrada, a lista fica maior que o
  próprio volume.

## 6. Onde a distinção placa × kg aparece

Em seis lugares: a unidade sob o número grande na execução; o subrótulo do botão Registrar; os
chips das séries feitas; o alvo na ficha; o eixo do gráfico; e os recordes ("1RM não existe em
placa"). O ponto de risco é **um só**: o volume total do resumo, que é um número em `kg·rep` numa
tela cujo treino era quase todo em placa. É por isso que o til e a lista nomeada do que ficou fora
não são enfeite — sem eles, um usuário desatento leria aquele total como o esforço do dia inteiro.
Em nenhum lugar do desenho as duas unidades convivem no mesmo eixo, na mesma soma ou na mesma
comparação.

## 7. A aposta: o que faz ele voltar para o bloco de notas

**O primeiro dia em que o app estiver errado sobre a carga.** Não é lentidão, não é feiúra: é
abrir a Cadeira Flexora e ver 5 placas quando ele fez 6 na semana passada. O bloco de notas nunca
mente porque não deduz nada. No instante em que ele precisar conferir se o número sugerido está
certo, o app perde a única vantagem que tem sobre o papel — e volta a ser mais um toque em vez de
um a menos.

---

## Dependências

**Preciso que você instale uma coisa** — as fontes, empacotadas (offline total, nada de rede):

```
npx expo install @expo-google-fonts/caprasimo @expo-google-fonts/figtree expo-font
```

Caprasimo é a voz de display do sistema e Figtree o corpo; sem elas o app cai na fonte do sistema
e a direção visual desaparece — os números grandes são metade do desenho. Se você não quiser
nenhuma fonte nova no bundle, me diga e eu redesenho a hierarquia só com peso e tamanho.

**Já instaladas, e é o que uso:** `react-native-svg` (gráfico e anel do objetivo),
`react-native-reanimated` (o número voando), `expo-haptics` (confirmação da série),
`expo-keep-awake` (tela acordada no treino), `react-native-gesture-handler` (reordenar a ficha),
`expo-file-system` + `expo-sharing` + `expo-document-picker` (backup),
`react-native-safe-area-context`.

**Não preciso:** biblioteca de ícones (o app não tem ícones), utilitário de estilo, design system.
