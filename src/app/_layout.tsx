/**
 * A casca do app: tema claro, fontes empacotadas e as três abas nativas.
 *
 * O tema do react-navigation também muda porque é ele quem pinta o fundo da
 * cena entre uma tela e outra — deixá-lo escuro faria um piscar preto a cada
 * navegação dentro de um app creme.
 */

import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StatusBar } from 'expo-status-bar';

import { ProvedorBanco } from '@/components/provedor-banco';
import { cor, fonte } from '@/constants/tema';

const temaDaNavegacao = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: cor.fundo,
    card: cor.superficieElevada,
    text: cor.texto,
    border: cor.borda,
    primary: cor.acao,
    notification: cor.acao,
  },
};

export default function Layout() {
  return (
    <ThemeProvider value={temaDaNavegacao}>
      {/* Ícones escuros: a barra de status fica sobre creme. */}
      <StatusBar style="dark" />
      <ProvedorBanco>
        <NativeTabs
          backgroundColor={cor.superficieElevada}
          tintColor={cor.acao}
          iconColor={cor.textoTerciario}
          indicatorColor={cor.acaoTinta}
          rippleColor={cor.acaoTinta}
          labelStyle={{ fontFamily: fonte.corpoForte, fontSize: 11 }}
        >
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Icon sf="dumbbell.fill" md="fitness_center" />
            <NativeTabs.Trigger.Label>Treino</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="historico">
            <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="trending_up" />
            <NativeTabs.Trigger.Label>Histórico</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="corpo">
            <NativeTabs.Trigger.Icon sf="figure.stand" md="accessibility" />
            <NativeTabs.Trigger.Label>Corpo</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        </NativeTabs>
      </ProvedorBanco>
    </ThemeProvider>
  );
}
