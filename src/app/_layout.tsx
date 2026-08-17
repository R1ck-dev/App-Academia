import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StatusBar } from 'expo-status-bar';

import { ProvedorBanco } from '@/components/provedor-banco';

export default function Layout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <ProvedorBanco>
        <NativeTabs>
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
