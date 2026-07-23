import * as Linking from 'expo-linking';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useLocalization } from '@/i18n/localization-provider';
import { decryptEvidenceToCache, deleteEvidenceFiles } from '@/services/evidence';
import { sendIncidentSms } from '@/services/sms';
import { colors, radii, spacing, type } from '@/theme/tokens';
import type { Incident } from '@/types/domain';

type AudioTarget = 'snapshot' | 'post';

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { languageTag, t } = useLocalization();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioTarget, setAudioTarget] = useState<AudioTarget | null>(null);
  const audioPlayer = useAudioPlayer(null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const decryptedAudio = useRef<string | null>(null);

  const clearDecryptedAudio = useCallback(() => {
    const uri = decryptedAudio.current;
    if (!uri) return;
    const file = new File(uri);
    if (file.exists) file.delete();
    decryptedAudio.current = null;
  }, []);

  useEffect(() => {
    audioPlayer.pause();
    setAudioTarget(null);
    clearDecryptedAudio();
  }, [audioPlayer, clearDecryptedAudio, incident?.id]);

  useEffect(
    () => () => {
      clearDecryptedAudio();
    },
    [clearDecryptedAudio],
  );

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
      <Screen title={t('incident.unavailableTitle')}>
        <Text style={styles.body}>{t('incident.unavailableBody')}</Text>
      </Screen>
    );
  }

  const notify = async () => {
    const contacts = await listContacts(db);
    if (!(await sendIncidentSms(contacts, incident))) {
      Alert.alert(t('incident.smsUnavailableTitle'), t('incident.smsUnavailableBody'));
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
    Alert.alert(t('incident.deleteTitle'), t('incident.deleteBody'), [
      { text: t('incident.keep'), style: 'cancel' },
      {
        text: t('incident.delete'),
        style: 'destructive',
        onPress: () => {
          deleteEvidenceFiles([
            incident.snapshotAudioUri,
            incident.rearPhotoUri,
            incident.frontPhotoUri,
            incident.audioUri,
          ]);
          void deleteIncidentRecord(db, incident.id).then(() => router.replace('/(tabs)/history'));
        },
      },
    ]);
  };

  const toggleAudio = async (target: AudioTarget) => {
    const uri = target === 'snapshot' ? incident.snapshotAudioUri : incident.audioUri;
    if (!uri) return;
    if (audioTarget === target && audioStatus.playing) {
      audioPlayer.pause();
      return;
    }
    try {
      setAudioBusy(true);
      if (audioTarget !== target || !decryptedAudio.current) {
        audioPlayer.pause();
        clearDecryptedAudio();
        decryptedAudio.current = await decryptEvidenceToCache(
          uri,
          `safecity-incident-${incident.id}-${target}.${target === 'snapshot' ? 'wav' : 'm4a'}`,
        );
        audioPlayer.replace(decryptedAudio.current);
        setAudioTarget(target);
      } else if (audioStatus.didJustFinish) {
        await audioPlayer.seekTo(0);
      }
      audioPlayer.play();
    } catch {
      Alert.alert('Audio unavailable', 'SafeCity could not decrypt and play this local evidence file.');
    } finally {
      setAudioBusy(false);
    }
  };

  const exportEncryptedAudio = (uri: string, dialogTitle: string) => {
    if (!uri) return;
    Alert.alert(
      'Export encrypted evidence?',
      'This creates a copy outside SafeCity’s private vault. The exported .safe file remains AES-GCM encrypted, but whoever receives it can retain it.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Export encrypted file',
          onPress: () => {
            void Sharing.isAvailableAsync().then(async (available) => {
              if (!available) {
                Alert.alert('Sharing unavailable', 'This phone cannot open a file sharing sheet.');
                return;
              }
              await Sharing.shareAsync(uri, {
                dialogTitle,
                mimeType: 'application/octet-stream',
                UTI: 'public.data',
              });
            });
          },
        },
      ],
    );
  };

  const evidence = [
    { label: t('incident.snapshotAudio'), ready: Boolean(incident.snapshotAudioUri) },
    { label: t('incident.rearPhoto'), ready: Boolean(incident.rearPhotoUri) },
    { label: t('incident.frontPhoto'), ready: Boolean(incident.frontPhotoUri) },
    { label: t('incident.audio'), ready: Boolean(incident.audioUri) },
  ];

  return (
    <Screen
      eyebrow={incident.state === 'resolved' ? t('incident.resolvedEyebrow') : t('incident.activeEyebrow')}
      title={t('incident.title')}
      right={
        <Pressable onPress={() => router.back()}>
          <Text style={styles.close}>{t('incident.close')}</Text>
        </Pressable>
      }
    >
      <View style={[styles.stateBanner, incident.state === 'resolved' && styles.resolvedBanner]}>
        <Text style={styles.stateLabel}>{incident.state === 'resolved' ? t('incident.resolved') : t('incident.sosActive')}</Text>
        <Text style={styles.timestamp}>{new Date(incident.createdAt).toLocaleString(languageTag)}</Text>
      </View>

      <Card title={incident.summary} subtitle={t('incident.model', { version: incident.modelVersion })}>
        <Text style={styles.score}>{t('incident.risk', { score: Math.round(incident.riskScore * 100) })}</Text>
        {incident.factors.map((factor) => (
          <Text key={factor} style={styles.factor}>• {factor}</Text>
        ))}
      </Card>

      <Text style={styles.sectionLabel}>{t('incident.evidenceSection')}</Text>
      <Card subtitle={t('incident.evidenceDetail')}>
        {evidence.map((item) => (
          <View key={item.label} style={styles.evidenceRow}>
            <Text style={styles.evidenceIcon}>{item.ready ? '✓' : '—'}</Text>
            <Text style={styles.evidenceLabel}>{item.label}</Text>
            <Text style={[styles.evidenceState, item.ready && styles.ready]}> {item.ready ? t('incident.secured') : t('incident.unavailable')} </Text>
          </View>
        ))}
        {incident.snapshotAudioUri || incident.audioUri ? (
          <View style={styles.audioAction}>
            {incident.snapshotAudioUri ? (
              <>
                <ActionButton
                  label={
                    audioTarget === 'snapshot' && audioStatus.playing
                      ? t('incident.pauseSnapshotAudio')
                      : t('incident.playSnapshotAudio')
                  }
                  loading={audioBusy}
                  onPress={() => void toggleAudio('snapshot')}
                  variant="secondary"
                />
                <ActionButton
                  label={t('incident.exportSnapshot')}
                  onPress={() => exportEncryptedAudio(incident.snapshotAudioUri!, 'Export encrypted SafeCity snapshot')}
                  variant="secondary"
                />
              </>
            ) : null}
            {incident.audioUri ? (
              <>
                <ActionButton
                  label={
                    audioTarget === 'post' && audioStatus.playing
                      ? t('incident.pausePostAudio')
                      : t('incident.playPostAudio')
                  }
                  loading={audioBusy}
                  onPress={() => void toggleAudio('post')}
                  variant="secondary"
                />
                <ActionButton
                  label="Export encrypted audio"
                  onPress={() => exportEncryptedAudio(incident.audioUri!, 'Export encrypted SafeCity audio')}
                  variant="secondary"
                />
              </>
            ) : null}
            <Text style={styles.audioNote}>{t('incident.audioNote')}</Text>
          </View>
        ) : null}
      </Card>

      <Text style={styles.sectionLabel}>{t('incident.response')}</Text>
      <View style={styles.actions}>
        <ActionButton label={t('incident.notify')} onPress={() => void notify()} variant="danger" />
        {incident.latitude !== null && incident.longitude !== null ? (
          <ActionButton
            label={t('incident.openLocation')}
            onPress={() => void Linking.openURL(`https://maps.google.com/?q=${incident.latitude},${incident.longitude}`)}
            variant="secondary"
          />
        ) : null}
        {incident.state !== 'resolved' ? (
          <ActionButton label={t('incident.markSafe')} onPress={() => void resolve()} variant="secondary" />
        ) : null}
      </View>

      <Text style={styles.sectionLabel}>{t('incident.useful')}</Text>
      <View style={styles.feedbackRow}>
        <Pressable
          onPress={() => void setFeedback('correct')}
          style={[styles.feedback, incident.feedback === 'correct' && styles.feedbackSelected]}
        >
          <Text style={styles.feedbackText}>{t('incident.correct')}</Text>
        </Pressable>
        <Pressable
          onPress={() => void setFeedback('false_positive')}
          style={[styles.feedback, incident.feedback === 'false_positive' && styles.feedbackSelected]}
        >
          <Text style={styles.feedbackText}>{t('incident.falseAlarm')}</Text>
        </Pressable>
      </View>

      <Pressable onPress={remove} style={styles.deleteButton}>
        <Text style={styles.deleteText}>{t('incident.deleteButton')}</Text>
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
  audioAction: { gap: spacing.sm, marginTop: spacing.md },
  audioNote: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18 },
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
