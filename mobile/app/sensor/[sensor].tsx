import * as Location from 'expo-location';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import * as SMS from 'expo-sms';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  type ColorValue,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { listContacts, readSettings, writeSettings } from '@/db/repository';
import { useLocalization } from '@/i18n/localization-provider';
import {
  initializeOnDeviceAudio,
  runInferenceSelfCheck,
  type InferencePreparationResult,
} from '@/inference/onDeviceAudio';
import {
  describeDeviceCapabilities,
  getDeviceInferenceCapabilities,
} from '@/inference/deviceCapabilities';
import {
  inferenceModelName,
  inferenceModelOptions,
  recommendedInferenceModel,
  resolveInferenceModel,
} from '@/inference/modelProfiles';
import { useMonitoring } from '@/services/MonitoringProvider';
import { useMonitorStore } from '@/store/monitorStore';
import { colors, radii, spacing, type as typography } from '@/theme/tokens';
import type {
  HealthState,
  InferenceModelPreference,
  VoiceTriggerStatus,
} from '@/types/domain';

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

function compactVoiceTriggerLabel(status: VoiceTriggerStatus): string {
  if (status === 'listening') return 'Armed';
  if (status === 'checking') return 'Starting';
  if (status === 'unavailable') return 'Unavailable';
  if (status === 'error') return 'Attention';
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

function SpectrumReading({
  label,
  value,
  color = colors.text,
}: {
  label: string;
  value: string;
  color?: ColorValue;
}) {
  return (
    <View style={styles.spectrumReading}>
      <Text style={styles.spectrumReadingLabel}>{label}</Text>
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        minimumFontScale={0.7}
        style={[styles.spectrumReadingValue, { color }]}
      >
        {value}
      </Text>
    </View>
  );
}

export default function SensorDetailScreen() {
  const params = useLocalSearchParams<{ sensor?: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const monitoring = useMonitoring();
  const { t } = useLocalization();
  const {
    health,
    inferenceModelPreference,
    latestAssessment,
    sessionState,
    telemetry,
  } = useMonitorStore();
  const [busy, setBusy] = useState(false);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [selfCheck, setSelfCheck] = useState<InferencePreparationResult | null>(null);
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(
    telemetry.location,
  );
  const deviceCapabilities = useMemo(getDeviceInferenceCapabilities, []);
  const recommendedModel = recommendedInferenceModel(deviceCapabilities);
  const selectedRuntimeModel =
    selfCheck?.activeModel ??
    resolveInferenceModel(inferenceModelPreference, deviceCapabilities);

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

  useEffect(() => {
    if (sensor !== 'ai') return;
    let active = true;
    void readSettings(db).then((settings) => {
      if (!active) return;
      useMonitorStore.getState().setInferenceModelPreference(settings.inferenceModel);
    });
    return () => {
      active = false;
    };
  }, [db, sensor]);

  const chooseInferenceModel = async (preference: InferenceModelPreference) => {
    if (busy || preference === inferenceModelPreference) return;
    setBusy(true);
    setDiagnostic(null);
    setSelfCheck(null);
    try {
      const settings = await readSettings(db);
      await writeSettings(db, { ...settings, inferenceModel: preference });
      useMonitorStore.getState().setInferenceModelPreference(preference);
      useMonitorStore.getState().setHealth({ inference: 'checking' });
      const preparation = await initializeOnDeviceAudio(preference, true);
      setSelfCheck(preparation);
      useMonitorStore
        .getState()
        .setHealth({ inference: preparation.fallbackUsed ? 'degraded' : 'ready' });
      setDiagnostic(preparation.message);
    } catch {
      useMonitorStore.getState().setHealth({ inference: 'degraded' });
      setDiagnostic(
        'SafeCity could not save that model choice. The current offline model remains active.',
      );
    } finally {
      setBusy(false);
    }
  };

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
        const result = await runInferenceSelfCheck(inferenceModelPreference);
        const baseline = useMonitorStore.getState().telemetry.behaviorBaseline;
        setSelfCheck(result);
        useMonitorStore
          .getState()
          .setHealth({ inference: result.fallbackUsed ? 'degraded' : 'ready' });
        setDiagnostic(
          `${result.message} Completed in ${result.latencyMs} ms. ` +
            (baseline.enabled
              ? baseline.ready
                ? `Deviation baseline is ready with ${baseline.sampleCount} observations across ${baseline.dayCount} days.`
                : `Deviation baseline is safely warming up: ${baseline.sampleCount} observations across ${baseline.dayCount} of 3 required days.`
              : 'Deviation baseline is turned off.'),
        );
        return;
      }
      if (sessionState === 'idle') await monitoring.startMonitoring();
      else if (sessionState === 'paused') await monitoring.resumeMonitoring();
      setDiagnostic(
        sensor === 'audio'
          ? 'Microphone monitoring is active. Speak normally and watch the live spectrum.'
          : 'Motion monitoring is active. Move the phone gently and watch the live axes.',
      );
    } catch {
      setDiagnostic(
        sensor === 'ai'
          ? 'The selected neural model could not complete its test. Lite Fusion remains available.'
          : 'The sensor diagnostic failed.',
      );
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
        <Card>
          <Text style={styles.spectrumTitle}>REAL-TIME MICROPHONE SPECTRUM</Text>
          <View
            accessibilityLabel={`Live microphone spectrum. Level ${Math.round(telemetry.audioDbFs)} decibels full scale.`}
            style={styles.spectrumPanel}
          >
            {telemetry.audioSpectrum.map((level, index) => (
              <View
                key={index}
                style={[
                  styles.spectrumBar,
                  { height: `${Math.max(3, Math.min(100, level * 100))}%` },
                ]}
              />
            ))}
          </View>
          <View style={styles.spectrumReadings}>
            <SpectrumReading
              label="Level"
              value={telemetry.audioUpdatedAt ? `${Math.round(telemetry.audioDbFs)} dBFS` : '-- dBFS'}
              color={colors.safe}
            />
            <SpectrumReading
              label="Peak"
              value={telemetry.dominantFrequencyHz ? `${telemetry.dominantFrequencyHz} Hz` : '-- Hz'}
            />
            <SpectrumReading
              label="Voice SOS"
              value={compactVoiceTriggerLabel(telemetry.voiceTriggerStatus)}
              color={
                telemetry.voiceTriggerStatus === 'listening'
                  ? colors.safe
                  : telemetry.voiceTriggerStatus === 'checking'
                    ? colors.watch
                    : colors.danger
              }
            />
          </View>
          <View style={styles.spectrumFooter}>
            <Text style={styles.spectrumFooterText}>ON-DEVICE · VOLATILE MEMORY ONLY</Text>
            <Text style={styles.spectrumFooterText}>UNCALIBRATED dBFS</Text>
          </View>
          <Text style={styles.explainer}>
            When Voice SOS is armed, shout “HELP” or “BACHAO” to open the
            10-second SOS countdown. Soft speech is ignored.
          </Text>
        </Card>
      ) : null}

      {sensor === 'motion' ? (
        <Card title="Live 3-axis motion" subtitle="Live accelerometer and calibrated gyroscope values from this phone.">
          <View style={styles.metricGrid}>
            <Metric label="X axis" value={`${(telemetry.motion?.x ?? 0).toFixed(2)} g`} />
            <Metric label="Y axis" value={`${(telemetry.motion?.y ?? 0).toFixed(2)} g`} />
            <Metric label="Z axis" value={`${(telemetry.motion?.z ?? 0).toFixed(2)} g`} />
            <Metric label="Magnitude" value={`${(telemetry.motion?.magnitudeG ?? 0).toFixed(2)} g`} />
            <Metric label="Gyro X" value={`${Math.round(telemetry.motion?.rotationXDegPerSecond ?? 0)} °/s`} />
            <Metric label="Gyro Y" value={`${Math.round(telemetry.motion?.rotationYDegPerSecond ?? 0)} °/s`} />
            <Metric label="Gyro Z" value={`${Math.round(telemetry.motion?.rotationZDegPerSecond ?? 0)} °/s`} />
            <Metric label="Angular speed" value={`${Math.round(telemetry.motion?.rotationMagnitudeDegPerSecond ?? 0)} °/s`} />
          </View>
          <Text style={styles.explainer}>
            A confirmed free-fall + impact, or strong impact + jerk + rotation,
            opens the 10-second SOS countdown. A single small bump may only
            change the readings.
          </Text>
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
          <Card
            title="Model for this phone"
            subtitle={`Detected: ${describeDeviceCapabilities(deviceCapabilities)}. SafeCity recommends ${inferenceModelName(recommendedModel)}.`}
          >
            {inferenceModelOptions.map((option) => {
              const selected = inferenceModelPreference === option.id;
              const recommended =
                option.id === 'auto' || option.id === recommendedModel;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: busy }}
                  disabled={busy}
                  onPress={() => void chooseInferenceModel(option.id)}
                  style={({ pressed }) => [
                    styles.modelOption,
                    selected && styles.modelOptionSelected,
                    pressed && styles.modelOptionPressed,
                  ]}
                >
                  <View style={styles.modelOptionCopy}>
                    <View style={styles.modelOptionTitleRow}>
                      <Text style={styles.modelOptionTitle}>{option.name}</Text>
                      {recommended ? (
                        <Text style={styles.modelBadge}>RECOMMENDED</Text>
                      ) : null}
                    </View>
                    <Text style={styles.modelOptionSummary}>{option.summary}</Text>
                    <Text style={styles.modelOptionBestFor}>{option.bestFor}</Text>
                  </View>
                  <View style={[styles.modelRadio, selected && styles.modelRadioSelected]}>
                    {selected ? <View style={styles.modelRadioCore} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </Card>
          <Card title="Bundled offline inference" subtitle="The selected model and fusion policy run on this phone without an inference server.">
            <Metric label="Selected mode" value={inferenceModelPreference === 'auto' ? 'Automatic' : inferenceModelName(inferenceModelPreference)} />
            <Metric label="Active model" value={inferenceModelName(selectedRuntimeModel)} />
            <Metric label="Model/config" value={latestAssessment?.modelVersion ?? 'Waiting for first assessment'} />
            <Metric label="Latest fused risk" value={`${Math.round((latestAssessment?.fusedScore ?? 0) * 100)}%`} />
            <Metric label="Last assessment" value={latestAssessment ? `${latestAssessment.latencyMs} ms` : 'No assessment yet'} />
            <Metric label="Last self-check" value={selfCheck ? `${selfCheck.latencyMs} ms` : 'Not run yet'} />
          </Card>
          <Card
            title="Adaptive deviation baseline"
            subtitle="Compares the current coarse area, time block, motion intensity and travel speed with encrypted aggregate patterns learned on this phone."
          >
            <Metric
              label="Status"
              value={
                telemetry.behaviorBaseline.phase === 'ready'
                  ? 'Ready'
                  : telemetry.behaviorBaseline.phase === 'limited'
                    ? 'Motion-only'
                    : telemetry.behaviorBaseline.phase === 'warming'
                      ? `Learning ${Math.round(telemetry.behaviorBaseline.progress * 100)}%`
                      : 'Off'
              }
            />
            <Metric
              label="Learning coverage"
              value={`${telemetry.behaviorBaseline.sampleCount} observations · ${telemetry.behaviorBaseline.dayCount}/3 days`}
            />
            <Metric
              label="Coarse-area profiles"
              value={String(telemetry.behaviorBaseline.locationProfileCount)}
            />
            <Metric
              label="Latest deviation"
              value={
                telemetry.behaviorBaseline.ready
                  ? `${Math.round(telemetry.behaviorBaseline.deviationScore * 100)}%`
                  : 'Warm-up required'
              }
            />
            {telemetry.behaviorBaseline.factors.map((factor) => (
              <Text key={factor} style={styles.task}>• {factor}</Text>
            ))}
            <Text style={styles.explainer}>
              Deviation can raise supporting risk but cannot independently start SOS. Clear or disable the learned baseline from Settings.
            </Text>
          </Card>
          <Card title="Safety tasks">
            <Text style={styles.task}>✓ Neural or lightweight distress-audio analysis with automatic failover</Text>
            <Text style={styles.task}>✓ Outdoor wind and steady-noise suppression that preserves speech transients</Text>
            <Text style={styles.task}>✓ Free-fall, impact, jerk and rotation correlation</Text>
            <Text style={styles.task}>✓ Multi-sensor temporal confirmation before automatic SOS</Text>
            <Text style={styles.task}>✓ Encrypted, bounded routine learning with explainable deviation scoring</Text>
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
  spectrumTitle: {
    color: colors.textSubtle,
    fontFamily: 'monospace',
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  spectrumPanel: {
    height: 142,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    overflow: 'hidden',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#090D14',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  spectrumBar: {
    flex: 1,
    backgroundColor: colors.safe,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  spectrumReadings: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  spectrumReading: { flex: 1, minWidth: 0 },
  spectrumReadingLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 3,
  },
  spectrumReadingValue: {
    fontSize: typography.caption,
    fontWeight: '900',
  },
  spectrumFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  spectrumFooterText: {
    color: colors.textSubtle,
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800',
  },
  metric: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.md },
  metricLabel: { color: colors.textMuted, fontSize: typography.caption, flex: 1 },
  metricValue: { color: colors.text, fontSize: typography.caption, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  metricGrid: { marginTop: spacing.xs },
  modelOption: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  modelOptionSelected: {
    borderColor: colors.safe,
    backgroundColor: colors.safeSoft,
  },
  modelOptionPressed: { opacity: 0.78 },
  modelOptionCopy: { flex: 1 },
  modelOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modelOptionTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  modelBadge: {
    color: colors.safe,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modelOptionSummary: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
    marginTop: 5,
  },
  modelOptionBestFor: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
  },
  modelRadio: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.textMuted,
    borderRadius: 11,
  },
  modelRadioSelected: { borderColor: colors.safe },
  modelRadioCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.safe,
  },
  explainer: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18, marginTop: spacing.md },
  task: { color: colors.text, fontSize: typography.caption, lineHeight: 20, marginTop: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  warning: { color: colors.alert, fontSize: typography.caption, lineHeight: 18, marginTop: spacing.md },
  diagnostic: { borderRadius: radii.md, backgroundColor: colors.safeSoft, borderWidth: 1, borderColor: colors.safeDark, padding: spacing.md, marginTop: spacing.md },
  diagnosticText: { color: colors.text, fontSize: typography.caption, lineHeight: 19 },
});
