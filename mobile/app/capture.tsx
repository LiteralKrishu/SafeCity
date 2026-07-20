import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getIncident, listContacts, updateIncidentEvidence } from '@/db/repository';
import { encryptEvidenceFile } from '@/services/evidence';
import { useMonitoring } from '@/services/MonitoringProvider';
import { sendIncidentSms } from '@/services/sms';
import { colors, radii, spacing, type } from '@/theme/tokens';

type CapturePhase = 'rear' | 'front' | 'photos_done';

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export default function CaptureScreen() {
  const { incidentId } = useLocalSearchParams<{ incidentId: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const monitoring = useMonitoring();
  const [cameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const captureBusy = useRef(false);
  const finalized = useRef(false);
  const [phase, setPhase] = useState<CapturePhase>('rear');
  const [rearUri, setRearUri] = useState<string | null>(null);
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioDone, setAudioDone] = useState(false);
  const [photosDone, setPhotosDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState('Preparing protected capture…');
  const audioRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });

  useEffect(() => {
    void monitoring.suspendForEvidence();
    const interval = setInterval(() => setElapsed((value) => Math.min(value + 1, 15)), 1_000);
    return () => clearInterval(interval);
  }, [monitoring]);

  useEffect(() => {
    let cancelled = false;
    const recordEvidence = async () => {
      try {
        const permission = await AudioModule.getRecordingPermissionsAsync();
        if (!permission.granted) {
          setMessage('Microphone permission is blocked. Capturing available photos only.');
          return;
        }
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setMessage('Recording 15 seconds of incident audio…');
        await wait(15_000);
        if (cancelled) return;
        await audioRecorder.stop();
        if (audioRecorder.uri && incidentId) {
          setAudioUri(await encryptEvidenceFile(audioRecorder.uri, incidentId, 'incident-audio'));
        }
      } catch {
        setMessage('Audio capture was interrupted. Securing available evidence.');
      } finally {
        if (!cancelled) setAudioDone(true);
      }
    };
    void recordEvidence();
    return () => {
      cancelled = true;
      if (audioRecorder.isRecording) void audioRecorder.stop();
    };
  }, [audioRecorder, incidentId]);

  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted) {
      setPhotosDone(true);
      setPhase('photos_done');
      setMessage('Camera permission is blocked. Securing available audio only.');
    }
  }, [cameraPermission]);

  const captureCurrentCamera = useCallback(async () => {
    if (captureBusy.current || !cameraRef.current || !incidentId || phase === 'photos_done') return;
    captureBusy.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.72, exif: false });
      if (!photo?.uri) throw new Error('No photo returned');
      if (phase === 'rear') {
        setRearUri(await encryptEvidenceFile(photo.uri, incidentId, 'rear-photo'));
        setPhase('front');
        setMessage('Rear photo secured. Capturing front camera…');
      } else {
        setFrontUri(await encryptEvidenceFile(photo.uri, incidentId, 'front-photo'));
        setPhase('photos_done');
        setPhotosDone(true);
        setMessage('Both photos secured. Finishing audio capture…');
      }
    } catch {
      if (phase === 'rear') {
        setPhase('front');
        setMessage('Rear camera was unavailable. Trying front camera…');
      } else {
        setPhase('photos_done');
        setPhotosDone(true);
        setMessage('Camera capture was interrupted. Securing available evidence.');
      }
    } finally {
      captureBusy.current = false;
    }
  }, [incidentId, phase]);

  useEffect(() => {
    if (!audioDone || !photosDone || finalized.current || !incidentId) return;
    finalized.current = true;
    const finalize = async () => {
      const capturedCount = [rearUri, frontUri, audioUri].filter(Boolean).length;
      const status = capturedCount === 3 ? 'secured' : capturedCount > 0 ? 'partial' : 'unavailable';
      await updateIncidentEvidence(db, incidentId, {
        rearPhotoUri: rearUri,
        frontPhotoUri: frontUri,
        audioUri,
        status,
      });
      const [incident, contacts] = await Promise.all([getIncident(db, incidentId), listContacts(db)]);
      if (incident && contacts.length > 0) {
        await sendIncidentSms(contacts, incident).catch(() => false);
      }
      await monitoring.resumeAfterEvidence();
      router.replace({ pathname: '/incident/[id]', params: { id: incidentId } });
    };
    void finalize();
  }, [audioDone, audioUri, db, frontUri, incidentId, monitoring, photosDone, rearUri, router]);

  const facing = phase === 'front' ? 'front' : 'back';
  const progress = Math.round((([rearUri, frontUri].filter(Boolean).length + elapsed / 15) / 3) * 100);

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
          <Text style={styles.badgeText}>SOS EVIDENCE CAPTURE</Text>
        </View>
        <View style={styles.center}>
          <View style={styles.progressRing}>
            <Text style={styles.countdown}>{Math.max(15 - elapsed, 0)}</Text>
            <Text style={styles.seconds}>seconds</Text>
          </View>
          <Text style={styles.title}>Stay aware of your surroundings</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
          </View>
          {!audioDone || !photosDone ? <ActivityIndicator color={colors.white} style={styles.loader} /> : null}
        </View>
        <View style={styles.privacyCard}>
          <Text style={styles.lock}>▣</Text>
          <Text style={styles.privacyText}>
            Evidence is encrypted on this device. It is not uploaded by SafeCity.
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
