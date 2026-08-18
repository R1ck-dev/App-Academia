/**
 * As três famílias empacotadas no app — e só elas.
 *
 * O import vem do SUBCAMINHO de cada pacote, não do índice: o índice da Figtree
 * referencia 28 arquivos `.ttf` (todos os pesos e itálicos), e o Metro
 * empacotaria os 28 para usar três.
 *
 * Mora em `constants/` e não no layout porque quem carrega as fontes é o
 * `ProvedorBanco`, e um componente importando de `app/` fecharia um ciclo entre
 * a rota e o componente que ela renderiza.
 */

import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo/400Regular';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';

export const FONTES = {
  Caprasimo_400Regular,
  Figtree_400Regular,
  Figtree_700Bold,
};
