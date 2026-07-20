import '@/services/backgroundLocation';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider } from '@/db/DatabaseProvider';
import { MonitoringProvider } from '@/services/MonitoringProvider';
import { StartupMaintenance } from '@/services/StartupMaintenance';
import { colors } from '@/theme/tokens';

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.safe} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Suspense fallback={<LoadingScreen />}>
        <DatabaseProvider>
          <StartupMaintenance />
          <MonitoringProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="capture" options={{ gestureEnabled: false, presentation: 'fullScreenModal' }} />
            </Stack>
          </MonitoringProvider>
        </DatabaseProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
