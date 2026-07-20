import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import {
  deleteIncidentRecord,
  getIncident,
  listContacts,
  resolveIncident,
  setIncidentFeedback,
} from '@/db/repository';
import { deleteEvidenceFiles } from '@/services/evidence';
import { sendIncidentSms } from '@/services/sms';
import { colors, radii, spacing, type } from '@/theme/tokens';
import type { Incident } from '@/types/domain';

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const [incident, setIncident] = useState<Incident | null>(null);

  const refresh = useCallback(async () => {
    if (id) setIncident(await getIncident(db, id));
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!incident) {
    return (
      <Screen title="Incident unavailable">
        <Text style={styles.body}>This incident may have been deleted by the local retention policy.</Text>
      </Screen>
    );
  }

  const notify = async () => {
    const contacts = await listContacts(db);
    if (!(await sendIncidentSms(contacts, incident))) {
      Alert.alert('SMS unavailable', 'This device cannot open an SMS composer.');
    }
  };

  const resolve = async () => {
    await resolveIncident(db, incident.id);
    await refresh();
  };

  const setFeedback = async (feedback: 'correct' | 'false_positive') => {
    await setIncidentFeedback(db, incident.id, feedback);
    await refresh();
  };

  const remove = () => {
    Alert.alert('Delete local incident?', 'This permanently deletes its encrypted evidence from this device.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteEvidenceFiles([incident.rearPhotoUri, incident.frontPhotoUri, incident.audioUri]);
          void deleteIncidentRecord(db, incident.id).then(() => router.replace('/(tabs)/history'));
        },
      },
    ]);
  };

  const evidence = [
    { label: 'Rear photo', ready: Boolean(incident.rearPhotoUri) },
    { label: 'Front photo', ready: Boolean(incident.frontPhotoUri) },
    { label: '15-second audio', ready: Boolean(incident.audioUri) },
  ];

  return (
    <Screen
      eyebrow={incident.state === 'resolved' ? 'Resolved incident' : 'Active incident'}
      title="Incident details"
      right={
        <Pressable onPress={() => router.back()}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      }
    >
      <View style={[styles.stateBanner, incident.state === 'resolved' && styles.resolvedBanner]}>
        <Text style={styles.stateLabel}>{incident.state === 'resolved' ? '✓ Resolved' : 'SOS active'}</Text>
        <Text style={styles.timestamp}>{new Date(incident.createdAt).toLocaleString()}</Text>
      </View>

      <Card title={incident.summary} subtitle={`Model/config: ${incident.modelVersion}`}>
        <Text style={styles.score}>{Math.round(incident.riskScore * 100)}% fused risk</Text>
        {incident.factors.map((factor) => (
          <Text key={factor} style={styles.factor}>• {factor}</Text>
        ))}
      </Card>

      <Text style={styles.sectionLabel}>Encrypted evidence</Text>
      <Card subtitle="Files remain encrypted in app-private storage and are never uploaded automatically.">
        {evidence.map((item) => (
          <View key={item.label} style={styles.evidenceRow}>
            <Text style={styles.evidenceIcon}>{item.ready ? '✓' : '—'}</Text>
            <Text style={styles.evidenceLabel}>{item.label}</Text>
            <Text style={[styles.evidenceState, item.ready && styles.ready]}> {item.ready ? 'secured' : 'unavailable'} </Text>
          </View>
        ))}
      </Card>

      <Text style={styles.sectionLabel}>Response</Text>
      <View style={styles.actions}>
        <ActionButton label="Notify contacts" onPress={() => void notify()} variant="danger" />
        {incident.latitude !== null && incident.longitude !== null ? (
          <ActionButton
            label="Open location"
            onPress={() => void Linking.openURL(`https://maps.google.com/?q=${incident.latitude},${incident.longitude}`)}
            variant="secondary"
          />
        ) : null}
        {incident.state !== 'resolved' ? (
          <ActionButton label="Mark safe and resolve" onPress={() => void resolve()} variant="secondary" />
        ) : null}
      </View>

      <Text style={styles.sectionLabel}>Was this detection useful?</Text>
      <View style={styles.feedbackRow}>
        <Pressable
          onPress={() => void setFeedback('correct')}
          style={[styles.feedback, incident.feedback === 'correct' && styles.feedbackSelected]}
        >
          <Text style={styles.feedbackText}>Yes, correct</Text>
        </Pressable>
        <Pressable
          onPress={() => void setFeedback('false_positive')}
          style={[styles.feedback, incident.feedback === 'false_positive' && styles.feedbackSelected]}
        >
          <Text style={styles.feedbackText}>False alarm</Text>
        </Pressable>
      </View>

      <Pressable onPress={remove} style={styles.deleteButton}>
        <Text style={styles.deleteText}>Delete incident and evidence</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textMuted },
  close: { color: colors.watch, fontWeight: '800' },
  stateBanner: { backgroundColor: colors.dangerSoft, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.md },
  resolvedBanner: { backgroundColor: colors.safeSoft },
  stateLabel: { color: colors.text, fontSize: type.title, fontWeight: '900', textTransform: 'capitalize' },
  timestamp: { color: colors.textMuted, marginTop: spacing.xs },
  score: { color: colors.alert, fontWeight: '800', fontSize: type.heading, marginTop: spacing.md },
  factor: { color: colors.text, marginTop: spacing.sm, lineHeight: 20 },
  sectionLabel: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: type.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  evidenceIcon: { color: colors.safe, width: 20, fontWeight: '900' },
  evidenceLabel: { color: colors.text, flex: 1 },
  evidenceState: { color: colors.textMuted, fontSize: type.caption, textTransform: 'uppercase', fontWeight: '800' },
  ready: { color: colors.safe },
  actions: { gap: spacing.sm },
  feedbackRow: { flexDirection: 'row', gap: spacing.sm },
  feedback: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackSelected: { borderColor: colors.safe, backgroundColor: colors.safeSoft },
  feedbackText: { color: colors.text, fontWeight: '700' },
  deleteButton: { alignItems: 'center', padding: spacing.lg, marginTop: spacing.lg },
  deleteText: { color: colors.danger, fontWeight: '800' },
});

