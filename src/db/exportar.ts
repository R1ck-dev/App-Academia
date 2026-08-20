/**
 * O lado NATIVO do backup: gravar o arquivo, abrir o share sheet e ler o arquivo
 * que ele escolher.
 *
 * Este é o único módulo do backup que toca em `expo-*`, e é por isso que ele não
 * decide nada: o formato, a validação e a restauração moram em
 * `exportar-dados.ts`, que o `node --test` exercita inteiro. Aqui não há regra
 * para testar — há sistema de arquivos.
 *
 * O arquivo vai para o diretório de CACHE de propósito: ele existe para ser
 * compartilhado (Drive, WhatsApp, e-mail) e não para virar um segundo exemplar
 * dentro do mesmo aparelho que pode sumir. Guardá-lo em `document` daria a
 * sensação de backup feito sem que uma cópia tenha saído do celular.
 */

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { agora } from './conexao.ts';
import { interpretar, montarBackup, serializar, type Leitura } from './exportar-dados.ts';
import { definirPreferencia } from './mutations.ts';
import { preferencia } from './queries.ts';
import { PREF_ULTIMO_BACKUP } from './schema.ts';

export type ResultadoDaExportacao =
  | { ok: true; nome: string }
  | { ok: false; erro: string }
  | { cancelado: true };

function nomeDoArquivo(instante: number): string {
  const d = new Date(instante);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `academia-${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}.json`;
}

/**
 * Gera o JSON e abre o share sheet.
 *
 * O carimbo de "último backup" só é gravado DEPOIS de o compartilhamento
 * terminar: marcar antes faria o app dizer "backup feito hoje" para uma
 * exportação que ele cancelou no meio, que é pior do que não marcar nada.
 */
export async function exportarBackup(): Promise<ResultadoDaExportacao> {
  const instante = agora();
  try {
    const arquivo = new File(Paths.cache, nomeDoArquivo(instante));
    if (arquivo.exists) arquivo.delete();
    arquivo.create();
    arquivo.write(serializar(montarBackup(instante)));

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, erro: 'Este aparelho não tem como compartilhar arquivos.' };
    }
    await Sharing.shareAsync(arquivo.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Backup do app de academia',
      UTI: 'public.json',
    });

    definirPreferencia(PREF_ULTIMO_BACKUP, String(instante));
    return { ok: true, nome: arquivo.name };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Abre o seletor e devolve o backup JÁ VALIDADO — sem escrever nada.
 *
 * Quem restaura é a tela, depois da confirmação: ler e restaurar no mesmo passo
 * transformaria "abri o arquivo errado" em perda de dados.
 */
export async function escolherBackup(): Promise<Leitura | { cancelado: true }> {
  try {
    const escolha = await DocumentPicker.getDocumentAsync({
      // `*/*` e não `application/json`: arquivo vindo do Drive ou do WhatsApp
      // chega com frequência sem o tipo certo, e um filtro estrito esconderia o
      // próprio backup do usuário no seletor.
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (escolha.canceled) return { cancelado: true };

    const escolhido = escolha.assets[0];
    if (escolhido === undefined) return { cancelado: true };

    return interpretar(await new File(escolhido.uri).text());
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/** O instante do último backup, ou null se ele nunca exportou. */
export function ultimoBackupEm(): number | null {
  const valor = preferencia(PREF_ULTIMO_BACKUP);
  if (valor === undefined) return null;
  const instante = Number(valor);
  return Number.isFinite(instante) ? instante : null;
}

/** Marca o backup como feito. Usado quando a restauração acabou de acontecer. */
export function registrarBackupFeito(instante: number): void {
  definirPreferencia(PREF_ULTIMO_BACKUP, String(instante));
}
