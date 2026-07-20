import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/Card';
import { RiskHero } from '@/components/RiskHero';
import { Screen } from '@/components/Screen';
import { SensorTile } from '@/components/SensorTile';
import { useMonitoring } from '@/services/MonitoringProvider';
import { useMonitorStore } from '@/store/monitorStore';
import { colors, radii, spacing, type } from '@/theme/tokens';

export default function MonitorScreen() {
  const actions = useMonitoring();
  const [busy, setBusy] = useState(false);
  const { sessionState, riskLevel, score, latestAssessment, health } = useMonitorStore();
  const detail = useMemo(() => {
    if (latestAssessment) return latestAssessment.explanation;
    if (sessionState === 'monitoring') return 'Listening for agreement across audio, motion, and context.';
    if (sessionState === 'paused') return 'Monitoring is paused. Manual SOS remains available.';
    return 'Start a session before a walk, commute, or unfamiliar journey.';
  }, [latestAssessment, sessionState]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert('Could not update monitoring', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      eyebrow="Local safety monitor"
      title="SafeCity"
      right={
        <View style={[styles.livePill, sessionState === 'monitoring' && styles.livePillActive]}>
          <View style={[styles.liveDot, sessionState === 'monitoring' && styles.liveDotActive]} />
          <Text style={styles.liveText}>{sessionState === 'monitoring' ? 'Live' : sessionState}</Text>
        </View>
      }
    >
      <RiskHero level={riskLevel} score={score} detail={detail} />

      <View style={styles.controls}>
        {sessionState === 'idle' ? (
          <ActionButton label="Start monitoring" onPress={() => void run(actions.startMonitoring)} loading={busy} />
        ) : sessionState === 'paused' ? (
          <ActionButton label="Resume monitoring" onPress={() => void run(actions.resumeMonitoring)} loading={busy} />
        ) : (
          <ActionButton label="Pause monitoring" onPress={() => void run(actions.pauseMonitoring)} variant="secondary" loading={busy} />
        )}
        {sessionState !== 'idle' ? (
          <ActionButton label="End session" onPress={() => void run(actions.stopMonitoring)} variant="ghost" />
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Protection health</Text>
      <View style={styles.sensorGrid}>
        <SensorTile label="Audio" detail="Pretrained sound model" state={health.microphone} />
        <SensorTile label="Motion" detail="Fall + jerk patterns" state={health.motion} />
        <SensorTile label="Location" detail="SOS context only" state={health.location} />
        <SensorTile label="Local AI" detail="Docker inference" state={health.inference} />
      </View>

      {latestAssessment?.matchedPatterns.length ? (
        <Card title="Retrieved pattern" subtitle="The closest consented safety pattern used during this assessment.">
          {latestAssessment.matchedPatterns.slice(0, 2).map((pattern) => (
            <View key={pattern.id} style={styles.patternRow}>
              <View style={styles.patternCopy}>
                <Text style={styles.patternName}>{pattern.name}</Text>
                <Text style={styles.patternReason}>{pattern.rationale}</Text>
              </View>
              <Text style={styles.patternScore}>{Math.round(pattern.similarity * 100)}%</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={styles.sosSection}>
        <Text style={styles.sosLabel}>Manual fallback</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hold to activate SOS"
          delayLongPress={900}
          onLongPress={() => void actions.triggerManualSos()}
          style={({ pressed }) => [styles.sosButton, pressed && styles.sosPressed]}
        >
          <Text style={styles.sosText}>SOS</Text>
          <Text style={styles.sosHint}>Hold for 1 second</Text>
        </Pressable>
        <Text style={styles.disclaimer}>
          SafeCity cannot guarantee detection, message delivery, or emergency response. Call local emergency services when safe to do so.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  livePillActive: { borderColor: colors.safe, backgroundColor: colors.safeSoft },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textMuted },
  liveDotActive: { backgroundColor: colors.safe },
  liveText: { color: colors.text, fontSize: type.caption, fontWeight: '800', textTransform: 'capitalize' },
  controls: { gap: spacing.sm, marginTop: spacing.md },
  sectionTitle: { color: colors.text, fontSize: type.heading, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.md },
  sensorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  patternRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  patternCopy: { flex: 1 },
  patternName: { color: colors.text, fontWeight: '700' },
  patternReason: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: 4 },
  patternScore: { color: colors.watch, fontWeight: '800' },
  sosSection: { alignItems: 'center', marginTop: spacing.xl },
  sosLabel: { color: colors.textMuted, fontSize: type.caption, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  sosButton: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: colors.danger,
    borderWidth: 10,
    borderColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  sosPressed: { transform: [{ scale: 0.96 }], opacity: 0.88 },
  sosText: { color: colors.white, fontSize: 38, fontWeight: '900', letterSpacing: 1 },
  sosHint: { color: colors.white, fontSize: type.caption, fontWeight: '700', marginTop: 3 },
  disclaimer: { color: colors.textMuted, textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: spacing.md, maxWidth: 320 },
});

