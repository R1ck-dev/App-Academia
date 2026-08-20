/**
 * O teste que enxerga o React Compiler.
 *
 * Em 17/08/2026, com 350 testes verdes, a tela de execução ficou congelada no
 * aparelho: registrar série gravava no banco e não aparecia nada. O motivo não
 * estava em nenhum arquivo do projeto como ele é ESCRITO, e sim como ele é
 * COMPILADO — `app.json` liga `experiments.reactCompiler`, e o compilador
 * recalcula as dependências de `useMemo` a partir do corpo do callback:
 *
 *     useMemo(() => planoDaSessao(id), [id, versao])
 *     → if ($[0] !== id) { t0 = planoDaSessao(id); }      // `versao` apagada
 *
 * Ele está no direito: as Regras do React dizem que a função é pura, e uma
 * consulta ao SQLite não é. Quem estava errado era o padrão "dependência
 * artificial para invalidar cache".
 *
 * Este teste roda o compilador de verdade sobre as telas e falha se alguma
 * leitura de `queries.ts` voltar a cair dentro de um cache dele. É o mesmo
 * princípio do teste estrutural de `sinal.test.ts`: o modo de falhar é omissão
 * silenciosa, então a trava tem que ser automática.
 *
 * **Limite conhecido:** o teste vê as chamadas nomeadas de `queries.ts` dentro de
 * componentes e hooks. Uma leitura escondida dentro de uma função auxiliar comum
 * (como `montarResumo`, em `treino-resumo.tsx`) é invisível para ele — e também
 * para o compilador, que não memoriza corpo de função que não é hook nem
 * componente. Resumo de sessão finalizada é foto de propósito.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import { describe, it } from 'node:test';

// `require` e não `import`: o `@babel/core` é CommonJS e não traz tipos
// próprios, e o `tsc --noEmit` deste projeto é estrito.
const requerer = createRequire(import.meta.url);
const babel = requerer('@babel/core') as {
  transformSync: (
    codigo: string,
    opcoes: Record<string, unknown>
  ) => { code: string | null } | null;
};

const PASTA_COMPONENTES = import.meta.dirname;
const PASTA_APP = join(import.meta.dirname, '..', 'app');

/** Compila como o Metro compila: o compilador primeiro, depois o TypeScript. */
function compilar(nomeArquivo: string, fonte: string): string {
  const tsx = extname(nomeArquivo) === '.tsx';
  const saida = babel.transformSync(fonte, {
    filename: nomeArquivo,
    configFile: false,
    babelrc: false,
    plugins: ['babel-plugin-react-compiler'],
    presets: [['@babel/preset-typescript', { isTSX: tsx, allExtensions: true }]],
  });
  assert.ok(saida?.code, `o Babel não devolveu código para ${nomeArquivo}`);
  return saida.code;
}

/**
 * Os nomes que o arquivo importa de um módulo de LEITURA do banco.
 *
 * São três: `queries.ts` e os dois do backup, que leem o banco inteiro. Qualquer
 * módulo novo que leia direto precisa entrar aqui, senão o detector passa por
 * cima dele sem avisar.
 */
const MODULOS_DE_LEITURA = String.raw`@\/db\/(?:queries|exportar|exportar-dados)`;

function consultasImportadas(fonte: string): string[] {
  const bloco = fonte.match(new RegExp(String.raw`import\s*\{([^}]*)\}\s*from\s*'${MODULOS_DE_LEITURA}'`));
  if (!bloco) return [];
  return bloco[1]
    .split(',')
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '' && !parte.startsWith('type '))
    .map((parte) => (parte.includes(' as ') ? parte.split(' as ')[1].trim() : parte));
}

/**
 * As leituras que o compilador guardou em cache.
 *
 * A assinatura é a atribuição a um temporário do compilador: `t0 = consulta()`.
 * Passar a consulta dentro de uma função (`t0 = () => consulta()`) é o certo — o
 * cache guarda a função, e quem a chama é o `useSyncExternalStore`, a cada render.
 */
function leiturasMemorizadas(compilado: string, consultas: string[]): string[] {
  return consultas.filter((nome) =>
    new RegExp(`(?:t\\d+|_temp\\d*)\\s*=\\s*${nome}\\s*\\(`).test(compilado)
  );
}

/** Só quem CHAMA consulta: quem importa apenas o tipo do resultado não lê nada. */
function telasQueLeemOBanco(): { nome: string; fonte: string; consultas: string[] }[] {
  const arquivos: { nome: string; fonte: string; consultas: string[] }[] = [];
  for (const pasta of [PASTA_APP, PASTA_COMPONENTES]) {
    for (const nome of readdirSync(pasta)) {
      if (!/\.tsx?$/.test(nome) || nome.endsWith('.test.ts')) continue;
      const fonte = readFileSync(join(pasta, nome), 'utf8');
      const consultas = consultasImportadas(fonte);
      if (consultas.length > 0) arquivos.push({ nome, fonte, consultas });
    }
  }
  return arquivos;
}

describe('o detector', () => {
  it('reconhece o padrão que quebrou o app — se parar de reconhecer, o resto aqui é decorativo', () => {
    const quebrado = `
      import { useMemo } from 'react';
      import { planoDaSessao } from '@/db/queries';
      export function usePlanoDaSessao(sessaoId: string, versao: number) {
        return useMemo(() => planoDaSessao(sessaoId), [sessaoId, versao]);
      }
    `;
    const compilado = compilar('quebrado.ts', quebrado);

    assert.deepEqual(leiturasMemorizadas(compilado, ['planoDaSessao']), ['planoDaSessao']);
    assert.ok(
      !/!==\s*versao/.test(compilado),
      'a dependência artificial deveria ter sumido da chave do cache — é o bug em uma linha'
    );
  });

  it('aprova a leitura que sai de useSyncExternalStore', () => {
    const certo = `
      import { useSyncExternalStore } from 'react';
      import { lerComCache } from '@/db/consulta';
      import { assinarEscritas } from '@/db/sinal';
      import { planoDaSessao } from '@/db/queries';
      export function usePlanoDaSessao(sessaoId: string) {
        const ler = () => lerComCache('p:' + sessaoId, () => planoDaSessao(sessaoId));
        return useSyncExternalStore(assinarEscritas, ler, ler);
      }
    `;
    assert.deepEqual(leiturasMemorizadas(compilar('certo.ts', certo), ['planoDaSessao']), []);
  });
});

describe('nenhuma tela lê o banco dentro de um cache do compilador', () => {
  const telas = telasQueLeemOBanco();

  it('encontrou as telas que leem o banco', () => {
    assert.ok(telas.length >= 3, `esperava achar telas lendo queries.ts, achei ${telas.length}`);
  });

  for (const tela of telas) {
    it(`${tela.nome} relê depois de cada escrita`, () => {
      const congeladas = leiturasMemorizadas(compilar(tela.nome, tela.fonte), tela.consultas);
      assert.deepEqual(
        congeladas,
        [],
        `o React Compiler vai guardar estas leituras e a tela não atualiza: ${congeladas.join(', ')}`
      );
    });
  }
});
