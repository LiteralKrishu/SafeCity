import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '@/theme/tokens';
import type { RiskLevel } from '@/types/domain';

const riskStyle: Record<RiskLevel, { color: string; background: string; label: string; icon: string }> = {
  safe: { color: colors.safe, background: colors.safeSoft, label: 'Safe', icon: '✓' },
  watch: { color: colors.watch, background: colors.surfaceRaised, label: 'Validating', icon: '◌' },
  alert: { color: colors.alert, background: colors.alertSoft, label: 'Check in', icon: '!' },
  sos_pending: { color: colors.danger, background: colors.dangerSoft, label: 'SOS pending', icon: '!' },
  sos: { color: colors.danger, background: colors.dangerSoft, label: 'SOS active', icon: 'SOS' },
};

export function RiskHero({ level, score, detail }: { level: RiskLevel; score: number; detail: string }) {
  const config = riskStyle[level];
  return (
    <View style={[styles.hero, { backgroundColor: config.background, borderColor: config.color }]}>
      <View style={[styles.iconCircle, { borderColor: config.color }]}>
        <Text style={[styles.icon, { color: config.color }]}>{config.icon}</Text>
      </View>
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
      <Text style={styles.detail}>{detail}</Text>
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Fused confidence</Text>
        <Text style={[styles.score, { color: config.color }]}>{Math.round(score * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderRadius: radii.lg,
    alignItems: 'center',
    padding: spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon: { fontSize: type.title, fontWeight: '900' },
  label: { fontSize: type.title, fontWeight: '800', letterSpacing: -0.5 },
  detail: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21 },
  scoreRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  scoreLabel: { color: colors.textMuted, fontSize: type.caption },
  score: { fontWeight: '800', fontSize: type.caption },
});

