import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getIncident,
  listContacts,
  readSettings,
  updateIncidentEvidence,
  updateIncidentLocation,
} from '@/db/repository';
import { useLocalization } from '@/i18n/localization-provider';
import { getPreciseCurrentLocation } from '@/services/backgroundLocation';
import { encryptEvidenceFile } from '@/services/evidence';
import { useMonitoring } from '@/services/MonitoringProvider';
import {
  sendIncidentSms,
  sendIncidentSosAutomatically,
} from '@/services/sms';
import { colors, radii, spacing, type } from '@/theme/tokens';

type CapturePhase = 'rear' | 'front' | 'photos_done';

type BoundedResult<T> =
  | { ok: true; value: T }
  | { ok: false };

const CAPTURE_SECONDS = 15;
const CAPTURE_WATCHDOG_MS = 27_000;
const OPERATION_TIMEOUT_MS = 5_000;

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function settleWithin<T>(promise: Promise<T>, milliseconds: number): Promise<BoundedResult<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false });
    }, milliseconds);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve({ ok: true, value });
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve({ ok: false });
      },
    );
  });
}

export default function CaptureScreen() {
  const { incidentId } = useLocalSearchParams<{ incidentId: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { resumeAfterEvidence, suspendForEvidence } = useMonitoring();
  const { t } = useLocalization();
  const [cameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const captureBusy = useRef(false);
  const captureExpired = useRef(false);
  const finalized = useRef(false);
  const preciseLocationUpdate = useRef<Promise<void>>(Promise.resolve());
  const monitoringSuspension = useRef<Promise<void>>(Promise.resolve());
  const [phase, setPhase] = useState<CapturePhase>('rear');
  const [rearUri, setRearUri] = useState<string | null>(null);
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioDone, setAudioDone] = useState(false);
  const [photosDone, setPhotosDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState(() => t('capture.preparing'));
  const audioRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });

  useEffect(() => {
    if (!incidentId) return;
    preciseLocationUpdate.current = getPreciseCurrentLocation()
      .then(async (location) => {
        if (!location) return;
        await updateIncidentLocation(
          db,
          incidentId,
          location.latitude,
          location.longitude,
        );
      })
      .catch(() => undefined);
  }, [db, incidentId]);

  useEffect(() => {
    monitoringSuspension.current = suspendForEvidence().catch(() => undefined);
    const interval = setInterval(
      () => setElapsed((value) => Math.min(value + 1, CAPTURE_SECONDS)),
      1_000,
    );
    const watchdog = setTimeout(() => {
      if (finalized.current) return;
      captureExpired.current = true;
      setPhase('photos_done');
      setPhotosDone(true);
      setAudioDone(true);
      setMessage(t('capture.audioInterrupted'));
      if (audioRecorder.isRecording) {
        void audioRecorder.stop().catch(() => undefined);
      }
    }, CAPTURE_WATCHDOG_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(watchdog);
    };
  }, [audioRecorder, suspendForEvidence, t]);

  useEffect(() => {
    let cancelled = false;
    const recordEvidence = async () => {
      try {
        await settleWithin(monitoringSuspension.current, OPERATION_TIMEOUT_MS);
        const permission = await settleWithin(
          AudioModule.getRecordingPermissionsAsync(),
          OPERATION_TIMEOUT_MS,
        );
        if (!permission.ok || !permission.value.granted) {
          setMessage(t('capture.microphoneBlocked'));
          return;
        }
        const prepared = await settleWithin(
          audioRecorder.prepareToRecordAsync(),
          OPERATION_TIMEOUT_MS,
        );
        if (!prepared.ok || cancelled || captureExpired.current) {
          setMessage(t('capture.audioInterrupted'));
          return;
        }
        audioRecorder.record({ forDuration: CAPTURE_SECONDS });
        setMessage(t('capture.recording'));
        await wait(CAPTURE_SECONDS * 1_000 + 350);
        if (cancelled || captureExpired.current) return;

        if (audioRecorder.isRecording) {
          const stopped = await settleWithin(audioRecorder.stop(), OPERATION_TIMEOUT_MS);
          if (!stopped.ok) {
            setMessage(t('capture.audioInterrupted'));
            return;
          }
        }

        if (audioRecorder.uri && incidentId) {
          const encrypted = await settleWithin(
            encryptEvidenceFile(audioRecorder.uri, incidentId, 'incident-audio'),
            OPERATION_TIMEOUT_MS,
          );
          if (encrypted.ok && !cancelled && !captureExpired.current) {
            setAudioUri(encrypted.value);
          } else if (!encrypted.ok) {
            setMessage(t('capture.audioInterrupted'));
          }
        }
      } catch {
        setMessage(t('capture.audioInterrupted'));
      } finally {
        if (!cancelled) setAudioDone(true);
      }
    };
    void recordEvidence();
    return () => {
      cancelled = true;
      if (audioRecorder.isRecording) {
        void audioRecorder.stop().catch(() => undefined);
      }
    };
  }, [audioRecorder, incidentId, t]);

  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted) {
      setPhotosDone(true);
      setPhase('photos_done');
      setMessage(t('capture.cameraBlocked'));
    }
  }, [cameraPermission, t]);

  const captureCurrentCamera = useCallback(async () => {
    if (
      captureBusy.current ||
      captureExpired.current ||
      !cameraRef.current ||
      !incidentId ||
      phase === 'photos_done'
    ) {
      return;
    }
    captureBusy.current = true;
    try {
      const captured = await settleWithin(
        cameraRef.current.takePictureAsync({ quality: 0.72, exif: false }),
        OPERATION_TIMEOUT_MS,
      );
      if (!captured.ok || !captured.value?.uri || captureExpired.current) {
        throw new Error('No photo returned');
      }
      if (phase === 'rear') {
        const encrypted = await settleWithin(
          encryptEvidenceFile(captured.value.uri, incidentId, 'rear-photo'),
          OPERATION_TIMEOUT_MS,
        );
        if (!encrypted.ok || captureExpired.current) throw new Error('Rear photo unavailable');
        setRearUri(encrypted.value);
        setPhase('front');
        setMessage(t('capture.rearSecured'));
      } else {
        const encrypted = await settleWithin(
          encryptEvidenceFile(captured.value.uri, incidentId, 'front-photo'),
          OPERATION_TIMEOUT_MS,
        );
        if (!encrypted.ok || captureExpired.current) throw new Error('Front photo unavailable');
        setFrontUri(encrypted.value);
        setPhase('photos_done');
        setPhotosDone(true);
        setMessage(t('capture.photosSecured'));
      }
    } catch {
      if (phase === 'rear') {
        setPhase('front');
        setMessage(t('capture.rearUnavailable'));
      } else {
        setPhase('photos_done');
        setPhotosDone(true);
        setMessage(t('capture.cameraInterrupted'));
      }
    } finally {
      captureBusy.current = false;
    }
  }, [incidentId, phase, t]);

  useEffect(() => {
    if (!audioDone || !photosDone || finalized.current || !incidentId) return;
    finalized.current = true;
    const finalize = async () => {
      setMessage(t('capture.finishing'));
      await settleWithin(preciseLocationUpdate.current, OPERATION_TIMEOUT_MS);
      const capturedCount = [rearUri, frontUri, audioUri].filter(Boolean).length;
      const status = capturedCount === 3 ? 'secured' : capturedCount > 0 ? 'partial' : 'unavailable';
      await settleWithin(
        updateIncidentEvidence(db, incidentId, {
          rearPhotoUri: rearUri,
          frontPhotoUri: frontUri,
          audioUri,
          status,
        }),
        OPERATION_TIMEOUT_MS,
      );
      const details = await settleWithin(
        Promise.all([
          getIncident(db, incidentId),
          listContacts(db),
          readSettings(db),
        ]),
        OPERATION_TIMEOUT_MS,
      );
      if (details.ok) {
        const [incident, contacts, settings] = details.value;
        const recipients = contacts.filter(
          (contact) =>
            contact.role === 'guardian' ||
            (contact.role === 'police' && settings.policeSosEnabled),
        );
        if (incident && recipients.length > 0) {
          if (settings.automaticSosMessagingEnabled) {
            const automaticResult = await sendIncidentSosAutomatically(
              recipients,
              incident,
            ).catch(() => null);
            if (automaticResult === null) {
              // Preserve the prepared GPS and evidence message if the device or
              // carrier cannot complete automatic Android dispatch.
              void sendIncidentSms(recipients, incident).catch(() => false);
            }
          } else {
            void sendIncidentSms(recipients, incident).catch(() => false);
          }
        }
      }
      void resumeAfterEvidence().catch(() => undefined);
      router.replace({ pathname: '/incident/[id]', params: { id: incidentId } });
    };
    void finalize().catch(() => {
      void resumeAfterEvidence().catch(() => undefined);
      router.replace({ pathname: '/incident/[id]', params: { id: incidentId } });
    });
  }, [
    audioDone,
    audioUri,
    db,
    frontUri,
    incidentId,
    photosDone,
    rearUri,
    resumeAfterEvidence,
    router,
    t,
  ]);

  const facing = phase === 'front' ? 'front' : 'back';
  const progress = Math.round(
    (([rearUri, frontUri].filter(Boolean).length + elapsed / CAPTURE_SECONDS) / 3) * 100,
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {cameraPermission?.granted && phase !== 'photos_done' ? (
        <CameraView
          key={facing}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="picture"
          onCameraReady={() => void captureCurrentCamera()}
        />
      ) : null}
      <View style={styles.scrim} />
      <View style={styles.content}>
        <View style={styles.badge}>
          <View style={styles.liveDot} />
          <Text style={styles.badgeText}>{t('capture.badge')}</Text>
        </View>
        <View style={styles.center}>
          <View style={styles.progressRing}>
            <Text style={styles.countdown}>{Math.max(CAPTURE_SECONDS - elapsed, 0)}</Text>
            <Text style={styles.seconds}>{t('capture.seconds')}</Text>
          </View>
          <Text style={styles.title}>{t('capture.stayAware')}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
          </View>
          {!audioDone || !photosDone ? <ActivityIndicator color={colors.white} style={styles.loader} /> : null}
        </View>
        <View style={styles.privacyCard}>
          <Text style={styles.lock}>▣</Text>
          <Text style={styles.privacyText}>
            {t('capture.privacy')}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(7,17,31,0.74)',
  },
  content: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  badge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  badgeText: { color: colors.white, fontSize: type.caption, fontWeight: '900', letterSpacing: 1.2 },
  center: { alignItems: 'center' },
  progressRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: colors.danger,
    backgroundColor: 'rgba(67,28,40,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: { color: colors.white, fontSize: 58, fontWeight: '900', lineHeight: 64 },
  seconds: { color: colors.textMuted, fontSize: type.caption, fontWeight: '800' },
  title: { color: colors.white, fontSize: type.title, fontWeight: '800', textAlign: 'center', marginTop: spacing.lg },
  message: { color: colors.textMuted, fontSize: type.body, lineHeight: 22, textAlign: 'center', marginTop: spacing.sm },
  progressTrack: { width: '100%', height: 5, borderRadius: 3, backgroundColor: colors.border, marginTop: spacing.lg },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: colors.danger },
  loader: { marginTop: spacing.lg },
  privacyCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(12,26,43,0.94)',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  lock: { color: colors.safe, fontSize: 22 },
  privacyText: { flex: 1, color: colors.text, fontSize: type.caption, lineHeight: 18 },
});
