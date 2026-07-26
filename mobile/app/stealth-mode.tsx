import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, Pressable, StyleSheet } from 'react-native';

import { useMonitorStore } from '@/store/monitorStore';

const DOUBLE_TAP_WINDOW_MS = 420;

export default function StealthModeScreen() {
  const router = useRouter();
  const lastTapAt = useRef(0);

  useEffect(() => {
    useMonitorStore.getState().setStealthModeActive(true);
    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );
    return () => {
      backSubscription.remove();
      useMonitorStore.getState().setStealthModeActive(false);
    };
  }, []);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapAt.current <= DOUBLE_TAP_WINDOW_MS) {
      useMonitorStore.getState().setStealthModeActive(false);
      router.back();
      return;
    }
    lastTapAt.current = now;
  };

  return (
    <>
      <StatusBar hidden />
      <Pressable
        accessibilityLabel="Stealth screen active. Double tap to return to SafeCity."
        accessibilityRole="button"
        onPress={handleTap}
        style={styles.screen}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
