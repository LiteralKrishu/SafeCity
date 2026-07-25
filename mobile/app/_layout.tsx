import '@/services/backgroundLocation';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider } from '@/db/DatabaseProvider';
import { LocalizationProvider } from '@/i18n/localization-provider';
import { MonitoringProvider } from '@/services/MonitoringProvider';
import { StartupMaintenance } from '@/services/StartupMaintenance';
import { colors } from '@/theme/tokens';
import { ThemeProvider, useTheme } from '@/theme/theme-provider';

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.safe} />
    </View>
  );
}

function AppStack() {
  const { resolvedAppearance } = useTheme();
  return (
    <>
      <StatusBar style={resolvedAppearance === 'dark' ? 'light' : 'dark'} />
      <Stack
        key={resolvedAppearance}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="capture" options={{ gestureEnabled: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="sos-countdown" options={{ gestureEnabled: false, presentation: 'fullScreenModal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Suspense fallback={<LoadingScreen />}>
        <DatabaseProvider>
          <ThemeProvider>
            <LocalizationProvider>
              <StartupMaintenance />
              <MonitoringProvider>
                <AppStack />
              </MonitoringProvider>
            </LocalizationProvider>
          </ThemeProvider>
        </DatabaseProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
