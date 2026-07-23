import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

export type HapticType = 'short' | 'warning' | 'sos';

export async function triggerHaptic(type: HapticType = 'short'): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      if (type === 'short') {
        await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key);
        return;
      }
      if (type === 'warning') {
        await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
        return;
      }
    } catch {
      // Fall through to the cross-platform fallback below.
    }
  }

  if (type === 'short') {
    await Haptics.selectionAsync().catch(() => undefined);
    return;
  }

  if (type === 'warning') {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    return;
  }

  Vibration.vibrate([0, 500, 200, 500, 200, 500]);
}
