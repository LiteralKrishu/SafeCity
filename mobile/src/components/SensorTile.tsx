import { type ColorValue, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '@/theme/tokens';
import type { HealthState } from '@/types/domain';

const healthColor: Record<HealthState, ColorValue> = {
  ready: colors.safe,
  degraded: colors.alert,
  blocked: colors.danger,
  offline: colors.danger,
  checking: colors.textMuted,
};

export function SensorTile({ label, detail, state }: { label: string; detail: string; state: HealthState }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${state}`}>
      <View style={[styles.dot, { backgroundColor: healthColor[state] }]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.detail}>{detail}</Text>
      <Text style={[styles.state, { color: healthColor[state] }]}>{state.replace('_', ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    minHeight: 112,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: spacing.md },
  label: { color: colors.text, fontSize: type.body, fontWeight: '700' },
  detail: { color: colors.textMuted, fontSize: type.caption, marginTop: 4 },
  state: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: 'auto' },
});
