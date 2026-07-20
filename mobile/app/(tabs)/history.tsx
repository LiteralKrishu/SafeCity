import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { listIncidents } from '@/db/repository';
import { colors, radii, spacing, type } from '@/theme/tokens';
import type { Incident } from '@/types/domain';

const stateColor = (state: Incident['state']) =>
  state === 'resolved' ? colors.safe : state === 'alert' ? colors.alert : colors.danger;

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useFocusEffect(
    useCallback(() => {
      void listIncidents(db).then(setIncidents);
    }, [db]),
  );

  return (
    <Screen eyebrow="Stored on this device" title="Incident history">
      <Card
        title={`${incidents.length} local incident${incidents.length === 1 ? '' : 's'}`}
        subtitle="Raw monitoring audio is discarded. Only SOS evidence and decision summaries appear here."
      >
        {incidents.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>No incidents recorded</Text>
            <Text style={styles.emptyBody}>Your monitoring sessions will remain private and quiet here.</Text>
          </View>
        ) : (
          incidents.map((incident) => (
            <Pressable
              key={incident.id}
              onPress={() => router.push({ pathname: '/incident/[id]', params: { id: incident.id } })}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.marker, { backgroundColor: stateColor(incident.state) }]} />
              <View style={styles.copy}>
                <Text style={styles.summary}>{incident.summary}</Text>
                <Text style={styles.meta}>
                  {new Date(incident.createdAt).toLocaleString()} · {incident.evidenceStatus}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: {
    color: colors.safe,
    fontSize: 26,
    borderWidth: 1,
    borderColor: colors.safe,
    width: 54,
    height: 54,
    borderRadius: 27,
    textAlign: 'center',
    lineHeight: 52,
  },
  emptyTitle: { color: colors.text, fontSize: type.heading, fontWeight: '800', marginTop: spacing.md },
  emptyBody: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.65 },
  marker: { width: 10, height: 42, borderRadius: radii.pill },
  copy: { flex: 1 },
  summary: { color: colors.text, fontSize: type.body, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: type.caption, marginTop: 4, textTransform: 'capitalize' },
  chevron: { color: colors.textMuted, fontSize: 28 },
});

