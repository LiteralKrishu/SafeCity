import * as Location from 'expo-location';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import * as SMS from 'expo-sms';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { listContacts } from '@/db/repository';
import { useLocalization } from '@/i18n/localization-provider';
import { initializeOnDeviceAudio, ON_DEVICE_MODEL_VERSION } from '@/inference/onDeviceAudio';
import { useMonitoring } from '@/services/MonitoringProvider';
import { useMonitorStore } from '@/store/monitorStore';
import { colors, radii, spacing, type as typography } from '@/theme/tokens';
import type { HealthState, VoiceTriggerStatus } from '@/types/domain';

type SensorType = 'audio' | 'motion' | 'location' | 'ai';

interface LiveLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

const supportedSensors = new Set<SensorType>(['audio', 'motion', 'location', 'ai']);

function healthLabel(state: HealthState): string {
  if (state === 'ready') return 'Ready';
  if (state === 'checking') return 'Checking';
  if (state === 'degraded') return 'Limited';
  if (state === 'blocked') return 'Permission blocked';
  return 'Offline';
}

function healthColor(state: HealthState): string {
  if (state === 'ready') return colors.safe;
  if (state === 'checking') return colors.watch;
  if (state === 'degraded') return colors.alert;
  return colors.danger;
}

function voiceTriggerLabel(status: VoiceTriggerStatus): string {
  if (status === 'listening') return 'Listening for Help / Bachao';
  if (status === 'checking') return 'Starting offline recognition';
  if (status === 'unavailable') return 'Offline speech model unavailable';
  if (status === 'error') return 'Needs attention';
  return 'Off';
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export default function SensorDetailScreen() {
  const params = useLocalSearchParams<{ sensor?: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const monitoring = useMonitoring();
  const { t } = useLocalization();
  const { health, latestAssessment, sessionState, telemetry } = useMonitorStore();
  const [busy, setBusy] = useState(false);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(
    telemetry.location,
  );

  const sensor: SensorType = supportedSensors.has(params.sensor as SensorType)
    ? (params.sensor as SensorType)
    : 'audio';

  const definition = useMemo(
    () => ({
      audio: {
        icon: '🎙',
        title: t('home.screamTitle'),
        detail: t('home.screamDetail'),
        health: health.microphone,
      },
      motion: {
        icon: '⚡',
        title: t('home.fallTitle'),
        detail: t('home.fallDetail'),
        health: health.motion,
      },
      location: {
        icon: '⌖',
        title: t('home.locationTitle'),
        detail: t('home.locationDetail'),
        health: health.location,
      },
      ai: {
        icon: '▣',
        title: t('home.aiTitle'),
        detail: t('home.aiDetail'),
        health: health.inference,
      },
    }),
    [health, t],
  )[sensor];

  const refreshLocation = useCallback(async (requestPermission: boolean) => {
    setBusy(true);
    setDiagnostic(null);
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && requestPermission) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!permission.granted) throw new Error('Location permission is not enabled.');
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const nextLocation = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy,
      };
      setLiveLocation(nextLocation);
      useMonitorStore.getState().setTelemetry({
        location: nextLocation,
        locationUpdatedAt: Date.now(),
      });
      setDiagnostic('Live GPS fix received from this phone.');
    } catch (error) {
      setDiagnostic(error instanceof Error ? error.message : 'Location check failed.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (sensor === 'location' && !liveLocation) void refreshLocation(false);
  }, [liveLocation, refreshLocation, sensor]);

  const runDiagnostic = async () => {
    setBusy(true);
    setDiagnostic(null);
    try {
      if (sensor === 'location') {
        setBusy(false);
        await refreshLocation(true);
        return;
      }
      if (sensor === 'ai') {
        await initializeOnDeviceAudio();
        useMonitorStore.getState().setHealth({ inference: 'ready' });
        setDiagnostic('The bundled YAMNet model loaded and completed its local warm-up inference.');
        return;
      }
      if (sessionState === 'idle') await monitoring.startMonitoring();
      else if (sessionState === 'paused') await monitoring.resumeMonitoring();
      setDiagnostic(
        sensor === 'audio'
          ? 'Microphone monitoring is active. Speak normally and watch the live signal meter.'
          : 'Motion monitoring is active. Move the phone gently and watch the live axes.',
      );
    } catch (error) {
      setDiagnostic(error instanceof Error ? error.message : 'The sensor diagnostic failed.');
    } finally {
      setBusy(false);
    }
  };

  const locationUrl = liveLocation
    ? `https://maps.google.com/?q=${liveLocation.latitude},${liveLocation.longitude}`
    : null;

  const shareLocation = async () => {
    if (!locationUrl) return;
    await Share.share({ message: `SafeCity live location check-in: ${locationUrl}` });
  };

  const textGuardians = async () => {
    if (!locationUrl) return;
    const contacts = await listContacts(db);
    if (!contacts.length) {
      Alert.alert('No emergency contacts', 'Add a contact in Settings before sharing by SMS.');
      return;
    }
    if (!(await SMS.isAvailableAsync())) {
      Alert.alert('SMS unavailable', 'This phone cannot open an SMS composer.');
      return;
    }
    await SMS.sendSMSAsync(
      contacts.map((contact) => contact.phone),
      `SafeCity location check-in: ${locationUrl}\nThis message was prepared by the user; live tracking is not enabled.`,
    );
  };

  const prepareEmergencySms = async () => {
    if (!(await SMS.isAvailableAsync())) {
      Alert.alert('SMS unavailable', 'Call 112 directly if you need immediate help.');
      return;
    }
    const location = locationUrl ?? 'Location unavailable';
    await SMS.sendSMSAsync(
      ['112'],
      `Emergency assistance requested via SafeCity. Location: ${location}. The user must press Send in this composer.`,
    );
  };

  return (
    <Screen
      eyebrow="Live device diagnostic"
      title={`${definition.icon} ${definition.title}`}
      right={
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>{t('common.done')}</Text>
        </Pressable>
      }
    >
      <View style={styles.healthBanner}>
        <View style={[styles.healthDot, { backgroundColor: healthColor(definition.health) }]} />
        <View style={styles.healthCopy}>
          <Text style={styles.healthTitle}>{healthLabel(definition.health)}</Text>
          <Text style={styles.healthDetail}>{definition.detail}</Text>
        </View>
      </View>

      {sensor === 'audio' ? (
        <Card title="Live microphone signal" subtitle="A relative signal meter; it is not a calibrated decibel reading.">
          <View style={styles.meterTrack}>
            <View style={[styles.meterFill, { width: `${Math.max(2, telemetry.audioLevel * 100)}%` }]} />
          </View>
          <Metric label="Relative level" value={`${Math.round(telemetry.audioLevel * 100)}%`} />
          <Metric label="Processing" value="Volatile memory only" />
          <Metric
            label="Voice SOS"
            value={voiceTriggerLabel(telemetry.voiceTriggerStatus)}
          />
        </Card>
      ) : null}

      {sensor === 'motion' ? (
        <Card title="Live 3-axis motion" subtitle="Values are acceleration including gravity, expressed in g.">
          <View style={styles.metricGrid}>
            <Metric label="X axis" value={`${(telemetry.motion?.x ?? 0).toFixed(2)} g`} />
            <Metric label="Y axis" value={`${(telemetry.motion?.y ?? 0).toFixed(2)} g`} />
            <Metric label="Z axis" value={`${(telemetry.motion?.z ?? 0).toFixed(2)} g`} />
            <Metric label="Magnitude" value={`${(telemetry.motion?.magnitudeG ?? 0).toFixed(2)} g`} />
          </View>
          <Text style={styles.explainer}>A fall decision also requires an ordered free-fall and impact pattern plus temporal confirmation.</Text>
        </Card>
      ) : null}

      {sensor === 'location' ? (
        <>
          <Card title="Current phone location" subtitle="Read directly from the operating system after permission is granted.">
            <Metric label="Latitude" value={liveLocation?.latitude.toFixed(6) ?? 'Unavailable'} />
            <Metric label="Longitude" value={liveLocation?.longitude.toFixed(6) ?? 'Unavailable'} />
            <Metric label="Reported accuracy" value={liveLocation?.accuracy ? `±${Math.round(liveLocation.accuracy)} m` : 'Unavailable'} />
          </Card>
          <View style={styles.actions}>
            <ActionButton label="Share location" disabled={!liveLocation} onPress={() => void shareLocation()} />
            <ActionButton label="Prepare guardian SMS" disabled={!liveLocation} variant="secondary" onPress={() => void textGuardians()} />
            <ActionButton label="Open Safety Navigator" variant="secondary" onPress={() => router.push('/safety-navigator' as Href)} />
            <ActionButton label="Prepare emergency SMS to 112" variant="danger" onPress={() => void prepareEmergencySms()} />
          </View>
          <Text style={styles.warning}>SafeCity opens the system composer. It cannot send a message silently, promise delivery, or identify a safe route on its own.</Text>
        </>
      ) : null}

      {sensor === 'ai' ? (
        <>
          <Card title="Bundled offline inference" subtitle="The model and fusion policy run on this phone without an inference server.">
            <Metric label="Model" value={ON_DEVICE_MODEL_VERSION} />
            <Metric label="Latest fused risk" value={`${Math.round((latestAssessment?.fusedScore ?? 0) * 100)}%`} />
            <Metric label="Last latency" value={latestAssessment ? `${latestAssessment.latencyMs} ms` : 'No assessment yet'} />
          </Card>
          <Card title="Safety tasks">
            <Text style={styles.task}>✓ Distress audio classification with media-playback suppression</Text>
            <Text style={styles.task}>✓ Free-fall, impact, jerk and rotation correlation</Text>
            <Text style={styles.task}>✓ Multi-sensor temporal confirmation before automatic SOS</Text>
          </Card>
        </>
      ) : null}

      {sensor !== 'location' ? (
        <View style={styles.actions}>
          <ActionButton label="Run live self-check" loading={busy} onPress={() => void runDiagnostic()} />
        </View>
      ) : (
        <View style={styles.actions}>
          <ActionButton label="Refresh GPS fix" loading={busy} onPress={() => void refreshLocation(true)} />
        </View>
      )}

      {diagnostic ? (
        <View style={styles.diagnostic}>
          <Text style={styles.diagnosticText}>{diagnostic}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  closeButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  closeText: { color: colors.watch, fontSize: typography.body, fontWeight: '900' },
  healthBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  healthDot: { width: 13, height: 13, borderRadius: 7 },
  healthCopy: { flex: 1 },
  healthTitle: { color: colors.text, fontSize: typography.heading, fontWeight: '900' },
  healthDetail: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18, marginTop: 4 },
  meterTrack: { height: 28, borderRadius: radii.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden', marginTop: spacing.md },
  meterFill: { height: 28, borderRadius: radii.pill, backgroundColor: colors.safe },
  metric: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.md },
  metricLabel: { color: colors.textMuted, fontSize: typography.caption, flex: 1 },
  metricValue: { color: colors.text, fontSize: typography.caption, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  metricGrid: { marginTop: spacing.xs },
  explainer: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18, marginTop: spacing.md },
  task: { color: colors.text, fontSize: typography.caption, lineHeight: 20, marginTop: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  warning: { color: colors.alert, fontSize: typography.caption, lineHeight: 18, marginTop: spacing.md },
  diagnostic: { borderRadius: radii.md, backgroundColor: colors.safeSoft, borderWidth: 1, borderColor: colors.safeDark, padding: spacing.md, marginTop: spacing.md },
  diagnosticText: { color: colors.text, fontSize: typography.caption, lineHeight: 19 },
});
