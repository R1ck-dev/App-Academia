/**
 * O botão de voltar do Android, para as telas que não são rotas.
 *
 * Treino, Histórico e Corpo são as três rotas do app; tudo o que abre por
 * dentro delas — a execução da sessão, o resumo, a ficha, o backup — é estado
 * dentro da aba, e não pilha de navegação. Isso é deliberado (uma tela cheia
 * dentro da aba não faz a barra de abas piscar), mas custa isto: sem ninguém
 * escutando, o voltar do aparelho não tem o que desempilhar e joga o usuário
 * para fora do app. Foi exatamente o beco sem saída da tela de execução, cuja
 * única porta era "Finalizar" — que grava a sessão no histórico.
 *
 * As folhas que sobem (peso, calibração, item da ficha) NÃO precisam deste
 * hook: são `Modal`, e o `onRequestClose` já recebe o voltar do Android antes
 * de qualquer listener daqui.
 *
 * `aoVoltar === null` significa "esta tela é a raiz da aba": o evento segue seu
 * caminho normal, que é o Android mandar o app para segundo plano.
 */

import { useCallback } from 'react';
import { BackHandler } from 'react-native';

import { useFocusEffect } from 'expo-router';

export function useVoltarDoAparelho(aoVoltar: (() => void) | null): void {
  // `useFocusEffect` e não `useEffect`: as três abas ficam montadas ao mesmo
  // tempo, então um listener por `useEffect` continuaria respondendo com o
  // Histórico na frente — e o voltar sairia de um treino que nem está à vista.
  useFocusEffect(
    useCallback(() => {
      if (aoVoltar === null) return;
      const inscricao = BackHandler.addEventListener('hardwareBackPress', () => {
        aoVoltar();
        return true;
      });
      return () => inscricao.remove();
    }, [aoVoltar])
  );
}
