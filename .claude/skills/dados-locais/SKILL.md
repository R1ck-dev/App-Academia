---
name: dados-locais
description: Como este app guarda dados — SQLite local como única fonte da verdade, schema e migrations com Drizzle, armadilha do db.transaction assíncrono, soft delete, IDs gerados no aparelho, backup por exportação e como testar contra SQLite de verdade sem simulador. Use antes de criar tabela, alterar schema, escrever query, gravar dado ou mexer em migration.
---

# Dados locais

## A decisão de fundo

**Não há servidor.** Um usuário, um aparelho, sem login, sem sync, sem cliente HTTP. O SQLite do
celular é a **única fonte da verdade** e o **único exemplar** dos dados do Henrique.

Isso simplifica quase tudo (nada de conflito de merge, token, offline queue) e cria uma
responsabilidade: **se o banco do aparelho morrer, os dados morreram.** Daí as três regras abaixo,
que não são refinamento.

### 1. Migration é aditiva e testada com dados dentro

Adicionar coluna e adicionar tabela: sempre ok. **Remover ou renomear coluna, ou apertar uma
restrição, não é** — o aparelho tem dados reais que a versão instalada gravou.

O teste que importa não é "a migration roda num banco vazio". É:

1. aplicar as migrations **até a versão anterior**,
2. gravar dados como a versão instalada gravaria,
3. aplicar a nova migration,
4. conferir que nada sumiu nem virou `NULL`.

`banco-de-teste.ts` aceita `criarBancoDeTeste({ ate: N })` exatamente para isso. Toda migration
nova ganha um caso em `src/db/migracoes.test.ts`.

Coluna nova em tabela que já tem linhas precisa ser `NULL`-ável **ou** ter `DEFAULT`. Sem isso o
SQLite recusa o `ALTER TABLE` e o app quebra na abertura — depois de instalado, no aparelho, com os
dados dentro.

### 2. Reinstalar pode apagar tudo

`adb install -r` preserva os dados; **desinstalar não**. Depois de um `expo prebuild --clean`, a
assinatura pode mudar e o Android passa a exigir desinstalação — que apaga o banco. **Exporte antes**
de qualquer mexida em build nativo (`npm run apk` inclui esse aviso).

### 3. Backup é exportação de arquivo, e é feature do V1

Exportar o banco (ou um JSON completo) via share sheet, para o Drive/WhatsApp dele. Sem isso o app
é um bloco de notas que pode sumir. `exportar-dados.ts` é **puro** (monta o conteúdo) e
`exportar.ts` é quem fala com `expo-sharing` — a separação é o que deixa o formato ter teste.

## Armadilha: `db.transaction` com callback `async` não faz rollback

O driver `expo-sqlite` do Drizzle é **síncrono**. `db.transaction(cb)` roda `BEGIN`, chama `cb`, e
roda `COMMIT` com o retorno — **sem `await`**. Um `cb` `async` devolve uma Promise pendente, o
`COMMIT` acontece na hora, e as escritas do callback caem depois, em autocommit.

O sintoma é traiçoeiro: **tudo funciona**. Os dados são gravados, nada dá erro. Só o rollback nunca
acontece — e isso só aparece no dia em que a segunda escrita falha e deixa a sessão de treino pela
metade (sessão criada, séries perdidas).

```ts
// ERRADO — o COMMIT roda antes do primeiro await
await db.transaction(async (tx) => { await tx.insert(series).values(x); });

// CERTO — síncrono, com .run() explícito
db.transaction((tx) => { tx.insert(series).values(x).run(); });
```

Se o TypeScript reclamar que o callback não pode ser `async`, ele está certo — não contorne com
`as any`.

## Convenções de schema

Todas as tabelas em `src/db/schema.ts`, `snake_case`, português.

| Convenção | Como | Por quê |
|---|---|---|
| Chave primária | `text('id')` com UUID gerado no aparelho | `AUTOINCREMENT` inviabiliza qualquer merge futuro de dois bancos (dois aparelhos gerariam o mesmo `42`) |
| Instantes | `integer('criado_em')` epoch ms UTC | comparável, ordenável, sem fuso gravado no dado |
| Auditoria | `criado_em`, `atualizado_em` em toda tabela mutável | é o que permite saber o que mudou num backup antigo |
| Exclusão | **soft delete** via `arquivado_em` (nullable) | apagar exercício apagaria o histórico de séries dele. Toda query filtra `isNull(arquivado_em)` |
| Dinheiro/medida | inteiro na menor unidade | ver `treino-domain` |
| FK | sempre declarada, com `PRAGMA foreign_keys = ON` | sem o pragma as FKs são só documentação — o SQLite as ignora por padrão |

**Toda escrita passa por `src/db/mutations.ts`**, nunca direto da tela. É o que garante
`atualizado_em`, soft delete e invariantes (por exemplo: série sempre pertence a uma sessão aberta)
num lugar só.

Depois de mexer no `schema.ts`: `npm run db:gerar` (drizzle-kit generate). **Nunca edite um `.sql`
já gerado** que já rodou no aparelho — o Drizzle registra o que aplicou, e editar o passado faz o
banco instalado divergir do que o código acredita. Corrija com uma migration nova.

## Como testar sem simulador

`src/db/banco-de-teste.ts` monta o **mesmo Drizzle** sobre o `node:sqlite` embutido no Node e aplica
as **migrations reais**. Não é mock: um mock concorda com o que você imaginou do SQLite; só o SQLite
discorda. As perguntas que quebram este app são todas de SQL — o soft delete saiu da soma de
volume? o `leftJoin` do histórico duplicou série? a migration roda em cima de dado existente?

```bash
npm test   # node --test, roda em segundos, sem aparelho e sem simulador
```

Mexeu em `queries.ts`, `mutations.ts` ou no schema? o teste é o retorno mais rápido que existe aqui.

`novoId` e `agora` são injetados e determinísticos no teste (`id-0001`, relógio congelado): teste
que depende de UUID aleatório e de `Date.now()` falha uma vez a cada tantas execuções — e teste que
falha às vezes é teste que se aprende a ignorar.

## Reatividade

`openDatabaseSync(..., { enableChangeListener: true })` é o que faz `useLiveQuery` reagir a
escritas. Sem isso a lista de séries não atualiza sozinha e alguém "resolve" com refresh manual —
remendo que esconde a causa.

## O que não construir

Não construa fila de sincronização, resolução de conflito, cliente HTTP, login ou multiusuário.
Se um dia houver um segundo aparelho, isso vira uma decisão registrada e um trabalho próprio — não
uma preparação especulativa que atrasa o app chegar na academia.
