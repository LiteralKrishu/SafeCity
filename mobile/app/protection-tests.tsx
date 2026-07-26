import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { useMonitorStore } from '@/store/monitorStore';
import { colors, radii, spacing, type } from '@/theme/tokens';
import type { HealthState } from '@/types/domain';

const statusColor = (status: HealthState) => {
  if (status === 'ready') return colors.safe;
  if (status === 'checking') return colors.watch;
  if (status === 'degraded') return colors.alert;
  return colors.danger;
};

function TestTile({
  icon,
  title,
  detail,
  status,
  onPress,
}: {
  icon: string;
  title: string;
  detail: string;
  status: HealthState;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}. ${status}.`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.tileTop}>
        <View style={styles.iconWell}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: statusColor(status) }]} />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileDetail}>{detail}</Text>
      <Text style={[styles.status, { color: statusColor(status) }]}>
        {status.toUpperCase()} ›
      </Text>
    </Pressable>
  );
}

export default function ProtectionTestsScreen() {
  const router = useRouter();
  const health = useMonitorStore((state) => state.health);

  return (
    <Screen
      eyebrow="CHECK YOUR PHONE"
      title="Protection tests"
      right={
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.done}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      }
    >
      <View style={styles.info}>
        <Text style={styles.infoIcon}>⚡</Text>
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>Fall & throw protection</Text>
          <Text style={styles.infoText}>
            A confirmed free-fall + impact, or strong impact + jerk + rotation,
            starts the 10-second SOS countdown. A small bump may be ignored.
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <TestTile
          icon="🎙"
          title="Voice SOS"
          detail="Shout HELP or BACHAO"
          status={health.microphone}
          onPress={() => router.push('/sensor/audio' as Href)}
        />
        <TestTile
          icon="⚡"
          title="Fall & throw"
          detail="Checks impact, jerk and rotation"
          status={health.motion}
          onPress={() => router.push('/sensor/motion' as Href)}
        />
        <TestTile
          icon="⌖"
          title="Live GPS"
          detail="Checks your current location"
          status={health.location}
          onPress={() => router.push('/sensor/location' as Href)}
        />
        <TestTile
          icon="▣"
          title="Phone AI"
          detail="Runs privately on this phone"
          status={health.inference}
          onPress={() => router.push('/sensor/ai' as Href)}
        />
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Test safely</Text>
        <Text style={styles.noteText}>
          Do not drop or throw your phone. Open a test to watch live readings
          and move it gently.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  doneText: {
    color: colors.safe,
    fontSize: type.body,
    fontWeight: '900',
  },
  info: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.watchBorder,
    backgroundColor: colors.watchSoft,
    padding: spacing.md,
  },
  infoIcon: {
    fontSize: 24,
  },
  infoCopy: {
    flex: 1,
  },
  infoTitle: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: '900',
  },
  infoText: {
    color: colors.textMuted,
    fontSize: type.caption,
    lineHeight: 18,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tile: {
    width: '48%',
    minHeight: 164,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.985 }],
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconWell: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.safeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 19,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  tileTitle: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  tileDetail: {
    color: colors.textMuted,
    fontSize: type.caption,
    lineHeight: 17,
    marginTop: 4,
  },
  status: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: 'auto',
    paddingTop: spacing.sm,
  },
  note: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  noteTitle: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: '900',
  },
  noteText: {
    color: colors.textMuted,
    fontSize: type.caption,
    lineHeight: 18,
    marginTop: 4,
  },
});
