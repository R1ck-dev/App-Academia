#!/usr/bin/env node
/**
 * Gera (e opcionalmente instala) o APK de release.
 *
 * Herdado do app de controle financeiro, onde as três dores abaixo foram
 * medidas em 07/08/2026:
 *
 * 1. `ANDROID_HOME` não está no ambiente desta máquina, e sem ele o Gradle
 *    falha. Definir na mão a cada sessão é o tipo de passo que se esquece.
 * 2. O APK saiu com **107 MB** porque empacota as bibliotecas nativas das quatro
 *    arquiteturas. Um celular usa **uma**. Limitar à do aparelho corta a maior
 *    parte disso, e a configuração não pode morar em `android/gradle.properties`
 *    — essa pasta é saída do `prebuild` e não é versionada, então sumiria no
 *    próximo `prebuild --clean`. Aqui, sobrevive.
 * 3. `--no-daemon` custou 59 minutos numa build que, com daemon, leva 6.
 *    Este script simplesmente não passa a flag.
 *
 * Uso:
 *   node scripts/apk.mjs                 gera o APK para arm64 (celulares atuais)
 *   node scripts/apk.mjs --instalar      gera e instala no aparelho conectado
 *   node scripts/apk.mjs --todas         gera para as 4 arquiteturas (emulador x86)
 */

import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const instalar = args.includes('--instalar');
const todas = args.includes('--todas');

// Celular Android atual é arm64-v8a. Emulador do Android Studio costuma ser
// x86_64 — daí o `--todas`, que continua disponível quando for o caso.
const arquiteturas = todas ? 'armeabi-v7a,arm64-v8a,x86,x86_64' : 'arm64-v8a';

const sdk =
  process.env.ANDROID_HOME ??
  process.env.ANDROID_SDK_ROOT ??
  join(process.env.LOCALAPPDATA ?? process.env.HOME ?? '', 'Android', 'Sdk');

if (!existsSync(sdk)) {
  console.error(`SDK do Android não encontrado em ${sdk}.`);
  console.error('Defina ANDROID_HOME apontando para a pasta do SDK e rode de novo.');
  process.exit(1);
}

const pastaAndroid = join(raiz, 'android');
if (!existsSync(pastaAndroid)) {
  console.error('A pasta android/ não existe. Rode antes:');
  console.error('  npx expo prebuild --platform android');
  process.exit(1);
}

const ambiente = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };

// Caminho absoluto: o wrapper não está no PATH, e o `cmd` do Windows não procura
// executável no diretório atual — `gradlew.bat` sozinho dá "não reconhecido".
const gradlew = join(pastaAndroid, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

console.log(`Compilando release para ${arquiteturas}…`);
const build = spawnSync(
  gradlew,
  ['assembleRelease', `-PreactNativeArchitectures=${arquiteturas}`],
  { cwd: pastaAndroid, env: ambiente, stdio: 'inherit', shell: process.platform === 'win32' }
);

if (build.status !== 0) process.exit(build.status ?? 1);

// Com split por arquitetura o Gradle nomeia o arquivo com o ABI; com uma só, não.
const saida = join(pastaAndroid, 'app', 'build', 'outputs', 'apk', 'release');
const apk = join(saida, 'app-release.apk');

if (!existsSync(apk)) {
  console.error(`Build terminou, mas não achei o APK em ${saida}.`);
  process.exit(1);
}

const mb = (statSync(apk).size / 1024 / 1024).toFixed(1);
console.log(`\nAPK: ${apk}  (${mb} MB)`);

if (!instalar) {
  console.log('Para instalar no aparelho: node scripts/apk.mjs --instalar');
  process.exit(0);
}

// `-r` reinstala preservando os dados. Sem ele, o Android recusa por conflito de
// pacote — e desinstalar apagaria o banco, que é o único exemplar dos treinos.
const adb = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
console.log('\nInstalando no aparelho…');
const inst = spawnSync(adb, ['install', '-r', apk], { stdio: 'inherit', env: ambiente });
process.exit(inst.status ?? 0);
